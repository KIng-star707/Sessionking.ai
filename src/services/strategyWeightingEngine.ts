import type { MarketRegime, StrategyWeightMap } from "../types";

export interface HistoricalPerformanceContext {
  pair?: string;
  tradingMode?: string;
  session?: string;
  regime?: MarketRegime;
  sampleSize: number;
  winRate: number; // e.g. 0.65
  profitFactor?: number;
}

const BASELINE_WEIGHTS: StrategyWeightMap = {
  marketStructure: 1.0,
  trendContinuation: 1.0,
  momentum: 1.0,
  breakoutExpansion: 1.0,
  supportResistance: 1.0,
  liquiditySweeps: 1.0,
  smartMoneyConcepts: 1.0,
  meanReversion: 1.0,
};

/**
 * Calculates dynamic strategy weights based on the active market regime.
 * Preserves the integrity of existing trading strategies while modulating
 * their influence on the consensus layer.
 */
export function calculateDynamicStrategyWeights(
  regime: MarketRegime,
  historicalContext?: HistoricalPerformanceContext
): StrategyWeightMap {
  const weights: StrategyWeightMap = { ...BASELINE_WEIGHTS };

  switch (regime) {
    case 'TRENDING_BULLISH':
    case 'TRENDING_BEARISH':
      // Increase trend continuation, momentum, and structure; reduce mean-reversion
      weights.trendContinuation = 1.5;
      weights.marketStructure = 1.4;
      weights.momentum = 1.3;
      weights.breakoutExpansion = 1.1;
      weights.smartMoneyConcepts = 1.2;
      weights.supportResistance = 0.7;
      weights.meanReversion = 0.4;
      weights.liquiditySweeps = 0.9;
      break;

    case 'RANGING':
      // Increase Support/Resistance, Mean-Reversion, Liquidity; reduce Trend-Following
      weights.supportResistance = 1.5;
      weights.meanReversion = 1.4;
      weights.liquiditySweeps = 1.3;
      weights.smartMoneyConcepts = 1.1;
      weights.momentum = 0.7;
      weights.marketStructure = 0.8;
      weights.trendContinuation = 0.5;
      weights.breakoutExpansion = 0.6;
      break;

    case 'BREAKOUT_EXPANSION':
      // Increase Breakout, Liquidity, Momentum, Volatility; reduce Mean-Reversion
      weights.breakoutExpansion = 1.6;
      weights.liquiditySweeps = 1.4;
      weights.momentum = 1.3;
      weights.marketStructure = 1.2;
      weights.smartMoneyConcepts = 1.1;
      weights.trendContinuation = 1.1;
      weights.supportResistance = 0.6;
      weights.meanReversion = 0.3;
      break;

    case 'REVERSAL_TRANSITION':
      // Increase Liquidity Sweeps, Structure Breaks (CHoCH/BOS), SMC Reversals, Divergence
      weights.liquiditySweeps = 1.5;
      weights.smartMoneyConcepts = 1.4;
      weights.marketStructure = 1.4;
      weights.momentum = 1.3; // Divergence checks
      weights.supportResistance = 1.2;
      weights.breakoutExpansion = 0.8;
      weights.trendContinuation = 0.4;
      weights.meanReversion = 0.7;
      break;

    case 'HIGH_VOLATILITY':
      // Emphasize Liquidity and SMC; reduce tight structure assumption
      weights.liquiditySweeps = 1.4;
      weights.smartMoneyConcepts = 1.3;
      weights.momentum = 1.1;
      weights.marketStructure = 1.0;
      weights.trendContinuation = 0.8;
      weights.supportResistance = 0.7;
      weights.breakoutExpansion = 0.9;
      weights.meanReversion = 0.4;
      break;

    case 'LOW_LIQUIDITY':
    case 'NEWS_EVENT_RISK':
    case 'UNKNOWN':
    default:
      // Keep flat baseline weights (1.0)
      return { ...BASELINE_WEIGHTS };
  }

  // Incorporate historical performance ONLY if sample size threshold (>= 15 verified trades) is met
  if (historicalContext && historicalContext.sampleSize >= 15) {
    const perfMultiplier = historicalContext.winRate >= 0.60 ? 1.15 : historicalContext.winRate <= 0.40 ? 0.85 : 1.0;
    
    // Scale regime-favored strategies modestly without overriding current market evidence
    if (regime === 'TRENDING_BULLISH' || regime === 'TRENDING_BEARISH') {
      weights.trendContinuation = Math.round(weights.trendContinuation * perfMultiplier * 100) / 100;
      weights.marketStructure = Math.round(weights.marketStructure * perfMultiplier * 100) / 100;
    } else if (regime === 'RANGING') {
      weights.supportResistance = Math.round(weights.supportResistance * perfMultiplier * 100) / 100;
      weights.meanReversion = Math.round(weights.meanReversion * perfMultiplier * 100) / 100;
    }
  }

  return weights;
}

/**
 * Applies dynamic weights to individual strategy scores to produce
 * the weighted consensus score.
 */
export function applyStrategyWeightsToScores(
  rawScores: {
    marketStructure?: number;
    trendContinuation?: number;
    momentum?: number;
    breakoutExpansion?: number;
    supportResistance?: number;
    liquiditySweeps?: number;
    smartMoneyConcepts?: number;
    meanReversion?: number;
  },
  weights: StrategyWeightMap
): { weightedScore: number; componentBreakdown: Record<string, number> } {
  let totalWeightedScore = 0;
  let totalWeight = 0;
  const componentBreakdown: Record<string, number> = {};

  const entries: Array<[keyof StrategyWeightMap, number]> = [
    ['marketStructure', rawScores.marketStructure ?? 70],
    ['trendContinuation', rawScores.trendContinuation ?? 70],
    ['momentum', rawScores.momentum ?? 70],
    ['breakoutExpansion', rawScores.breakoutExpansion ?? 65],
    ['supportResistance', rawScores.supportResistance ?? 65],
    ['liquiditySweeps', rawScores.liquiditySweeps ?? 75],
    ['smartMoneyConcepts', rawScores.smartMoneyConcepts ?? 75],
    ['meanReversion', rawScores.meanReversion ?? 50],
  ];

  entries.forEach(([key, score]) => {
    const weight = weights[key] ?? 1.0;
    const effective = score * weight;
    totalWeightedScore += effective;
    totalWeight += weight;
    componentBreakdown[key] = Math.round(score * weight);
  });

  const weightedScore = totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 70;
  return { weightedScore, componentBreakdown };
}
