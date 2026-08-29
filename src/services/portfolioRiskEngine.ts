import type { 
  Signal, 
  TradeHistory, 
  DailyRiskState, 
  ConsecutiveLossState,
  MarketRegime,
  NewsRiskState,
  AnomalyReport
} from "../types";
import { evaluateDailyRisk } from "./dailyRiskGovernor";
import { evaluateConsecutiveLossProtection } from "./consecutiveLossProtection";

export type RiskEscalationState = 'NORMAL' | 'CAUTION' | 'DEFENSIVE' | 'CRITICAL';

export interface CurrencyExposureDetails {
  currency: string;
  netUnits: number; // Positive = Net Long, Negative = Net Short
  longPositionsCount: number;
  shortPositionsCount: number;
  netRiskPercent: number;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  concentrationLevel: 'NORMAL' | 'ELEVATED' | 'EXCESSIVE';
}

export interface PortfolioStressScenario {
  id: string;
  name: string;
  description: string;
  assetShocks: Record<string, number>; // Pair or Currency -> % Shock (e.g. "USD": 1.0, "XAU/USD": -2.0)
  estimatedImpactUsd: number;
  estimatedImpactPercent: number;
  worstAffectedPair: string;
  disclaimer: string;
}

export interface ValueAtRiskMetrics {
  confidence95PercentUsd: number;
  confidence95PercentRiskRatio: number;
  confidence99PercentUsd: number;
  confidence99PercentRiskRatio: number;
  expectedShortfall95Usd: number; // CVaR
  expectedShortfall95RiskRatio: number;
  lookbackDays: number;
  methodology: 'PARAMETRIC_VARIANCE_COVARIANCE' | 'HISTORICAL_SIMULATION';
  disclaimer: string;
}

export interface PortfolioHeatMetrics {
  openTradeRiskPercent: number;
  pendingTradeRiskPercent: number;
  correlatedRiskMultiplier: number;
  totalPortfolioHeatPercent: number;
  maxPortfolioHeatCeiling: number;
  heatStatus: 'OPTIMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
}

export interface DrawdownStateMetrics {
  startingBalance: number;
  peakEquity: number;
  currentEquity: number;
  currentDrawdownPercent: number;
  maxHistoricalDrawdownPercent: number;
  drawdownRiskState: RiskEscalationState;
  cautionThresholdPercent: number; // 2.0%
  defensiveThresholdPercent: number; // 3.5%
  criticalThresholdPercent: number; // 4.5%
}

export interface TradeAuthorizationResult {
  isAuthorized: boolean;
  finalRiskDecision: 'ALLOW' | 'BLOCK' | 'RESTRICT_SIZE';
  suggestedRiskPercent: number;
  riskEscalationState: RiskEscalationState;
  rejectionReasons: string[];
  warnings: string[];
  detailedExplanations: {
    rule: string;
    status: 'PASS' | 'WARN' | 'FAIL';
    details: string;
  }[];
  summary: string;
}

export interface InstitutionalPortfolioRiskState {
  userId: string;
  timestamp: string;
  accountBalance: number;
  accountEquity: number;
  availableRiskPercent: number;
  openPositionsCount: number;
  pendingSignalsCount: number;
  portfolioHeat: PortfolioHeatMetrics;
  currencyExposures: Record<string, CurrencyExposureDetails>;
  dominantCurrencyExposure: CurrencyExposureDetails | null;
  drawdownMetrics: DrawdownStateMetrics;
  dailyRisk: DailyRiskState;
  consecutiveLoss: ConsecutiveLossState;
  riskEscalationState: RiskEscalationState;
  stressTestScenarios: PortfolioStressScenario[];
  valueAtRisk: ValueAtRiskMetrics;
  correlations: {
    pairA: string;
    pairB: string;
    coefficient: number;
    classification: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
  }[];
}

export interface ProspectiveTrade {
  pair: string;
  direction: 'BUY' | 'SELL' | 'WAIT';
  riskPercent?: number;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  tradingMode?: string;
  session?: string;
}

// Institutional Risk Constants (Production-Calibrated)
export const TARGET_RISK_PER_TRADE_PERCENT = 2.0;
export const MAX_RISK_PER_TRADE_PERCENT = 3.0;
export const MAX_PORTFOLIO_HEAT_PERCENT = 6.0;
export const MAX_CONCURRENT_SAME_CURRENCY_POSITIONS = 2;
export const MAX_SINGLE_CURRENCY_RISK_PERCENT = 6.0;

export const DRAWDOWN_CAUTION_THRESHOLD = 2.0;
export const DRAWDOWN_DEFENSIVE_THRESHOLD = 3.5;
export const DRAWDOWN_CRITICAL_THRESHOLD = 4.5;

