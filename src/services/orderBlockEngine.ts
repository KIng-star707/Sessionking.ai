/**
 * SESSIONKING - Institutional Order Block & Fair Value Gap (FVG) Engine
 * 
 * Detects:
 * - Bullish Order Block (OB): Last down-candle prior to displacement that broke structure
 * - Bearish Order Block (OB): Last up-candle prior to displacement that broke structure
 * - Bullish Fair Value Gap (FVG): Imbalance where Candle 1 High < Candle 3 Low
 * - Bearish Fair Value Gap (FVG): Imbalance where Candle 1 Low > Candle 3 High
 * - Mitigation Tracking: Whether current price has entered or filled the zone
 * - Displacement Confirmation: Strong expansion body validating institutional footprint
 */

import { SnapshotCandle } from "./marketSnapshotEngine";

export type ZoneType = 'ORDER_BLOCK_BULLISH' | 'ORDER_BLOCK_BEARISH' | 'FVG_BULLISH' | 'FVG_BEARISH';
export type MitigationStatus = 'UNMITIGATED' | 'PARTIALLY_MITIGATED' | 'MITIGATED' | 'INVALIDATED';

export interface InstitutionalZone {
  id: string;
  type: ZoneType;
  timeframe: string;
  top: number;
  bottom: number;
  midpoint: number; // Equilibrium (50%) of zone
  creationTimestamp: string;
  distancePips: number;
  validityStatus: MitigationStatus;
  displacementRatio: number;
  isInsideZone: boolean;
}

export interface OrderBlockAnalysisResult {
  pair: string;
  activeZones: InstitutionalZone[];
  nearestBullishZone?: InstitutionalZone;
  nearestBearishZone?: InstitutionalZone;
  summary: string;
}

/**
 * Detects Fair Value Gaps across a candle series.
 */
function detectFVGs(candles: SnapshotCandle[], timeframe: string, currentPrice: number, pipSize: number): InstitutionalZone[] {
  const fvgs: InstitutionalZone[] = [];
  if (!candles || candles.length < 5) return fvgs;

  // Scan 3-candle windows
  for (let i = 2; i < candles.length - 1; i++) {
    const c1 = candles[i - 2];
    const c2 = candles[i - 1]; // The displacement candle
    const c3 = candles[i];

    // Bullish FVG: Candle 1 High < Candle 3 Low (Unfilled gap)
    if (c3.low > c1.high && c2.close > c2.open) {
      const top = c3.low;
      const bottom = c1.high;
      const gapPips = (top - bottom) / pipSize;

      if (gapPips >= 2.0) { // Filter out negligible microscopic noise
        const midpoint = (top + bottom) / 2;
        const creationTimestamp = c2.timestamp;

        // Check mitigation by subsequent candles
        let status: MitigationStatus = 'UNMITIGATED';
        for (let j = i + 1; j < candles.length; j++) {
          const sub = candles[j];
          if (sub.low <= bottom) {
            status = 'MITIGATED'; // Completely filled/violated
            break;
          } else if (sub.low <= midpoint) {
            status = 'PARTIALLY_MITIGATED';
          }
        }

        if (status !== 'MITIGATED') {
          const distancePips = Math.round((Math.abs(currentPrice - midpoint) / pipSize) * 10) / 10;
          const isInsideZone = currentPrice >= bottom && currentPrice <= top;

          fvgs.push({
            id: `FVG_BULL_${timeframe}_${i}`,
            type: 'FVG_BULLISH',
            timeframe,
            top,
            bottom,
            midpoint,
            creationTimestamp,
            distancePips,
            validityStatus: status,
            displacementRatio: (c2.high - c2.low) / Math.max(0.0001, (c1.high - c1.low)),
            isInsideZone
          });
        }
      }
    }

    // Bearish FVG: Candle 1 Low > Candle 3 High
    if (c3.high < c1.low && c2.close < c2.open) {
      const top = c1.low;
      const bottom = c3.high;
      const gapPips = (top - bottom) / pipSize;

      if (gapPips >= 2.0) {
        const midpoint = (top + bottom) / 2;
        const creationTimestamp = c2.timestamp;

        let status: MitigationStatus = 'UNMITIGATED';
        for (let j = i + 1; j < candles.length; j++) {
          const sub = candles[j];
          if (sub.high >= top) {
            status = 'MITIGATED';
            break;
          } else if (sub.high >= midpoint) {
            status = 'PARTIALLY_MITIGATED';
          }
        }

        if (status !== 'MITIGATED') {
          const distancePips = Math.round((Math.abs(currentPrice - midpoint) / pipSize) * 10) / 10;
          const isInsideZone = currentPrice >= bottom && currentPrice <= top;

          fvgs.push({
            id: `FVG_BEAR_${timeframe}_${i}`,
            type: 'FVG_BEARISH',
            timeframe,
            top,
            bottom,
            midpoint,
            creationTimestamp,
            distancePips,
            validityStatus: status,
            displacementRatio: (c2.high - c2.low) / Math.max(0.0001, (c1.high - c1.low)),
            isInsideZone
          });
        }
      }
    }
  }

  return fvgs.slice(-3); // Keep freshest 3
}

/**
 * Detects Order Blocks (OBs) formed before displacement and swing breaks.
 */
