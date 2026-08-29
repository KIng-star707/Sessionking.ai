import { useState, useEffect, Suspense, lazy, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

import { 
  Crown, BookOpen, Zap, Info, Menu, X, Landmark, CreditCard, 
  LogOut, User, Bell, Sun, Moon, Terminal, Lock, Download,
  ChevronDown, Sparkles, LifeBuoy, MoreHorizontal, ShieldCheck,
  Brain, HelpCircle, Layers, ArrowUpRight, CheckCircle2
} from "lucide-react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, getDocFromServer, collection, query, where, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { cn } from "./lib/utils";
import { Toaster } from "react-hot-toast";
import { Plan, Announcement } from "./types";
import { syncUserSubscription } from "./lib/subscriptionSync";
import SubscriptionBanner from "./components/SubscriptionBanner";
import { TerminalPayment } from "./components/TerminalPayment";
import { handleFirestoreError, OperationType } from "./lib/firestore-errors";
import NotificationSystem from "./components/NotificationSystem";
import { useUserPresence } from "./hooks/useUserPresence";
import { BrandLogo } from "./components/BrandLogo";
import { TradeTracker } from "./components/TradeTracker";

function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let isDismissed = false;
    try {
      isDismissed = !!localStorage.getItem('installBannerDismissed');
    } catch (e) {}
    if (isDismissed) return;

    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
       return;
    }

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Fallback for iOS Safari which doesn't support beforeinstallprompt
    const isIos = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      return /iphone|ipad|ipod/.test(userAgent);
    };
    
    // Check if we are in Safari (which implies it could be iOS Safari if isIos is true)
    const isInStandaloneMode = () => ('standalone' in window.navigator) && ((window.navigator as any).standalone);
    if (isIos() && !isInStandaloneMode()) {
       setIsVisible(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the A2HS prompt');
        }
        setDeferredPrompt(null);
        setIsVisible(false);
      });
    } else {
      // iOS Manual instructions
      alert("To install the SessionKing.ai app on your iPhone or iPad, tap the 'Share' button at the bottom of your screen, then scroll down and tap 'Add to Home Screen'.");
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    try {
      localStorage.setItem('installBannerDismissed', 'true');
    } catch (e) {}
  };

  if (!isVisible) return null;

  return (
    <div className="fixed top-20 left-0 right-0 z-[100] px-4 pointer-events-none flex justify-center">
      <div className="bg-gold/95 backdrop-blur shadow-2xl border border-black/10 rounded-2xl w-full max-w-md pointer-events-auto flex flex-col sm:flex-row items-center justify-between p-3 gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-10 h-10 bg-black rounded-xl p-1.5 flex items-center justify-center shadow-inner shrink-0">
            <BrandLogo className="w-full h-full text-gold" />
          </div>
          <div className="flex-1">
            <p className="text-black font-bold text-sm leading-tight tracking-tight">sessionking.ai</p>
            <p className="text-black/70 text-xs truncate">Download app for a better experience</p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
          <button 
            onClick={handleDismiss}
            className="text-black/50 hover:text-black transition-colors font-semibold text-xs px-2 py-1"
          >
            Cancel
          </button>
          <button 
            onClick={handleInstall}
            className="bg-black hover:bg-gray-900 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-md"
          >
            <Download className="w-3.5 h-3.5" />
            Install
          </button>
        </div>
      </div>
    </div>
  );
}

// Lazy load pages for performance with retry mechanism
const lazyWithRetry = (componentImport: () => Promise<any>) =>
  lazy(async () => {
    let pageHasAlreadyBeenForceRefreshed = false;
    try {
      pageHasAlreadyBeenForceRefreshed = JSON.parse(
        window.localStorage.getItem('page-has-been-force-refreshed') || 'false'
      );
    } catch (e) {}

    try {
      const component = await componentImport();
      try {
        window.localStorage.setItem('page-has-been-force-refreshed', 'false');
      } catch (e) {}
      return component;
    } catch (error) {
      if (!pageHasAlreadyBeenForceRefreshed) {
        // Assuming that the user is not on the latest version, let's refresh the page immediately.
        try {
          window.localStorage.setItem('page-has-been-force-refreshed', 'true');
        } catch (e) {}
        window.location.reload();
        // Return a promise that never resolves while the page reloads
        return new Promise(() => {});
      }
      // The page has already been reloaded
      // Assuming that user is already using the latest version, we can throw the error
      throw error;
    }
  });