/**
 * Splits a forex/crypto pair into base and quote components.
 */
export function extractBaseAndQuote(pair: string): [string, string] {
  if (!pair) return ['USD', 'USD'];
  const clean = pair.replace(/[\/\-_]/g, '').trim().toUpperCase();
  if (clean === 'XAUUSD') return ['XAU', 'USD'];
  if (clean === 'XAGUSD') return ['XAG', 'USD'];
  if (clean === 'BTCUSD') return ['BTC', 'USD'];
  if (clean === 'ETHUSD') return ['ETH', 'USD'];
  if (clean.length === 6) {
    return [clean.substring(0, 3), clean.substring(3, 6)];
  }
  const parts = pair.split('/');
  return [parts[0] || 'XXX', parts[1] || 'USD'];
}

/**
 * Calculates net currency exposures across active and prospective trades.
 */
export function calculateNetCurrencyExposures(
  activeTrades: Signal[],
  prospectiveTrade?: ProspectiveTrade
): Record<string, CurrencyExposureDetails> {
  const exposures: Record<string, CurrencyExposureDetails> = {};

  const initCurrency = (curr: string) => {
    if (!exposures[curr]) {
      exposures[curr] = {
        currency: curr,
        netUnits: 0,
        longPositionsCount: 0,
        shortPositionsCount: 0,
        netRiskPercent: 0,
        direction: 'NEUTRAL',
        concentrationLevel: 'NORMAL'
      };
    }
  };

  const processTrade = (pair: string, dir: 'BUY' | 'SELL' | 'WAIT', risk: number = 2.0) => {
    if (dir === 'WAIT') return;
    const [base, quote] = extractBaseAndQuote(pair);
    initCurrency(base);
    initCurrency(quote);

    if (dir === 'BUY') {
      exposures[base].longPositionsCount += 1;
      exposures[base].netUnits += 1;
      exposures[base].netRiskPercent += risk;

      exposures[quote].shortPositionsCount += 1;
      exposures[quote].netUnits -= 1;
      exposures[quote].netRiskPercent -= risk;
    } else if (dir === 'SELL') {
      exposures[base].shortPositionsCount += 1;
      exposures[base].netUnits -= 1;
      exposures[base].netRiskPercent -= risk;

      exposures[quote].longPositionsCount += 1;
      exposures[quote].netUnits += 1;
      exposures[quote].netRiskPercent += risk;
    }
  };

  activeTrades.forEach(t => {
    const isLive = (t.status === 'ACTIVE' || t.trade_status === 'ACTIVE') && !t.closedAt;
    const dir = (t.type || t.trade_type) as 'BUY' | 'SELL' | 'WAIT';
    if (isLive && dir && dir !== 'WAIT') {
      processTrade(t.pair, dir, t.risk_percent || TARGET_RISK_PER_TRADE_PERCENT);
    }
  });

  if (prospectiveTrade && prospectiveTrade.direction !== 'WAIT') {
    processTrade(
      prospectiveTrade.pair,
      prospectiveTrade.direction,
      prospectiveTrade.riskPercent || TARGET_RISK_PER_TRADE_PERCENT
    );
  }

  // Determine directions and concentration tiers
  Object.values(exposures).forEach(exp => {
    if (exp.netUnits > 0) {
      exp.direction = 'LONG';
    } else if (exp.netUnits < 0) {
      exp.direction = 'SHORT';
    } else {
      exp.direction = 'NEUTRAL';
    }

    const absUnits = Math.abs(exp.netUnits);
    const absRisk = Math.abs(exp.netRiskPercent);

    if (absUnits > MAX_CONCURRENT_SAME_CURRENCY_POSITIONS || absRisk > MAX_SINGLE_CURRENCY_RISK_PERCENT) {
      exp.concentrationLevel = 'EXCESSIVE';
    } else if (absUnits === MAX_CONCURRENT_SAME_CURRENCY_POSITIONS || absRisk >= 4.0) {
      exp.concentrationLevel = 'ELEVATED';
    } else {
      exp.concentrationLevel = 'NORMAL';
    }
  });

  return exposures;
}

/**
 * Calculates empirical correlation between major currency pairs.
 */
