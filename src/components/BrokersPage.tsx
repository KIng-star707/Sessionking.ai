import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Landmark, ShieldCheck, ExternalLink, Award, ArrowLeft, Star, TrendingUp, CheckCircle, Clock } from "lucide-react";
import { cn } from "../lib/utils";

const BROKERS = [
  {
    name: "HFM",
    type: "STP/ECN",
    regulations: ["FCA", "CySEC", "FSCA", "FSC"],
    spreads: "From 0.0 pips",
    leverage: "Up to 1:2000",
    link: "https://www.hfm.com/sv/en/?refid=30525241",
    isRecommended: true,
    minDeposit: "$5",
    executionSpeed: "< 40ms",
    platforms: ["MT4", "MT5", "HFM App"],
    description: "HFM (formerly HotForex) is a multi-asset broker providing advanced trading tools, high leverage options, and zero-spread accounts for algorithmic and high-volume traders.",
    pros: ["Zero spread accounts available", "High leverage up to 1:2000", "Wide range of account types", "Excellent mobile app"],
    cons: ["Withdrawal fees on certain methods", "US clients not accepted"]
  },
  {
    name: "Exness",
    type: "STP/ECN",
    regulations: ["FCA", "CySEC", "FSA", "FSC"],
    spreads: "From 0.0 pips",
    leverage: "Unlimited",
    link: "https://one.exnessonelink.com/a/dh15iihq1v",
    isRecommended: true,
    minDeposit: "$10",
    executionSpeed: "< 25ms",
    platforms: ["MT4", "MT5", "WebTerminal", "Exness Trade App"],
    description: "Exness is a premium multi-asset broker known for its ultra-low spreads, immediate execution, and unlimited leverage on specific accounts. It boasts a vast global presence and is highly regulated.",
    pros: ["Instant withdrawals", "Unlimited leverage options", "Raw spreads from 0.0 pips", "Excellent mobile app"],
    cons: ["Not available to US clients", "Complex account tiers for beginners"]
  },
  {
    name: "Market4you",
    type: "STP/ECN",
    regulations: ["BVI FSC"],
    spreads: "From 0.1 pips",
    leverage: "Up to 1:4000",
    link: "https://www.markets4you.online/?affid=xw9kuam",
    isRecommended: true,
    minDeposit: "$1",
    executionSpeed: "< 50ms",
    platforms: ["MT4", "Markets4you WebTrader", "Mobile App"],
    description: "Market4you offers a competitive trading environment focused on accessibility and flexibility. With very high leverage and micro-account possibilities, it caters to both beginners and high-frequency traders.",
    pros: ["Very high leverage", "Cent accounts available", "Low minimum deposit", "Copy trading features"],
    cons: ["Offshore regulation (BVI)", "MT5 not available"]
  },
  {
    name: "IC Markets",
    type: "ECN Broker",
    regulations: ["ASIC", "CySEC", "FSA"],
    spreads: "From 0.0 pips",
    leverage: "Up to 1:500",
    link: "#",
    isRecommended: true,
    minDeposit: "$200",
    executionSpeed: "< 40ms",
    platforms: ["MT4", "MT5", "cTrader"],
    description: "IC Markets is one of the world's leading true ECN brokers. It provides exceptional liquidity, incredibly tight spreads, and is widely favored by algorithmic traders and scalpers.",
    pros: ["True ECN environment", "Extremely tight spreads", "Excellent liquidity", "Supports cTrader"],
    cons: ["Higher minimum deposit", "Customer support can be slow during peak hours"]
  },
  {
    name: "Pepperstone",
    type: "STP/ECN",
    regulations: ["FCA", "ASIC", "BaFin"],
    spreads: "Institutional Grade",
    leverage: "Up to 1:500",
    link: "#",
    isRecommended: true,
    minDeposit: "$200",
    executionSpeed: "< 30ms",
    platforms: ["MT4", "MT5", "cTrader", "TradingView"],
    description: "Pepperstone is an award-winning broker recognized for its outstanding customer service, ultra-fast execution, and seamless integration with advanced charting platforms like TradingView.",
    pros: ["TradingView integration", "Award-winning support", "Fast execution speeds", "Wide range of instruments"],
    cons: ["Slightly higher non-trading fees", "No proprietary platform"]
  },
  {
    name: "OANDA",
    type: "Market Maker",
    regulations: ["NFA", "FCA", "ASIC"],
    spreads: "Competitive",
    leverage: "Up to 1:50",
    link: "#",
    isRecommended: false,
    minDeposit: "$0",
    executionSpeed: "< 60ms",
    platforms: ["OANDA Trade", "MT4", "TradingView"],
    description: "OANDA is a deeply established, highly trusted broker with a strong presence in regions with strict regulatory environments like the US. It offers reliable execution and excellent market analysis tools.",
    pros: ["US clients accepted (NFA regulated)", "No minimum deposit", "Strong proprietary platform", "Excellent API access"],
    cons: ["Lower leverage limits", "Market maker model may not suit pure scalpers"]
  },
  {
    name: "XM",
    type: "Market Maker / STP",
    regulations: ["CySEC", "ASIC", "FSC"],
    spreads: "From 0.6 pips",
    leverage: "Up to 1:1000",
    link: "https://www.xmglobal.com/referral?token=dhfxPgdnJJYGlMQfB0V3cQ",
    isRecommended: false,
    minDeposit: "$5",
    executionSpeed: "< 50ms",
    platforms: ["MT4", "MT5", "XM App"],
    description: "XM is a globally recognized broker offering a wide range of trading instruments, low minimum deposits, and outstanding educational resources. It has strict no-requotes and no-rejections policies.",
    pros: ["Extensive educational materials", "Low minimum deposit", "No-requotes policy", "Bonuses and promotions available"],
    cons: ["Inactivity fee applies", "Spreads can widen during news events"]
  }
];

