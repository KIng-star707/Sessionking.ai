import { getCentralMarketState, getAllCentralMarketStates, calculatePipSpread, MarketState } from "./marketDataService";
import { getFirebaseConfig, parseRestFields, toRestFields, getSystemIdToken } from "./firebaseRestService";
import type { Signal, TradeHistory } from "../types";

export interface MonitoredTradeRecord {
  userId: string;
  tradeId: string;
  docId: string;
  pair: string;
  direction: 'BUY' | 'SELL' | 'WAIT';
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2?: number;
  status: string;
  createdAt: string;
  lastCheckedPrice?: number;
  lastCheckedAt?: string;
  marketRegime?: string;
  tradingMode?: string;
  session?: string;
}

export interface TradeMonitorStats {
  status: 'RUNNING' | 'PAUSED' | 'DEGRADED';
  lastHeartbeat: string;
  lastScanDurationMs: number;
  totalActiveTradesMonitored: number;
  totalClosuresExecuted: number;
  totalScansCompleted: number;
  errorCount: number;
  recentClosures: {
    tradeId: string;
    pair: string;
    outcome: 'WIN' | 'LOSS';
    pips: number;
    closedAt: string;
    reason: string;
  }[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  tradeId?: string;
  eventType: 
    | 'SIGNAL_CREATED'
    | 'SIGNAL_VALIDATED'
    | 'TRADE_TRIGGERED'
    | 'TP_HIT'
    | 'SL_HIT'
    | 'TRADE_CLOSED'
    | 'RISK_BLOCK'
    | 'DAILY_LIMIT_REACHED'
    | 'DRAWDOWN_WARNING'
    | 'ANOMALY_DETECTED'
    | 'DATA_FAILURE'
    | 'CIRCUIT_BREAKER_TRIPPED';
  details: string;
  metadata?: Record<string, any>;
}

class ServerTradeMonitor {
  private isRunning: boolean = false;
  private scanIntervalTimer: any = null;
  private scanIntervalMs: number = 15000; // 15s persistent scan
  private processedEvents: Set<string> = new Set();
  private auditLogs: AuditLogEntry[] = [];
  private stats: TradeMonitorStats = {
    status: 'RUNNING',
    lastHeartbeat: new Date().toISOString(),
    lastScanDurationMs: 0,
    totalActiveTradesMonitored: 0,
    totalClosuresExecuted: 0,
    totalScansCompleted: 0,
    errorCount: 0,
    recentClosures: []
  };

  // In-memory cache of active user trades to monitor
  private activeTradeRegistry: Map<string, MonitoredTradeRecord> = new Map();

  constructor() {
    // Initializer
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log("[SERVER TRADE MONITOR] Initializing authoritative server-side trade supervisor...");

    // Start background persistent monitoring loop
    this.scanIntervalTimer = setInterval(() => {
      this.runSupervisionCycle().catch(err => {
        console.error("[SERVER TRADE MONITOR] Cycle error:", err);
        this.stats.errorCount++;
      });
    }, this.scanIntervalMs);

    // Initial immediate tick
    this.runSupervisionCycle().catch(err => console.error("[SERVER TRADE MONITOR] Initial cycle error:", err));
  }

  public stop() {
    if (this.scanIntervalTimer) {
      clearInterval(this.scanIntervalTimer);
      this.scanIntervalTimer = null;
    }
    this.isRunning = false;
    this.stats.status = 'PAUSED';
    console.log("[SERVER TRADE MONITOR] Supervisor paused.");
  }

  public getStats(): TradeMonitorStats {
    return {
      ...this.stats,
      totalActiveTradesMonitored: this.activeTradeRegistry.size
    };
  }

  public getAuditLogs(userId?: string): AuditLogEntry[] {
    if (userId) {
      return this.auditLogs.filter(l => l.userId === userId || l.userId === 'SYSTEM');
    }
    return this.auditLogs.slice(0, 100);
  }