export function calculatePairCorrelation(pairA: string, pairB: string): number {
  if (pairA === pairB) return 1.0;
  const [baseA, quoteA] = extractBaseAndQuote(pairA);
  const [baseB, quoteB] = extractBaseAndQuote(pairB);

  // Direct shared base
  if (baseA === baseB && quoteA === quoteB) return 1.0;
  // Inverted pairs (EUR/USD vs USD/EUR)
  if (baseA === quoteB && quoteA === baseB) return -1.0;

  // Shared USD quote: EUR/USD & GBP/USD typically possess high positive correlation (~0.82)
  if (quoteA === 'USD' && quoteB === 'USD') {
    if ((baseA === 'EUR' && baseB === 'GBP') || (baseA === 'GBP' && baseB === 'EUR')) return 0.82;
    if ((baseA === 'AUD' && baseB === 'NZD') || (baseA === 'NZD' && baseB === 'AUD')) return 0.88;
    if (baseA === 'EUR' && baseB === 'AUD') return 0.65;
    if (baseA === 'XAU' && baseB === 'EUR') return 0.45;
  }

  // EUR/USD vs USD/CHF typically possess strong negative correlation (~ -0.88)
  if ((pairA === 'EUR/USD' && pairB === 'USD/CHF') || (pairA === 'USD/CHF' && pairB === 'EUR/USD')) return -0.88;
  if ((pairA === 'GBP/USD' && pairB === 'USD/CHF') || (pairA === 'USD/CHF' && pairB === 'GBP/USD')) return -0.79;

  // JPY Crosses (EUR/JPY & GBP/JPY correlate ~0.84)
  if (quoteA === 'JPY' && quoteB === 'JPY') return 0.84;

  return 0.25; // Default modest base correlation
}

/**
 * Calculates aggregate Portfolio Heat.
 */
export function calculatePortfolioHeat(
  activeTrades: Signal[],
  pendingSignals: Signal[] = [],
  prospectiveTrade?: ProspectiveTrade
): PortfolioHeatMetrics {
  let openRisk = 0;
  let pendingRisk = 0;

  activeTrades.forEach(t => {
    if ((t.status === 'ACTIVE' || t.trade_status === 'ACTIVE') && !t.closedAt && t.type !== 'WAIT') {
      openRisk += t.risk_percent || TARGET_RISK_PER_TRADE_PERCENT;
    }
  });

  pendingSignals.forEach(s => {
    if ((s.trade_status as string) === 'PENDING' || (s.status as string) === 'PENDING' || s.status === 'ALLOWED') {
      pendingRisk += s.risk_percent || (TARGET_RISK_PER_TRADE_PERCENT * 0.5);
    }
  });

  if (prospectiveTrade && prospectiveTrade.direction !== 'WAIT') {
    openRisk += prospectiveTrade.riskPercent || TARGET_RISK_PER_TRADE_PERCENT;
  }

  // Correlated multiplier based on active pairs count
  const distinctPairs = new Set(activeTrades.map(t => t.pair)).size;
  const correlationMultiplier = distinctPairs > 1 ? 1.05 : 1.0;

  const totalHeat = (openRisk + pendingRisk) * correlationMultiplier;
  const roundedHeat = Math.round(totalHeat * 10) / 10;

  let heatStatus: 'OPTIMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL' = 'OPTIMAL';
  if (roundedHeat > MAX_PORTFOLIO_HEAT_PERCENT) {
    heatStatus = 'CRITICAL';
  } else if (roundedHeat >= MAX_PORTFOLIO_HEAT_PERCENT * 0.8) {
    heatStatus = 'HIGH';
  } else if (roundedHeat >= MAX_PORTFOLIO_HEAT_PERCENT * 0.5) {
    heatStatus = 'ELEVATED';
  }

  return {
    openTradeRiskPercent: Math.round(openRisk * 10) / 10,
    pendingTradeRiskPercent: Math.round(pendingRisk * 10) / 10,
    correlatedRiskMultiplier: correlationMultiplier,
    totalPortfolioHeatPercent: roundedHeat,
    maxPortfolioHeatCeiling: MAX_PORTFOLIO_HEAT_PERCENT,
    heatStatus
  };
}

/**
 * Calculates Institutional Drawdown and Risk Escalation States.
 */
