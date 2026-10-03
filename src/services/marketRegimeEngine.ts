import type { MarketRegime, RegimeClassification } from "../types";
import type { MarketState } from "./marketDataService";

export interface OHLC {
  timestamp?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface RegimeMetrics {
  adx: number;
  plusDI: number;
  minusDI: number;
  atr14: number;
  ema20: number;
  ema50: number;
  ema200?: number;
  rangeRatio: number;
  trendEfficiency: number;
  higherHighsCount: number;
  lowerLowsCount: number;
}

// In-memory regime tracker for transition detection per pair
const previousRegimes = new Map<string, { regime: MarketRegime; timestamp: number }>();

/**
 * Calculates Exponential Moving Average.
 */
function calculateEMA(values: number[], period: number): number {
  if (values.length === 0) return 0;
  if (values.length < period) {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
  const k = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }
  return ema;
}

/**
 * Calculates Average Directional Index (ADX 14) along with +DI and -DI.
 */
function calculateADX(candles: OHLC[], period = 14): { adx: number; plusDI: number; minusDI: number } {
  if (!candles || candles.length < period + 2) {
    return { adx: 20, plusDI: 20, minusDI: 20 };
  }

  const trs: number[] = [];
  const plusDMs: number[] = [];
  const minusDMs: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const curr = candles[i];
    const prev = candles[i - 1];

    const tr = Math.max(
      curr.high - curr.low,
      Math.abs(curr.high - prev.close),
      Math.abs(curr.low - prev.close)
    );
    trs.push(tr);

    const upMove = curr.high - prev.high;
    const downMove = prev.low - curr.low;

    plusDMs.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDMs.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  if (trs.length < period) {
    return { adx: 20, plusDI: 20, minusDI: 20 };
  }

  // Wilder's smoothing
  let trSum = trs.slice(0, period).reduce((a, b) => a + b, 0);
  let plusDMSum = plusDMs.slice(0, period).reduce((a, b) => a + b, 0);
  let minusDMSum = minusDMs.slice(0, period).reduce((a, b) => a + b, 0);

  const dxList: number[] = [];

  for (let i = period; i < trs.length; i++) {
    trSum = trSum - trSum / period + trs[i];
    plusDMSum = plusDMSum - plusDMSum / period + plusDMs[i];
    minusDMSum = minusDMSum - minusDMSum / period + minusDMs[i];

    const plusDI = trSum > 0 ? (plusDMSum / trSum) * 100 : 0;
    const minusDI = trSum > 0 ? (minusDMSum / trSum) * 100 : 0;
    const diSum = plusDI + minusDI;
    const dx = diSum > 0 ? (Math.abs(plusDI - minusDI) / diSum) * 100 : 0;
    dxList.push(dx);
  }

  const finalPlusDI = trSum > 0 ? (plusDMSum / trSum) * 100 : 20;
  const finalMinusDI = trSum > 0 ? (minusDMSum / trSum) * 100 : 20;
  const adx = dxList.length > 0 ? dxList.reduce((a, b) => a + b, 0) / dxList.length : 20;

  return { adx: Math.round(adx * 10) / 10, plusDI: Math.round(finalPlusDI * 10) / 10, minusDI: Math.round(finalMinusDI * 10) / 10 };
}

/**
 * Deterministic Market-Regime Engine
 * Classifies market into:
 * • TRENDING_BULLISH
 * • TRENDING_BEARISH
 * • RANGING
 * • BREAKOUT
 * • ACCUMULATION
 * • DISTRIBUTION
 * • HIGH_VOLATILITY
 * • LOW_LIQUIDITY
 * • UNCERTAIN
 */
export function classifyMarketRegime(
  pair: string,
  candles: OHLC[],
  currentState?: MarketState | null,
  isNewsActive: boolean = false
): RegimeClassification {
  const previous = previousRegimes.get(pair);

  if (!candles || candles.length < 5) {
    const defaultRegime: RegimeClassification = {
      regime: 'UNCERTAIN',
      confidence: 60,
      evidence: ['Insufficient candlestick depth to determine structural regime.'],
      riskState: 'NORMAL',
      transitionDetected: false,
      characteristics: ['Awaiting Data Depth', 'Unconfirmed State']
    };
    return defaultRegime;
  }

  // Active high-impact news filter
  if (isNewsActive) {
    const result: RegimeClassification = {
      regime: 'NEWS_EVENT_RISK',
      confidence: 90,
      evidence: [
        'Active high-impact macroeconomic event window detected.',
        'Order book spread variance and liquidity withdrawal in progress.'
      ],
      riskState: 'HIGH',
      transitionDetected: previous?.regime !== 'NEWS_EVENT_RISK' && previous !== undefined,
      previousRegime: previous?.regime,
      characteristics: ['Event Volatility Spike', 'Spread Expansion', 'Execution Slip Hazard']
    };
    previousRegimes.set(pair, { regime: result.regime, timestamp: Date.now() });
    return result;
  }

  const closes = candles.map(c => c.close);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const ema200 = closes.length >= 200 ? calculateEMA(closes, 200) : undefined;

  // ADX 14, +DI, -DI
  const { adx, plusDI, minusDI } = calculateADX(candles, 14);

  // Measure Swings over recent 20 candles
  const recent = candles.slice(-20);
  const n = recent.length;
  let higherHighsCount = 0;
  let lowerLowsCount = 0;
  let higherLowsCount = 0;
  let lowerHighsCount = 0;

  for (let i = 2; i < n; i++) {
    if (recent[i].high > recent[i - 1].high) higherHighsCount++;
    else lowerHighsCount++;

    if (recent[i].low > recent[i - 1].low) higherLowsCount++;
    else lowerLowsCount++;
  }

  // ATR & Range Statistics
  const ranges = recent.map(c => c.high - c.low);
  const avgRange = ranges.reduce((a, b) => a + b, 0) / ranges.length;
  const recentRange = ranges.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const rangeRatio = avgRange > 0 ? recentRange / avgRange : 1.0;

  // Trend Efficiency (Net Move / Total Travel)
  const firstClose = recent[0].close;
  const lastClose = recent[recent.length - 1].close;
  const netMove = lastClose - firstClose;
  const totalTravel = ranges.reduce((a, b) => a + b, 0);
  const trendEfficiency = totalTravel > 0 ? Math.abs(netMove) / totalTravel : 0;

  // Determine Range Boundaries
  const highs = recent.map(c => c.high);
  const lows = recent.map(c => c.low);
  const rangeHigh = Math.max(...highs);
  const rangeLow = Math.min(...lows);
  const rangeSpan = rangeHigh - rangeLow;
  const pricePosInRange = rangeSpan > 0 ? (lastClose - rangeLow) / rangeSpan : 0.5;

  let regime: MarketRegime = 'UNCERTAIN';
  let confidence = 70;
  const evidence: string[] = [];
  const characteristics: string[] = [];
  let riskState: 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL' = 'NORMAL';

  // 1. Low Liquidity Detection (Range compression + flat travel)
  if (rangeRatio < 0.40 && adx < 15 && avgRange < (pair.includes('JPY') ? 0.05 : 0.0004)) {
    regime = 'LOW_LIQUIDITY';
    confidence = 82;
    evidence.push(`Candle range compression ratio is ${rangeRatio.toFixed(2)}x with subdued ADX (${adx}).`);
    evidence.push('Sub-normal trading volume and tight equilibrium consolidation.');
    characteristics.push('Low Participation', 'Narrow Spread Compression', 'Whipsaw Risk');
    riskState = 'ELEVATED';
  }
  // 2. High Volatility Detection
  else if (rangeRatio >= 2.3 && trendEfficiency < 0.30) {
    regime = 'HIGH_VOLATILITY';
    confidence = Math.min(94, Math.round(75 + rangeRatio * 6));
    evidence.push(`Candle range expansion ratio of ${rangeRatio.toFixed(2)}x indicates erratic volatility.`);
    evidence.push(`ADX reading is ${adx}; wide erratic swings without directional persistence.`);
    characteristics.push('Abnormal Candle Expansion', 'Wide Swings', 'Increased Slippage');
    riskState = 'HIGH';
  }
  // 3. Breakout Detection (Decisive range break + high momentum)
  else if (rangeRatio >= 1.35 && trendEfficiency >= 0.45 && (lastClose > rangeHigh || lastClose < rangeLow || adx >= 28)) {
    regime = 'BREAKOUT';
    confidence = Math.min(92, Math.round(72 + trendEfficiency * 25));
    evidence.push(`Breakout confirmed: Directional efficiency ${(trendEfficiency * 100).toFixed(0)}% with range expansion (${rangeRatio.toFixed(2)}x).`);
    evidence.push(`ADX surged to ${adx} with ${plusDI > minusDI ? '+DI (' + plusDI + ') dominant' : '-DI (' + minusDI + ') dominant'}.`);
    characteristics.push('Structural Breakout', 'Momentum Expansion', 'Break of Key Range');
    riskState = 'NORMAL';
  }
  // 4. Trending Bullish (ADX >= 22, +DI > -DI, Price > EMA20 > EMA50, Higher Highs/Lows)
  else if (
    (adx >= 22 && plusDI > minusDI && lastClose > ema20 && ema20 >= ema50) ||
    (higherHighsCount >= 8 && higherLowsCount >= 7 && netMove > 0)
  ) {
    regime = 'TRENDING_BULLISH';
    confidence = Math.min(94, Math.round(70 + (adx / 100) * 20 + (higherHighsCount / (n - 2)) * 15));
    evidence.push(`Bullish trend confirmed: ADX ${adx} with +DI (${plusDI}) leading -DI (${minusDI}).`);
    evidence.push(`EMA structure aligned (Price > EMA20 ${ema20.toFixed(4)} > EMA50 ${ema50.toFixed(4)}).`);
    evidence.push(`Consecutive Higher Highs (${higherHighsCount}) and Higher Lows (${higherLowsCount}).`);
    characteristics.push('Bullish Trend Continuation', 'Demand Dominance', 'Higher Highs & Higher Lows');
    riskState = 'NORMAL';
  }
  // 5. Trending Bearish (ADX >= 22, -DI > +DI, Price < EMA20 < EMA50, Lower Lows/Highs)
  else if (
    (adx >= 22 && minusDI > plusDI && lastClose < ema20 && ema20 <= ema50) ||
    (lowerLowsCount >= 8 && lowerHighsCount >= 7 && netMove < 0)
  ) {
    regime = 'TRENDING_BEARISH';
    confidence = Math.min(94, Math.round(70 + (adx / 100) * 20 + (lowerLowsCount / (n - 2)) * 15));
    evidence.push(`Bearish trend confirmed: ADX ${adx} with -DI (${minusDI}) leading +DI (${plusDI}).`);
    evidence.push(`EMA structure aligned (Price < EMA20 ${ema20.toFixed(4)} < EMA50 ${ema50.toFixed(4)}).`);
    evidence.push(`Consecutive Lower Lows (${lowerLowsCount}) and Lower Highs (${lowerHighsCount}).`);
    characteristics.push('Bearish Trend Continuation', 'Supply Dominance', 'Lower Lows & Lower Highs');
    riskState = 'NORMAL';
  }
  // 6. Accumulation (Compressed price oscillating in lower 30% of range with stabilizing EMAs)
  else if (trendEfficiency < 0.35 && pricePosInRange <= 0.35 && rangeRatio <= 1.15 && adx < 25) {
    regime = 'ACCUMULATION';
    confidence = 80;
    evidence.push(`Price holding in lower 35% of trading range (${rangeLow.toFixed(4)} - ${(rangeLow + rangeSpan * 0.35).toFixed(4)}).`);
    evidence.push(`ADX subdued (${adx}); institutional absorption at support before directional drive.`);
    characteristics.push('Institutional Accumulation', 'Base Formation', 'Support Absorption');
    riskState = 'NORMAL';
  }
  // 7. Distribution (Compressed price oscillating in upper 30% of range with stalling momentum)
  else if (trendEfficiency < 0.35 && pricePosInRange >= 0.65 && rangeRatio <= 1.15 && adx < 25) {
    regime = 'DISTRIBUTION';
    confidence = 80;
    evidence.push(`Price holding in upper 35% of trading range (${(rangeHigh - rangeSpan * 0.35).toFixed(4)} - ${rangeHigh.toFixed(4)}).`);
    evidence.push(`ADX subdued (${adx}); institutional distribution at resistance prior to markup/markdown.`);
    characteristics.push('Institutional Distribution', 'Ceiling Rejection', 'Supply Unloading');
    riskState = 'NORMAL';
  }
  // 8. Ranging (Balanced mean-reverting oscillation)
  else if (adx < 22 && trendEfficiency < 0.38) {
    regime = 'RANGING';
    confidence = Math.min(88, Math.round(68 + (1 - trendEfficiency) * 22));
    evidence.push(`Price oscillating within bounded range (${rangeLow.toFixed(4)} to ${rangeHigh.toFixed(4)}).`);
    evidence.push(`ADX is ${adx} (< 22); balanced order flow equilibrium with clear mean-reversion swings.`);
    characteristics.push('Horizontal Range Boundary', 'Mean Reversion Dynamics', 'Support/Resistance Respect');
    riskState = 'NORMAL';
  }
  // 9. Uncertain (Ambiguous or transitioning price action)
  else {
    regime = 'UNCERTAIN';
    confidence = 62;
    evidence.push('Mixed structural and momentum signals; neither directional trend nor clean range established.');
    characteristics.push('Ambiguous Order Flow', 'Wait for Confirmation');
    riskState = 'NORMAL';
  }

  const transitionDetected = previous !== undefined && previous.regime !== regime;

  const result: RegimeClassification = {
    regime,
    confidence,
    evidence,
    riskState,
    transitionDetected,
    previousRegime: previous?.regime,
    characteristics
  };

  previousRegimes.set(pair, { regime, timestamp: Date.now() });
  return result;
}

export function resetRegimeTracker(pair?: string) {
  if (pair) previousRegimes.delete(pair);
  else previousRegimes.clear();
}