  public logAuditEvent(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) {
    const fullEntry: AuditLogEntry = {
      id: `AUDIT_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...entry
    };
    this.auditLogs.unshift(fullEntry);
    if (this.auditLogs.length > 500) {
      this.auditLogs.pop();
    }
    console.log(`[AUDIT LOG] [${fullEntry.eventType}] User=${fullEntry.userId} | ${fullEntry.details}`);
  }

  /**
   * Registers or updates a trade in the active server monitoring pool.
   */
  public registerActiveTrade(trade: MonitoredTradeRecord) {
    if (!trade || !trade.tradeId) return;
    const key = `${trade.userId}_${trade.tradeId}`;

    // Never register closed or terminal states
    if (
      trade.status === 'CLOSED_TP' || 
      trade.status === 'CLOSED_SL' || 
      trade.status === 'EXPIRED' || 
      trade.status === 'CANCELLED'
    ) {
      this.activeTradeRegistry.delete(key);
      return;
    }

    this.activeTradeRegistry.set(key, trade);
  }

  public unregisterTrade(userId: string, tradeId: string) {
    const key = `${userId}_${tradeId}`;
    this.activeTradeRegistry.delete(key);
  }

  /**
   * Main Supervision Cycle:
   * 1. Updates Central Market State
   * 2. Checks every active registered trade against authoritative bid/ask prices
   * 3. Executes closure, history recording, notifications, and audits atomically
   */
  public async runSupervisionCycle(): Promise<void> {
    const startTime = Date.now();
    this.stats.lastHeartbeat = new Date().toISOString();

    try {
      // 1. Fetch active trades from Firestore if registry is empty or periodic sync
      if (this.activeTradeRegistry.size === 0 || this.stats.totalScansCompleted % 10 === 0) {
        await this.syncActiveTradesFromDatabase();
      }

      // 2. Iterate through all active trades
      for (const [key, trade] of this.activeTradeRegistry.entries()) {
        await this.evaluateSingleTrade(trade, key);
      }

      this.stats.status = 'RUNNING';
    } catch (err: any) {
      console.error("[SERVER TRADE MONITOR] Supervision cycle failure:", err.message || err);
      this.stats.errorCount++;
      this.stats.status = 'DEGRADED';
    } finally {
      this.stats.lastScanDurationMs = Date.now() - startTime;
      this.stats.totalScansCompleted++;
    }
  }

  private async evaluateSingleTrade(trade: MonitoredTradeRecord, registryKey: string) {
    const { userId, tradeId, docId, pair, direction, stopLoss, takeProfit1 } = trade;

    // Strict terminal state protection
    if (
      trade.status === 'CLOSED_TP' || 
      trade.status === 'CLOSED_SL' || 
      trade.status === 'EXPIRED' || 
      trade.status === 'CANCELLED'
    ) {
      this.activeTradeRegistry.delete(registryKey);
      return;
    }

    const keyCLOSED = `${tradeId}_CLOSED`;
    if (this.processedEvents.has(keyCLOSED)) {
      this.activeTradeRegistry.delete(registryKey);
      return;
    }

    const marketState = getCentralMarketState(pair);
    if (!marketState || marketState.freshness === 'UNAVAILABLE') {
      return; // Await authoritative data
    }

    const currentBid = marketState.bid || marketState.mid;
    const currentAsk = marketState.ask || marketState.mid;
    const currentMid = marketState.mid;

    trade.lastCheckedPrice = currentMid;
    trade.lastCheckedAt = new Date().toISOString();

    let hitSL = false;
    let hitTP = false;

    // Authoritative Crossing Logic
    if (direction === 'BUY') {
      if (currentBid <= stopLoss) hitSL = true;
      if (currentBid >= takeProfit1) hitTP = true;
    } else if (direction === 'SELL') {
      if (currentAsk >= stopLoss) hitSL = true;
      if (currentAsk <= takeProfit1) hitTP = true;
    }

    if (!hitSL && !hitTP) {
      return; // Position still within active boundary
    }

    // SL takes defensive precedence if both crossed in abnormal volatility gap
    const finalHitSL = hitSL;
    const finalHitTP = hitTP && !hitSL;
    const finalStatus = finalHitSL ? 'CLOSED_SL' : 'CLOSED_TP';
    const finalOutcome: 'WIN' | 'LOSS' = finalHitTP ? 'WIN' : 'LOSS';
    const exitPrice = finalHitSL ? stopLoss : takeProfit1;

    // Prevent duplicate triggers
    this.processedEvents.add(keyCLOSED);
    this.processedEvents.add(`${tradeId}_${finalHitSL ? 'SL_HIT' : 'TP_HIT'}`);

    // Pip Calculation
    let pipMultiplier = pair.includes('JPY') ? 100 : 10000;
    if (pair.includes('BTC') || pair.includes('ETH')) pipMultiplier = 1;
    else if (pair.includes('XAU') || pair.includes('XAG')) pipMultiplier = 10;
    else if (pair.includes('ZAR') || pair.includes('MXN') || pair.includes('TRY')) pipMultiplier = 1000;

    const pipsDiff = Math.abs(trade.entryPrice - exitPrice) * pipMultiplier;
    const realizedPips = finalHitTP ? Math.round(pipsDiff) : -Math.round(pipsDiff);

    console.log(`[SERVER TRADE MONITOR] Executing authoritative trade closure: TradeID=${tradeId} | Status=${finalStatus} | Outcome=${finalOutcome} | Pips=${realizedPips} | ExitPrice=${exitPrice}`);

    // Execute atomic closure across database & notify
    await this.executeAuthoritativeClosure({
      userId,
      tradeId,
      docId,
      pair,
      direction,
      entryPrice: trade.entryPrice,
      exitPrice,
      stopLoss,
      takeProfit: takeProfit1,
      finalStatus,
      finalOutcome,
      realizedPips,
      marketRegime: trade.marketRegime,
      tradingMode: trade.tradingMode,
      session: trade.session,
      createdAt: trade.createdAt
    });

    // Remove from active monitoring pool
    this.activeTradeRegistry.delete(registryKey);
    this.stats.totalClosuresExecuted++;
    this.stats.recentClosures.unshift({
      tradeId,
      pair,
      outcome: finalOutcome,
      pips: realizedPips,
      closedAt: new Date().toISOString(),
      reason: finalHitSL ? 'Stop Loss Triggered' : 'Take Profit Reached'
    });
    if (this.stats.recentClosures.length > 20) {
      this.stats.recentClosures.pop();
    }
  }

  /**
   * Executes atomic terminal closure in Firestore via REST.
   */
  private async executeAuthoritativeClosure(params: {
    userId: string;
    tradeId: string;
    docId: string;
    pair: string;
    direction: 'BUY' | 'SELL' | 'WAIT';
    entryPrice: number;
    exitPrice: number;
    stopLoss: number;
    takeProfit: number;
    finalStatus: 'CLOSED_TP' | 'CLOSED_SL';
    finalOutcome: 'WIN' | 'LOSS';
    realizedPips: number;
    marketRegime?: string;
    tradingMode?: string;
    session?: string;
    createdAt?: string;
  }) {
    const {
      userId,
      tradeId,
      docId,
      pair,
      direction,
      entryPrice,
      exitPrice,
      stopLoss,
      takeProfit,
      finalStatus,
      finalOutcome,
      realizedPips,
      marketRegime,
      tradingMode,
      session,
      createdAt
    } = params;

    const closedAt = new Date().toISOString();
    const hitSL = finalStatus === 'CLOSED_SL';

    // 1. Audit Log
    this.logAuditEvent({
      userId,
      tradeId,
      eventType: hitSL ? 'SL_HIT' : 'TP_HIT',
      details: `Authoritative server closure: ${direction} ${pair} at ${exitPrice} (${realizedPips > 0 ? '+' : ''}${realizedPips} pips). Outcome: ${finalOutcome}.`,
      metadata: { pair, direction, entryPrice, exitPrice, stopLoss, takeProfit, realizedPips, finalOutcome }
    });

    try {
      const config = getFirebaseConfig();
      if (!config || !config.projectId) return;

      const token = await getSystemIdToken().catch(() => null);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const baseUrl = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents`;

      // A. Update the Signal doc to terminal CLOSED
      const signalUrl = `${baseUrl}/users/${userId}/signals/${docId || tradeId}?updateMask.fieldPaths=status&updateMask.fieldPaths=trade_status&updateMask.fieldPaths=closedAt&updateMask.fieldPaths=closedPrice&updateMask.fieldPaths=finalOutcome&updateMask.fieldPaths=pipsRealized&updateMask.fieldPaths=notifiedSL&updateMask.fieldPaths=notifiedTP1`;
      
      const updatePayload = {
        fields: toRestFields({
          status: finalStatus,
          trade_status: finalStatus,
          closedAt,
          closedPrice: exitPrice,
          finalOutcome,
          pipsRealized: realizedPips,
          notifiedSL: hitSL,
          notifiedTP1: !hitSL
        })
      };

      await fetch(signalUrl, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updatePayload)
      }).catch(e => console.warn("[SERVER TRADE MONITOR] Signal doc update error:", e.message));