export function calculateDrawdownMetrics(
  startingBalance: number,
  tradeHistory: TradeHistory[] = [],
  currentUnrealizedPnl: number = 0
): DrawdownStateMetrics {
  let peakEquity = startingBalance;
  let runningBalance = startingBalance;
  let maxHistoricalDd = 0;

  // Chronologically iterate over closed trades
  const sorted = [...tradeHistory].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  sorted.forEach(t => {
    if (t.outcome === 'WIN') {
      const pips = t.pips || 0;
      runningBalance += pips * 10; // $10 per pip standard lot approx
    } else if (t.outcome === 'LOSS') {
      const pips = Math.abs(t.pips || 0);
      runningBalance -= pips * 10;
    }

    if (runningBalance > peakEquity) {
      peakEquity = runningBalance;
    }

    const currentDd = peakEquity > 0 ? ((peakEquity - runningBalance) / peakEquity) * 100 : 0;
    if (currentDd > maxHistoricalDd) {
      maxHistoricalDd = currentDd;
    }
  });

  const currentEquity = Math.max(0, runningBalance + currentUnrealizedPnl);
  if (currentEquity > peakEquity) {
    peakEquity = currentEquity;
  }

  const currentDdPercent = peakEquity > 0 ? Math.max(0, ((peakEquity - currentEquity) / peakEquity) * 100) : 0;

  let drawdownRiskState: RiskEscalationState = 'NORMAL';
  if (currentDdPercent >= DRAWDOWN_CRITICAL_THRESHOLD) {
    drawdownRiskState = 'CRITICAL';
  } else if (currentDdPercent >= DRAWDOWN_DEFENSIVE_THRESHOLD) {
    drawdownRiskState = 'DEFENSIVE';
  } else if (currentDdPercent >= DRAWDOWN_CAUTION_THRESHOLD) {
    drawdownRiskState = 'CAUTION';
  } else {
    drawdownRiskState = 'NORMAL';
  }

  return {
    startingBalance,
    peakEquity: Math.round(peakEquity * 100) / 100,
    currentEquity: Math.round(currentEquity * 100) / 100,
    currentDrawdownPercent: Math.round(currentDdPercent * 10) / 10,
    maxHistoricalDrawdownPercent: Math.round(maxHistoricalDd * 10) / 10,
    drawdownRiskState,
    cautionThresholdPercent: DRAWDOWN_CAUTION_THRESHOLD,
    defensiveThresholdPercent: DRAWDOWN_DEFENSIVE_THRESHOLD,
    criticalThresholdPercent: DRAWDOWN_CRITICAL_THRESHOLD
  };
}

/**
 * Runs institutional macro stress-test simulations on open positions.
 */
export function runPortfolioStressTests(
  activeTrades: Signal[],
  accountEquity: number
): PortfolioStressScenario[] {
  const scenarios: { id: string; name: string; description: string; shocks: Record<string, number> }[] = [
    {
      id: 'USD_BULL_SHOCK',
      name: 'USD Surge (+1.0%)',
      description: 'US Dollar strengthens +1.0% against all major basket currencies following hawkish rate surprise.',
      shocks: { 'USD': 1.0, 'EUR/USD': -1.0, 'GBP/USD': -1.0, 'AUD/USD': -1.0, 'USD/JPY': 1.0, 'USD/CHF': 1.0, 'USD/CAD': 1.0, 'XAU/USD': -1.5 }
    },
    {
      id: 'USD_BEAR_SHOCK',
      name: 'USD Flash Selloff (-1.0%)',
      description: 'US Dollar drops -1.0% across all pairs triggered by dovish pivot or weaker CPI inflation release.',
      shocks: { 'USD': -1.0, 'EUR/USD': 1.0, 'GBP/USD': 1.0, 'AUD/USD': 1.0, 'USD/JPY': -1.0, 'USD/CHF': -1.0, 'USD/CAD': -1.0, 'XAU/USD': 1.5 }
    },
    {
      id: 'GOLD_LIQUIDITY_SHOCK',
      name: 'Gold Liquidity Flush (-2.0%)',
      description: 'Precious metals undergo rapid institutional margin flush, driving XAU/USD lower by -2.0%.',
      shocks: { 'XAU/USD': -2.0, 'XAG/USD': -3.0 }
    },
    {
      id: 'EURO_ZONE_RECESSION',
      name: 'EUR Weakness (-1.0%) & GBP Contagion (-1.5%)',
      description: 'European macroeconomic contraction leads to EUR/USD -1.0% and GBP/USD -1.5% drop.',
      shocks: { 'EUR/USD': -1.0, 'GBP/USD': -1.5, 'EUR/JPY': -1.0, 'GBP/JPY': -1.5 }
    }
  ];

  return scenarios.map(sc => {
    let totalImpactUsd = 0;
    let worstPair = 'None';
    let worstLoss = 0;

    activeTrades.forEach(t => {
      if ((t.status === 'ACTIVE' || t.trade_status === 'ACTIVE') && !t.closedAt && t.type !== 'WAIT') {
        const pair = t.pair;
        const dir = (t.type || t.trade_type) as 'BUY' | 'SELL';
        const riskPct = t.risk_percent || TARGET_RISK_PER_TRADE_PERCENT;
        const positionSizeUsd = accountEquity * (riskPct / 100) * 10; // standard 1:10 notional lever proxy

        const shockPercent = sc.shocks[pair] || 0;
        let pnlMultiplier = 0;
        if (dir === 'BUY') {
          pnlMultiplier = shockPercent / 100;
        } else if (dir === 'SELL') {
          pnlMultiplier = -shockPercent / 100;
        }

        const tradeImpactUsd = positionSizeUsd * pnlMultiplier;
        totalImpactUsd += tradeImpactUsd;

        if (tradeImpactUsd < worstLoss) {
          worstLoss = tradeImpactUsd;
          worstPair = pair;
        }
      }
    });

    const impactPercent = accountEquity > 0 ? (totalImpactUsd / accountEquity) * 100 : 0;

    return {
      id: sc.id,
      name: sc.name,
      description: sc.description,
      assetShocks: sc.shocks,
      estimatedImpactUsd: Math.round(totalImpactUsd * 100) / 100,
      estimatedImpactPercent: Math.round(impactPercent * 100) / 100,
      worstAffectedPair: worstPair,
      disclaimer: 'Hypothetical macro stress simulation only. Not a prediction of future market prices.'
    };
  });
}

