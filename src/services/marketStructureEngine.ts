/**
 * SESSIONKING - Multi-Timeframe Market Structure Engine
 * 
 * Evaluates swing highs/lows, Higher Highs (HH), Higher Lows (HL),
 * Lower Highs (LH), Lower Lows (LL), Break of Structure (BOS),
 * Market Structure Shift (MSS / CHoCH), dynamic support and resistance.
 * 
 * Timeframe roles:
 * - D1 / H4: Context & directional institutional bias
 * - H1: Intraday structural trend
 * - M15: Setup confirmation & zone validation
 * - M5: Refined entry timing
 */

import { SnapshotCandle } from "./marketSnapshotEngine";

export interface SwingPoint {
  index: number;
  type: 'HIGH' | 'LOW';
  price: number;
  timestamp: string;
  confirmed: boolean;
}

export interface SupportResistanceZone {
  priceLevel: number;
  top: number;
  bottom: number;
  touchCount: number;
  type: 'SUPPORT' | 'RESISTANCE';
  strength: 'WEAK' | 'MODERATE' | 'STRONG';
}

export interface TimeframeStructure {
  timeframe: string;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  swingHighs: SwingPoint[];
  swingLows: SwingPoint[];
  lastStructureEvent?: 'BOS_BULLISH' | 'BOS_BEARISH' | 'MSS_BULLISH' | 'MSS_BEARISH' | 'NONE';
  lastEventPrice?: number;
  lastEventTimestamp?: string;
  higherHighsCount: number;
  higherLowsCount: number;
  lowerHighsCount: number;
  lowerLowsCount: number;
  supportZones: SupportResistanceZone[];
  resistanceZones: SupportResistanceZone[];
  recentBreakConfirmed: boolean;
}

export interface MultiTimeframeStructureReport {
  pair: string;
  overallBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  h4Bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  h1Bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  m15Bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  m5Bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  timeframes: {
    D1?: TimeframeStructure;
    H4?: TimeframeStructure;
    H1?: TimeframeStructure;
    M15?: TimeframeStructure;
    M5?: TimeframeStructure;
  };
  alignment: 'FULL_ALIGNMENT' | 'PARTIAL_ALIGNMENT' | 'CONFLICT';
  keySupport: number;
  keyResistance: number;
  structuralReasoning: string[];
}

/**
 * Finds swing highs and lows with N-bar fractal confirmation.
 */
function findSwingPoints(candles: SnapshotCandle[], leftBars = 2, rightBars = 2): { swingHighs: SwingPoint[]; swingLows: SwingPoint[] } {
  const swingHighs: SwingPoint[] = [];
  const swingLows: SwingPoint[] = [];
  if (!candles || candles.length < leftBars + rightBars + 1) {
    return { swingHighs, swingLows };
  }

  for (let i = leftBars; i < candles.length - rightBars; i++) {
    const curr = candles[i];
    let isHigh = true;
    let isLow = true;

    for (let j = i - leftBars; j <= i + rightBars; j++) {
      if (j === i) continue;
      if (candles[j].high >= curr.high) isHigh = false;
      if (candles[j].low <= curr.low) isLow = false;
    }

    if (isHigh) {
      swingHighs.push({
        index: i,
        type: 'HIGH',
        price: curr.high,
        timestamp: curr.timestamp,
        confirmed: true
      });
    }

    if (isLow) {
      swingLows.push({
        index: i,
        type: 'LOW',
        price: curr.low,
        timestamp: curr.timestamp,
        confirmed: true
      });
    }
  }

  return { swingHighs, swingLows };
}

/**
 * Detects dynamic Support and Resistance zones by clustering swing points.
 */
function detectZones(
  swingHighs: SwingPoint[],
  swingLows: SwingPoint[],
  pipSize: number
): { supportZones: SupportResistanceZone[]; resistanceZones: SupportResistanceZone[] } {
  const tolerance = pipSize * 6; // 6 pip clustering tolerance

  const cluster = (points: SwingPoint[], type: 'SUPPORT' | 'RESISTANCE'): SupportResistanceZone[] => {
    const zones: SupportResistanceZone[] = [];
    const used = new Set<number>();

    for (let i = 0; i < points.length; i++) {
      if (used.has(i)) continue;
      const basePrice = points[i].price;
      let count = 1;
      let sumPrice = basePrice;
      let minP = basePrice;
      let maxP = basePrice;

      for (let j = i + 1; j < points.length; j++) {
        if (used.has(j)) continue;
        if (Math.abs(points[j].price - basePrice) <= tolerance) {
          count++;
          sumPrice += points[j].price;
          minP = Math.min(minP, points[j].price);
          maxP = Math.max(maxP, points[j].price);
          used.add(j);
        }
      }

      if (count >= 2) {
        const avg = sumPrice / count;
        zones.push({
          priceLevel: avg,
          top: maxP,
          bottom: minP,
          touchCount: count,
          type,
          strength: count >= 4 ? 'STRONG' : 'MODERATE'
        });
      }
    }

    return zones.sort((a, b) => b.touchCount - a.touchCount).slice(0, 3);
  };

  return {
    supportZones: cluster(swingLows, 'SUPPORT'),
    resistanceZones: cluster(swingHighs, 'RESISTANCE')
  };
}

