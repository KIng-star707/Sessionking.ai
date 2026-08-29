import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Plan } from "../types";

export interface SubscriptionStatusDetails {
  plan: Plan;
  isActive: boolean;
  isExpiringSoon: boolean;
  isExpired: boolean;
  daysRemaining: number;
  hoursRemaining: number;
  expiryDate: Date | null;
  startDate: Date | null;
  formattedExpiry: string;
  statusBadge: "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "FREE";
  statusMessage: string;
}

/**
 * Calculates comprehensive 30-day subscription metrics from user profile data.
 */
export function getSubscriptionStatusDetails(userProfile: any): SubscriptionStatusDetails {
  const rawPlan = (userProfile?.currentPlan || userProfile?.plan || "free").toString().toLowerCase();
  const currentPlan: Plan = (["free", "pro", "premium", "institutional"].includes(rawPlan) ? rawPlan : "free") as Plan;

  if (!userProfile || currentPlan === 'free') {
    return {
      plan: 'free',
      isActive: false,
      isExpiringSoon: false,
      isExpired: false,
      daysRemaining: 0,
      hoursRemaining: 0,
      expiryDate: null,
      startDate: null,
      formattedExpiry: "N/A (Free Tier)",
      statusBadge: "FREE",
      statusMessage: "Free Tier - Access to standard delayed signals."
    };
  }

  const now = new Date();
  let expiryDate: Date | null = null;
  let startDate: Date | null = null;

  if (userProfile.subscriptionStartDate) {
    const s = new Date(userProfile.subscriptionStartDate);
    if (!isNaN(s.getTime())) startDate = s;
  }

  if (userProfile.subscriptionExpiryDate) {
    const e = new Date(userProfile.subscriptionExpiryDate);
    if (!isNaN(e.getTime())) expiryDate = e;
  } else if (startDate) {
    // If explicit expiry date is not set, derive exactly 30 days from start date
    expiryDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  }

  // If no date at all but subscription was marked active
  if (!expiryDate) {
    expiryDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }

  const diffMs = expiryDate.getTime() - now.getTime();
  const isExpired = diffMs <= 0 || userProfile.subscriptionActive === false;
  const daysRemaining = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
  const hoursRemaining = Math.max(0, Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)));
  const isExpiringSoon = !isExpired && daysRemaining <= 5; // within 5 days

  let statusBadge: "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "FREE" = "ACTIVE";
  let statusMessage = `Active 30-day ${currentPlan.toUpperCase()} access (${daysRemaining}d ${hoursRemaining}h remaining).`;

  if (isExpired) {
    statusBadge = "EXPIRED";
    statusMessage = `30-day subscription expired. Account returned to Free tier.`;
  } else if (isExpiringSoon) {
    statusBadge = "EXPIRING_SOON";
    statusMessage = `Subscription expiring in ${daysRemaining === 0 ? `${hoursRemaining} hours` : `${daysRemaining} day(s)`}. Renew now to prevent downgrade.`;
  }

  return {
    plan: currentPlan,
    isActive: !isExpired && userProfile.subscriptionActive === true,
    isExpiringSoon,
    isExpired,
    daysRemaining,
    hoursRemaining,
    expiryDate,
    startDate,
    formattedExpiry: expiryDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
    statusBadge,
    statusMessage
  };
}

/**
 * Synchronization utility to bridge the gap between Firestore user documents,
 * payment statuses, and 30-day subscription expiration timings.
 */
export async function syncUserSubscription(
  uid: string,
  userProfile: any,
  onDowngradeCallback?: (downgradedProfile: any) => void
): Promise<{ resolvedPlan: Plan; updatedProfile: any; details: SubscriptionStatusDetails }> {
  if (!userProfile) {
    const emptyDetails = getSubscriptionStatusDetails(null);
    return { resolvedPlan: "free", updatedProfile: null, details: emptyDetails };
  }

  const nowIso = new Date().toISOString();
  let updatedProfile = { ...userProfile };
  const rawPlan = (userProfile.currentPlan || userProfile.plan || "free").toString().toLowerCase();
  let currentPlan: Plan = (["free", "pro", "premium", "institutional"].includes(rawPlan) ? rawPlan : "free") as Plan;

  // Determine if subscription has elapsed 30 days
  let isExpired = false;
  if (currentPlan !== 'free') {
    if (userProfile.subscriptionExpiryDate) {
      if (new Date(userProfile.subscriptionExpiryDate).getTime() < Date.now()) {
        isExpired = true;
      }
    } else if (userProfile.subscriptionStartDate) {
      const startMs = new Date(userProfile.subscriptionStartDate).getTime();
      if (!isNaN(startMs) && Date.now() - startMs > 30 * 24 * 60 * 60 * 1000) {
        isExpired = true;
      }
    }
  }

  // Check for expired subscription and safely downgrade to free tier
  if (currentPlan !== 'free' && isExpired) {
    console.log(`[SubscriptionSync] Detected expired plan "${currentPlan}" on client (30-day duration ended). Performing safe downgrade to free tier...`);
    try {
      const userRef = doc(db, "users", uid);
      const downgradePayload = {
        subscriptionActive: false,
        currentPlan: 'free',
        plan: 'free',
        previousPlan: currentPlan,
        paymentStatus: 'expired',
        subscriptionExpiredAt: nowIso,
        updatedAt: nowIso
      };

      await updateDoc(userRef, downgradePayload);

      // Update local profile state
      currentPlan = 'free';
      updatedProfile = { ...updatedProfile, ...downgradePayload };

      if (onDowngradeCallback) {
        onDowngradeCallback(updatedProfile);
      }
    } catch (err) {
      console.warn("[SubscriptionSync] Client-side auto-downgrade failed (may lack permissions or offline):", err);
    }
  }

  const details = getSubscriptionStatusDetails(updatedProfile);

  return {
    resolvedPlan: currentPlan,
    updatedProfile,
    details
  };
}