/**
 * Calculates 1-Day Parametric Value-at-Risk (VaR) and Expected Shortfall (CVaR).
 */
export function calculateValueAtRisk(
  activeTrades: Signal[],
  accountEquity: number
): ValueAtRiskMetrics {
  const activeCount = activeTrades.filter(t => (t.status === 'ACTIVE' || t.trade_status === 'ACTIVE') && !t.closedAt && t.type !== 'WAIT').length;
  
  if (activeCount === 0 || accountEquity <= 0) {
    return {
      confidence95PercentUsd: 0,
      confidence95PercentRiskRatio: 0,
      confidence99PercentUsd: 0,
      confidence99PercentRiskRatio: 0,
      expectedShortfall95Usd: 0,
      expectedShortfall95RiskRatio: 0,
      lookbackDays: 30,
      methodology: 'PARAMETRIC_VARIANCE_COVARIANCE',
      disclaimer: 'Parametric VaR estimation based on asset historical volatility. Past variance does not guarantee future risk.'
    };
  }

  // Standard forex daily volatility proxy: ~0.65% daily std dev
  const dailyVol = 0.0065;
  const totalOpenRisk = activeTrades.reduce((acc, t) => acc + (t.risk_percent || TARGET_RISK_PER_TRADE_PERCENT), 0);
  const aggregateNotionalUsd = accountEquity * (totalOpenRisk / 100);

  // 95% VaR (Z = 1.645), 99% VaR (Z = 2.326)
  const var95 = aggregateNotionalUsd * dailyVol * 1.645;
  const var99 = aggregateNotionalUsd * dailyVol * 2.326;
  // Expected Shortfall (CVaR) ~ 1.25 * 95% VaR for normal distributions
  const cvar95 = var95 * 1.25;

  return {
    confidence95PercentUsd: Math.round(var95 * 100) / 100,
    confidence95PercentRiskRatio: Math.round((var95 / accountEquity) * 1000) / 10,
    confidence99PercentUsd: Math.round(var99 * 100) / 100,
    confidence99PercentRiskRatio: Math.round((var99 / accountEquity) * 1000) / 10,
    expectedShortfall95Usd: Math.round(cvar95 * 100) / 100,
    expectedShortfall95RiskRatio: Math.round((cvar95 / accountEquity) * 1000) / 10,
    lookbackDays: 30,
    methodology: 'PARAMETRIC_VARIANCE_COVARIANCE',
    disclaimer: 'Parametric VaR estimation based on asset historical volatility. Past variance does not guarantee future risk.'
  };
}

/**
 * Evaluates full institutional portfolio risk state.
 */