function detectOrderBlocks(candles: SnapshotCandle[], timeframe: string, currentPrice: number, pipSize: number): InstitutionalZone[] {
  const obs: InstitutionalZone[] = [];
  if (!candles || candles.length < 10) return obs;

  const ranges = candles.map(c => c.high - c.low);
  const avgRange = ranges.reduce((a, b) => a + b, 0) / ranges.length;

  for (let i = 2; i < candles.length - 2; i++) {
    const obCandle = candles[i];
    const nextCandle = candles[i + 1];
    const nextNextCandle = candles[i + 2];

    const nextExpansion = (nextCandle.high - nextCandle.low);
    const isDisplacement = avgRange > 0 && nextExpansion >= avgRange * 1.35;

    // Bullish OB: Bearish candle followed by strong bullish displacement
    if (obCandle.close < obCandle.open && nextCandle.close > nextCandle.open && isDisplacement) {
      const top = Math.max(obCandle.open, obCandle.high);
      const bottom = obCandle.low;
      const midpoint = (top + bottom) / 2;

      let status: MitigationStatus = 'UNMITIGATED';
      for (let j = i + 2; j < candles.length; j++) {
        if (candles[j].low < bottom) {
          status = 'INVALIDATED';
          break;
        } else if (candles[j].low <= top) {
          status = 'PARTIALLY_MITIGATED';
        }
      }

      if (status !== 'INVALIDATED') {
        const distancePips = Math.round((Math.abs(currentPrice - midpoint) / pipSize) * 10) / 10;
        obs.push({
          id: `OB_BULL_${timeframe}_${i}`,
          type: 'ORDER_BLOCK_BULLISH',
          timeframe,
          top,
          bottom,
          midpoint,
          creationTimestamp: obCandle.timestamp,
          distancePips,
          validityStatus: status,
          displacementRatio: Math.round((nextExpansion / avgRange) * 10) / 10,
          isInsideZone: currentPrice >= bottom && currentPrice <= top
        });
      }
    }

    // Bearish OB: Bullish candle followed by strong bearish displacement
    if (obCandle.close > obCandle.open && nextCandle.close < nextCandle.open && isDisplacement) {
      const top = obCandle.high;
      const bottom = Math.min(obCandle.open, obCandle.low);
      const midpoint = (top + bottom) / 2;

      let status: MitigationStatus = 'UNMITIGATED';
      for (let j = i + 2; j < candles.length; j++) {
        if (candles[j].high > top) {
          status = 'INVALIDATED';
          break;
        } else if (candles[j].high >= bottom) {
          status = 'PARTIALLY_MITIGATED';
        }
      }

      if (status !== 'INVALIDATED') {
        const distancePips = Math.round((Math.abs(currentPrice - midpoint) / pipSize) * 10) / 10;
        obs.push({
          id: `OB_BEAR_${timeframe}_${i}`,
          type: 'ORDER_BLOCK_BEARISH',
          timeframe,
          top,
          bottom,
          midpoint,
          creationTimestamp: obCandle.timestamp,
          distancePips,
          validityStatus: status,
          displacementRatio: Math.round((nextExpansion / avgRange) * 10) / 10,
          isInsideZone: currentPrice >= bottom && currentPrice <= top
        });
      }
    }
  }

  return obs.slice(-3); // Keep freshest 3
}

/**
 * Main Institutional Order Block and FVG evaluation function.
 */
export function evaluateOrderBlocksAndFVG(
  pair: string,
  candlesM15: SnapshotCandle[],
  candlesH1?: SnapshotCandle[],
  pipSize = pair.includes('JPY') ? 0.01 : 0.0001
): OrderBlockAnalysisResult {
  if (!candlesM15 || candlesM15.length < 5) {
    return {
      pair,
      activeZones: [],
      summary: 'Insufficient candlestick data for order block / FVG extraction.'
    };
  }

  const currentPrice = candlesM15[candlesM15.length - 1].close;

  const m15FVGs = detectFVGs(candlesM15, 'M15', currentPrice, pipSize);
  const m15OBs = detectOrderBlocks(candlesM15, 'M15', currentPrice, pipSize);
  const h1OBs = candlesH1 ? detectOrderBlocks(candlesH1, 'H1', currentPrice, pipSize) : [];

  const allZones = [...m15OBs, ...h1OBs, ...m15FVGs].filter(z => z.validityStatus !== 'INVALIDATED');

  // Find nearest valid zones
  const bullishZones = allZones.filter(z => z.type === 'ORDER_BLOCK_BULLISH' || z.type === 'FVG_BULLISH');
  const bearishZones = allZones.filter(z => z.type === 'ORDER_BLOCK_BEARISH' || z.type === 'FVG_BEARISH');

  bullishZones.sort((a, b) => a.distancePips - b.distancePips);
  bearishZones.sort((a, b) => a.distancePips - b.distancePips);

  const nearestBullishZone = bullishZones[0];
  const nearestBearishZone = bearishZones[0];

  const summary = [
    nearestBullishZone ? `Demand Zone: ${nearestBullishZone.type.replace('_', ' ')} (${nearestBullishZone.bottom.toFixed(4)} - ${nearestBullishZone.top.toFixed(4)}, ${nearestBullishZone.distancePips} pips).` : '',
    nearestBearishZone ? `Supply Zone: ${nearestBearishZone.type.replace('_', ' ')} (${nearestBearishZone.bottom.toFixed(4)} - ${nearestBearishZone.top.toFixed(4)}, ${nearestBearishZone.distancePips} pips).` : ''
  ].filter(Boolean).join(' ') || 'No fresh unmitigated Order Blocks or FVGs in immediate vicinity.';

  return {
    pair,
    activeZones: allZones,
    nearestBullishZone,
    nearestBearishZone,
    summary
  };
}
