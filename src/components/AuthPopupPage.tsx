import { useState, useEffect, useRef } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Smartphone, KeyRound } from "lucide-react";
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";
import { auth } from "../firebase";
import { cn } from "../lib/utils";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";

type PopupStep = "initializing" | "google-login" | "google-loading" | "phone-login" | "phone-verify" | "success" | "error";

export function AuthPopupPage() {
  const [step, setStep] = useState<PopupStep>("initializing");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  const searchParams = new URLSearchParams(window.location.search);
  const providerType = searchParams.get("provider") || "google";

  useEffect(() => {
    const checkRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          const idToken = await result.user.getIdToken();
          const credential = GoogleAuthProvider.credentialFromResult(result);
          
          if (window.opener) {
            window.opener.postMessage(
              { 
                type: "FIREBASE_AUTH_SUCCESS", 
                idToken,
                credential: credential ? {
                  providerId: credential.providerId,
                  signInMethod: credential.signInMethod,
                  idToken: credential.idToken,
                  accessToken: credential.accessToken
                } : null
              },
              "*"
            );
            setStep("success");
            setTimeout(() => {
              window.close();
            }, 1500);
          } else {
            throw new Error("Opener window not found. Please log in from the main site.");
          }
          return true;
        }
      } catch (err: any) {
        console.error("Google redirect auth error:", err);
        const errMsg = err.message || "An error occurred during Google redirect sign-in.";
        setError(errMsg);
        setStep("error");
        if (window.opener) {
          window.opener.postMessage(
            { type: "FIREBASE_AUTH_ERROR", error: errMsg },
            "*"
          );
        }
        return true;
      }
      return false;
    };

    if (providerType === "google") {
      checkRedirectResult().then((hasResult) => {
        if (!hasResult) {
          setStep("google-login");
        }
      });
    } else {
      setStep("phone-login");
    }
  }, [providerType]);

  const handleGoogleLogin = async () => {
    setError(null);
    setStep("google-loading");
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const userCred = await signInWithPopup(auth, provider);
      const idToken = await userCred.user.getIdToken();
      const credential = GoogleAuthProvider.credentialFromResult(userCred);
      
      if (window.opener) {
        window.opener.postMessage(
          { 
            type: "FIREBASE_AUTH_SUCCESS", 
            idToken,
            credential: credential ? {
              providerId: credential.providerId,
              signInMethod: credential.signInMethod,
              idToken: credential.idToken,
              accessToken: credential.accessToken
            } : null
          },
          "*"
        );
        setStep("success");
        setTimeout(() => {
          window.close();
        }, 1500);
      } else {
        throw new Error("Opener window not found. Please log in from the main site.");
      }
    } catch (err: any) {
      console.error("Google popup error:", err);
      const errMsg = err.code === "auth/popup-closed-by-user"
        ? "Sign-in popup closed. You can close this window now."
        : (err.message || "An error occurred during Google Sign-in.");
      setError(errMsg);
      setStep("error");
      if (window.opener) {
        window.opener.postMessage(
          { type: "FIREBASE_AUTH_ERROR", error: errMsg },
          "*"
        );
      }
    }
  };

  const setupRecaptcha = () => {
    if (!recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current = new RecaptchaVerifier(auth, "popup-recaptcha-container", {
        size: "normal",
        callback: () => {
          console.log("reCAPTCHA solved");
        }
      });
    }
  };

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!phoneNumber) {
      setError("Please enter your phone number.");
      return;
    }
    setIsLoading(true);
    try {
      setupRecaptcha();
      const appVerifier = recaptchaVerifierRef.current;
      if (!appVerifier) throw new Error("reCAPTCHA verifier not ready");

      const confirmation = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      setConfirmationResult(confirmation);
      setStep("phone-verify");
    } catch (err: any) {
      console.error("Phone send SMS error:", err);
      setError(err.message || "An error occurred sending the verification code.");
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!verificationCode) {
      setError("Please enter the verification code.");
      return;
    }
    setIsLoading(true);
    try {
      if (!confirmationResult) {
        throw new Error("Session expired. Please request a new code.");
      }
      const userCred = await confirmationResult.confirm(verificationCode);
      const idToken = await userCred.user.getIdToken();

      if (window.opener) {
        window.opener.postMessage(
          { type: "FIREBASE_AUTH_SUCCESS", idToken },
          "*"
        );
        setStep("success");
        setTimeout(() => {
          window.close();
        }, 1500);
      } else {
        throw new Error("Opener window not found. Please log in from the main site.");
      }
    } catch (err: any) {
      console.error("Phone verification error:", err);
      const errMsg = err.message || "Invalid verification code.";
      setError(errMsg);
      if (window.opener) {
        window.opener.postMessage(
          { type: "FIREBASE_AUTH_ERROR", error: errMsg },
          "*"
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-matte-black text-gray-100 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Visual background lines & glows */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-gold/5 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      </div>

      <div className="glass-card p-8 w-full max-w-sm relative z-10 border border-white/10 shadow-[0_0_50px_rgba(212,175,55,0.15)] text-center rounded-2xl bg-black/40 backdrop-blur-md">
        <h1 className="text-2xl font-bold mb-2 uppercase tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-white via-gold to-white">
          SESSIONKING
        </h1>
        <p className="text-gray-400 text-xs font-mono tracking-widest uppercase mb-8">
          Secure Authentication Broker
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-950/50 border border-red-500/50 rounded-xl text-red-400 text-sm flex flex-col gap-3 text-left shadow-[0_0_20px_rgba(239,68,68,0.2)]">
            <div className="flex items-start gap-3 w-full">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-400" />
              <div className="flex-1">
                {error.includes("identitytoolkit.googleapis.com") || error.includes("Identity Toolkit API") || error.includes("Identity Toolkit") ? (
                  <div className="space-y-2">
                    <p className="font-semibold text-red-300">Firebase Identity Toolkit API is disabled</p>
                    <p className="text-xs text-gray-300 leading-relaxed">
                      Authentication is currently disabled. You must enable the Identity Toolkit API in your Google Cloud Project:
                    </p>
                    <a 
                      href="https://console.developers.google.com/apis/api/identitytoolkit.googleapis.com/overview?project=428555961559" 
                      target="_blank" 
                      referrerPolicy="no-referrer"
                      className="inline-block bg-gold hover:bg-gold/80 text-matte-black font-bold text-xs py-1.5 px-3 rounded-lg transition-all"
                    >
                      Enable Identity Toolkit API
                    </a>
                  </div>
                ) : (
                  <span className="break-words leading-snug">{error}</span>
                )}
              </div>
            </div>
          </div>
        )}

        {step === "initializing" && (
          <div className="flex flex-col items-center py-6 gap-3">
            <Loader2 className="w-8 h-8 text-gold animate-spin" />
            <p className="text-gray-400 text-sm font-medium">Initializing Connection...</p>
          </div>
        )}

        {step === "google-login" && (
          <div className="space-y-6 py-4">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center text-gold">
                <KeyRound className="w-6 h-6 animate-pulse" />
              </div>
              <p className="text-gray-300 text-sm font-medium leading-relaxed max-w-xs text-center">
                Secure broker initialized. Click below to proceed with Google sign-in.
              </p>
            </div>
            <button
              onClick={handleGoogleLogin}
              className="w-full relative overflow-hidden group py-4 rounded-xl font-bold text-matte-black flex items-center justify-center gap-2 transition-all shadow-md bg-gold hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <span className="uppercase tracking-widest text-xs">Continue with Google</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}

        {step === "google-loading" && (
          <div className="flex flex-col items-center py-6 gap-3">
            <Loader2 className="w-8 h-8 text-gold animate-spin" />
            <p className="text-gray-400 text-sm font-medium">Authenticating with Google...</p>
            <p className="text-[10px] text-gray-600 font-mono">Please select your account in the popup</p>
          </div>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center py-6 gap-3">
            <CheckCircle2 className="w-12 h-12 text-green-400 animate-bounce" />
            <p className="text-green-400 font-bold text-lg">Verification Successful</p>
            <p className="text-xs text-gray-500">Synchronizing session... closing window.</p>
          </div>
        )}

        {step === "error" && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-400">Authentication failed or was aborted.</p>
            {providerType === "google" ? (
              <button
                onClick={handleGoogleLogin}
                className="w-full py-3 bg-gold text-matte-black font-bold rounded-xl uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg"
              >
                Retry Sign-In
              </button>
            ) : (
              <button
                onClick={() => setStep("phone-login")}
                className="w-full py-3 bg-gold text-matte-black font-bold rounded-xl uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg"
              >
                Back to Phone Input
              </button>
            )}
            <button
              onClick={() => window.close()}
              className="w-full py-3 border border-white/10 hover:bg-white/5 font-semibold text-gray-400 rounded-xl text-xs transition-colors"
            >
              Close Window
            </button>
          </div>
        )}

        {step === "phone-login" && (
          <form onSubmit={handlePhoneLogin} className="space-y-6 text-left">
            <div className="space-y-2 group">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] group-focus-within:text-gold transition-colors">
                Phone Number
              </label>
              <div className="relative flex items-center bg-black/50 border border-white/10 rounded-xl px-4 py-4 focus-within:border-gold focus-within:ring-1 focus-within:ring-gold/50 transition-all text-white">
                <PhoneInput
                  international
                  defaultCountry="US"
                  value={phoneNumber}
                  onChange={(val) => setPhoneNumber(val || "")}
                  className="w-full"
                  numberInputProps={{
                    required: true,
                    className: "w-full bg-transparent border-none focus:outline-none text-white placeholder:text-gray-700"
                  }}
                  placeholder="+1 555 555 5555"
                />
              </div>
            </div>
            <div id="popup-recaptcha-container"></div>
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                "w-full relative overflow-hidden group py-4 rounded-xl font-bold text-matte-black flex items-center justify-center gap-2 transition-all shadow-md bg-gold hover:scale-[1.02] active:scale-[0.98]",
                isLoading && "opacity-80 cursor-not-allowed bg-gold/50"
              )}
            >
              {isLoading ? (
                <span className="uppercase tracking-widest text-xs">Sending SMS...</span>
              ) : (
                <span className="uppercase tracking-widest text-xs">Send Verification Code</span>
              )}
            </button>
          </form>
        )}

        {step === "phone-verify" && (
          <form onSubmit={handleVerifyCode} className="space-y-6 text-left">
            <div className="space-y-2 group">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] group-focus-within:text-gold transition-colors">
                SMS Code
              </label>
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-gold transition-colors" />
                <input
                  type="text"
                  required
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl pl-12 pr-4 py-4 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/50 transition-all text-white placeholder:text-gray-700 font-mono tracking-[0.5em] text-center text-lg"
                  placeholder="000000"
                  maxLength={6}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                "w-full relative overflow-hidden group py-4 rounded-xl font-bold text-matte-black flex items-center justify-center gap-2 transition-all shadow-md bg-gold hover:scale-[1.02] active:scale-[0.98]",
                isLoading && "opacity-80 cursor-not-allowed bg-gold/50"
              )}
            >
              {isLoading ? (
                <span className="uppercase tracking-widest text-xs animate-pulse">Verifying...</span>
              ) : (
                <span className="uppercase tracking-widest text-xs">Verify Code</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setStep("phone-login")}
              className="w-full py-3 text-center text-gray-500 hover:text-gray-400 text-xs font-semibold transition-colors uppercase tracking-wider"
            >
              Back to Input
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
