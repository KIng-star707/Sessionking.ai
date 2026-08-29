import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ShieldAlert, 
  ShieldCheck, 
  Activity, 
  AlertTriangle, 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Layers, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Lock, 
  Cpu, 
  Server, 
  Sliders, 
  Info,
  Clock,
  Compass,
  ArrowRight
} from "lucide-react";
import { 
  evaluateInstitutionalPortfolioRisk, 
  authorizeTradeCandidate, 
  InstitutionalPortfolioRiskState, 
  TradeAuthorizationResult,
  MAX_PORTFOLIO_HEAT_PERCENT,
  TARGET_RISK_PER_TRADE_PERCENT,
  MAX_RISK_PER_TRADE_PERCENT
} from "../services/portfolioRiskEngine";
import type { Signal, TradeHistory } from "../types";
import { cn } from "../lib/utils";

interface PortfolioRiskViewerProps {
  user: any;
  accountBalance: number;
  activeSignals?: Signal[];
  pendingSignals?: Signal[];
  tradeHistory?: TradeHistory[];
  candidateTrade?: any;
  onRefresh?: () => void;
}

export default function PortfolioRiskViewer({
  user,
  accountBalance = 10000,
  activeSignals = [],
  pendingSignals = [],
  tradeHistory = [],
  candidateTrade,
  onRefresh
}: PortfolioRiskViewerProps) {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'EXPOSURE' | 'STRESS_TEST' | 'AUTHORIZATION' | 'SUPERVISOR'>('OVERVIEW');
  const [portfolioState, setPortfolioState] = useState<InstitutionalPortfolioRiskState | null>(null);
  const [authorizationResult, setAuthorizationResult] = useState<TradeAuthorizationResult | null>(null);
  const [supervisorStats, setSupervisorStats] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStressScenario, setSelectedStressScenario] = useState<string | null>(null);

  // Evaluate risk state
  const refreshRiskState = async () => {
    setIsLoading(true);
    try {
      // 1. Local calculation
      const localState = evaluateInstitutionalPortfolioRisk(
        user?.uid || "guest",
        accountBalance,
        activeSignals,
        pendingSignals,
        tradeHistory,
        candidateTrade
      );
      setPortfolioState(localState);

      if (candidateTrade) {
        const authRes = authorizeTradeCandidate(candidateTrade, localState);
        setAuthorizationResult(authRes);
      }

      // 2. Fetch authoritative server supervisor stats & audit logs
      try {
        const [statsRes, auditRes] = await Promise.all([
          fetch('/api/trade-monitor/stats'),
          fetch(`/api/trades/audit-log?userId=${user?.uid || ''}`)
        ]);

        if (statsRes.ok) {
          const sData = await statsRes.json();
          setSupervisorStats(sData);
        }
        if (auditRes.ok) {
          const aData = await auditRes.json();
          setAuditLogs(aData.logs || []);
        }
      } catch (e) {
        // Fallback gracefully
      }
    } catch (err) {
      console.error("[PORTFOLIO RISK VIEWER] Calculation error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshRiskState();
  }, [accountBalance, activeSignals, pendingSignals, tradeHistory, candidateTrade]);

  if (!portfolioState) {
    return (
      <div className="glass-card p-6 rounded-2xl border border-white/10 flex items-center justify-center min-h-[300px]">
        <div className="flex items-center gap-3 text-gold">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="font-mono text-sm uppercase tracking-wider">Evaluating Institutional Portfolio Risk...</span>
        </div>
      </div>
    );
  }

  const {
    portfolioHeat,
    currencyExposures,
    dominantCurrencyExposure,
    drawdownMetrics,
    dailyRisk,
    consecutiveLoss,
    riskEscalationState,
    stressTestScenarios,
    valueAtRisk,
    correlations,
    availableRiskPercent
  } = portfolioState;

  const getEscalationBadge = (state: string) => {
    switch (state) {
      case 'CRITICAL':
        return <span className="bg-red-500/20 text-red-400 border border-red-500/40 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold">CRITICAL DEFENSE</span>;
      case 'DEFENSIVE':
        return <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold">DEFENSIVE MODE</span>;
      case 'CAUTION':
        return <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold">CAUTION</span>;
      default:
        return <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold">NORMAL PROTOCOL</span>;
    }
  };

  return (
    <div className="glass-card rounded-2xl border border-white/10 overflow-hidden shadow-2xl bg-black/80 backdrop-blur-xl">
      {/* Header bar */}
      <div className="p-5 border-b border-white/10 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-black via-gray-950 to-black">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gold/10 border border-gold/30 text-gold shadow-[0_0_15px_rgba(212,175,55,0.2)]">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-base font-bold text-white font-mono tracking-tight">Institutional Portfolio Risk Engine</h3>
              {getEscalationBadge(riskEscalationState)}
            </div>
            <p className="text-xs text-gray-400 font-mono">
              Real-Time Server Supervision • VaR Model • Multi-Factor Capital Preservation Gate
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { refreshRiskState(); onRefresh?.(); }}
            disabled={isLoading}
            className="p-2 rounded-xl bg-black/60 border border-white/10 hover:border-gold/40 text-gray-300 hover:text-gold transition-all text-xs font-mono flex items-center gap-1.5"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin text-gold")} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 bg-black/40 overflow-x-auto custom-scrollbar">
        {[
          { id: 'OVERVIEW', label: 'Portfolio Heat & Drawdown', icon: Activity },
          { id: 'EXPOSURE', label: 'Currency Exposures & Correlation', icon: Layers },
          { id: 'STRESS_TEST', label: 'Macro Stress & VaR', icon: Sliders },
          { id: 'AUTHORIZATION', label: 'Trade Authorization Gate', icon: ShieldCheck },
          { id: 'SUPERVISOR', label: 'Server Supervisor & Audit', icon: Server }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "px-4 py-3 text-xs font-mono font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap",
                isActive 
                  ? "border-gold text-gold bg-gold/5" 
                  : "border-transparent text-gray-400 hover:text-gray-200 hover:bg-white/5"
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="p-5">
        {activeTab === 'OVERVIEW' && (
          <div className="space-y-6">
            {/* Top Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Account Equity */}
              <div className="p-4 rounded-xl bg-black/50 border border-white/10 relative overflow-hidden">
                <span className="text-[10px] text-gray-400 uppercase font-mono tracking-wider block mb-1">Account Balance / Equity</span>
                <div className="text-xl font-bold font-mono text-white">${drawdownMetrics.currentEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                <div className="text-[10px] text-gray-400 font-mono mt-1">Starting Balance: ${drawdownMetrics.startingBalance.toLocaleString()}</div>
              </div>

              {/* Portfolio Heat */}
              <div className="p-4 rounded-xl bg-black/50 border border-white/10 relative overflow-hidden">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[10px] text-gray-400 uppercase font-mono tracking-wider">Portfolio Heat</span>
                  <span className={cn(
                    "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded",
                    portfolioHeat.heatStatus === 'OPTIMAL' ? "bg-emerald-500/20 text-emerald-400" :
                    portfolioHeat.heatStatus === 'ELEVATED' ? "bg-yellow-500/20 text-yellow-400" :
                    portfolioHeat.heatStatus === 'HIGH' ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400"
                  )}>
                    {portfolioHeat.heatStatus}
                  </span>
                </div>
                <div className="text-xl font-bold font-mono text-white">
                  {portfolioHeat.totalPortfolioHeatPercent}% <span className="text-xs text-gray-500">/ {MAX_PORTFOLIO_HEAT_PERCENT}% Max</span>
                </div>
                {/* Heat Bar */}
                <div className="w-full h-1.5 bg-gray-800 rounded-full mt-2 overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      portfolioHeat.totalPortfolioHeatPercent > 5.0 ? "bg-red-500" :
                      portfolioHeat.totalPortfolioHeatPercent > 3.5 ? "bg-amber-500" : "bg-gold"
                    )}
                    style={{ width: `${Math.min(100, (portfolioHeat.totalPortfolioHeatPercent / MAX_PORTFOLIO_HEAT_PERCENT) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Drawdown */}
              <div className="p-4 rounded-xl bg-black/50 border border-white/10 relative overflow-hidden">
                <span className="text-[10px] text-gray-400 uppercase font-mono tracking-wider block mb-1">Current Drawdown</span>
                <div className={cn(
                  "text-xl font-bold font-mono",
                  drawdownMetrics.currentDrawdownPercent > 3.5 ? "text-red-400" :
                  drawdownMetrics.currentDrawdownPercent > 2.0 ? "text-amber-400" : "text-emerald-400"
                )}>
                  {drawdownMetrics.currentDrawdownPercent}%
                </div>
                <div className="text-[10px] text-gray-400 font-mono mt-1">Peak: ${drawdownMetrics.peakEquity.toLocaleString()} | Max DD: {drawdownMetrics.maxHistoricalDrawdownPercent}%</div>
              </div>

              {/* Available Risk Capacity */}
              <div className="p-4 rounded-xl bg-black/50 border border-white/10 relative overflow-hidden">
                <span className="text-[10px] text-gray-400 uppercase font-mono tracking-wider block mb-1">Available Risk Capacity</span>
                <div className="text-xl font-bold font-mono text-gold">{availableRiskPercent}%</div>
                <div className="text-[10px] text-gray-400 font-mono mt-1">
                  Target/Trade: {TARGET_RISK_PER_TRADE_PERCENT}% | Max: {MAX_RISK_PER_TRADE_PERCENT}%
                </div>
              </div>
            </div>

            {/* Daily Risk & Consecutive Loss Governors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Daily Risk Governor */}
              <div className="p-4 rounded-xl bg-black/60 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gold" />
                    <span className="text-xs font-bold font-mono text-white">Daily Loss Governor (4.0% Limit)</span>
                  </div>
                  <span className={cn(
                    "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border",
                    dailyRisk.isDailyLimitReached 
                      ? "bg-red-500/20 text-red-400 border-red-500/30" 
                      : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  )}>
                    {dailyRisk.isDailyLimitReached ? "LIMIT REACHED" : "ACTIVE & PROTECTED"}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 font-mono leading-relaxed">
                  Realized today: <span className={cn(dailyRisk.realizedPnl < 0 ? "text-red-400" : "text-emerald-400", "font-bold")}>${dailyRisk.realizedPnl.toFixed(2)}</span>. 
                  Drawdown: {dailyRisk.drawdownPercent}% of ${dailyRisk.dailyLossLimitUsd.toFixed(2)} ceiling.
                </p>
              </div>

              {/* Consecutive Loss Governor */}
              <div className="p-4 rounded-xl bg-black/60 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-gold" />
                    <span className="text-xs font-bold font-mono text-white">Consecutive Loss Governor (3 Max)</span>
                  </div>
                  <span className={cn(
                    "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border",
                    consecutiveLoss.isCooldownActive 
                      ? "bg-red-500/20 text-red-400 border-red-500/30 animate-pulse" 
                      : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  )}>
                    {consecutiveLoss.isCooldownActive ? "COOLDOWN ACTIVE" : "STREAK OK"}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 font-mono leading-relaxed">
                  Active streak: <span className="text-white font-bold">{consecutiveLoss.consecutiveLosses} loss(es)</span>. 
                  {consecutiveLoss.isCooldownActive ? consecutiveLoss.cooldownReason : "Streak reset upon verified target profit reach."}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'EXPOSURE' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">Net Currency Directional Exposure</h4>
                <p className="text-[10px] text-gray-400 font-mono">Enforces max 2 stacked positions & 6.0% net single-currency risk ceiling</p>
              </div>
              {dominantCurrencyExposure && (
                <div className="text-[10px] font-mono text-gray-300 bg-black/60 border border-white/10 px-3 py-1.5 rounded-lg">
                  Dominant Concentration: <span className="text-gold font-bold">{dominantCurrencyExposure.currency}</span> ({dominantCurrencyExposure.direction} {Math.abs(dominantCurrencyExposure.netUnits)} units)
                </div>
              )}
            </div>

            {/* Currency Exposure Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.keys(currencyExposures).length === 0 ? (
                <div className="col-span-full p-6 text-center text-xs font-mono text-gray-500 border border-white/5 rounded-xl">
                  No active currency positions open. Portfolio is completely neutral.
                </div>
              ) : (
                Object.values(currencyExposures).map(exp => (
                  <div key={exp.currency} className={cn(
                    "p-3.5 rounded-xl border transition-all",
                    exp.concentrationLevel === 'EXCESSIVE' ? "bg-red-500/10 border-red-500/30" :
                    exp.concentrationLevel === 'ELEVATED' ? "bg-amber-500/10 border-amber-500/30" : "bg-black/40 border-white/10"
                  )}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold font-mono text-white">{exp.currency}</span>
                      <span className={cn(
                        "text-[10px] font-mono font-bold px-2 py-0.5 rounded",
                        exp.direction === 'LONG' ? "bg-emerald-500/20 text-emerald-400" :
                        exp.direction === 'SHORT' ? "bg-red-500/20 text-red-400" : "bg-gray-800 text-gray-400"
                      )}>
                        {exp.direction} ({Math.abs(exp.netUnits)} units)
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono flex justify-between">
                      <span>Longs: {exp.longPositionsCount} | Shorts: {exp.shortPositionsCount}</span>
                      <span>Risk: {Math.abs(exp.netRiskPercent).toFixed(1)}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Correlation Matrix */}
            <div className="p-4 rounded-xl bg-black/60 border border-white/10 space-y-3">
              <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">Active Pair Correlation Matrix</h4>
              {correlations.length === 0 ? (
                <p className="text-[11px] text-gray-500 font-mono">Requires at least 2 distinct active pairs to compute correlation coefficients.</p>
              ) : (
                <div className="space-y-2">
                  {correlations.map((c, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-white/5 text-xs font-mono">
                      <span className="text-gray-300 font-bold">{c.pairA} ↔ {c.pairB}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400">Coefficient: {(c.coefficient > 0 ? '+' : '') + c.coefficient.toFixed(2)}</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold",
                          c.classification === 'EXTREME' ? "bg-red-500/20 text-red-400" :
                          c.classification === 'HIGH' ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"
                        )}>
                          {c.classification}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'STRESS_TEST' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* VaR Metrics */}
              <div className="p-4 rounded-xl bg-black/60 border border-white/10 space-y-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-gold" />
                  <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">Value at Risk (1-Day VaR)</h4>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-lg bg-black/50 border border-white/5">
                    <span className="text-[9px] text-gray-400 font-mono block mb-0.5">95% Confidence VaR</span>
                    <span className="text-base font-bold font-mono text-amber-400">${valueAtRisk.confidence95PercentUsd.toFixed(2)}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-black/50 border border-white/5">
                    <span className="text-[9px] text-gray-400 font-mono block mb-0.5">99% Confidence VaR</span>
                    <span className="text-base font-bold font-mono text-red-400">${valueAtRisk.confidence99PercentUsd.toFixed(2)}</span>
                  </div>
                  <div className="col-span-2 p-3 rounded-lg bg-black/50 border border-white/5">
                    <span className="text-[9px] text-gray-400 font-mono block mb-0.5">Expected Shortfall (CVaR 95%)</span>
                    <span className="text-base font-bold font-mono text-white">${valueAtRisk.expectedShortfall95Usd.toFixed(2)}</span>
                  </div>
                </div>
                <p className="text-[9px] text-gray-500 font-mono">{valueAtRisk.disclaimer}</p>
              </div>

              {/* Macro Scenarios List */}
              <div className="p-4 rounded-xl bg-black/60 border border-white/10 space-y-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-gold" />
                  <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">Macro Shock Simulations</h4>
                </div>
                <div className="space-y-2">
                  {stressTestScenarios.map(sc => (
                    <div 
                      key={sc.id}
                      onClick={() => setSelectedStressScenario(sc.id)}
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer transition-all text-xs font-mono",
                        selectedStressScenario === sc.id ? "bg-gold/10 border-gold/40" : "bg-black/40 border-white/5 hover:border-white/20"
                      )}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-white">{sc.name}</span>
                        <span className={cn(
                          "font-bold",
                          sc.estimatedImpactUsd < 0 ? "text-red-400" : sc.estimatedImpactUsd > 0 ? "text-emerald-400" : "text-gray-400"
                        )}>
                          {sc.estimatedImpactUsd < 0 ? '-' : '+'}${Math.abs(sc.estimatedImpactUsd).toFixed(2)} ({sc.estimatedImpactPercent.toFixed(1)}%)
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 line-clamp-1">{sc.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'AUTHORIZATION' && (
          <div className="space-y-5">
            {authorizationResult ? (
              <div className="space-y-4">
                {/* Result Banner */}
                <div className={cn(
                  "p-4 rounded-xl border flex items-start gap-3",
                  authorizationResult.isAuthorized 
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                    : "bg-red-500/10 border-red-500/30 text-red-400"
                )}>
                  {authorizationResult.isAuthorized ? (
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className="text-sm font-bold font-mono">{authorizationResult.summary}</h4>
                    <p className="text-xs opacity-90 font-mono mt-1">
                      Decision: <span className="font-bold uppercase">{authorizationResult.finalRiskDecision}</span> | Suggested Sizing: {authorizationResult.suggestedRiskPercent.toFixed(1)}%
                    </p>
                  </div>
                </div>

                {/* 13-Point Checklist */}
                <div className="p-4 rounded-xl bg-black/60 border border-white/10 space-y-3">
                  <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">Multi-Factor Risk Authorization Gate Checks</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {authorizationResult.detailedExplanations.map((rule, i) => (
                      <div key={i} className="p-2.5 rounded-lg bg-black/40 border border-white/5 text-xs font-mono flex items-start gap-2.5">
                        {rule.status === 'PASS' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        ) : rule.status === 'WARN' ? (
                          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5">
                            {rule.rule}
                            <span className={cn(
                              "text-[9px] px-1.5 py-0.2 rounded font-mono",
                              rule.status === 'PASS' ? "bg-emerald-500/20 text-emerald-400" :
                              rule.status === 'WARN' ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400"
                            )}>
                              {rule.status}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{rule.details}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs font-mono text-gray-400 border border-white/5 rounded-xl">
                Select or generate a candidate signal in the Signal Engine to run the full 13-point institutional trade authorization gate.
              </div>
            )}
          </div>
        )}

        {activeTab === 'SUPERVISOR' && (
          <div className="space-y-5">
            {/* Server Monitor Heartbeat & Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-black/60 border border-white/10">
                <span className="text-[10px] text-gray-400 font-mono uppercase block mb-1">Supervisor Status</span>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-bold font-mono text-white">{supervisorStats?.status || "RUNNING"}</span>
                </div>
                <span className="text-[9px] text-gray-500 font-mono mt-1 block">Scans: {supervisorStats?.totalScansCompleted || 0}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-black/60 border border-white/10">
                <span className="text-[10px] text-gray-400 font-mono uppercase block mb-1">Supervised Active Trades</span>
                <span className="text-lg font-bold font-mono text-gold">{supervisorStats?.totalActiveTradesMonitored || activeSignals.length}</span>
                <span className="text-[9px] text-gray-500 font-mono mt-1 block">Monitored 24/7 server-side</span>
              </div>

              <div className="p-3.5 rounded-xl bg-black/60 border border-white/10">
                <span className="text-[10px] text-gray-400 font-mono uppercase block mb-1">Authoritative Closures</span>
                <span className="text-lg font-bold font-mono text-white">{supervisorStats?.totalClosuresExecuted || 0}</span>
                <span className="text-[9px] text-gray-500 font-mono mt-1 block">Idempotent TP/SL triggers</span>
              </div>
            </div>

            {/* Audit Log Stream */}
            <div className="p-4 rounded-xl bg-black/60 border border-white/10 space-y-3">
              <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">Immutable Server Audit Trail</h4>
              <div className="max-h-60 overflow-y-auto space-y-2 custom-scrollbar">
                {auditLogs.length === 0 ? (
                  <p className="text-[11px] text-gray-500 font-mono">No server audit events recorded in this session yet.</p>
                ) : (
                  auditLogs.map(log => (
                    <div key={log.id} className="p-2.5 rounded-lg bg-black/40 border border-white/5 text-xs font-mono flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-gold/10 text-gold text-[9px] font-bold">{log.eventType}</span>
                          <span className="text-gray-300">{log.details}</span>
                        </div>
                      </div>
                      <span className="text-[9px] text-gray-500 flex-shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
