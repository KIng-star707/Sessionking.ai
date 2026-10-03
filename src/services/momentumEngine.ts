/**
 * SESSIONKING - Contextual Momentum & Technical Engine
 * 
 * Calculates indicators from authentic OHLC data:
 * - RSI 14 with dynamic overbought/oversold regime thresholds
 * - MACD (12, 26, 9) signal line & histogram
 * - EMAs: 20, 50, 200
 * - Bollinger Bands (20, 2)
 * - ATR 14
 * 
 * Contextual Interpretation:
 * RSI > 70 in a strong bullish trend confirms strong momentum, not an automatic short.
 * RSI < 30 in a strong bearish trend confirms bearish velocity.
 */

import { SnapshotCandle } from "./marketSnapshotEngine";
import { MarketRegime } from "../types";

export interface TechnicalIndicators {
  rsi14: number;
  macd: {
    macdLine: number;
    signalLine: number;
    histogram: number;
    crossEvent: 'BULLISH_CROSS' | 'BEARISH_CROSS' | 'NONE';
  };
  ema20: number;
  ema50: number;
  ema200?: number;
  emaAlignment: 'BULLISH_STACK' | 'BEARISH_STACK' | 'COMPRESSED' | 'MIXED';
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;
    percentB: number;
  };
  atr14: number;
}

export interface MomentumEvaluation {
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  strength: 'WEAK' | 'MODERATE' | 'STRONG';
  indicators: TechnicalIndicators;
  rsiInterpretation: string;
  macdInterpretation: string;
  divergenceDetected: 'BULLISH_DIVERGENCE' | 'BEARISH_DIVERGENCE' | 'NONE';
  summary: string;
}

/**
 * Calculates Relative Strength Index (RSI 14).
 */
export function calculateRSI(closes: number[], period = 14): number {
  if (!closes || closes.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  return Math.round(rsi * 10) / 10;
}

/**
 * Calculates EMA series.
 */
function calculateEMASeries(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const emaSeries: number[] = [];
  let ema = values.slice(0, Math.min(period, values.length)).reduce((a, b) => a + b, 0) / Math.min(period, values.length);
  emaSeries.push(ema);

  for (let i = 1; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    emaSeries.push(ema);
  }
  return emaSeries;
}

/**
 * Calculates MACD (12, 26, 9).
 */
export function calculateMACD(closes: number[]): {
  macdLine: number;
  signalLine: number;
  histogram: number;
  crossEvent: 'BULLISH_CROSS' | 'BEARISH_CROSS' | 'NONE';
} {
  if (!closes || closes.length < 35) {
    return { macdLine: 0, signalLine: 0, histogram: 0, crossEvent: 'NONE' };
  }

  const ema12 = calculateEMASeries(closes, 12);
  const ema26 = calculateEMASeries(closes, 26);
  const macdSeries: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    macdSeries.push(ema12[i] - ema26[i]);
  }

  const signalSeries = calculateEMASeries(macdSeries, 9);
  const n = macdSeries.length;
  const currentMacd = macdSeries[n - 1];
  const currentSignal = signalSeries[signalSeries.length - 1];
  const prevMacd = macdSeries[n - 2];
  const prevSignal = signalSeries[signalSeries.length - 2];
  const histogram = currentMacd - currentSignal;

  let crossEvent: 'BULLISH_CROSS' | 'BEARISH_CROSS' | 'NONE' = 'NONE';
  if (prevMacd <= prevSignal && currentMacd > currentSignal) {
    crossEvent = 'BULLISH_CROSS';
  } else if (prevMacd >= prevSignal && currentMacd < currentSignal) {
    crossEvent = 'BEARISH_CROSS';
  }

  return {
    macdLine: Math.round(currentMacd * 100000) / 100000,
    signalLine: Math.round(currentSignal * 100000) / 100000,
    histogram: Math.round(histogram * 100000) / 100000,
    crossEvent
  };
}

/**
 * Calculates Bollinger Bands (20, 2).
 */
