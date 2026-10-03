export type Session = 'All' | 'Asian' | 'London' | 'New York' | 'Overlap';
export type Plan = 'free' | 'starter' | 'pro' | 'premium' | 'institutional';
export type PaymentType = 'subscription' | 'intelligence';

export interface User {
  id: string;
  email: string;
  plan: Plan;
  currentPlan?: Plan;
  subscriptionActive?: boolean;
  subscriptionStartDate?: string;
  subscriptionExpiryDate?: string;
  subscriptionExpiredAt?: string;
  previousPlan?: string;
  lastExpiryReminderDate?: string;
  intelligenceCredits?: number;
  intelligenceActive?: boolean;
  paystackReference?: string;
  paymentStatus?: 'none' | 'pending' | 'successful' | 'expired';
  accountStatus?: 'active' | 'suspended';
  displayName?: string;
  phoneNumber?: string;
  country?: string;
  photoURL?: string;
  createdAt?: string;
  lastLoginAt?: string;
  lastLoginLocation?: string;
  suspended?: boolean;
  suspendedAt?: string;
  suspendedReason?: string;
  suspendedBy?: string;
  suspensionLiftedAt?: string;
  role?: string;

  planExpiresAt?: string;
  tradingMode?: 'Scalp Trader' | 'Day Trader' | 'Swing Trader';
  preferredPairs?: string[];
  notificationsEnabled?: boolean;
  volatilityAlertsEnabled?: boolean;
  terminalUsagesRemaining?: number;
  terminalUsagesTotal?: number;
}

export interface TradeHistory {
  id?: string;
  tradeId?: string;
  pair: string;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice?: number;
  stopLoss: number;
  takeProfit: number;
  outcome?: 'WIN' | 'LOSS' | 'OPEN';
  createdAt: string;
  closedAt?: string;
  pips?: number;
  session?: string;
  mode?: string;
  dataSource?: string;
  disclaimer?: string;
}

export interface Announcement {
  id: string;
  message: string;
  createdAt: string;
  active: boolean;
}

export interface Signal {
  id?: string;
  tradeId?: string;
  pair: string;
  strategy: string; // E.g. "Primary Scenario: Breakout"
  trade_status?: 'SETUP_DETECTED' | 'ENTRY_ARMED' | 'ACTIVE' | 'FILLED' | 'WAIT' | 'BLOCKED' | 'ALLOWED' | 'CLOSED_TP' | 'CLOSED_SL' | 'TP1_REACHED' | 'TP2_REACHED' | 'TP3_REACHED' | 'STOPPED_OUT' | 'INVALIDATED' | 'EXPIRED' | 'CANCELLED';
  market_quality_score?: number;
  signal_tier?: string;
  entry_type?: string;
  trap_risk?: boolean;
  trade_type: 'BUY' | 'SELL' | 'WAIT';
  entry_price: string;
  stop_loss: string;
  take_profit_1: string;
  take_profit_2: string;
  take_profit_3?: string;
  timeframe: string;
  confidence: string;
  risk_percent: number;
  reason: string;
  timestamp: string;
  isDelayed?: boolean; // For Free tier
  styleWarning?: string;
  accountWarning?: string;
  entryClassification?: 'Market' | 'Pullback' | 'Breakout' | 'Pending';
  
  // Phase 1 Hardening & Immutable Trade Context
  dataSource?: 'FCS_API' | 'UNAVAILABLE';
  freshness?: 'FRESH' | 'STALE' | 'UNAVAILABLE';
  frozenContext?: {
    tradeId: string;
    pair: string;
    session: string;
    tradingMode: string;
    accountBalance: number;
    riskPercent: number;
    entryPrice: string;
    stopLoss: string;
    takeProfit1: string;
    takeProfit2: string;
    createdAt: string;
    version: string;
  };
  notifiedSL?: boolean;
  notifiedTP1?: boolean;
  closedAt?: string;
  closedPrice?: number;
  finalOutcome?: 'WIN' | 'LOSS';
  pipsRealized?: number;
  
