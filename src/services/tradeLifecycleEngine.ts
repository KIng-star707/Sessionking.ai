/**
 * SESSIONKING - Institutional Trade Lifecycle State Machine
 * 
 * Enforces authoritative trade state transitions:
 * PROPOSED -> ACTIVE -> FILLED -> TP1_REACHED -> TP2_REACHED -> TP3_REACHED -> CLOSED
 *                                          \            \            \
 *                                      STOPPED_OUT  STOPPED_OUT  STOPPED_OUT
 * 
 * Or before fill:
 * PROPOSED / ACTIVE -> INVALIDATED (e.g. price hits invalidation level before entry, or setup expires, or critical news hits)
 * 
 * Deduplication:
 * - Strictly prevents duplicate active setups on the same pair in the same direction.
 */

import { Signal } from "../types";

export type TradeLifecycleState = 
  | 'PROPOSED'
  | 'ACTIVE'
  | 'FILLED'
  | 'TP1_REACHED'
  | 'TP2_REACHED'
  | 'TP3_REACHED'
  | 'CLOSED'
  | 'INVALIDATED'
  | 'STOPPED_OUT';

export interface ActiveTradeLifecycle {
  tradeId: string;
  pair: string;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3?: number;
  currentState: TradeLifecycleState;
  createdAt: string;
  filledAt?: string;
  closedAt?: string;
  exitPrice?: number;
  pipsRealized: number;
  invalidationReason?: string;
  isFilled: boolean;
  tp1Hit: boolean;
  tp2Hit: boolean;
  tp3Hit: boolean;
  stopLossHit: boolean;
  highestPriceSeen: number;
  lowestPriceSeen: number;
}

class TradeLifecycleManager {
  private activeTrades = new Map<string, ActiveTradeLifecycle>();
  private tradeHistory: ActiveTradeLifecycle[] = [];

