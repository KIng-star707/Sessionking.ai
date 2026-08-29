import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { User as FirebaseUser } from 'firebase/auth';
import { ChevronDown, ChevronUp, Clock, TrendingUp, TrendingDown, Activity, AlertCircle, FolderOpen, Layers, Crosshair, BarChart2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Signal } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface TodaySignalsArchiveProps {
  user: FirebaseUser | null;
}

interface SignalGroup {
  id: string;
  pair: string;
  session: string;
  timestamp: string;
  signals: Signal[];
}

export default function TodaySignalsArchive({ user }: TodaySignalsArchiveProps) {
  const [signalGroups, setSignalGroups] = useState<SignalGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchTodaySignals = async () => {
      try {
        setLoading(true);
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        
        const q = query(
          collection(db, "users", user.uid, "signals"),
          where("timestamp", ">=", startOfToday.toISOString()),
          orderBy("timestamp", "desc")
        );

        const querySnapshot = await getDocs(q);
        const fetchedSignals: Signal[] = [];
        querySnapshot.forEach((doc) => {
          fetchedSignals.push({ id: doc.id, ...doc.data() } as Signal);
        });

        const groups: SignalGroup[] = [];
        fetchedSignals.forEach(signal => {
          const sigTime = new Date(signal.timestamp).getTime();
          const lastGroup = groups.length > 0 ? groups[groups.length - 1] : null;
          
          if (lastGroup && lastGroup.pair === signal.pair) {
            const groupTime = new Date(lastGroup.timestamp).getTime();
            if (Math.abs(groupTime - sigTime) < 15000) { 
              lastGroup.signals.push(signal);
              return;
            }
          }
          
          groups.push({
            id: signal.id || signal.timestamp,
            pair: signal.pair || "UNKNOWN",
            session: signal.session || "UNKNOWN",
            timestamp: signal.timestamp,
            signals: [signal]
          });
        });

        // Ensure each group orders the primary strategies internally to look uniform
        groups.forEach(g => g.signals.reverse());

        setSignalGroups(groups);
      } catch (err: any) {
        console.error("Error fetching signals:", err);
        setError("Failed to load today's signals. Please check your internet connection.");
      } finally {
        setLoading(false);
      }
    };

    fetchTodaySignals();
  }, [user]);

  if (!user) return null;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 glass-card border-red-500/20 flex flex-col items-center justify-center text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (signalGroups.length === 0) {
    return (
      <div className="p-12 glass-card border-white/10 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
          <FolderOpen className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-xl font-bold mb-2">No Archives Today</h3>
        <p className="text-gray-400 max-w-md">
          You haven't generated any signal configurations today. Switch to the Live Signals tab to analyze pairs.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-gold" /> Today's Signal Folders
        </h2>
        <div className="text-sm text-gray-400">
          Batches: <span className="text-white font-bold">{signalGroups.length}</span>
        </div>
      </div>

      <div className="space-y-4">
        {signalGroups.map((group) => {
          const isExpanded = expandedId === group.id;
          const mainSignal = group.signals[0];
          const isBuy = mainSignal.type === 'BUY' || mainSignal.trade_type === 'BUY';
          const isWait = mainSignal.type === 'WAIT' || mainSignal.trade_type === 'WAIT';
          const validSignalsCount = group.signals.filter(s => s.type !== 'WAIT').length;
          
          return (
            <motion.div 
              key={group.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "glass-card overflow-hidden transition-all duration-300 border",
                isExpanded ? "border-gold/30 shadow-[0_0_20px_rgba(212,175,55,0.1)]" : "border-white/10"
              )}
            >
              {/* Folder Header */}
              <button 
                onClick={() => setExpandedId(isExpanded ? null : group.id)}
                className="w-full px-6 py-5 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
              >
                <div className="flex items-center gap-4 sm:gap-6">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-inner flex-shrink-0",
                    isBuy ? "bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30" : 
                    isWait ? "bg-gradient-to-br from-gray-500/20 to-gray-600/10 border border-gray-500/30" : 
                    "bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/30"
                  )}>
                    {isBuy ? <TrendingUp className="w-6 h-6 text-green-400" /> : 
                     isWait ? <Clock className="w-6 h-6 text-gray-400" /> : 
                     <TrendingDown className="w-6 h-6 text-red-400" />}
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-bold text-xl tracking-tight">{group.pair}</span>
                      {!isWait && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/10">
                          <Layers className="w-3 h-3 text-gold" />
                          <span className="text-xs font-bold text-gray-300">{validSignalsCount} Strategies Map</span>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 flex items-center gap-3">
                      <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-gray-500" /> {format(new Date(group.timestamp), 'HH:mm')}</span>
                      <span className="w-1 h-1 rounded-full bg-gray-600" />
                      <span className="text-gold flex items-center gap-1">{group.session} Session</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-5">
                  <div className="hidden sm:block text-right">
                    <div className="text-xs text-gray-400 mb-0.5 uppercase tracking-widest">Base Direction</div>
                    <div className={cn(
                      "font-extrabold text-sm uppercase tracking-wider",
                      isBuy ? "text-green-400" : isWait ? "text-gray-400" : "text-red-400"
                    )}>
                      {mainSignal.type || mainSignal.trade_type}
                    </div>
                  </div>
                  <div className={cn(
                    "p-2 rounded-full border transition-colors",
                    isExpanded ? "bg-gold border-gold text-matte-black" : "bg-black/40 border-white/10 text-gray-400"
                  )}>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </button>

              {/* Expanded Payload Content */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-white/10 bg-black/40 relative overflow-hidden"
                  >
                    {isWait ? (
                      <div className="p-8 text-center">
                        <div className="inline-flex w-12 h-12 rounded-full bg-gray-500/10 items-center justify-center mb-3">
                          <Clock className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-gray-300 max-w-sm mx-auto leading-relaxed">{mainSignal.reason}</p>
                      </div>
                    ) : (
                      <div className="p-4 sm:p-5 flex flex-col gap-4">
                        {group.signals.map((signal, idx) => {
                          const defaultStrategies = ["Trend Following", "Momentum Breakout", "Mean Reversion"];
                          const strategyTitle = (signal.strategy && signal.strategy !== 'N/A' && signal.strategy.trim() !== '') 
                            ? signal.strategy 
                            : defaultStrategies[idx % 3];
                          
                          return (
                          <div key={idx} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 relative transition-colors hover:bg-white/[0.05]">
                            {/* Setup Title Ribbon */}
                            <div className="flex flex-wrap sm:flex-nowrap justify-between items-center gap-3 mb-3 pb-3 border-b border-white/5">
                              <div className="flex items-center gap-2">
                                <div className="px-2.5 py-1 bg-gradient-to-r from-gold/20 to-gold/5 text-gold rounded font-bold text-xs uppercase tracking-widest border border-gold/20">
                                  {strategyTitle}
                                </div>
                                <div className="text-xs text-gray-500 flex items-center gap-1.5 ml-2">
                                  <BarChart2 className="w-3.5 h-3.5 opacity-70" /> 
                                  Conf: <span className="text-white font-mono">{signal.confidence}%</span>
                                </div>
                              </div>
                              <div className={cn(
                                "text-xs font-bold px-2.5 py-1 rounded bg-black/40 border",
                                signal.type === 'BUY' ? "border-green-500/30 text-green-400" : "border-red-500/30 text-red-400"
                              )}>
                                {signal.type} @ {signal.entry || signal.entry_price}
                              </div>
                            </div>
                            
                            {/* Execution Metrics Grid (Compact) */}
                            <div className={cn("grid gap-2 sm:gap-3 mb-3", (signal.takeProfit3 && signal.takeProfit3 !== "N/A" && signal.takeProfit3 !== "0") ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-2 sm:grid-cols-4")}>
                              <div className="bg-black/50 rounded-lg p-2.5 border border-white/5 flex flex-col justify-center">
                                <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                  <Crosshair className="w-3 h-3 text-red-500/70" /> Stop Loss
                                </span>
                                <span className="font-mono text-sm text-red-400 font-bold">{signal.stopLoss || signal.stop_loss || "-"}</span>
                              </div>
                              <div className="bg-black/50 rounded-lg p-2.5 border border-white/5 flex flex-col justify-center">
                                <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5 text-green-500/70">Take Profit 1</span>
                                <span className="font-mono text-sm text-green-400 font-bold">{signal.takeProfit1 || signal.take_profit_1 || "-"}</span>
                              </div>
                              <div className="bg-black/50 rounded-lg p-2.5 border border-white/5 flex flex-col justify-center">
                                <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5 text-green-500/70">Take Profit 2</span>
                                <span className="font-mono text-sm text-green-400 font-bold">{signal.takeProfit2 || signal.take_profit_2 || "-"}</span>
                              </div>
                              {(signal.takeProfit3 && signal.takeProfit3 !== "N/A" && signal.takeProfit3 !== "0") && (
                                <div className="bg-black/50 rounded-lg p-2.5 border border-white/5 flex flex-col justify-center">
                                  <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5 text-green-500/70">Take Profit 3</span>
                                  <span className="font-mono text-sm text-green-400 font-bold">{signal.takeProfit3}</span>
                                </div>
                              )}
                              <div className="bg-black/50 rounded-lg p-2.5 border border-white/5 flex flex-col justify-center">
                                <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5 text-gold/70">Risk / Reward</span>
                                <span className="font-mono text-sm text-gold font-bold">{signal.riskReward && signal.riskReward !== 'N/A' ? signal.riskReward : '1:2+'}</span>
                              </div>
                            </div>

                            {/* Reasoning */}
                            <p className="text-[13px] text-gray-400 leading-relaxed bg-black/20 p-3 rounded-lg border border-white/5">
                              <strong className="text-white font-medium mr-1">Logic:</strong>{signal.reason}
                            </p>
                          </div>
                        )})}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