  // New Engine V3 Fields
  confidenceRating?: 'Elite' | 'Very Strong' | 'Strong' | 'Moderate' | 'Ignore';
  marketContext?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  trendStrength?: 'Weak' | 'Moderate' | 'Strong';
  marketEnvironment?: 'Trending' | 'Ranging' | 'Expansion' | 'Consolidation';
  confidenceScore?: number;
  advancedScores?: {
    topDownAlignment: number; // Max 20
    marketStructure: number; // Max 15
    strategyAgreement: number; // Max 20
    smartMoney: number; // Max 15
    momentum: number; // Max 10
    volume: number; // Max 10
    session: number; // Max 5
    volatility: number; // Max 5
  };

  bullishScore?: number;
  bearishScore?: number;
  neutralScore?: number;
  
  // Keep old fields optional for backwards compatibility during transition
  session?: string;
  type?: 'BUY' | 'SELL' | 'WAIT';
  tradingMode?: string;
  dailyBias?: string;
  executionType?: string;
  estimatedTriggerTime?: string;
  entry?: string;
  stopLoss?: string;
  takeProfit1?: string;
  takeProfit2?: string;
  takeProfit3?: string;
  recommendedLotSize?: string;
  riskReward?: string;
  risk_reward?: string;
  recommended_lot_size?: string;
  model?: string;
  status?: string;
  duration?: string;
  trading_style?: string;
  account_balance?: number;
  probabilityBreakdown?: {
    structure: number;
    momentum: number;
    liquidity: number;
  };
  technicalScores?: {
    rsi: number;
    macd: number;
    ma: number;
    stochastic: number;
    atr: number;
    supportResistance: number;
  };
  sessionStrength?: string;
  invalidation?: string;
  reasoning?: string[];
  chartPatterns?: string[];
  keyLiquidityLevels?: string[];
  marketStructureShifts?: string[];

  // Phase 2 Advanced Market Intelligence & Risk Governor
  marketRegime?: MarketRegime;
  regimeConfidence?: number;
  regimeEvidence?: string[];
  regimeRiskState?: 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  regimeTransitionDetected?: boolean;
  strategyWeights?: Record<string, number>;
  evidenceScores?: {
    buy: number;
    sell: number;
    wait: number;
    conflictLevel: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
    dominantDirection: 'BUY' | 'SELL' | 'WAIT';
  };
  newsRiskState?: 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  holidayLiquidityState?: 'NORMAL' | 'REDUCED' | 'MARKET_CLOSED';
  correlationRiskLevel?: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  dailyRiskStatus?: 'NORMAL' | 'WARNING' | 'LIMIT_REACHED';
  lossStreakCount?: number;
  isCooldownActive?: boolean;
  decisionGatePassed?: boolean;
  decisionRationale?: {
    summary: string;
    regimeContext: string;
    strategyBreakdown: string;
    evidenceSummary: string;
    riskSummary: string;
    recommendation: string;
  };
  // Phase 3: Advanced Learning, Calibration & Anomaly Fields
  anomalyReport?: AnomalyReport;
  calibratedConfidence?: CalibratedConfidenceResult;
  historicalReliability?: HistoricalReliabilityReport;
  adaptiveWeights?: AdaptiveWeightConfig;
  modelVersions?: {
    strategyVersion: string;
    weightConfigVersion: string;
    calibrationVersion: string;
  };
}

export type AnomalyType = 
  | 'PRICE_SPIKE'
  | 'VOLATILITY_SPIKE'
  | 'SPREAD_ANOMALY'
  | 'LIQUIDITY_ANOMALY'
  | 'PRICE_GAP'
  | 'DATA_STALENESS'
  | 'TIMESTAMP_ANOMALY'
  | 'API_ANOMALY'
  | 'MARKET_STRUCTURE_ANOMALY'
  | 'NEWS_SHOCK'
  | 'DATA_ANOMALY'
  | 'NORMAL';

export type AnomalySeverity = 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL';

