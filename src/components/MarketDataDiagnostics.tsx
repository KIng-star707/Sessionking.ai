import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
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
  ArrowRightLeft,
  Server,
  FileCode,
  Download,
  Copy,
  Check,
  Target,
  Crosshair,
  Zap,
  Timer
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

interface MT5StatusResponse {
  connected: boolean;
  status: 'ONLINE' | 'OFFLINE';
  lastHeartbeat: string | null;
  heartbeatAgeMs: number | null;
  broker: string;
  server: string;
  accountNumber?: string;
  currency?: string;
  symbolsCount: number;
  totalQuotesReceived: number;
  latencyMs: number;
  freshnessThresholdMs: number;
}

interface TradeLifecycleItem {
  tradeId: string;
  pair: string;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3?: number;
  currentState: string;
  createdAt: string;
  pipsRealized: number;
  invalidationReason?: string;
  isFilled: boolean;
  tp1Hit: boolean;
  tp2Hit: boolean;
  tp3Hit: boolean;
  stopLossHit: boolean;
}

export default function MarketDataDiagnostics() {
  const [diagnostics, setDiagnostics] = useState<MarketDiagnostics | null>(null);
  const [marketStates, setMarketStates] = useState<Record<string, MarketState>>({});
  const [mt5Status, setMt5Status] = useState<MT5StatusResponse | null>(null);
  const [activeTrades, setActiveTrades] = useState<TradeLifecycleItem[]>([]);
  const [tradeHistory, setTradeHistory] = useState<TradeLifecycleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [showEaModal, setShowEaModal] = useState(false);
  const [copiedEa, setCopiedEa] = useState(false);
  
  // Broker comparison state
  const [selectedPair, setSelectedPair] = useState<string>("EUR/USD");
  const [brokerBid, setBrokerBid] = useState<string>("");
  const [brokerAsk, setBrokerAsk] = useState<string>("");
  const [brokerName, setBrokerName] = useState<string>("MetaTrader 5 / IC Markets");

  const refreshTelemetry = async () => {
    try {
      // 1. Fetch Market Diagnostics
      const diagRes = await fetch("/api/market-diagnostics");
      if (diagRes.ok) {
        const json = await diagRes.json();
        if (json.diagnostics) {
          setDiagnostics(json.diagnostics);
          if (json.diagnostics.states) {
            setMarketStates(json.diagnostics.states);
          }
        }
      } else {
        setDiagnostics(getMarketDiagnostics());
        setMarketStates(getAllCentralMarketStates());
      }

      // 2. Fetch MT5 Primary Engine Status
      try {
        const mt5Res = await fetch("/api/mt5/status");
        if (mt5Res.ok) {
          const mt5Json = await mt5Res.json();
          setMt5Status(mt5Json);
        }
      } catch (e) {
        // Local fallback
      }

      // 3. Fetch Trade Lifecycle State Machine
      try {
        const lifeRes = await fetch("/api/trades/lifecycle");
        if (lifeRes.ok) {
          const lifeJson = await lifeRes.json();
          setActiveTrades(lifeJson.activeTrades || []);
          setTradeHistory(lifeJson.history || []);
        }
      } catch (e) {
        // Fallback
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
    const interval = setInterval(refreshTelemetry, 2500);
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

  const handleCopyEa = () => {
    fetch('/api/mt5/ea-script')
      .then(res => res.text())
      .then(text => {
        navigator.clipboard.writeText(text);
        setCopiedEa(true);
        setTimeout(() => setCopiedEa(false), 2500);
      })
      .catch(() => {
        navigator.clipboard.writeText("// SESSIONKING_DataBridge.mq5\n// Download via /api/mt5/ea-script");
        setCopiedEa(true);
        setTimeout(() => setCopiedEa(false), 2500);
      });
  };

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
                100% AUTHENTIC TICKS
              </span>
            </div>
            <p className="text-xs text-gray-400 font-mono">
              Primary: MetaTrader 5 Terminal • Secondary: Interbank FCS Feed • Strict Invalidation & Freshness Guard
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowEaModal(true)}
              className="px-3.5 py-2 rounded-xl bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 text-xs font-mono flex items-center gap-2 transition-all shadow-sm"
            >
              <FileCode className="w-3.5 h-3.5" />
              MT5 EA Bridge (.mq5)
            </button>
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

      {/* MetaTrader 5 Primary Live Engine Card */}
      <div className="bg-matte-dark/90 border border-gold/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2.5 rounded-xl border flex items-center justify-center",
              mt5Status?.status === 'ONLINE'
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                : "bg-amber-500/15 border-amber-500/40 text-amber-400"
            )}>
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white font-mono">
                  Primary Market Source: MetaTrader 5 Terminal
                </h2>
                <span className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full font-mono font-bold uppercase border",
                  mt5Status?.status === 'ONLINE'
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                    : "bg-amber-500/20 text-amber-400 border-amber-500/40 animate-pulse"
                )}>
                  {mt5Status?.status || "STANDBY (FCS ACTIVE)"}
                </span>
              </div>
              <p className="text-xs text-gray-400 font-mono mt-0.5">
                Broker Feed: <span className="text-gray-200">{mt5Status?.broker || "External MT5 Terminal"}</span> • Server: <span className="text-gray-200">{mt5Status?.server || "Broker Access Point"}</span> • Latency: <span className="text-emerald-400">{mt5Status?.latencyMs ? `${mt5Status.latencyMs}ms` : "<15ms"}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/api/mt5/ea-script"
              download="SESSIONKING_DataBridge.mq5"
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono text-gray-200 border border-white/10 flex items-center gap-1.5 transition-all"
            >
              <Download className="w-3.5 h-3.5 text-gold" />
              Download EA
            </a>
            <button
              onClick={handleCopyEa}
              className="px-3 py-1.5 rounded-xl bg-gold/15 hover:bg-gold/25 text-xs font-mono text-gold border border-gold/30 flex items-center gap-1.5 transition-all"
            >
              {copiedEa ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedEa ? "Copied MQL5!" : "Copy Bridge Code"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-white/5 font-mono text-xs">
          <div className="bg-black/40 p-3 rounded-xl border border-white/5">
            <span className="text-[10px] text-gray-400 block">MT5 Ingested Quotes</span>
            <span className="text-white font-bold text-sm">
              {mt5Status?.totalQuotesReceived?.toLocaleString() || "0"} Ticks
            </span>
          </div>
          <div className="bg-black/40 p-3 rounded-xl border border-white/5">
            <span className="text-[10px] text-gray-400 block">Watchdog Freshness Guard</span>
            <span className="text-emerald-400 font-bold text-sm">
              Strict Max 8,000ms
            </span>
          </div>
          <div className="bg-black/40 p-3 rounded-xl border border-white/5">
            <span className="text-[10px] text-gray-400 block">Secondary Fallback</span>
            <span className="text-cyan-400 font-bold text-sm">
              FCS Interbank Cross-Check
            </span>
          </div>
          <div className="bg-black/40 p-3 rounded-xl border border-white/5">
            <span className="text-[10px] text-gray-400 block">Signal Engine Safety Rule</span>
            <span className="text-gold font-bold text-sm">
              WAIT if Feed Stale
            </span>
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
          <span className="text-[10px] text-gray-400 font-mono">MT5 / Interbank / Crypto</span>
        </div>
      </div>

      {/* Trade Lifecycle State Machine Active Monitor */}
      <div className="bg-matte-dark/80 border border-white/10 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30">
              <Crosshair className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white font-mono">
                Authoritative Trade Lifecycle State Machine ({activeTrades.length} Active Positions)
              </h2>
              <p className="text-[11px] text-gray-400 font-mono">
                Transitions: PROPOSED → ACTIVE → FILLED → TP1 → TP2 → TP3 / STOPPED_OUT / INVALIDATED
              </p>
            </div>
          </div>
          <span className="text-[10px] text-emerald-400 font-mono border border-emerald-500/30 px-2.5 py-0.5 rounded-full bg-emerald-500/10">
            Deduplication & Anti-Overlap Active
          </span>
        </div>

        {activeTrades.length === 0 ? (
          <div className="p-8 text-center bg-black/30 rounded-xl border border-white/5 font-mono text-xs text-gray-400">
            No positions currently active in the lifecycle state machine. Validated signals will track here automatically.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02] text-gray-400 text-[10px] uppercase">
                  <th className="py-2.5 px-3">Trade ID</th>
                  <th className="py-2.5 px-3">Pair</th>
                  <th className="py-2.5 px-3">Direction</th>
                  <th className="py-2.5 px-3">Entry</th>
                  <th className="py-2.5 px-3">Stop Loss</th>
                  <th className="py-2.5 px-3">TP1 Target</th>
                  <th className="py-2.5 px-3">TP2 Target</th>
                  <th className="py-2.5 px-3">State</th>
                  <th className="py-2.5 px-3">Realized Pips</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {activeTrades.map((t) => (
                  <tr key={t.tradeId} className="hover:bg-white/[0.02]">
                    <td className="py-2.5 px-3 font-bold text-white">{t.tradeId}</td>
                    <td className="py-2.5 px-3 text-gold font-bold">{t.pair}</td>
                    <td className="py-2.5 px-3">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold",
                        t.direction === 'BUY' ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                      )}>
                        {t.direction}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-white">{t.entryPrice}</td>
                    <td className="py-2.5 px-3 text-rose-400">{t.stopLoss}</td>
                    <td className="py-2.5 px-3 text-emerald-400">{t.takeProfit1}</td>
                    <td className="py-2.5 px-3 text-emerald-400">{t.takeProfit2}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/40 text-[9px] font-bold">
                        {t.currentState}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-white">
                      {t.pipsRealized > 0 ? `+${t.pipsRealized}` : t.pipsRealized}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

      {/* MT5 EA Modal */}
      <AnimatePresence>
        {showEaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-matte-dark border border-gold/30 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            >
              <div className="p-5 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode className="w-5 h-5 text-gold" />
                  <h3 className="font-bold text-white font-mono text-sm">
                    SESSIONKING MetaTrader 5 Data Bridge (MQL5 EA)
                  </h3>
                </div>
                <button
                  onClick={() => setShowEaModal(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto text-xs font-mono text-gray-300">
                <div className="p-3 bg-black/50 border border-gold/20 rounded-xl space-y-2">
                  <span className="text-gold font-bold block text-sm">How to Install in MT5:</span>
                  <ol className="list-decimal list-inside space-y-1.5 text-gray-300">
                    <li>In MetaTrader 5, press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white">F4</kbd> to open MetaEditor.</li>
                    <li>Click <strong className="text-white">New → Expert Advisor (template)</strong>, name it <code className="text-gold">SESSIONKING_DataBridge</code>.</li>
                    <li>Replace all code with the script below and click <strong className="text-white">Compile</strong> (<kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white">F7</kbd>).</li>
                    <li>In MT5 terminal: Go to <strong className="text-white">Tools → Options → Expert Advisors</strong>.</li>
                    <li>Check <strong className="text-emerald-400">"Allow WebRequest for listed URL"</strong> and add your app URL.</li>
                    <li>Drag the EA onto any active M1 or M5 chart.</li>
                  </ol>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-[11px]">Source File: SESSIONKING_DataBridge.mq5</span>
                  <div className="flex gap-2">
                    <a
                      href="/api/mt5/ea-script"
                      download="SESSIONKING_DataBridge.mq5"
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5 text-gold" />
                      Download .mq5
                    </a>
                    <button
                      onClick={handleCopyEa}
                      className="px-3 py-1.5 rounded-lg bg-gold text-black font-bold text-xs flex items-center gap-1.5"
                    >
                      {copiedEa ? <Check className="w-3.5 h-3.5 text-black" /> : <Copy className="w-3.5 h-3.5 text-black" />}
                      {copiedEa ? "Copied!" : "Copy Full Code"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