/**
 * Evaluates structural trend and events (HH, HL, LH, LL, BOS, MSS) on a timeframe.
 */
export function analyzeTimeframeStructure(
  candles: SnapshotCandle[],
  timeframe: string,
  pipSize = 0.0001
): TimeframeStructure {
  if (!candles || candles.length < 5) {
    return {
      timeframe,
      trend: 'NEUTRAL',
      swingHighs: [],
      swingLows: [],
      lastStructureEvent: 'NONE',
      higherHighsCount: 0,
      higherLowsCount: 0,
      lowerHighsCount: 0,
      lowerLowsCount: 0,
      supportZones: [],
      resistanceZones: [],
      recentBreakConfirmed: false
    };
  }

  const { swingHighs, swingLows } = findSwingPoints(candles, 2, 2);
  const { supportZones, resistanceZones } = detectZones(swingHighs, swingLows, pipSize);

  let higherHighsCount = 0;
  let lowerHighsCount = 0;
  let higherLowsCount = 0;
  let lowerLowsCount = 0;

  for (let i = 1; i < swingHighs.length; i++) {
    if (swingHighs[i].price > swingHighs[i - 1].price) higherHighsCount++;
    else lowerHighsCount++;
  }

  for (let i = 1; i < swingLows.length; i++) {
    if (swingLows[i].price > swingLows[i - 1].price) higherLowsCount++;
    else lowerLowsCount++;
  }

  let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (higherHighsCount >= lowerHighsCount && higherLowsCount >= lowerLowsCount) {
    trend = 'BULLISH';
  } else if (lowerHighsCount >= higherHighsCount && lowerLowsCount >= higherLowsCount) {
    trend = 'BEARISH';
  }

  // Detect BOS and MSS from the most recent completed candles
  let lastStructureEvent: 'BOS_BULLISH' | 'BOS_BEARISH' | 'MSS_BULLISH' | 'MSS_BEARISH' | 'NONE' = 'NONE';
  let lastEventPrice: number | undefined;
  let lastEventTimestamp: string | undefined;
  let recentBreakConfirmed = false;

  const lastCandle = candles[candles.length - 1];
  const prevHigh = swingHighs.length > 0 ? swingHighs[swingHighs.length - 1].price : undefined;
  const prevLow = swingLows.length > 0 ? swingLows[swingLows.length - 1].price : undefined;

  if (prevHigh && lastCandle.close > prevHigh) {
    if (trend === 'BULLISH') {
      lastStructureEvent = 'BOS_BULLISH'; // Continuation Break of Structure
    } else {
      lastStructureEvent = 'MSS_BULLISH'; // Market Structure Shift (CHoCH) from bearish
      trend = 'BULLISH';
    }
    lastEventPrice = prevHigh;
    lastEventTimestamp = lastCandle.timestamp;
    recentBreakConfirmed = true;
  } else if (prevLow && lastCandle.close < prevLow) {
    if (trend === 'BEARISH') {
      lastStructureEvent = 'BOS_BEARISH'; // Continuation Break of Structure
    } else {
      lastStructureEvent = 'MSS_BEARISH'; // Market Structure Shift (CHoCH) from bullish
      trend = 'BEARISH';
    }
    lastEventPrice = prevLow;
    lastEventTimestamp = lastCandle.timestamp;
    recentBreakConfirmed = true;
  }

  return {
    timeframe,
    trend,
    swingHighs: swingHighs.slice(-6),
    swingLows: swingLows.slice(-6),
    lastStructureEvent,
    lastEventPrice,
    lastEventTimestamp,
    higherHighsCount,
    higherLowsCount,
    lowerHighsCount,
    lowerLowsCount,
    supportZones,
    resistanceZones,
    recentBreakConfirmed
  };
}

/**
 * Analyzes structure across all timeframes (H4, H1, M15, M5) and determines multi-timeframe alignment.
 */
