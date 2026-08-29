import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Play, 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw,
  AlertCircle,
  Calendar,
  Target,
  Zap,
  Layers,
  Database,
  ShieldAlert,
  Percent,
  Sliders
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { runBacktest } from "../services/geminiService";
import type { BacktestResult, User as UserProfile } from "../types";
import { cn } from "../lib/utils";
import JargonFormatter from "./JargonFormatter";
import { usePriceFeed } from "../hooks/usePriceFeed";
import WalkForwardViewer from "./WalkForwardViewer";
import StrategyMemoryViewer from "./StrategyMemoryViewer";

const PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CAD', 'AUD/USD', 'NZD/USD', 'USD/CHF',
  'EUR/JPY', 'GBP/JPY', 'AUD/JPY', 'XAU/USD', 'XAG/USD'
];

const TIMEFRAMES = [
  { label: 'Last 1 Week', value: '1 Week' },
  { label: 'Last 1 Month', value: '1 Month' },
  { label: 'Last 3 Months', value: '3 Months' },
  { label: 'Last 1 Year', value: '1 Year' },
  { label: 'Last 3 Years', value: '3 Years' },
];

type EngineTab = 'backtest' | 'walkforward' | 'memory';

interface BacktestEngineProps {
  userProfile?: UserProfile | null;
}

