/**
 * SESSIONKING - Institutional Liquidity Engine
 * 
 * Detects objectively measurable liquidity pools and sweeps:
 * - Equal Highs (EQH) / Equal Lows (EQL)
 * - Previous Day High (PDH) / Previous Day Low (PDL)
 * - Current Session High / Session Low
 * - Swing High / Low Liquidity Pools
 * - Liquidity Sweeps with displacement confirmation
 * 
 * Sweep Classification:
 * - LIQUIDITY_SWEEP_BULLISH
 * - LIQUIDITY_SWEEP_BEARISH
 * - NO_CLEAR_SWEEP
 * - UNCONFIRMED
 */

import { SnapshotCandle } from "./marketSnapshotEngine";

export interface LiquidityPool {
  id: string;
  type: 'EQH' | 'EQL' | 'PDH' | 'PDL' | 'SESSION_HIGH' | 'SESSION_LOW' | 'SWING_HIGH' | 'SWING_LOW';
  price: number;
  timeframe: string;
  distancePips: number;
  isSwept: boolean;
  sweepCandleTime?: string;
  significance: 'MAJOR' | 'MODERATE' | 'MINOR';
}

export type LiquiditySweepState = 
  | 'LIQUIDITY_SWEEP_BULLISH'
  | 'LIQUIDITY_SWEEP_BEARISH'
  | 'NO_CLEAR_SWEEP'
  | 'UNCONFIRMED';

export interface LiquiditySweepReport {
  sweepState: LiquiditySweepState;
  poolSwept?: LiquidityPool;
  sweepPrice?: number;
  sweepTime?: string;
  displacementConfirmed: boolean;
  displacementRatio: number; // Ratio of reaction candle size to average candle size
  evidence: string[];
}

export interface LiquidityAnalysisResult {
  pair: string;
  pools: LiquidityPool[];
  sweepReport: LiquiditySweepReport;
  keyLevels: {
    pdh?: number;
    pdl?: number;
    sessionHigh?: number;
    sessionLow?: number;
    eqh?: number;
    eql?: number;
  };
  summary: string;
}

/**
 * Detects Equal Highs and Equal Lows within a small pip tolerance.
 */
function detectEqualHighsLows(candles: SnapshotCandle[], pipSize: number): { eqhList: LiquidityPool[]; eqlList: LiquidityPool[] } {
  const eqhList: LiquidityPool[] = [];
  const eqlList: LiquidityPool[] = [];
  if (!candles || candles.length < 10) return { eqhList, eqlList };

  const tolerance = pipSize * 3.0; // 3 pip tolerance for equal levels
  const currentPrice = candles[candles.length - 1].close;

  // Scan recent swing highs
  const highs: { index: number; price: number; time: string }[] = [];
  const lows: { index: number; price: number; time: string }[] = [];

  for (let i = 2; i < candles.length - 2; i++) {
    const c = candles[i];
    if (c.high > candles[i - 1].high && c.high > candles[i - 2].high && c.high > candles[i + 1].high && c.high > candles[i + 2].high) {
      highs.push({ index: i, price: c.high, time: c.timestamp });
    }
    if (c.low < candles[i - 1].low && c.low < candles[i - 2].low && c.low < candles[i + 1].low && c.low < candles[i + 2].low) {
      lows.push({ index: i, price: c.low, time: c.timestamp });
    }
  }

  // Find EQH pairs
  for (let i = 0; i < highs.length; i++) {
    for (let j = i + 1; j < highs.length; j++) {
      if (Math.abs(highs[i].price - highs[j].price) <= tolerance) {
        const avg = (highs[i].price + highs[j].price) / 2;
        const dist = Math.abs(currentPrice - avg) / pipSize;
        eqhList.push({
          id: `EQH-${highs[i].index}-${highs[j].index}`,
          type: 'EQH',
          price: avg,
          timeframe: 'M15',
          distancePips: Math.round(dist * 10) / 10,
          isSwept: false,
          significance: 'MAJOR'
        });
      }
    }
  }

  // Find EQL pairs
  for (let i = 0; i < lows.length; i++) {
    for (let j = i + 1; j < lows.length; j++) {
      if (Math.abs(lows[i].price - lows[j].price) <= tolerance) {
        const avg = (lows[i].price + lows[j].price) / 2;
        const dist = Math.abs(currentPrice - avg) / pipSize;
        eqlList.push({
          id: `EQL-${lows[i].index}-${lows[j].index}`,
          type: 'EQL',
          price: avg,
          timeframe: 'M15',
          distancePips: Math.round(dist * 10) / 10,
          isSwept: false,
          significance: 'MAJOR'
        });
      }
    }
  }

  return { eqhList: eqhList.slice(0, 2), eqlList: eqlList.slice(0, 2) };
}

