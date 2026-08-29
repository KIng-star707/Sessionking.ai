import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Clock, AlertTriangle, ArrowRight, X, Sparkles, RefreshCw, ShieldAlert } from "lucide-react";
import { User as UserProfile, Plan } from "../types";
import { getSubscriptionStatusDetails, SubscriptionStatusDetails } from "../lib/subscriptionSync";
import { cn } from "../lib/utils";

interface SubscriptionBannerProps {
  userProfile: UserProfile | null;
  onRenew: () => void;
}

export default function SubscriptionBanner({ userProfile, onRenew }: SubscriptionBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [statusDetails, setStatusDetails] = useState<SubscriptionStatusDetails | null>(null);

  useEffect(() => {
    if (userProfile) {
      const details = getSubscriptionStatusDetails(userProfile);
      setStatusDetails(details);
      // Reset dismissal when user data changes
      setIsDismissed(false);
    } else {
      setStatusDetails(null);
    }
  }, [userProfile]);

  if (!userProfile || isDismissed || !statusDetails) {
    return null;
  }

  // Check if we should display the expiring soon banner
  const isExpiringSoon = statusDetails.isExpiringSoon && statusDetails.isActive;
  
  // Check if user recently expired and returned to free tier
  const isRecentlyExpired = (userProfile.currentPlan === 'free' || userProfile.plan === 'free') && 
    (userProfile.paymentStatus === 'expired' || userProfile.subscriptionExpiredAt);

  if (!isExpiringSoon && !isRecentlyExpired) {
    return null;
  }

  const planName = (statusDetails.plan !== 'free' ? statusDetails.plan : (userProfile as any).previousPlan || 'Pro').toUpperCase();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="w-full relative z-40"
      >
        {isExpiringSoon ? (
          <div className="bg-gradient-to-r from-amber-950/90 via-amber-900/80 to-black/95 border-b border-amber-500/40 text-white px-4 py-3 shadow-lg">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 shrink-0 border border-amber-500/30">
                  <Clock className="w-4 h-4 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-amber-300 mr-2 uppercase tracking-wider text-[11px] sm:text-xs">
                    Subscription Renewal Notice:
                  </span>
                  <span className="text-gray-200">
                    Your 30-day <strong className="text-white">{planName}</strong> plan expires in{" "}
                    <strong className="text-amber-300 font-mono">
                      {statusDetails.daysRemaining === 0 
                        ? `${statusDetails.hoursRemaining} hours` 
                        : `${statusDetails.daysRemaining} day${statusDetails.daysRemaining > 1 ? 's' : ''}`}
                    </strong>{" "}
                    ({statusDetails.formattedExpiry}). Renew to prevent automatic return to Free tier.
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                <button
                  onClick={onRenew}
                  className="px-4 py-1.5 bg-amber-400 hover:bg-amber-300 text-matte-black font-bold rounded-lg text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(251,191,36,0.3)] hover:scale-105 active:scale-95"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Renew Subscription</span>
                </button>
                <button
                  onClick={() => setIsDismissed(true)}
                  className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                  aria-label="Dismiss banner"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ) : isRecentlyExpired ? (
          <div className="bg-gradient-to-r from-red-950/90 via-black/90 to-amber-950/80 border-b border-red-500/40 text-white px-4 py-3 shadow-lg">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-red-500/20 text-red-400 shrink-0 border border-red-500/30">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-red-300 mr-2 uppercase tracking-wider text-[11px] sm:text-xs">
                    Subscription Expired:
                  </span>
                  <span className="text-gray-300">
                    Your 30-day <strong className="text-white">{planName}</strong> plan has ended and your account has returned to the <strong className="text-amber-400">Free Tier</strong>. Renew anytime to restore institutional signals.
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                <button
                  onClick={onRenew}
                  className="px-4 py-1.5 bg-gradient-to-r from-gold to-amber-400 hover:from-amber-300 hover:to-gold text-matte-black font-bold rounded-lg text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(212,175,55,0.3)] hover:scale-105 active:scale-95"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Reactivate Plan</span>
                </button>
                <button
                  onClick={() => setIsDismissed(true)}
                  className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                  aria-label="Dismiss banner"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
}