      // B. Create Immutable Trade History entry
      const historyUrl = `${baseUrl}/users/${userId}/tradeHistory`;
      const historyPayload = {
        fields: toRestFields({
          tradeId,
          pair,
          direction,
          entryPrice,
          exitPrice,
          stopLoss,
          takeProfit,
          outcome: finalOutcome,
          createdAt: createdAt || closedAt,
          closedAt,
          pips: realizedPips,
          session: session || "Authoritative Server",
          mode: tradingMode || "Authoritative Server",
          dataSource: "FCS_API",
          disclaimer: "Authoritative server-side trade supervision"
        })
      };

      await fetch(historyUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(historyPayload)
      }).catch(e => console.warn("[SERVER TRADE MONITOR] History insert error:", e.message));

      // C. Send Notification
      const notifUrl = `${baseUrl}/users/${userId}/notifications`;
      const title = hitSL ? `❌ Stop Loss Reached: ${pair}` : `✅ Take Profit Reached: ${pair}`;
      const message = hitSL
        ? `Server Trade Supervisor: Your ${direction} position on ${pair} touched Stop Loss at ${stopLoss}. Position closed. (Realized: ${realizedPips} pips).`
        : `Server Trade Supervisor: Your ${direction} position on ${pair} reached Take Profit at ${takeProfit}. Target achieved with +${realizedPips} pips!`;