export interface AnomalyReport {
  isAnomaly: boolean;
  score: number; // 0 to 100
  type: AnomalyType;
  severity: AnomalySeverity;
  evidence: string[];
  isDataCorruption: boolean;
  isNewsDriven: boolean;
  actionRequired: 'CONTINUE' | 'ELEVATE_CONFIRMATION' | 'RESTRICT_NEW_TRADES' | 'SUSPEND_SIGNALS';
  timestamp: string;
}

export interface CalibratedConfidenceResult {
  rawEvidenceScore: number;
  calibratedConfidence: number;
  historicalSimilarSetupReliability: number | 'INSUFFICIENT_DATA';
  calibrationState: 'OPTIMAL' | 'OVERCALIBRATED' | 'UNDERCALIBRATED' | 'INSUFFICIENT_DATA';
  calibrationAdjustment: number;
  sampleSize: number;
  rationale: string;
}

export interface HistoricalReliabilityReport {
  similarSetupsCount: number;
  empiricalWinRate: number | null; // null if insufficient data
  averageRMultiple: number | null;
  profitFactor: number | null;
  reliabilityLabel: 'HIGH' | 'MODERATE' | 'LOW' | 'INSUFFICIENT_DATA';
  regimePerformance: 'STRONG' | 'MODERATE' | 'WEAK' | 'INSUFFICIENT_DATA';
  decayDetected: boolean;
}

export interface StrategyPerformanceRecord {
  strategyKey: string;
  pair: string;
  session: string;
  style: string;
  timeframe: string;
  regime: MarketRegime;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number; // 0 - 100
  profitFactor: number;
  netRMultiple: number;
  avgRPerTrade: number;
  maxDrawdownPercent: number;
  recentTrades15: { result: 'WIN' | 'LOSS'; rMultiple: number; timestamp: string }[];
  recentWinRate15: number;
  decayState: 'HEALTHY' | 'MODERATE_DECAY' | 'SEVERE_DECAY' | 'INSUFFICIENT_DATA';
  lastUpdated: string;
}

export interface AdaptiveWeightConfig {
  version: string;
  baseWeights: Record<string, number>;
  activeWeights: Record<string, number>;
  minBound: number; // 0.2
  maxBound: number; // 2.2
  lastAdapted: string;
  adaptationReason: string;
  sampleSize: number;
}

export interface AdaptationAuditEntry {
  id: string;
  timestamp: string;
  strategy: string;
  previousWeight: number;
  newWeight: number;
  reason: string;
  regime: MarketRegime;
  performanceEvidence: string;
  sampleSize: number;
  version: string;
}

export interface HistoricalBacktestParams {
  pair: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  session: 'All' | 'Asian' | 'London' | 'New York' | 'Overlap';
  tradingStyle: 'Scalp Trader' | 'Day Trader' | 'Swing Trader';
  startingBalance: number;
  riskPercent: number;
  spreadPips?: number;
  slippagePips?: number;
  executionModel: 'REALISTIC_SPREAD_SLIPPAGE' | 'APPROXIMATE';
}

export interface HistoricalTradeRecord {
  tradeId: string;
  pair: string;
  date: string;
  time: string;
  session: string;
  style: string;
  timeframe: string;
  regime: MarketRegime;
  strategyConsensus: string;
  evidenceScore: number;
  confidence: number;
  calibratedConfidence: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2?: number;
  exitPrice: number;
  exitReason: 'TP1' | 'TP2' | 'SL' | 'SESSION_CLOSE' | 'TRAILED_STOP';
  riskUsd: number;
  pnlUsd: number;
  pips: number;
  rMultiple: number;
  outcome: 'WIN' | 'LOSS' | 'BREAKEVEN';
  durationMinutes: number;
  anomalyStateAtEntry: AnomalySeverity;
}

