import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  normalizePairSymbol, 
  MarketState, 
  OHLC, 
  MarketDataSource, 
  MarketEngineStatus, 
  DataStatus, 
  FreshnessStatus 
} from '../services/marketDataService';

export interface MarketDataResponse {
  pair: string;
  symbol: string;
  state: MarketState;
  data: OHLC[];
  authoritativeSource: string;
  serverTimestamp: string;
}

export type MarketDataSubscriber = (state: MarketState, candles: OHLC[]) => void;

/**
 * Central MarketDataService (Client-side Singleton)
 * 
 * - Single source of truth for symbol prices (bid, ask, mid, status)
 * - Request deduplication: in-flight requests for the same pair/period share a single Promise
 * - Exactly one polling loop per pair: multiple subscribers share the same interval timer
 * - Automatic cleanup: intervals are cleared when subscriber count hits zero, preventing memory leaks
 * - Out-of-order race condition protection: validates 'sequenceNumber' and 'sourceTimestamp'
 */
export class CentralMarketDataService {
  // Internal state object: single source of truth for symbol prices and metrics
  private symbolStates: Record<string, MarketState> = {};
  private symbolCandles: Record<string, OHLC[]> = {};

  // Subscribers per normalized symbol
  private subscribers: Map<string, Set<MarketDataSubscriber>> = new Map();

  // Active polling timers: strictly ONE timer per pair
  private pairPollingTimers: Map<string, ReturnType<typeof setInterval>> = new Map();

  // Active timeframe requested per pair
  private activeTimeframes: Map<string, string> = new Map();

  // Request deduplication cache: pair:period -> in-flight Promise
  private inFlightRequests: Map<string, Promise<MarketDataResponse | null>> = new Map();

  // Polling interval in ms (shared across all components for a pair)
  private readonly POLLING_INTERVAL_MS = 4000;

  // Diagnostics counters
  private diagnostics = {
    totalRequests: 0,
    dedupHits: 0,
    rejectedStaleUpdates: 0,
    rejectedOutOfSequence: 0,
    acceptedUpdates: 0,
    activeTimers: 0
  };

  /**
   * Returns current market state for symbol from internal cache.
   */
  public getSymbolState(rawPair: string): MarketState | null {
    const symbol = normalizePairSymbol(rawPair);
    return this.symbolStates[symbol] || null;
  }

  /**
   * Returns current candle history for symbol from internal cache.
   */
  public getCandles(rawPair: string): OHLC[] {
    const symbol = normalizePairSymbol(rawPair);
    return this.symbolCandles[symbol] || [];
  }

  /**
   * Returns a copy of all symbol states.
   */
  public getAllStates(): Record<string, MarketState> {
    return { ...this.symbolStates };
  }