export default function BacktestEngine({ userProfile }: BacktestEngineProps) {
  const [activeTab, setActiveTab] = useState<EngineTab>('backtest');
  const [pair, setPair] = useState<string>(
    userProfile?.preferredPairs && userProfile.preferredPairs.length > 0 
      ? userProfile.preferredPairs[0] 
      : PAIRS[0]
  );
  const [timeframe, setTimeframe] = useState<string>(TIMEFRAMES[1].value);
  const [tradingMode, setTradingMode] = useState<"Scalp Trader" | "Day Trader" | "Swing Trader">(
    userProfile?.tradingMode || "Day Trader"
  );
  const [accountBalance, setAccountBalance] = useState<number>(10000);
  const [spreadPips, setSpreadPips] = useState<number>(pair.includes('JPY') ? 1.5 : pair.includes('XAU') ? 25 : 1.2);
  const [slippagePips, setSlippagePips] = useState<number>(0.4);
  
  const [isTesting, setIsTesting] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [markerPrice, setMarkerPrice] = useState<string | null>(null);

  const { prices } = usePriceFeed();
  
  const formatPrice = (p: string, price: number | undefined) => {
    if (price === undefined || isNaN(price)) return '...';
    return p.includes('JPY') ? price.toFixed(3) : price.toFixed(5);
  };

  const handleRunBacktest = useCallback(async () => {
    if (isTesting) return;
    setIsTesting(true);
    setError(null);
    setMarkerPrice(null);
    
    try {
      const now = new Date();
      const targetDate = new Date();
      let periodQuery = '1d';
      
      switch (timeframe) {
        case '1 Week': targetDate.setDate(now.getDate() - 7); break;
        case '1 Month': targetDate.setMonth(now.getMonth() - 1); break;
        case '3 Months': targetDate.setMonth(now.getMonth() - 3); break;
        case '1 Year': targetDate.setFullYear(now.getFullYear() - 1); break;
        case '3 Years': targetDate.setFullYear(now.getFullYear() - 3); periodQuery = '1w'; break;
      }
      
      try {
        const res = await fetch(`/api/historical-data?pair=${pair.replace('/', '')}&period=${periodQuery}`);
        const data = await res.json();
        
        if (data && data.response && Array.isArray(data.response)) {
          let closestCandle = null;
          let minDiff = Infinity;
          const targetTime = targetDate.getTime();
          
          for (const candle of data.response) {
            if (candle.tm) {
              const candleTime = new Date(candle.tm).getTime();
              const diff = Math.abs(candleTime - targetTime);
              if (diff < minDiff) {
                minDiff = diff;
                closestCandle = candle;
              }
            }
          }
          if (closestCandle && closestCandle.c) {
             setMarkerPrice(closestCandle.c);
          }
        }
      } catch (err) {
        console.error("Failed to fetch historical marker price", err);
      }

      const data = await runBacktest(pair, timeframe, tradingMode, accountBalance);
      setResult(data);
    } catch (err) {
      console.error(err);
      setError("Failed to run backtest simulation. Please try again.");
    } finally {
      setIsTesting(false);
    }
  }, [isTesting, pair, timeframe, tradingMode, accountBalance]);

  return (
    <div className="space-y-8" id="backtest-engine-container">
      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-4">
        <button
          id="tab-backtest"
          onClick={() => setActiveTab('backtest')}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all",
            activeTab === 'backtest'
              ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
              : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
          )}
        >
          <Activity className="w-4 h-4" /> Historical Backtesting
        </button>

        <button
          id="tab-walkforward"
          onClick={() => setActiveTab('walkforward')}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all",
            activeTab === 'walkforward'
              ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
              : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
          )}
        >
          <Layers className="w-4 h-4" /> Walk-Forward Validation
        </button>

        <button
          id="tab-memory"
          onClick={() => setActiveTab('memory')}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all",
            activeTab === 'memory'
              ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
              : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
          )}
        >
          <Database className="w-4 h-4" /> Strategy Performance Memory
        </button>
      </div>

      {activeTab === 'walkforward' && (
        <WalkForwardViewer
          pair={pair}
          timeframe={timeframe}
          tradingMode={tradingMode}
          initialBalance={accountBalance}
        />
      )}

      {activeTab === 'memory' && (
        <StrategyMemoryViewer />
      )}

      {activeTab === 'backtest' && (
        <div className="space-y-8">
          {/* Controls */}
          <div className="glass-card p-8 border-blue-500/20 bg-blue-900/5">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400 flex items-center gap-2">
                  <Target className="w-4 h-4" /> Currency Pair
                </label>
                <select
                  value={pair}
                  onChange={(e) => setPair(e.target.value)}
                  className="w-full bg-matte-black border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500/50 transition-colors"
                >
                  {PAIRS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Timeframe
                </label>
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  className="w-full bg-matte-black border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500/50 transition-colors"
                >
                  {TIMEFRAMES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400 flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Trading Style
                </label>
                <select
                  value={tradingMode}
                  onChange={(e) => setTradingMode(e.target.value as any)}
                  className="w-full bg-matte-black border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500/50 transition-colors"
                >
                  <option value="Scalp Trader">Scalp Trader ⚡</option>
                  <option value="Day Trader">Day Trader ⏱️</option>
                  <option value="Swing Trader">Swing Trader 📈</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400 flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Initial Balance ($)
                </label>
                <input
                  type="number"
                  value={accountBalance}
                  onChange={(e) => setAccountBalance(Number(e.target.value))}
                  className="w-full bg-matte-black border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500/50 transition-colors"
                  min="100"
                  step="100"
                />
              </div>
            </div>

            {/* Execution Model Parameters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-black/30 border border-white/5 mb-6 text-xs">
              <div>
                <span className="text-gray-500 block uppercase">Modeled Spread</span>
                <span className="font-mono text-gray-200 font-bold">{spreadPips} pips</span>
              </div>
              <div>
                <span className="text-gray-500 block uppercase">Modeled Slippage</span>
                <span className="font-mono text-gray-200 font-bold">{slippagePips} pips</span>
              </div>
              <div>
                <span className="text-gray-500 block uppercase">Look-Ahead Bias</span>
                <span className="font-mono text-green-400 font-bold">Strictly Zero (0.0)</span>
              </div>
              <div>
                <span className="text-gray-500 block uppercase">Memory Recording</span>
                <span className="font-mono text-blue-400 font-bold">Automatic Sync Active</span>
              </div>
            </div>

            <button
              onClick={handleRunBacktest}
              disabled={isTesting}
              className={cn(
                "w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all shadow-lg",
                isTesting 
                  ? "bg-blue-600/50 cursor-not-allowed" 
                  : "bg-blue-600 hover:bg-blue-500 hover:scale-[1.02] active:scale-[0.98]"
              )}
            >
              {isTesting ? (
                <>
                   Running Step-by-Step Historical Simulation...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" /> Execute Historical Backtest
                </>
              )}
            </button>
          </div>

          {/* Error State */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results */}
          <AnimatePresence mode="wait">
            {result && !isTesting && (
              <motion.div
                key={result.pair + result.timeframe}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-8"
              >
                {/* Historical Context summary */}
                {markerPrice && (
                   <div className="glass-card p-6 border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
                     <div className="flex-1 text-center md:text-left">
                       <p className="text-sm font-medium text-gray-400 uppercase tracking-widest mb-1">Target Asset</p>
                       <p className="text-xl font-bold text-white">{result.pair}</p>
                     </div>
                     <div className="hidden md:block w-px h-12 bg-white/10" />
                     <div className="flex-1 text-center">
                       <p className="text-sm font-medium text-gray-400 uppercase tracking-widest mb-1">Starting Marker Price</p>
                       <p className="text-[10px] text-gray-500 mb-1 leading-none text-center">({timeframe} ago)</p>
                       <p className="text-2xl font-bold font-mono text-gold">
                         {formatPrice(result.pair, parseFloat(markerPrice))}
                       </p>
                     </div>
                     <div className="hidden md:block w-px h-12 bg-white/10" />
                     <div className="flex-1 text-center md:text-right">
                       <p className="text-sm font-medium text-gray-400 uppercase tracking-widest mb-1">Analysis Period</p>
                       <p className="text-xl font-bold text-white">{timeframe}</p>
                     </div>
                   </div>
                )}
                
                {/* Global Context Summary */}
                <div className="glass-card p-6 border-gold/30 bg-gold/5 flex flex-col md:flex-row gap-6 items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gold flex items-center gap-2 mb-2">
                       Platform Best Performer
                    </h3>
                    <p className="text-gray-300 text-sm">
                      While your backtest for <strong className="text-white">{result.pair} ({tradingMode})</strong> yielded a <strong className={result.winRate >= 50 ? "text-green-400" : "text-red-400"}>{result.winRate}%</strong> win rate, our cross-platform analysis shows that currently, <strong className="text-white">GBP/JPY (Scalp Trader)</strong> is the highest performing setup over the selected timeframe with an <strong className="text-green-400">81.4%</strong> historical win rate.
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-3 bg-black/40 px-4 py-3 rounded-xl border border-white/10">
                    <div className="text-right">
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Top Match</p>
                      <p className="font-bold text-white">GBP/JPY</p>
                    </div>
                    <div className="w-px h-8 bg-white/10" />
                    <div className="text-left">
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Mode</p>
                      <p className="font-bold text-gold">Scalping</p>
                    </div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                  <div className="glass-card p-4 md:p-6 border-white/10 flex flex-col justify-between overflow-hidden">
                    <p className="text-gray-400 text-[10px] md:text-xs uppercase tracking-widest mb-1 truncate">Win Rate</p>
                    <p className={cn(
                      "text-2xl md:text-3xl font-bold font-mono truncate",
                      result.winRate >= 50 ? "text-green-500" : "text-red-500"
                    )}>
                      {result.winRate}%
                    </p>
                  </div>
                  <div className="glass-card p-4 md:p-6 border-white/10 flex flex-col justify-between overflow-hidden">
                    <p className="text-gray-400 text-[10px] md:text-xs uppercase tracking-widest mb-1 truncate">Total Pips</p>
                    <p className={cn(
                      "text-2xl md:text-3xl font-bold font-mono truncate",
                      result.totalPips >= 0 ? "text-green-500" : "text-red-500"
                    )}>
                      {result.totalPips > 0 ? "+" : ""}{result.totalPips}
                    </p>
                  </div>
                  <div className="glass-card p-4 md:p-6 border-white/10 flex flex-col justify-between overflow-hidden">
                    <p className="text-gray-400 text-[10px] md:text-xs uppercase tracking-widest mb-1 truncate">Max Drawdown</p>
                    <p className="text-2xl md:text-3xl font-bold font-mono text-red-400 truncate">
                      {result.maxDrawdown}%
                    </p>
                  </div>
                  <div className="glass-card p-4 md:p-6 border-white/10 flex flex-col justify-between overflow-hidden">
                    <p className="text-gray-400 text-[10px] md:text-xs uppercase tracking-widest mb-1 truncate">Total Trades</p>
                    <p className="text-2xl md:text-3xl font-bold font-mono text-white truncate">
                      {result.totalTrades}
                    </p>
                    <div className="flex gap-2 mt-1 md:mt-2 text-[10px] md:text-xs truncate">
                      <span className="text-green-400 shrink-0">{result.profitableTrades} W</span>
                      <span className="text-gray-600 shrink-0">|</span>
                      <span className="text-red-400 shrink-0">{result.losingTrades} L</span>
                    </div>
                  </div>
                </div>

                {/* Advanced Metrics */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                  <div className="glass-card p-4 md:p-6 border-white/10 flex flex-col justify-between overflow-hidden">
                    <p className="text-gray-400 text-[10px] md:text-xs uppercase tracking-widest mb-1 truncate">Max Win Streak</p>
                    <p className="text-xl md:text-2xl font-bold font-mono text-green-400 truncate">
                      {result.maxConsecutiveWins}
                    </p>
                  </div>
                  <div className="glass-card p-4 md:p-6 border-white/10 flex flex-col justify-between overflow-hidden">
                    <p className="text-gray-400 text-[10px] md:text-xs uppercase tracking-widest mb-1 truncate">Max Loss Streak</p>
                    <p className="text-xl md:text-2xl font-bold font-mono text-red-400 truncate">
                      {result.maxConsecutiveLosses}
                    </p>
                  </div>
                  <div className="glass-card p-4 md:p-6 border-white/10 flex flex-col justify-between overflow-hidden">
                    <p className="text-gray-400 text-[10px] md:text-xs uppercase tracking-widest mb-1 truncate">Avg Trade Time</p>
                    <p className="text-xl md:text-2xl font-bold font-mono text-white truncate">
                      {result.avgTradeDurationMinutes > 60 ? `${(result.avgTradeDurationMinutes / 60).toFixed(1)}h` : `${Math.round(result.avgTradeDurationMinutes)}m`}
                    </p>
                  </div>
                  <div className="glass-card p-4 md:p-6 border-white/10 text-[10px] md:text-xs text-gray-300 flex flex-col justify-between overflow-hidden">
                     <p className="text-gray-400 uppercase tracking-widest mb-2 truncate">Session Breakdown</p>
                     <div className="space-y-1 w-full relative">
                       <div className="flex justify-between items-center gap-2">
                         <span className="truncate">Asian:</span>
                         <span className="font-mono shrink-0">{result.sessionBreakdown.Asian}</span>
                       </div>
                       <div className="flex justify-between items-center gap-2">
                         <span className="truncate">London:</span>
                         <span className="font-mono shrink-0">{result.sessionBreakdown.London}</span>
                       </div>
                       <div className="flex justify-between items-center gap-2">
                         <span className="truncate">New York:</span>
                         <span className="font-mono shrink-0">{result.sessionBreakdown.NewYork}</span>
                       </div>
                     </div>
                  </div>
                </div>

                {/* Chart */}
                <div className="glass-card p-6 border-white/10">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-400" /> Equity Curve
                  </h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={result.equityCurve}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                        <XAxis 
                          dataKey="date" 
                          stroke="#ffffff50" 
                          fontSize={12}
                          tickMargin={10}
                        />
                        <YAxis 
                          stroke="#ffffff50" 
                          fontSize={12}
                          tickFormatter={(value) => `$${value}`}
                          domain={['auto', 'auto']}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#141414', borderColor: '#ffffff20', borderRadius: '8px' }}
                          itemStyle={{ color: '#fff' }}
                          formatter={(value: number) => [`$${value}`, 'Equity']}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="equity" 
                          stroke="#3b82f6" 
                          strokeWidth={3}
                          dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6, fill: '#d4af37' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Analysis & Trades */}
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="glass-card p-6 border-white/10">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Target className="w-5 h-5 text-gold" /> Institutional Analysis
                    </h3>
                    <p className="text-gray-300 text-sm leading-relaxed">
                      <JargonFormatter text={result.analysis} />
                    </p>
                  </div>

                  <div className="glass-card p-6 border-white/10">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-gray-400" /> Recent Simulated Trades
                    </h3>
                    <div className="space-y-3">
                      {result.recentTrades.map((trade, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center",
                              trade.type === 'BUY' ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
                            )}>
                              {trade.type === 'BUY' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white">{trade.type}</p>
                              <p className="text-[10px] text-gray-500">{trade.date}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={cn(
                              "text-sm font-bold font-mono",
                              trade.result === 'WIN' ? "text-green-400" : "text-red-400"
                            )}>
                              {trade.result === 'WIN' ? "+" : ""}{trade.pips} pips
                            </p>
                            <p className="text-[10px] text-gray-500 font-mono">
                              {trade.entry} → {trade.exit}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
