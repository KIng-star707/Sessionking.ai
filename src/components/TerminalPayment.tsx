import { useState, useEffect } from "react";
import { usePaystackPayment } from "../lib/paystack";

export function TerminalPayment({ user, onPaymentSuccess, onCancel }: { user: any, onPaymentSuccess: () => void, onCancel: () => void }) {
  const [loading, setLoading] = useState(false);
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

  const getPriceCents = () => {
    if (rates && rates.intelligence) {
      return Math.round(rates.intelligence * 100);
    }
    return 5 * 1500 * 100; // Fallback
  };

  const handlePaymentSuccess = async (reference: any) => {
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
          type: "intelligence",
          amount: getPriceCents()
        })
      });
      
      if (!res.ok) {
        throw new Error("Server verification failed");
      }
      
      alert("Payment successful! You have received 3 intelligence credits.");
      onPaymentSuccess();
    } catch (e) {
      console.error(e);
      alert("Payment was successful but verification failed. Please contact support.");
    } finally {
      setLoading(false);
    }
  };

  const initializePayment = usePaystackPayment({
    reference: (new Date()).getTime().toString(),
    email: user?.email || "",
    amount: 0,
    publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "pk_test_placeholder",
  } as any);

  const handlePay = () => {
    setLoading(true);
    const amount = getPriceCents();
    initializePayment({
      onSuccess: (ref) => handlePaymentSuccess(ref),
      onClose: () => {
         setLoading(false);
      },
      config: {
         reference: (new Date()).getTime().toString(),
         email: user.email,
         amount: amount,
         publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "pk_test_placeholder",
         metadata: {
           type: "intelligence",
           userId: user.uid
         }
      }
    } as any);
  };

  return (
    <div className="flex flex-col gap-4 items-center">
      <button 
        onClick={handlePay} 
        disabled={loading}
        className="px-8 py-4 bg-gold text-black rounded-xl font-bold hover:bg-gold/90 transition-colors w-full max-w-xs flex justify-center"
      >
        {loading ? <div className="w-5 h-5 border-2 border-black border-t-transparent flex rounded-full animate-spin" /> : 'Pay $5 (3 Credits)'}
      </button>
      <button 
        onClick={onCancel} 
        disabled={loading}
        className="px-8 py-3 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-colors w-full max-w-xs"
      >
        Cancel
      </button>
    </div>
  );
}
