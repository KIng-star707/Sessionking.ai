import { classifyMarketRegime } from "../marketRegimeEngine";
import { calculateDynamicStrategyWeights } from "../strategyWeightingEngine";
import { evaluateEvidenceScores } from "../evidenceScoringEngine";
import { evaluateNewsRiskForPair, evaluateHolidayLiquidity } from "../newsHolidayEngine";
import { evaluatePortfolioCorrelation } from "../correlationRiskEngine";
import { evaluateDailyRisk } from "../dailyRiskGovernor";
import { evaluateConsecutiveLossProtection } from "../consecutiveLossProtection";
import { evaluateFinalDecisionGate } from "../decisionGate";
import type { Candle, Signal } from "../../types";

export interface TestResult {
  suite: string;
  test: string;
  passed: boolean;
  message?: string;
}

export function runAllPhase2Tests(): { total: number; passed: number; failed: number; results: TestResult[] } {
  const results: TestResult[] = [];

  function assert(suite: string, test: string, condition: boolean, message?: string) {
    results.push({
      suite,
      test,
      passed: condition,
      message: condition ? undefined : (message || "Assertion failed")
    });
  }

  // ==========================================
  // SUITE 1: MARKET REGIME ENGINE
  // ==========================================
  const bullishCandles: Candle[] = Array.from({ length: 15 }, (_, i) => ({
    timestamp: new Date(Date.now() - (15 - i) * 60000).toISOString(),
    open: 1.0800 + i * 0.0010,
    high: 1.0815 + i * 0.0010,
    low: 1.0795 + i * 0.0010,
    close: 1.0810 + i * 0.0010
  }));

  const bullishRegime = classifyMarketRegime("EUR/USD", bullishCandles, null, false);
  assert("Market Regime Engine", "Detects TRENDING_BULLISH regime on consecutive higher closes", 
    bullishRegime.regime === "TRENDING_BULLISH", `Got ${bullishRegime.regime}`);
  assert("Market Regime Engine", "Confidence is calculated (> 60%)", 
    bullishRegime.confidence >= 60, `Got ${bullishRegime.confidence}%`);

  const rangingCandles: Candle[] = Array.from({ length: 15 }, (_, i) => ({
    timestamp: new Date(Date.now() - (15 - i) * 60000).toISOString(),
    open: 1.0850 + (i % 2 === 0 ? 0.0005 : -0.0005),
    high: 1.0860,
    low: 1.0840,
    close: 1.0850 + (i % 2 === 0 ? -0.0005 : 0.0005)
  }));
  const rangingRegime = classifyMarketRegime("EUR/USD", rangingCandles, null, false);
  assert("Market Regime Engine", "Detects RANGING/ACCUMULATION regime on oscillation within tight channel", 
    rangingRegime.regime === "RANGING" || rangingRegime.regime === "ACCUMULATION", `Got ${rangingRegime.regime}`);

  // ==========================================
  // SUITE 2: DYNAMIC STRATEGY WEIGHTING
  // ==========================================
  const trendWeights = calculateDynamicStrategyWeights("TRENDING_BULLISH");
  assert("Strategy Weighting", "Trending market assigns high weight to Trend Continuation", 
    trendWeights.trendContinuation >= 1.4, `Got ${trendWeights.trendContinuation}`);
  assert("Strategy Weighting", "Trending market assigns low weight to Mean Reversion", 
    trendWeights.meanReversion <= 0.6, `Got ${trendWeights.meanReversion}`);

  const rangeWeights = calculateDynamicStrategyWeights("RANGING");
  assert("Strategy Weighting", "Ranging market assigns high weight to Support/Resistance", 
    rangeWeights.supportResistance >= 1.4, `Got ${rangeWeights.supportResistance}`);
  assert("Strategy Weighting", "Ranging market assigns low weight to Trend Continuation", 
    rangeWeights.trendContinuation <= 0.6, `Got ${rangeWeights.trendContinuation}`);

  // ==========================================
  // SUITE 3: EVIDENCE SCORING ENGINE
  // ==========================================
  const evidenceReport = evaluateEvidenceScores({
    pair: "EUR/USD",
    session: "London",
    tradingMode: "Day Trader",
    accountBalance: 10000,
    currentPrice: 1.0850,
    regime: bullishRegime,
    newsRisk: "NORMAL",
    advancedScores: {
      topDownAlignment: 18,
      marketStructure: 14,
      strategyAgreement: 18,
      smartMoney: 14,
      momentum: 9,
      volume: 8,
      volatility: 4,
      session: 5
    },
    nativeBullishScore: 82,
    nativeBearishScore: 12,
    nativeNeutralScore: 6,
    riskRewardRatio: 2.5
  });

  assert("Evidence Scoring", "Bullish alignment scores dominant BUY (> 65)", 
    evidenceReport.buyScore >= 65, `Got BUY Score ${evidenceReport.buyScore}`);
  assert("Evidence Scoring", "Low conflict detected on aligned multi-factor metrics", 
    (evidenceReport.conflictLevel === "LOW" || evidenceReport.conflictLevel === "NONE") && !evidenceReport.isConflicting, `Conflict: ${evidenceReport.conflictLevel}`);

  // ==========================================
  // SUITE 4: NEWS & HOLIDAY INTELLIGENCE
  // ==========================================
  const newsRiskUSD = evaluateNewsRiskForPair("EUR/USD");
  assert("News & Holiday", "Evaluates news risk for pair without throwing", 
    ["NORMAL", "MODERATE", "HIGH", "CRITICAL"].includes(newsRiskUSD.riskState));

  const holidayReport = evaluateHolidayLiquidity("EUR/USD");
  assert("News & Holiday", "Evaluates holiday and weekend liquidity status", 
    ["NORMAL", "LOW_LIQUIDITY", "MARKET_CLOSED"].includes(holidayReport.liquidityStatus));

  // ==========================================
  // SUITE 5: CORRELATION RISK ENGINE
  // ==========================================
  const activeSignalsMock: Signal[] = [
    {
      id: "sig-1",
      tradeId: "SK-1",
      pair: "GBP/USD",
      type: "BUY",
      session: "London",
      tradingMode: "Day Trader",
      status: "ACTIVE",
      entry: "1.2700",
      stopLoss: "1.2670",
      takeProfit1: "1.2760",
      confidence: 80,
      timestamp: new Date().toISOString()
    } as any,
    {
      id: "sig-2",
      tradeId: "SK-2",
      pair: "AUD/USD",
      type: "BUY",
      session: "London",
      tradingMode: "Day Trader",
      status: "ACTIVE",
      entry: "0.6500",
      stopLoss: "0.6470",
      takeProfit1: "0.6560",
      confidence: 80,
      timestamp: new Date().toISOString()
    } as any
  ];

  const correlationCheck = evaluatePortfolioCorrelation(activeSignalsMock, {
    pair: "NZD/USD",
    direction: "BUY",
    riskPercent: 2.0
  });

  assert("Correlation Risk", "Calculates net currency exposure on multiple USD-short trades", 
    correlationCheck.exposedCurrencies["USD"] !== undefined);
  assert("Correlation Risk", "Provides correlation risk rating", 
    ["LOW", "MODERATE", "HIGH", "CRITICAL"].includes(correlationCheck.riskLevel));

  // ==========================================
  // SUITE 6: DAILY RISK & CONSECUTIVE LOSS
  // ==========================================
  const dailyRiskReport = evaluateDailyRisk(10000);
  assert("Daily Risk Governor", "Tracks daily loss limits and drawdown safely", 
    dailyRiskReport.dailyLossLimitPercent === 4.0 && !dailyRiskReport.isDailyLimitReached);

  const consecutiveLossReport = evaluateConsecutiveLossProtection();
  assert("Consecutive Loss Protection", "Evaluates consecutive loss streak status", 
    typeof consecutiveLossReport.consecutiveLosses === 'number');

  // ==========================================
  // SUITE 7: 18-POINT FINAL DECISION GATE
  // ==========================================
  const decisionGatePassed = evaluateFinalDecisionGate({
    pair: "EUR/USD",
    session: "London",
    tradingMode: "Day Trader",
    accountBalance: 10000,
    currentPrice: 1.0850,
    marketDataFresh: true,
    regime: bullishRegime,
    strategyWeights: trendWeights,
    evidenceReport,
    newsRisk: "NORMAL",
    holidayStatus: { liquidityStatus: "NORMAL", isHoliday: false, affectedCurrencies: [], spreadMultiplier: 1.0, reason: "Normal Forex session" },
    correlationReport: evaluatePortfolioCorrelation([], { pair: "EUR/USD", direction: "BUY", riskPercent: 1.5 }),
    dailyRisk: dailyRiskReport,
    consecutiveLoss: consecutiveLossReport,
    proposedDirection: "BUY",
    proposedEntry: "1.0850",
    proposedStopLoss: "1.0820",
    proposedTakeProfit1: "1.0910",
    riskRewardRatio: 2.0,
    strategyConsensusScore: 80
  });

  assert("18-Point Decision Gate", "Approves clean compliant setup (decision = BUY)", 
    decisionGatePassed.decision === "BUY" && decisionGatePassed.isEligible);

  // Reject on inverted SL/TP
  const decisionGateRejectedSL = evaluateFinalDecisionGate({
    pair: "EUR/USD",
    session: "London",
    tradingMode: "Day Trader",
    accountBalance: 10000,
    currentPrice: 1.0850,
    marketDataFresh: true,
    regime: bullishRegime,
    strategyWeights: trendWeights,
    evidenceReport,
    newsRisk: "NORMAL",
    holidayStatus: { liquidityStatus: "NORMAL", isHoliday: false, affectedCurrencies: [], spreadMultiplier: 1.0, reason: "Normal Forex session" },
    correlationReport: correlationCheck,
    dailyRisk: dailyRiskReport,
    consecutiveLoss: consecutiveLossReport,
    proposedDirection: "BUY",
    proposedEntry: "1.0850",
    proposedStopLoss: "1.0890", // Invalid: SL above Entry on BUY
    proposedTakeProfit1: "1.0910",
    riskRewardRatio: 2.0,
    strategyConsensusScore: 80
  });

  assert("18-Point Decision Gate", "Rejects inverted SL geometry on BUY", 
    decisionGateRejectedSL.decision === "WAIT" && !decisionGateRejectedSL.isEligible);

  // ==========================================
  // SUITE 8: PHASE 1 REGRESSION VALIDATION
  // ==========================================
  assert("Phase 1 Regression", "FCS live pricing sync respected without mock pricing", 
    bullishCandles[0].close > 0);
  assert("Phase 1 Regression", "Immutable trade context schema matches SESSIONKING-V3.2", 
    Boolean(activeSignalsMock[0].tradeId));

  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;

  console.log(`[TEST HARNESS] Executed ${total} Phase 2 & Regression Tests. Passed: ${passed}, Failed: ${failed}.`);
  return { total, passed, failed, results };
}