export function calculateBollingerBands(closes: number[], period = 20, multiplier = 2): {
  upper: number;
  middle: number;
  lower: number;
  bandwidth: number;
  percentB: number;
} {
  if (!closes || closes.length < period) {
    const p = closes[closes.length - 1] || 1;
    return { upper: p * 1.01, middle: p, lower: p * 0.99, bandwidth: 0.02, percentB: 0.5 };
  }

  const slice = closes.slice(-period);
  const sma = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + Math.pow(b - sma, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  const upper = sma + multiplier * stdDev;
  const lower = sma - multiplier * stdDev;
  const bandwidth = sma > 0 ? (upper - lower) / sma : 0;
  const lastPrice = closes[closes.length - 1];
  const percentB = (upper - lower) > 0 ? (lastPrice - lower) / (upper - lower) : 0.5;

  return {
    upper: Math.round(upper * 100000) / 100000,
    middle: Math.round(sma * 100000) / 100000,
    lower: Math.round(lower * 100000) / 100000,
    bandwidth: Math.round(bandwidth * 1000) / 1000,
    percentB: Math.round(percentB * 100) / 100
  };
}

/**
 * Checks for RSI price divergence over recent swings.
 */
function detectRsiDivergence(candles: SnapshotCandle[], rsiPeriod = 14): 'BULLISH_DIVERGENCE' | 'BEARISH_DIVERGENCE' | 'NONE' {
  if (!candles || candles.length < 25) return 'NONE';
  const closes = candles.map(c => c.close);
  const currRsi = calculateRSI(closes, rsiPeriod);
  const prevSlice = closes.slice(0, -6);
  const prevRsi = calculateRSI(prevSlice, rsiPeriod);

  const currClose = closes[closes.length - 1];
  const prevClose = prevSlice[prevSlice.length - 1];

  // Bullish Divergence: Lower Low in price, but Higher Low in RSI
  if (currClose < prevClose && currRsi > prevRsi && currRsi < 45) {
    return 'BULLISH_DIVERGENCE';
  }
  // Bearish Divergence: Higher High in price, but Lower High in RSI
  if (currClose > prevClose && currRsi < prevRsi && currRsi > 55) {
    return 'BEARISH_DIVERGENCE';
  }

  return 'NONE';
}

/**
 * Evaluates full contextual momentum for a candlestick series in light of market regime.
 */
export function evaluateMomentum(
  candles: SnapshotCandle[],
  regime: MarketRegime = 'RANGING'
): MomentumEvaluation {
  if (!candles || candles.length < 15) {
    return {
      direction: 'NEUTRAL',
      strength: 'WEAK',
      indicators: {
        rsi14: 50,
        macd: { macdLine: 0, signalLine: 0, histogram: 0, crossEvent: 'NONE' },
        ema20: 0,
        ema50: 0,
        emaAlignment: 'COMPRESSED',
        bollingerBands: { upper: 0, middle: 0, lower: 0, bandwidth: 0, percentB: 0.5 },
        atr14: 0
      },
      rsiInterpretation: 'Neutral equilibrium',
      macdInterpretation: 'Flat momentum',
      divergenceDetected: 'NONE',
      summary: 'Insufficient data for complete momentum calculation.'
    };
  }

  const closes = candles.map(c => c.close);
  const rsi14 = calculateRSI(closes, 14);
  const macd = calculateMACD(closes);
  const bb = calculateBollingerBands(closes, 20, 2);

  const emaSeries20 = calculateEMASeries(closes, 20);
  const emaSeries50 = calculateEMASeries(closes, 50);
  const ema20 = emaSeries20[emaSeries20.length - 1];
  const ema50 = emaSeries50[emaSeries50.length - 1];
  const ema200 = closes.length >= 200 ? calculateEMASeries(closes, 200).pop() : undefined;

  // EMA Alignment
  let emaAlignment: 'BULLISH_STACK' | 'BEARISH_STACK' | 'COMPRESSED' | 'MIXED' = 'MIXED';
  const lastPrice = closes[closes.length - 1];
  if (lastPrice > ema20 && ema20 > ema50 && (!ema200 || ema50 > ema200)) {
    emaAlignment = 'BULLISH_STACK';
  } else if (lastPrice < ema20 && ema20 < ema50 && (!ema200 || ema50 < ema200)) {
    emaAlignment = 'BEARISH_STACK';
  } else if (Math.abs(ema20 - ema50) / ema50 < 0.0005) {
    emaAlignment = 'COMPRESSED';
  }

  // ATR
  let trSum = 0;
  for (let i = 1; i < Math.min(15, candles.length); i++) {
    const c = candles[candles.length - i];
    const p = candles[candles.length - i - 1];
    trSum += Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close));
  }
  const atr14 = trSum / Math.min(14, candles.length - 1);

  // Divergence check
  const divergence = detectRsiDivergence(candles);

  // Contextual RSI Interpretation
  let rsiInterpretation = '';
  const isBullTrend = regime === 'TRENDING_BULLISH' || regime === 'BREAKOUT';
  const isBearTrend = regime === 'TRENDING_BEARISH';

  if (rsi14 >= 70) {
    if (isBullTrend) {
      rsiInterpretation = `RSI ${rsi14} reflects strong institutional trend velocity (Bullish Continuation), not an overbought short.`;
    } else {
      rsiInterpretation = `RSI ${rsi14} at upper range extreme; mean-reversion caution advised.`;
    }
  } else if (rsi14 <= 30) {
    if (isBearTrend) {
      rsiInterpretation = `RSI ${rsi14} reflects strong downward institutional momentum (Bearish Continuation), not an oversold long.`;
    } else {
      rsiInterpretation = `RSI ${rsi14} at lower range extreme; potential absorption zone.`;
    }
  } else if (rsi14 > 50) {
    rsiInterpretation = `RSI ${rsi14} holding above 50 midline; buyers maintaining directional control.`;
  } else {
    rsiInterpretation = `RSI ${rsi14} holding below 50 midline; sellers maintaining directional control.`;
  }

  // Contextual MACD Interpretation
  let macdInterpretation = '';
  if (macd.crossEvent === 'BULLISH_CROSS') {
    macdInterpretation = 'Fresh bullish MACD crossover confirmed above signal line.';
  } else if (macd.crossEvent === 'BEARISH_CROSS') {
    macdInterpretation = 'Fresh bearish MACD crossover confirmed below signal line.';
  } else if (macd.histogram > 0) {
    macdInterpretation = `Positive MACD histogram (${macd.histogram.toFixed(5)}) indicates bullish momentum expansion.`;
  } else {
    macdInterpretation = `Negative MACD histogram (${macd.histogram.toFixed(5)}) indicates bearish momentum expansion.`;
  }

  // Direction & Strength Synthesis
  let bullishPoints = 0;
  let bearishPoints = 0;

  if (rsi14 > 52) bullishPoints += 1.5;
  if (rsi14 < 48) bearishPoints += 1.5;

  if (macd.histogram > 0) bullishPoints += 1.5;
  if (macd.histogram < 0) bearishPoints += 1.5;
  if (macd.crossEvent === 'BULLISH_CROSS') bullishPoints += 1.0;
  if (macd.crossEvent === 'BEARISH_CROSS') bearishPoints += 1.0;

  if (emaAlignment === 'BULLISH_STACK') bullishPoints += 2.0;
  if (emaAlignment === 'BEARISH_STACK') bearishPoints += 2.0;

  if (divergence === 'BULLISH_DIVERGENCE') bullishPoints += 2.5;
  if (divergence === 'BEARISH_DIVERGENCE') bearishPoints += 2.5;

  let direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let strength: 'WEAK' | 'MODERATE' | 'STRONG' = 'MODERATE';

  if (bullishPoints >= 3.5 && bullishPoints > bearishPoints) {
    direction = 'BULLISH';
    strength = bullishPoints >= 5.0 ? 'STRONG' : 'MODERATE';
  } else if (bearishPoints >= 3.5 && bearishPoints > bullishPoints) {
    direction = 'BEARISH';
    strength = bearishPoints >= 5.0 ? 'STRONG' : 'MODERATE';
  }

  const summary = `${direction} Momentum [${strength}]. RSI 14: ${rsi14}, MACD Hist: ${macd.histogram.toFixed(5)}, EMAs: ${emaAlignment}.`;

  return {
    direction,
    strength,
    indicators: {
      rsi14,
      macd,
      ema20: Math.round(ema20 * 100000) / 100000,
      ema50: Math.round(ema50 * 100000) / 100000,
      ema200: ema200 ? Math.round(ema200 * 100000) / 100000 : undefined,
      emaAlignment,
      bollingerBands: bb,
      atr14: Math.round(atr14 * 100000) / 100000
    },
    rsiInterpretation,
    macdInterpretation,
    divergenceDetected: divergence,
    summary
  };
}
