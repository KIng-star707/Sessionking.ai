import type { Candle, AnomalyReport, AnomalyType, AnomalySeverity, NewsRiskState } from '../types';

export interface AnomalyDetectionInput {
  pair: string;
  candles: Candle[];
  currentPrice?: number;
  lastUpdatedTimestamp?: string;
  newsRiskState?: NewsRiskState;
  currentSpreadPips?: number;
  expectedNormalSpreadPips?: number;
}

/**
 * SESSIONKING Market Anomaly Detection Engine
 * Identifies non-standard market dislocations, volatility explosions, data corruption, and news shocks.
 * Communicates risk states to the Risk Governor without generating buy/sell signals.
 */
export function detectMarketAnomalies(input: AnomalyDetectionInput): AnomalyReport {
  const {
    pair,
    candles,
    currentPrice,
    lastUpdatedTimestamp,
    newsRiskState = 'NORMAL',
    currentSpreadPips,
    expectedNormalSpreadPips = pair.includes('JPY') ? 1.5 : pair.includes('XAU') ? 25 : 1.0
  } = input;

  const now = Date.now();
  const evidence: string[] = [];
  let anomalyScore = 0;
  let detectedType: AnomalyType = 'NORMAL';
  let isDataCorruption = false;
  let isNewsDriven = false;

  // 1. DATA INTEGRITY & CORRUPTION CHECKS
  if (!candles || candles.length === 0) {
    if (currentPrice && !isNaN(currentPrice) && currentPrice > 0) {
      return {
        isAnomaly: false,
        score: 10,
        type: 'NORMAL',
        severity: 'NORMAL',
        evidence: ['Live quote feed verified active.'],
        isDataCorruption: false,
        isNewsDriven: false,
        actionRequired: 'CONTINUE',
        timestamp: new Date().toISOString()
      };
    }
    return {
      isAnomaly: true,
      score: 100,
      type: 'DATA_ANOMALY',
      severity: 'CRITICAL',
      evidence: ['No candle data or valid live quote available for anomaly validation.'],
      isDataCorruption: true,
      isNewsDriven: false,
      actionRequired: 'SUSPEND_SIGNALS',
      timestamp: new Date().toISOString()
    };
  }

  // Check for NaN or negative / impossible prices
  const corruptPrices = candles.filter(c => 
    isNaN(c.open) || isNaN(c.high) || isNaN(c.low) || isNaN(c.close) ||
    c.open <= 0 || c.high <= 0 || c.low <= 0 || c.close <= 0 ||
    c.low > c.high || c.open > c.high || c.close > c.high || c.open < c.low || c.close < c.low
  );

  if (corruptPrices.length > 0) {
    return {
      isAnomaly: true,
      score: 100,
      type: 'DATA_ANOMALY',
      severity: 'CRITICAL',
      evidence: [`${corruptPrices.length} candles contain corrupted OHLC price geometry or NaN/zero values.`],
      isDataCorruption: true,
      isNewsDriven: false,
      actionRequired: 'SUSPEND_SIGNALS',
      timestamp: new Date().toISOString()
    };
  }

  // Check timestamp monotonicity & future timestamps
  for (let i = 0; i < candles.length; i++) {
    const currTime = new Date(candles[i].timestamp).getTime();
    if (isNaN(currTime)) {
      isDataCorruption = true;
      anomalyScore += 40;
      evidence.push('Non-parseable timestamp string detected in price series.');
      detectedType = 'TIMESTAMP_ANOMALY';
    } else if (currTime > now + 300000) { // 5 minutes in future
      isDataCorruption = true;
      anomalyScore += 80;
      evidence.push('Future timestamp detected exceeding 5m tolerance.');
      detectedType = 'TIMESTAMP_ANOMALY';
    }

    if (i > 0) {
      const prevTime = new Date(candles[i - 1].timestamp).getTime();
      if (!isNaN(prevTime) && !isNaN(currTime) && currTime < prevTime) {
        isDataCorruption = true;
        anomalyScore += 60;
        evidence.push('Inverted chronological sequence in historical price feed.');
        detectedType = 'TIMESTAMP_ANOMALY';
      }
    }
  }

  // 2. DATA STALENESS CHECK
  if (lastUpdatedTimestamp) {
    const lastTime = new Date(lastUpdatedTimestamp).getTime();
    const diffMinutes = (now - lastTime) / (1000 * 60);
    if (diffMinutes > 45) { // Older than 45 min for active feed
      anomalyScore += 50;
      evidence.push(`Market data is stale (last update ${Math.round(diffMinutes)}m ago).`);
      if (detectedType === 'NORMAL') detectedType = 'DATA_STALENESS';
    }
  }

  // 3. VOLATILITY & PRICE SPIKE DETECTION (14-period ATR baseline)
  const recentCandles = candles.slice(-15);
  if (recentCandles.length >= 5) {
    const ranges = recentCandles.slice(0, -1).map(c => Math.abs(c.high - c.low));
    const avgRange = ranges.reduce((sum, r) => sum + r, 0) / ranges.length;
    const latestCandle = recentCandles[recentCandles.length - 1];
    const latestRange = Math.abs(latestCandle.high - latestCandle.low);

    if (avgRange > 0) {
      const rangeRatio = latestRange / avgRange;

      if (rangeRatio >= 4.5) {
        anomalyScore += 70;
        evidence.push(`Extreme candle range expansion (${rangeRatio.toFixed(1)}x normal 14-period average).`);
        detectedType = 'VOLATILITY_SPIKE';
      } else if (rangeRatio >= 3.0) {
        anomalyScore += 40;
        evidence.push(`Elevated candle volatility spike (${rangeRatio.toFixed(1)}x average range).`);
        if (detectedType === 'NORMAL') detectedType = 'VOLATILITY_SPIKE';
      }

      // Check for price gap
      if (recentCandles.length >= 2) {
        const prevClose = recentCandles[recentCandles.length - 2].close;
        const currOpen = latestCandle.open;
        const gapSize = Math.abs(currOpen - prevClose);
        if (gapSize >= avgRange * 2.0) {
          anomalyScore += 45;
          evidence.push(`Significant price gap detected (${(gapSize / avgRange).toFixed(1)}x average candle range).`);
          if (detectedType === 'NORMAL' || detectedType === 'VOLATILITY_SPIKE') detectedType = 'PRICE_GAP';
        }
      }
    }
  }

  // 4. SPREAD ANOMALY DETECTION
  if (currentSpreadPips !== undefined && expectedNormalSpreadPips > 0) {
    const spreadMultiplier = currentSpreadPips / expectedNormalSpreadPips;
    if (spreadMultiplier >= 3.5) {
      anomalyScore += 60;
      evidence.push(`Spread expansion anomaly (${currentSpreadPips.toFixed(1)} pips vs normal ${expectedNormalSpreadPips.toFixed(1)} pips).`);
      if (detectedType === 'NORMAL') detectedType = 'SPREAD_ANOMALY';
    } else if (spreadMultiplier >= 2.2) {
      anomalyScore += 25;
      evidence.push(`Elevated spread (${currentSpreadPips.toFixed(1)} pips).`);
    }
  }

  // 5. DISTINGUISH NEWS SHOCK FROM BAD DATA
  if (newsRiskState === 'CRITICAL' || newsRiskState === 'HIGH') {
    if (detectedType === 'VOLATILITY_SPIKE' || detectedType === 'PRICE_GAP' || detectedType === 'SPREAD_ANOMALY' || (detectedType as string) === 'PRICE_SPIKE') {
      isNewsDriven = true;
      detectedType = 'NEWS_SHOCK';
      evidence.push(`Volatility confirmed as legitimate high-impact news event release (${newsRiskState} risk context).`);
    }
  }

  // 6. MARKET STRUCTURE ANOMALY (Erratic wick rejection ratio)
  if (recentCandles.length >= 3) {
    const last3 = recentCandles.slice(-3);
    const extremeWicks = last3.filter(c => {
      const body = Math.abs(c.close - c.open);
      const total = Math.abs(c.high - c.low);
      return total > 0 && (body / total) < 0.15; // Wicks make up > 85% of candle
    });

    if (extremeWicks.length >= 3) {
      anomalyScore += 35;
      evidence.push('Erratic multi-directional whip-saw wicks on 3 consecutive candles (Liquidity Void/Anomaly).');
      if (detectedType === 'NORMAL') detectedType = 'MARKET_STRUCTURE_ANOMALY';
    }
  }

  // Cap score to 0 - 100
  anomalyScore = Math.min(100, Math.max(0, anomalyScore));

  // Determine Severity & Action
  let severity: AnomalySeverity = 'NORMAL';
  let actionRequired: AnomalyReport['actionRequired'] = 'CONTINUE';

  if (isDataCorruption || anomalyScore >= 75) {
    severity = 'CRITICAL';
    actionRequired = 'SUSPEND_SIGNALS';
  } else if (anomalyScore >= 50) {
    severity = 'HIGH';
    actionRequired = 'RESTRICT_NEW_TRADES';
  } else if (anomalyScore >= 25) {
    severity = 'ELEVATED';
    actionRequired = 'ELEVATE_CONFIRMATION';
  } else {
    severity = 'NORMAL';
    actionRequired = 'CONTINUE';
    if (detectedType === 'NORMAL') {
      evidence.push('Market pricing and structural conditions operate within normal empirical parameters.');
    }
  }

  return {
    isAnomaly: severity !== 'NORMAL',
    score: anomalyScore,
    type: detectedType,
    severity,
    evidence,
    isDataCorruption,
    isNewsDriven,
    actionRequired,
    timestamp: new Date().toISOString()
  };
}
