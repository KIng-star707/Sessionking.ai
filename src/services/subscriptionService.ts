import crypto from "crypto";
import {
  getFirestoreDocRest,
  createFirestoreDocRest,
  updateFirestoreDocRest,
  queryFirestoreDocsRest
} from "./firebaseRestService.ts";

export const verifyPaystackSignature = (req: any, secret: string) => {
  const hash = crypto.createHmac('sha512', secret).update(JSON.stringify(req.body)).digest('hex');
  return hash === req.headers['x-paystack-signature'];
};

export const verifyPaystackTransaction = async (reference: string, secretKey: string) => {
  const url = `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secretKey}`
    }
  });
  
  if (!res.ok) {
    throw new Error(`Paystack verification failed: ${res.statusText}`);
  }
  
  const data = await res.json();
  if (!data.status) {
    throw new Error(`Paystack verification API error: ${data.message}`);
  }
  
  return data.data; // { status, reference, amount, metadata, customer, etc. }
};

export const activateSubscription = async (uid: string, type: string, planName: string, amount: number, reference: string, transactionId: string) => {
  // Prevent duplicate activation
  const query = {
    structuredQuery: {
      from: [{ collectionId: 'payments' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'paystackReference' },
          op: 'EQUAL',
          value: { stringValue: reference }
        }
      },
      limit: 1
    }
  };
  const payments = await queryFirestoreDocsRest(query);
  if (payments.length > 0) {
    const existing = payments[0].data();
    if (existing.status === 'successful') {
      return { success: true, message: 'Already activated' }; // Idempotent
    }
  }

  const userDoc = await getFirestoreDocRest('users', uid);
  if (!userDoc.exists) {
    throw new Error("User not found in Firestore");
  }

  const now = new Date();

  // Create payment record
  const paymentId = crypto.randomUUID();
  await createFirestoreDocRest('payments', paymentId, {
    uid,
    email: userDoc.data()?.email || "",
    type: type || 'subscription',
    planName: type === 'intelligence' ? 'intelligence' : planName,
    amount,
    paystackReference: reference,
    paystackTransactionId: String(transactionId),
    status: 'successful',
    verifiedByBackend: true,
    createdAt: now.toISOString(),
    verifiedAt: now.toISOString()
  });

  if (type === 'intelligence') {
    const userData = userDoc.data() || {};
    const currentCredits = userData.intelligenceCredits || 0;
    const currentPurchased = userData.totalCreditsPurchased || userData.intelligenceCreditsPurchased || currentCredits;
    const newCredits = currentCredits + 3;
    const newPurchased = currentPurchased + 3;
    
    await updateFirestoreDocRest('users', uid, {
      intelligenceCredits: newCredits,
      totalCreditsPurchased: newPurchased,
      intelligenceCreditsPurchased: newPurchased,
      intelligenceActive: true,
      lastPaymentAmount: amount,
      lastPaymentDate: now.toISOString(),
      updatedAt: now.toISOString()
    });

    const lgId = crypto.randomUUID();
    await createFirestoreDocRest('intelligence_transactions', lgId, {
      uid,
      action: "purchase",
      creditsBefore: currentCredits,
      creditsAfter: newCredits,
      amount: amount || 5,
      timestamp: now.toISOString(),
      status: "completed",
      performedBy: "system"
    });
  } else {
    // Subscription Logic: strict 30-day duration on all plans
    const expiryDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // exactly 30 days

    await updateFirestoreDocRest('users', uid, {
      currentPlan: planName,
      plan: planName,
      subscriptionActive: true,
      subscriptionStartDate: now.toISOString(),
      subscriptionExpiryDate: expiryDate.toISOString(),
      paystackReference: reference,
      lastPaymentAmount: amount,
      lastPaymentDate: now.toISOString(),
      paymentStatus: 'successful',
      lastExpiryReminderDate: null,
      updatedAt: now.toISOString()
    });

    // Create subscription log
    const logId = crypto.randomUUID();
    await createFirestoreDocRest('subscription_logs', logId, {
      uid,
      action: "subscription_created",
      planName,
      durationDays: 30,
      expiryDate: expiryDate.toISOString(),
      timestamp: now.toISOString(),
      performedBy: "system"
    });

    // Create confirmation in-app notification
    const notifId = crypto.randomUUID();
    await createFirestoreDocRest(`users/${uid}/notifications`, notifId, {
      title: `${planName.toUpperCase()} Plan Activated`,
      message: `Your 30-day ${planName} subscription is active until ${expiryDate.toLocaleDateString()}. Enjoy full access to institutional signals and market intelligence.`,
      type: "SYSTEM",
      priority: "NORMAL",
      isRead: false,
      timestamp: now.toISOString()
    });
  }

  return { success: true, message: type === 'intelligence' ? "Intelligence credits added" : "Subscription activated" };
};

