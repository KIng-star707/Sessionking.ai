import type { 
  CalibratedConfidenceResult, 
  HistoricalReliabilityReport, 
  MarketRegime 
} from '../types';
import { MIN_SAMPLE_SIZE_THRESHOLD } from './strategyPerformanceMemory';

export interface ConfidenceCalibrationInput {
  rawEvidenceScore: number;
  marketRegime: MarketRegime;
  regimeConfidence: number;
  strategyConsensusScore: number;
  timeframeAlignmentScore: number;
  newsRiskState?: string;
  historicalReliability?: HistoricalReliabilityReport;
}

/**
 * SESSIONKING Confidence Calibration Engine
 * Replaces ungrounded raw AI guesses with empirically calibrated confidence curves.
 * Explicitly rejects overconfidence and prevents presenting predictions as guaranteed probabilities.
 */
export function calibrateConfidence(input: ConfidenceCalibrationInput): CalibratedConfidenceResult {
  const {
    rawEvidenceScore,
    marketRegime,
    regimeConfidence,
    strategyConsensusScore,
    timeframeAlignmentScore,
    newsRiskState = 'NORMAL',
    historicalReliability
  } = input;

  // 1. Calculate Component Composite Score (Weighted Multi-Factor Base)
  const evidenceComponent = Math.min(100, Math.max(0, rawEvidenceScore)) * 0.40;
  const consensusComponent = Math.min(100, Math.max(0, strategyConsensusScore)) * 0.25;
  const regimeComponent = Math.min(100, Math.max(0, regimeConfidence)) * 0.20;
  const timeframeComponent = Math.min(100, Math.max(0, timeframeAlignmentScore)) * 0.15;

  let baseRawScore = evidenceComponent + consensusComponent + regimeComponent + timeframeComponent;

  // Penalize for news risk or unknown regime
  if (newsRiskState === 'CRITICAL') baseRawScore *= 0.65;
  else if (newsRiskState === 'HIGH') baseRawScore *= 0.82;
  else if (newsRiskState === 'ELEVATED') baseRawScore *= 0.92;

  if (marketRegime === 'UNKNOWN') baseRawScore *= 0.70;
  if (marketRegime === 'HIGH_VOLATILITY') baseRawScore *= 0.85;

  // 2. Calibration Mapping Curve
  // Real institutional forex distributions compress extreme tails: raw 95% maps to ~80-82% max.
  let calibrated = baseRawScore;
  if (baseRawScore > 85) {
    calibrated = 78 + (baseRawScore - 85) * 0.45; // Dampen extreme optimism
  } else if (baseRawScore > 70) {
    calibrated = 68 + (baseRawScore - 70) * 0.65;
  } else if (baseRawScore > 50) {
    calibrated = 50 + (baseRawScore - 50) * 0.90;
  }

  // 3. Incorporate Empirical Historical Memory if sample size is sufficient
  let sampleSize = 0;
  let historicalWinRate: number | 'INSUFFICIENT_DATA' = 'INSUFFICIENT_DATA';
  let calibrationState: CalibratedConfidenceResult['calibrationState'] = 'OPTIMAL';
  let rationale = 'Confidence calibrated against institutional multi-factor evidence components.';

  if (historicalReliability && historicalReliability.similarSetupsCount >= MIN_SAMPLE_SIZE_THRESHOLD) {
    sampleSize = historicalReliability.similarSetupsCount;
    if (historicalReliability.empiricalWinRate !== null) {
      historicalWinRate = historicalReliability.empiricalWinRate;

      // Blend calibrated score with empirical historical frequency (60% model / 40% empirical)
      const empiricalBlend = (calibrated * 0.60) + (historicalWinRate * 0.40);
      const delta = baseRawScore - historicalWinRate;

      if (delta >= 18) {
        calibrationState = 'OVERCALIBRATED';
        rationale = `Raw model score (${Math.round(baseRawScore)}%) detected as overcalibrated vs historical similar setup win rate (${historicalWinRate}% over ${sampleSize} trades). Dampened to ${Math.round(empiricalBlend)}%.`;
      } else if (delta <= -12) {
        calibrationState = 'UNDERCALIBRATED';
        rationale = `Raw model score (${Math.round(baseRawScore)}%) adjusted upward based on high empirical reliability (${historicalWinRate}% over ${sampleSize} trades).`;
      } else {
        calibrationState = 'OPTIMAL';
        rationale = `Calibrated confidence aligned with empirical historical win rate (${historicalWinRate}% across ${sampleSize} observations).`;
      }

      calibrated = empiricalBlend;
    }
  } else {
    calibrationState = 'INSUFFICIENT_DATA';
    sampleSize = historicalReliability?.similarSetupsCount || 0;
    rationale = `Standard calibration applied. Empirical sample size (${sampleSize}/${MIN_SAMPLE_SIZE_THRESHOLD}) insufficient for historical Bayesian blending.`;
  }

  // Institutional safety clamps: never output > 88% or < 30%
  calibrated = Math.min(88, Math.max(30, Math.round(calibrated)));
  const adjustment = Math.round(calibrated - baseRawScore);

  return {
    rawEvidenceScore: Math.round(baseRawScore),
    calibratedConfidence: calibrated,
    historicalSimilarSetupReliability: historicalWinRate,
    calibrationState,
    calibrationAdjustment: adjustment,
    sampleSize,
    rationale
  };
}
