import React, { useEffect, useState, useMemo, useRef } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import { Activity, AlertCircle, TrendingDown, TrendingUp, RefreshCw, ChevronDown, CheckCircle, Clock, ShieldCheck } from 'lucide-react';
import { marketDataService } from '../lib/marketDataService';

interface LiveAnalysisChartProps {
  pair: string;
  bias?: "Bullish" | "Bearish" | "Neutral";
  technicalLevels?: {
    currentPrice?: number;
    entryPrice?: number;
    stopLoss?: number;
    takeProfit1?: number;
    takeProfit2?: number;
    supportLevel?: number;
    resistanceLevel?: number;
  };
}

const COMMON_INSTRUMENTS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'XAU/USD', 'BTC/USD', 'ETH/USD',
  'USD/CAD', 'AUD/USD', 'USD/CHF', 'GBP/JPY', 'EUR/JPY', 'US30', 'NAS100', 'SPX500'
];

export default function LiveAnalysisChart({ pair: initialPair, bias, technicalLevels }: LiveAnalysisChartProps) {
  // Normalize initial pair fallback
  const cleanInitial = useMemo(() => {
    if (!initialPair || initialPair === 'UNKNOWN' || initialPair === 'UNDEFINED') {
      return 'EUR/USD';
    }
    return initialPair;
  }, [initialPair]);

  const [selectedPair, setSelectedPair] = useState<string>(cleanInitial);
  const [timeframe, setTimeframe] = useState<'5m' | '15m' | '1h' | '4h' | '1d'>('15m');
  const [data, setData] = useState<{ time: string; timestamp: number; price: number; open?: number; high?: number; low?: number }[]>([]);
  const [marketState, setMarketState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync state if parent props change
  useEffect(() => {
    if (initialPair && initialPair !== 'UNKNOWN' && initialPair !== selectedPair) {
      setSelectedPair(initialPair);
    }
  }, [initialPair]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchChartData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await marketDataService.fetchMarketData(selectedPair, timeframe, isManual);
      if (res?.state) {
        setMarketState(res.state);
      }
      if (Array.isArray(res?.data) && res.data.length > 0) {
        const mapped = res.data.map((d: any) => {
          const dateObj = new Date(d.timestamp);
          return {
            time: timeframe === '1d' 
              ? dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' })
              : dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
            timestamp: dateObj.getTime(),
            price: Number(d.close),
            open: Number(d.open),
            high: Number(d.high),
            low: Number(d.low)
          };
        });

        setData(mapped);
        setError(null);
        setLastUpdated(new Date());
      } else if (data.length === 0) {
        setError(`Awaiting live candles for ${selectedPair}`);
      }
    } catch (err: any) {
      if (data.length === 0) {
        setError(`Unable to stream feed for ${selectedPair}`);
      }
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  // Consolidate price polling into MarketDataService: exactly one polling loop per pair with automatic cleanup
  useEffect(() => {
    setLoading(true);

    const unsubscribe = marketDataService.subscribe(
      selectedPair,
      (nextState, candles) => {
        if (nextState) {
          setMarketState(nextState);
        }

        if (Array.isArray(candles) && candles.length > 0) {
          const mapped = candles.map((d: any) => {
            const dateObj = new Date(d.timestamp);
            return {
              time: timeframe === '1d' 
                ? dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' })
                : dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
              timestamp: dateObj.getTime(),
              price: Number(d.close),
              open: Number(d.open),
              high: Number(d.high),
              low: Number(d.low)
            };
          });

          setData(mapped);
          setError(null);
          setLastUpdated(new Date());
        }
        setLoading(false);
      },
      timeframe
    );

    return () => {
      // Proper cleanup: unregisters subscriber and tears down interval when pair has no remaining listeners
      unsubscribe();
    };
  }, [selectedPair, timeframe]);

  // Decimal formatting based on instrument type
  const decimals = useMemo(() => {
    const p = selectedPair.toUpperCase();
    if (p.includes('JPY')) return 3;
    if (p.includes('XAU') || p.includes('XAG') || p.includes('BTC') || p.includes('ETH') || p.includes('US30') || p.includes('NAS100') || p.includes('SPX500')) {
      return 2;
    }
    return 5;
  }, [selectedPair]);

  const currentMid = useMemo(() => {
    if (marketState?.mid && !isNaN(marketState.mid)) return Number(marketState.mid);
    if (data.length > 0) return data[data.length - 1].price;
    return technicalLevels?.currentPrice || 1.0;
  }, [marketState, data, technicalLevels]);

  // Sanity check technical levels so out-of-scale AI hallucinations don't distort Y-axis
  const validTechnicalLevels = useMemo(() => {
    if (!technicalLevels || !currentMid) return null;
    const maxDeviationRatio = selectedPair.includes('BTC') || selectedPair.includes('ETH') ? 0.6 : 0.35;

    const isValidLevel = (val?: number) => {
      if (typeof val !== 'number' || isNaN(val) || !isFinite(val) || val <= 0) return false;
      const deviation = Math.abs(val - currentMid) / currentMid;
      return deviation <= maxDeviationRatio;
    };

    return {
      entryPrice: isValidLevel(technicalLevels.entryPrice) ? technicalLevels.entryPrice : undefined,
      stopLoss: isValidLevel(technicalLevels.stopLoss) ? technicalLevels.stopLoss : undefined,
      takeProfit1: isValidLevel(technicalLevels.takeProfit1) ? technicalLevels.takeProfit1 : undefined,
      takeProfit2: isValidLevel(technicalLevels.takeProfit2) ? technicalLevels.takeProfit2 : undefined,
      supportLevel: isValidLevel(technicalLevels.supportLevel) ? technicalLevels.supportLevel : undefined,
      resistanceLevel: isValidLevel(technicalLevels.resistanceLevel) ? technicalLevels.resistanceLevel : undefined,
    };
  }, [technicalLevels, currentMid, selectedPair]);

  // Calculate domain bounds
  const { minPrice, maxPrice, domainPadding } = useMemo(() => {
    let prices = data.map(d => d.price);
    if (validTechnicalLevels) {
      const lvls = [
        validTechnicalLevels.entryPrice,
        validTechnicalLevels.stopLoss,
        validTechnicalLevels.takeProfit1,
        validTechnicalLevels.takeProfit2,
        validTechnicalLevels.supportLevel,
        validTechnicalLevels.resistanceLevel
      ].filter((v): v is number => typeof v === 'number' && !isNaN(v) && isFinite(v));
      prices = [...prices, ...lvls];
    }
    const valid = prices.filter(p => typeof p === 'number' && !isNaN(p) && isFinite(p));
    const min = valid.length > 0 ? Math.min(...valid) : currentMid * 0.995;
    const max = valid.length > 0 ? Math.max(...valid) : currentMid * 1.005;
    const span = max - min;
    const pad = span > 0 ? span * 0.08 : (currentMid * 0.002 || 0.001);
    return { minPrice: min, maxPrice: max, domainPadding: pad };
  }, [data, validTechnicalLevels, currentMid]);

  const color = bias === "Bullish" ? "#10b981" : bias === "Bearish" ? "#ef4444" : "#f59e0b";

  // Verification correlation insight
  const verificationInsight = useMemo(() => {
    if (!validTechnicalLevels?.entryPrice || !currentMid) {
      return {
        status: "LIVE_ACTIVE",
        message: bias ? `${bias} Bias Active on Institutional Feed` : "Live Price Action Active"
      };
    }

    const entry = validTechnicalLevels.entryPrice;
    const pipsMultiplier = selectedPair.includes('JPY') ? 100 : (selectedPair.includes('XAU') || selectedPair.includes('BTC') ? 1 : 10000);
    const diffPips = Math.round((currentMid - entry) * pipsMultiplier * 10) / 10;

    if (bias === 'Bullish') {
      if (diffPips >= 0) {
        return {
          status: "ALIGNED",
          message: `Price Action Aligned (+${diffPips} pips above entry level)`
        };
      } else {
        return {
          status: "CORRIDOR",
          message: `In Entry Zone (${Math.abs(diffPips)} pips below entry)`
        };
      }
    } else if (bias === 'Bearish') {
      if (diffPips <= 0) {
        return {
          status: "ALIGNED",
          message: `Price Action Aligned (${Math.abs(diffPips)} pips below entry level)`
        };
      } else {
        return {
          status: "CORRIDOR",
          message: `In Retest Corridor (+${diffPips} pips above entry)`
        };
      }
    }

    return {
      status: "NEUTRAL",
      message: `Current Price: ${currentMid.toFixed(decimals)}`
    };
  }, [validTechnicalLevels, currentMid, bias, selectedPair, decimals]);

  return (
    <div className="w-full h-full flex flex-col bg-slate-950/40 rounded-xl p-4 border border-white/5 relative">
      {/* Top Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          {/* Instrument Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white font-mono font-bold text-xs sm:text-sm border border-white/10 transition-colors"
            >
              <span>{selectedPair}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDropdownOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-44 bg-slate-900/95 border border-white/15 rounded-xl shadow-2xl py-1.5 z-50 backdrop-blur-md max-h-56 overflow-y-auto">
                <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                  Select Pair
                </div>
                {COMMON_INSTRUMENTS.map((inst) => (
                  <button
                    key={inst}
                    onClick={() => {
                      setSelectedPair(inst);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 text-xs font-mono transition-colors flex items-center justify-between ${
                      selectedPair === inst ? 'bg-blue-500/20 text-blue-400 font-bold' : 'text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    <span>{inst}</span>
                    {selectedPair === inst && <CheckCircle className="w-3 h-3 text-blue-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Timeframe Selector */}
          <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/5">
            {(['5m', '15m', '1h', '4h', '1d'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase transition-colors ${
                  timeframe === tf ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Live Metrics & Status */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] uppercase font-mono font-bold text-emerald-400 tracking-wider">
                {marketState?.dataStatus || 'LIVE'}
              </span>
              <span className="text-white font-mono font-extrabold text-sm sm:text-base">
                {currentMid.toFixed(decimals)}
              </span>
            </div>
            <div className="text-[10px] font-mono text-gray-400">
              Spread: <span className="text-gray-300 font-bold">{marketState?.spreadPips ? `${marketState.spreadPips} pips` : 'Tight'}</span>
            </div>
          </div>

          <button
            onClick={() => fetchChartData(true)}
            disabled={refreshing}
            title="Refresh Live Data"
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Chart Canvas Area */}
      <div className="flex-1 w-full min-h-[280px] sm:min-h-[320px] relative mt-2">
        {loading && data.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-2 bg-black/20">
            <Activity className="w-7 h-7 text-blue-400 animate-spin" />
            <span className="text-xs font-mono uppercase tracking-widest text-gray-400">
              Synchronizing Live Verification Feed...
            </span>
          </div>
        ) : error && data.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-2 bg-black/20">
            <AlertCircle className="w-6 h-6 text-amber-400" />
            <span className="text-xs text-gray-300">{error}</span>
            <button
              onClick={() => fetchChartData(true)}
              className="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold"
            >
              Reconnect
            </button>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 12, right: 35, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPriceVerification" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                tick={{ fill: '#64748b', fontSize: 10 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
                tickLine={false}
                minTickGap={35}
              />
              <YAxis
                domain={[minPrice - domainPadding, maxPrice + domainPadding]}
                orientation="right"
                tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => typeof val === 'number' && !isNaN(val) ? val.toFixed(decimals) : ''}
                width={selectedPair.includes('US30') || selectedPair.includes('BTC') ? 58 : 50}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload;
                    return (
                      <div className="bg-slate-900/95 border border-white/20 p-2.5 rounded-lg shadow-xl text-xs font-mono">
                        <div className="text-gray-400 text-[10px] mb-1 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-blue-400" /> {item.time}
                        </div>
                        <div className="text-white font-bold text-sm">
                          {Number(item.price).toFixed(decimals)}
                        </div>
                        {item.high && item.low && (
                          <div className="text-[10px] text-gray-400 mt-1 flex gap-2 border-t border-white/5 pt-1">
                            <span>H: {Number(item.high).toFixed(decimals)}</span>
                            <span>L: {Number(item.low).toFixed(decimals)}</span>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={color}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorPriceVerification)"
                isAnimationActive={false}
              />

              {/* Technical Levels Overlay */}
              {validTechnicalLevels?.supportLevel && (
                <ReferenceLine
                  y={validTechnicalLevels.supportLevel}
                  stroke="#10b981"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  label={{ position: 'insideTopLeft', fill: '#10b981', fontSize: 10, fontWeight: 'bold', value: `SUPPORT (${validTechnicalLevels.supportLevel.toFixed(decimals)})` }}
                />
              )}
              {validTechnicalLevels?.resistanceLevel && (
                <ReferenceLine
                  y={validTechnicalLevels.resistanceLevel}
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  label={{ position: 'insideBottomLeft', fill: '#ef4444', fontSize: 10, fontWeight: 'bold', value: `RESISTANCE (${validTechnicalLevels.resistanceLevel.toFixed(decimals)})` }}
                />
              )}
              {validTechnicalLevels?.entryPrice && (
                <ReferenceLine
                  y={validTechnicalLevels.entryPrice}
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeDasharray="3 3"
                  label={{ position: 'insideTopLeft', fill: '#60a5fa', fontSize: 10, fontWeight: 'bold', value: `ENTRY: ${validTechnicalLevels.entryPrice.toFixed(decimals)}` }}
                />
              )}
              {validTechnicalLevels?.stopLoss && (
                <ReferenceLine
                  y={validTechnicalLevels.stopLoss}
                  stroke="#f43f5e"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  label={{ position: 'insideTopLeft', fill: '#f43f5e', fontSize: 10, fontWeight: 'bold', value: `SL: ${validTechnicalLevels.stopLoss.toFixed(decimals)}` }}
                />
              )}
              {validTechnicalLevels?.takeProfit1 && (
                <ReferenceLine
                  y={validTechnicalLevels.takeProfit1}
                  stroke="#34d399"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  label={{ position: 'insideBottomLeft', fill: '#34d399', fontSize: 10, fontWeight: 'bold', value: `TP1: ${validTechnicalLevels.takeProfit1.toFixed(decimals)}` }}
                />
              )}
              {validTechnicalLevels?.takeProfit2 && (
                <ReferenceLine
                  y={validTechnicalLevels.takeProfit2}
                  stroke="#34d399"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  label={{ position: 'insideBottomLeft', fill: '#34d399', fontSize: 10, fontWeight: 'bold', value: `TP2: ${validTechnicalLevels.takeProfit2.toFixed(decimals)}` }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Bottom Verification Footer Strip */}
      <div className="mt-3 pt-2.5 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="text-gray-300 font-mono text-[11px] sm:text-xs">
            {verificationInsight.message}
          </span>
        </div>

        <div className="flex items-center gap-2 text-gray-500 font-mono text-[10px]">
          <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5 uppercase">
            {marketState?.authoritativeSource || 'INSTITUTIONAL FEED'}
          </span>
          <span>
            {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
}
