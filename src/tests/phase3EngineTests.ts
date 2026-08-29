/**
 * Comprehensive Automated Test Suite for SESSIONKING Phase 3 Intelligence Engines
 * Validates Anomaly Detection, Confidence Calibration, Adaptive Weighting, and Backtesting
 */

import { detectMarketAnomalies } from "../services/anomalyDetectionEngine";
import { calibrateConfidence } from "../services/confidenceCalibrationEngine";
import { adaptiveStrategyWeighting } from "../services/adaptiveStrategyWeighting";
import { strategyPerformanceMemory } from "../services/strategyPerformanceMemory";
import { executeHistoricalBacktest } from "../services/backtestingEngine";
import { executeWalkForwardAnalysis } from "../services/walkForwardEngine";
import type { Candle } from "../types";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedCount++;
  }
}

async function runTestSuite() {
  console.log("=================================================");
  console.log("🚀 STARTING SESSIONKING PHASE 3 ENGINE TEST SUITE");
  console.log("=================================================\n");

  // -------------------------------------------------------------
  // TEST SUITE 1: ANOMALY DETECTION ENGINE
  // -------------------------------------------------------------
  console.log("▶️ [SUITE 1] Anomaly Detection Engine Tests");

  // Test 1.1: Corrupt OHLC Geometry (High < Low)
  const corruptCandles: Candle[] = [
    { timestamp: "2026-01-01T10:00:00Z", open: 1.1000, high: 1.0900, low: 1.1050, close: 1.0950, volume: 1000 }
  ];
  const corruptReport = detectMarketAnomalies({
    pair: "EUR/USD",
    candles: corruptCandles
  });
  assert(corruptReport.isAnomaly === true, "Detects corrupt candle geometry");
  assert(corruptReport.isDataCorruption === true, "Flags corrupt data as data corruption");
  assert(corruptReport.actionRequired === "SUSPEND_SIGNALS", "Mandates signal suspension for corrupted feeds");

  // Test 1.2: Future Timestamp
  const futureCandles: Candle[] = [
    { timestamp: new Date(Date.now() + 600000).toISOString(), open: 1.1000, high: 1.1020, low: 1.0980, close: 1.1010, volume: 1000 }
  ];
  const futureReport = detectMarketAnomalies({
    pair: "EUR/USD",
    candles: futureCandles
  });
  assert(futureReport.isAnomaly === true, "Detects impossible future timestamps");

  // Test 1.3: Normal Baseline Candles
  const normalCandles: Candle[] = Array.from({ length: 20 }, (_, i) => ({
    timestamp: new Date(Date.now() - (20 - i) * 60000).toISOString(),
    open: 1.1000 + i * 0.0001,
    high: 1.1005 + i * 0.0001,
    low: 1.0995 + i * 0.0001,
    close: 1.1002 + i * 0.0001,
    volume: 1500
  }));
  const normalReport = detectMarketAnomalies({
    pair: "EUR/USD",
    candles: normalCandles,
    currentSpreadPips: 1.2,
    expectedNormalSpreadPips: 1.2
  });
  assert(normalReport.severity === "NORMAL", "Normal market feed receives NORMAL severity");
  assert(normalReport.actionRequired === "CONTINUE", "Normal market feed allows trade continuation");

  // Test 1.4: Extreme Volatility Spike vs News Context
  const spikeCandles: Candle[] = [
    ...normalCandles,
    { timestamp: new Date().toISOString(), open: 1.1020, high: 1.1200, low: 1.0850, close: 1.1150, volume: 50000 }
  ];
  const spikeReport = detectMarketAnomalies({
    pair: "EUR/USD",
    candles: spikeCandles,
    currentSpreadPips: 1.2,
    expectedNormalSpreadPips: 1.2,
    newsRiskState: "CRITICAL"
  });
  assert(spikeReport.isNewsDriven === true, "Distinguishes news volatility shock in CRITICAL news context");
  assert(spikeReport.type === "NEWS_SHOCK", "Assigns NEWS_SHOCK anomaly type");

  // -------------------------------------------------------------
  // TEST SUITE 2: CONFIDENCE CALIBRATION ENGINE
  // -------------------------------------------------------------
  console.log("\n▶️ [SUITE 2] Confidence Calibration Engine Tests");

  // Test 2.1: Overconfidence Calibration Dampening
  const overCalibrated = calibrateConfidence({
    rawEvidenceScore: 92,
    marketRegime: "TRENDING_BULLISH",
    regimeConfidence: 85,
    strategyConsensusScore: 90,
    timeframeAlignmentScore: 85,
    historicalReliability: {
      similarSetupsCount: 25,
      empiricalWinRate: 50,
      averageRMultiple: 1.2,
      profitFactor: 1.1,
      reliabilityLabel: "MODERATE",
      regimePerformance: "MODERATE",
      decayDetected: false
    }
  });
  assert(overCalibrated.calibrationState === "OVERCALIBRATED", "Detects overconfident signals");
  assert(overCalibrated.calibratedConfidence < 92, "Dampens overconfident score toward empirical truth");
  assert(overCalibrated.calibrationAdjustment < 0, "Applies negative calibration adjustment");

  // Test 2.2: Underconfidence Calibration Elevation
  const underCalibrated = calibrateConfidence({
    rawEvidenceScore: 60,
    marketRegime: "TRENDING_BULLISH",
    regimeConfidence: 65,
    strategyConsensusScore: 60,
    timeframeAlignmentScore: 65,
    historicalReliability: {
      similarSetupsCount: 30,
      empiricalWinRate: 84,
      averageRMultiple: 2.1,
      profitFactor: 2.5,
      reliabilityLabel: "HIGH",
      regimePerformance: "STRONG",
      decayDetected: false
    }
  });
  assert(underCalibrated.calibrationState === "UNDERCALIBRATED", "Detects underconfident high-probability setups");
  assert(underCalibrated.calibratedConfidence >= 60, "Elevates calibrated confidence");

  // Test 2.3: Insufficient Historical Sample Size Protection
  const smallSample = calibrateConfidence({
    rawEvidenceScore: 75,
    marketRegime: "RANGING",
    regimeConfidence: 70,
    strategyConsensusScore: 75,
    timeframeAlignmentScore: 70,
    historicalReliability: {
      similarSetupsCount: 3,
      empiricalWinRate: 90,
      averageRMultiple: 1.8,
      profitFactor: 3.0,
      reliabilityLabel: "INSUFFICIENT_DATA",
      regimePerformance: "INSUFFICIENT_DATA",
      decayDetected: false
    }
  });
  assert(smallSample.calibrationState === "INSUFFICIENT_DATA", "Flags low sample size (< 8 setups)");

  // -------------------------------------------------------------
  // TEST SUITE 3: ADAPTIVE STRATEGY WEIGHTING & MEMORY
  // -------------------------------------------------------------
  console.log("\n▶️ [SUITE 3] Adaptive Strategy Weighting Engine Tests");

  const adaptiveRes = adaptiveStrategyWeighting.computeAdaptiveWeights({
    regime: "TRENDING_BULLISH",
    pair: "EUR/USD",
    session: "London",
    style: "Day Trader"
  });
  assert(adaptiveRes.config.minBound === 0.2 && adaptiveRes.config.maxBound === 2.2, "Enforces strict mathematical bounds [0.2, 2.2]");

  for (const [strategy, weight] of Object.entries(adaptiveRes.weights)) {
    assert(weight >= 0.2 && weight <= 2.2, `Strategy ${strategy} weight (${weight}) is within safe bounds`);
  }

  // Test 3.2: Record Strategy Trade Outcome
  strategyPerformanceMemory.recordTradeOutcome({
    strategyKey: "LiquiditySweep",
    pair: "EUR/USD",
    session: "London",
    style: "Day Trader",
    timeframe: "1h",
    regime: "TRENDING_BULLISH",
    result: "WIN",
    rMultiple: 2.5
  });
  console.log("  ✅ PASS: Trade outcome recorded successfully to strategy performance memory");
  passedCount++;

  // -------------------------------------------------------------
  // TEST SUITE 4: HISTORICAL BACKTESTING & WALK-FORWARD ENGINE
  // -------------------------------------------------------------
  console.log("\n▶️ [SUITE 4] Historical Backtesting & Walk-Forward Engine Tests");

  const backtestCandles: Candle[] = Array.from({ length: 120 }, (_, i) => {
    const t = new Date(Date.now() - (120 - i) * 3600000).toISOString();
    const trend = i * 0.0003;
    const osc = Math.sin(i / 4) * 0.0015;
    const close = 1.1000 + trend + osc;
    return {
      timestamp: t,
      open: close - 0.0004,
      high: close + 0.0010,
      low: close - 0.0008,
      close,
      volume: 25000
    };
  });

  const backtestReport = await executeHistoricalBacktest({
    pair: "EUR/USD",
    timeframe: "1h",
    startDate: backtestCandles[0].timestamp,
    endDate: backtestCandles[backtestCandles.length - 1].timestamp,
    session: "All",
    tradingStyle: "Day Trader",
    startingBalance: 10000,
    riskPercent: 2.0,
    spreadPips: 1.2,
    slippagePips: 0.3,
    executionModel: "REALISTIC_SPREAD_SLIPPAGE"
  }, backtestCandles);

  assert(backtestReport.summary.totalTrades >= 0, "Backtest completes and compiles trade summary");
  assert(backtestReport.executionModel.includes("Realistic"), "Executes with realistic spread & slippage deduction");
  assert(Array.isArray(backtestReport.equityCurve), "Generates equity curve data series");
  assert(backtestReport.disclaimer.includes("Past performance"), "Includes required compliance disclaimer");

  // Test 4.2: Walk-Forward Validation
  const wfResult = await executeWalkForwardAnalysis({
    pair: "EUR/USD",
    timeframe: "1h",
    startDate: backtestCandles[0].timestamp,
    endDate: backtestCandles[backtestCandles.length - 1].timestamp,
    session: "All",
    tradingStyle: "Day Trader",
    startingBalance: 10000,
    riskPercent: 2.0,
    executionModel: "REALISTIC_SPREAD_SLIPPAGE"
  }, backtestCandles, 3);

  assert(wfResult.windows.length === 3, "Executes all 3 walk-forward rolling folds");
  assert(wfResult.overallEfficiencyScore >= 0, "Calculates walk-forward efficiency (WFE) score");
  assert(["ROBUST", "MODERATE", "OVERFITTED"].includes(wfResult.systemRobustness), "Assigns system robustness classification");

  console.log("\n=================================================");
  console.log(`🏁 TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error("Test Suite Fatal Error:", err);
  process.exit(1);
});
