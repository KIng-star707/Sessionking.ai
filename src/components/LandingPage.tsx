import { motion } from "motion/react";

import { 
  TrendingUp, ShieldAlert, Globe, Landmark, User, 
  Zap, Clock, Activity, Target, ChevronRight, CheckCircle2, 
  BarChart3, BookOpen, Lock, ArrowRight, AlertTriangle
} from "lucide-react";
import { cn } from "../lib/utils";

interface LandingPageProps {
  user: any;
  onLoginClick: () => void;
  onEnterEngine: () => void;
  onForexBasicsClick?: () => void;
}

export default function LandingPage({ user, onLoginClick, onEnterEngine, onForexBasicsClick }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-matte-black">
      {/* 1. HERO SECTION */}
      <section className="relative flex items-center justify-center pt-32 pb-24 px-6 overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-deep-blue/20 via-matte-black to-matte-black" />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold/5 rounded-full blur-[120px] animate-pulse" />
        </div>

        <div className="container mx-auto max-w-6xl relative z-20">
          <div className="flex flex-col items-center text-center">
            <div className="max-w-4xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold/10 border border-gold/20 text-gold text-xs font-bold uppercase tracking-widest mb-6 mx-auto"
              >
                 SESSIONKING AMI
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-4xl sm:text-5xl md:text-7xl font-bold mb-6 tracking-tight leading-[1.1] text-white"
              >
                Trade Forex with <br className="hidden sm:block" />
                <span className="gold-text">Intelligence,</span><br className="hidden sm:block" />
                Not Guesswork
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed"
              >
                SESSIONKING is an institutional-grade forex intelligence platform that analyzes market structure, momentum, liquidity, and risk to generate real-time, high-probability trading signals.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex justify-center"
              >
                <button
                  onClick={user ? onEnterEngine : onLoginClick}
                  className="px-8 py-4 bg-gold text-matte-black rounded-xl font-bold hover:bg-gold/90 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(212,175,55,0.2)] mx-auto"
                >
                  {user ? (
                    <>
                       Enter Signal Engine
                    </>
                  ) : (
                    "LOGIN/REGISTER"
                  )}
                </button>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. PROBLEM -> SOLUTION */}
      <section className="py-8 px-6 border-b border-white/5">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded text-red-400 bg-red-400/10 text-xs font-bold uppercase tracking-widest mb-2">
                <AlertTriangle className="w-4 h-4" /> The Problem
              </div>
              <h2 className="text-3xl font-bold text-white mb-6">Why Most Traders Fail</h2>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 text-gray-400">
                  <span className="text-red-500 font-bold">❌</span> Random signals that don't trigger
                </li>
                <li className="flex items-center gap-3 text-gray-400">
                  <span className="text-red-500 font-bold">❌</span> Overcomplicated, messy charts
                </li>
                <li className="flex items-center gap-3 text-gray-400">
                  <span className="text-red-500 font-bold">❌</span> Emotional trading and revenge trading
                </li>
                <li className="flex items-center gap-3 text-gray-400">
                  <span className="text-red-500 font-bold">❌</span> Zero risk control or money management
                </li>
              </ul>
            </div>
            
            <div className="glass-card p-8 md:p-10 border-l-4 border-l-gold relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded text-gold bg-gold/10 text-xs font-bold uppercase tracking-widest mb-6 relative z-10">
                <CheckCircle2 className="w-4 h-4" /> The Solution
              </div>
              <h2 className="text-2xl font-bold text-white mb-4 relative z-10">
                SESSIONKING replaces guesswork with structured market intelligence.
              </h2>
              <ul className="space-y-4 relative z-10 mt-8">
                <li className="flex items-center gap-3 text-gray-300">
                  <div className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center text-gold shrink-0">✓</div>
                  Multi-timeframe analysis
                </li>
                <li className="flex items-center gap-3 text-gray-300">
                  <div className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center text-gold shrink-0">✓</div>
                  Real-time, high-probability signals
                </li>
                <li className="flex items-center gap-3 text-gray-300">
                  <div className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center text-gold shrink-0">✓</div>
                  Strict risk management system
                </li>
                <li className="flex items-center gap-3 text-gray-300">
                  <div className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center text-gold shrink-0">✓</div>
                  Session-based precision
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS */}
      <section className="py-8 px-6 bg-black/50 border-b border-white/5">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">How It Works</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">A streamlined process from analysis to execution.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { step: 1, title: "Select Session", icon: <Globe className="w-6 h-6" /> },
              { step: 2, title: "Choose Pair", icon: <Activity className="w-6 h-6" /> },
              { step: 3, title: "Analyze Market", icon: <BarChart3 className="w-6 h-6" /> },
              { step: 4, title: "Execute Trade", icon: <Target className="w-6 h-6" /> }
            ].map((item) => (
              <div key={item.step} className="text-center relative">
                <div className="w-16 h-16 mx-auto bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-gold mb-6 relative z-10">
                  {item.icon}
                  <div className="absolute -top-3 -right-3 w-6 h-6 bg-gold text-matte-black rounded-full text-xs font-bold flex items-center justify-center">
                    {item.step}
                  </div>
                </div>
                <h3 className="text-white font-bold mb-2">{item.title}</h3>
                {item.step !== 4 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-[1px] bg-gradient-to-r from-gold/50 to-transparent" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. CORE FEATURES */}
      <section className="py-8 px-6 border-b border-white/5">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Core Features</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">Built for precision, designed for discipline.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="glass-card p-8 border hover:border-gold/30 transition-colors">
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 mb-6">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Adaptive Market Intelligence (AMI)</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>• Reads market structure, doesn't guess</li>
                <li>• Detects liquidity sweeps and momentum shifts</li>
              </ul>
            </div>

            <div className="glass-card p-8 border hover:border-gold/30 transition-colors">
              <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400 mb-6">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Multi-Timeframe Analysis</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>• Aligns M5, M15, H1, H4, and D1 trends</li>
                <li>• Ensures entries are backed by higher timeframe logic</li>
              </ul>
            </div>

            <div className="glass-card p-8 border hover:border-gold/30 transition-colors">
              <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center text-green-400 mb-6">
                <Activity className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Real-Time Signal Engine</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>• Instant entry notifications</li>
                <li>• No delayed or repainting signals</li>
              </ul>
            </div>

            <div className="glass-card p-8 border hover:border-gold/30 transition-colors">
              <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center text-red-400 mb-6">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Risk Management Engine</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>• Enforces 1% risk per trade</li>
                <li>• Mandatory Stop Loss calculations</li>
                <li>• Dynamic lot size suggestions</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 5. LIVE SIGNAL PREVIEW (Integrated into Hero) & 6. FOREX EDUCATION */}
      <section id="education" className="py-8 px-6 bg-gradient-to-b from-matte-black to-deep-blue/10 border-b border-white/5">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="w-16 h-16 bg-gold/10 rounded-2xl flex items-center justify-center text-gold mx-auto mb-6">
            <BookOpen className="w-8 h-8" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Start from Zero. Trade with Knowledge.</h2>
          <p className="text-gray-400 text-lg mb-10 max-w-2xl mx-auto">
            Learn forex basics, understand market structure, and master risk management before you risk a single dollar.
          </p>
          <button 
            onClick={() => {
              if (onForexBasicsClick) {
                onForexBasicsClick();
              } else {
                window.location.hash = "education";
              }
            }}
            className="inline-flex items-center gap-2 px-8 py-4 bg-white/5 border border-white/10 text-white rounded-xl font-bold hover:bg-white/10 transition-all cursor-pointer"
          >
            👉 Start Learning 
          </button>
        </div>
      </section>

      {/* 7. WHY SESSIONKING */}
      <section className="py-8 px-6 border-b border-white/5">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-10">Why SESSIONKING?</h2>
          <div className="grid sm:grid-cols-2 gap-6 text-left mb-12">
            <div className="p-6 bg-white/5 rounded-xl border border-white/5">
              <div className="text-gold font-bold mb-2">Not prediction-based</div>
              <p className="text-sm text-gray-400">We react to confirmed structure, we don't guess tops or bottoms.</p>
            </div>
            <div className="p-6 bg-white/5 rounded-xl border border-white/5">
              <div className="text-gold font-bold mb-2">Not random signals</div>
              <p className="text-sm text-gray-400">Every signal is backed by multi-timeframe confluence.</p>
            </div>
            <div className="p-6 bg-white/5 rounded-xl border border-white/5">
              <div className="text-gold font-bold mb-2">Built on real market logic</div>
              <p className="text-sm text-gray-400">Utilizes institutional concepts like liquidity sweeps and order blocks.</p>
            </div>
            <div className="p-6 bg-white/5 rounded-xl border border-white/5">
              <div className="text-gold font-bold mb-2">Designed for discipline</div>
              <p className="text-sm text-gray-400">Enforces strict risk management to protect your capital.</p>
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-gold italic">
            "We don't predict the market. We interpret it."
          </div>
        </div>
      </section>

      {/* 9. PRICING PREVIEW */}
      <section className="py-8 px-6 bg-black/50 border-b border-white/5">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Simple Pricing</h2>
            <p className="text-gray-400">Choose the plan that fits your trading journey.</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Plan */}
            <div className="glass-card p-8 border border-white/10 flex flex-col">
              <h3 className="text-xl font-bold text-white mb-2">FREE PLAN</h3>
              <div className="text-3xl font-bold text-white mb-6">$0<span className="text-sm text-gray-500 font-normal">/mo</span></div>
              <ul className="space-y-4 mb-8 flex-grow">
                <li className="flex items-center gap-3 text-gray-400 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-gray-500" /> Limited signals
                </li>
                <li className="flex items-center gap-3 text-gray-400 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-gray-500" /> Basic access
                </li>
                <li className="flex items-center gap-3 text-gray-400 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-gray-500" /> Educational content
                </li>
              </ul>
              {!user && (
                <button 
                  onClick={onLoginClick}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-colors"
                >
                  Sign Up Free
                </button>
              )}
            </div>

            {/* Pro Plan */}
            <div className="glass-card p-8 border border-gold/50 relative flex flex-col">
              <div className="absolute top-0 right-0 bg-gold text-matte-black text-xs font-bold px-3 py-1 rounded-bl-lg uppercase tracking-widest">
                Recommended
              </div>
              <h3 className="text-xl font-bold text-gold mb-2 flex items-center gap-2">PRO PLAN </h3>
              <div className="text-3xl font-bold text-white mb-6">$49<span className="text-sm text-gray-500 font-normal">/mo</span></div>
              <ul className="space-y-4 mb-8 flex-grow">
                <li className="flex items-center gap-3 text-gray-300 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-gold" /> Full signal access
                </li>
                <li className="flex items-center gap-3 text-gray-300 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-gold" /> Advanced analytics
                </li>
                <li className="flex items-center gap-3 text-gray-300 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-gold" /> Priority updates
                </li>
                <li className="flex items-center gap-3 text-gray-300 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-gold" /> Risk management tools
                </li>
              </ul>
              <button className="w-full py-3 bg-gold hover:bg-gold/90 text-matte-black rounded-xl font-bold transition-colors flex items-center justify-center gap-2">
                👉 Upgrade to Pro
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 10. FINAL CTA */}
      <section className="py-8 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gold/10 via-matte-black to-matte-black pointer-events-none" />
        <div className="container mx-auto max-w-3xl relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-10 tracking-tight">Ready to Trade Smarter?</h2>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button 
              onClick={onEnterEngine}
              className="px-8 py-4 bg-gold text-matte-black rounded-xl font-bold hover:bg-gold/90 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(212,175,55,0.2)]"
            >
              Enter Signal Engine 
            </button>
            {!user && (
              <button 
                onClick={onLoginClick}
                className="px-8 py-4 bg-white/5 border border-white/10 text-white rounded-xl font-bold hover:bg-white/10 transition-all"
              >
                Create Free Account
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 8. RISK WARNING */}
      <section className="py-8 px-6 border-t border-white/5 bg-black/80">
        <div className="container mx-auto max-w-4xl text-center">
          <ShieldAlert className="w-8 h-8 text-red-500/50 mx-auto mb-4" />
          <p className="text-xs md:text-sm text-gray-500 leading-relaxed">
            <strong>Professional Risk Warning:</strong> Trading involves financial risk. No system guarantees profit. SESSIONKING focuses on probability and disciplined execution. Never risk money you cannot afford to lose.
          </p>
        </div>
      </section>
    </div>
  );
}
