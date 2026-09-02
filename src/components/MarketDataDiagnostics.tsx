import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Activity, 
  Radio, 
  ShieldCheck, 
  AlertTriangle, 
  RefreshCw, 
  Clock, 
  Layers, 
  Database, 
  TrendingUp, 
  CheckCircle2, 
  XCircle,
  HelpCircle,
  BarChart2,
  Cpu,
  ArrowRightLeft
} from "lucide-react";
import { 
  getAllCentralMarketStates, 
  getMarketDiagnostics, 
  MarketDiagnostics, 
  MarketState,
  calculatePipSpread,
  normalizePairSymbol
} from "../services/marketDataService";
import { cn } from "../lib/utils";

export default function MarketDataDiagnostics() {
  const [diagnostics, setDiagnostics] = useState<MarketDiagnostics | null>(null);
  const [marketStates, setMarketStates] = useState<Record<string, MarketState>>({});
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  
  // Broker comparison state
  const [selectedPair, setSelectedPair] = useState<string>("EUR/USD");
  const [brokerBid, setBrokerBid] = useState<string>("");
  const [brokerAsk, setBrokerAsk] = useState<string>("");
  const [brokerName, setBrokerName] = useState<string>("MetaTrader 5 / IC Markets");

  const refreshTelemetry = async () => {
    try {
      const res = await fetch("/api/market-diagnostics");
      if (res.ok) {
        const json = await res.json();
        if (json.diagnostics) {
          setDiagnostics(json.diagnostics);
          if (json.diagnostics.states) {
            setMarketStates(json.diagnostics.states);
          }
        }
      } else {
        // Fallback local memory
        setDiagnostics(getMarketDiagnostics());
        setMarketStates(getAllCentralMarketStates());
      }
      setLastRefreshed(new Date());
    } catch (e) {
      setDiagnostics(getMarketDiagnostics());
      setMarketStates(getAllCentralMarketStates());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshTelemetry();
    const interval = setInterval(refreshTelemetry, 2000);
    return () => clearInterval(interval);
  }, []);

  const pairsList = Object.keys(marketStates);
  const currentPairState = marketStates[normalizePairSymbol(selectedPair)];

  // Broker Delta Calculation
  let bidDeltaPips = 0;
  let askDeltaPips = 0;
  let brokerSpreadPips = 0;
  const numBrokerBid = parseFloat(brokerBid);
  const numBrokerAsk = parseFloat(brokerAsk);

  if (currentPairState && !isNaN(numBrokerBid) && numBrokerBid > 0) {
    const diff = numBrokerBid - currentPairState.bid;
    let mult = selectedPair.includes('JPY') ? 100 : 10000;
    if (selectedPair.includes('XAU') || selectedPair.includes('XAG')) mult = 10;
    if (selectedPair.includes('BTC') || selectedPair.includes('ETH')) mult = 1;
    bidDeltaPips = Math.round(diff * mult * 10) / 10;
  }

  if (currentPairState && !isNaN(numBrokerAsk) && numBrokerAsk > 0) {
    const diff = numBrokerAsk - currentPairState.ask;
    let mult = selectedPair.includes('JPY') ? 100 : 10000;
    if (selectedPair.includes('XAU') || selectedPair.includes('XAG')) mult = 10;
    if (selectedPair.includes('BTC') || selectedPair.includes('ETH')) mult = 1;
    askDeltaPips = Math.round(diff * mult * 10) / 10;
  }

  if (!isNaN(numBrokerBid) && !isNaN(numBrokerAsk) && numBrokerAsk > numBrokerBid) {
    brokerSpreadPips = calculatePipSpread(selectedPair, numBrokerBid, numBrokerAsk);
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-matte-dark/80 backdrop-blur-md border border-white/10 rounded-2xl p-6 relative overflow-hidden shadow-2xl">
        <div className="absolute right-0 top-0 w-96 h-96 bg-gold/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="p-2 rounded-xl bg-gold/10 border border-gold/30 text-gold">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-white font-mono tracking-tight">
                Market Data & Price Integrity Engine
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono font-bold">
                ZERO SYNTHETIC TICKS
              </span>
            </div>
            <p className="text-xs text-gray-400 font-mono">
              Single Authoritative State Hub • Monotonic Packet Sequencing • Strict Stale Guard Protection
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={refreshTelemetry}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 text-xs font-mono flex items-center gap-2 transition-all shadow-sm"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 text-gold", loading && "animate-spin")} />
              Sync Stream
            </button>
            <div className="text-[11px] font-mono text-gray-400 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5">
              Refreshed: {lastRefreshed.toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>

      {/* Top Telemetry KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-matte-dark/60 border border-white/5 p-4 rounded-xl">
          <div className="flex items-center justify-between text-gray-400 mb-1">
            <span className="text-[11px] font-mono">Total Packets</span>
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <p className="text-lg font-bold text-white font-mono">
            {diagnostics?.totalUpdates?.toLocaleString() || 0}
          </p>
          <span className="text-[10px] text-gray-400 font-mono">Real Ingested Ticks</span>
        </div>

        <div className="bg-matte-dark/60 border border-white/5 p-4 rounded-xl">
          <div className="flex items-center justify-between text-gray-400 mb-1">
            <span className="text-[11px] font-mono">Active Symbols</span>
            <Database className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <p className="text-lg font-bold text-emerald-400 font-mono">
            {diagnostics?.activePairsCount || Object.keys(marketStates).length}
          </p>
          <span className="text-[10px] text-gray-400 font-mono">Synchronized Pairs</span>
        </div>

        <div className="bg-matte-dark/60 border border-white/5 p-4 rounded-xl">
          <div className="flex items-center justify-between text-gray-400 mb-1">
            <span className="text-[11px] font-mono">Out-of-Order Drop</span>
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <p className="text-lg font-bold text-blue-400 font-mono">
            {diagnostics?.rejectedOutdatedCount || 0}
          </p>
          <span className="text-[10px] text-gray-400 font-mono">Sequenced & Guarded</span>
        </div>

        <div className="bg-matte-dark/60 border border-white/5 p-4 rounded-xl">
          <div className="flex items-center justify-between text-gray-400 mb-1">
            <span className="text-[11px] font-mono">Anomaly Rejected</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <p className="text-lg font-bold text-amber-400 font-mono">
            {diagnostics?.rejectedAnomalyCount || 0}
          </p>
          <span className="text-[10px] text-gray-400 font-mono">Spike Filters Active</span>
        </div>

        <div className="bg-matte-dark/60 border border-white/5 p-4 rounded-xl">
          <div className="flex items-center justify-between text-gray-400 mb-1">
            <span className="text-[11px] font-mono">API Errors</span>
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <p className="text-lg font-bold text-rose-400 font-mono">
            {diagnostics?.errorCount || 0}
          </p>
          <span className="text-[10px] text-gray-400 font-mono">Upstream Exceptions</span>
        </div>

        <div className="bg-matte-dark/60 border border-white/5 p-4 rounded-xl">
          <div className="flex items-center justify-between text-gray-400 mb-1">
            <span className="text-[11px] font-mono">Provider Sources</span>
            <Layers className="w-3.5 h-3.5 text-gold" />
          </div>
          <p className="text-lg font-bold text-gold font-mono">
            {Object.keys(diagnostics?.sourceCounts || {}).length || 3}
          </p>
          <span className="text-[10px] text-gray-400 font-mono">FCS / Interbank / Crypto</span>
        </div>
      </div>

      {/* Broker Live Comparison Tool */}
      <div className="bg-matte-dark/70 border border-gold/20 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-gold/10 text-gold border border-gold/30">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white font-mono">
                Live Broker Comparison & Delta Diagnostic Tool
              </h2>
              <p className="text-[11px] text-gray-400 font-mono">
                Compare SESSIONKING institutional quotes with your MT4 / MT5 broker in real-time
              </p>
            </div>
          </div>
          <span className="text-[10px] text-gold font-mono border border-gold/30 px-2.5 py-0.5 rounded-full bg-gold/5">
            Non-Manipulated Reference
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="text-[11px] font-mono text-gray-400 mb-1 block">Select Pair</label>
            <select
              value={selectedPair}
              onChange={(e) => setSelectedPair(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-gold/50"
            >
              {pairsList.length > 0 ? pairsList.map((p) => (
                <option key={p} value={p}>{p}</option>
              )) : (
                <option value="EUR/USD">EUR/USD</option>
              )}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-mono text-gray-400 mb-1 block">Broker Name</label>
            <input
              type="text"
              value={brokerName}
              onChange={(e) => setBrokerName(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-gold/50"
              placeholder="e.g. Exness / IC Markets / FTMO"
            />
          </div>

          <div>
            <label className="text-[11px] font-mono text-gray-400 mb-1 block">Your Broker Bid</label>
            <input
              type="number"
              step="any"
              value={brokerBid}
              onChange={(e) => setBrokerBid(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-gold/50"
              placeholder={currentPairState ? String(currentPairState.bid) : "1.08500"}
            />
          </div>

          <div>
            <label className="text-[11px] font-mono text-gray-400 mb-1 block">Your Broker Ask</label>
            <input
              type="number"
              step="any"
              value={brokerAsk}
              onChange={(e) => setBrokerAsk(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-gold/50"
              placeholder={currentPairState ? String(currentPairState.ask) : "1.08512"}
            />
          </div>
        </div>

        {/* Comparison Result Cards */}
        {currentPairState && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-black/40 rounded-xl border border-white/5">
            <div className="space-y-1 font-mono">
              <span className="text-[10px] text-gray-400">SESSIONKING Reference Quote</span>
              <div className="text-xs text-white">
                Bid: <span className="text-emerald-400 font-bold">{currentPairState.bid}</span> | Ask: <span className="text-rose-400 font-bold">{currentPairState.ask}</span>
              </div>
              <div className="text-[10px] text-gray-400">
                Spread: {currentPairState.spreadPips} pips • Source: {currentPairState.source}
              </div>
            </div>

            <div className="space-y-1 font-mono">
              <span className="text-[10px] text-gray-400">{brokerName} Quote</span>
              <div className="text-xs text-white">
                Bid: <span className="text-emerald-400 font-bold">{numBrokerBid || "—"}</span> | Ask: <span className="text-rose-400 font-bold">{numBrokerAsk || "—"}</span>
              </div>
              <div className="text-[10px] text-gray-400">
                Spread: {brokerSpreadPips ? `${brokerSpreadPips} pips` : "—"}
              </div>
            </div>

            <div className="space-y-1 font-mono">
              <span className="text-[10px] text-gray-400">Calculated Differential</span>
              <div className="text-xs text-white flex items-center gap-3">
                <span>Bid Delta: <strong className={bidDeltaPips === 0 ? "text-gray-300" : Math.abs(bidDeltaPips) <= 1.0 ? "text-emerald-400" : "text-amber-400"}>{bidDeltaPips > 0 ? `+${bidDeltaPips}` : bidDeltaPips} pips</strong></span>
                <span>Ask Delta: <strong className={askDeltaPips === 0 ? "text-gray-300" : Math.abs(askDeltaPips) <= 1.0 ? "text-emerald-400" : "text-amber-400"}>{askDeltaPips > 0 ? `+${askDeltaPips}` : askDeltaPips} pips</strong></span>
              </div>
              <div className="text-[10px] text-gray-400">
                {Math.abs(bidDeltaPips) <= 1.2 ? "✅ Normal broker spread mark-up difference" : "⚠️ Noticeable broker LP routing spread variance"}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Authoritative Single Central Market State Table */}
      <div className="bg-matte-dark/80 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-gold" />
            <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
              Authoritative Central Market States ({pairsList.length} Symbols)
            </h2>
          </div>
          <span className="text-[11px] font-mono text-gray-400">
            Real-Time Ingestion & Sequence Telemetry
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02] text-gray-400 text-[10px] uppercase">
                <th className="py-3 px-4">Symbol</th>
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4">Bid</th>
                <th className="py-3 px-4">Ask</th>
                <th className="py-3 px-4">Mid Price</th>
                <th className="py-3 px-4">Spread</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Freshness</th>
                <th className="py-3 px-4">Seq #</th>
                <th className="py-3 px-4">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {pairsList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-gray-500 font-mono">
                    Warming up central market pipeline...
                  </td>
                </tr>
              ) : (
                pairsList.map((pair) => {
                  const state = marketStates[pair];
                  if (!state) return null;

                  const isStale = state.dataStatus === 'STALE' || state.freshness === 'STALE';
                  const isClosed = state.status === 'MARKET_CLOSED';

                  return (
                    <tr key={pair} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-gold" />
                        {state.symbol}
                      </td>
                      <td className="py-3 px-4 text-gray-400">
                        <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px]">
                          {state.source}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-emerald-400 font-semibold">{state.bid}</td>
                      <td className="py-3 px-4 text-rose-400 font-semibold">{state.ask}</td>
                      <td className="py-3 px-4 text-white font-bold">{state.mid}</td>
                      <td className="py-3 px-4 text-gray-300">{state.spreadPips} pips</td>
                      <td className="py-3 px-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[9px] font-bold border",
                          isClosed 
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                            : isStale
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        )}>
                          {isClosed ? "WEEKEND_LOCK" : state.dataStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn(
                          "text-[10px] font-bold",
                          state.freshness === 'FRESH' ? "text-emerald-400" : "text-amber-400"
                        )}>
                          {state.freshness}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-400 font-mono">#{state.sequenceNumber}</td>
                      <td className="py-3 px-4 text-gray-400">
                        {state.ageMs !== undefined ? `${Math.round(state.ageMs / 1000)}s` : "0s"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