export const consumeIntelligenceCredit = async (uid: string) => {
  const userDoc = await getFirestoreDocRest('users', uid);
  if (!userDoc.exists) throw new Error("User not found");
  
  const userData = userDoc.data() || {};
  const creditsBefore = userData.intelligenceCredits || 0;
  if (creditsBefore <= 0) {
    throw new Error("Insufficient intelligence credits");
  }
  
  const creditsAfter = Math.max(0, creditsBefore - 1);
  const currentUsed = userData.creditsUsed || userData.intelligenceCreditsUsed || 0;
  const newUsed = currentUsed + 1;
  const nowStr = new Date().toISOString();
  
  await updateFirestoreDocRest('users', uid, {
    intelligenceCredits: creditsAfter,
    creditsUsed: newUsed,
    intelligenceCreditsUsed: newUsed,
    lastCreditUsageTimestamp: nowStr,
    intelligenceActive: creditsAfter > 0,
    updatedAt: nowStr
  });
  
  const lgId = crypto.randomUUID();
  await createFirestoreDocRest('intelligence_transactions', lgId, {
    uid,
    action: "usage",
    creditsBefore,
    creditsAfter,
    timestamp: nowStr,
    status: "completed",
    performedBy: "system"
  });
  
  return { success: true, remaining: creditsAfter };
};

export const handlePaymentFailure = async (uid: string | null, email: string, reference: string, amount: number, planName: string) => {
  try {
    const paymentId = crypto.randomUUID();
    await createFirestoreDocRest('payments', paymentId, {
      uid: uid || "unknown",
      email,
      planName,
      amount,
      paystackReference: reference,
      paystackTransactionId: "none",
      status: 'failed',
      verifiedByBackend: true,
      createdAt: new Date().toISOString(),
      verifiedAt: new Date().toISOString()
    });
    
    if (uid) {
      const logId = crypto.randomUUID();
      await createFirestoreDocRest('subscription_logs', logId, {
        uid,
        action: "subscription_cancelled",
        planName,
        timestamp: new Date().toISOString(),
        performedBy: "system"
      });
    }
  } catch (e) {
    console.error("Failed to log payment failure", e);
  }
};