/**
 * Calculates Previous Day High and Previous Day Low from D1 candles.
 */
function extractPDHandPDL(d1Candles: SnapshotCandle[], currentPrice: number, pipSize: number): { pdh?: LiquidityPool; pdl?: LiquidityPool } {
  if (!d1Candles || d1Candles.length < 2) return {};
  const prevDay = d1Candles[d1Candles.length - 2];
  const pdhPrice = prevDay.high;
  const pdlPrice = prevDay.low;

  return {
    pdh: {
      id: 'PDH',
      type: 'PDH',
      price: pdhPrice,
      timeframe: 'D1',
      distancePips: Math.round((Math.abs(currentPrice - pdhPrice) / pipSize) * 10) / 10,
      isSwept: false,
      significance: 'MAJOR'
    },
    pdl: {
      id: 'PDL',
      type: 'PDL',
      price: pdlPrice,
      timeframe: 'D1',
      distancePips: Math.round((Math.abs(currentPrice - pdlPrice) / pipSize) * 10) / 10,
      isSwept: false,
      significance: 'MAJOR'
    }
  };
}

/**
 * Analyzes whether recent price action triggered a Liquidity Sweep with Displacement.
 */
function detectLiquiditySweep(
  candles: SnapshotCandle[],
  pools: LiquidityPool[],
  pipSize: number
): LiquiditySweepReport {
  if (!candles || candles.length < 5 || pools.length === 0) {
    return {
      sweepState: 'NO_CLEAR_SWEEP',
      displacementConfirmed: false,
      displacementRatio: 1.0,
      evidence: ['No active liquidity pool sweeps detected.']
    };
  }

  // Calculate average recent candle range for displacement comparison
  const recentRanges = candles.slice(-15).map(c => c.high - c.low);
  const avgRange = recentRanges.reduce((a, b) => a + b, 0) / recentRanges.length;

  const lastCandle = candles[candles.length - 1];
  const prevCandle = candles[candles.length - 2];

  for (const pool of pools) {
    // 1. Bullish Liquidity Sweep:
    // Price dipped below key low (EQL / PDL / Session Low), swept resting buy stops / sell liquidity,
    // and closed back ABOVE the level with bullish displacement.
    if (pool.type === 'EQL' || pool.type === 'PDL' || pool.type === 'SESSION_LOW' || pool.type === 'SWING_LOW') {
      const sweptInPrev = prevCandle.low < pool.price && prevCandle.close > pool.price;
      const sweptInLast = lastCandle.low < pool.price && lastCandle.close > pool.price;

      if (sweptInPrev || sweptInLast) {
        const sweepCandle = sweptInLast ? lastCandle : prevCandle;
        const reactionCandle = sweptInLast ? lastCandle : lastCandle;
        const reactionRange = reactionCandle.high - reactionCandle.low;
        const displacementRatio = avgRange > 0 ? reactionRange / avgRange : 1.0;
        const displacementConfirmed = displacementRatio >= 1.25 && reactionCandle.close > reactionCandle.open;

        pool.isSwept = true;
        pool.sweepCandleTime = sweepCandle.timestamp;

        return {
          sweepState: displacementConfirmed ? 'LIQUIDITY_SWEEP_BULLISH' : 'UNCONFIRMED',
          poolSwept: pool,
          sweepPrice: sweepCandle.low,
          sweepTime: sweepCandle.timestamp,
          displacementConfirmed,
          displacementRatio: Math.round(displacementRatio * 10) / 10,
          evidence: [
            `Sell-side liquidity swept below ${pool.type} (${pool.price.toFixed(5)}).`,
            `Candle swept low to ${sweepCandle.low.toFixed(5)} then closed back inside range.`,
            displacementConfirmed 
              ? `Bullish displacement confirmed (${displacementRatio.toFixed(1)}x avg expansion).`
              : 'Displacement unconfirmed; waiting for strong closing momentum.'
          ]
        };
      }
    }

    // 2. Bearish Liquidity Sweep:
    // Price poked above key high (EQH / PDH / Session High), swept resting buy stops / buy liquidity,
    // and closed back BELOW the level with bearish displacement.
    if (pool.type === 'EQH' || pool.type === 'PDH' || pool.type === 'SESSION_HIGH' || pool.type === 'SWING_HIGH') {
      const sweptInPrev = prevCandle.high > pool.price && prevCandle.close < pool.price;
      const sweptInLast = lastCandle.high > pool.price && lastCandle.close < pool.price;

      if (sweptInPrev || sweptInLast) {
        const sweepCandle = sweptInLast ? lastCandle : prevCandle;
        const reactionCandle = sweptInLast ? lastCandle : lastCandle;
        const reactionRange = reactionCandle.high - reactionCandle.low;
        const displacementRatio = avgRange > 0 ? reactionRange / avgRange : 1.0;
        const displacementConfirmed = displacementRatio >= 1.25 && reactionCandle.close < reactionCandle.open;

        pool.isSwept = true;
        pool.sweepCandleTime = sweepCandle.timestamp;

        return {
          sweepState: displacementConfirmed ? 'LIQUIDITY_SWEEP_BEARISH' : 'UNCONFIRMED',
          poolSwept: pool,
          sweepPrice: sweepCandle.high,
          sweepTime: sweepCandle.timestamp,
          displacementConfirmed,
          displacementRatio: Math.round(displacementRatio * 10) / 10,
          evidence: [
            `Buy-side liquidity swept above ${pool.type} (${pool.price.toFixed(5)}).`,
            `Candle swept high to ${sweepCandle.high.toFixed(5)} then closed back inside range.`,
            displacementConfirmed 
              ? `Bearish displacement confirmed (${displacementRatio.toFixed(1)}x avg expansion).`
              : 'Displacement unconfirmed; waiting for strong closing momentum.'
          ]
        };
      }
    }
  }

  return {
    sweepState: 'NO_CLEAR_SWEEP',
    displacementConfirmed: false,
    displacementRatio: 1.0,
    evidence: ['No objective liquidity sweep detected on active timeframe.']
  };
}

