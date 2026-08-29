import { motion } from "motion/react";

import { 
  BookOpen, Globe, TrendingUp, Clock, ShieldAlert, 
  Activity, Target, AlertTriangle, Zap, BarChart2, 
  Briefcase, ChevronDown, ArrowRight, LineChart,
  DollarSign, Crosshair, AlertCircle
} from "lucide-react";
import { cn } from "../lib/utils";

export default function EducationPage() {
  const scrollToContent = () => {
    document.getElementById('forex-basics')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-matte-black pb-12 w-full">
      {/* 1. HERO SECTION */}
      <section className="relative pt-16 sm:pt-20 pb-8 px-3.5 sm:px-6 text-center border-b border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gold/10 via-matte-black to-matte-black pointer-events-none" />
        <div className="w-full max-w-4xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gold/10 border border-gold/20 text-gold text-xs font-bold uppercase tracking-widest mb-4 sm:mb-6"
          >
            <BookOpen className="w-4 h-4" /> Forex Academy
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-2xl sm:text-4xl md:text-6xl font-bold mb-3 sm:mb-4 tracking-tight text-white"
          >
            Master Forex from <br className="hidden md:block" />
            <span className="gold-text">Foundation to Intelligence</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-sm sm:text-lg md:text-xl text-gray-400 max-w-2xl mx-auto px-2"
          >
            Understand how money flows globally and how to trade with structure, not guesswork.
          </motion.p>
        </div>
      </section>

      <div id="forex-basics" className="w-full max-w-5xl mx-auto px-3.5 sm:px-6 pt-6 space-y-6">
        
        {/* 2. WHAT IS FOREX? */}
        <section className="glass-card p-6 sm:p-8 md:p-10 border-l-4 border-l-blue-500">
          <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="p-2.5 sm:p-3 bg-blue-500/10 rounded-xl text-blue-400"><Globe className="w-5 h-5 sm:w-6 sm:h-6" /></div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">What is Forex?</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-center">
            <div className="space-y-4 text-gray-300 text-xs sm:text-sm">
              <p><strong>Forex</strong> stands for Foreign Exchange Market.</p>
              <ul className="space-y-2 list-disc list-inside text-gray-400">
                <li>The largest financial market globally ($6T+ daily volume).</li>
                <li>Open 24 hours a day, Monday through Friday.</li>
                <li>You trade <strong>Currency Pairs</strong> (buying one currency while selling another).</li>
              </ul>
              <p className="text-xs sm:text-sm mt-4 text-gray-400">Example: <strong className="text-white">EUR/USD</strong> = Euro vs US Dollar</p>
            </div>
            <div className="bg-black/50 border border-white/5 rounded-xl p-4 sm:p-6 font-mono text-center">
              <div className="text-lg sm:text-xl text-white mb-2">[ <span className="text-blue-400">EUR</span> ] / [ <span className="text-green-400">USD</span> ]</div>
              <div className="flex justify-center gap-8 sm:gap-12 text-[10px] sm:text-xs text-gray-500 uppercase tracking-widest">
                <span>Base Currency</span>
                <span>Quote Currency</span>
              </div>
            </div>
          </div>
        </section>

        {/* 3. TYPES OF PAIRS & 4. HOW PROFIT IS MADE */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {/* 3. TYPES OF PAIRS */}
          <section className="glass-card p-6 sm:p-8">
            <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div className="p-2.5 sm:p-3 bg-purple-500/10 rounded-xl text-purple-400"><Briefcase className="w-5 h-5 sm:w-6 sm:h-6" /></div>
              <h2 className="text-lg sm:text-xl font-bold text-white">Types of Pairs</h2>
            </div>
            <div className="space-y-4 sm:space-y-6">
              <div>
                <h3 className="text-white font-bold mb-1 text-sm sm:text-base">Major Pairs</h3>
                <p className="text-xs sm:text-sm text-gray-400">Include the USD and are highly liquid (e.g., EUR/USD, GBP/USD).</p>
              </div>
              <div>
                <h3 className="text-white font-bold mb-1 text-sm sm:text-base">Minor Pairs (Crosses)</h3>
                <p className="text-xs sm:text-sm text-gray-400">Do not include the USD (e.g., EUR/GBP, EUR/JPY).</p>
              </div>
              <div>
                <h3 className="text-white font-bold mb-1 text-sm sm:text-base">Exotic Pairs</h3>
                <p className="text-xs sm:text-sm text-gray-400">Major currency paired with an emerging economy (e.g., USD/NGN, USD/TRY). High volatility and high spreads.</p>
              </div>
            </div>
          </section>

          {/* 4. HOW PROFIT IS MADE (PIPS) */}
          <section className="glass-card p-6 sm:p-8">
            <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div className="p-2.5 sm:p-3 bg-green-500/10 rounded-xl text-green-400"><DollarSign className="w-5 h-5 sm:w-6 sm:h-6" /></div>
              <h2 className="text-lg sm:text-xl font-bold text-white">How Profit is Made (Pips)</h2>
            </div>
            <p className="text-gray-300 text-xs sm:text-sm mb-4 sm:mb-6">A <strong>PIP</strong> (Percentage in Point) is the smallest price move that a given exchange rate makes based on market convention.</p>
            
            <div className="bg-black/50 border border-white/5 rounded-xl p-4 sm:p-6">
              <p className="text-xs sm:text-sm text-gray-400 mb-3 sm:mb-4 uppercase tracking-widest font-bold">Example: EUR/USD Buy</p>
              <div className="flex items-center justify-between font-mono text-base sm:text-lg">
                <span className="text-gray-500">1.10<span className="text-white">00</span></span>
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                <span className="text-gray-500">1.10<span className="text-green-400 font-bold">10</span></span>
              </div>
              <div className="mt-4 text-center text-green-400 font-bold bg-green-400/10 py-2 rounded-lg text-xs sm:text-sm">
                +10 Pips Profit
              </div>
            </div>
          </section>
        </div>

        {/* 5. MARKET STRUCTURE */}
        <section className="glass-card p-8 md:p-10 border-l-4 border-l-gold">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-gold/10 rounded-xl text-gold"><TrendingUp className="w-6 h-6" /></div>
            <h2 className="text-2xl font-bold text-white">Market Structure (Critical)</h2>
          </div>
          <p className="text-gray-300 mb-8">The market never moves in a straight line. It moves in waves. Understanding these waves is the foundation of trading.</p>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-black/40 border border-white/5 rounded-xl p-6">
              <h3 className="text-green-400 font-bold mb-2 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Uptrend</h3>
              <p className="text-sm text-gray-400 mb-4">Price makes Higher Highs (HH) and Higher Lows (HL).</p>
              <div className="font-mono text-green-400/50 text-2xl tracking-[0.5em] text-center py-4">
                ↗ ↗ ↗
              </div>
            </div>
            <div className="bg-black/40 border border-white/5 rounded-xl p-6">
              <h3 className="text-red-400 font-bold mb-2 flex items-center gap-2"><TrendingUp className="w-4 h-4 rotate-90" /> Downtrend</h3>
              <p className="text-sm text-gray-400 mb-4">Price makes Lower Highs (LH) and Lower Lows (LL).</p>
              <div className="font-mono text-red-400/50 text-2xl tracking-[0.5em] text-center py-4">
                ↘ ↘ ↘
              </div>
            </div>
          </div>
          <div className="mt-6 text-center text-gold font-bold uppercase tracking-widest text-sm">
            "The Trend is your friend"
          </div>
        </section>

        {/* 6. TIMEFRAMES & 7. SESSIONS */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* 6. TIMEFRAMES */}
          <section className="glass-card p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400"><Clock className="w-6 h-6" /></div>
              <h2 className="text-xl font-bold text-white">Timeframes Explained</h2>
            </div>
            <p className="text-sm text-gray-400 mb-6">Multiple timeframe analysis is crucial for accurate entries.</p>
            <ul className="space-y-3">
              <li className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="font-bold text-white">M5 (5 Min)</span> <span className="text-sm text-gray-400">Scalping</span>
              </li>
              <li className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="font-bold text-white">M15 (15 Min)</span> <span className="text-sm text-gray-400">Entry precision</span>
              </li>
              <li className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="font-bold text-white">H1 (1 Hour)</span> <span className="text-sm text-gray-400">Intraday trend</span>
              </li>
              <li className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="font-bold text-white">H4 (4 Hour)</span> <span className="text-sm text-gray-400">Strong trend</span>
              </li>
              <li className="flex justify-between items-center">
                <span className="font-bold text-white">D1 (Daily)</span> <span className="text-sm text-gray-400">Market direction</span>
              </li>
            </ul>
          </section>

          {/* 7. MARKET SESSIONS */}
          <section className="glass-card p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-orange-500/10 rounded-xl text-orange-400"><Globe className="w-6 h-6" /></div>
              <h2 className="text-xl font-bold text-white">Market Sessions</h2>
            </div>
            <div className="space-y-4">
              <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                <h3 className="text-white font-bold flex items-center gap-2">🌏 Asian Session</h3>
                <p className="text-sm text-gray-400 mt-1">Generally slow, ranging market.</p>
              </div>
              <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                <h3 className="text-white font-bold flex items-center gap-2">🇬🇧 London Session</h3>
                <p className="text-sm text-gray-400 mt-1">High volatility, establishes daily trends.</p>
              </div>
              <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                <h3 className="text-white font-bold flex items-center gap-2">🇺🇸 New York Session</h3>
                <p className="text-sm text-gray-400 mt-1">Strong moves, high volume.</p>
              </div>
            </div>
            <div className="mt-4 text-sm text-gold font-medium text-center">
              * Overlap (London + NY) = Best trading time
            </div>
          </section>
        </div>

        {/* 8. LIQUIDITY & SMART MONEY */}
        <section className="glass-card p-8 md:p-10 border-l-4 border-l-purple-500">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400"><Zap className="w-6 h-6" /></div>
            <h2 className="text-2xl font-bold text-white">Liquidity & Smart Money</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4 text-gray-300">
              <p><strong>Liquidity</strong> is simply where the money is resting in the market (usually Stop Losses).</p>
              <p>Institutions (banks, hedge funds) need massive liquidity to execute their large orders without causing extreme slippage.</p>
              <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-xl text-purple-300 font-medium text-sm">
                "Retail traders react, institutions move the market."
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white shrink-0">1</div>
                <p className="text-sm text-gray-400">Retail traders place stop losses above/below obvious levels.</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white shrink-0">2</div>
                <p className="text-sm text-gray-400">Institutions push price to trigger these stops (Liquidity Sweep).</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white shrink-0">3</div>
                <p className="text-sm text-gray-400">Market reverses rapidly in the intended direction.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 9. TECHNICAL & 10. FUNDAMENTAL */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* 9. TECHNICAL ANALYSIS */}
          <section className="glass-card p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400"><LineChart className="w-6 h-6" /></div>
              <h2 className="text-xl font-bold text-white">Technical Analysis</h2>
            </div>
            <div className="space-y-4">
              <div className="border-b border-white/5 pb-4">
                <h3 className="text-white font-bold mb-1">RSI (Relative Strength Index)</h3>
                <p className="text-sm text-gray-400">Measures if a pair is overbought (too high) or oversold (too low).</p>
              </div>
              <div className="border-b border-white/5 pb-4">
                <h3 className="text-white font-bold mb-1">MACD</h3>
                <p className="text-sm text-gray-400">Shows momentum and potential trend reversals.</p>
              </div>
              <div>
                <h3 className="text-white font-bold mb-1">Moving Averages</h3>
                <p className="text-sm text-gray-400">Smooths out price data to identify the overall trend direction.</p>
              </div>
            </div>
          </section>

          {/* 10. FUNDAMENTAL ANALYSIS */}
          <section className="glass-card p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-green-500/10 rounded-xl text-green-400"><BarChart2 className="w-6 h-6" /></div>
              <h2 className="text-xl font-bold text-white">Fundamental Analysis</h2>
            </div>
            <p className="text-gray-300 text-sm mb-6">Analyzing economic, social, and political forces that affect currency supply and demand.</p>
            <ul className="space-y-3 mb-6">
              <li className="flex items-center gap-2 text-sm text-gray-400"><div className="w-1.5 h-1.5 rounded-full bg-green-400" /> News impacts market</li>
              <li className="flex items-center gap-2 text-sm text-gray-400"><div className="w-1.5 h-1.5 rounded-full bg-green-400" /> Interest rates</li>
              <li className="flex items-center gap-2 text-sm text-gray-400"><div className="w-1.5 h-1.5 rounded-full bg-green-400" /> Inflation</li>
            </ul>
            <div className="bg-black/40 border border-white/5 rounded-xl p-4 text-sm text-center">
              <span className="text-gray-400">Example:</span><br/>
              <strong className="text-white">High USD interest rate → USD strengthens</strong>
            </div>
          </section>
        </div>

        {/* 11. RISK MANAGEMENT */}
        <section className="glass-card p-8 md:p-10 border-l-4 border-l-red-500 relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-5 pointer-events-none">
            <ShieldAlert className="w-64 h-64 -mt-10 -mr-10" />
          </div>
          <div className="flex items-center gap-4 mb-6 relative z-10">
            <div className="p-3 bg-red-500/10 rounded-xl text-red-500"><ShieldAlert className="w-6 h-6" /></div>
            <h2 className="text-2xl font-bold text-white">Risk Management (Very Important)</h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 mb-8 relative z-10">
            <div className="bg-black/40 border border-white/5 rounded-xl p-6 text-center">
              <div className="text-2xl font-bold text-white mb-2">0.5% - 2%</div>
              <div className="text-sm text-gray-400">Risk per trade</div>
            </div>
            <div className="bg-black/40 border border-white/5 rounded-xl p-6 text-center">
              <div className="text-2xl font-bold text-white mb-2">Mandatory</div>
              <div className="text-sm text-gray-400">Stop Loss usage</div>
            </div>
            <div className="bg-black/40 border border-white/5 rounded-xl p-6 text-center">
              <div className="text-2xl font-bold text-white mb-2">Zero</div>
              <div className="text-sm text-gray-400">Overtrading</div>
            </div>
          </div>
          
          <div className="text-center text-xl md:text-2xl font-bold text-red-400 tracking-tight relative z-10">
            "Survival in trading is more important than profit."
          </div>
        </section>

        {/* 12. MISTAKES & 13. BROKERS */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* 12. COMMON BEGINNER MISTAKES */}
          <section className="glass-card p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-red-500/10 rounded-xl text-red-400"><AlertTriangle className="w-6 h-6" /></div>
              <h2 className="text-xl font-bold text-white">Common Beginner Mistakes</h2>
            </div>
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-gray-300">
                <span className="text-red-500 font-bold">❌</span> Overtrading
              </li>
              <li className="flex items-center gap-3 text-gray-300">
                <span className="text-red-500 font-bold">❌</span> Trading without a Stop Loss
              </li>
              <li className="flex items-center gap-3 text-gray-300">
                <span className="text-red-500 font-bold">❌</span> Following signals blindly without context
              </li>
              <li className="flex items-center gap-3 text-gray-300">
                <span className="text-red-500 font-bold">❌</span> Trading during high-impact news
              </li>
            </ul>
          </section>

          {/* 13. BROKERS & EXECUTION */}
          <section className="glass-card p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400"><Activity className="w-6 h-6" /></div>
              <h2 className="text-xl font-bold text-white">Brokers & Execution</h2>
            </div>
            <div className="space-y-4 mb-6">
              <p className="text-sm text-gray-300"><strong>Broker:</strong> The platform that connects you to the market.</p>
              <p className="text-sm text-gray-300"><strong>Spread:</strong> The difference between the buy and sell price (the broker's fee).</p>
              <p className="text-sm text-gray-300"><strong>Execution Speed:</strong> How fast your order enters the market.</p>
            </div>
            <div className="bg-black/40 border border-white/5 rounded-xl p-4">
              <span className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-2 block">Recommended Examples:</span>
              <div className="text-sm text-white font-medium">Exness, Market4you, IC Markets, Pepperstone</div>
            </div>
          </section>
        </div>

        {/* 14. HOW SESSIONKING HELPS */}
        <section className="glass-card p-8 md:p-10 border border-gold/30 bg-gradient-to-br from-black/80 to-gold/5">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-gold/20 rounded-xl"></div>
            <h2 className="text-2xl font-bold text-white">How SESSIONKING Helps</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-gray-300">
                <div className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center text-gold shrink-0">✓</div>
                Structured signal generation
              </li>
              <li className="flex items-center gap-3 text-gray-300">
                <div className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center text-gold shrink-0">✓</div>
                Multi-timeframe analysis
              </li>
              <li className="flex items-center gap-3 text-gray-300">
                <div className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center text-gold shrink-0">✓</div>
                Risk-controlled entries
              </li>
              <li className="flex items-center gap-3 text-gray-300">
                <div className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center text-gold shrink-0">✓</div>
                Real-time insights
              </li>
              <li className="flex items-center gap-3 text-gray-300">
                <div className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center text-gold shrink-0">✓</div>
                No emotional trading
              </li>
            </ul>
            <div className="text-center p-8 bg-black/50 border border-gold/20 rounded-2xl">
              <div className="text-gray-400 line-through mb-2">Confusion</div>
              <ArrowRight className="w-6 h-6 text-gold mx-auto mb-2" />
              <div className="text-2xl font-bold text-gold">Clarity</div>
            </div>
          </div>
        </section>

        {/* 15. FINAL RISK WARNING */}
        <section className="mt-12 p-6 border border-white/10 rounded-xl bg-white/5 text-center">
          <div className="flex items-center justify-center gap-2 text-gray-400 mb-2">
            <AlertCircle className="w-5 h-5" />
            <h3 className="font-bold uppercase tracking-widest text-sm">Professional Risk Warning</h3>
          </div>
          <p className="text-sm text-gray-500 max-w-3xl mx-auto">
            Trading involves significant risk. No system guarantees profit. Past performance is not indicative of future results. Always verify signals, manage your risk strictly, and trade responsibly.
          </p>
        </section>

      </div>
    </div>
  );
}