  /**
   * Checks if an active trade already exists for this pair and direction.
   */
  public hasActiveTradeForPair(pair: string, direction?: 'BUY' | 'SELL'): boolean {
    for (const trade of this.activeTrades.values()) {
      if (trade.pair === pair && (trade.currentState === 'ACTIVE' || trade.currentState === 'FILLED' || trade.currentState === 'TP1_REACHED')) {
        if (!direction || trade.direction === direction) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Retrieves the active trade lifecycle for a specific pair if one exists.
   */
  public getActiveTradeForPair(pair: string): ActiveTradeLifecycle | undefined {
    for (const trade of this.activeTrades.values()) {
      if (trade.pair === pair && (trade.currentState === 'ACTIVE' || trade.currentState === 'FILLED' || trade.currentState === 'TP1_REACHED')) {
        return trade;
      }
    }
    return undefined;
  }

  /**
   * Registers a newly validated trade setup.
   */
  public registerNewTrade(signal: Signal): ActiveTradeLifecycle {
    const tradeId = signal.tradeId || `SK-${Date.now().toString(36).toUpperCase()}-${Math.floor(Date.now() % 10000)}`;
    const entry = parseFloat(signal.entry_price || '0');
    const sl = parseFloat(signal.stop_loss || '0');
    const tp1 = parseFloat(signal.take_profit_1 || '0');
    const tp2 = parseFloat(signal.take_profit_2 || '0');
    const tp3 = signal.take_profit_3 ? parseFloat(signal.take_profit_3) : undefined;

    const lifecycle: ActiveTradeLifecycle = {
      tradeId,
      pair: signal.pair,
      direction: signal.trade_type === 'BUY' ? 'BUY' : 'SELL',
      entryPrice: entry,
      stopLoss: sl,
      takeProfit1: tp1,
      takeProfit2: tp2,
      takeProfit3: tp3,
      currentState: 'ACTIVE',
      createdAt: new Date().toISOString(),
      pipsRealized: 0,
      isFilled: false,
      tp1Hit: false,
      tp2Hit: false,
      tp3Hit: false,
      stopLossHit: false,
      highestPriceSeen: entry,
      lowestPriceSeen: entry
    };

    this.activeTrades.set(tradeId, lifecycle);
    return lifecycle;
  }

  /**
   * Updates trade state machine based on incoming live price tick.
   */
  public updateTradeWithPrice(tradeId: string, currentPrice: number, pipSize: number): ActiveTradeLifecycle | null {
    const trade = this.activeTrades.get(tradeId);
    if (!trade || trade.currentState === 'CLOSED' || trade.currentState === 'STOPPED_OUT' || trade.currentState === 'INVALIDATED') {
      return trade || null;
    }

    trade.highestPriceSeen = Math.max(trade.highestPriceSeen, currentPrice);
    trade.lowestPriceSeen = Math.min(trade.lowestPriceSeen, currentPrice);

    const now = new Date().toISOString();

    // 1. Check Fill
    if (!trade.isFilled) {
      // Market orders fill immediately if within 2 pips of entry
      const distToEntry = Math.abs(currentPrice - trade.entryPrice) / pipSize;
      if (distToEntry <= 3.0) {
        trade.isFilled = true;
        trade.filledAt = now;
        trade.currentState = 'FILLED';
      }
    }

    if (trade.direction === 'BUY') {
      // Stop Loss check
      if (currentPrice <= trade.stopLoss) {
        trade.currentState = 'STOPPED_OUT';
        trade.closedAt = now;
        trade.exitPrice = trade.stopLoss;
        trade.pipsRealized = Math.round(((trade.stopLoss - trade.entryPrice) / pipSize) * 10) / 10;
        this.archiveTrade(trade);
        return trade;
      }

      // TP3 check
      if (trade.takeProfit3 && currentPrice >= trade.takeProfit3) {
        trade.currentState = 'CLOSED';
        trade.tp3Hit = true;
        trade.closedAt = now;
        trade.exitPrice = trade.takeProfit3;
        trade.pipsRealized = Math.round(((trade.takeProfit3 - trade.entryPrice) / pipSize) * 10) / 10;
        this.archiveTrade(trade);
        return trade;
      }

      // TP2 check
      if (currentPrice >= trade.takeProfit2) {
        trade.currentState = 'TP2_REACHED';
        trade.tp2Hit = true;
        trade.pipsRealized = Math.round(((trade.takeProfit2 - trade.entryPrice) / pipSize) * 10) / 10;
      }
      // TP1 check
      else if (currentPrice >= trade.takeProfit1 && !trade.tp1Hit) {
        trade.currentState = 'TP1_REACHED';
        trade.tp1Hit = true;
        trade.pipsRealized = Math.round(((trade.takeProfit1 - trade.entryPrice) / pipSize) * 10) / 10;
        // Institutional practice: Move Stop Loss to Break-Even after TP1
        trade.stopLoss = trade.entryPrice;
      }
    } else {
      // SELL
      if (currentPrice >= trade.stopLoss) {
        trade.currentState = 'STOPPED_OUT';
        trade.closedAt = now;
        trade.exitPrice = trade.stopLoss;
        trade.pipsRealized = Math.round(((trade.entryPrice - trade.stopLoss) / pipSize) * 10) / 10;
        this.archiveTrade(trade);
        return trade;
      }

      if (trade.takeProfit3 && currentPrice <= trade.takeProfit3) {
        trade.currentState = 'CLOSED';
        trade.tp3Hit = true;
        trade.closedAt = now;
        trade.exitPrice = trade.takeProfit3;
        trade.pipsRealized = Math.round(((trade.entryPrice - trade.takeProfit3) / pipSize) * 10) / 10;
        this.archiveTrade(trade);
        return trade;
      }

      if (currentPrice <= trade.takeProfit2) {
        trade.currentState = 'TP2_REACHED';
        trade.tp2Hit = true;
        trade.pipsRealized = Math.round(((trade.entryPrice - trade.takeProfit2) / pipSize) * 10) / 10;
      } else if (currentPrice <= trade.takeProfit1 && !trade.tp1Hit) {
        trade.currentState = 'TP1_REACHED';
        trade.tp1Hit = true;
        trade.pipsRealized = Math.round(((trade.entryPrice - trade.takeProfit1) / pipSize) * 10) / 10;
        trade.stopLoss = trade.entryPrice; // Break-Even
      }
    }

    return trade;
  }

  /**
   * Invalidates a pending or active trade.
   */
  public invalidateTrade(tradeId: string, reason: string): ActiveTradeLifecycle | null {
    const trade = this.activeTrades.get(tradeId);
    if (!trade) return null;
    trade.currentState = 'INVALIDATED';
    trade.invalidationReason = reason;
    trade.closedAt = new Date().toISOString();
    this.archiveTrade(trade);
    return trade;
  }

  private archiveTrade(trade: ActiveTradeLifecycle) {
    this.activeTrades.delete(trade.tradeId);
    this.tradeHistory.unshift(trade);
    if (this.tradeHistory.length > 100) this.tradeHistory.pop();
  }

  public getActiveTrades(): ActiveTradeLifecycle[] {
    return Array.from(this.activeTrades.values());
  }

  public getTradeHistory(): ActiveTradeLifecycle[] {
    return [...this.tradeHistory];
  }
}

export const tradeLifecycleManager = new TradeLifecycleManager();
