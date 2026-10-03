import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

import { Mail, Lock, AlertCircle, ArrowRight, CheckCircle2, Loader2, ShieldCheck, Eye, EyeOff, User, Smartphone, KeyRound } from "lucide-react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, signOut, GoogleAuthProvider, signInWithPopup, signInWithCredential, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { cn } from "../lib/utils";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";

type AuthView = "login" | "register" | "forgot-password" | "verify-email" | "phone-login" | "phone-verify";

const fetchLocation = async () => {
  try {
    const res = await fetch('https://ipapi.co/json/');
    const data = await res.json();
    if (data.city && data.country_name) {
      return `${data.city}, ${data.country_name}`;
    }
    return "Unknown Location";
  } catch (e) {
    return "Unknown Location";
  }
};

export default function AuthPage({ onViewLegal }: { onViewLegal?: (section: "terms" | "privacy" | "risk") => void }) {
  const [view, setView] = useState<AuthView>("login");
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  // Calculate password strength
  useEffect(() => {
    if (!password) {
      setPasswordStrength(0);
      return;
    }
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (password.match(/[A-Z]/)) strength += 25;
    if (password.match(/[0-9]/)) strength += 25;
    if (password.match(/[^A-Za-z0-9]/)) strength += 25;
    setPasswordStrength(strength);
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const trimmedEmail = email.trim();
      if (view === "login") {
        const userCred = await signInWithEmailAndPassword(auth, trimmedEmail, password);
        
        const userDocRef = doc(db, "users", userCred.user.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists() && userDocSnap.data().suspended === true) {
          const udata = userDocSnap.data();
          await signOut(auth);
          window.dispatchEvent(new CustomEvent('user-suspended', { 
            detail: { reason: udata.suspendedReason || "Violating our rules or guidelines.", date: udata.suspendedAt ? new Date(udata.suspendedAt).toLocaleDateString() : undefined } 
          }));
          setIsLoading(false);
          return;
        }

        if (!userCred.user.emailVerified) {
          await signOut(auth);
          setRegisteredEmail(trimmedEmail);
          setView("verify-email");
          return;
        }
        const location = await fetchLocation();
        try {
          await setDoc(doc(db, "users", userCred.user.uid), {
            lastLoginAt: new Date().toISOString(),
            lastLoginLocation: location
          }, { merge: true });
        } catch (err) {
          console.error("Failed to update login location:", err);
          // Don't throw here, we still want to log them in
        }
      } else if (view === "register") {
        if (!fullName.trim()) {
          throw new Error("Full Name is required");
        }
        if (!acceptedTerms) {
          throw new Error("You must agree to the Terms, Privacy Policy, and Risk Disclosure.");
        }
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match");
        }
        if (passwordStrength < 50) {
          throw new Error("Password is too weak");
        }
        const userCred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        const location = await fetchLocation();
        let intendedPlan = "free";
        try { intendedPlan = localStorage.getItem("intendedPlan") || "free"; } catch(e) {}
        try {
          await setDoc(doc(db, "users", userCred.user.uid), {
            displayName: fullName.trim(),
            email: trimmedEmail,
            phoneNumber: phoneNumber.trim() || null,
            photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName.trim())}&background=D4AF37&color=141414`,
            plan: intendedPlan,
            acceptedTermsAt: new Date().toISOString(),
            acceptedTermsVersion: "v1.0",
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            lastLoginLocation: location
          });
          try { localStorage.removeItem("intendedPlan"); } catch(e) {}
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `users/${userCred.user.uid}`);
        }
        await sendEmailVerification(userCred.user);
        await signOut(auth);
        setRegisteredEmail(trimmedEmail);
        setView("verify-email");
        return;
      } else if (view === "forgot-password") {
        await sendPasswordResetEmail(auth, trimmedEmail);
        setSuccess("Reset link dispatched to your secure comms channel.");
        setTimeout(() => setView("login"), 3000);
      }
    } catch (err: any) {
      console.error(err);
      const errorCode = err.code || "";
      const errorMessage = err.message || "";
      
      if (errorCode === "auth/user-disabled" || errorMessage.includes("auth/user-disabled")) {
        window.dispatchEvent(new CustomEvent('user-suspended', { 
          detail: { reason: "This account has been disabled by the administrator. Please contact customer service for more details." } 
        }));
        setIsLoading(false);
        return;
      }

      if (view === "login") {
        if (
          errorCode === "auth/invalid-credential" || 
          errorCode === "auth/invalid-login-credentials" || 
          errorCode === "auth/user-not-found" || 
          errorCode === "auth/wrong-password" ||
          errorMessage.includes("auth/invalid-credential") ||
          errorMessage.includes("auth/user-not-found") ||
          errorMessage.includes("auth/wrong-password")
        ) {
          setError("Email or password is incorrect");
        } else {
          setError(errorMessage || "An error occurred during login.");
        }
      } else if (view === "register") {
        if (errorMessage === "Passwords do not match" || errorMessage === "Password is too weak" || errorMessage === "Full Name is required") {
          setError(errorMessage);
        } else if (errorCode === "auth/email-already-in-use" || errorMessage.includes("auth/email-already-in-use")) {
          setError("User already exists. Please sign in");
        } else {
          setError(errorMessage || "An error occurred during registration.");
        }
      } else {
        setError("Failed to send reset link. Please verify the email.");
      }
    } finally {
      if (view !== "forgot-password" || error) {
        setIsLoading(false);
      }
    }
  };

  const handlePopupAuthFlow = (provider: 'google' | 'phone') => {
    return new Promise<{ idToken: string; credential?: any }>((resolve, reject) => {
      const width = 500;
      const height = 650;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const popup = window.open(
        `/auth-popup?provider=${provider}`,
        "sessionking_auth_popup",
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
      );

      if (!popup) {
        reject(new Error("Popup blocked by browser. Please allow popups to sign in."));
        return;
      }

      let timer: any = null;

      const cleanUp = () => {
        if (timer) clearInterval(timer);
        window.removeEventListener("message", messageListener);
      };

      const messageListener = async (event: MessageEvent) => {
        const origin = event.origin;
        if (!origin.endsWith('.run.app') && !origin.includes('localhost') && origin !== window.location.origin) {
          return;
        }

        if (event.data?.type === "FIREBASE_AUTH_SUCCESS") {
          cleanUp();
          resolve({ idToken: event.data.idToken, credential: event.data.credential });
        } else if (event.data?.type === "FIREBASE_AUTH_ERROR") {
          cleanUp();
          reject(new Error(event.data.error || "Authentication failed."));
        }
      };

      window.addEventListener("message", messageListener);

      timer = setInterval(() => {
        if (popup.closed) {
          cleanUp();
          const err: any = new Error("Authentication window closed.");
          err.code = "auth/popup-closed-by-user";
          reject(err);
        }
      }, 1000);
    });
  };

  const handleIframeLoginFlow = async (provider: 'google' | 'phone') => {
    setError(null);
    setIsLoading(true);
    try {
      const authResult = await handlePopupAuthFlow(provider);
      
      let userCred = null;
      if (authResult.credential) {
        const { providerId, idToken, accessToken } = authResult.credential;
        if (providerId === "google.com") {
          const credential = GoogleAuthProvider.credential(idToken, accessToken);
          userCred = await signInWithCredential(auth, credential);
        }
      }
      
      if (!userCred) {
        // Wait for IndexedDB / LocalStorage state synchronization to complete
        await new Promise((resolve) => setTimeout(resolve, 1500));
        
        // If the state didn't sync immediately in-memory, we reload the window to force loading from IndexedDB.
        if (!auth.currentUser) {
          console.log("No active user session detected in iframe yet. Reloading window to synchronize session state...");
          window.location.reload();
          return;
        }
        
        userCred = { user: auth.currentUser };
      }
      
      const userDocRef = doc(db, 'users', userCred.user.uid);
      const userDocSnap = await getDoc(userDocRef);
      const location = await fetchLocation();

      if (userDocSnap.exists() && userDocSnap.data().suspended === true) {
        const udata = userDocSnap.data();
        await signOut(auth);
        window.dispatchEvent(new CustomEvent('user-suspended', { 
          detail: { reason: udata.suspendedReason || "Violating our rules or guidelines.", date: udata.suspendedAt ? new Date(udata.suspendedAt).toLocaleDateString() : undefined } 
        }));
        setIsLoading(false);
        return;
      }

      if (!userDocSnap.exists()) {
        let intendedPlan = 'free'; try { intendedPlan = localStorage.getItem('intendedPlan') || 'free'; } catch(e) {}
        await setDoc(doc(db, 'users', userCred.user.uid), {
          displayName: provider === 'google' ? (userCred.user.displayName || 'Google User') : 'Phone User',
          email: userCred.user.email || null,
          phoneNumber: userCred.user.phoneNumber || null,
          photoURL: provider === 'google' ? (userCred.user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(userCred.user.displayName || 'G')}&background=D4AF37&color=141414`) : `https://ui-avatars.com/api/?name=P&background=D4AF37&color=141414`,
          plan: intendedPlan,
          acceptedTermsAt: new Date().toISOString(),
          acceptedTermsVersion: 'v1.0',
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          lastLoginLocation: location
        });
        try { localStorage.removeItem('intendedPlan'); } catch(e) {}
      } else {
        const updatePayload: any = {
          lastLoginAt: new Date().toISOString(),
          lastLoginLocation: location
        };
        if (userCred.user.phoneNumber && !userDocSnap.data().phoneNumber) {
          updatePayload.phoneNumber = userCred.user.phoneNumber;
        }
        if (userCred.user.email && !userDocSnap.data().email) {
          updatePayload.email = userCred.user.email;
        }
        await updateDoc(userDocRef, updatePayload);
      }
    } catch (err: any) {
      if (
        err.code === 'auth/popup-closed-by-user' ||
        err.message?.includes('popup-closed-by-user') ||
        err.message?.includes('Authentication window closed') ||
        err.message?.includes('closed by user')
      ) {
        console.log(`[Auth] Authentication window closed by user for ${provider}.`);
        setError(null);
        return;
      }
      console.error(`Iframe login flow error (${provider}):`, err);
      setError(err.message || `An error occurred during ${provider === 'google' ? 'Google' : 'Phone'} Sign-in.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const isIframe = window.self !== window.top;
    if (isIframe) {
      return handleIframeLoginFlow('google');
    }

    setError(null);
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const userCred = await signInWithPopup(auth, provider);
      const userDocRef = doc(db, 'users', userCred.user.uid);
      const userDocSnap = await getDoc(userDocRef);
      const location = await fetchLocation();

      if (userDocSnap.exists() && userDocSnap.data().suspended === true) {
        const udata = userDocSnap.data();
        await signOut(auth);
        window.dispatchEvent(new CustomEvent('user-suspended', { 
          detail: { reason: udata.suspendedReason || "Violating our rules or guidelines.", date: udata.suspendedAt ? new Date(udata.suspendedAt).toLocaleDateString() : undefined } 
        }));
        setIsLoading(false);
        return;
      }

      if (!userDocSnap.exists()) {
        let intendedPlan = 'free'; try { intendedPlan = localStorage.getItem('intendedPlan') || 'free'; } catch(e) {}
        await setDoc(doc(db, 'users', userCred.user.uid), {
          displayName: userCred.user.displayName || 'Google User',
          email: userCred.user.email,
          phoneNumber: userCred.user.phoneNumber || null,
          photoURL: userCred.user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(userCred.user.displayName || 'G')}&background=D4AF37&color=141414`,
          plan: intendedPlan,
          acceptedTermsAt: new Date().toISOString(),
          acceptedTermsVersion: 'v1.0',
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          lastLoginLocation: location
        });
        try { localStorage.removeItem('intendedPlan'); } catch(e) {}
      } else {
        await updateDoc(userDocRef, {
          lastLoginAt: new Date().toISOString(),
          lastLoginLocation: location
        });
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-disabled' || err.message?.includes('auth/user-disabled')) {
        window.dispatchEvent(new CustomEvent('user-suspended', { 
          detail: { reason: "This account has been disabled by the administrator. Please contact customer service for more details." } 
        }));
      } else if (err.code === 'auth/popup-closed-by-user' || err.message?.includes('popup-closed-by-user')) {
        setError(null);
      } else {
        setError(err.message || 'An error occurred during Google Sign in.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const setupRecaptcha = () => {
    if (!(window as any).recaptchaVerifier) {
      const container = document.getElementById('recaptcha-container');
      if (container) {
        (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          'size': 'invisible',
        });
      }
    }
  };

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!phoneNumber) {
      setError('Please enter your phone number.');
      return;
    }
    setIsLoading(true);
    try {
      setupRecaptcha();
      const appVerifier = (window as any).recaptchaVerifier;
      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      setConfirmationResult(confirmationResult);
      setView('phone-verify');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-disabled' || err.message?.includes('auth/user-disabled')) {
        window.dispatchEvent(new CustomEvent('user-suspended', { 
          detail: { reason: "This account has been disabled by the administrator. Please contact customer service for more details." } 
        }));
      } else if (err.code === 'auth/popup-closed-by-user' || err.message?.includes('popup-closed-by-user')) {
        setError(null);
      } else {
        setError(err.message || 'An error occurred during Phone Sign in.');
      }
      if ((window as any).recaptchaVerifier) {
         (window as any).recaptchaVerifier.clear();
         (window as any).recaptchaVerifier = null;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      if (!confirmationResult) throw new Error('Session expired. Please try again.');
      const userCred = await confirmationResult.confirm(verificationCode);
      const userDocRef = doc(db, 'users', userCred.user.uid);
      const userDocSnap = await getDoc(userDocRef);
      const location = await fetchLocation();

      if (userDocSnap.exists() && userDocSnap.data().suspended === true) {
        const udata = userDocSnap.data();
        await signOut(auth);
        window.dispatchEvent(new CustomEvent('user-suspended', { 
          detail: { reason: udata.suspendedReason || "Violating our rules or guidelines.", date: udata.suspendedAt ? new Date(udata.suspendedAt).toLocaleDateString() : undefined } 
        }));
        setIsLoading(false);
        return;
      }

      if (!userDocSnap.exists()) {
        let intendedPlan = 'free'; try { intendedPlan = localStorage.getItem('intendedPlan') || 'free'; } catch(e) {}
        await setDoc(doc(db, 'users', userCred.user.uid), {
          displayName: 'Phone User',
          email: userCred.user.email || null,
          phoneNumber: userCred.user.phoneNumber,
          photoURL: `https://ui-avatars.com/api/?name=P&background=D4AF37&color=141414`,
          plan: intendedPlan,
          acceptedTermsAt: new Date().toISOString(),
          acceptedTermsVersion: 'v1.0',
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          lastLoginLocation: location
        });
        try { localStorage.removeItem('intendedPlan'); } catch(e) {}
      } else {
        await updateDoc(userDocRef, {
          lastLoginAt: new Date().toISOString(),
          lastLoginLocation: location
        });
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-disabled' || err.message?.includes('auth/user-disabled')) {
        window.dispatchEvent(new CustomEvent('user-suspended', { 
          detail: { reason: "This account has been disabled by the administrator. Please contact customer service for more details." } 
        }));
      } else {
        setError(err.message || 'Invalid verification code.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartLoading = () => setIsLoading(true);
  const getStrengthColor = () => {
    if (passwordStrength < 50) return "bg-red-500";
    if (passwordStrength < 75) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div className="min-h-screen bg-matte-black text-gray-100 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Futuristic Background Elements */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-gold/5 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-deep-blue/10 rounded-full blur-[120px]" />
        
        {/* Grid lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, x: 20, filter: "blur(10px)" }}
          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, x: -20, filter: "blur(10px)" }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="glass-card p-10 w-full max-w-md relative z-10 border border-white/10 shadow-[0_0_50px_rgba(212,175,55,0.1)] hover:shadow-[0_0_50px_rgba(212,175,55,0.2)] transition-shadow duration-500"
        >
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-gold/20 to-transparent rounded-2xl border border-gold/30 mb-6 shadow-[0_0_30px_rgba(212,175,55,0.2)] relative group">
              <div className="absolute inset-0 bg-gold/20 rounded-2xl blur-xl group-hover:bg-gold/30 transition-colors" />
              
            </div>
            <h1 className="text-3xl font-bold mb-2 uppercase tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-white via-gold to-white">
              SESSIONKING
            </h1>
            <p className="text-gray-400 text-sm font-mono tracking-widest uppercase">
              {view === "login" && "System Authentication"}
              {view === "register" && "Initialize Protocol"}
              {view === "forgot-password" && "Recover Access"}
              {view === "verify-email" && "Identity Verification"}
            </p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0, scale: 0.9 }}
                animate={{ opacity: 1, height: "auto", scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.9 }}
                className="mb-6 p-4 bg-red-950/50 border border-red-500/50 rounded-xl text-red-400 text-sm flex flex-col gap-3 shadow-[0_0_20px_rgba(239,68,68,0.2)]"
              >
                <div className="flex items-start gap-3 w-full">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-400" />
                  <div className="flex-1">
                    {error.includes("identitytoolkit.googleapis.com") || error.includes("Identity Toolkit API") || error.includes("Identity Toolkit") ? (
                      <div className="space-y-2">
                        <p className="font-semibold text-red-300">Firebase Identity Toolkit API is disabled</p>
                        <p className="text-xs text-gray-300 leading-relaxed">
                          Authentication services are currently disabled. You must enable the Identity Toolkit API in your Google Cloud Project:
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
                      <span>{error}</span>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, height: 0, scale: 0.9 }}
                animate={{ opacity: 1, height: "auto", scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.9 }}
                className="mb-6 p-4 bg-green-950/50 border border-green-500/50 rounded-xl text-green-400 text-sm flex items-center gap-3 shadow-[0_0_20px_rgba(34,197,94,0.2)]"
              >
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                {success}
              </motion.div>
            )}
          </AnimatePresence>

          {view === "verify-email" ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-6"
            >
              <div className="inline-flex items-center justify-center p-4 bg-blue-500/10 rounded-full mb-2 border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                <Mail className="w-8 h-8 text-blue-400" />
              </div>
              <p className="text-gray-300 text-sm leading-relaxed">
                We have sent you a verification email to <br/>
                <span className="text-gold font-bold text-base">{registeredEmail}</span><br/><br/>
                Please verify it and log in.
              </p>
              <button
                onClick={() => {
                  setView("login");
                  setPassword("");
                }}
                className="w-full bg-gold py-4 rounded-xl font-bold text-matte-black hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)] uppercase tracking-widest text-sm mt-4"
              >
                Login
              </button>
            </motion.div>
          ) : (
          <>
          {(view === "login" || view === "register" || view === "forgot-password") && (
            <form onSubmit={handleSubmit} className="space-y-6">
            {view === "register" && (
              <div className="space-y-2 group">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] group-focus-within:text-gold transition-colors">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-gold transition-colors" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full bg-black/50 border border-white/10 rounded-xl pl-12 pr-4 py-4 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/50 transition-all text-white placeholder:text-gray-700"
                    placeholder="John Doe"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2 group">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] group-focus-within:text-gold transition-colors">
                Secure Comms ID (Email)
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-gold transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-black/50 border border-white/10 rounded-xl pl-12 pr-4 py-4 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/50 transition-all text-white placeholder:text-gray-700"
                  placeholder="agent@sessionking.com"
                />
              </div>
            </div>

            {view !== "forgot-password" && (
              <div className="space-y-2 group">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] group-focus-within:text-gold transition-colors">
                    Passcode
                  </label>
                  {view === "login" && (
                    <button type="button" onClick={() => setView("forgot-password")} className="text-[10px] text-gray-400 hover:text-gold transition-colors font-bold uppercase tracking-widest">
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-gold transition-colors" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-black/50 border border-white/10 rounded-xl pl-12 pr-12 py-4 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/50 transition-all text-white placeholder:text-gray-700"
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gold transition-colors focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {view === "register" && password && (
                  <div className="mt-2 h-1 w-full bg-black/50 rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full transition-all duration-300", getStrengthColor())} 
                      style={{ width: `${passwordStrength}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {view === "register" && (
              <>
                <div className="space-y-2 group">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] group-focus-within:text-gold transition-colors">
                    Verify Passcode
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-gold transition-colors" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="w-full bg-black/50 border border-white/10 rounded-xl pl-12 pr-12 py-4 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/50 transition-all text-white placeholder:text-gray-700"
                      placeholder="••••••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gold transition-colors focus:outline-none"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2 group">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] group-focus-within:text-gold transition-colors">
                    Phone Number (Optional)
                  </label>
                  <div className="relative flex items-center bg-black/50 border border-white/10 rounded-xl px-4 py-4 focus-within:border-gold focus-within:ring-1 focus-within:ring-gold/50 transition-all text-white">
                    <PhoneInput
                      international
                      defaultCountry="US"
                      value={phoneNumber}
                      onChange={(val) => setPhoneNumber(val || "")}
                      className="w-full"
                      numberInputProps={{
                        className: "w-full bg-transparent border-none focus:outline-none text-white placeholder:text-gray-700"
                      }}
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                </div>

                <div className="flex items-start gap-3 mt-4">
                  <input
                    type="checkbox"
                    id="terms"
                    required
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-white/20 bg-black/50 text-gold focus:ring-gold focus:ring-offset-matte-black cursor-pointer shadow-sm"
                  />
                  <label htmlFor="terms" className="text-[11px] text-gray-400 leading-tight">
                    I have read and strongly agree to the{" "}
                    <button type="button" onClick={() => onViewLegal?.('terms')} className="text-gold hover:underline">Terms of Service</button>,{" "}
                    <button type="button" onClick={() => onViewLegal?.('privacy')} className="text-gold hover:underline">Privacy Policy</button>, and{" "}
                    <button type="button" onClick={() => onViewLegal?.('risk')} className="text-gold hover:underline">Risk Disclosure</button>. 
                    I understand that trading involves high risk of loss.
                  </label>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                "w-full relative overflow-hidden group py-4 rounded-xl font-bold text-matte-black flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)]",
                isLoading ? "opacity-80 cursor-not-allowed bg-gold/50" : "bg-gold hover:scale-[1.02] active:scale-[0.98]"
              )}
            >
              {!isLoading && (
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              )}
              
              {isLoading ? (
                <>
                  <span className="uppercase tracking-widest text-sm">Scanning...</span>
                </>
              ) : (
                <>
                  <span className="uppercase tracking-widest text-sm relative z-10">
                    {view === "login" && "Initialize Link"}
                    {view === "register" && "Establish Connection"}
                    {view === "forgot-password" && "Transmit Recovery"}
                  </span>
                  <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
          )}

          { view === 'phone-login' && (
            <form onSubmit={handlePhoneLogin} className="space-y-6">
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
              <div id="recaptcha-container"></div>
              <button
                type="submit"
                disabled={isLoading}
                className={cn(
                  "w-full relative overflow-hidden group py-4 rounded-xl font-bold text-matte-black flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)]",
                  isLoading ? "opacity-80 cursor-not-allowed bg-gold/50" : "bg-gold hover:scale-[1.02] active:scale-[0.98]"
                )}
              >
                {isLoading ? <span className="uppercase tracking-widest text-sm">Sending code...</span> : <span className="uppercase tracking-widest text-sm">Send Verification Code</span>}
              </button>
  
          </form>
          )}

          { view === 'phone-verify' && (
            <form onSubmit={handleVerifyCode} className="space-y-6">
              <div className="space-y-2 group">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] group-focus-within:text-gold transition-colors">
                  Verification Code
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
                  "w-full relative overflow-hidden group py-4 rounded-xl font-bold text-matte-black flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)]",
                  isLoading ? "opacity-80 cursor-not-allowed bg-gold/50" : "bg-gold hover:scale-[1.02] active:scale-[0.98]"
                )}
              >
                {isLoading ? <span className="uppercase tracking-widest text-sm">Verifying...</span> : <span className="uppercase tracking-widest text-sm">Verify Code</span>}
              </button>
            </form>
          )}

          {(view === "login" || view === "register") && (
            <div className="mt-8 text-center flex flex-col items-center gap-4">
              <div className="relative w-full flex items-center py-2">
                <div className="flex-grow border-t border-white/10"></div>
                <span className="flex-shrink-0 mx-4 text-gray-500 text-xs uppercase tracking-widest">Or continue with</span>
                <div className="flex-grow border-t border-white/10"></div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 w-full">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="flex-1 py-3 px-4 rounded-xl border border-white/10 bg-black/30 hover:bg-white/5 active:bg-white/10 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span className="text-sm font-medium">Google</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setView('phone-login');
                    setError(null);
                    setSuccess(null);
                  }}
                  disabled={isLoading}
                  className="flex-1 py-3 px-4 rounded-xl border border-white/10 bg-black/30 hover:bg-white/5 active:bg-white/10 transition-colors flex items-center justify-center gap-2"
                >
                  <Smartphone className="w-5 h-5 text-white" />
                  <span className="text-sm font-medium">Phone</span>
                </button>
              </div>

              <div className="h-[1px] w-full bg-white/10 mt-4" />
              <p className="text-sm text-gray-400">
                {view === "login" ? "Don't have an account?" : "Already have an account?"}
              </p>
              <button
                onClick={() => {
                  setView(view === "login" ? "register" : "login");
                  setError(null);
                  setSuccess(null);
                  setPassword("");
                  setConfirmPassword("");
                }}
                className="px-8 py-3 w-full rounded-xl border border-gold/30 text-gold hover:bg-gold hover:text-matte-black font-bold transition-all uppercase tracking-widest text-sm shadow-[0_0_15px_rgba(212,175,55,0.1)] hover:shadow-[0_0_20px_rgba(212,175,55,0.3)]"
              >
                {view === "login" ? "Register" : "Login"}
              </button>
            </div>
          )}
          
          {(view === "phone-login" || view === "phone-verify") && (
             <div className="mt-8 text-center flex flex-col items-center gap-4">
              <div className="h-[1px] w-full bg-white/10" />
              <button
                onClick={() => {
                  setView("login");
                  setError(null);
                  setSuccess(null);
                }}
               className="px-8 py-3 w-full rounded-xl border border-gold/30 text-gold hover:bg-gold hover:text-matte-black font-bold transition-all uppercase tracking-widest text-sm shadow-[0_0_15px_rgba(212,175,55,0.1)] hover:shadow-[0_0_20px_rgba(212,175,55,0.3)]"
              >
                Back to Login
              </button>
             </div>
          )}
          
          {view === 'forgot-password' && (
             <div className="mt-8 text-center flex flex-col items-center gap-4">
              <div className="h-[1px] w-full bg-white/10" />
              <button
                onClick={() => {
                  setView("login");
                  setError(null);
                  setSuccess(null);
                }}
               className="px-8 py-3 w-full rounded-xl border border-gold/30 text-gold hover:bg-gold hover:text-matte-black font-bold transition-all uppercase tracking-widest text-sm shadow-[0_0_15px_rgba(212,175,55,0.1)] hover:shadow-[0_0_20px_rgba(212,175,55,0.3)]"
              >
                Back to Login
              </button>
             </div>
          )}
          </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
