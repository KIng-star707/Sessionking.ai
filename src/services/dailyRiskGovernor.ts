import type { DailyRiskState, TradeHistory } from "../types";

const STORAGE_KEY_PREFIX = "sessionking_daily_risk_";
const DEFAULT_DAILY_LOSS_LIMIT_PERCENT = 4.0; // 4.0% maximum daily drawdown ceiling

/**
 * Retrieves the current UTC date string (YYYY-MM-DD) for trading session synchronization.
 */
export function getTradingDayKeyUtc(d: Date = new Date()): string {
  return d.toISOString().split("T")[0];
}

/**
 * Evaluates the daily risk state for a user using their starting balance and closed trade history.
 */
export function evaluateDailyRisk(
  accountBalance: number,
  tradeHistory: TradeHistory[] = [],
  dailyLossLimitPercent: number = DEFAULT_DAILY_LOSS_LIMIT_PERCENT,
  now: Date = new Date()
): DailyRiskState {
  const dateUtc = getTradingDayKeyUtc(now);
  const storageKey = `${STORAGE_KEY_PREFIX}${dateUtc}`;

  // 1. Filter trades closed today (UTC)
  const todayTrades = tradeHistory.filter(t => {
    if (!t.closedAt) return false;
    const closedDate = getTradingDayKeyUtc(new Date(t.closedAt));
    return closedDate === dateUtc;
  });

  // 2. Calculate daily realized P/L
  let realizedPnl = 0;
  let lossCount = 0;

  todayTrades.forEach(trade => {
    if (trade.outcome === 'WIN') {
      const pips = trade.pips || 0;
      realizedPnl += Math.max(0, pips * 10); // USD approximation per standard lot
    } else if (trade.outcome === 'LOSS') {
      lossCount++;
      const pips = Math.abs(trade.pips || 0);
      realizedPnl -= Math.max(0, pips * 10);
    }
  });

  // Calculate drawdown relative to account balance
  const dailyLossLimitUsd = accountBalance * (dailyLossLimitPercent / 100);
  const drawdownPercent = realizedPnl < 0 ? (Math.abs(realizedPnl) / accountBalance) * 100 : 0;
  const isDailyLimitReached = drawdownPercent >= dailyLossLimitPercent;

  const state: DailyRiskState = {
    startingBalance: accountBalance,
    currentBalance: Math.max(0, accountBalance + realizedPnl),
    realizedPnl: Math.round(realizedPnl * 100) / 100,
    unrealizedPnl: 0,
    drawdownPercent: Math.round(drawdownPercent * 10) / 10,
    dailyLossLimitPercent,
    dailyLossLimitUsd: Math.round(dailyLossLimitUsd * 100) / 100,
    tradesCount: todayTrades.length,
    lossCount,
    isDailyLimitReached,
    dateUtc
  };

  // Persist locally
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    }
  } catch(e) {}

  return state;
}

/**
 * Checks if trading is permitted by the daily risk governor
 */
export function isTradingAllowedByDailyRisk(state: DailyRiskState): { allowed: boolean; reason?: string } {
  if (state.isDailyLimitReached) {
    return {
      allowed: false,
      reason: `DAILY RISK LIMIT REACHED: Daily loss of ${state.drawdownPercent.toFixed(1)}% reached the ${state.dailyLossLimitPercent.toFixed(1)}% drawdown ceiling ($${state.dailyLossLimitUsd.toFixed(2)}). New trades are paused until 00:00 UTC to protect capital.`
    };
  }
  return { allowed: true };
}