const LandingPage = lazyWithRetry(() => import("./components/LandingPage"));
const SignalEngine = lazyWithRetry(() => import("./components/SignalEngine"));
const AboutPage = lazyWithRetry(() => import("./components/AboutPage"));
const PricingPage = lazyWithRetry(() => import("./components/PricingPage"));
const BrokersPage = lazyWithRetry(() => import("./components/BrokersPage"));
const EducationPage = lazyWithRetry(() => import("./components/EducationPage"));
const AuthPage = lazyWithRetry(() => import("./components/AuthPage"));
const SettingsPage = lazyWithRetry(() => import("./components/SettingsPage"));
const IntelligenceTerminal = lazyWithRetry(() => import("./components/IntelligenceTerminal"));
const AdminPanel = lazyWithRetry(() => import("./components/AdminPanel"));
const LegalPage = lazyWithRetry(() => import("./components/LegalPage"));
const SupportPage = lazyWithRetry(() => import("./components/SupportPage"));

const SuspendedPage = lazyWithRetry(() => import("./components/SuspendedPage"));
const AuthPopupPage = lazyWithRetry(() => import("./components/AuthPopupPage").then(m => ({ default: m.AuthPopupPage })));

export type LegalSectionType = "terms" | "privacy" | "risk";
type Page = "landing" | "engine" | "about" | "pricing" | "brokers" | "education" | "auth" | "settings" | "admin" | "legal" | "support" | "terminal" | "terminal-payment" | "shared" | "suspended";

// Loading Fallback Component
const PageLoader = () => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
    <motion.div
      initial={{ scale: 0.9, opacity: 0.8 }}
      animate={{ scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }}
      transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
    >
      <BrandLogo className="w-24 h-24 sm:w-32 sm:h-32" />
    </motion.div>
    <div className="text-gray-400 font-bold uppercase tracking-widest text-sm animate-pulse">
      Loading Engine...
    </div>
  </div>
);

const SharedReportViewer = lazyWithRetry(() => import("./components/SharedReportViewer"));

