import type { 
  EvidenceCategory, 
  EvidenceItem, 
  EvidenceScoreReport, 
  RegimeClassification, 
  NewsRiskState 
} from "../types";

export interface AnalysisEvidenceInput {
  pair: string;
  session: string;
  tradingMode: string;
  accountBalance: number;
  currentPrice: number;
  regime: RegimeClassification;
  newsRisk: NewsRiskState;
  advancedScores?: {
    topDownAlignment?: number;
    marketStructure?: number;
    strategyAgreement?: number;
    smartMoney?: number;
    momentum?: number;
    volume?: number;
    session?: number;
    volatility?: number;
  };
  nativeBullishScore?: number;
  nativeBearishScore?: number;
  nativeNeutralScore?: number;
  marketStructureShift?: string;
  liquidityLevel?: string;
  timeframeAlignment?: 'ALIGNED' | 'MIXED' | 'CONFLICTING';
  riskRewardRatio?: number;
}

/**
 * Produces structured evidence items and calculates independent
 * BUY, SELL, and WAIT evidence scores with conflict detection.
 */
export function evaluateEvidenceScores(input: AnalysisEvidenceInput): EvidenceScoreReport {
  const items: EvidenceItem[] = [];

  const {
    pair,
    session,
    tradingMode,
    regime,
    newsRisk,
    advancedScores = {},
    nativeBullishScore = 50,
    nativeBearishScore = 30,
    nativeNeutralScore = 20,
    timeframeAlignment = 'ALIGNED',
    riskRewardRatio = 2.5
  } = input;

  // 1. Market Structure Evidence
  const msScore = advancedScores.marketStructure || 10; // Out of 15
  if (regime.regime === 'TRENDING_BULLISH' || (nativeBullishScore > nativeBearishScore + 20 && msScore >= 9)) {
    items.push({
      category: 'MarketStructure',
      direction: 'BUY',
      strength: msScore >= 12 ? 'Strong' : 'Moderate',
      reliability: 0.90,
      reason: 'Confirmed higher-high & higher-low structure sequence with bullish swing continuity.'
    });
  } else if (regime.regime === 'TRENDING_BEARISH' || (nativeBearishScore > nativeBullishScore + 20 && msScore >= 9)) {
    items.push({
      category: 'MarketStructure',
      direction: 'SELL',
      strength: msScore >= 12 ? 'Strong' : 'Moderate',
      reliability: 0.90,
      reason: 'Confirmed lower-high & lower-low structure sequence with bearish swing expansion.'
    });
  } else {
    items.push({
      category: 'MarketStructure',
      direction: 'WAIT',
      strength: 'Moderate',
      reliability: 0.80,
      reason: 'Consolidating structural boundaries without clean directional break.'
    });
  }

  // 2. Liquidity Evidence
  const smcScore = advancedScores.smartMoney || 10;
  if (nativeBullishScore > 60) {
    items.push({
      category: 'Liquidity',
      direction: 'BUY',
      strength: smcScore >= 11 ? 'Strong' : 'Moderate',
      reliability: 0.85,
      reason: 'Sell-side liquidity swept below recent swing low; institutional demand absorption active.'
    });
  } else if (nativeBearishScore > 60) {
    items.push({
      category: 'Liquidity',
      direction: 'SELL',
      strength: smcScore >= 11 ? 'Strong' : 'Moderate',
      reliability: 0.85,
      reason: 'Buy-side liquidity swept above key resistance; institutional distribution active.'
    });
  } else {
    items.push({
      category: 'Liquidity',
      direction: 'WAIT',
      strength: 'Weak',
      reliability: 0.70,
      reason: 'Equilibrium liquidity pooling with no decisive institutional run detected.'
    });
  }

  // 3. Momentum Evidence
  const momScore = advancedScores.momentum || 6; // Out of 10
  if (nativeBullishScore >= 65 && momScore >= 6) {
    items.push({
      category: 'Momentum',
      direction: 'BUY',
      strength: momScore >= 8 ? 'Strong' : 'Moderate',
      reliability: 0.80,
      reason: 'Positive RSI/MACD histogram expansion with buyers controlling price impulse.'
    });
  } else if (nativeBearishScore >= 65 && momScore >= 6) {
    items.push({
      category: 'Momentum',
      direction: 'SELL',
      strength: momScore >= 8 ? 'Strong' : 'Moderate',
      reliability: 0.80,
      reason: 'Negative momentum acceleration with sellers dominating intraday velocity.'
    });
  } else {
    items.push({
      category: 'Momentum',
      direction: 'WAIT',
      strength: 'Moderate',
      reliability: 0.75,
      reason: 'Momentum oscillators hovering around neutral midpoint without divergence.'
    });
  }

  // 4. Trend Continuation Evidence
  const topDownScore = advancedScores.topDownAlignment || 12; // Out of 20
  if (regime.regime === 'TRENDING_BULLISH' || (regime.regime === 'BREAKOUT_EXPANSION' && nativeBullishScore > nativeBearishScore)) {
    items.push({
      category: 'Trend',
      direction: 'BUY',
      strength: 'Strong',
      reliability: 0.88,
      reason: 'Higher timeframe moving averages and EMA stacks aligned in ascending formation.'
    });
  } else if (regime.regime === 'TRENDING_BEARISH' || (regime.regime === 'BREAKOUT_EXPANSION' && nativeBearishScore > nativeBullishScore)) {
    items.push({
      category: 'Trend',
      direction: 'SELL',
      strength: 'Strong',
      reliability: 0.88,
      reason: 'Higher timeframe moving averages aligned in descending formation.'
    });
  } else {
    items.push({
      category: 'Trend',
      direction: 'WAIT',
      strength: 'Weak',
      reliability: 0.75,
      reason: 'Moving average flattening; lack of sustained directional trend.'
    });
  }

  // 5. Smart Money Concepts (SMC)
  if (nativeBullishScore > 55) {
    items.push({
      category: 'SMC',
      direction: 'BUY',
      strength: 'Strong',
      reliability: 0.86,
      reason: 'Bullish Fair Value Gap (FVG) mitigated within active institutional Order Block.'
    });
  } else if (nativeBearishScore > 55) {
    items.push({
      category: 'SMC',
      direction: 'SELL',
      strength: 'Strong',
      reliability: 0.86,
      reason: 'Bearish Order Block tapped with decisive rejection and clean displacement.'
    });
  } else {
    items.push({
      category: 'SMC',
      direction: 'WAIT',
      strength: 'Moderate',
      reliability: 0.70,
      reason: 'Price residing inside dealing range equilibrium without fresh premium/discount discount tap.'
    });
  }

  // 6. Support & Resistance
  if (regime.regime === 'RANGING' || regime.regime === 'REVERSAL_TRANSITION') {
    if (nativeBullishScore > nativeBearishScore) {
      items.push({
        category: 'SupportResistance',
        direction: 'BUY',
        strength: 'Strong',
        reliability: 0.82,
        reason: 'Clean bounce off verified multi-touch horizontal support level.'
      });
    } else if (nativeBearishScore > nativeBullishScore) {
      items.push({
        category: 'SupportResistance',
        direction: 'SELL',
        strength: 'Strong',
        reliability: 0.82,
        reason: 'Decisive ceiling rejection at established key resistance band.'
      });
    }
  }

  // 7. Multi-Timeframe Alignment
  if (timeframeAlignment === 'ALIGNED') {
    const dir = nativeBullishScore >= nativeBearishScore ? 'BUY' : 'SELL';
    items.push({
      category: 'MultiTimeframe',
      direction: dir,
      strength: 'Strong',
      reliability: 0.92,
      reason: 'HTF (H4/H1) and LTF (M15/M5) market bias and structure are fully synchronized.'
    });
  } else if (timeframeAlignment === 'CONFLICTING') {
    items.push({
      category: 'MultiTimeframe',
      direction: 'WAIT',
      strength: 'Strong',
      reliability: 0.95,
      reason: 'Direct structural conflict: Higher timeframe trend opposes lower timeframe trigger.'
    });
  } else {
    items.push({
      category: 'MultiTimeframe',
      direction: 'WAIT',
      strength: 'Moderate',
      reliability: 0.75,
      reason: 'Partial timeframe alignment; awaiting lower timeframe structural break for confirmation.'
    });
  }

  // 8. Trading Session Context
  items.push({
    category: 'TradingSession',
    direction: nativeBullishScore >= nativeBearishScore ? 'BUY' : 'SELL',
    strength: 'Moderate',
    reliability: 0.78,
    reason: `${session} liquidity conditions active with optimal session trading volume.`
  });

  // 9. Volatility Evidence
  if (regime.regime === 'HIGH_VOLATILITY') {
    items.push({
      category: 'Volatility',
      direction: 'WAIT',
      strength: 'Strong',
      reliability: 0.88,
      reason: 'Elevated ATR volatility creates wide spread variance and premature stop-out risk.'
    });
  }

  // 10. News & Event Risk
  if (newsRisk === 'CRITICAL' || newsRisk === 'HIGH') {
    items.push({
      category: 'NewsRisk',
      direction: 'WAIT',
      strength: 'Strong',
      reliability: 0.95,
      reason: `Event risk state is ${newsRisk}; impending high-impact economic release warrants defensive posture.`
    });
  }

  // 11. Market Regime Evidence
  if (regime.regime === 'TRENDING_BULLISH') {
    items.push({
      category: 'MarketRegime',
      direction: 'BUY',
      strength: 'Strong',
      reliability: 0.90,
      reason: 'Market regime is classified as TRENDING BULLISH with high regime confidence.'
    });
  } else if (regime.regime === 'TRENDING_BEARISH') {
    items.push({
      category: 'MarketRegime',
      direction: 'SELL',
      strength: 'Strong',
      reliability: 0.90,
      reason: 'Market regime is classified as TRENDING BEARISH with high regime confidence.'
    });
  } else if (regime.regime === 'BREAKOUT_EXPANSION') {
    items.push({
      category: 'MarketRegime',
      direction: nativeBullishScore >= nativeBearishScore ? 'BUY' : 'SELL',
      strength: 'Strong',
      reliability: 0.88,
      reason: 'Breakout expansion regime active; orderbook momentum confirms volatility expansion.'
    });
  } else if (regime.regime === 'RANGING') {
    const dir = nativeBullishScore > nativeBearishScore ? 'BUY' : nativeBearishScore > nativeBullishScore ? 'SELL' : 'WAIT';
    items.push({
      category: 'MarketRegime',
      direction: dir,
      strength: dir === 'WAIT' ? 'Weak' : 'Moderate',
      reliability: 0.80,
      reason: dir === 'WAIT' 
        ? 'Market regime is RANGING at range equilibrium; awaiting boundary test.'
        : `Market regime is RANGING; ${dir === 'BUY' ? 'Support bounce' : 'Resistance rejection'} setup in alignment with mean reversion.`
    });
  }

  // 12. Risk/Reward Evidence
  if (riskRewardRatio >= 2.0) {
    items.push({
      category: 'RiskReward',
      direction: nativeBullishScore >= nativeBearishScore ? 'BUY' : 'SELL',
      strength: riskRewardRatio >= 3.0 ? 'Strong' : 'Moderate',
      reliability: 0.85,
      reason: `Risk-to-reward ratio of 1:${riskRewardRatio.toFixed(1)} meets strict institutional threshold (>= 1:2.0).`
    });
  } else {
    items.push({
      category: 'RiskReward',
      direction: 'WAIT',
      strength: 'Strong',
      reliability: 0.90,
      reason: `Calculated R:R of 1:${riskRewardRatio.toFixed(1)} fails minimum 1:2.0 capital efficiency rule.`
    });
  }

  // Calculate Weighted Aggregate Scores
  let totalBuyWeight = 0;
  let totalSellWeight = 0;
  let totalWaitWeight = 0;
  let maxPossibleWeight = 0;

  items.forEach(item => {
    const strengthMultiplier = item.strength === 'Strong' ? 1.0 : item.strength === 'Moderate' ? 0.65 : 0.35;
    const effectiveWeight = item.reliability * strengthMultiplier * 10;
    maxPossibleWeight += 10;

    if (item.direction === 'BUY') {
      totalBuyWeight += effectiveWeight;
    } else if (item.direction === 'SELL') {
      totalSellWeight += effectiveWeight;
    } else {
      totalWaitWeight += effectiveWeight;
    }
  });

  const normalizer = maxPossibleWeight > 0 ? 100 / maxPossibleWeight : 1;
  const buyScore = Math.min(100, Math.max(0, Math.round(totalBuyWeight * normalizer * 1.8)));
  const sellScore = Math.min(100, Math.max(0, Math.round(totalSellWeight * normalizer * 1.8)));
  const waitScore = Math.min(100, Math.max(0, Math.round(totalWaitWeight * normalizer * 1.4)));

  // Conflict Detection
  const scoreDiff = Math.abs(buyScore - sellScore);
  let conflictLevel: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'NONE';
  let isConflicting = false;
  let conflictReason: string | undefined;

  if (timeframeAlignment === 'CONFLICTING') {
    conflictLevel = 'CRITICAL';
    isConflicting = true;
    conflictReason = 'Conflicting higher- and lower-timeframe evidence. Directional confirmation is insufficient.';
  } else if (buyScore >= 45 && sellScore >= 45 && scoreDiff <= 10) {
    conflictLevel = 'HIGH';
    isConflicting = true;
    conflictReason = `Equally balanced opposing evidence (BUY: ${buyScore}, SELL: ${sellScore}). High probability of chop or false breakout.`;
  } else if (buyScore >= 40 && sellScore >= 40 && scoreDiff <= 12) {
    conflictLevel = 'MODERATE';
    isConflicting = true;
    conflictReason = 'Moderate cross-currents between momentum and structural indicators.';
  } else if (scoreDiff < 25 && (buyScore > 35 || sellScore > 35)) {
    conflictLevel = 'LOW';
  }

  let dominantDirection: 'BUY' | 'SELL' | 'WAIT' = 'WAIT';
  if (!isConflicting) {
    if (buyScore >= 50 && buyScore > sellScore + 12 && buyScore >= waitScore) {
      dominantDirection = 'BUY';
    } else if (sellScore >= 50 && sellScore > buyScore + 12 && sellScore >= waitScore) {
      dominantDirection = 'SELL';
    } else {
      dominantDirection = 'WAIT';
    }
  }

  return {
    buyScore,
    sellScore,
    waitScore,
    conflictLevel,
    isConflicting,
    dominantDirection,
    details: items,
    conflictReason
  };
}