      const notifPayload = {
        fields: toRestFields({
          userId,
          notificationId: `${tradeId}_${hitSL ? 'SL' : 'TP'}`,
          type: "TRADE_ALERT",
          title,
          message,
          priority: hitSL ? "HIGH" : "MEDIUM",
          isRead: false,
          timestamp: closedAt,
          metadata: {
            tradeId,
            pair,
            direction,
            entryPrice,
            exitPrice,
            stopLoss,
            takeProfit,
            hitType: hitSL ? 'SL' : 'TP',
            pips: Math.abs(realizedPips),
            realizedPips,
            dataSource: 'FCS_API',
            disclaimer: 'Authoritative server-side supervision event.'
          }
        })
      };

      await fetch(notifUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(notifPayload)
      }).catch(e => console.warn("[SERVER TRADE MONITOR] Notification insert error:", e.message));

    } catch (err: any) {
      console.error(`[SERVER TRADE MONITOR] Error finalizing closure for ${tradeId}:`, err.message || err);
    }
  }

  /**
   * Scans Firestore for active user signals if registry is out of date.
   */
  private async syncActiveTradesFromDatabase() {
    try {
      const config = getFirebaseConfig();
      if (!config || !config.projectId) return;

      const token = await getSystemIdToken().catch(() => null);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const runQueryUrl = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents:runQuery`;
      
      // Query collectionGroup or list
      const queryBody = {
        structuredQuery: {
          from: [{ collectionId: 'signals', allDescendants: true }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'status' },
              op: 'EQUAL',
              value: { stringValue: 'ACTIVE' }
            }
          },
          limit: 200
        }
      };

      const res = await fetch(runQueryUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(queryBody)
      });

      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data)) return;

      for (const item of data) {
        if (!item.document) continue;
        const name = item.document.name || '';
        // Extract userId from document path: projects/.../databases/(default)/documents/users/{uid}/signals/{docId}
        const parts = name.split('/documents/users/');
        if (parts.length < 2) continue;
        const subParts = parts[1].split('/signals/');
        const userId = subParts[0];
        const docId = subParts[1];

        const rawData = parseRestFields(item.document.fields || {});
        if (rawData.status !== 'ACTIVE' || rawData.closedAt) continue;

        const tradeId = rawData.tradeId || docId;
        const entryPrice = parseFloat(rawData.entry_price || rawData.entry || "0");
        const stopLoss = parseFloat(rawData.stop_loss || rawData.stopLoss || "0");
        const takeProfit1 = parseFloat(rawData.take_profit_1 || rawData.takeProfit1 || "0");

        if (isNaN(stopLoss) || stopLoss <= 0 || isNaN(takeProfit1) || takeProfit1 <= 0) continue;

        this.registerActiveTrade({
          userId,
          tradeId,
          docId,
          pair: rawData.pair,
          direction: rawData.type || rawData.trade_type || 'BUY',
          entryPrice,
          stopLoss,
          takeProfit1,
          takeProfit2: rawData.take_profit_2 ? parseFloat(rawData.take_profit_2) : undefined,
          status: rawData.status,
          createdAt: rawData.timestamp || new Date().toISOString(),
          marketRegime: rawData.marketRegime,
          tradingMode: rawData.tradingMode,
          session: rawData.session
        });
      }
    } catch (err: any) {
      console.warn("[SERVER TRADE MONITOR] Database sync warning:", err.message || err);
    }
  }
}

export const serverTradeMonitor = new ServerTradeMonitor();