/**
 * Main Institutional Liquidity Analysis function.
 */
export function evaluateLiquidity(
  pair: string,
  m15Candles: SnapshotCandle[],
  d1Candles?: SnapshotCandle[],
  pipSize = pair.includes('JPY') ? 0.01 : 0.0001
): LiquidityAnalysisResult {
  if (!m15Candles || m15Candles.length < 5) {
    return {
      pair,
      pools: [],
      sweepReport: {
        sweepState: 'NO_CLEAR_SWEEP',
        displacementConfirmed: false,
        displacementRatio: 1.0,
        evidence: ['Insufficient data for liquidity pool mapping.']
      },
      keyLevels: {},
      summary: 'Liquidity mapping unavailable due to insufficient bars.'
    };
  }

  const currentPrice = m15Candles[m15Candles.length - 1].close;

  // 1. Equal Highs & Equal Lows
  const { eqhList, eqlList } = detectEqualHighsLows(m15Candles, pipSize);

  // 2. PDH & PDL
  const { pdh, pdl } = extractPDHandPDL(d1Candles || [], currentPrice, pipSize);

  // 3. Current Session Extremes
  const sessionCandles = m15Candles.slice(-16); // ~4 hours of session candles
  const sessionHighVal = Math.max(...sessionCandles.map(c => c.high));
  const sessionLowVal = Math.min(...sessionCandles.map(c => c.low));

  const sessionHigh: LiquidityPool = {
    id: 'SESSION_HIGH',
    type: 'SESSION_HIGH',
    price: sessionHighVal,
    timeframe: 'M15',
    distancePips: Math.round((Math.abs(currentPrice - sessionHighVal) / pipSize) * 10) / 10,
    isSwept: false,
    significance: 'MODERATE'
  };

  const sessionLow: LiquidityPool = {
    id: 'SESSION_LOW',
    type: 'SESSION_LOW',
    price: sessionLowVal,
    timeframe: 'M15',
    distancePips: Math.round((Math.abs(currentPrice - sessionLowVal) / pipSize) * 10) / 10,
    isSwept: false,
    significance: 'MODERATE'
  };

  const allPools: LiquidityPool[] = [
    ...(pdh ? [pdh] : []),
    ...(pdl ? [pdl] : []),
    sessionHigh,
    sessionLow,
    ...eqhList,
    ...eqlList
  ];

  // 4. Detect sweeps against pools
  const sweepReport = detectLiquiditySweep(m15Candles, allPools, pipSize);

  const summary = sweepReport.sweepState !== 'NO_CLEAR_SWEEP'
    ? `${sweepReport.sweepState}: ${sweepReport.evidence.join(' ')}`
    : `Resting Liquidity: PDH ${pdh?.price.toFixed(4) || 'N/A'}, PDL ${pdl?.price.toFixed(4) || 'N/A'}, Session H: ${sessionHighVal.toFixed(4)}, Session L: ${sessionLowVal.toFixed(4)}.`;

  return {
    pair,
    pools: allPools,
    sweepReport,
    keyLevels: {
      pdh: pdh?.price,
      pdl: pdl?.price,
      sessionHigh: sessionHighVal,
      sessionLow: sessionLowVal,
      eqh: eqhList.length > 0 ? eqhList[0].price : undefined,
      eql: eqlList.length > 0 ? eqlList[0].price : undefined
    },
    summary
  };
}