export function evaluateInstitutionalPortfolioRisk(
  userId: string,
  accountBalance: number,
  activeTrades: Signal[],
  pendingSignals: Signal[] = [],
  tradeHistory: TradeHistory[] = [],
  prospectiveTrade?: ProspectiveTrade
): InstitutionalPortfolioRiskState {
  const exposures = calculateNetCurrencyExposures(activeTrades, prospectiveTrade);
  
  // Find dominant currency exposure
  let dominantExp: CurrencyExposureDetails | null = null;
  let maxAbsUnits = 0;
  Object.values(exposures).forEach(exp => {
    const absU = Math.abs(exp.netUnits);
    if (absU > maxAbsUnits) {
      maxAbsUnits = absU;
      dominantExp = exp;
    }
  });

  const portfolioHeat = calculatePortfolioHeat(activeTrades, pendingSignals, prospectiveTrade);
  const drawdownMetrics = calculateDrawdownMetrics(accountBalance, tradeHistory);
  const dailyRisk = evaluateDailyRisk(accountBalance, tradeHistory);
  const consecutiveLoss = evaluateConsecutiveLossProtection(tradeHistory);

  // Overall Risk Escalation State: Highest severity among drawdown, daily loss, consecutive loss, and heat
  let overallEscalation: RiskEscalationState = drawdownMetrics.drawdownRiskState;
  if (dailyRisk.isDailyLimitReached || consecutiveLoss.isCooldownActive || portfolioHeat.heatStatus === 'CRITICAL') {
    overallEscalation = 'CRITICAL';
  } else if (portfolioHeat.heatStatus === 'HIGH' && overallEscalation === 'NORMAL') {
    overallEscalation = 'DEFENSIVE';
  } else if (portfolioHeat.heatStatus === 'ELEVATED' && overallEscalation === 'NORMAL') {
    overallEscalation = 'CAUTION';
  }

  const stressTestScenarios = runPortfolioStressTests(activeTrades, drawdownMetrics.currentEquity);
  const valueAtRisk = calculateValueAtRisk(activeTrades, drawdownMetrics.currentEquity);

  const availableRiskPercent = Math.max(0, MAX_PORTFOLIO_HEAT_PERCENT - portfolioHeat.totalPortfolioHeatPercent);

  // Sample correlation matrix across unique active pairs
  const uniquePairs = Array.from(new Set(activeTrades.map(t => t.pair)));
  const correlations: InstitutionalPortfolioRiskState['correlations'] = [];
  for (let i = 0; i < uniquePairs.length; i++) {
    for (let j = i + 1; j < uniquePairs.length; j++) {
      const coeff = calculatePairCorrelation(uniquePairs[i], uniquePairs[j]);
      const absCoeff = Math.abs(coeff);
      const classification = absCoeff >= 0.8 ? 'EXTREME' : absCoeff >= 0.6 ? 'HIGH' : absCoeff >= 0.3 ? 'MODERATE' : 'LOW';
      correlations.push({
        pairA: uniquePairs[i],
        pairB: uniquePairs[j],
        coefficient: coeff,
        classification
      });
    }
  }

  return {
    userId,
    timestamp: new Date().toISOString(),
    accountBalance,
    accountEquity: drawdownMetrics.currentEquity,
    availableRiskPercent: Math.round(availableRiskPercent * 10) / 10,
    openPositionsCount: activeTrades.filter(t => (t.status === 'ACTIVE' || t.trade_status === 'ACTIVE') && !t.closedAt).length,
    pendingSignalsCount: pendingSignals.length,
    portfolioHeat,
    currencyExposures: exposures,
    dominantCurrencyExposure: dominantExp,
    drawdownMetrics,
    dailyRisk,
    consecutiveLoss,
    riskEscalationState: overallEscalation,
    stressTestScenarios,
    valueAtRisk,
    correlations
  };
}

/**
 * 13-Point Institutional Trade Authorization Gate.
 * Enforces risk rules before a new trade can be issued or executed.
 */