export interface BacktestPerformanceReport {
  summary: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    breakevenTrades: number;
    winRate: number;
    lossRate: number;
    grossProfitUsd: number;
    grossLossUsd: number;
    netPnlUsd: number;
    netPnlPercent: number;
    profitFactor: number;
    avgWinUsd: number;
    avgLossUsd: number;
    avgRMultiple: number;
    expectancyR: number;
    maxDrawdownUsd: number;
    maxDrawdownPercent: number;
    maxConsecutiveWins: number;
    maxConsecutiveLosses: number;
    largestWinUsd: number;
    largestLossUsd: number;
    sharpeRatio: number;
  };
  breakdowns: {
    byPair: Record<string, { trades: number; winRate: number; pnl: number }>;
    bySession: Record<string, { trades: number; winRate: number; pnl: number }>;
    byRegime: Record<string, { trades: number; winRate: number; pnl: number }>;
    byStrategy: Record<string, { trades: number; winRate: number; pnl: number }>;
  };
  equityCurve: {
    date: string;
    tradeNumber: number;
    balance: number;
    equity: number;
    drawdownPercent: number;
  }[];
  journal: HistoricalTradeRecord[];
  executionModel: string;
  disclaimer: string;
}

export interface WalkForwardWindow {
  fold: number;
  trainStart: string;
  trainEnd: string;
  validateStart: string;
  validateEnd: string;
  forwardStart: string;
  forwardEnd: string;
  trainMetrics: { winRate: number; profitFactor: number; totalTrades: number; netPnl: number };
  forwardMetrics: { winRate: number; profitFactor: number; totalTrades: number; netPnl: number };
  wfeEfficiencyRatio: number; // Forward PF / Train PF
  overfittingStatus: 'HEALTHY' | 'ACCEPTABLE' | 'POSSIBLE_OVERFITTING';
}

export interface WalkForwardResult {
  pair: string;
  timeframe: string;
  totalFolds: number;
  windows: WalkForwardWindow[];
  overallEfficiencyScore: number;
  systemRobustness: 'ROBUST' | 'MODERATE' | 'OVERFITTED';
  recommendations: string[];
}

export interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type MarketRegime = 
  | 'TRENDING_BULLISH'
  | 'TRENDING_BEARISH'
  | 'RANGING'
  | 'BREAKOUT'
  | 'BREAKOUT_EXPANSION'
  | 'ACCUMULATION'
  | 'DISTRIBUTION'
  | 'HIGH_VOLATILITY'
  | 'LOW_LIQUIDITY'
  | 'UNCERTAIN'
  | 'REVERSAL_TRANSITION'
  | 'NEWS_EVENT_RISK'
  | 'UNKNOWN';

export interface RegimeClassification {
  regime: MarketRegime;
  confidence: number;
  evidence: string[];
  riskState: 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  transitionDetected: boolean;
  previousRegime?: MarketRegime;
  characteristics: string[];
}

export type EvidenceCategory = 
  | 'MarketStructure'
  | 'Liquidity'
  | 'Momentum'
  | 'Trend'
  | 'SMC'
  | 'SupportResistance'
  | 'MultiTimeframe'
  | 'TradingSession'
  | 'Volatility'
  | 'NewsRisk'
  | 'MarketRegime'
  | 'PriceLocation'
  | 'RiskReward';

export interface EvidenceItem {
  category: EvidenceCategory;
  direction: 'BUY' | 'SELL' | 'WAIT';
  strength: 'Strong' | 'Moderate' | 'Weak';
  reliability: number; // 0 to 1
  reason: string;
}

export interface EvidenceScoreReport {
  buyScore: number;
  sellScore: number;
  waitScore: number;
  conflictLevel: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  isConflicting: boolean;
  dominantDirection: 'BUY' | 'SELL' | 'WAIT';
  details: EvidenceItem[];
  conflictReason?: string;
}

export interface StrategyWeightMap {
  marketStructure: number;
  trendContinuation: number;
  momentum: number;
  breakoutExpansion: number;
  supportResistance: number;
  liquiditySweeps: number;
  smartMoneyConcepts: number;
  meanReversion: number;
  [key: string]: number;
}

