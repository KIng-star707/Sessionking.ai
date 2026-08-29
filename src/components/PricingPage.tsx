import { motion } from "motion/react";
import { useState, useEffect } from "react";
import { Check, X, Zap, ShieldCheck, Star, Brain } from "lucide-react";
import { PLANS, Plan } from "../types";
import { cn } from "../lib/utils";
import { usePaystackPayment } from "../lib/paystack";

interface PricingPageProps {
  user?: any;
  currentPlan: Plan;
  onSelectPlan: (plan: Plan) => void;
  onAuthRedirect: () => void;
  onTerminalRedirect?: () => void;
}

export default function PricingPage({ user, currentPlan, onSelectPlan, onAuthRedirect, onTerminalRedirect }: PricingPageProps) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [rates, setRates] = useState<any>(null);

  useEffect(() => {
    fetch('/api/payment-rates')
      .then(res => res.json())
      .then(data => {
        if (data && data.rates) {
          setRates(data.rates);
        }
      })
      .catch(err => console.warn("Failed to load rates:", err.message || err));
  }, []);

  const getPlanPriceCents = (planId: string) => {
    if (rates) {
      if (planId === 'pro') return Math.round(rates.pro * 100);
      if (planId === 'premium') return Math.round(rates.premium * 100);
      if (planId === 'institutional') return Math.round(rates.institutional * 100);
    }
    // Fallback USD to minor NGN (assuming 1500 rate)
    switch (planId) {
      case 'pro': return 30 * 1500 * 100;
      case 'premium': return 60 * 1500 * 100;
      case 'institutional': return 100 * 1500 * 100;
      default: return 0;
    }
  };

  const handlePaymentSuccess = async (reference: any, planId: string) => {
    try {
      const auth = await import("firebase/auth").then(m => m.getAuth());
      const token = await auth.currentUser?.getIdToken();
      
      const res = await fetch("/api/verify-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          reference: reference.reference,
          type: "subscription",
          planName: planId,
          amount: getPlanPriceCents(planId)
        })
      });
      
      if (!res.ok) {
        throw new Error("Server verification failed");
      }
      
      alert("Payment successful! Your premium access is now active.");
      
      // Update local state by refetching or relying on firestore listener
      onSelectPlan(planId as Plan);
    } catch (e) {
      console.error(e);
      alert("Payment was successful but verification failed. Please contact support.");
    } finally {
      setLoadingPlan(null);
    }
  };

  const initializePayment = usePaystackPayment({
    reference: (new Date()).getTime().toString(),
    email: user?.email || "",
    amount: 0,
    publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "pk_test_placeholder",
  } as any);

  const initiatePlanPurchase = (planId: string) => {
    if (!user) {
      onAuthRedirect();
      return;
    }
    if (planId === 'free') {
      onSelectPlan('free');
      return;
    }

    setLoadingPlan(planId);
    
    // Paystack overrides
    const amount = getPlanPriceCents(planId);
    initializePayment({
        onSuccess: (ref) => handlePaymentSuccess(ref, planId),
        onClose: () => {
           setLoadingPlan(null);
           console.log("Payment modal closed");
        },
        config: {
           reference: (new Date()).getTime().toString(),
           email: user.email,
           amount: amount,
           publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "pk_test_placeholder",
           metadata: {
             type: "subscription",
             planName: planId,
             userId: user.uid
           }
        }
    } as any);
  };
  return (
    <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-8 sm:py-16 min-h-screen">
      <header className="mb-10 sm:mb-16 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-xs sm:text-sm font-medium mb-4"
        >
          <Star className="w-4 h-4" /> Institutional Access Plans
        </motion.div>
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 tracking-tight">Choose Your <span className="gold-text">Throne</span></h1>
        <p className="text-sm sm:text-lg text-gray-400 max-w-2xl mx-auto mb-6 px-2">
          We sell intelligence, structure, and time-saving. No financial promises, just pure market clarity.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
        {PLANS.map((plan, i) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={cn(
              "glass-card p-6 sm:p-8 flex flex-col relative overflow-hidden group transition-all duration-300",
              plan.isPopular ? "border-gold/50 shadow-[0_0_30px_rgba(212,175,55,0.1)] ring-1 ring-gold/40" : "hover:border-white/20",
              currentPlan === plan.id && "ring-2 ring-gold"
            )}
          >
            {plan.isPopular && (
              <div className="absolute top-0 right-0 gold-gradient px-4 py-1 text-[10px] font-bold text-matte-black uppercase tracking-widest rounded-bl-lg">
                Most Popular
              </div>
            )}

            <div className="mb-8">
              <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                {plan.id === 'free' && <Zap className="w-5 h-5 text-gray-400" />}
                {plan.id === 'pro' && <ShieldCheck className="w-5 h-5 text-gold" />}
                
                
                {plan.name}
              </h3>
              <p className="text-sm text-gray-500 mb-6">{plan.description}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold">{plan.price}</span>
                {plan.price !== 'Free' && <span className="text-gray-500 text-sm">/month</span>}
              </div>
            </div>

            <div className="space-y-4 mb-10 flex-grow">
              {plan.features.map((feature, idx) => (
                <div key={idx} className="flex items-start gap-3 text-sm">
                  <Check className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" />
                  <span className="text-gray-300">{feature}</span>
                </div>
              ))}
              {plan.limitations?.map((limitation, idx) => (
                <div key={idx} className="flex items-start gap-3 text-sm opacity-50">
                  <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-500 line-through">{limitation}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => initiatePlanPurchase(plan.id)}
              disabled={(user && currentPlan === plan.id) || loadingPlan === plan.id}
              className={cn(
                "w-full py-4 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center",
                currentPlan === plan.id 
                  ? "bg-white/10 text-white cursor-default" 
                  : plan.isPopular 
                    ? "gold-gradient text-matte-black hover:scale-105 disabled:hover:scale-100" 
                    : "bg-white/5 text-white hover:bg-white/10 disabled:hover:bg-white/5"
              )}
            >
              {loadingPlan === plan.id ? (
                <div className="w-5 h-5 border-2 border-matte-black border-t-transparent rounded-full animate-spin" />
              ) : !user 
                ? "LOGIN/REGISTER" 
                : currentPlan === plan.id 
                  ? "Current Plan" 
                  : plan.id === 'free' 
                    ? "Downgrade to Free" 
                    : "Upgrade to " + plan.name}
            </button>
          </motion.div>
        ))}
      </div>

      {/* Ask SESSIONKING Section */}
      <section className="mt-24 sm:mt-32 max-w-4xl mx-auto">
        <div className="glass-card p-6 sm:p-10 gold-border flex flex-col md:flex-row items-center gap-8 sm:gap-10">
          <div className="flex-shrink-0">
            <div className="w-20 h-20 sm:w-24 h-24 bg-gold/10 rounded-full flex items-center justify-center border border-gold/20">
              <Brain className="w-10 h-10 sm:w-12 h-12 text-gold" />
            </div>
          </div>
          <div className="flex-grow text-center md:text-left">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 flex items-center justify-center md:justify-start gap-2">
              <Zap className="w-5 h-5 text-gold" /> Intelligence Terminal
            </h2>
            <p className="text-sm sm:text-base text-gray-400 mb-6">
              Not ready for a subscription? Get full institutional-grade AI analysis for 3 pairs per payment. 
              $5 per use. Unlimited access included in Pro and Institutional plans.
            </p>
            <button 
              onClick={() => onTerminalRedirect && onTerminalRedirect()}
              className="w-full sm:w-auto px-8 py-3.5 bg-white/5 border border-white/10 rounded-full text-sm font-bold hover:bg-white/10 transition-colors min-h-[48px]">
              Access Terminal
            </button>
          </div>
        </div>
      </section>

      {/* Legal Footer */}
      <footer className="mt-20 text-center">
        <div className="max-w-2xl mx-auto p-6 bg-red-500/5 border border-red-500/10 rounded-xl">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest leading-relaxed">
            Legal Disclaimer: SESSIONKING is an information service only. We do not provide financial advice, 
            investment recommendations, or guaranteed profits. Trading involves significant risk of loss. 
            Past performance is not indicative of future results.
          </p>
        </div>
      </footer>
    </div>
  );
}
