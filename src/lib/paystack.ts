import { useEffect, useState } from "react";

declare global {
  interface Window {
    PaystackPop: any;
  }
}

export function usePaystackPayment(initialConfig: any) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (window.PaystackPop) {
      setIsLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    script.onload = () => setIsLoaded(true);
    document.body.appendChild(script);
  }, []);

  return (options: { onSuccess?: (reference: any) => void, onClose?: () => void, config?: any }) => {
    if (!window.PaystackPop) {
      console.error("Paystack script not loaded");
      return;
    }
    const mergedConfig = { ...initialConfig, ...options.config };
    const paystackKey = mergedConfig.key || mergedConfig.publicKey;
    const handler = window.PaystackPop.setup({
      ...mergedConfig,
      key: paystackKey,
      callback: options.onSuccess,
      onClose: options.onClose
    });
    handler.openIframe();
  };
}
