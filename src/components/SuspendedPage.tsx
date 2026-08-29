import { motion } from "motion/react";
import { AlertTriangle, LogOut, Mail } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

export default function SuspendedPage({ 
  reason = "Violating platform guidelines", 
  date,
  onContactSupport
}: { 
  reason?: string; 
  date?: string;
  onContactSupport?: () => void;
}) {
  const handleLogout = async () => {
    try {
      localStorage.removeItem("currentPage");
      localStorage.removeItem("installBannerDismissed");
    } catch (e) {}
    await signOut(auth);
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-matte-black flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background styling for suspension */}
      <div className="absolute inset-0 bg-red-900/10" />
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-red-600" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-600/10 blur-[120px] rounded-full pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-black/50 backdrop-blur-md border border-red-500/30 rounded-3xl p-8 relative z-10 shadow-2xl"
      >
        <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-10 h-10 text-red-500" />
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-3">Account Suspended</h1>
          <p className="text-gray-400 mb-6">
            Your account has been suspended by SessionKing Administration. You can no longer access the platform.
          </p>
          
          <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4 text-left border-l-4 border-l-red-500">
            <p className="text-xs text-red-400/80 font-bold uppercase tracking-widest mb-1">Reason</p>
            <p className="text-red-200 text-sm font-medium">{reason}</p>
            {date && (
              <>
                <p className="text-xs text-red-400/80 font-bold uppercase tracking-widest mt-3 mb-1">Date Suspended</p>
                <p className="text-red-200 text-sm">{date}</p>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <button 
            onClick={onContactSupport}
            className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white p-4 rounded-xl font-bold transition-all border border-white/5 text-sm"
          >
            <Mail className="w-4 h-4" />
            Contact Support
          </button>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 p-4 rounded-xl font-bold transition-all border border-red-500/20 text-sm tracking-widest uppercase"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </motion.div>
    </div>
  );
}