export type NewsRiskState = 'NORMAL' | 'ELEVATED' | 'HIGH' | 'CRITICAL';

export interface NewsEventItem {
  id: string;
  title: string;
  currency: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  time: string;
  affectedPairs: string[];
  riskState: NewsRiskState;
  isApproaching: boolean;
  isActive: boolean;
  description?: string;
}

export interface HolidayLiquidityStatus {
  isHoliday: boolean;
  holidayName?: string;
  affectedCurrencies: string[];
  liquidityStatus: 'NORMAL' | 'REDUCED' | 'MARKET_CLOSED';
  spreadMultiplier: number;
  reason: string;
}

export interface CurrencyExposure {
  currency: string;
  baseCount: number;
  quoteCount: number;
  netExposureUnits: number; // Positive = Net Long, Negative = Net Short
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
}

export interface CorrelationRiskReport {
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  portfolioRiskPercent: number;
  maxRiskCeiling: number; // e.g. 6.0%
  exposedCurrencies: Record<string, CurrencyExposure>;
  warnings: string[];
  isTradeAllowed: boolean;
}

export interface DailyRiskState {
  startingBalance: number;
  currentBalance: number;
  realizedPnl: number;
  unrealizedPnl: number;
  drawdownPercent: number;
  dailyLossLimitPercent: number; // e.g. 4.0% - 5.0%
  dailyLossLimitUsd: number;
  tradesCount: number;
  lossCount: number;
  isDailyLimitReached: boolean;
  dateUtc: string;
}

export type LossProbableCause = 
  | 'TREND_FAILURE'
  | 'FALSE_BREAKOUT'
  | 'LIQUIDITY_REVERSAL'
  | 'NEWS_VOLATILITY'
  | 'REGIME_CHANGE'
  | 'POOR_ENTRY'
  | 'STOP_PLACEMENT'
  | 'DATA_ISSUE'
  | 'CORRELATION_RISK'
  | 'SIGNAL_CONFLICT'
  | 'UNKNOWN';

export interface LossRecord {
  tradeId: string;
  pair: string;
  exitTime: string;
  probableCause: LossProbableCause;
  realizedPips: number;
  session: string;
  tradingMode: string;
}

export interface ConsecutiveLossState {
  consecutiveLosses: number;
  maxAllowedLosses: number; // e.g. 3 or 4
  isCooldownActive: boolean;
  cooldownUntil?: string;
  cooldownReason?: string;
  lossHistory: LossRecord[];
}

export interface DecisionGateResult {
  decision: 'BUY' | 'SELL' | 'WAIT' | 'ANALYSIS_UNAVAILABLE';
  isEligible: boolean;
  gateChecks: {
    marketDataValid: boolean;
    dataFresh: boolean;
    pairValid: boolean;
    sessionValid: boolean;
    tradingStyleValid: boolean;
    accountBalanceValid: boolean;
    marketRegimeKnown: boolean;
    strategyConsensusSufficient: boolean;
    evidenceSufficient: boolean;
    timeframesAligned: boolean;
    newsRiskAcceptable: boolean;
    holidayLiquidityAcceptable: boolean;
    correlationRiskAcceptable: boolean;
    dailyLossLimitAvailable: boolean;
    consecutiveLossAllowsTrading: boolean;
    riskRewardAcceptable: boolean;
    entrySlTpValid: boolean;
    tradeLifecycleValid: boolean;
  };
  rejectionReasons: string[];
  explainability: {
    summary: string;
    regimeContext: string;
    strategyBreakdown: string;
    evidenceSummary: string;
    riskSummary: string;
    recommendation: string;
  };
}

export interface BacktestResult {
  pair: string;
  timeframe: string;
  tradingMode: string;
  winRate: number;
  totalTrades: number;
  profitableTrades: number;
  losingTrades: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  avgTradeDurationMinutes: number;
  sessionBreakdown: { Asian: number; London: number; NewYork: number };
  totalPips: number;
  maxDrawdown: number;
  equityCurve: { date: string; equity: number }[];
  recentTrades: {
    date: string;
    type: 'BUY' | 'SELL';
    entry: string;
    exit: string;
    pips: number;
    result: 'WIN' | 'LOSS';
  }[];
  analysis: string;
}

