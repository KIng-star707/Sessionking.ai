import React, { useState } from "react";
import toast from "react-hot-toast";
import { X, CreditCard, Calendar, CheckCircle2, ShieldAlert, Sparkles, Loader2 } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";

interface PlanModalProps {
  user: any;
  onClose: () => void;
  onUpdated?: () => void;
}

export default function SubscriptionPlanModal({ user, onClose, onUpdated }: PlanModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<string>(user.planKey || 'free');
  const [isActive, setIsActive] = useState<boolean>(user.status === 'active' && user.amount > 0);
  const [durationMonths, setDurationMonths] = useState<number>(1);
  const [customExpiry, setCustomExpiry] = useState<string>(() => {
    if (user.rawExpiry) {
      try {
        const d = new Date(user.rawExpiry);
        return d.toISOString().slice(0, 16);
      } catch (e) {
        return "";
      }
    }
    const defaultDate = new Date();
    defaultDate.setMonth(defaultDate.getMonth() + 1);
    return defaultDate.toISOString().slice(0, 16);
  });
  const [isSaving, setIsSaving] = useState(false);

  const planOptions = [
    { key: "free", name: "Free Tier", price: "$0/mo", desc: "Basic forex signals with standard latency" },
    { key: "pro", name: "Pro Trader", price: "$49/mo", desc: "Full access to SMC & ICT AI setups, high-speed ticks" },
    { key: "premium", name: "Premium VIP", price: "$99/mo", desc: "Multi-timeframe liquidity sweeps + institutional signals" },
    { key: "institutional", name: "Institutional", price: "$499/mo", desc: "Direct quant orderflow engine, zero-latency WebSocket stream" }
  ];

  const handlePlanSelect = (planKey: string) => {
    setSelectedPlan(planKey);
    if (planKey === 'free') {
      setIsActive(false);
    } else {
      setIsActive(true);
    }
  };

  const handleApplyPreset = (months: number) => {
    setDurationMonths(months);
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    setCustomExpiry(d.toISOString().slice(0, 16));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const now = new Date();
      const isUpgrading = selectedPlan !== 'free' && isActive;
      
      let expiryIso: string | null = null;
      if (isUpgrading) {
        expiryIso = customExpiry ? new Date(customExpiry).toISOString() : new Date(Date.now() + 30 * 86400000).toISOString();
      }

      await updateDoc(doc(db, "users", user.id), {
        plan: selectedPlan,
        currentPlan: selectedPlan,
        subscriptionActive: isUpgrading,
        subscriptionStartDate: isUpgrading ? (user.subscriptionStartDate || now.toISOString()) : null,
        subscriptionExpiryDate: expiryIso,
        paymentStatus: isUpgrading ? 'successful' : 'none',
        updatedAt: now.toISOString()
      });

      toast.success(`Updated ${user.user}'s subscription to ${selectedPlan.toUpperCase()}`);
      if (onUpdated) onUpdated();
      onClose();
    } catch (err: any) {
      console.error("Failed to update subscription:", err);
      toast.error(err.message || "Failed to update subscription");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-matte-black border border-white/10 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-white/10 bg-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center text-gold">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base uppercase tracking-wider text-white">Manage Subscription</h3>
              <p className="text-xs text-gray-400 font-mono">{user.user} &bull; {user.email}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          {/* Plan Selector Grid */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
              Select Subscription Tier
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {planOptions.map((opt) => {
                const isSelected = selectedPlan === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => handlePlanSelect(opt.key)}
                    className={`p-3 rounded-xl border text-left transition-all relative ${
                      isSelected
                        ? "bg-gold/15 border-gold shadow-lg shadow-gold/5 text-white"
                        : "bg-white/5 border-white/10 hover:border-white/20 text-gray-300"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={`font-bold text-xs uppercase tracking-wider ${isSelected ? "text-gold" : "text-white"}`}>
                        {opt.name}
                      </span>
                      <span className="font-mono text-xs font-bold text-gray-300">{opt.price}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">{opt.desc}</p>
                    {isSelected && (
                      <span className="absolute bottom-2 right-2 text-gold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status & Expiry Configuration */}
          {selectedPlan !== 'free' && (
            <div className="bg-black/40 border border-white/10 rounded-xl p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-white block">Subscription Status</span>
                  <span className="text-[11px] text-gray-400">Enable full premium engine capabilities for this user</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                    isActive
                      ? "bg-green-500/20 text-green-400 border border-green-500/30"
                      : "bg-red-500/20 text-red-400 border border-red-500/30"
                  }`}
                >
                  {isActive ? "Active Plan" : "Inactive / Suspended"}
                </button>
              </div>

              {isActive && (
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gold" /> Expiration / Renewal Date
                    </label>
                    <div className="flex gap-1">
                      {[1, 3, 6, 12].map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => handleApplyPreset(m)}
                          className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-white/5 hover:bg-white/10 border border-white/10 rounded text-gray-300 hover:text-white"
                        >
                          +{m}M
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="datetime-local"
                    value={customExpiry}
                    onChange={(e) => setCustomExpiry(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-gold font-mono"
                  />
                  <p className="text-[10px] text-gray-500">
                    The background 30-day sync engine will automatically remind the user or downgrade them when this timestamp lapses.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest text-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-gold hover:bg-gold-light text-black rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-gold/20 flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving Changes...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" /> Save Subscription Plan
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
