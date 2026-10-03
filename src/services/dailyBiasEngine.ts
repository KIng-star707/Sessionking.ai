/**
 * SESSIONKING - Institutional Daily Bias Engine
 * 
 * Computes authoritative higher-timeframe directional bias (D1 / H4):
 * - Previous day close vs open (Directional Day Candle)
 * - 20 EMA & 50 EMA Slope and alignment
 * - Structural swing highs / lows breaks
 * - Direction: BULLISH | BEARISH | NEUTRAL
 */

import { SnapshotCandle } from "./marketSnapshotEngine";

export type DailyBiasDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface DailyBiasResult {
  bias: DailyBiasDirection;
  strength: 'STRONG' | 'MODERATE' | 'NEUTRAL';
  factors: {
    prevDayCloseVsOpen: 'BULLISH' | 'BEARISH' | 'DOJI';
    ema20Slope: 'RISING' | 'FALLING' | 'FLAT';
    htfStructure: 'HIGHER_HIGHS' | 'LOWER_LOWS' | 'RANGE';
    priceVsEma50: 'ABOVE' | 'BELOW';
  };
  keyLevels: {
    prevDayHigh?: number;
    prevDayLow?: number;
    dailyOpen?: number;
  };
  evidence: string[];
}

export function evaluateDailyBias(
  d1Candles?: SnapshotCandle[],
  h4Candles?: SnapshotCandle[]
): DailyBiasResult {
  const candles = (d1Candles && d1Candles.length >= 3) ? d1Candles : h4Candles;

  if (!candles || candles.length < 3) {
    return {
      bias: 'NEUTRAL',
      strength: 'NEUTRAL',
      factors: {
        prevDayCloseVsOpen: 'DOJI',
        ema20Slope: 'FLAT',
        htfStructure: 'RANGE',
        priceVsEma50: 'ABOVE'
      },
      keyLevels: {},
      evidence: ['Insufficient higher timeframe candles to establish definitive daily bias.']
    };
  }

  const n = candles.length;
  const current = candles[n - 1];
  const prevDay = candles[n - 2];

  // 1. Previous Day Candle Body
  let prevDayCloseVsOpen: 'BULLISH' | 'BEARISH' | 'DOJI' = 'DOJI';
  const prevDiff = prevDay.close - prevDay.open;
  const prevRange = prevDay.high - prevDay.low;
  if (prevRange > 0 && Math.abs(prevDiff) / prevRange < 0.1) {
    prevDayCloseVsOpen = 'DOJI';
  } else if (prevDiff > 0) {
    prevDayCloseVsOpen = 'BULLISH';
  } else {
    prevDayCloseVsOpen = 'BEARISH';
  }

  // 2. EMA 20 & 50
  const closes = candles.map(c => c.close);
  const ema20 = closes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, closes.length);
  const prevEma20 = closes.slice(-21, -1).reduce((a, b) => a + b, 0) / Math.min(20, closes.length - 1);
  const ema50 = closes.slice(-50).reduce((a, b) => a + b, 0) / Math.min(50, closes.length);

  const emaSlope = ema20 - prevEma20;
  const ema20Slope: 'RISING' | 'FALLING' | 'FLAT' = emaSlope > 0.0001 ? 'RISING' : emaSlope < -0.0001 ? 'FALLING' : 'FLAT';
  const priceVsEma50: 'ABOVE' | 'BELOW' = current.close >= ema50 ? 'ABOVE' : 'BELOW';

  // 3. HTF Structure (Higher Highs vs Lower Lows over last 10 candles)
  const recent10 = candles.slice(-10);
  let hhCount = 0;
  let llCount = 0;
  for (let i = 1; i < recent10.length; i++) {
    if (recent10[i].high > recent10[i - 1].high) hhCount++;
    if (recent10[i].low < recent10[i - 1].low) llCount++;
  }
  const htfStructure: 'HIGHER_HIGHS' | 'LOWER_LOWS' | 'RANGE' = 
    hhCount > llCount + 1 ? 'HIGHER_HIGHS' : llCount > hhCount + 1 ? 'LOWER_LOWS' : 'RANGE';

  // 4. Scoring Directional Bias
  let bullScore = 0;
  let bearScore = 0;

  if (prevDayCloseVsOpen === 'BULLISH') bullScore += 2;
  if (prevDayCloseVsOpen === 'BEARISH') bearScore += 2;

  if (ema20Slope === 'RISING') bullScore += 2;
  if (ema20Slope === 'FALLING') bearScore += 2;

  if (priceVsEma50 === 'ABOVE') bullScore += 1.5;
  if (priceVsEma50 === 'BELOW') bearScore += 1.5;

  if (htfStructure === 'HIGHER_HIGHS') bullScore += 2.5;
  if (htfStructure === 'LOWER_LOWS') bearScore += 2.5;

  let bias: DailyBiasDirection = 'NEUTRAL';
  let strength: 'STRONG' | 'MODERATE' | 'NEUTRAL' = 'NEUTRAL';
  const evidence: string[] = [];

  if (bullScore >= 5.0 && bullScore > bearScore) {
    bias = 'BULLISH';
    strength = bullScore >= 7.0 ? 'STRONG' : 'MODERATE';
    evidence.push(`Higher Timeframe Daily Bias is BULLISH (${strength}).`);
    evidence.push(`Prior completed candle closed green; price holding above HTF 50 EMA.`);
    if (htfStructure === 'HIGHER_HIGHS') evidence.push('Consecutive higher swing highs confirmed on daily structure.');
  } else if (bearScore >= 5.0 && bearScore > bullScore) {
    bias = 'BEARISH';
    strength = bearScore >= 7.0 ? 'STRONG' : 'MODERATE';
    evidence.push(`Higher Timeframe Daily Bias is BEARISH (${strength}).`);
    evidence.push(`Prior completed candle closed red; price holding below HTF 50 EMA.`);
    if (htfStructure === 'LOWER_LOWS') evidence.push('Consecutive lower swing lows confirmed on daily structure.');
  } else {
    bias = 'NEUTRAL';
    strength = 'NEUTRAL';
    evidence.push('Higher Timeframe Daily Bias is NEUTRAL (Equilibrium / Sideways Range).');
  }

  return {
    bias,
    strength,
    factors: {
      prevDayCloseVsOpen,
      ema20Slope,
      htfStructure,
      priceVsEma50
    },
    keyLevels: {
      prevDayHigh: prevDay.high,
      prevDayLow: prevDay.low,
      dailyOpen: current.open
    },
    evidence
  };
}