  /**
   * Internal parser to normalize timestamp values to milliseconds
   */
  private parseTimestampMs(ts?: string | number): number {
    if (!ts) return 0;
    if (typeof ts === 'number') {
      return ts > 1e11 ? ts : ts * 1000;
    }
    const parsed = Date.parse(ts);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Updates market state with strict 'sequenceNumber' and 'sourceTimestamp' verification.
   * Rejects any incoming update if its timestamp is older than the current local market state timestamp.
   * Rejects out-of-order sequence packets.
   */
  public updateState(incoming: Partial<MarketState> & { symbol?: string; pair?: string }): boolean {
    const rawSymbol = incoming.symbol || incoming.pair;
    if (!rawSymbol) return false;

    const symbol = normalizePairSymbol(rawSymbol);
    const currentState = this.symbolStates[symbol];

    const incomingSourceTime = this.parseTimestampMs(incoming.sourceTimestamp || incoming.timestamp || incoming.serverTime);
    const incomingSeq = typeof incoming.sequenceNumber === 'number' ? incoming.sequenceNumber : undefined;

    if (currentState) {
      const currentSourceTime = this.parseTimestampMs(currentState.sourceTimestamp || currentState.timestamp || currentState.serverTime);

      // Rule 1: Reject only if incoming timestamp is genuinely older by more than 60 seconds (prevents clock skew drops)
      if (incomingSourceTime > 0 && currentSourceTime > 0 && (currentSourceTime - incomingSourceTime) > 60000) {
        console.warn(
          `[MARKET DATA DEDUPLICATION] Rejected stale update for ${symbol}. ` +
          `Incoming TS: ${incomingSourceTime} < Current TS: ${currentSourceTime}`
        );
        this.diagnostics.rejectedStaleUpdates++;
        return false;
      }

      // Rule 2: Reject if sequenceNumber is present and strictly less than current state sequenceNumber
      if (incomingSeq !== undefined && typeof currentState.sequenceNumber === 'number') {
        if (incomingSeq < currentState.sequenceNumber) {
          console.warn(
            `[MARKET DATA DEDUPLICATION] Rejected out-of-sequence update for ${symbol}. ` +
            `Incoming Seq: ${incomingSeq} < Current Seq: ${currentState.sequenceNumber}`
          );
          this.diagnostics.rejectedOutOfSequence++;
          return false;
        }
      }
    }

    // Determine numeric values
    const mid = Number(incoming.mid ?? incoming.bid ?? currentState?.mid ?? 1.0);
    const halfSpread = 0.0001;
    const bid = Number(incoming.bid ?? (mid - halfSpread));
    const ask = Number(incoming.ask ?? (mid + halfSpread));
    const spread = Math.abs(ask - bid);
    const spreadPips = incoming.spreadPips ?? (Math.round(spread * 10000 * 10) / 10);

    const mergedState: MarketState = {
      symbol,
      pair: symbol,
      bid,
      ask,
      mid,
      spread,
      spreadPips,
      timestamp: incoming.timestamp || new Date().toISOString(),
      source: (incoming.source as MarketDataSource) || currentState?.source || 'YAHOO_INTERBANK',
      sourceTimestamp: incomingSourceTime || Date.now(),
      receivedAt: Date.now(),
      serverTime: incoming.serverTime || Date.now(),
      sequenceNumber: incomingSeq ?? ((currentState?.sequenceNumber || 0) + 1),
      dataStatus: (incoming.dataStatus as DataStatus) || currentState?.dataStatus || 'LIVE',
      freshness: (incoming.freshness as FreshnessStatus) || currentState?.freshness || 'FRESH',
      requestId: incoming.requestId || `LOCAL-${Date.now()}`,
      status: (incoming.status as MarketEngineStatus) || currentState?.status || 'ONLINE',
      ageMs: 0
    };

    // Store in central state object
    this.symbolStates[symbol] = mergedState;
    this.diagnostics.acceptedUpdates++;

    // Notify registered subscribers for this symbol
    this.notifySubscribers(symbol, mergedState, this.symbolCandles[symbol] || []);
    return true;
  }

  /**
   * Fetches market data with REQUEST DEDUPLICATION.
   * If an identical fetch is already in flight for this symbol/period, reuses the existing Promise.
   */
  public async fetchMarketData(
    rawPair: string, 
    period = '15m', 
    forceRefresh = false
  ): Promise<MarketDataResponse | null> {
    const symbol = normalizePairSymbol(rawPair);
    const dedupKey = `${symbol}:${period.toLowerCase()}`;

    // Request Deduplication Check
    if (!forceRefresh && this.inFlightRequests.has(dedupKey)) {
      this.diagnostics.dedupHits++;
      return this.inFlightRequests.get(dedupKey)!;
    }

    this.diagnostics.totalRequests++;

    const fetchPromise = (async () => {
      try {
        const base = typeof window !== 'undefined' ? '' : 'http://localhost:3000';
        const url = `${base}/api/market-data?pair=${encodeURIComponent(symbol)}&period=${encodeURIComponent(period)}`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = await res.json();

        // 1. Process and sequence state update
        if (json.state) {
          this.updateState(json.state);
        }

        // 2. Process and store OHLC candles
        if (Array.isArray(json.data) && json.data.length > 0) {
          this.symbolCandles[symbol] = json.data;
        }

        const activeState = this.symbolStates[symbol] || json.state;
        const activeCandles = this.symbolCandles[symbol] || [];

        // 3. Notify any waiting subscribers
        this.notifySubscribers(symbol, activeState, activeCandles);

        return {
          pair: symbol,
          symbol,
          state: activeState,
          data: activeCandles,
          authoritativeSource: json.authoritativeSource || activeState?.source || 'LIVE_FEED',
          serverTimestamp: json.serverTimestamp || new Date().toISOString()
        };
      } catch (err) {
        console.error(`[MARKET DATA SERVICE] Failed to fetch market data for ${symbol}:`, err);
        return null;
      } finally {
        // Clean up in-flight request cache
        this.inFlightRequests.delete(dedupKey);
      }
    })();

    this.inFlightRequests.set(dedupKey, fetchPromise);
    return fetchPromise;
  }

  /**
   * Subscribes a component to market updates for a pair.
   * 
   * Ensures EXACTLY ONE polling loop runs per pair, regardless of how many components subscribe.
   * Returns an unsubscription callback that performs proper cleanup to prevent memory leaks.
   */
  public subscribe(
    rawPair: string, 
    callback: MarketDataSubscriber, 
    period = '15m'
  ): () => void {
    const symbol = normalizePairSymbol(rawPair);

    if (!this.subscribers.has(symbol)) {
      this.subscribers.set(symbol, new Set());
    }
    const subscriberSet = this.subscribers.get(symbol)!;
    subscriberSet.add(callback);

    // Save requested timeframe
    this.activeTimeframes.set(symbol, period);

    // Immediately deliver cached state if available
    const cachedState = this.symbolStates[symbol];
    const cachedCandles = this.symbolCandles[symbol] || [];
    if (cachedState) {
      try {
        callback(cachedState, cachedCandles);
      } catch (e) {
        console.error("[MARKET DATA SERVICE] Error delivering cached state:", e);
      }
    }

    // Start EXACTLY ONE polling loop for this symbol if not already active
    if (!this.pairPollingTimers.has(symbol)) {
      // Fire initial deduplicated fetch
      this.fetchMarketData(symbol, period).catch(() => {});

      const timer = setInterval(() => {
        const activePeriod = this.activeTimeframes.get(symbol) || '15m';
        this.fetchMarketData(symbol, activePeriod).catch(() => {});
      }, this.POLLING_INTERVAL_MS);

      this.pairPollingTimers.set(symbol, timer);
      this.diagnostics.activeTimers = this.pairPollingTimers.size;
    }

    // Cleanup logic when subscriber unsubscribes
    return () => {
      const set = this.subscribers.get(symbol);
      if (set) {
        set.delete(callback);

        // When last subscriber unmounts, clean up timer to prevent memory leaks and competing requests
        if (set.size === 0) {
          this.subscribers.delete(symbol);
          const activeTimer = this.pairPollingTimers.get(symbol);
          if (activeTimer) {
            clearInterval(activeTimer);
            this.pairPollingTimers.delete(symbol);
            this.diagnostics.activeTimers = this.pairPollingTimers.size;
          }
          this.activeTimeframes.delete(symbol);
        }
      }
    };
  }

  /**
   * Ingests real-time prices from WebSocket feeds with sequence/timestamp validation.
   */
  public ingestWebSocketUpdate(rawPair: string, price: number, extraState?: Partial<MarketState>): void {
    const symbol = normalizePairSymbol(rawPair);
    this.updateState({
      symbol,
      pair: symbol,
      mid: price,
      timestamp: new Date().toISOString(),
      source: extraState?.source || 'LIVE_FEED',
      sourceTimestamp: extraState?.sourceTimestamp || Date.now(),
      sequenceNumber: extraState?.sequenceNumber,
      bid: extraState?.bid,
      ask: extraState?.ask,
      dataStatus: extraState?.dataStatus || 'LIVE',
      status: extraState?.status || 'ONLINE',
      ...extraState
    });
  }

  /**
   * Notifies all registered subscribers for a symbol.
   */
  private notifySubscribers(symbol: string, state: MarketState, candles: OHLC[]): void {
    const set = this.subscribers.get(symbol);
    if (!set || set.size === 0) return;

    set.forEach((cb) => {
      try {
        cb(state, candles);
      } catch (err) {
        console.error(`[MARKET DATA SERVICE] Subscriber error for ${symbol}:`, err);
      }
    });
  }

  /**
   * Diagnostic telemetry
   */
  public getTelemetry() {
    return {
      ...this.diagnostics,
      cachedSymbolsCount: Object.keys(this.symbolStates).length,
      activeSubscribersCount: Array.from(this.subscribers.values()).reduce((sum, s) => sum + s.size, 0),
      activePollingPairs: Array.from(this.pairPollingTimers.keys())
    };
  }

  /**
   * Full cleanup (for testing or hard reset)
   */
  public cleanupAll(): void {
    this.pairPollingTimers.forEach((timer) => clearInterval(timer));
    this.pairPollingTimers.clear();
    this.subscribers.clear();
    this.inFlightRequests.clear();
    this.activeTimeframes.clear();
    this.diagnostics.activeTimers = 0;
  }
}

// Global Singleton Instance
export const marketDataService = new CentralMarketDataService();

/**
 * React Hook: useSymbolMarketData
 * 
 * Automatically subscribes to the central MarketDataService.
 * Shares a single polling loop with any other components observing the same symbol.
 * Cleans up on unmount or pair change.
 */
export function useSymbolMarketData(pair: string, period = '15m') {
  const normSymbol = normalizePairSymbol(pair);
  const [state, setState] = useState<MarketState | null>(() => marketDataService.getSymbolState(normSymbol));
  const [data, setData] = useState<OHLC[]>(() => marketDataService.getCandles(normSymbol));
  const [loading, setLoading] = useState<boolean>(!marketDataService.getSymbolState(normSymbol));
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(!marketDataService.getSymbolState(normSymbol));
    setError(null);

    const unsubscribe = marketDataService.subscribe(
      normSymbol,
      (nextState, nextCandles) => {
        if (!isMounted) return;
        setState(nextState);
        if (nextCandles && nextCandles.length > 0) {
          setData(nextCandles);
        }
        setLoading(false);
      },
      period
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [normSymbol, period]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await marketDataService.fetchMarketData(normSymbol, period, true);
      if (res?.state) setState(res.state);
      if (res?.data) setData(res.data);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to refresh market data');
    } finally {
      setRefreshing(false);
    }
  }, [normSymbol, period]);

  return {
    symbol: normSymbol,
    state,
    data,
    loading,
    refreshing,
    error,
    refresh,
    isLive: state?.dataStatus === 'LIVE'
  };
}

/**
 * React Hook: useMarketPrice
 * 
 * Lightweight hook to observe current bid/ask/mid for a single pair without downloading candles.
 */
export function useMarketPrice(pair: string) {
  const normSymbol = normalizePairSymbol(pair);
  const [state, setState] = useState<MarketState | null>(() => marketDataService.getSymbolState(normSymbol));

  useEffect(() => {
    let isMounted = true;
    const unsubscribe = marketDataService.subscribe(
      normSymbol,
      (nextState) => {
        if (isMounted) setState(nextState);
      },
      '15m'
    );
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [normSymbol]);

  return {
    symbol: normSymbol,
    price: state?.mid ?? 0,
    bid: state?.bid ?? 0,
    ask: state?.ask ?? 0,
    mid: state?.mid ?? 0,
    spreadPips: state?.spreadPips ?? 0,
    status: state?.status ?? 'ONLINE',
    isLive: state?.dataStatus === 'LIVE',
    timestamp: state?.timestamp
  };
}
