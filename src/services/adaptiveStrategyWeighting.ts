import type { 
  MarketRegime, 
  StrategyWeightMap, 
  AdaptiveWeightConfig, 
  AdaptationAuditEntry,
  StrategyPerformanceRecord
} from '../types';
import { calculateDynamicStrategyWeights } from './strategyWeightingEngine';
import { strategyPerformanceMemory, MIN_SAMPLE_SIZE_THRESHOLD } from './strategyPerformanceMemory';

export const MIN_WEIGHT_BOUND = 0.2;
export const MAX_WEIGHT_BOUND = 2.2;
export const MAX_STEP_ADJUSTMENT = 0.15;
export const CURRENT_MODEL_VERSION = 'WF-2026-08-001';

class AdaptiveStrategyWeightingEngine {
  private auditLog: AdaptationAuditEntry[] = [];
  private activeConfig: AdaptiveWeightConfig;

  constructor() {
    this.activeConfig = {
      version: CURRENT_MODEL_VERSION,
      baseWeights: {
        marketStructure: 1.0,
        trendContinuation: 1.0,
        momentum: 1.0,
        breakoutExpansion: 1.0,
        supportResistance: 1.0,
        liquiditySweeps: 1.0,
        smartMoneyConcepts: 1.0,
        meanReversion: 1.0
      },
      activeWeights: {
        marketStructure: 1.0,
        trendContinuation: 1.0,
        momentum: 1.0,
        breakoutExpansion: 1.0,
        supportResistance: 1.0,
        liquiditySweeps: 1.0,
        smartMoneyConcepts: 1.0,
        meanReversion: 1.0
      },
      minBound: MIN_WEIGHT_BOUND,
      maxBound: MAX_WEIGHT_BOUND,
      lastAdapted: new Date().toISOString(),
      adaptationReason: 'System initialization baseline',
      sampleSize: 0
    };
  }

  /**
   * Compute bounded adaptive weights blending Phase 2 Market Regime rules with Phase 3 Performance Memory
   */
  public computeAdaptiveWeights(params: {
    regime: MarketRegime;
    pair: string;
    session: string;
    style: string;
    timeframe?: string;
  }): { weights: StrategyWeightMap; config: AdaptiveWeightConfig } {
    const { regime, pair, session, style, timeframe = '15m' } = params;

    // 1. Get Phase 2 Dynamic Regime Baseline Weights
    const regimeWeights = calculateDynamicStrategyWeights(regime);
    const adaptedWeights: StrategyWeightMap = { ...regimeWeights };

    const strategies: (keyof StrategyWeightMap)[] = [
      'marketStructure',
      'trendContinuation',
      'momentum',
      'breakoutExpansion',
      'supportResistance',
      'liquiditySweeps',
      'smartMoneyConcepts',
      'meanReversion'
    ];

    let totalSampleCount = 0;
    let adaptationReasons: string[] = [];

    strategies.forEach((strat) => {
      const baseRegimeWeight = regimeWeights[strat] || 1.0;
      const record = strategyPerformanceMemory.getRecord(strat as string, pair, session, style, regime, timeframe);

      let targetMultiplier = 1.0;

      if (record && record.totalTrades >= MIN_SAMPLE_SIZE_THRESHOLD) {
        totalSampleCount += record.totalTrades;

        // Reward high win rate & positive expectancy
        if (record.winRate >= 65 && record.avgRPerTrade >= 0.3) {
          targetMultiplier = 1.25;
        } else if (record.winRate >= 58 && record.avgRPerTrade > 0) {
          targetMultiplier = 1.10;
        } else if (record.winRate < 45 || record.avgRPerTrade < -0.2) {
          targetMultiplier = 0.80;
        }

        // Apply decay dampening
        if (record.decayState === 'SEVERE_DECAY') {
          targetMultiplier *= 0.65;
          adaptationReasons.push(`${String(strat)} penalized due to SEVERE_DECAY (Recent Win Rate: ${record.recentWinRate15}%)`);
        } else if (record.decayState === 'MODERATE_DECAY') {
          targetMultiplier *= 0.85;
          adaptationReasons.push(`${String(strat)} moderated due to MODERATE_DECAY`);
        }
      }

      // Calculate raw target
      const rawTargetWeight = baseRegimeWeight * targetMultiplier;
      const currentActiveWeight = this.activeConfig.activeWeights[strat as string] ?? baseRegimeWeight;

      // Apply Gradual Step Damping (Single-Trade / Short-Term Noise Resistance)
      const diff = rawTargetWeight - currentActiveWeight;
      const stepChange = Math.max(-MAX_STEP_ADJUSTMENT, Math.min(MAX_STEP_ADJUSTMENT, diff));
      const newWeight = currentActiveWeight + stepChange;

      // Strict Bounded Adaptation Enforcement
      const boundedWeight = Math.min(MAX_WEIGHT_BOUND, Math.max(MIN_WEIGHT_BOUND, parseFloat(newWeight.toFixed(2))));
      adaptedWeights[strat] = boundedWeight;

      // Log if significant change occurred
      if (Math.abs(boundedWeight - currentActiveWeight) > 0.05) {
        const audit: AdaptationAuditEntry = {
          id: `audit-${Date.now()}-${strat}`,
          timestamp: new Date().toISOString(),
          strategy: strat as string,
          previousWeight: currentActiveWeight,
          newWeight: boundedWeight,
          reason: `Adapted for ${regime} on ${pair} (${session}). ${record ? `WinRate: ${record.winRate}%, Sample: ${record.totalTrades}` : 'Regime baseline'}`,
          regime,
          performanceEvidence: record ? `Expectancy: ${record.avgRPerTrade}R, Decay: ${record.decayState}` : 'None',
          sampleSize: record?.totalTrades || 0,
          version: CURRENT_MODEL_VERSION
        };
        this.auditLog.push(audit);
        if (this.auditLog.length > 200) this.auditLog.shift();
      }
    });

    this.activeConfig.activeWeights = { ...adaptedWeights };
    this.activeConfig.lastAdapted = new Date().toISOString();
    this.activeConfig.sampleSize = totalSampleCount;
    this.activeConfig.adaptationReason = adaptationReasons.length > 0 
      ? adaptationReasons.join('; ') 
      : `Regime & performance-aligned bounded adaptation for ${regime}`;

    return {
      weights: adaptedWeights,
      config: { ...this.activeConfig }
    };
  }

  /**
   * Reset all adaptive weights back to baseline
   */
  public resetToBaseline(): void {
    this.activeConfig.activeWeights = { ...this.activeConfig.baseWeights };
    this.activeConfig.lastAdapted = new Date().toISOString();
    this.activeConfig.adaptationReason = 'Manual / System Reset to Baseline 1.0x';
  }

  /**
   * Get complete change audit trail
   */
  public getAuditTrail(): AdaptationAuditEntry[] {
    return [...this.auditLog];
  }

  /**
   * Get current configuration
   */
  public getActiveConfig(): AdaptiveWeightConfig {
    return { ...this.activeConfig };
  }
}

export const adaptiveStrategyWeighting = new AdaptiveStrategyWeightingEngine();
