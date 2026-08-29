import type { 
  ConsecutiveLossState, 
  LossRecord, 
  LossProbableCause, 
  TradeHistory,
  MarketRegime
} from "../types";

const DEFAULT_MAX_CONSECUTIVE_LOSSES = 3;
const COOLDOWN_DURATION_MS = 60 * 60 * 1000; // 60-minute cooling off period

/**
 * Derives the probable cause of a trade loss using trade metadata and market conditions
 */
export function classifyLossProbableCause(
  trade: TradeHistory,
  regimeAtExit?: MarketRegime,
  isNewsEvent?: boolean
): LossProbableCause {
  if (isNewsEvent) return 'NEWS_VOLATILITY';
  if (regimeAtExit === 'REVERSAL_TRANSITION') return 'REGIME_CHANGE';
  if (regimeAtExit === 'HIGH_VOLATILITY') return 'LIQUIDITY_REVERSAL';
  if (trade.pips && Math.abs(trade.pips) < 8) return 'STOP_PLACEMENT';
  if (regimeAtExit === 'RANGING') return 'FALSE_BREAKOUT';
  if (regimeAtExit === 'TRENDING_BEARISH' && trade.direction === 'BUY') return 'TREND_FAILURE';
  if (regimeAtExit === 'TRENDING_BULLISH' && trade.direction === 'SELL') return 'TREND_FAILURE';
  return 'LIQUIDITY_REVERSAL';
}

/**
 * Evaluates the consecutive loss streak and cooldown state.
 */
export function evaluateConsecutiveLossProtection(
  tradeHistory: TradeHistory[] = [],
  maxAllowedLosses: number = DEFAULT_MAX_CONSECUTIVE_LOSSES,
  now: Date = new Date()
): ConsecutiveLossState {
  // Sort trades descending by closedAt
  const sorted = [...tradeHistory]
    .filter(t => t.closedAt && (t.outcome === 'WIN' || t.outcome === 'LOSS'))
    .sort((a, b) => new Date(b.closedAt!).getTime() - new Date(a.closedAt!).getTime());

  let consecutiveLosses = 0;
  const lossHistory: LossRecord[] = [];
  let latestLossTime: Date | null = null;

  for (const t of sorted) {
    if (t.outcome === 'LOSS') {
      consecutiveLosses++;
      if (!latestLossTime && t.closedAt) {
        latestLossTime = new Date(t.closedAt);
      }
      lossHistory.push({
        tradeId: t.tradeId || t.id || 'N/A',
        pair: t.pair,
        exitTime: t.closedAt || new Date().toISOString(),
        probableCause: classifyLossProbableCause(t),
        realizedPips: t.pips ? -Math.abs(t.pips) : -30,
        session: t.session || 'Unknown',
        tradingMode: t.mode || 'Unknown'
      });
    } else if (t.outcome === 'WIN') {
      // Streak broken by a verified win
      break;
    }
  }

  let isCooldownActive = false;
  let cooldownUntil: string | undefined;
  let cooldownReason: string | undefined;

  if (consecutiveLosses >= maxAllowedLosses && latestLossTime) {
    const cooldownExpiry = new Date(latestLossTime.getTime() + COOLDOWN_DURATION_MS);
    if (now.getTime() < cooldownExpiry.getTime()) {
      isCooldownActive = true;
      cooldownUntil = cooldownExpiry.toISOString();
      const minsRemaining = Math.max(1, Math.round((cooldownExpiry.getTime() - now.getTime()) / 60000));
      cooldownReason = `CONSECUTIVE LOSS PROTECTION: Detected ${consecutiveLosses} consecutive losses. Cooldown period active (${minsRemaining} min remaining) to prevent revenge trading and allow market regime re-stabilization.`;
    }
  }

  return {
    consecutiveLosses,
    maxAllowedLosses,
    isCooldownActive,
    cooldownUntil,
    cooldownReason,
    lossHistory
  };
}