export const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 'Free',
    description: 'Build trust and learn the basics.',
    features: [
      'Market Bias (Bullish/Bearish)',
      '1H & 4H Timeframe Signals',
      'Confidence Score',
      'High-Impact News Alerts',
      'Delayed Signals (5-10 min)'
    ],
    limitations: ['No Entry/SL/TP', 'No Advanced Reasoning', 'No Live Updates']
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$30/mo',
    description: 'The mass-market institutional standard.',
    features: [
      'All Major & Minor Forex Pairs',
      'All Timeframes (D → 15M)',
      'Live Signal Updates',
      'Entry, SL, TP Zones',
      'Basic Reasoning'
    ]
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$60/mo',
    description: 'Advanced intelligence and rapid updates.',
    features: [
      'Everything in PRO',
      'Exotic Pairs & Metals',
      'Alternative Scenarios',
      'Signal Invalidation Alerts',
      'Advanced Reasoning',
      'Higher Signal Frequency'
    ],
    isPopular: true
  },
  {
    id: 'institutional',
    name: 'Institutional',
    price: '$100/mo',
    description: 'Elite intelligence and full platform access.',
    features: [
      'Everything in PREMIUM',
      'Scalping Mode (1M–5M)',
      'Session-Based Strategies',
      'Advanced Liquidity Mapping',
      'Priority Updates',
      'Private Discord Access',
      '1-on-1 Market Analyst Access'
    ]
  }
];

export interface AppNotification {
  id: string;
  userId: string;
  type: 'SIGNAL' | 'RISK' | 'INSIGHT' | 'ACCOUNT' | 'VOLATILITY';
  title: string;
  message: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  isRead: boolean;
  timestamp: string;
  metadata?: {
    pair: string;
    direction: 'BUY' | 'SELL';
    entryPrice?: number;
    exitPrice?: number;
    stopLoss?: number;
    takeProfit?: number;
    hitType: 'SL' | 'TP';
    pips: number;
    reasonDetails?: string;
  };
}

export const SESSIONS: { label: string; value: Session }[] = [
  { label: 'All Sessions', value: 'All' },
  { label: 'Asian Session 🌏', value: 'Asian' },
  { label: 'London Session 🇬🇧', value: 'London' },
  { label: 'New York Session 🇺🇸', value: 'New York' },
  { label: 'London–New York Overlap 🔥', value: 'Overlap' },
];

export const PAIRS_BY_SESSION: Record<Session, string[]> = {
  All: [
    'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CAD', 'AUD/USD', 'NZD/USD', 'USD/CHF',
    'EUR/JPY', 'GBP/JPY', 'AUD/JPY', 'XAU/USD', 'XAG/USD', 'BTC/USD', 'ETH/USD'
  ],
  Asian: [
    'USD/JPY', 'EUR/JPY', 'GBP/JPY', 'AUD/JPY', 'NZD/JPY', 'AUD/USD', 'NZD/USD', 'AUD/NZD', 'USD/SGD', 'USD/HKD'
  ],
  London: [
    'EUR/USD', 'GBP/USD', 'EUR/GBP', 'EUR/CHF', 'GBP/CHF', 'USD/CHF', 'EUR/CAD', 'GBP/CAD', 'EUR/JPY', 'GBP/JPY'
  ],
  "New York": [
    'USD/CAD', 'XAU/USD', 'XAG/USD', 'EUR/USD', 'GBP/USD', 'USD/MXN', 'USD/BRL', 'BTC/USD', 'ETH/USD', 'USD/ZAR', 'USD/TRY'
  ],
  Overlap: [
    'EUR/USD', 'GBP/USD', 'XAU/USD', 'USD/JPY', 'GBP/JPY', 'BTC/USD'
  ],
};
