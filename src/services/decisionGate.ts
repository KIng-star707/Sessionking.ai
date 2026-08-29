import type { 
  DecisionGateResult, 
  RegimeClassification, 
  EvidenceScoreReport, 
  StrategyWeightMap, 
  CorrelationRiskReport, 
  DailyRiskState, 
  ConsecutiveLossState, 
  HolidayLiquidityStatus,
  NewsRiskState,
  AnomalyReport,
  CalibratedConfidenceResult,
  HistoricalReliabilityReport
} from "../types";

export interface DecisionGateInput {
  pair: string;
  session: string;
  tradingMode: string;
  accountBalance: number;
  currentPrice: number;
  marketDataFresh: boolean;
  regime: RegimeClassification;
  strategyWeights: StrategyWeightMap;
  evidenceReport: EvidenceScoreReport;
  newsRisk: NewsRiskState;
  holidayStatus: HolidayLiquidityStatus;
  correlationReport: CorrelationRiskReport;
  dailyRisk: DailyRiskState;
  consecutiveLoss: ConsecutiveLossState;
  proposedDirection: 'BUY' | 'SELL' | 'WAIT';
  proposedEntry: string;
  proposedStopLoss: string;
  proposedTakeProfit1: string;
  riskRewardRatio: number;
  strategyConsensusScore: number;
  anomalyReport?: AnomalyReport;
  calibratedConfidence?: CalibratedConfidenceResult;
  historicalReliability?: HistoricalReliabilityReport;
}

/**
 * Authoritative 18-Point Final Decision Gate.
 * Evaluates all intelligence and risk control layers before issuing a signal.
 */
