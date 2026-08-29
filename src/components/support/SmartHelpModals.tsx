import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Brain, TrendingUp, ShieldAlert, BookOpen, Clock, 
  Map, Target, Shield, Fingerprint, RefreshCw, CreditCard,
  Zap, Lock, Smartphone, Database, AlertCircle, ChevronDown, CheckCircle, Lightbulb, UserCheck, Activity, Search
} from "lucide-react";
import { cn } from "../../lib/utils";

interface SmartHelpModalsProps {
  activeModal: 'signal' | 'learning' | 'account' | 'billing' | null;
  onClose: () => void;
  onRequestAISearch: (query: string) => void;
}

export function SmartHelpModals({ activeModal, onClose, onRequestAISearch }: SmartHelpModalsProps) {
  return (
    <AnimatePresence>
      {activeModal && (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      >
        <div 
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div 
          initial={{ y: 50, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-4xl max-h-[90vh] bg-matte-black border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/5 bg-gradient-to-r from-white/5 to-transparent">
            <div className="flex items-center gap-4">
              {activeModal === 'signal' && <Activity className="w-8 h-8 text-blue-400" />}
              {activeModal === 'learning' && <BookOpen className="w-8 h-8 text-purple-400" />}
              {activeModal === 'account' && <Lock className="w-8 h-8 text-gold" />}
              {activeModal === 'billing' && <CreditCard className="w-8 h-8 text-green-400" />}
              
              <h2 className="text-2xl font-bold uppercase tracking-widest text-white">
                {activeModal === 'signal' && "Signal Engine Guide"}
                {activeModal === 'learning' && "Forex Learning Center"}
                {activeModal === 'account' && "Account & Security"}
                {activeModal === 'billing' && "Billing & Credit System"}
              </h2>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          /* Add Content dynamically... */
          <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
            {activeModal === 'signal' && <SignalEngineHelp />}
            {activeModal === 'learning' && <ForexLearningHelp />}
            {activeModal === 'account' && <AccountLoginHelp />}
            {activeModal === 'billing' && <BillingInfoHelp />}

            
          </div>
        </motion.div>
      </motion.div>
          )}
    </AnimatePresence>
  );
}

function SignalEngineHelp() {
  return (
    <div className="space-y-8">
      <section>
        <p className="text-gray-300 leading-relaxed text-sm lg:text-base">
          This guide provides step-by-step instructions on how to use the automated Signal Engine Bot for live institutional market analysis. Follow the instructions below to generate a signal.
        </p>
      </section>

      <section className="space-y-4">
        <div className="flex gap-4 p-5 border border-white/5 rounded-xl bg-black/40">
           <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold flex-shrink-0">1</div>
           <div>
              <h5 className="font-bold text-white text-base">Select Trading Session</h5>
              <p className="text-gray-400 text-sm mt-1">Choose the current active market session (Asian, London, New York, or Overlap). The engine adapts its volatility filters based on the session.</p>
           </div>
        </div>

        <div className="flex gap-4 p-5 border border-white/5 rounded-xl bg-black/40">
           <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold flex-shrink-0">2</div>
           <div>
              <h5 className="font-bold text-white text-base">Choose Currency Pair</h5>
              <p className="text-gray-400 text-sm mt-1">Select the pair you want to analyze from the list of available majors and crosses.</p>
           </div>
        </div>

        <div className="flex gap-4 p-5 border border-white/5 rounded-xl bg-black/40">
           <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold flex-shrink-0">3</div>
           <div>
              <h5 className="font-bold text-white text-base">Set Trading Mode</h5>
              <p className="text-gray-400 text-sm mt-1">Choose between Scalp, Day, or Swing. This tells the AI how to analyze timeframes and structure its entries and exits.</p>
           </div>
        </div>

        <div className="flex gap-4 p-5 border border-white/5 rounded-xl bg-black/40">
           <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold flex-shrink-0">4</div>
           <div>
              <h5 className="font-bold text-white text-base">Input Account Balance (Optional but Recommended)</h5>
              <p className="text-gray-400 text-sm mt-1">Enter your account balance to let the AI calculate appropriate lot sizes based on strict 1-2% risk management rules.</p>
           </div>
        </div>

        <div className="flex gap-4 p-5 border border-white/5 rounded-xl bg-black/40">
           <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold flex-shrink-0">5</div>
           <div>
              <h5 className="font-bold text-white text-base">Generate Analysis</h5>
              <p className="text-gray-400 text-sm mt-1">Click the active button to run the AI engine. Once generated, review the probability score, proposed entry, take profit, and stop loss zones.</p>
           </div>
        </div>
      </section>

      <section className="bg-blue-500/5 border border-blue-500/20 p-5 rounded-xl">
        <h3 className="font-bold text-blue-400 mb-2 flex items-center gap-2">
          <Activity className="w-4 h-4" /> Understanding the Output
        </h3>
        <p className="text-gray-400 text-sm">
          A <strong className="text-white">BUY</strong> or <strong className="text-white">SELL</strong> signal will display entry targets and stop loss parameters. 
          If conditions are unfavorable or conflicting, the AI may output <strong className="text-white bg-white/10 px-1 py-0.5 rounded">WAIT</strong>. 
          Always respect the wait signal to preserve your capital.
        </p>
      </section>
    </div>
  );
}

function ForexLearningHelp() {
  return (
    <div className="space-y-8">
      <section className="text-center p-8 bg-gradient-to-b from-purple-900/20 to-black border border-purple-500/20 rounded-xl">
        <BookOpen className="w-12 h-12 text-purple-400 mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-white uppercase tracking-widest mb-2">Forex Learning & Education</h3>
        <p className="text-gray-400 text-sm max-w-xl mx-auto leading-relaxed">
          Navigate to the <strong className="text-white">Forex Learning</strong> page from the main menu to access our comprehensive education center.
        </p>
      </section>

      <section className="bg-white/5 border border-white/10 p-6 rounded-xl space-y-4">
         <h3 className="text-lg font-bold text-white flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-gold"/> Proper Education is Required</h3>
         <p className="text-sm text-gray-400 leading-relaxed">
            Forex trading involves significant risk and is not suitable for all investors. You must obtain a proper education about how the foreign exchange market works, the risks involved, and risk management strategies before opening any live trade. We highly recommend completing the educational materials on the Forex Learning page before utilizing the Intelligence Engine.
         </p>
      </section>

      <section className="bg-white/5 border border-white/10 p-6 rounded-xl space-y-4">
         <h3 className="text-lg font-bold text-white flex items-center gap-2"><Target className="w-5 h-5 text-blue-400"/> Advanced Professional Classes</h3>
         <p className="text-sm text-gray-400 leading-relaxed">
            If you are interested in advanced, professional 1-on-1 or group forex classes—ranging from beginner fundamentals to institutional-grade smart money concepts—please contact our support team using the support ticket form available on this page.
         </p>
         <div className="p-3 bg-gold/10 border border-gold/20 rounded-lg text-gold text-sm font-medium mt-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> Please note: These professional classes are separate from the SaaS subscription and are not free.
         </div>
      </section>
    </div>
  );
}

function AccountLoginHelp() {
  return (
    <div className="space-y-10">
      <section>
        <h3 className="text-xl font-bold text-gold mb-4 flex items-center gap-2">
          <UserCheck className="w-5 h-5" /> Account Management
        </h3>
        <div className="space-y-4">
          <div className="bg-white/5 border border-white/10 p-5 rounded-xl">
             <h4 className="font-bold text-white mb-2">Creating an Account</h4>
             <p className="text-sm text-gray-400">Select "Login / Register" on any prompt. Enter your email and a secure password. You'll instantly receive access to your dashboard.</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-5 rounded-xl">
             <h4 className="font-bold text-white mb-2">Password Reset</h4>
             <p className="text-sm text-gray-400">If you forget your password, click "Forgot Password" on the login screen. You will receive an encrypted reset link directly to your email.</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-5 rounded-xl">
             <h4 className="font-bold text-white mb-2">Profile Details</h4>
             <p className="text-sm text-gray-400">Update your name, trading preferences, and notification settings directly from the <span className="text-white font-medium">Settings Console</span> located in the sidebar menu.</p>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-xl font-bold text-green-400 mb-4 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5" /> Security & Protection
        </h3>
        <ul className="space-y-3 text-sm text-gray-400">
          <li className="flex gap-3"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /> <strong>Firebase Authentication:</strong> We utilize institutional-grade security provided by Google to encrypt and manage your identity.</li>
          <li className="flex gap-3"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /> <strong>Session Guard:</strong> Unrecognized devices or IPs are logged, and your session tokens are actively monitored.</li>
          <li className="flex gap-3"><CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /> <strong>Strong Passwords:</strong> Always use a mix of alphanumeric and special characters. We do not store plain-text keys.</li>
        </ul>
      </section>

      <section>
        <h3 className="text-xl font-bold text-gray-300 mb-4 flex items-center gap-2">
          <Wrench className="w-5 h-5" /> Troubleshooting
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div className="p-4 border border-white/5 bg-black/40 rounded-xl">
              <h5 className="font-bold text-white text-sm mb-1">App Stalling or Freezing</h5>
              <p className="text-xs text-gray-400">Perform a hard refresh. Clear your browser cache. If the issue persists, simply log out and sign back in to issue a new session token.</p>
           </div>
           <div className="p-4 border border-white/5 bg-black/40 rounded-xl">
              <h5 className="font-bold text-white text-sm mb-1">Network Synchronization</h5>
              <p className="text-xs text-gray-400">Our engine relies on real-time data streams. Ensure your network isn't blocking WebSocket connections.</p>
           </div>
        </div>
      </section>
    </div>
  );
}

function BillingInfoHelp() {
  return (
    <div className="space-y-10">
      <section className="text-center p-8 bg-gradient-to-b from-green-900/20 to-black border border-green-500/20 rounded-xl">
        <CreditCard className="w-12 h-12 text-green-400 mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-white uppercase tracking-widest mb-2">Billing & Pricing Structure</h3>
        <p className="text-gray-400 text-sm max-w-xl mx-auto leading-relaxed">
          SESSIONKING offers a flexible, dual-billing architecture tailored to your trading needs. 
          You can choose between comprehensive monthly subscription plans for our automated systems, or standard credit-based access for manual intelligence analysis.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white/5 border border-gold/20 p-6 rounded-xl space-y-4">
           <div className="border-b border-white/10 pb-4 mb-4">
             <h3 className="text-lg font-bold text-gold mb-2 flex items-center gap-2">
               <Activity className="w-5 h-5" /> Monthly Plans
             </h3>
             <p className="text-sm text-gray-400 leading-relaxed">
               For the automated <strong className="text-white">Signal Engine Bot</strong>.
             </p>
           </div>
           <ul className="space-y-3 text-sm text-gray-300">
             <li className="flex gap-2 isolate"><CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" /> Full access to the automated Signal Engine Bot</li>
             <li className="flex gap-2 isolate"><CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" /> Real-time institutional analysis and probability metrics</li>
             <li className="flex gap-2 isolate"><CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" /> Choose between Free (limited features), Pro, Premium, or Institutional tiers</li>
             <li className="flex gap-2 isolate"><CheckCircle className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" /> Automatically billed monthly</li>
           </ul>
        </div>

        <div className="bg-white/5 border border-blue-500/20 p-6 rounded-xl space-y-4">
           <div className="border-b border-white/10 pb-4 mb-4">
             <h3 className="text-lg font-bold text-blue-400 mb-2 flex items-center gap-2">
               <Database className="w-5 h-5" /> Credit-Based Intelligence
             </h3>
             <p className="text-sm text-gray-400 leading-relaxed">
               Pay-as-you-go access to the <strong className="text-white">Intelligence Terminal</strong>. No monthly subscription required.
             </p>
           </div>
           
           <div className="flex justify-between items-center text-sm mb-2">
              <span className="font-bold text-white">Credit Package</span>
              <span className="font-mono text-blue-400 bg-blue-500/10 px-3 py-1 rounded">$5.00 USD</span>
           </div>
           <div className="flex justify-between items-center text-sm border-b border-white/10 pb-4">
              <span className="text-gray-400">Yield</span>
              <span className="font-bold text-white">3 Analysis Credits</span>
           </div>
           
           <ul className="space-y-3 text-sm text-gray-300 mt-4">
             <li className="flex gap-2 isolate"><Eye className="w-4 h-4 text-blue-400 mt-1 flex-shrink-0" /> <span className="flex-1">Upload TradingView/MT5 chart screenshots for Deep Vision AI structural analysis (1 Credit).</span></li>
             <li className="flex gap-2 isolate"><Target className="w-4 h-4 text-blue-400 mt-1 flex-shrink-0" /> <span className="flex-1">Request manual multi-timeframe structural analysis on specific currency pairs (1 Credit parameter).</span></li>
           </ul>
        </div>
      </section>

      <section className="bg-white/5 border border-white/10 p-6 rounded-xl">
         <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2"><Lock className="w-4 h-4 text-green-400" /> Exhaustion & Security</h3>
         <p className="text-sm text-gray-400 leading-relaxed mb-4">
            When credits exhaust, Intelligence Terminal features are locked until restocked. 
            However, your monthly plan (if active), general account, log history, and educational materials remain entirely accessible.
            All monetary processing is secured via institutional-grade encrypted pathways.
         </p>
      </section>
    </div>
  );
}

// Temporary imports for icons missed in top import: Globe, List, Eye
import { Globe, List, Eye, Wrench } from "lucide-react";