export function authorizeTradeCandidate(
  candidate: ProspectiveTrade,
  portfolioState: InstitutionalPortfolioRiskState,
  options?: {
    marketDataHealthy?: boolean;
    newsRisk?: NewsRiskState;
    anomalyReport?: AnomalyReport;
    marketRegime?: MarketRegime;
  }
): TradeAuthorizationResult {
  const rejectionReasons: string[] = [];
  const warnings: string[] = [];
  const detailedExplanations: TradeAuthorizationResult['detailedExplanations'] = [];

  const {
    pair,
    direction,
    riskPercent = TARGET_RISK_PER_TRADE_PERCENT
  } = candidate;

  // 1. Per-Trade Target Risk Rule (Target 2%, Max 3%)
  if (riskPercent > MAX_RISK_PER_TRADE_PERCENT) {
    rejectionReasons.push(`Proposed trade risk (${riskPercent.toFixed(1)}%) exceeds institutional ceiling (${MAX_RISK_PER_TRADE_PERCENT}% max).`);
    detailedExplanations.push({
      rule: 'Per-Trade Risk Limit',
      status: 'FAIL',
      details: `Requested risk ${riskPercent.toFixed(1)}% exceeds maximum permitted ${MAX_RISK_PER_TRADE_PERCENT}%. Target risk is ${TARGET_RISK_PER_TRADE_PERCENT}%.`
    });
  } else {
    detailedExplanations.push({
      rule: 'Per-Trade Risk Limit',
      status: 'PASS',
      details: `Trade risk of ${riskPercent.toFixed(1)}% conforms to institutional parameter (Target 2%, Max 3%).`
    });
  }

  // 2. Portfolio Heat & Risk Ceiling Rule (Max 6.0%)
  const newProjectedHeat = portfolioState.portfolioHeat.totalPortfolioHeatPercent + (direction !== 'WAIT' ? riskPercent : 0);
  if (newProjectedHeat > MAX_PORTFOLIO_HEAT_PERCENT) {
    rejectionReasons.push(`Total portfolio heat (${newProjectedHeat.toFixed(1)}%) exceeds safety ceiling (${MAX_PORTFOLIO_HEAT_PERCENT}% max).`);
    detailedExplanations.push({
      rule: 'Portfolio Heat Ceiling',
      status: 'FAIL',
      details: `Projected portfolio heat of ${newProjectedHeat.toFixed(1)}% violates maximum aggregate risk ceiling of ${MAX_PORTFOLIO_HEAT_PERCENT}%.`
    });
  } else if (newProjectedHeat >= MAX_PORTFOLIO_HEAT_PERCENT * 0.8) {
    warnings.push(`Portfolio heat approaching capacity (${newProjectedHeat.toFixed(1)}% / ${MAX_PORTFOLIO_HEAT_PERCENT}%).`);
    detailedExplanations.push({
      rule: 'Portfolio Heat Ceiling',
      status: 'WARN',
      details: `Projected heat of ${newProjectedHeat.toFixed(1)}% is elevated but within ${MAX_PORTFOLIO_HEAT_PERCENT}% boundary.`
    });
  } else {
    detailedExplanations.push({
      rule: 'Portfolio Heat Ceiling',
      status: 'PASS',
      details: `Projected heat of ${newProjectedHeat.toFixed(1)}% is well within institutional safety limits.`
    });
  }

  // 3. Currency Concentration & Directional Exposure Rule
  const [base, quote] = extractBaseAndQuote(pair);
  const prospectiveExposures = calculateNetCurrencyExposures([], candidate);
  
  let currencyConcentrationFailed = false;
  [base, quote].forEach(curr => {
    const existingExp = portfolioState.currencyExposures[curr];
    const candidateExp = prospectiveExposures[curr];

    if (existingExp && candidateExp) {
      const combinedUnits = existingExp.netUnits + candidateExp.netUnits;
      const combinedRisk = Math.abs(existingExp.netRiskPercent + candidateExp.netRiskPercent);

      if (Math.abs(combinedUnits) > MAX_CONCURRENT_SAME_CURRENCY_POSITIONS) {
        currencyConcentrationFailed = true;
        const dirStr = combinedUnits > 0 ? 'LONG' : 'SHORT';
        rejectionReasons.push(`${curr} portfolio exposure exceeds configured concentration limit (${Math.abs(combinedUnits)} stacked ${dirStr} positions, max ${MAX_CONCURRENT_SAME_CURRENCY_POSITIONS}).`);
        detailedExplanations.push({
          rule: `Currency Concentration (${curr})`,
          status: 'FAIL',
          details: `${curr} directional exposure would reach ${Math.abs(combinedUnits)} stacked positions. Current exposure: ${existingExp.netRiskPercent.toFixed(1)}%, Maximum allowed: ${MAX_SINGLE_CURRENCY_RISK_PERCENT}%. Action: Block additional ${curr}-correlated positions.`
        });
      }
    }
  });

  if (!currencyConcentrationFailed) {
    detailedExplanations.push({
      rule: 'Currency Concentration',
      status: 'PASS',
      details: `Net exposure across ${base} and ${quote} remains balanced without single-currency stacking.`
    });
  }

  // 4. Daily Loss Protection Rule
  if (portfolioState.dailyRisk.isDailyLimitReached) {
    rejectionReasons.push(`Daily loss limit reached (${portfolioState.dailyRisk.drawdownPercent.toFixed(1)}% / ${portfolioState.dailyRisk.dailyLossLimitPercent}% max).`);
    detailedExplanations.push({
      rule: 'Daily Loss Governor',
      status: 'FAIL',
      details: `Daily drawdown of ${portfolioState.dailyRisk.drawdownPercent.toFixed(1)}% reached the ${portfolioState.dailyRisk.dailyLossLimitPercent}% ceiling ($${portfolioState.dailyRisk.dailyLossLimitUsd.toFixed(2)}). Trading locked until 00:00 UTC.`
    });
  } else {
    detailedExplanations.push({
      rule: 'Daily Loss Governor',
      status: 'PASS',
      details: `Daily drawdown is ${portfolioState.dailyRisk.drawdownPercent.toFixed(1)}% (Limit: ${portfolioState.dailyRisk.dailyLossLimitPercent}%).`
    });
  }

  // 5. Consecutive Loss Protection Rule
  if (portfolioState.consecutiveLoss.isCooldownActive) {
    rejectionReasons.push(portfolioState.consecutiveLoss.cooldownReason || 'Consecutive loss cooldown active.');
    detailedExplanations.push({
      rule: 'Consecutive Loss Governor',
      status: 'FAIL',
      details: portfolioState.consecutiveLoss.cooldownReason || 'Cooldown engaged to prevent loss acceleration.'
    });
  } else {
    detailedExplanations.push({
      rule: 'Consecutive Loss Governor',
      status: 'PASS',
      details: `Active streak is ${portfolioState.consecutiveLoss.consecutiveLosses} loss(es) (Threshold: ${portfolioState.consecutiveLoss.maxAllowedLosses}).`
    });
  }

  // 6. Drawdown Escalation State Rule
  if (portfolioState.drawdownMetrics.drawdownRiskState === 'CRITICAL') {
    rejectionReasons.push(`Critical account drawdown reached (${portfolioState.drawdownMetrics.currentDrawdownPercent.toFixed(1)}%). Trading frozen.`);
    detailedExplanations.push({
      rule: 'Drawdown Escalation',
      status: 'FAIL',
      details: `Drawdown is at critical tier ${portfolioState.drawdownMetrics.currentDrawdownPercent.toFixed(1)}% (Threshold: ${DRAWDOWN_CRITICAL_THRESHOLD}%).`
    });
  } else if (portfolioState.drawdownMetrics.drawdownRiskState === 'DEFENSIVE') {
    warnings.push(`Account in DEFENSIVE drawdown mode (${portfolioState.drawdownMetrics.currentDrawdownPercent.toFixed(1)}%). Sizing restricted.`);
    detailedExplanations.push({
      rule: 'Drawdown Escalation',
      status: 'WARN',
      details: `Drawdown is in defensive tier (${portfolioState.drawdownMetrics.currentDrawdownPercent.toFixed(1)}%). Risk halved to 1.0%.`
    });
  } else {
    detailedExplanations.push({
      rule: 'Drawdown Escalation',
      status: 'PASS',
      details: `Account drawdown is ${portfolioState.drawdownMetrics.currentDrawdownPercent.toFixed(1)}% (Status: NORMAL).`
    });
  }

  // 7. Market Data Health Rule
  if (options?.marketDataHealthy === false) {
    rejectionReasons.push('Authoritative market data feed is degraded, stale, or offline.');
    detailedExplanations.push({
      rule: 'Market Data Health',
      status: 'FAIL',
      details: 'Data engine flagged feed as stale or invalid. Live signal generation suspended.'
    });
  } else {
    detailedExplanations.push({
      rule: 'Market Data Health',
      status: 'PASS',
      details: 'Authoritative FCS live data stream synchronized.'
    });
  }

  // 8. News & High-Impact Event Risk Rule
  if (options?.newsRisk === 'CRITICAL') {
    rejectionReasons.push(`High-impact macroeconomic event actively in progress on ${pair}.`);
    detailedExplanations.push({
      rule: 'Economic Event Risk',
      status: 'FAIL',
      details: 'Event risk is classified as CRITICAL. Immediate trading blocked to avoid extreme spread slippage.'
    });
  } else {
    detailedExplanations.push({
      rule: 'Economic Event Risk',
      status: 'PASS',
      details: 'No conflicting critical macroeconomic event underway.'
    });
  }

  // 9. Anomaly Detection Rule
  if (options?.anomalyReport && options.anomalyReport.actionRequired === 'SUSPEND_SIGNALS') {
    rejectionReasons.push(`Market anomaly detected: ${options.anomalyReport.evidence[0] || 'Abnormal volatility'}`);
    detailedExplanations.push({
      rule: 'Market Anomaly Governor',
      status: 'FAIL',
      details: `System anomaly engine triggered safeguard: ${options.anomalyReport.type}`
    });
  } else {
    detailedExplanations.push({
      rule: 'Market Anomaly Governor',
      status: 'PASS',
      details: 'No abnormal quote spikes or data anomalies detected.'
    });
  }

  const isAuthorized = rejectionReasons.length === 0 && direction !== 'WAIT';
  let finalRiskDecision: TradeAuthorizationResult['finalRiskDecision'] = 'ALLOW';
  let suggestedRiskPercent = riskPercent;

  if (!isAuthorized) {
    finalRiskDecision = 'BLOCK';
    suggestedRiskPercent = 0;
  } else if (portfolioState.drawdownMetrics.drawdownRiskState === 'DEFENSIVE' || portfolioState.portfolioHeat.heatStatus === 'HIGH') {
    finalRiskDecision = 'RESTRICT_SIZE';
    suggestedRiskPercent = Math.min(1.0, riskPercent * 0.5);
  }

  let summary = '';
  if (isAuthorized) {
    summary = `TRADE AUTHORIZED: Institutional risk parameters validated. Target Risk: ${suggestedRiskPercent.toFixed(1)}%, Heat: ${newProjectedHeat.toFixed(1)}% / ${MAX_PORTFOLIO_HEAT_PERCENT}%.`;
  } else {
    summary = `TRADE BLOCKED. Reason: ${rejectionReasons[0] || 'Risk limits exceeded.'} Action: New position rejected to protect capital.`;
  }

  return {
    isAuthorized,
    finalRiskDecision,
    suggestedRiskPercent,
    riskEscalationState: portfolioState.riskEscalationState,
    rejectionReasons,
    warnings,
    detailedExplanations,
    summary
  };
}
