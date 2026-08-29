import { useState } from "react";
import { motion } from "motion/react";

import { Brain, Shield, Zap, Info, User, PlayCircle, Layers } from "lucide-react";
import Tutorial from "./Tutorial";

export default function AboutPage() {
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const features = [
    {
      icon: <Brain className="w-6 h-6" />,
      title: "Market Structure",
      desc: "Detects HH/LL, Break of Structure (BOS), and Market Structure Shifts (MSS) across multiple timeframes."
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Liquidity Mapping",
      desc: "Identifies institutional liquidity pools, buy-side/sell-side imbalances, and stop-run zones. The system tracks unmitigated wicks and major session highs/lows to pinpoint where institutional algorithms are likely to hunt for liquidity before expanding."
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "SMC Logic",
      desc: "Utilizes Fair Value Gaps (FVG) and Mitigation Blocks for high-probability entries. Our engine verifies true price delivery by analyzing mitigation sequences and institutional sponsorship behind every structural break."
    },
    {
      icon: <Layers className="w-6 h-6" />,
      title: "Order Blocks",
      desc: "Locates high-probability institutional Order Blocks on higher timeframes. The AI evaluates the strength of these zones based on volume imbalances, subsequent displacement, and proximity to liquidity sweeps."
    },
    {
      icon: <Info className="w-6 h-6" />,
      title: "Risk Engine",
      desc: "Weighted probability scoring model that filters news, volatility cycles, and session awareness."
    }
  ];

  return (
    <div className="container mx-auto px-6 py-20 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <header className="mb-16 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex justify-center mb-6"
          >
            <div className="p-4 bg-gold/10 rounded-2xl border border-gold/20">
              
            </div>
          </motion.div>
          <h1 className="text-5xl font-bold mb-6">About SESSIONKING</h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            SESSIONKING is an elite institutional-grade Adaptive Market Intelligence (AMI) system 
            designed to interpret intention, not just predict price.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-8 mb-20">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass-card p-8 hover:border-gold/30 transition-colors group"
            >
              <div className="w-12 h-12 bg-gold/10 rounded-lg flex items-center justify-center text-gold mb-6 group-hover:scale-110 transition-transform">
                {f.icon}
              </div>
              <h3 className="text-xl font-bold mb-3">{f.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Instructions Banner Relocated from Signal Engine */}
        <div className="mb-20 p-8 bg-blue-900/20 border border-blue-500/30 rounded-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <Info className="w-24 h-24 text-blue-400" />
          </div>
          
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
              <h3 className="text-2xl font-bold text-blue-400 flex items-center gap-2">
                <Info className="w-6 h-6" /> How to use the Signal Engine
              </h3>
              <button 
                onClick={() => setIsTutorialOpen(true)}
                className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20 group"
              >
                <PlayCircle className="w-5 h-5 group-hover:scale-110 transition-transform" /> Start Interactive Tutorial
              </button>
            </div>
            
            <ul className="list-disc list-inside text-gray-300 space-y-3 leading-relaxed">
              <li>Select your preferred trading session (Asian, London, New York, or Overlap).</li>
              <li>Choose a currency pair from the available list for that session.</li>
              <li>Select your Trading Style (Scalp, Day, or Swing) to adjust the engine's parameters.</li>
              <li>Click "Analyze Selected Pair" to generate an institutional-grade market analysis.</li>
              <li><strong className="text-gold">Note:</strong> All premium features and plans are currently unlocked and free for all users until the payment gateway is integrated. Enjoy unlimited access!</li>
            </ul>
          </div>
        </div>

        <Tutorial isOpen={isTutorialOpen} onClose={() => setIsTutorialOpen(false)} />

        

        <div className="mt-12 p-8 glass-card border-red-500/20 bg-red-500/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-red-500/50" />
          <h3 className="text-red-400 font-bold uppercase tracking-widest text-sm mb-2 flex items-center gap-2">
            <Shield className="w-4 h-4" /> Risk Warning
          </h3>
          <p className="text-gray-400 text-sm leading-relaxed">
            Trading involves financial risk. Capital preservation is priority. No system guarantees profit.
          </p>
        </div>

        <footer className="mt-20 text-center text-gray-600 text-xs">
          <p>© 2026 SESSIONKING AMI SYSTEM. ALL RIGHTS RESERVED.</p>
          <p className="mt-2">Institutional Grade Intelligence. Trade Responsibly.</p>
        </footer>
      </div>
    </div>
  );
}