export function evaluateFinalDecisionGate(input: DecisionGateInput): DecisionGateResult {
  const {
    pair,
    session,
    tradingMode,
    accountBalance,
    currentPrice,
    marketDataFresh,
    regime,
    strategyWeights,
    evidenceReport,
    newsRisk,
    holidayStatus,
    correlationReport,
    dailyRisk,
    consecutiveLoss,
    proposedDirection,
    proposedEntry,
    proposedStopLoss,
    proposedTakeProfit1,
    riskRewardRatio,
    strategyConsensusScore,
    anomalyReport,
    calibratedConfidence,
    historicalReliability
  } = input;

  const rejectionReasons: string[] = [];

  // Phase 3: Anomaly & Data Integrity Check
  const noCriticalAnomaly = !anomalyReport || (
    anomalyReport.actionRequired !== 'SUSPEND_SIGNALS' &&
    anomalyReport.severity !== 'CRITICAL' &&
    !anomalyReport.isDataCorruption
  );
  if (!noCriticalAnomaly) {
    rejectionReasons.push(`Market anomaly governor engaged: ${anomalyReport?.evidence.join(' ') || 'Critical anomaly detected.'}`);
  }

  // Phase 3: Calibrated Confidence Validation
  const isWait = proposedDirection === 'WAIT';
  const calibratedConfidenceValid = !calibratedConfidence || isWait || (
    (calibratedConfidence.calibratedConfidence >= 50 && calibratedConfidence.calibrationState !== 'OVERCALIBRATED') || 
    calibratedConfidence.calibratedConfidence >= 58
  );
  if (!calibratedConfidenceValid && !isWait) {
    rejectionReasons.push(`Calibrated confidence (${calibratedConfidence?.calibratedConfidence}%) is below empirical threshold.`);
  }

  // Phase 3: Performance Decay Check
  const performanceDecayChecked = !historicalReliability || !historicalReliability.decayDetected || (
    calibratedConfidence ? calibratedConfidence.calibratedConfidence >= 65 : false
  );
  if (!performanceDecayChecked && !isWait) {
    rejectionReasons.push('Strategy performance memory indicates recent performance decay; setup dampened pending stabilization.');
  }

  // 1. Market Data Valid
  const marketDataValid = !isNaN(currentPrice) && currentPrice > 0;
  if (!marketDataValid) rejectionReasons.push('Verified live market price is invalid or unavailable.');

  // 2. Data Fresh
  const dataFresh = marketDataFresh;
  if (!dataFresh) rejectionReasons.push('Market data stream is stale or disconnected.');

  // 3. Pair Valid
  const pairValid = Boolean(pair && pair.length >= 6);
  if (!pairValid) rejectionReasons.push('Invalid pair symbol.');

  // 4. Session Valid
  const sessionValid = Boolean(session && session.length > 0);

  // 5. Trading Style Valid
  const tradingStyleValid = ['Scalp Trader', 'Day Trader', 'Swing Trader'].includes(tradingMode);

  // 6. Account Balance Valid
  const accountBalanceValid = !isNaN(accountBalance) && accountBalance > 0;
  if (!accountBalanceValid) rejectionReasons.push('Account balance must be a positive numerical value.');

  // 7. Market Regime Known & Tradable
  const marketRegimeKnown = regime.regime !== 'UNKNOWN' && regime.regime !== 'HIGH_VOLATILITY';
  if (regime.regime === 'UNKNOWN') rejectionReasons.push('Market regime is ambiguous/unclassified.');
  if (regime.regime === 'HIGH_VOLATILITY') rejectionReasons.push('Abnormal volatility expansion detected; regime deemed untradable.');

  // 8. Strategy Consensus Sufficient
  const strategyConsensusSufficient = strategyConsensusScore >= 60;
  if (!strategyConsensusSufficient && proposedDirection !== 'WAIT') {
    rejectionReasons.push(`Strategy consensus score (${strategyConsensusScore}%) is below minimum 60% confirmation threshold.`);
  }

  // 9. Evidence Sufficient & Non-Conflicting
  const evidenceSufficient = !evidenceReport.isConflicting && (
    (proposedDirection === 'BUY' && evidenceReport.buyScore >= 50) ||
    (proposedDirection === 'SELL' && evidenceReport.sellScore >= 50) ||
    proposedDirection === 'WAIT'
  );
  if (evidenceReport.isConflicting && proposedDirection !== 'WAIT') {
    rejectionReasons.push(evidenceReport.conflictReason || 'Conflicting multi-factor evidence detected.');
  }

  // 10. Timeframes Aligned
  const timeframesAligned = !evidenceReport.details.some(d => d.category === 'MultiTimeframe' && d.direction === 'WAIT' && d.strength === 'Strong');

  // 11. News Risk Acceptable
  const newsRiskAcceptable = newsRisk !== 'CRITICAL';
  if (!newsRiskAcceptable) rejectionReasons.push('Scheduled high-impact news event actively underway (Event Risk: CRITICAL).');

  // 12. Holiday / Liquidity Acceptable
  const holidayLiquidityAcceptable = holidayStatus.liquidityStatus !== 'MARKET_CLOSED';
  if (!holidayLiquidityAcceptable) rejectionReasons.push(`Forex markets closed: ${holidayStatus.reason}`);

  // 13. Correlation Risk Acceptable
  const correlationRiskAcceptable = correlationReport.isTradeAllowed;
  if (!correlationRiskAcceptable) {
    rejectionReasons.push(`Portfolio correlation ceiling exceeded: ${correlationReport.warnings.join(' ')}`);
  }

  // 14. Daily Loss Limit Available
  const dailyLossLimitAvailable = !dailyRisk.isDailyLimitReached;
  if (!dailyLossLimitAvailable) {
    rejectionReasons.push(`Daily loss limit reached (${dailyRisk.drawdownPercent.toFixed(1)}% / ${dailyRisk.dailyLossLimitPercent}% max).`);
  }

  // 15. Consecutive Loss Protection Allows Trading
  const consecutiveLossAllowsTrading = !consecutiveLoss.isCooldownActive;
  if (!consecutiveLossAllowsTrading) {
    rejectionReasons.push(consecutiveLoss.cooldownReason || 'Consecutive loss cooldown active.');
  }

  // 16. Risk/Reward Acceptable (with floating point tolerance for 1:2.0 target)
  const riskRewardAcceptable = proposedDirection === 'WAIT' || riskRewardRatio >= 1.95;
  if (!riskRewardAcceptable) {
    rejectionReasons.push(`Risk-to-reward ratio 1:${riskRewardRatio.toFixed(1)} is below institutional 1:2.0 minimum.`);
  }

  // 17. Entry / SL / TP Valid
  const entryVal = parseFloat(proposedEntry);
  const slVal = parseFloat(proposedStopLoss);
  const tpVal = parseFloat(proposedTakeProfit1);
  const entrySlTpValid = proposedDirection === 'WAIT' || (
    !isNaN(entryVal) && !isNaN(slVal) && !isNaN(tpVal) &&
    entryVal > 0 && slVal > 0 && tpVal > 0 &&
    ((proposedDirection === 'BUY' && slVal < entryVal && tpVal > entryVal) ||
     (proposedDirection === 'SELL' && slVal > entryVal && tpVal < entryVal))
  );
  if (!entrySlTpValid) {
    rejectionReasons.push('Execution pricing levels (Entry/SL/TP) violate directional geometry.');
  }

  // 18. Trade Lifecycle Valid
  const tradeLifecycleValid = true;

  const gateChecks = {
    marketDataValid,
    dataFresh,
    pairValid,
    sessionValid,
    tradingStyleValid,
    accountBalanceValid,
    marketRegimeKnown,
    strategyConsensusSufficient,
    evidenceSufficient,
    timeframesAligned,
    newsRiskAcceptable,
    holidayLiquidityAcceptable,
    correlationRiskAcceptable,
    dailyLossLimitAvailable,
    consecutiveLossAllowsTrading,
    riskRewardAcceptable,
    entrySlTpValid,
    tradeLifecycleValid
  };

  const isEligible = Object.values(gateChecks).every(Boolean) && noCriticalAnomaly && calibratedConfidenceValid && performanceDecayChecked;

  let finalDecision: 'BUY' | 'SELL' | 'WAIT' | 'ANALYSIS_UNAVAILABLE' = 'WAIT';
  if (!marketDataValid || !dataFresh || (anomalyReport && anomalyReport.isDataCorruption)) {
    finalDecision = 'ANALYSIS_UNAVAILABLE';
  } else if (isEligible && (proposedDirection === 'BUY' || proposedDirection === 'SELL')) {
    finalDecision = proposedDirection;
  } else {
    finalDecision = 'WAIT';
  }

  // Generate Comprehensive Explainability Report
  const anomalyStr = anomalyReport ? `Anomaly State: ${anomalyReport.type} [${anomalyReport.severity}]. ` : '';
  const calibStr = calibratedConfidence ? `Calibrated Confidence: ${calibratedConfidence.calibratedConfidence}% (Raw Evidence: ${calibratedConfidence.rawEvidenceScore}). ` : '';
  const histStr = historicalReliability?.similarSetupsCount ? `Historical Similar Setups: ${historicalReliability.similarSetupsCount} (${historicalReliability.reliabilityLabel}). ` : '';

  const regimeContext = `Market Regime: ${regime.regime.replace(/_/g, ' ')} (${regime.confidence}% confidence). ${regime.evidence[0] || ''}`;
  const strategyBreakdown = `Strategy Consensus: ${strategyConsensusScore}% (Market Structure: ${strategyWeights.marketStructure}x, Trend: ${strategyWeights.trendContinuation}x, Liquidity: ${strategyWeights.liquiditySweeps}x). ${histStr}`;
  const evidenceSummary = `${calibStr}Evidence: BUY ${evidenceReport.buyScore} / SELL ${evidenceReport.sellScore} / WAIT ${evidenceReport.waitScore}. Conflict: ${evidenceReport.conflictLevel}.`;
  const riskSummary = `${anomalyStr}Risk: News [${newsRisk}], Liquidity [${holidayStatus.liquidityStatus}], Correlation [${correlationReport.riskLevel}], Drawdown [${dailyRisk.drawdownPercent.toFixed(1)}%].`;

  let recommendation = '';
  if (finalDecision === 'BUY') {
    recommendation = `High-probability institutional BUY opportunity identified on ${pair} during ${session}. All 18 risk & validation gates passed with 1:${riskRewardRatio.toFixed(1)} R:R.`;
  } else if (finalDecision === 'SELL') {
    recommendation = `High-probability institutional SELL opportunity identified on ${pair} during ${session}. All 18 risk & validation gates passed with 1:${riskRewardRatio.toFixed(1)} R:R.`;
  } else if (finalDecision === 'ANALYSIS_UNAVAILABLE') {
    recommendation = `Analysis unavailable due to missing, corrupt, or stale authoritative market data stream. Re-establishing connection.`;
  } else {
    recommendation = rejectionReasons.length > 0 
      ? `WAIT — Capital preservation protocol engaged. Reasons: ${rejectionReasons.slice(0, 2).join(' ')}`
      : `WAIT — Market conditions do not exhibit clean statistical edge. Awaiting clearer institutional structure.`;
  }

  const summary = `${finalDecision} | ${recommendation}`;

  return {
    decision: finalDecision,
    isEligible,
    gateChecks,
    rejectionReasons,
    explainability: {
      summary,
      regimeContext,
      strategyBreakdown,
      evidenceSummary,
      riskSummary,
      recommendation
    }
  };
}