export default function App() {
  if (window.location.pathname === "/auth-popup") {
    return (
      <Suspense fallback={<div className="min-h-screen bg-matte-black text-white flex items-center justify-center font-mono">Loading Authentication Broker...</div>}>
        <AuthPopupPage />
      </Suspense>
    );
  }

  const [currentPage, setCurrentPage] = useState<Page>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("share")) {
       return "shared";
    }
    if (window.history.state && window.history.state.page) {
       return window.history.state.page as Page;
    }
    try {
      const saved = localStorage.getItem("currentPage");
      if (saved === "suspended") {
        return "landing";
      }
      return (saved as Page) || "landing";
    } catch (e) {
      return "landing";
    }
  });

  // Track page changes in history
  useEffect(() => {
    if (!window.history.state || !window.history.state.page) {
      window.history.replaceState({ page: currentPage }, "");
    } else if (window.history.state.page !== currentPage) {
      window.history.pushState({ page: currentPage }, "");
    }
  }, [currentPage]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.page) {
        setCurrentPage(event.state.page as Page);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const [activeLegalSection, setActiveLegalSection] = useState<LegalSectionType>("terms");

  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try {
      const saved = localStorage.getItem("theme");
      return (saved as "dark" | "light") || "dark";
    } catch (e) {
      return "dark";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("theme", theme);
    } catch (e) {}
    if (theme === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === "dark" ? "light" : "dark");

  // SCROLL FIX: Ensure every page loads from TOP instantly
  useEffect(() => {
    try {
      localStorage.setItem("currentPage", currentPage);
    } catch (e) {}
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [currentPage]);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close desktop dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [userPlan, setUserPlan] = useState<Plan>("free");
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [suspensionDetails, setSuspensionDetails] = useState<{message: string, date?: string} | null>(null);

  // Listen for suspension events
  useEffect(() => {
    const handleSuspended = (e: any) => {
      setSuspensionDetails({ message: e.detail.reason, date: e.detail.date });
      setCurrentPage("suspended");
    };
    window.addEventListener('user-suspended', handleSuspended);
    return () => window.removeEventListener('user-suspended', handleSuspended);
  }, []);
  const [activeAnnouncements, setActiveAnnouncements] = useState<Announcement[]>([]);

  useUserPresence(user, userProfile);

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error: any) {
        // Firebase Auth token fetching might fail if offline, or network requests might fail.
        // These are benign in an offline-first app using persistentLocalCache.
        if(String(error).includes('the client is offline') || String(error).includes('network-request-failed') || String(error).includes('Could not reach Cloud Firestore')) {
          console.warn("Network connection check failed. The app will continue in offline mode.");
        } else {
          console.warn("Background connection check issue:", error?.message);
        }
      }
    }
    
    // Add a slight delay to allow Firebase to initialize its web channels before testing
    const timeout = setTimeout(() => {
      testConnection();
    }, 1500);

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    let unsubscribeProfile: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && !currentUser.emailVerified) {
        setUser(null);
        setUserProfile(null);
        setIsAdmin(false);
        setLoadingAuth(false);
        if (unsubscribeProfile) unsubscribeProfile();
        return;
      }
      
      setUser(currentUser);

      if (currentUser) {
        // Auto-provision user document if it doesn't exist
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (!userDocSnap.exists()) {
            let intendedPlan = 'free';
            try { intendedPlan = localStorage.getItem('intendedPlan') || 'free'; } catch(e) {}
            
            // Detect provider
            const isGoogle = currentUser.providerData.some(p => p.providerId === 'google.com');
            const isPhone = currentUser.providerData.some(p => p.providerId === 'phone');
            
            await setDoc(userDocRef, {
              displayName: currentUser.displayName || (isGoogle ? 'Google User' : isPhone ? 'Phone User' : 'User'),
              email: currentUser.email || null,
              phoneNumber: currentUser.phoneNumber || null,
              photoURL: currentUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName || 'U')}&background=D4AF37&color=141414`,
              plan: intendedPlan,
              acceptedTermsAt: new Date().toISOString(),
              acceptedTermsVersion: 'v1.0',
              createdAt: new Date().toISOString(),
              lastLoginAt: new Date().toISOString(),
              lastLoginLocation: 'Web App'
            });
            try { localStorage.removeItem('intendedPlan'); } catch(e) {}
          } else {
            // Update last login
            await updateDoc(userDocRef, {
              lastLoginAt: new Date().toISOString()
            });
          }
        } catch (e) {
          console.error("Failed to auto-provision user document:", e);
        }

        // Check admin status
        let isUserAdmin = false;
        try {
          const adminDoc = await getDoc(doc(db, 'admins', currentUser.uid));
          isUserAdmin = adminDoc.exists() || currentUser.email === 'dekingsjackson@gmail.com';
          
          // Auto-provision the admin document for the owner if it doesn't exist
          if (!adminDoc.exists() && currentUser.email === 'dekingsjackson@gmail.com') {
            try {
              await setDoc(doc(db, 'admins', currentUser.uid), {
                email: currentUser.email,
                role: 'super_admin',
                createdAt: new Date().toISOString()
              });
            } catch (e) {
              console.error("Failed to auto-provision admin doc", e);
            }
          }
          
          setIsAdmin(isUserAdmin);
        } catch (err) {
          // Silent fallback to email check if Firestore fails (e.g., offline mode)
          isUserAdmin = currentUser.email === 'dekingsjackson@gmail.com';
          setIsAdmin(isUserAdmin);
        }

        if (currentPage === "auth") {
          setCurrentPage(isUserAdmin ? "admin" : "engine");
        }

        if (isUserAdmin) {
          try {
            const { setDoc, doc, serverTimestamp } = await import("firebase/firestore");
            await setDoc(doc(db, "adminSessions", currentUser.uid), {
              adminId: currentUser.uid,
              loginTime: serverTimestamp(),
              device: navigator.userAgent,
              ipAddress: "client-side"
            }, { merge: true });
          } catch (e) {
            console.error("Failed to log admin session", e);
          }
        }

        unsubscribeProfile = onSnapshot(doc(db, "users", currentUser.uid), async (userDoc) => {
          let data = userDoc.exists() ? userDoc.data() : null;
          
          if (data && data.suspended === true && !isUserAdmin) {
            console.warn("User account suspended");
            if (unsubscribeProfile) unsubscribeProfile();
            
            // Dispatch a custom event so the UI can show the suspension modal globally
            window.dispatchEvent(new CustomEvent('user-suspended', { 
               detail: { reason: data.suspendedReason || "Violating our rules or guidelines.", date: data.suspendedAt ? new Date(data.suspendedAt).toLocaleDateString() : undefined } 
            }));

            await signOut(auth);
            
            return;
          }

          let intendedPlan = null;
          try {
            intendedPlan = localStorage.getItem("intendedPlan");
            if (intendedPlan && intendedPlan !== 'free') {
               localStorage.removeItem("intendedPlan");
               setCurrentPage("pricing");
            }
          } catch(e) {}
          
          if (data) {
            syncUserSubscription(currentUser.uid, data).then(({ resolvedPlan, updatedProfile }) => {
              setUserProfile(updatedProfile);
              setUserPlan(resolvedPlan);
              setLoadingAuth(false);
            }).catch((err) => {
              console.error("Failed to sync user subscription, falling back", err);
              setUserProfile(data);
              setUserPlan(data.plan || "free");
              setLoadingAuth(false);
            });
          } else {
            setLoadingAuth(false);
          }
        }, (error) => {
          if (auth.currentUser) {
            console.warn("Firestore error getting user doc:", error);
            // Ignore offline errors
            if (!String(error).includes("client is offline")) {
              try { handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`); } catch (e) {}
            }
          } else {
            console.warn("Ignored firestore error during logout (expected due to permissions revocation).");
          }
          setLoadingAuth(false);
        });
      } else {
        setUser(null);
        setUserProfile(null);
        setIsAdmin(false);
        setLoadingAuth(false);
        if (currentPage === "admin" || currentPage === "engine" || currentPage === "settings" || currentPage === "terminal") {
            setCurrentPage("landing");
        }
        if (unsubscribeProfile) unsubscribeProfile();
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, [currentPage]);

  // Fetch active announcements
  useEffect(() => {
    const q = query(collection(db, "announcements"), where("active", "==", true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const anns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement));
      setActiveAnnouncements(anns);
    }, (error) => {
      console.error("Error fetching announcements:", error);
    });
    return () => unsubscribe();
  }, []);

  const handleSelectPlan = useCallback(async (plan: Plan) => {
    // In production, the actual subscription update happens automatically via firestore listener
    // after the payment verification backend call succeeds.
    if (!user && plan !== 'free') {
      try {
        localStorage.setItem("intendedPlan", plan);
      } catch(e) {}
      setCurrentPage("auth");
    } else {
      setCurrentPage("engine");
    }
  }, [user]);

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
      setCurrentPage("landing");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  }, []);

  // Protected routes check
  const protectedPages = useMemo(() => ["engine", "settings", "admin"], []);
  useEffect(() => {
    if (!loadingAuth) {
      if (!user && protectedPages.includes(currentPage)) {
        setCurrentPage("auth");
      } else if (user && (currentPage === "landing" || currentPage === "auth")) {
        setCurrentPage("engine");
      } else if (user && currentPage === "admin" && !isAdmin) {
        setCurrentPage("engine");
      }
    }
  }, [loadingAuth, user, isAdmin, currentPage, protectedPages]);

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-matte-black flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: [1, 1.2, 1], opacity: 1 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
        >
          <BrandLogo className="w-24 h-24 sm:w-32 sm:h-32" />
        </motion.div>
      </div>
    );
  }

  const hasTerminalAccess = (userProfile?.intelligenceCredits || 0) > 0;
  const terminalNavIcon = hasTerminalAccess 
    ? <Terminal className="w-4 h-4 text-emerald-400" /> 
    : <div className="flex items-center"><Terminal className="w-4 h-4" /><Lock className="w-3 h-3 ml-1 text-gold/70" /></div>;

  const primaryNavItems = user ? [
    { id: "engine", label: "Signal Engine", icon: <Zap className="w-4 h-4 text-gold" /> },
    { id: "terminal", label: "AI Terminal", icon: terminalNavIcon, badge: userProfile?.intelligenceCredits ? `${userProfile.intelligenceCredits} cr` : undefined },
    { id: "pricing", label: "Pricing", icon: <CreditCard className="w-4 h-4 text-blue-400" /> },
  ] : [
    { id: "landing", label: "Home", icon: null },
    { id: "engine", label: "Signal Engine", icon: <Zap className="w-4 h-4 text-gold" /> },
    { id: "pricing", label: "Pricing", icon: <CreditCard className="w-4 h-4 text-blue-400" /> },
  ];

  const navigateTo = (page: Page) => {
    setCurrentPage(page);
    setIsMenuOpen(false);
    setIsUserMenuOpen(false);
  };

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden selection:bg-gold/30 selection:text-gold flex flex-col justify-between">
      
      <InstallBanner />
      {user && <TradeTracker user={user} />}
      <Toaster position="top-center" toastOptions={{ style: { background: '#1a1a1a', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } }} />
      
      {/* Navigation */}
      {currentPage !== "admin" && currentPage !== "suspended" && (
      <nav className="fixed top-0 left-0 right-0 z-50 bg-matte-black/90 backdrop-blur-xl border-b border-white/10 transition-all">
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex justify-between items-center">
          
          {/* Brand Logo & Name */}
          <button 
            onClick={() => navigateTo("landing")}
            className="flex items-center gap-2 sm:gap-2.5 group focus:outline-none"
            aria-label="SessionKing Home"
          >
            <motion.div 
              key={currentPage}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="shrink-0"
            >
              <BrandLogo className="w-7 h-7 sm:w-8 sm:h-8" />
            </motion.div>
            <div className="flex flex-col text-left">
              <span className="font-bold text-base sm:text-lg tracking-tight uppercase leading-none text-white group-hover:text-gold transition-colors">
                SESSION<span className="text-gold">KING</span>
              </span>
              <span className="text-[9px] sm:text-[10px] text-gray-400 font-mono tracking-widest leading-tight uppercase">
                AMI INTELLIGENCE
              </span>
            </div>
          </button>

          {/* Desktop Navigation (lg and above) */}
          <div className="hidden lg:flex items-center gap-1.5 xl:gap-2.5">
            
            {/* Primary Nav Items */}
            {primaryNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => navigateTo(item.id as Page)}
                className={cn(
                  "text-xs font-semibold transition-all px-3.5 py-2 rounded-xl flex items-center gap-2 uppercase tracking-wider relative",
                  currentPage === item.id 
                    ? "text-gold bg-gold/10 border border-gold/20 shadow-sm" 
                    : "text-gray-300 hover:text-white hover:bg-white/5"
                )}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge && (
                  <span className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}

            <div className="h-4 w-[1px] bg-white/10 mx-1" />
            
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-gray-300 hover:text-gold transition-all flex items-center justify-center"
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle Theme"
            >
              {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-400" />}
            </button>

            {/* Admin Panel Access Button (Placed beside Notification Panel) */}
            {user && isAdmin && (
              <button
                onClick={() => navigateTo("admin")}
                className="px-3.5 py-2 rounded-xl border border-gold/30 bg-gold/10 hover:bg-gold/20 text-gold flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider transition-all shadow-sm"
                title="Admin Governance Panel"
                aria-label="Admin Panel"
              >
                <Crown className="w-4 h-4 text-gold" />
                <span>Admin</span>
              </button>
            )}

            {/* Notification Bell */}
            {user && <NotificationSystem userId={user.uid} userProfile={userProfile} onNavigate={navigateTo} />}

            {/* User Account / Profile Dropdown */}
            {!user ? (
              <button
                onClick={() => navigateTo("auth")}
                className="gold-gradient px-4 py-2 rounded-xl text-xs font-bold text-matte-black hover:scale-105 transition-transform shadow-lg uppercase tracking-wider flex items-center gap-1.5 ml-2"
              >
                <User className="w-3.5 h-3.5" />
                <span>Login / Register</span>
              </button>
            ) : (
              <div className="relative ml-2" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className={cn(
                    "flex items-center gap-2 p-1.5 pr-3 rounded-xl border transition-all text-left",
                    isUserMenuOpen 
                      ? "bg-gold/10 border-gold/30 text-white" 
                      : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20"
                  )}
                  aria-expanded={isUserMenuOpen}
                >
                  <div className="w-7 h-7 rounded-lg bg-gold/20 border border-gold/30 flex items-center justify-center font-bold text-gold text-xs overflow-hidden shrink-0">
                    {userProfile?.photoURL ? (
                      <img src={userProfile.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      (userProfile?.displayName || user.email || 'U').charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex flex-col text-left max-w-[100px] xl:max-w-[130px]">
                    <span className="text-xs font-semibold text-white truncate leading-tight">
                      {userProfile?.displayName || user.email?.split('@')[0] || 'User'}
                    </span>
                    <span className="text-[9px] text-gold font-mono uppercase font-bold leading-tight truncate">
                      {userPlan} Plan
                    </span>
                  </div>
                  <ChevronDown className={cn("w-3 h-3 text-gray-400 transition-transform", isUserMenuOpen && "rotate-180 text-gold")} />
                </button>

                <AnimatePresence>
                  {isUserMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-64 rounded-2xl bg-matte-black/95 backdrop-blur-2xl border border-white/10 shadow-2xl p-2 z-50"
                    >
                      {/* User Header Summary */}
                      <div className="p-3 bg-white/5 rounded-xl border border-white/5 mb-2">
                        <p className="text-xs font-bold text-white truncate">
                          {userProfile?.displayName || "Authenticated Trader"}
                        </p>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">
                          {user.email || user.phoneNumber}
                        </p>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                          <span className="text-[10px] text-gray-400 uppercase font-mono">Plan:</span>
                          <span className="text-[10px] font-bold text-gold uppercase px-2 py-0.5 bg-gold/10 rounded border border-gold/20">
                            {userPlan}
                          </span>
                        </div>
                      </div>

                      {/* Dropdown Options */}
                      <div className="space-y-1">
                        <button
                          onClick={() => navigateTo("settings")}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          <User className="w-4 h-4 text-gold" />
                          <span>Settings & Profile</span>
                        </button>
                        <button
                          onClick={() => navigateTo("pricing")}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          <CreditCard className="w-4 h-4 text-blue-400" />
                          <span>Manage Subscription</span>
                        </button>
                        
                        <div className="h-[1px] bg-white/5 my-1" />
                        
                        <button
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            handleLogout();
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Mobile Navigation Controls (lg:hidden) */}
          <div className="lg:hidden flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-white/5 border border-white/5 text-gray-300 hover:text-gold transition-colors flex items-center justify-center min-w-[36px] min-h-[36px]"
              aria-label="Toggle Theme"
            >
              {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-400" />}
            </button>

            {/* Admin Panel Access Button (Placed beside Notification Panel on Mobile) */}
            {user && isAdmin && (
              <button
                onClick={() => navigateTo("admin")}
                className="p-2 rounded-xl border border-gold/30 bg-gold/10 hover:bg-gold/20 text-gold flex items-center justify-center min-w-[36px] min-h-[36px] transition-all shadow-sm"
                title="Admin Panel"
                aria-label="Admin Panel"
              >
                <Crown className="w-4 h-4 text-gold" />
              </button>
            )}

            {user && <NotificationSystem userId={user.uid} userProfile={userProfile} onNavigate={navigateTo} />}

            <button 
              className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-200 hover:text-gold transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle Navigation Menu"
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Sheet Drawer */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="lg:hidden bg-matte-black/98 backdrop-blur-2xl border-b border-white/10 overflow-hidden shadow-2xl"
            >
              <div className="p-4 sm:p-6 space-y-6 max-h-[82vh] overflow-y-auto custom-scrollbar">
                
                {/* User Info Header (Mobile) */}
                {user ? (
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gold/20 border border-gold/30 flex items-center justify-center font-bold text-gold text-sm overflow-hidden shrink-0">
                        {userProfile?.photoURL ? (
                          <img src={userProfile.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          (userProfile?.displayName || user.email || 'U').charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">
                          {userProfile?.displayName || "Trader"}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {user.email || user.phoneNumber}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="inline-block px-2.5 py-1 text-[10px] font-bold text-gold uppercase bg-gold/10 border border-gold/30 rounded-lg">
                        {userPlan} Plan
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-gold/10 border border-gold/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">Join SessionKing</p>
                      <p className="text-xs text-gray-400">Institutional signals & AI intelligence</p>
                    </div>
                    <button
                      onClick={() => navigateTo("auth")}
                      className="w-full sm:w-auto gold-gradient px-5 py-2.5 rounded-xl text-xs font-bold text-matte-black shadow-lg uppercase tracking-wider"
                    >
                      Login / Register
                    </button>
                  </div>
                )}

                {/* Section 1: Navigation Links */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 px-2 mb-2">
                    Navigation
                  </p>
                  {primaryNavItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => navigateTo(item.id as Page)}
                      className={cn(
                        "w-full text-left flex items-center justify-between p-3 rounded-xl transition-all min-h-[48px]",
                        currentPage === item.id 
                          ? "bg-gold/10 border border-gold/30 text-gold font-bold" 
                          : "text-gray-300 hover:bg-white/5 active:bg-white/10"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2 rounded-lg",
                          currentPage === item.id ? "bg-gold/20" : "bg-white/5"
                        )}>
                          {item.icon}
                        </div>
                        <span className="text-sm">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Section 2: Preferences & Account */}
                {user && (
                  <div className="space-y-1.5 pt-2 border-t border-white/5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 px-2 mb-2">
                      Account & Preferences
                    </p>
                    <button
                      onClick={() => navigateTo("settings")}
                      className={cn(
                        "w-full text-left flex items-center gap-3 p-3 rounded-xl transition-all min-h-[48px]",
                        currentPage === "settings" 
                          ? "bg-gold/10 border border-gold/30 text-gold font-bold" 
                          : "text-gray-300 hover:bg-white/5"
                      )}
                    >
                      <div className="p-2 rounded-lg bg-white/5">
                        <User className="w-4 h-4 text-gold" />
                      </div>
                      <span className="text-sm">Settings & Security</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full text-left flex items-center gap-3 p-3 rounded-xl transition-all text-red-400 hover:bg-red-500/10 min-h-[48px]"
                    >
                      <div className="p-2 rounded-lg bg-red-500/10">
                        <LogOut className="w-4 h-4 text-red-400" />
                      </div>
                      <span className="text-sm font-bold">Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
      )}

      {/* Main Content */}
      <main className={cn("transition-colors duration-300", currentPage !== "auth" && currentPage !== "admin" && "pt-20")}>
        {currentPage !== "auth" && currentPage !== "admin" && (
          <SubscriptionBanner 
            userProfile={userProfile} 
            onRenew={() => setCurrentPage("pricing")} 
          />
        )}
        <AnimatePresence mode="popLayout">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
          >
            <Suspense fallback={<PageLoader />}>
              {currentPage === "landing" && <LandingPage user={user} onLoginClick={() => setCurrentPage("auth")} onEnterEngine={() => setCurrentPage(user ? "engine" : "auth")} onForexBasicsClick={() => setCurrentPage("education")} />}
              {currentPage === "auth" && <AuthPage onViewLegal={(section) => { setActiveLegalSection(section); setCurrentPage("legal"); }} />}
              {currentPage === "engine" && <SignalEngine user={user} userProfile={userProfile} userPlan={userPlan} onUpgrade={() => setCurrentPage("pricing")} />}
              {currentPage === "about" && <AboutPage />}
              {currentPage === "pricing" && <PricingPage user={user} currentPlan={userPlan} onSelectPlan={handleSelectPlan} onAuthRedirect={() => setCurrentPage("auth")} onTerminalRedirect={() => setCurrentPage("terminal")} />}
              {currentPage === "brokers" && <BrokersPage />}
              {currentPage === "education" && <EducationPage />}
              {currentPage === "settings" && <SettingsPage user={user} userProfile={userProfile} onProfileUpdate={(updates) => setUserProfile((prev: any) => ({ ...(prev || {}), ...updates }))} onNavigate={setCurrentPage} />}
              {currentPage === "terminal" && <IntelligenceTerminal user={user} userProfile={userProfile} onExit={() => setCurrentPage("engine")} onProceedToPayment={() => setCurrentPage("terminal-payment")} />}
              {currentPage === "terminal-payment" && (
                <div className="container mx-auto px-6 py-24 text-center min-h-screen">
                  <h1 className="text-4xl font-bold mb-4 text-gold text-shadow-glow">Intelligence Terminal Payment</h1>
                  <p className="text-gray-400 mb-8">Access to the Intelligence Terminal costs $5 for 3 uses.</p>
                  <TerminalPayment user={user} onPaymentSuccess={() => setCurrentPage("terminal")} onCancel={() => setCurrentPage("terminal")} />
                </div>
              )}
              {currentPage === "admin" && isAdmin && <AdminPanel user={user} onExit={() => setCurrentPage("engine")} />}
              {currentPage === "legal" && <LegalPage activeSection={activeLegalSection} onSectionChange={setActiveLegalSection} />}
              {currentPage === "support" && <SupportPage user={user} userProfile={userProfile} currentPlan={userPlan} />}
              {currentPage === "shared" && <SharedReportViewer onClose={() => {
                   window.history.pushState({}, '', window.location.pathname);
                   setCurrentPage("landing");
              }} />}
              {currentPage === "suspended" && (
                <SuspendedPage 
                  reason={suspensionDetails?.message} 
                  date={suspensionDetails?.date} 
                  onContactSupport={() => {
                    try {
                      localStorage.setItem("support_prefill_subject", "Account Suspension Appeal");
                      localStorage.setItem("support_prefill_message", `Hello, my account has been suspended.\n\nReason for suspension: ${suspensionDetails?.message || "Violating platform guidelines"}\nDate of suspension: ${suspensionDetails?.date || "N/A"}\n\nI would like to appeal this decision because...`);
                    } catch (e) {}
                    setCurrentPage("support");
                  }} 
                />
              )}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer / Site Map */}
      {currentPage !== "auth" && currentPage !== "admin" && currentPage !== "engine" && currentPage !== "shared" && currentPage !== "suspended" && (
        <footer className="bg-matte-black border-t border-white/10 pt-16 pb-24 mt-20">
          <div className="container mx-auto px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
              <div className="col-span-2 md:col-span-1">
                <div className="flex items-center gap-2 mb-6">
                  <BrandLogo className="w-8 h-8" />
                  <span className="font-bold text-xl tracking-tighter uppercase">SESSIONKING</span>
                </div>
                <p className="text-gray-400 text-sm">
                  Institutional-grade adaptive market intelligence and forex education.
                </p>
              </div>
              <div>
                <h4 className="text-white font-bold mb-4 uppercase tracking-widest text-sm">Platform</h4>
                <ul className="space-y-2 text-sm text-gray-400">
                  {user && (
                    <li><button onClick={() => setCurrentPage("engine")} className="hover:text-gold transition-colors">Signal Engine</button></li>
                  )}
                  {user && (
                    <li><button onClick={() => setCurrentPage("terminal")} className="hover:text-gold transition-colors">Intelligence Terminal</button></li>
                  )}
                  <li><button onClick={() => setCurrentPage("pricing")} className="hover:text-gold transition-colors">Pricing & Tiers</button></li>
                  <li><button onClick={() => setCurrentPage("brokers")} className="hover:text-gold transition-colors">Recommended Brokers</button></li>
                  <li><button onClick={() => setCurrentPage("support")} className="hover:text-gold transition-colors">Support Center</button></li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-bold mb-4 uppercase tracking-widest text-sm">Education</h4>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li><button onClick={() => setCurrentPage("education")} className="hover:text-gold transition-colors">Forex Basics</button></li>
                  <li><button onClick={() => setCurrentPage("about")} className="hover:text-gold transition-colors">About The AI</button></li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-bold mb-4 uppercase tracking-widest text-sm">Legal</h4>
                <ul className="space-y-2 text-sm text-gray-400 text-left">
                  <li><button onClick={() => { setActiveLegalSection("terms"); setCurrentPage("legal"); }} className="hover:text-gold transition-colors block">Terms of Service</button></li>
                  <li><button onClick={() => { setActiveLegalSection("privacy"); setCurrentPage("legal"); }} className="hover:text-gold transition-colors block">Privacy Policy</button></li>
                  <li><button onClick={() => { setActiveLegalSection("risk"); setCurrentPage("legal"); }} className="hover:text-gold transition-colors block">Risk Disclosure</button></li>
                </ul>
              </div>
            </div>
            <div className="text-center text-gray-600 text-xs pt-8 border-t border-white/5">
              &copy; {new Date().getFullYear()} SESSIONKING. All rights reserved. Trading involves significant risk.
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
