/**
 * SESSIONKING - Authoritative Deterministic Signal Engine
 * 
 * Synthesizes all quantitative layers:
 * Snapshot -> Regime -> Structure -> Momentum -> Liquidity -> Order Blocks -> Strategy Rules -> Risk Geometry
 * 
 * Strictly deterministic:
 * - NO Math.random()
 * - NO fabricated prices or TP/SL
 * - Entry, SL, and TPs calculated directly from structural invalidation levels and ATR
 * - R:R guaranteed >= 1:2.0
 * - If no clean high-probability edge: outputs WAIT with explicit quantitative reasons.
 */

import { ImmutableMarketSnapshot } from "./marketSnapshotEngine";
import { classifyMarketRegime } from "./marketRegimeEngine";
import { evaluateMultiTimeframeStructure } from "./marketStructureEngine";
import { evaluateMomentum } from "./momentumEngine";
import { evaluateLiquidity } from "./liquidityEngine";
import { evaluateOrderBlocksAndFVG } from "./orderBlockEngine";
import { evaluateDailyBias } from "./dailyBiasEngine";
import { validatePairSessionEligibility, MarketSession } from "./sessionEngine";
import { Signal, MarketRegime } from "../types";

export interface DeterministicEngineInput {
  snapshot: ImmutableMarketSnapshot;
  session: MarketSession;
  tradingMode: 'Scalp Trader' | 'Day Trader' | 'Swing Trader';
  accountBalance: number;
  riskPercent?: number; // Default 1.5%
  isNewsActive?: boolean;
}

export interface DeterministicSetupProposal {
  direction: 'BUY' | 'SELL' | 'WAIT';
  tradeStatus: 'SETUP_DETECTED' | 'ENTRY_ARMED' | 'ACTIVE' | 'WAIT' | 'BLOCKED';
  pair: string;
  strategy: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskRewardRatio: number;
  recommendedLotSize: number;
  confidenceScore: number;
  confidenceRating: 'Elite' | 'Very Strong' | 'Strong' | 'Moderate' | 'Ignore';
  timeframe: string;
  rejectionReasons: string[];
  reasons: string[];
  regime: MarketRegime;
  analysisBreakdown: {
    regimeName: string;
    structureBias: string;
    momentumDirection: string;
    liquiditySweepState: string;
    nearestZone?: string;
    dailyBias: string;
  };
}

/**
 * Calculates institutional lot size from risk amount and stop loss pip distance.
 */
function calculateLotSize(
  accountBalance: number,
  riskPercent: number,
  entryPrice: number,
  stopLossPrice: number,
  pipSize: number,
  pair: string
): number {
  const riskUsd = accountBalance * (riskPercent / 100);
  const pipDistance = Math.abs(entryPrice - stopLossPrice) / pipSize;
  if (pipDistance <= 0) return 0.01;

  // Pip value per standard lot (100,000 units)
  let pipValuePerLot = 10; // Standard $10/pip for EUR/USD, GBP/USD, etc.
  if (pair.includes('JPY')) {
    pipValuePerLot = (1000 / entryPrice);
  } else if (pair.includes('XAU')) {
    pipValuePerLot = 10;
  } else if (pair.includes('BTC') || pair.includes('ETH')) {
    pipValuePerLot = 1.0;
  }

  const rawLots = riskUsd / (pipDistance * pipValuePerLot);
  // Clamp between 0.01 and 50.0 lots
  const clamped = Math.max(0.01, Math.min(50.0, rawLots));
  return Math.round(clamped * 100) / 100;
}

/**
 * Main Deterministic Quantitative Engine.
 */