export function evaluateMultiTimeframeStructure(
  pair: string,
  timeframes: {
    D1?: SnapshotCandle[];
    H4?: SnapshotCandle[];
    H1?: SnapshotCandle[];
    M15?: SnapshotCandle[];
    M5?: SnapshotCandle[];
  },
  pipSize = pair.includes('JPY') ? 0.01 : 0.0001
): MultiTimeframeStructureReport {
  const d1Struct = timeframes.D1 ? analyzeTimeframeStructure(timeframes.D1, 'D1', pipSize) : undefined;
  const h4Struct = timeframes.H4 ? analyzeTimeframeStructure(timeframes.H4, 'H4', pipSize) : undefined;
  const h1Struct = timeframes.H1 ? analyzeTimeframeStructure(timeframes.H1, 'H1', pipSize) : undefined;
  const m15Struct = timeframes.M15 ? analyzeTimeframeStructure(timeframes.M15, 'M15', pipSize) : undefined;
  const m5Struct = timeframes.M5 ? analyzeTimeframeStructure(timeframes.M5, 'M5', pipSize) : undefined;

  const h4Bias = h4Struct?.trend || d1Struct?.trend || 'NEUTRAL';
  const h1Bias = h1Struct?.trend || 'NEUTRAL';
  const m15Bias = m15Struct?.trend || 'NEUTRAL';
  const m5Bias = m5Struct?.trend || 'NEUTRAL';

  // Overall Bias weighted by institutional hierarchy (H4 > H1 > M15)
  let bullishPoints = 0;
  let bearishPoints = 0;

  if (h4Bias === 'BULLISH') bullishPoints += 3;
  else if (h4Bias === 'BEARISH') bearishPoints += 3;

  if (h1Bias === 'BULLISH') bullishPoints += 2;
  else if (h1Bias === 'BEARISH') bearishPoints += 2;

  if (m15Bias === 'BULLISH') bullishPoints += 1.5;
  else if (m15Bias === 'BEARISH') bearishPoints += 1.5;

  if (m5Bias === 'BULLISH') bullishPoints += 0.5;
  else if (m5Bias === 'BEARISH') bearishPoints += 0.5;

  let overallBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (bullishPoints >= 4.5 && bullishPoints > bearishPoints) overallBias = 'BULLISH';
  else if (bearishPoints >= 4.5 && bearishPoints > bullishPoints) overallBias = 'BEARISH';

  // Alignment check
  let alignment: 'FULL_ALIGNMENT' | 'PARTIAL_ALIGNMENT' | 'CONFLICT' = 'CONFLICT';
  if (h4Bias === h1Bias && h1Bias === m15Bias && m15Bias !== 'NEUTRAL') {
    alignment = 'FULL_ALIGNMENT';
  } else if (
    (h4Bias === h1Bias && h4Bias !== 'NEUTRAL') ||
    (h1Bias === m15Bias && h1Bias !== 'NEUTRAL')
  ) {
    alignment = 'PARTIAL_ALIGNMENT';
  }

  // Key Support & Resistance (H1 / H4 priority)
  const allSupports = [
    ...(h1Struct?.supportZones || []),
    ...(m15Struct?.supportZones || []),
    ...(h4Struct?.supportZones || [])
  ];
  const allResistances = [
    ...(h1Struct?.resistanceZones || []),
    ...(m15Struct?.resistanceZones || []),
    ...(h4Struct?.resistanceZones || [])
  ];

  const keySupport = allSupports.length > 0 ? allSupports[0].priceLevel : 0;
  const keyResistance = allResistances.length > 0 ? allResistances[0].priceLevel : 0;

  const structuralReasoning: string[] = [];
  structuralReasoning.push(`H4 Structural Bias: ${h4Bias}. Contextual order flow guidance.`);
  structuralReasoning.push(`H1 Intraday Trend: ${h1Bias}. Swing structure alignment.`);
  structuralReasoning.push(`M15 Execution Confirmation: ${m15Bias}.`);

  if (m15Struct?.lastStructureEvent && m15Struct.lastStructureEvent !== 'NONE') {
    structuralReasoning.push(`M15 Structure Event: ${m15Struct.lastStructureEvent.replace('_', ' ')} at ${m15Struct.lastEventPrice?.toFixed(4)}.`);
  }

  return {
    pair,
    overallBias,
    h4Bias,
    h1Bias,
    m15Bias,
    m5Bias,
    timeframes: {
      D1: d1Struct,
      H4: h4Struct,
      H1: h1Struct,
      M15: m15Struct,
      M5: m5Struct
    },
    alignment,
    keySupport,
    keyResistance,
    structuralReasoning
  };
}