export default function BrokersPage() {
  const [selectedBroker, setSelectedBroker] = useState<typeof BROKERS[0] | null>(null);

  if (selectedBroker) {
    return (
      <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-8 pb-8 sm:pt-16 sm:pb-12">
        <button 
          onClick={() => setSelectedBroker(null)}
          className="mb-6 sm:mb-8 flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" /> Back to Brokers
        </button>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card overflow-hidden"
        >
          <div className="p-6 sm:p-12 border-b border-white/5 bg-gradient-to-br from-white/5 to-transparent flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                <h1 className="text-2xl sm:text-4xl font-bold">{selectedBroker.name}</h1>
                {selectedBroker.isRecommended && (
                  <span className="bg-gold/20 px-2.5 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-bold text-gold uppercase tracking-widest rounded-full flex items-center gap-1">
                    <Award className="w-3 h-3" /> {selectedBroker.name === BROKERS[0].name ? "Most Recommended" : "Recommended"}
                  </span>
                )}
              </div>
              <p className="text-gold font-mono uppercase tracking-widest text-xs sm:text-sm">{selectedBroker.type}</p>
            </div>
            
            <a 
              href={selectedBroker.link}
              target="_blank"
              rel="noopener noreferrer"
              className="gold-gradient w-full md:w-auto px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl text-matte-black font-bold flex items-center justify-center gap-2 hover:scale-105 transition-transform text-sm sm:text-base min-h-[44px]"
            >
              Open Account <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5" />
            </a>
          </div>

          <div className="p-6 sm:p-12 grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12">
            <div className="md:col-span-2 space-y-8">
              <section>
                <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-gray-400" /> Overview
                </h3>
                <p className="text-gray-400 text-sm sm:text-base leading-relaxed">
                  {selectedBroker.description}
                </p>
              </section>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                <div className="bg-white/5 border border-white/10 rounded-xl p-5 sm:p-6">
                  <h4 className="text-green-400 font-bold mb-4 uppercase tracking-widest text-xs flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> Advantages
                  </h4>
                  <ul className="space-y-3">
                    {selectedBroker.pros.map((pro, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-gray-300">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" /> {pro}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="bg-white/5 border border-white/10 rounded-xl p-5 sm:p-6">
                  <h4 className="text-red-400 font-bold mb-4 uppercase tracking-widest text-xs flex items-center gap-2">
                    <Award className="w-4 h-4" /> Considerations
                  </h4>
                  <ul className="space-y-3">
                    {selectedBroker.cons.map((con, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-gray-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" /> {con}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-black/40 border border-white/10 rounded-xl p-5 sm:p-6">
                <h3 className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 sm:mb-6">Key Metrics</h3>
                
                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Regulation</div>
                    <div className="font-bold flex flex-wrap gap-1.5 sm:gap-2">
                      {selectedBroker.regulations.map((reg, r) => (
                        <span key={r} className="bg-white/10 px-2 py-0.5 rounded text-xs sm:text-sm">{reg}</span>
                      ))}
                    </div>
                  </div>
                  <hr className="border-white/5" />
                  
                  <div className="flex justify-between items-center">
                    <div className="text-xs text-gray-500">Min Deposit</div>
                    <div className="font-bold text-sm sm:text-base">{selectedBroker.minDeposit}</div>
                  </div>
                  <hr className="border-white/5" />
                  
                  <div className="flex justify-between items-center">
                    <div className="text-xs text-gray-500">Spreads</div>
                    <div className="font-bold text-sm sm:text-base">{selectedBroker.spreads}</div>
                  </div>
                  <hr className="border-white/5" />
                  
                  <div className="flex justify-between items-center">
                    <div className="text-xs text-gray-500">Max Leverage</div>
                    <div className="font-bold text-sm sm:text-base">{selectedBroker.leverage}</div>
                  </div>
                  <hr className="border-white/5" />
                  
                  <div className="flex justify-between items-center">
                    <div className="text-xs text-gray-500">Execution</div>
                    <div className="font-bold flex items-center gap-1 text-green-400 text-sm sm:text-base">
                      <Clock className="w-3.5 h-3.5" /> {selectedBroker.executionSpeed}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-black/40 border border-white/10 rounded-xl p-5 sm:p-6">
                <h3 className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-widest mb-3 sm:mb-4">Platforms Supported</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedBroker.platforms.map((plat, p) => (
                    <span key={p} className="bg-gold/10 text-gold border border-gold/20 px-2.5 py-1 rounded-full text-xs font-bold">
                      {plat}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-8 pb-8 sm:pt-16 sm:pb-12 flex flex-col">
      <header className="mb-10 sm:mb-16 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-xs sm:text-sm font-medium mb-4"
        >
          <Landmark className="w-4 h-4" /> Regulated Partner Network
        </motion.div>
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 tracking-tight">Institutional <span className="gold-text">Brokers</span></h1>
        <p className="text-sm sm:text-lg text-gray-400 max-w-2xl mx-auto px-2">
          We only recommend regulated, high-liquidity brokers. Connect your account for seamless execution.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 max-w-6xl mx-auto mb-10 sm:mb-12 w-full">
        {BROKERS.map((broker, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={cn(
              "glass-card p-6 sm:p-8 flex flex-col relative overflow-hidden group cursor-pointer hover:border-gold/30 transition-colors",
              broker.isRecommended ? "border-white/10" : "border-white/5"
            )}
            onClick={() => setSelectedBroker(broker)}
          >
            {broker.isRecommended && (
              <div className="absolute top-0 right-0 bg-gold/20 px-3 py-1 text-[10px] font-bold text-gold uppercase tracking-widest rounded-bl-lg flex items-center gap-1">
                <Award className="w-3 h-3" /> {i === 0 ? "Most Recommended" : "Top Pick"}
              </div>
            )}

            <h3 className="text-xl sm:text-2xl font-bold mb-2 group-hover:text-gold transition-colors">{broker.name}</h3>
            <p className="text-xs text-gray-400 font-mono mb-6 uppercase tracking-widest">{broker.type}</p>

            <div className="space-y-4 mb-6 sm:mb-8 flex-grow">
              <div className="flex justify-between text-xs sm:text-sm items-center">
                <span className="text-gray-500 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Spreads</span>
                <span className="text-white font-bold bg-white/10 px-2 py-1 rounded">{broker.spreads}</span>
              </div>
              <div className="flex justify-between text-xs sm:text-sm items-center">
                <span className="text-gray-500 flex items-center gap-2"><Clock className="w-4 h-4" /> Execution</span>
                <span className="text-green-400 font-bold">{broker.executionSpeed}</span>
              </div>
            </div>

            <button 
              className="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 group-hover:bg-gold/10 group-hover:text-gold transition-all min-h-[44px]"
            >
              View Full Details
            </button>
          </motion.div>
        ))}
      </div>

      <div className="glass-card p-6 sm:p-10 border-red-900/20 bg-red-500/5 max-w-6xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
          <ShieldCheck className="w-8 h-8 sm:w-10 sm:h-10 text-red-500 flex-shrink-0" />
          <div>
            <h3 className="text-lg sm:text-xl font-bold mb-2 text-white">Broker Safety Warning</h3>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
              SESSIONKING does not hold your funds. Your capital stays with your chosen broker. 
              Always ensure you are using a regulated entity in your jurisdiction. 
              We earn commissions from some partners, which helps keep our base intelligence free.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
