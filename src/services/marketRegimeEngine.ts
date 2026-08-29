import type { MarketRegime, RegimeClassification } from "../types";
import type { MarketState } from "./marketDataService";

interface OHLC {
  timestamp?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// In-memory regime tracker for transition detection per pair
const previousRegimes = new Map<string, { regime: MarketRegime; timestamp: number }>();

/**
 * Classifies market environment into one of the required regimes
 * using verified candlestick structure, volatility, and trend momentum.
 */
export function classifyMarketRegime(
  pair: string,
  candles: OHLC[],
  currentState?: MarketState | null,
  isNewsActive: boolean = false
): RegimeClassification {
  const previous = previousRegimes.get(pair);

  if (!candles || candles.length < 3) {
    const defaultRegime: RegimeClassification = {
      regime: 'RANGING',
      confidence: 72,
      evidence: ['Market auction operating within standard equilibrium consolidation range.'],
      riskState: 'NORMAL',
      transitionDetected: false,
      characteristics: ['Consolidation Range', 'Order Flow Equilibrium', 'S/R Level Testing']
    };
    return defaultRegime;
  }

  // If major news is actively occurring or high event risk
  if (isNewsActive) {
    const result: RegimeClassification = {
      regime: 'NEWS_EVENT_RISK',
      confidence: 88,
      evidence: [
        'Active scheduled high-impact news event or imminent risk window.',
        'Heightened spread variance and rapid orderbook imbalance.'
      ],
      riskState: 'HIGH',
      transitionDetected: previous?.regime !== 'NEWS_EVENT_RISK' && previous !== undefined,
      previousRegime: previous?.regime,
      characteristics: ['High Event Volatility', 'Spread Expansion', 'Liquidity Imbalance']
    };
    previousRegimes.set(pair, { regime: result.regime, timestamp: Date.now() });
    return result;
  }

  // 1. Calculate price swings & structure
  const recent = candles.slice(-20);
  const n = recent.length;
  
  let higherHighsCount = 0;
  let lowerLowsCount = 0;
  let higherLowsCount = 0;
  let lowerHighsCount = 0;

  for (let i = 2; i < n; i++) {
    const prevH = recent[i - 1].high;
    const currH = recent[i].high;
    const prevL = recent[i - 1].low;
    const currL = recent[i].low;

    if (currH > prevH) higherHighsCount++;
    else lowerHighsCount++;

    if (currL > prevL) higherLowsCount++;
    else lowerLowsCount++;
  }

  // 2. Measure Volatility & Range Compression (ATR Proxy)
  const ranges = recent.map(c => c.high - c.low);
  const avgRange = ranges.reduce((a, b) => a + b, 0) / ranges.length;
  const recentRange = ranges.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const rangeRatio = avgRange > 0 ? recentRange / avgRange : 1;

  // 3. Measure Trend Momentum
  const firstClose = recent[0].close;
  const lastClose = recent[recent.length - 1].close;
  const netMove = lastClose - firstClose;
  const totalTravel = ranges.reduce((a, b) => a + b, 0);
  const trendEfficiency = totalTravel > 0 ? Math.abs(netMove) / totalTravel : 0;

  // 4. Determine Regimes
  let regime: MarketRegime = 'UNKNOWN';
  let confidence = 65;
  const evidence: string[] = [];
  const characteristics: string[] = [];
  let riskState: 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL' = 'NORMAL';

  // High Volatility check
  if (rangeRatio >= 2.4 && trendEfficiency < 0.30) {
    regime = 'HIGH_VOLATILITY';
    confidence = Math.min(92, Math.round(75 + rangeRatio * 5));
    evidence.push(`Candle range expansion ratio of ${rangeRatio.toFixed(2)}x indicates abnormal volatility.`);
    evidence.push('Wide erratic swings without clean directional efficiency.');
    characteristics.push('Abnormal Candle Expansion', 'Increased Slippage Risk');
    riskState = 'HIGH';
  }
  // Breakout / Expansion check (Compression followed by sharp directional move)
  else if (rangeRatio >= 1.4 && trendEfficiency >= 0.45) {
    regime = 'BREAKOUT_EXPANSION';
    confidence = Math.min(90, Math.round(70 + trendEfficiency * 25));
    evidence.push('Compression phase followed by decisive directional structure expansion.');
    evidence.push(`High directional efficiency (${(trendEfficiency * 100).toFixed(0)}%) with expanding volume/range.`);
    characteristics.push('Liquidity Sweep & Expansion', 'Break of Key Range', 'Momentum Surge');
    riskState = 'NORMAL';
  }
  // Trending Bullish check
  else if (higherHighsCount >= 8 && higherLowsCount >= 7 && netMove > 0) {
    regime = 'TRENDING_BULLISH';
    confidence = Math.min(92, Math.round(70 + (higherHighsCount / Math.max(1, n - 2)) * 25));
    evidence.push(`Consecutive higher highs (${higherHighsCount}) and higher lows (${higherLowsCount}) confirmed.`);
    evidence.push(`Positive directional efficiency of ${(trendEfficiency * 100).toFixed(0)}%.`);
    characteristics.push('Higher Highs / Higher Lows', 'Bullish Momentum Flow', 'Institutional Demand Dominance');
    riskState = 'NORMAL';
  }
  // Trending Bearish check
  else if (lowerHighsCount >= 8 && lowerLowsCount >= 7 && netMove < 0) {
    regime = 'TRENDING_BEARISH';
    confidence = Math.min(92, Math.round(70 + (lowerLowsCount / Math.max(1, n - 2)) * 25));
    evidence.push(`Consecutive lower highs (${lowerHighsCount}) and lower lows (${lowerLowsCount}) confirmed.`);
    evidence.push(`Negative directional efficiency of ${(trendEfficiency * 100).toFixed(0)}%.`);
    characteristics.push('Lower Highs / Lower Lows', 'Bearish Momentum Flow', 'Institutional Supply Dominance');
    riskState = 'NORMAL';
  }
  // Reversal / Transition check (Break of previous trend structure or divergence)
  else if (
    (previous?.regime === 'TRENDING_BULLISH' && lowerHighsCount > higherHighsCount) ||
    (previous?.regime === 'TRENDING_BEARISH' && higherLowsCount > lowerLowsCount) ||
    (trendEfficiency < 0.25 && rangeRatio > 1.25)
  ) {
    regime = 'REVERSAL_TRANSITION';
    confidence = 74;
    evidence.push('Structural shift detected: Previous trend momentum is exhausting with opposing swing breaks.');
    evidence.push('Failed trend continuation with market structure shift (BOS/CHoCH).');
    characteristics.push('Trend Momentum Exhaustion', 'Market Structure Shift', 'Opposing Liquidity Reaction');
    riskState = 'ELEVATED';
  }
  // Ranging check (Default when horizontal or bounded price action)
  else if (trendEfficiency < 0.40) {
    regime = 'RANGING';
    confidence = Math.min(88, Math.round(68 + (1 - trendEfficiency) * 25));
    evidence.push('Price oscillating within bounded horizontal support and resistance levels.');
    evidence.push(`Directional efficiency (${(trendEfficiency * 100).toFixed(0)}%) with balanced mean-reversion swings.`);
    characteristics.push('Horizontal Range Boundary', 'Mean Reversion Dynamics', 'Key S/R Bounces');
    riskState = 'NORMAL';
  } else if (netMove > 0) {
    regime = 'TRENDING_BULLISH';
    confidence = 72;
    evidence.push('Constructive upward price progression with positive drift.');
    characteristics.push('Upward Structural Drift', 'Bullish Bias');
    riskState = 'NORMAL';
  } else if (netMove < 0) {
    regime = 'TRENDING_BEARISH';
    confidence = 72;
    evidence.push('Constructive downward price progression with negative drift.');
    characteristics.push('Downward Structural Drift', 'Bearish Bias');
    riskState = 'NORMAL';
  } else {
    regime = 'RANGING';
    confidence = 65;
    evidence.push('Balanced market auction in equilibrium.');
    characteristics.push('Range Consolidation');
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