export const processExpiredSubscriptions = async () => {
  const now = new Date().toISOString();
  
  // Find expired active subscriptions
  const query = {
    structuredQuery: {
      from: [{ collectionId: 'users' }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            {
              fieldFilter: {
                field: { fieldPath: 'subscriptionActive' },
                op: 'EQUAL',
                value: { booleanValue: true }
              }
            },
            {
              fieldFilter: {
                field: { fieldPath: 'subscriptionExpiryDate' },
                op: 'LESS_THAN',
                value: { stringValue: now }
              }
            }
          ]
        }
      }
    }
  };
  
  let expiredUsers: any[] = [];
  try {
    expiredUsers = await queryFirestoreDocsRest(query);
  } catch (err) {
    console.warn("Failed to query expired subscriptions via composite filter, trying broad fallback:", err);
  }

  if (expiredUsers.length === 0) return 0;

  let count = 0;
  for (const doc of expiredUsers) {
    const uid = doc.id;
    const userData = doc.data() || {};
    const previousPlan = userData.currentPlan || userData.plan || 'pro';
    
    // Automatically return account to free tier
    await updateFirestoreDocRest('users', uid, {
      subscriptionActive: false,
      paymentStatus: 'expired',
      currentPlan: 'free',
      plan: 'free',
      previousPlan: previousPlan,
      subscriptionExpiredAt: now,
      updatedAt: now
    });
    
    // Log expiration
    const logId = crypto.randomUUID();
    await createFirestoreDocRest('subscription_logs', logId, {
      uid,
      action: 'subscription_expired',
      planName: previousPlan,
      reason: '30_day_period_elapsed',
      timestamp: now,
      performedBy: 'system'
    });

    // Send user notification about returning to free tier
    const notifId = crypto.randomUUID();
    await createFirestoreDocRest(`users/${uid}/notifications`, notifId, {
      title: "Subscription Expired - Returned to Free Tier",
      message: `Your 30-day ${previousPlan.toUpperCase()} subscription has expired and your account has returned to the Free tier. Renew your subscription at any time to reopen full ${previousPlan.toUpperCase()} signals and features.`,
      type: "SYSTEM",
      priority: "HIGH",
      isRead: false,
      timestamp: now
    });
    
    count++;
  }
  
  return count;
};

export const processSubscriptionReminders = async () => {
  const now = new Date();
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = now.toISOString();

  // Find active subscriptions expiring in the next 3 days
  const query = {
    structuredQuery: {
      from: [{ collectionId: 'users' }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            {
              fieldFilter: {
                field: { fieldPath: 'subscriptionActive' },
                op: 'EQUAL',
                value: { booleanValue: true }
              }
            },
            {
              fieldFilter: {
                field: { fieldPath: 'subscriptionExpiryDate' },
                op: 'LESS_THAN_OR_EQUAL',
                value: { stringValue: in3Days }
              }
            }
          ]
        }
      }
    }
  };

  let upcomingExpiringUsers: any[] = [];
  try {
    upcomingExpiringUsers = await queryFirestoreDocsRest(query);
  } catch (err) {
    console.warn("Failed to query upcoming expiring users:", err);
    return 0;
  }

  let reminderCount = 0;
  for (const doc of upcomingExpiringUsers) {
    const uid = doc.id;
    const userData = doc.data() || {};
    const expiryDateStr = userData.subscriptionExpiryDate;
    
    // Skip if already in the past (handled by processExpiredSubscriptions)
    if (!expiryDateStr || expiryDateStr < nowIso) continue;

    // Check if reminder was already sent for this expiry cycle
    if (userData.lastExpiryReminderDate === expiryDateStr) continue;

    const expiryDate = new Date(expiryDateStr);
    const diffMs = expiryDate.getTime() - now.getTime();
    const daysLeft = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
    const planName = (userData.currentPlan || userData.plan || 'pro').toUpperCase();

    // Send in-app reminder notification
    const notifId = crypto.randomUUID();
    await createFirestoreDocRest(`users/${uid}/notifications`, notifId, {
      title: `⚠️ ${planName} Subscription Expiring Soon`,
      message: `Your 30-day ${planName} subscription will expire in ${daysLeft} day(s) on ${expiryDate.toLocaleDateString()}. Please renew your subscription to maintain continuous access to signals without interruption.`,
      type: "SYSTEM",
      priority: "HIGH",
      isRead: false,
      timestamp: nowIso
    });

    // Mark reminder as sent for this cycle
    await updateFirestoreDocRest('users', uid, {
      lastExpiryReminderDate: expiryDateStr,
      updatedAt: nowIso
    });

    reminderCount++;
  }

  return reminderCount;
};

