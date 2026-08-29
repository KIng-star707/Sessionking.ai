import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { User as FirebaseUser, sendPasswordResetEmail, sendEmailVerification, updateProfile } from "firebase/auth";
import { doc, updateDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { 
  Camera, 
  Save, 
  Shield, 
  User, 
  CreditCard, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Check, 
  Bell, 
  Activity, 
  Mail, 
  Sparkles, 
  ExternalLink,
  LogOut,
  Smartphone,
  Globe,
  Sliders
} from "lucide-react";
import toast from "react-hot-toast";
import { auth, db, storage } from "../firebase";
import { User as UserProfile } from "../types";
import { getSubscriptionStatusDetails } from "../lib/subscriptionSync";
import { cn } from "../lib/utils";

interface SettingsPageProps {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  onProfileUpdate: (updatedProfile: Partial<UserProfile>) => void;
  onNavigate?: (page: string) => void;
}

export default function SettingsPage({ user, userProfile, onProfileUpdate, onNavigate }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "account" | "preferences">("profile");
  
  // Local form state
  const [displayName, setDisplayName] = useState(userProfile?.displayName || user?.displayName || "");
  const [phoneNumber, setPhoneNumber] = useState(userProfile?.phoneNumber || "");
  const [country, setCountry] = useState(userProfile?.country || "");
  const [tradingMode, setTradingMode] = useState<"Scalp Trader" | "Day Trader" | "Swing Trader">(userProfile?.tradingMode || "Day Trader");
  const [preferredPairs, setPreferredPairs] = useState<string[]>(userProfile?.preferredPairs || ['EUR/USD', 'GBP/USD', 'USD/JPY', 'XAU/USD']);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(userProfile?.notificationsEnabled ?? false);
  const [volatilityAlertsEnabled, setVolatilityAlertsEnabled] = useState<boolean>(userProfile?.volatilityAlertsEnabled ?? false);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasUserEdited = useRef(false);

  // Sync state when userProfile arrives or updates
  useEffect(() => {
    if (userProfile && !hasUserEdited.current) {
      if (userProfile.displayName !== undefined) setDisplayName(userProfile.displayName || user?.displayName || "");
      if (userProfile.phoneNumber !== undefined) setPhoneNumber(userProfile.phoneNumber || "");
      if (userProfile.country !== undefined) setCountry(userProfile.country || "");
      if (userProfile.tradingMode) setTradingMode(userProfile.tradingMode);
      if (userProfile.preferredPairs && userProfile.preferredPairs.length > 0) {
        setPreferredPairs(userProfile.preferredPairs);
      }
      if (userProfile.notificationsEnabled !== undefined) {
        setNotificationsEnabled(Boolean(userProfile.notificationsEnabled));
      }
      if (userProfile.volatilityAlertsEnabled !== undefined) {
        setVolatilityAlertsEnabled(Boolean(userProfile.volatilityAlertsEnabled));
      }
    }
  }, [userProfile, user]);

  const SUPPORTED_PAIRS = [
    'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CAD', 'AUD/USD', 
    'NZD/USD', 'USD/CHF', 'EUR/JPY', 'GBP/JPY', 'AUD/JPY', 
    'XAU/USD', 'XAG/USD', 'BTC/USD', 'ETH/USD'
  ];

  const handleSavePreferences = async () => {
    if (!user) {
      toast.error("You must be logged in to update preferences.");
      return;
    }
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await setDoc(doc(db, "users", user.uid), {
        tradingMode,
        preferredPairs,
        notificationsEnabled,
        volatilityAlertsEnabled,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      onProfileUpdate({ tradingMode, preferredPairs, notificationsEnabled, volatilityAlertsEnabled });
      
      // Request browser notification permissions if user opted in
      if ((notificationsEnabled || volatilityAlertsEnabled) && 'Notification' in window) {
        try {
          if (Notification.permission === 'default') {
            const perm = await Notification.requestPermission();
            if (perm === 'granted') {
              toast.success("Desktop push alerts enabled!");
            } else if (perm === 'denied') {
              toast("Notifications blocked by browser settings", { icon: "⚠️" });
            }
          }
        } catch (e) {
          console.log("Notification permission request skipped:", e);
        }
      }

      setSuccessMsg("Trading preferences updated successfully.");
      toast.success("Trading preferences saved!");
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      console.error("Failed to update preferences:", err);
      const message = err.message || "Failed to update preferences.";
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) {
      toast.error("You must be logged in to update your profile.");
      return;
    }
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const trimmedName = displayName.trim();
      const trimmedPhone = phoneNumber.trim();
      const trimmedCountry = country.trim();

      // 1. Update Firebase Auth user display name if changed
      if (auth.currentUser && trimmedName) {
        try {
          await updateProfile(auth.currentUser, { displayName: trimmedName });
        } catch (authErr) {
          console.warn("Could not update auth displayName:", authErr);
        }
      }

      // 2. Update Firestore user doc with merge: true to avoid missing doc crashes
      await setDoc(doc(db, "users", user.uid), {
        displayName: trimmedName,
        phoneNumber: trimmedPhone,
        country: trimmedCountry,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      onProfileUpdate({ 
        displayName: trimmedName,
        phoneNumber: trimmedPhone,
        country: trimmedCountry
      });

      setSuccessMsg("Profile information updated successfully.");
      toast.success("Profile saved!");
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      console.error("Failed to update profile:", err);
      const message = err.message || "Failed to update profile.";
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 2 * 1024 * 1024) {
      const msg = "File size exceeds 2MB limit. Please choose a smaller photo.";
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }

    setIsUploading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      let downloadURL = "";
      
      try {
        const storageRef = ref(storage, `profilePhotos/${user.uid}`);
        await uploadBytes(storageRef, file);
        downloadURL = await getDownloadURL(storageRef);
      } catch (storageErr) {
        console.warn("Storage upload fallback to Base64:", storageErr);
        // Resilient Base64 Data URL fallback
        downloadURL = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      // Update Firebase Auth profile
      if (auth.currentUser && downloadURL.startsWith("http")) {
        try {
          await updateProfile(auth.currentUser, { photoURL: downloadURL });
        } catch (e) {}
      }

      // Update Firestore user document
      await setDoc(doc(db, "users", user.uid), {
        photoURL: downloadURL,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      onProfileUpdate({ photoURL: downloadURL });
      setSuccessMsg("Profile avatar updated.");
      toast.success("Profile photo updated!");
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      console.error("Photo upload error:", err);
      const msg = err.message || "Failed to upload profile photo.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePasswordReset = async () => {
    if (!user || !user.email) {
      toast.error("No email address associated with this account.");
      return;
    }
    setIsResettingPassword(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await sendPasswordResetEmail(auth, user.email);
      const msg = `Password reset link sent to ${user.email}. Please check your inbox.`;
      setSuccessMsg(msg);
      toast.success("Password reset email sent!");
      setTimeout(() => setSuccessMsg(null), 6000);
    } catch (err: any) {
      console.error("Password reset error:", err);
      const msg = err.message || "Failed to send password reset email.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleSendVerificationEmail = async () => {
    if (!auth.currentUser) return;
    setIsSendingVerification(true);
    try {
      await sendEmailVerification(auth.currentUser);
      toast.success("Verification email dispatched! Check your inbox.");
    } catch (err: any) {
      toast.error(err.message || "Failed to send verification email");
    } finally {
      setIsSendingVerification(false);
    }
  };

  // Format creation date safely
  const formatMemberSince = () => {
    try {
      if (userProfile?.createdAt) {
        return new Date(userProfile.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
      }
      if (user?.metadata?.creationTime) {
        return new Date(user.metadata.creationTime).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
      }
    } catch (e) {}
    return "Active Member";
  };

  // Safe plan string
  const currentPlanName = (userProfile?.currentPlan || userProfile?.plan || "free").toUpperCase();
  const avatarUrl = userProfile?.photoURL || user?.photoURL;

  return (
    <div className="container mx-auto px-4 sm:px-6 py-8 md:py-12 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 md:mb-12">
          <div className="flex items-center gap-3">
            <Sliders className="w-8 h-8 text-gold" />
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">Settings</h1>
              <p className="text-gray-400 text-sm mt-1">Manage your trader profile, execution preferences, security and subscription.</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-8">
          {/* Sidebar Tabs */}
          <div className="md:col-span-1 flex flex-row md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0">
            <button
              onClick={() => setActiveTab("profile")}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap",
                activeTab === "profile" 
                  ? "bg-gold text-matte-black shadow-[0_0_15px_rgba(212,175,55,0.3)] font-black" 
                  : "text-gray-400 bg-white/5 hover:bg-white/10 hover:text-white"
              )}
            >
              <User className="w-4 h-4 flex-shrink-0" /> Profile
            </button>
            
            <button
              onClick={() => setActiveTab("preferences")}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap",
                activeTab === "preferences" 
                  ? "bg-gold text-matte-black shadow-[0_0_15px_rgba(212,175,55,0.3)] font-black" 
                  : "text-gray-400 bg-white/5 hover:bg-white/10 hover:text-white"
              )}
            >
              <Sliders className="w-4 h-4 flex-shrink-0" /> Preferences
            </button>

            <button
              onClick={() => setActiveTab("security")}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap",
                activeTab === "security" 
                  ? "bg-gold text-matte-black shadow-[0_0_15px_rgba(212,175,55,0.3)] font-black" 
                  : "text-gray-400 bg-white/5 hover:bg-white/10 hover:text-white"
              )}
            >
              <Shield className="w-4 h-4 flex-shrink-0" /> Security
            </button>

            <button
              onClick={() => setActiveTab("account")}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap",
                activeTab === "account" 
                  ? "bg-gold text-matte-black shadow-[0_0_15px_rgba(212,175,55,0.3)] font-black" 
                  : "text-gray-400 bg-white/5 hover:bg-white/10 hover:text-white"
              )}
            >
              <CreditCard className="w-4 h-4 flex-shrink-0" /> Account
            </button>
          </div>

          {/* Content Area */}
          <div className="md:col-span-3">
            <AnimatePresence mode="wait">
              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-6 p-4 bg-red-950/50 border border-red-500/50 rounded-xl text-red-400 text-sm flex items-center gap-3"
                >
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </motion.div>
              )}
              {successMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-6 p-4 bg-green-950/50 border border-green-500/50 rounded-xl text-green-400 text-sm flex items-center gap-3"
                >
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <span>{successMsg}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="glass-card p-6 md:p-8 rounded-2xl border border-white/10 shadow-2xl">
              {/* PROFILE TAB */}
              {activeTab === "profile" && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-8"
                >
                  <div>
                    <h2 className="text-xl font-bold text-white uppercase tracking-wider">Trader Profile</h2>
                    <p className="text-xs text-gray-400 mt-1">Personalize your identity across the platform and community signals.</p>
                  </div>
                  
                  {/* Photo Upload */}
                  <div className="flex items-center gap-6 p-4 rounded-xl bg-white/5 border border-white/5">
                    <div className="relative group flex-shrink-0">
                      <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-gold/40 bg-black/60 shadow-inner flex items-center justify-center">
                        {avatarUrl ? (
                          <img 
                            src={avatarUrl} 
                            alt="Profile Avatar" 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer" 
                          />
                        ) : (
                          <User className="w-8 h-8 text-gray-400" />
                        )}
                      </div>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="absolute inset-0 bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer disabled:opacity-50"
                        title="Upload Photo"
                      >
                        {isUploading ? (
                          <Loader2 className="w-5 h-5 text-gold animate-spin" />
                        ) : (
                          <Camera className="w-5 h-5 text-gold" />
                        )}
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handlePhotoUpload} 
                        accept="image/png,image/jpeg,image/webp,image/gif" 
                        className="hidden" 
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white text-sm mb-0.5">Profile Avatar</h3>
                      <p className="text-xs text-gray-400 mb-2">Upload a custom image (JPG, PNG, WEBP, max 2MB).</p>
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="text-xs font-bold text-gold hover:text-gold/80 uppercase tracking-widest flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                        {isUploading ? "Uploading..." : "Change Image"}
                      </button>
                    </div>
                  </div>

                  {/* Form Fields */}
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => {
                          hasUserEdited.current = true;
                          setDisplayName(e.target.value);
                        }}
                        placeholder="e.g. MasterTrader99"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/40 transition-all text-white text-sm placeholder:text-gray-600"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
                        <Smartphone className="w-3 h-3 text-gold" /> Phone Number (Optional)
                      </label>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => {
                          hasUserEdited.current = true;
                          setPhoneNumber(e.target.value);
                        }}
                        placeholder="+1 (555) 000-0000"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/40 transition-all text-white text-sm placeholder:text-gray-600"
                      />
                      <p className="text-[11px] text-gray-500">Used strictly for critical account and VIP signal SMS alerts if enabled.</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
                        <Globe className="w-3 h-3 text-gold" /> Country / Region
                      </label>
                      <input
                        type="text"
                        value={country}
                        onChange={(e) => {
                          hasUserEdited.current = true;
                          setCountry(e.target.value);
                        }}
                        placeholder="e.g. United Kingdom, South Africa, United States"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/40 transition-all text-white text-sm placeholder:text-gray-600"
                      />
                    </div>

                    <div className="pt-4">
                      <button
                        onClick={handleSaveProfile}
                        disabled={isSaving}
                        className={cn(
                          "px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all uppercase tracking-widest text-xs",
                          isSaving
                            ? "bg-white/10 text-gray-400 cursor-not-allowed"
                            : "bg-gold text-matte-black hover:bg-gold/90 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_15px_rgba(212,175,55,0.3)]"
                        )}
                      >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {isSaving ? "Saving Changes..." : "Save Profile"}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* PREFERENCES TAB */}
              {activeTab === "preferences" && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-8"
                >
                  <div>
                    <h2 className="text-xl font-bold text-white uppercase tracking-wider">Trading Preferences</h2>
                    <p className="text-xs text-gray-400 mt-1">Configure your default execution style, active watchlist, and alerting criteria.</p>
                  </div>
                  
                  <div className="space-y-6">
                    {/* Mode Selection */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                        Trading Style Profile
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          { id: "Scalp Trader", label: "Scalp Trader", desc: "1M - 15M High Frequency", icon: "⚡" },
                          { id: "Day Trader", label: "Day Trader", desc: "15M - 4H Intraday Focus", icon: "⏱️" },
                          { id: "Swing Trader", label: "Swing Trader", desc: "4H - Daily Macro Moves", icon: "📈" }
                        ].map(mode => (
                          <button
                            type="button"
                            key={mode.id}
                            onClick={() => {
                              hasUserEdited.current = true;
                              setTradingMode(mode.id as any);
                            }}
                            className={cn(
                              "p-4 rounded-xl border text-left transition-all",
                              tradingMode === mode.id
                                ? "bg-gold/15 border-gold/60 shadow-[0_0_15px_rgba(212,175,55,0.15)]"
                                : "bg-white/5 border-white/10 hover:bg-white/10 text-gray-400"
                            )}
                          >
                            <div className="text-lg mb-1">{mode.icon}</div>
                            <div className={cn("text-sm font-bold", tradingMode === mode.id ? "text-gold" : "text-white")}>
                              {mode.label}
                            </div>
                            <div className="text-[11px] text-gray-400 mt-0.5">{mode.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Preferred Currency Pairs */}
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                          Preferred Currency Pairs ({preferredPairs.length} Selected)
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              hasUserEdited.current = true;
                              setPreferredPairs([...SUPPORTED_PAIRS]);
                            }}
                            className="text-[10px] text-gold hover:underline font-bold uppercase tracking-wider"
                          >
                            Select All
                          </button>
                          <span className="text-gray-600">|</span>
                          <button
                            type="button"
                            onClick={() => {
                              hasUserEdited.current = true;
                              setPreferredPairs(['EUR/USD', 'GBP/USD', 'USD/JPY', 'XAU/USD']);
                            }}
                            className="text-[10px] text-gray-400 hover:text-white font-bold uppercase tracking-wider"
                          >
                            Reset Majors
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400">Select the pairs you trade most often to prioritize them across dashboards and intelligence reports.</p>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-3">
                        {SUPPORTED_PAIRS.map(pair => {
                          const isSelected = preferredPairs.includes(pair);
                          return (
                            <button
                              type="button"
                              key={pair}
                              onClick={() => {
                                hasUserEdited.current = true;
                                if (!isSelected) {
                                  setPreferredPairs([...preferredPairs, pair]);
                                } else {
                                  setPreferredPairs(preferredPairs.filter(p => p !== pair));
                                }
                              }}
                              className={cn(
                                "flex items-center justify-between p-3 rounded-xl border text-xs font-mono font-bold transition-all",
                                isSelected 
                                  ? "bg-gold/10 border-gold/50 text-gold shadow-[0_0_10px_rgba(212,175,55,0.12)]" 
                                  : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                              )}
                            >
                              <span>{pair}</span>
                              <div className={cn(
                                "w-4 h-4 rounded-full border flex items-center justify-center transition-all",
                                isSelected ? "border-gold bg-gold text-matte-black" : "border-white/20"
                              )}>
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Alert Toggles */}
                    <div className="space-y-4 pt-4 border-t border-white/10">
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                          Desktop & Web Push Notifications
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            hasUserEdited.current = true;
                            setNotificationsEnabled(!notificationsEnabled);
                          }}
                          className={cn(
                            "flex items-center gap-3 p-4 rounded-xl border transition-all duration-300 w-full text-left mt-2",
                            notificationsEnabled 
                              ? "bg-green-500/10 border-green-500/40 shadow-[0_0_15px_rgba(34,197,94,0.15)]" 
                              : "bg-white/5 border-white/10 hover:bg-white/10"
                          )}
                        >
                          <div className={cn(
                            "w-9 h-9 rounded-full flex items-center justify-center transition-colors flex-shrink-0",
                            notificationsEnabled ? "bg-green-500 text-matte-black shadow-lg" : "bg-white/10 text-gray-400"
                          )}>
                            <Bell className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <div className={cn(
                              "text-sm font-bold",
                              notificationsEnabled ? "text-green-400" : "text-white"
                            )}>
                              {notificationsEnabled ? "Signal Alerts Enabled" : "Signal Alerts Disabled"}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {notificationsEnabled 
                                ? "You will receive desktop notifications when new high-confidence signals are issued." 
                                : "Click to activate real-time signal browser alerts."}
                            </div>
                          </div>
                        </button>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                          Session Volatility Alerts
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            hasUserEdited.current = true;
                            setVolatilityAlertsEnabled(!volatilityAlertsEnabled);
                          }}
                          className={cn(
                            "flex items-center gap-3 p-4 rounded-xl border transition-all duration-300 w-full text-left mt-2",
                            volatilityAlertsEnabled 
                              ? "bg-purple-500/10 border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.15)]" 
                              : "bg-white/5 border-white/10 hover:bg-white/10"
                          )}
                        >
                          <div className={cn(
                            "w-9 h-9 rounded-full flex items-center justify-center transition-colors flex-shrink-0",
                            volatilityAlertsEnabled ? "bg-purple-500 text-white shadow-lg" : "bg-white/10 text-gray-400"
                          )}>
                            <Activity className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <div className={cn(
                              "text-sm font-bold",
                              volatilityAlertsEnabled ? "text-purple-400" : "text-white"
                            )}>
                              {volatilityAlertsEnabled ? "Volatility Alerts Active" : "Volatility Alerts Inactive"}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {volatilityAlertsEnabled 
                                ? "Alerts triggered when high-impact market sessions (London/NY Overlap) open." 
                                : "Click to activate session open volatility alerts."}
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={handleSavePreferences}
                        disabled={isSaving}
                        className={cn(
                          "px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all uppercase tracking-widest text-xs",
                          isSaving 
                            ? "bg-white/10 text-gray-400 cursor-not-allowed"
                            : "bg-gold text-matte-black hover:bg-gold/90 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_15px_rgba(212,175,55,0.3)]"
                        )}
                      >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {isSaving ? "Saving Preferences..." : "Save Preferences"}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* SECURITY TAB */}
              {activeTab === "security" && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-8"
                >
                  <div>
                    <h2 className="text-xl font-bold text-white uppercase tracking-wider">Security & Authentication</h2>
                    <p className="text-xs text-gray-400 mt-1">Manage password credentials and account verification security.</p>
                  </div>

                  <div className="space-y-4">
                    {/* Email Verification Card */}
                    <div className="p-6 bg-white/5 rounded-xl border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gold" />
                          <h3 className="font-bold text-white text-sm">Email Address</h3>
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                            user?.emailVerified 
                              ? "bg-green-500/20 text-green-400 border border-green-500/30" 
                              : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          )}>
                            {user?.emailVerified ? "Verified" : "Unverified"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{user?.email || "No email on record"}</p>
                      </div>
                      {!user?.emailVerified && (
                        <button
                          type="button"
                          onClick={handleSendVerificationEmail}
                          disabled={isSendingVerification}
                          className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded-lg text-xs font-bold transition-all disabled:opacity-50 whitespace-nowrap"
                        >
                          {isSendingVerification ? "Sending..." : "Verify Email"}
                        </button>
                      )}
                    </div>

                    {/* Password Reset Card */}
                    <div className="p-6 bg-white/5 rounded-xl border border-white/10">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="w-4 h-4 text-gold" />
                        <h3 className="font-bold text-white text-sm">Password Management</h3>
                      </div>
                      <p className="text-xs text-gray-400 mb-4">
                        Send a secure, single-use password reset link to your registered email address ({user?.email}).
                      </p>
                      <button 
                        onClick={handlePasswordReset}
                        disabled={isResettingPassword}
                        className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 disabled:opacity-50"
                      >
                        {isResettingPassword ? <Loader2 className="w-4 h-4 animate-spin text-gold" /> : <Shield className="w-4 h-4 text-gold" />}
                        {isResettingPassword ? "Sending Reset Email..." : "Request Password Reset"}
                      </button>
                    </div>

                    {/* Security Recommendations */}
                    <div className="p-6 rounded-xl bg-blue-500/5 border border-blue-500/20">
                      <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                        <Sparkles className="w-4 h-4" /> Account Protection
                      </h4>
                      <ul className="text-xs text-gray-400 space-y-1.5 list-disc list-inside">
                        <li>Ensure you do not share your SessionKing trading credentials with third parties.</li>
                        <li>Signals and Intelligence reports are generated securely via isolated runtime sandboxes.</li>
                      </ul>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ACCOUNT TAB */}
              {activeTab === "account" && (() => {
                const subDetails = getSubscriptionStatusDetails(userProfile);
                return (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-8"
                  >
                    <div>
                      <h2 className="text-xl font-bold text-white uppercase tracking-wider">Account & Subscription</h2>
                      <p className="text-xs text-gray-400 mt-1">Platform tier, 30-day subscription cycle, and token allowances.</p>
                    </div>
                    
                    <div className="space-y-4">
                      {/* Current Plan Card */}
                      <div className={cn(
                        "p-6 rounded-2xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all",
                        subDetails.isExpired
                          ? "bg-gradient-to-r from-red-950/30 via-black/40 to-black/60 border-red-500/30"
                          : subDetails.isExpiringSoon
                          ? "bg-gradient-to-r from-amber-950/40 via-black/40 to-black/60 border-amber-500/40 shadow-[0_0_20px_rgba(251,191,36,0.1)]"
                          : "bg-gradient-to-r from-gold/10 via-black/40 to-black/60 border-gold/30 shadow-[0_0_20px_rgba(212,175,55,0.1)]"
                      )}>
                        <div>
                          <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">
                            Current Membership Tier
                          </div>
                          <div className="text-2xl font-black text-gold tracking-tight uppercase flex flex-wrap items-center gap-2">
                            {subDetails.plan.toUpperCase()} PLAN
                            {subDetails.statusBadge === "ACTIVE" && (
                              <span className="px-2.5 py-0.5 bg-green-500/20 text-green-400 border border-green-500/30 text-[10px] font-bold rounded-full tracking-wider">
                                ACTIVE ({subDetails.daysRemaining}d left)
                              </span>
                            )}
                            {subDetails.statusBadge === "EXPIRING_SOON" && (
                              <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-bold rounded-full tracking-wider animate-pulse">
                                EXPIRING IN {subDetails.daysRemaining === 0 ? `${subDetails.hoursRemaining}h` : `${subDetails.daysRemaining}d`}
                              </span>
                            )}
                            {subDetails.statusBadge === "EXPIRED" && (
                              <span className="px-2.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold rounded-full tracking-wider">
                                EXPIRED (FREE TIER)
                              </span>
                            )}
                            {subDetails.statusBadge === "FREE" && (
                              <span className="px-2.5 py-0.5 bg-white/10 text-gray-400 border border-white/20 text-[10px] font-bold rounded-full tracking-wider">
                                STANDARD
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-300 mt-2 flex flex-col gap-1">
                            {subDetails.expiryDate ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-gray-400">30-Day Expiry Date:</span>
                                <span className="font-mono text-white font-semibold">{subDetails.formattedExpiry}</span>
                                {subDetails.isActive && (
                                  <span className="text-amber-400 text-[11px] font-mono">
                                    ({subDetails.daysRemaining} days {subDetails.hoursRemaining}h remaining)
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">Activate a 30-day plan to unlock real-time institutional signals.</span>
                            )}
                          </div>
                        </div>
                        {onNavigate && (
                          <button 
                            onClick={() => onNavigate("pricing")}
                            className={cn(
                              "px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg hover:scale-105 shrink-0",
                              subDetails.isExpiringSoon || subDetails.isExpired
                                ? "bg-gradient-to-r from-amber-400 to-gold text-matte-black hover:from-amber-300 hover:to-gold shadow-[0_0_20px_rgba(251,191,36,0.3)]"
                                : "bg-gold text-matte-black hover:bg-gold/90"
                            )}
                          >
                            {subDetails.isActive ? "Renew / Upgrade Plan" : "Activate Subscription"}
                          </button>
                        )}
                      </div>

                      {/* 30-Day Subscription Policy Notice */}
                      <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-xs text-gray-300 flex items-start gap-3">
                        <div className="p-1 rounded bg-gold/10 text-gold shrink-0 mt-0.5">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div className="space-y-1">
                          <span className="font-bold text-white uppercase tracking-wider text-[11px]">
                            30-Day Subscription Policy & Free Tier Return
                          </span>
                          <p className="text-gray-400 text-xs leading-relaxed">
                            All SessionKing subscription plans have a <strong>30-day access duration</strong>. You will receive renewal reminders before your plan expires. If an account is not renewed by the 30-day mark, it is automatically returned to the Free tier until a new subscription is purchased to reopen all plan features.
                          </p>
                        </div>
                      </div>

                    {/* Intelligence Terminal Usages */}
                    <div className="p-6 bg-white/5 rounded-xl border border-white/10">
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <h3 className="font-bold text-white text-sm">Intelligence Terminal Usages</h3>
                          <p className="text-xs text-gray-400">Tokens available for deep AI market analyses & chart scans.</p>
                        </div>
                        <span className="text-lg font-mono font-bold text-gold">
                          {userProfile?.terminalUsagesRemaining ?? userProfile?.intelligenceCredits ?? 0} Uses
                        </span>
                      </div>
                      <div className="w-full bg-black/60 rounded-full h-2 overflow-hidden border border-white/10">
                        <div 
                          className="bg-gold h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${Math.min(100, Math.max(0, ((userProfile?.terminalUsagesRemaining ?? userProfile?.intelligenceCredits ?? 0) / 10) * 100))}%` 
                          }}
                        />
                      </div>
                      {onNavigate && (
                        <div className="mt-4 flex justify-end">
                          <button
                            onClick={() => onNavigate("terminal-payment")}
                            className="text-xs font-bold text-gold hover:underline uppercase tracking-wider flex items-center gap-1"
                          >
                            Buy Terminal Passes <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Account Metadata Details */}
                    <div className="p-6 bg-white/5 rounded-xl border border-white/10 space-y-4 text-xs">
                      <div className="flex justify-between items-center py-2 border-b border-white/5">
                        <span className="text-gray-400 font-bold uppercase tracking-wider">Account Email</span>
                        <span className="text-white font-mono">{user?.email}</span>
                      </div>
                      {userProfile?.phoneNumber && (
                        <div className="flex justify-between items-center py-2 border-b border-white/5">
                          <span className="text-gray-400 font-bold uppercase tracking-wider">Registered Phone</span>
                          <span className="text-white font-mono">{userProfile.phoneNumber}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center py-2 border-b border-white/5">
                        <span className="text-gray-400 font-bold uppercase tracking-wider">Account UID</span>
                        <span className="text-gray-400 font-mono text-[11px] truncate max-w-[200px]">{user?.uid}</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-gray-400 font-bold uppercase tracking-wider">Member Since</span>
                        <span className="text-white">{formatMemberSince()}</span>
                      </div>
                    </div>

                    {/* Sign Out Card */}
                    <div className="p-6 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">Session Logout</h4>
                        <p className="text-xs text-gray-400 mt-0.5">End your current session on this device.</p>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            const { signOut } = await import("firebase/auth");
                            await signOut(auth);
                            toast.success("Signed out successfully");
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                        className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" /> Sign Out
                      </button>
                    </div>
                  </div>
                </motion.div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