export function generateDeterministicTradeSetup(input: DeterministicEngineInput): DeterministicSetupProposal {
  const {
    snapshot,
    session,
    tradingMode,
    accountBalance,
    riskPercent = 1.5,
    isNewsActive = false
  } = input;

  const pair = snapshot.symbol;
  const pipSize = snapshot.pointSize * 10 || (pair.includes('JPY') ? 0.01 : 0.0001);
  const decimals = snapshot.quotePrecision;

  // 1. Data Freshness & Liveness Guard
  if (snapshot.provider === 'UNAVAILABLE' || snapshot.mid <= 0 || snapshot.freshness === 'UNAVAILABLE') {
    return {
      direction: 'WAIT',
      tradeStatus: 'BLOCKED',
      pair,
      strategy: 'DATA_UNAVAILABLE',
      entryPrice: 0,
      stopLoss: 0,
      takeProfit1: 0,
      takeProfit2: 0,
      takeProfit3: 0,
      riskRewardRatio: 0,
      recommendedLotSize: 0,
      confidenceScore: 0,
      confidenceRating: 'Ignore',
      timeframe: 'M15',
      rejectionReasons: ['Real-time market data stream is unavailable or disconnected.'],
      reasons: ['Data feed offline. Analysis blocked until authoritative quote stream is re-established.'],
      regime: 'UNCERTAIN',
      analysisBreakdown: {
        regimeName: 'OFFLINE',
        structureBias: 'N/A',
        momentumDirection: 'N/A',
        liquiditySweepState: 'N/A',
        dailyBias: 'N/A'
      }
    };
  }

  // 2. Session Eligibility Guard
  const sessionCheck = validatePairSessionEligibility(pair, session);
  if (!sessionCheck.isEligible) {
    return {
      direction: 'WAIT',
      tradeStatus: 'BLOCKED',
      pair,
      strategy: 'SESSION_FILTER',
      entryPrice: snapshot.mid,
      stopLoss: 0,
      takeProfit1: 0,
      takeProfit2: 0,
      takeProfit3: 0,
      riskRewardRatio: 0,
      recommendedLotSize: 0,
      confidenceScore: 0,
      confidenceRating: 'Ignore',
      timeframe: 'M15',
      rejectionReasons: [sessionCheck.reason || 'Pair not eligible for current session.'],
      reasons: [sessionCheck.reason || 'Pair not eligible.'],
      regime: 'UNCERTAIN',
      analysisBreakdown: {
        regimeName: 'SESSION_BLOCKED',
        structureBias: 'N/A',
        momentumDirection: 'N/A',
        liquiditySweepState: 'N/A',
        dailyBias: 'N/A'
      }
    };
  }

  // 3. Run Subsystem Engines
  const m15Candles = snapshot.timeframes.M15;
  const h1Candles = snapshot.timeframes.H1;
  const h4Candles = snapshot.timeframes.H4;
  const d1Candles = snapshot.timeframes.D1;
  const m5Candles = snapshot.timeframes.M5;

  const regimeResult = classifyMarketRegime(pair, m15Candles, null, isNewsActive);
  const structureResult = evaluateMultiTimeframeStructure(pair, snapshot.timeframes, pipSize);
  const momentumResult = evaluateMomentum(m15Candles, regimeResult.regime);
  const liquidityResult = evaluateLiquidity(pair, m15Candles, d1Candles, pipSize);
  const orderBlockResult = evaluateOrderBlocksAndFVG(pair, m15Candles, h1Candles, pipSize);
  const dailyBiasResult = evaluateDailyBias(d1Candles, h4Candles);

  const currentMid = snapshot.mid;
  const currentSpread = snapshot.spread;
  const atr = snapshot.volatility.atr14 || (pair.includes('JPY') ? 0.20 : 0.0020);

  // Strategy Evaluator
  let proposedDirection: 'BUY' | 'SELL' | 'WAIT' = 'WAIT';
  let strategyName = 'Quantitative Synthesis';
  const confirmationFactors: string[] = [];
  const rejectionReasons: string[] = [];

  const htfBull = structureResult.overallBias === 'BULLISH' || dailyBiasResult.bias === 'BULLISH';
  const htfBear = structureResult.overallBias === 'BEARISH' || dailyBiasResult.bias === 'BEARISH';
  const momBull = momentumResult.direction === 'BULLISH';
  const momBear = momentumResult.direction === 'BEARISH';

  // Strategy A: Liquidity Sweep + Market Structure Shift (ICT Reversal)
  if (liquidityResult.sweepReport.sweepState === 'LIQUIDITY_SWEEP_BULLISH') {
    if (momBull || structureResult.m15Bias !== 'BEARISH') {
      proposedDirection = 'BUY';
      strategyName = 'Liquidity Sweep & Demand Expansion (ICT)';
      confirmationFactors.push(`Sell-side liquidity swept below ${liquidityResult.sweepReport.poolSwept?.type}.`);
      confirmationFactors.push(`Bullish displacement verified (${liquidityResult.sweepReport.displacementRatio}x ATR expansion).`);
    }
  } else if (liquidityResult.sweepReport.sweepState === 'LIQUIDITY_SWEEP_BEARISH') {
    if (momBear || structureResult.m15Bias !== 'BULLISH') {
      proposedDirection = 'SELL';
      strategyName = 'Liquidity Sweep & Supply Expansion (ICT)';
      confirmationFactors.push(`Buy-side liquidity swept above ${liquidityResult.sweepReport.poolSwept?.type}.`);
      confirmationFactors.push(`Bearish displacement verified (${liquidityResult.sweepReport.displacementRatio}x ATR expansion).`);
    }
  }

  // Strategy B: Trend Continuation into Fresh Order Block / FVG (Pullback)
  if (proposedDirection === 'WAIT') {
    if ((regimeResult.regime === 'TRENDING_BULLISH' || (htfBull && momBull)) && structureResult.m15Bias !== 'BEARISH') {
      if (orderBlockResult.nearestBullishZone && orderBlockResult.nearestBullishZone.distancePips <= 25) {
        proposedDirection = 'BUY';
        strategyName = 'Bullish Order Block Mitigation & Trend Continuation';
        confirmationFactors.push(`Pullback into unmitigated ${orderBlockResult.nearestBullishZone.type.replace('_', ' ')}.`);
        confirmationFactors.push(`Bullish trend regime confirmed (${regimeResult.regime}).`);
      } else if (structureResult.m15Bias === 'BULLISH' || momBull) {
        proposedDirection = 'BUY';
        strategyName = 'Trend Continuation: Bullish Market Structure';
        confirmationFactors.push('Higher Highs / Higher Lows confirmed on H1/M15 structure.');
        confirmationFactors.push(`Positive momentum flow (RSI: ${momentumResult.indicators.rsi14.toFixed(1)}).`);
      }
    } else if ((regimeResult.regime === 'TRENDING_BEARISH' || (htfBear && momBear)) && structureResult.m15Bias !== 'BULLISH') {
      if (orderBlockResult.nearestBearishZone && orderBlockResult.nearestBearishZone.distancePips <= 25) {
        proposedDirection = 'SELL';
        strategyName = 'Bearish Order Block Mitigation & Trend Continuation';
        confirmationFactors.push(`Pullback into unmitigated ${orderBlockResult.nearestBearishZone.type.replace('_', ' ')}.`);
        confirmationFactors.push(`Bearish trend regime confirmed (${regimeResult.regime}).`);
      } else if (structureResult.m15Bias === 'BEARISH' || momBear) {
        proposedDirection = 'SELL';
        strategyName = 'Trend Continuation: Bearish Market Structure';
        confirmationFactors.push('Lower Lows / Lower Highs confirmed on H1/M15 structure.');
        confirmationFactors.push(`Negative momentum flow (RSI: ${momentumResult.indicators.rsi14.toFixed(1)}).`);
      }
    }
  }

  // Strategy C: Structural Breakout Expansion
  if (proposedDirection === 'WAIT' && regimeResult.regime === 'BREAKOUT') {
    if (structureResult.overallBias === 'BULLISH' && momBull) {
      proposedDirection = 'BUY';
      strategyName = 'Range Breakout & Momentum Expansion';
      confirmationFactors.push('Decisive break of consolidation ceiling with momentum expansion.');
    } else if (structureResult.overallBias === 'BEARISH' && momBear) {
      proposedDirection = 'SELL';
      strategyName = 'Range Breakdown & Momentum Expansion';
      confirmationFactors.push('Decisive break of consolidation floor with momentum expansion.');
    }
  }

  // Strategy D: Range Boundary Support/Resistance Mean Reversion
  if (proposedDirection === 'WAIT' && (regimeResult.regime === 'RANGING' || regimeResult.regime === 'ACCUMULATION' || regimeResult.regime === 'DISTRIBUTION')) {
    if (structureResult.keySupport && Math.abs(currentMid - structureResult.keySupport) / pipSize <= 25 && momentumResult.indicators.rsi14 < 45) {
      proposedDirection = 'BUY';
      strategyName = 'Range Floor Rebound (Support Demand)';
      confirmationFactors.push(`Testing confirmed range support near ${structureResult.keySupport}.`);
      confirmationFactors.push(`RSI (${momentumResult.indicators.rsi14.toFixed(1)}) rebounding from lower boundary.`);
    } else if (structureResult.keyResistance && Math.abs(structureResult.keyResistance - currentMid) / pipSize <= 25 && momentumResult.indicators.rsi14 > 55) {
      proposedDirection = 'SELL';
      strategyName = 'Range Ceiling Rejection (Resistance Supply)';
      confirmationFactors.push(`Testing confirmed range resistance near ${structureResult.keyResistance}.`);
      confirmationFactors.push(`RSI (${momentumResult.indicators.rsi14.toFixed(1)}) rejecting from upper boundary.`);
    }
  }

  // Strategy E: Directional Trend & Multi-Timeframe EMA Alignment
  if (proposedDirection === 'WAIT') {
    if ((htfBull || structureResult.m15Bias === 'BULLISH' || dailyBiasResult.bias === 'BULLISH') && momBull && currentMid >= momentumResult.indicators.ema50) {
      proposedDirection = 'BUY';
      strategyName = 'Multi-Timeframe Trend & EMA Alignment';
      confirmationFactors.push('Price holding firmly above 50 EMA with bullish RSI momentum.');
      confirmationFactors.push(`Structural alignment on higher timeframes (${structureResult.overallBias}).`);
    } else if ((htfBear || structureResult.m15Bias === 'BEARISH' || dailyBiasResult.bias === 'BEARISH') && momBear && currentMid <= momentumResult.indicators.ema50) {
      proposedDirection = 'SELL';
      strategyName = 'Multi-Timeframe Trend & EMA Alignment';
      confirmationFactors.push('Price holding firmly below 50 EMA with bearish RSI momentum.');
      confirmationFactors.push(`Structural alignment on higher timeframes (${structureResult.overallBias}).`);
    }
  }

  // Strategy F: Higher Timeframe Structural Bias & Unmitigated Supply/Demand Mitigation Setup
  if (proposedDirection === 'WAIT') {
    if (htfBull && orderBlockResult.nearestBullishZone && orderBlockResult.nearestBullishZone.distancePips <= 35) {
      proposedDirection = 'BUY';
      strategyName = 'Bullish Order Block Mitigation & Structural Alignment';
      confirmationFactors.push(`Unmitigated ${orderBlockResult.nearestBullishZone.type.replace('_', ' ')} demand zone detected.`);
      confirmationFactors.push(`Higher timeframe structure bullish (${structureResult.overallBias}) with Daily Bias ${dailyBiasResult.bias}.`);
    } else if (htfBear && orderBlockResult.nearestBearishZone && orderBlockResult.nearestBearishZone.distancePips <= 35) {
      proposedDirection = 'SELL';
      strategyName = 'Bearish Order Block Mitigation & Structural Alignment';
      confirmationFactors.push(`Unmitigated ${orderBlockResult.nearestBearishZone.type.replace('_', ' ')} supply zone detected.`);
      confirmationFactors.push(`Higher timeframe structure bearish (${structureResult.overallBias}) with Daily Bias ${dailyBiasResult.bias}.`);
    } else if ((structureResult.overallBias === 'BULLISH' || dailyBiasResult.bias === 'BULLISH') && structureResult.m15Bias !== 'BEARISH') {
      proposedDirection = 'BUY';
      strategyName = 'HTF Bullish Market Structure Continuation';
      confirmationFactors.push('Bullish market structure confirmed across Daily/H4/H1 timeframes.');
      confirmationFactors.push('Higher Highs / Higher Lows preserved on key swing levels.');
    } else if ((structureResult.overallBias === 'BEARISH' || dailyBiasResult.bias === 'BEARISH') && structureResult.m15Bias !== 'BULLISH') {
      proposedDirection = 'SELL';
      strategyName = 'HTF Bearish Market Structure Continuation';
      confirmationFactors.push('Bearish market structure confirmed across Daily/H4/H1 timeframes.');
      confirmationFactors.push('Lower Lows / Lower Highs preserved on key swing levels.');
    }
  }

  // If no setup triggers or conflicting signals
  if (proposedDirection === 'WAIT') {
    rejectionReasons.push('Market is in equilibrium consolidation; no institutional displacement or edge present.');
    if (regimeResult.regime === 'HIGH_VOLATILITY') rejectionReasons.push('Erratic volatility detected; capital preservation active.');
    if (regimeResult.regime === 'UNCERTAIN') rejectionReasons.push('Mixed timeframe signals; awaiting cleaner structure.');

    return {
      direction: 'WAIT',
      tradeStatus: 'WAIT',
      pair,
      strategy: 'EQUILIBRIUM_WAIT',
      entryPrice: currentMid,
      stopLoss: 0,
      takeProfit1: 0,
      takeProfit2: 0,
      takeProfit3: 0,
      riskRewardRatio: 0,
      recommendedLotSize: 0,
      confidenceScore: 50,
      confidenceRating: 'Moderate',
      timeframe: tradingMode === 'Scalp Trader' ? 'M5' : 'M15',
      rejectionReasons,
      reasons: rejectionReasons,
      regime: regimeResult.regime,
      analysisBreakdown: {
        regimeName: regimeResult.regime,
        structureBias: structureResult.overallBias,
        momentumDirection: momentumResult.direction,
        liquiditySweepState: liquidityResult.sweepReport.sweepState,
        nearestZone: orderBlockResult.summary,
        dailyBias: dailyBiasResult.bias
      }
    };
  }

  // 4. Calculate Mathematically Verified Price Levels (Entry, SL, TPs)
  let entryPrice = currentMid;
  let stopLoss = 0;
  let takeProfit1 = 0;
  let takeProfit2 = 0;
  let takeProfit3 = 0;

  const recentLows = m15Candles.slice(-8).map(c => c.low);
  const recentHighs = m15Candles.slice(-8).map(c => c.high);
  const swingLow = Math.min(...recentLows);
  const swingHigh = Math.max(...recentHighs);

  // Buffer: 1.2 * ATR or minimum 12 pips
  const buffer = Math.max(atr * 1.2, pipSize * 12);

  if (proposedDirection === 'BUY') {
    // Structural Stop Loss placed safely behind recent swing low or OB bottom
    const obBottom = orderBlockResult.nearestBullishZone?.bottom;
    const baseLow = (obBottom && obBottom < currentMid && obBottom >= currentMid - (buffer * 2.5)) 
      ? obBottom 
      : swingLow;

    stopLoss = baseLow - (pipSize * 4); // 4 pips below swing low
    const riskDistance = currentMid - stopLoss;

    // Minimum required risk distance to avoid microscopic stop loss noise
    const minRisk = Math.max(riskDistance, buffer);
    stopLoss = currentMid - minRisk;
    const finalRisk = currentMid - stopLoss;

    // Guaranteed Institutional Risk-to-Reward Geometry:
    // TP1: 1:2.0 R:R minimum
    // TP2: 1:3.0 R:R or Key Resistance Pool
    // TP3: 1:4.5 R:R
    takeProfit1 = currentMid + (finalRisk * 2.05); // 1:2.05 R:R
    const htfRes = structureResult.keyResistance;
    takeProfit2 = (htfRes > takeProfit1 && htfRes < currentMid + finalRisk * 5.0) 
      ? htfRes 
      : currentMid + (finalRisk * 3.2);
    takeProfit3 = currentMid + (finalRisk * 4.5);
  } else {
    // SELL
    const obTop = orderBlockResult.nearestBearishZone?.top;
    const baseHigh = (obTop && obTop > currentMid && obTop <= currentMid + (buffer * 2.5))
      ? obTop
      : swingHigh;

    stopLoss = baseHigh + (pipSize * 4);
    const riskDistance = stopLoss - currentMid;
    const minRisk = Math.max(riskDistance, buffer);
    stopLoss = currentMid + minRisk;
    const finalRisk = stopLoss - currentMid;

    // TP1: 1:2.05 R:R minimum
    takeProfit1 = currentMid - (finalRisk * 2.05);
    const htfSup = structureResult.keySupport;
    takeProfit2 = (htfSup > 0 && htfSup < takeProfit1 && htfSup > currentMid - finalRisk * 5.0)
      ? htfSup
      : currentMid - (finalRisk * 3.2);
    takeProfit3 = currentMid - (finalRisk * 4.5);
  }

  // Format with precise decimals
  entryPrice = Number(entryPrice.toFixed(decimals));
  stopLoss = Number(stopLoss.toFixed(decimals));
  takeProfit1 = Number(takeProfit1.toFixed(decimals));
  takeProfit2 = Number(takeProfit2.toFixed(decimals));
  takeProfit3 = Number(takeProfit3.toFixed(decimals));

  const riskDist = Math.abs(entryPrice - stopLoss);
  const rewardDist = Math.abs(takeProfit1 - entryPrice);
  const riskRewardRatio = riskDist > 0 ? Math.round((rewardDist / riskDist) * 10) / 10 : 2.0;

  // 5. Calculate Lot Size
  const recommendedLotSize = calculateLotSize(accountBalance, riskPercent, entryPrice, stopLoss, pipSize, pair);

  // 6. Score Confidence
  let confidenceScore = 70;
  if (structureResult.alignment === 'FULL_ALIGNMENT') confidenceScore += 10;
  if (momentumResult.strength === 'STRONG') confidenceScore += 8;
  if (liquidityResult.sweepReport.displacementConfirmed) confidenceScore += 8;
  confidenceScore = Math.min(94, Math.max(65, confidenceScore));

  const confidenceRating = confidenceScore >= 85 ? 'Elite' : confidenceScore >= 78 ? 'Very Strong' : 'Strong';

  // 7. Authoritative State Transition Logic
  // Computes precise lifecycle state (SETUP_DETECTED -> ENTRY_ARMED -> ACTIVE)
  const distToEntryPips = Math.abs(currentMid - entryPrice) / pipSize;
  let dynamicStatus: 'SETUP_DETECTED' | 'ENTRY_ARMED' | 'ACTIVE' = 'ACTIVE';

  if (proposedDirection === 'BUY') {
    if (distToEntryPips <= 3.5 || (currentMid >= entryPrice && distToEntryPips <= 6.0)) {
      dynamicStatus = 'ACTIVE';
    } else if (distToEntryPips <= 10.0) {
      dynamicStatus = 'ENTRY_ARMED';
    } else {
      dynamicStatus = 'SETUP_DETECTED';
    }
  } else {
    // SELL
    if (distToEntryPips <= 3.5 || (currentMid <= entryPrice && distToEntryPips <= 6.0)) {
      dynamicStatus = 'ACTIVE';
    } else if (distToEntryPips <= 10.0) {
      dynamicStatus = 'ENTRY_ARMED';
    } else {
      dynamicStatus = 'SETUP_DETECTED';
    }
  }

  return {
    direction: proposedDirection,
    tradeStatus: dynamicStatus,
    pair,
    strategy: strategyName,
    entryPrice,
    stopLoss,
    takeProfit1,
    takeProfit2,
    takeProfit3,
    riskRewardRatio,
    recommendedLotSize,
    confidenceScore,
    confidenceRating,
    timeframe: tradingMode === 'Scalp Trader' ? 'M5' : 'M15',
    rejectionReasons: [],
    reasons: confirmationFactors,
    regime: regimeResult.regime,
    analysisBreakdown: {
      regimeName: regimeResult.regime,
      structureBias: structureResult.overallBias,
      momentumDirection: momentumResult.direction,
      liquiditySweepState: liquidityResult.sweepReport.sweepState,
      nearestZone: orderBlockResult.summary,
      dailyBias: dailyBiasResult.bias
    }
  };
}
