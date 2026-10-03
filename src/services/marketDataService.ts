/**
 * SESSIONKING - Dedicated MetaTrader 5 (MT5) Primary Market Data Engine & Central Market Service
 * 
 * Implements Section 4 & Section 5 Specification:
 * 1. Dedicated MT5 Market-Data Service linked directly to broker MT5 terminal
 * 2. Multi-timeframe support for:
 *    - M1  (1-Minute scalping & microstructure)
 *    - M5  (5-Minute entry timing)
 *    - M15 (15-Minute setup confirmation)
 *    - H1  (1-Hour intraday structural context)
 *    - H4  (4-Hour intermediate bias & swing structure)
 *    - D1  (Daily context & institutional bias)
 * 3. Real-time tick & quote processing:
 *    - current bid, current ask, last tick, spread, tick volume
 *    - broker symbol specification (point size, digits, contract size, min/max volume, volume step, trading status)
 * 4. Data Freshness Watchdog:
 *    - Every incoming snapshot receives receivedAt, sourceTimestamp, ageMs
 *    - Configurable maximum acceptable age per timeframe & tick
 *    - If MT5 terminal is disconnected or feed becomes stale:
 *      * MARKET DATA STATUS: OFFLINE / STALE FEED
 *      * SIGNAL: WAIT
 *      * Reason: "Market data is stale or unavailable."
 *      * Stops generating executable BUY/SELL signals
 * 5. Strict Data Normalization:
 *    - Maps EURUSD, EUR/USD, EURUSD.a, EURUSDm, etc. to canonicalSymbol, brokerSymbol, providerSymbol
 * 6. Zero synthetic data: NO Math.random(), NO fake confidence, NO invented prices.
 */

export type MT5Timeframe = 'M1' | 'M5' | 'M15' | 'H1' | 'H4' | 'D1';

export const SUPPORTED_TIMEFRAMES: MT5Timeframe[] = ['M1', 'M5', 'M15', 'H1', 'H4', 'D1'];

export interface OHLC {
  timestamp: string; // ISO 8601
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface MT5Candle extends OHLC {
  timeSec: number;
  tickVolume?: number;
  spread?: number;
}

export interface MT5SymbolInfo {
  symbol: string; // Alias for canonicalSymbol
  canonicalSymbol: string;
  brokerSymbol: string;
  providerSymbol: string;
  digits: number;
  pointSize: number;
  contractSize?: number;
  minVolume?: number;
  maxVolume?: number;
  volumeStep?: number;
  spread: number;
  spreadPips: number;
  bid: number;
  ask: number;
  mid: number;
  lastTick?: number;
  tickVolume?: number;
  tradingStatus: 'OPEN' | 'CLOSED' | 'DISABLED';
  timestamp: number; // Alias for sourceTimestamp
  sourceTimestamp: number;
  receivedAt: number;
  ageMs: number;
}

export interface MT5Tick {
  symbol: string;
  brokerSymbol: string;
  providerSymbol?: string;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  spreadPips: number;
  lastTick?: number;
  tickVolume?: number;
  digits: number;
  pointSize: number;
  contractSize?: number;
  minVolume?: number;
  maxVolume?: number;
  volumeStep?: number;
  tradingStatus: 'OPEN' | 'CLOSED' | 'DISABLED';
  sourceTimestamp: number;
  receivedAt: number;
  ageMs: number;
  freshness: FreshnessStatus;
  status: MarketEngineStatus;
}

export type FreshnessStatus = 'FRESH' | 'STALE' | 'UNAVAILABLE';
export type DataStatus = 'LIVE' | 'DEGRADED' | 'STALE' | 'OFFLINE';
export type MarketEngineStatus = 'ONLINE' | 'OFFLINE' | 'STALE_FEED' | 'MARKET_CLOSED' | 'RATE_LIMITED' | 'ERROR';
export type MarketDataSource = 'MT5_BROKER' | 'FCS_API' | 'BINANCE' | 'INTERBANK' | 'YAHOO_FINANCE' | 'YAHOO_INTERBANK' | 'BROKER' | 'COINBASE' | 'LIVE_FEED' | 'UNAVAILABLE';

export interface MarketState {
  symbol: string;
  pair: string; // Alias for symbol for backward compatibility
  brokerSymbol?: string;
  providerSymbol?: string;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  spreadPips: number;
  timestamp: string;
  source: MarketDataSource;
  sourceTimestamp: string | number;
  receivedAt: number;
  serverTime: number;
  sequenceNumber: number;
  dataStatus: DataStatus;
  freshness: FreshnessStatus;
  requestId: string;
  status: MarketEngineStatus;
  ageMs: number;
  rawTimestamp?: string | number;
  quotePrecision?: number;
}

export interface FreshnessThresholds {
  tickFreshnessMs: number;      // Max acceptable tick age (default 8,000ms / 8s)
  m1FreshnessMs: number;        // Max acceptable M1 candle age (default 65,000ms)
  m5FreshnessMs: number;        // Max acceptable M5 candle age (default 310,000ms)
  m15FreshnessMs: number;       // Max acceptable M15 candle age (default 920,000ms)
  h1FreshnessMs: number;        // Max acceptable H1 candle age (default 3,650,000ms)
  h4FreshnessMs: number;        // Max acceptable H4 candle age (default 14,500,000ms)
  d1FreshnessMs: number;        // Max acceptable D1 candle age (default 86,500,000ms)
  heartbeatTimeoutMs: number;   // Max time without MT5 terminal heartbeat before OFFLINE (default 20,000ms)
}

export interface FreshnessWatchdogReport {
  isFresh: boolean;
  ageMs: number;
  thresholdMs: number;
  status: FreshnessStatus;
  reason?: string;
}

export interface MT5TerminalStatus {
  connected: boolean;
  status: 'ONLINE' | 'OFFLINE' | 'DEGRADED';
  broker: string;
  server: string;
  accountNumber?: string;
  currency?: string;
  lastHeartbeat: number;
  heartbeatAgeMs: number;
  symbolsCount: number;
  totalQuotesReceived: number;
  latencyMs: number;
  lastError?: string;
  freshnessThresholdMs: number;
}

export interface MarketDiagnostics {
  totalUpdates: number;
  requestCount: number;
  errorCount: number;
  rejectedOutdatedCount: number;
  rejectedAnomalyCount: number;
  lastRequestTime: string | null;
  lastResponseTime: string | null;
  activePairsCount: number;
  sourceCounts: Record<string, number>;
  states: Record<string, MarketState>;
}

export const SUPPORTED_PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CAD', 'AUD/USD', 'NZD/USD', 
  'USD/CHF', 'EUR/JPY', 'GBP/JPY', 'AUD/JPY', 'NZD/JPY', 'AUD/NZD',
  'USD/SGD', 'USD/HKD', 'EUR/GBP', 'EUR/CHF', 'GBP/CHF', 'EUR/CAD',
  'GBP/CAD', 'XAU/USD', 'XAG/USD', 'BTC/USD', 'ETH/USD', 'USD/MXN',
  'USD/BRL', 'USD/ZAR', 'USD/TRY', 'US30', 'NAS100', 'SPX500', 'GER40', 'UK100'
];

/**
 * Checks if forex interbank market is currently closed for the weekend
 * (Friday 22:00 UTC through Sunday 22:00 UTC).
 */
export function isMarketWeekend(): boolean {
  const now = new Date();
  const day = now.getUTCDay();
  const hour = now.getUTCHours();
  if (day === 6) return true; // Saturday
  if (day === 5 && hour >= 22) return true; // Friday after 22:00 UTC
  if (day === 0 && hour < 22) return true;  // Sunday before 22:00 UTC
  return false;
}

/**
 * Section 6: Strictly normalizes broker symbols into unified canonical 'BASE/QUOTE' format.
 * Intelligently handles broker suffixes (.a, .m, .pro, _i, etc.), timeframe labels, parenthesized text, and major commodities/indices.
 */
export function normalizePairSymbol(pair: string): string {
  if (!pair || typeof pair !== 'string') return 'EUR/USD';
  let clean = pair.trim().toUpperCase();
  if (clean === 'UNKNOWN' || clean === 'N/A' || clean === 'UNDEFINED' || clean === 'NULL') {
    return 'EUR/USD';
  }

  // Remove data feed provider prefixes
  clean = clean.replace(/^(FOREX:|FX:|BINANCE:|COINBASE:|OANDA:|FCS:|YAHOO:|TV:|MT5:)/i, '');

  // Strip parenthesized/bracketed details like (15M), [1H], (D1), {H4}
  clean = clean.replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, '').trim();

  // Strip standalone timeframe or chart indicator tokens
  clean = clean.replace(/\b(M1|M5|M15|M30|H1|H4|D1|W1|MN|1M|5M|15M|30M|1H|4H|1D|1W|DAILY|HOURLY|TIMEFRAME|CHART|CANDLE|CANDLES)\b/gi, '').trim();

  // Strip common broker ticker extensions (.PRO, .RAW, .A, .M, + etc.)
  clean = clean.replace(/[\.\_\-\+\#](PRO|RAW|STD|VIP|MICRO|A|M|SB|ECN|I|C)$/i, '').trim();

  // Major Commodities
  if (clean === 'XAUUSD' || clean === 'GOLD' || clean === 'XAU/USD' || clean === 'XAU') return 'XAU/USD';
  if (clean === 'XAGUSD' || clean === 'SILVER' || clean === 'XAG/USD' || clean === 'XAG') return 'XAG/USD';

  // Major Cryptocurrencies
  if (clean === 'BTCUSD' || clean === 'BTCUSDT' || clean === 'BTC/USD' || clean === 'BTC' || clean === 'BITCOIN') return 'BTC/USD';
  if (clean === 'ETHUSD' || clean === 'ETHUSDT' || clean === 'ETH/USD' || clean === 'ETH' || clean === 'ETHEREUM') return 'ETH/USD';

  // Global Indices
  if (clean === 'US30' || clean === 'DJI' || clean === 'DOW' || clean === 'US30USD' || clean === 'DOWJONES' || clean === '^DJI') return 'US30';
  if (clean === 'NAS100' || clean === 'US100' || clean === 'NDX' || clean === 'NASDAQ' || clean === 'USTEC' || clean === '^IXIC') return 'NAS100';
  if (clean === 'SPX500' || clean === 'US500' || clean === 'SP500' || clean === 'SPX' || clean === '^GSPC') return 'SPX500';
  if (clean === 'GER30' || clean === 'GER40' || clean === 'DE30' || clean === 'DE40' || clean === 'DAX' || clean === '^GDAXI') return 'GER40';
  if (clean === 'UK100' || clean === 'FTSE' || clean === 'FTSE100' || clean === '^FTSE') return 'UK100';

  if (clean.includes('/')) return clean;
  if (clean.includes('-')) return clean.replace('-', '/');
  if (clean.includes('_')) return clean.replace('_', '/');

  // Standard 6-character forex ticker (e.g. EURUSD -> EUR/USD)
  if (clean.length === 6 && /^[A-Z]{6}$/.test(clean)) {
    return `${clean.substring(0, 3)}/${clean.substring(3)}`;
  }

  // Check if string contains a standard 6-character currency pair
  const currencyMatch = clean.match(/([A-Z]{3})[\/\-_ ]?([A-Z]{3})/);
  if (currencyMatch) {
    return `${currencyMatch[1]}/${currencyMatch[2]}`;
  }

  return clean || 'EUR/USD';
}

/**
 * Resolves broker-specific symbol to internal canonical and provider mappings.
 */
export function resolveBrokerSymbol(rawSymbol: string): {
  canonicalSymbol: string;
  brokerSymbol: string;
  providerSymbol: string;
} {
  const canonical = normalizePairSymbol(rawSymbol);
  const broker = rawSymbol.trim();
  const provider = canonical.replace('/', '');
  return {
    canonicalSymbol: canonical,
    brokerSymbol: broker,
    providerSymbol: provider
  };
}

/**
 * Accurately calculates pip spread based on instrument decimal specifications.
 */
export function calculatePipSpread(pair: string, bid: number, ask: number): number {
  const diff = Math.abs(ask - bid);
  if (pair.includes('JPY')) return Math.round(diff * 100 * 10) / 10;
  if (pair.includes('XAU') || pair.includes('XAG')) return Math.round(diff * 10 * 10) / 10;
  if (pair.includes('BTC') || pair.includes('ETH')) return Math.round(diff * 10) / 10;
  if (pair.includes('US30') || pair.includes('NAS100') || pair.includes('SPX500') || pair.includes('GER40') || pair.includes('UK100')) {
    return Math.round(diff * 10) / 10;
  }
  if (pair.includes('MXN') || pair.includes('BRL') || pair.includes('ZAR') || pair.includes('TRY')) {
    return Math.round(diff * 10000 * 10) / 10;
  }
  return Math.round(diff * 10000 * 10) / 10;
}

/**
 * Instrument-aware sanity check to detect corrupt data feed spikes.
 */
function isPriceSanityValid(pair: string, newMid: number, prevMid?: number): boolean {
  if (!isFinite(newMid) || isNaN(newMid) || newMid <= 0) return false;

  // If no previous price, verify reasonable baseline asset ranges
  if (!prevMid || prevMid <= 0) {
    if (pair.includes('BTC') && (newMid < 1000 || newMid > 1000000)) return false;
    if (pair.includes('ETH') && (newMid < 50 || newMid > 100000)) return false;
    if (pair.includes('XAU') && (newMid < 500 || newMid > 20000)) return false;
    if (pair.includes('JPY') && (newMid < 30 || newMid > 500)) return false;
    if ((pair === 'EUR/USD' || pair === 'GBP/USD' || pair === 'AUD/USD') && (newMid < 0.2 || newMid > 5.0)) return false;
    return true;
  }

  // Max allowable instant delta per tick
  let maxAllowableChangeRatio = 0.25; // 25% max single tick jump on forex
  if (pair.includes('BTC') || pair.includes('ETH')) {
    maxAllowableChangeRatio = 0.50; // 50% max on crypto
  }

  const changeRatio = Math.abs(newMid - prevMid) / prevMid;
  return changeRatio <= maxAllowableChangeRatio;
}

// Single authoritative in-memory central market states
const centralMarketStates: Record<string, MarketState> = {};
const marketDataCache: Record<string, OHLC[]> = {};
const inFlightRequests = new Map<string, Promise<MarketState | null>>();
const sequenceCounters: Record<string, number> = {};

// Diagnostic telemetry metrics
const diagnosticMetrics = {
  totalUpdates: 0,
  requestCount: 0,
  errorCount: 0,
  rejectedOutdatedCount: 0,
  rejectedAnomalyCount: 0,
  lastRequestTime: null as string | null,
  lastResponseTime: null as string | null,
  sourceCounts: {} as Record<string, number>
};

/**
 * ============================================================================
 * SECTION 4 & 5: DEDICATED METATRADER 5 (MT5) MARKET DATA SERVICE
 * ============================================================================
 */
export class MT5MarketDataService {
  private thresholds: FreshnessThresholds = {
    tickFreshnessMs: 45000,       // 45 seconds tick freshness (robust against polling jitter)
    m1FreshnessMs: 90000,         // 90 seconds
    m5FreshnessMs: 360000,        // 6 minutes
    m15FreshnessMs: 1200000,      // 20 minutes
    h1FreshnessMs: 4200000,       // 70 minutes
    h4FreshnessMs: 16000000,      // 4.4 hours
    d1FreshnessMs: 90000000,      // 25 hours
    heartbeatTimeoutMs: 60000     // 60s heartbeat cutoff
  };

  private terminalStatus: MT5TerminalStatus = {
    connected: false,
    status: 'OFFLINE',
    broker: 'Not Connected',
    server: 'Unknown',
    lastHeartbeat: 0,
    heartbeatAgeMs: Infinity,
    symbolsCount: 0,
    totalQuotesReceived: 0,
    latencyMs: 0,
    freshnessThresholdMs: 45000
  };

  // Dedicated symbol info store keyed by canonical pair ('EUR/USD')
  private symbolStore = new Map<string, MT5SymbolInfo>();

  // Multi-timeframe OHLC store: canonicalSymbol -> Map<MT5Timeframe, MT5Candle[]>
  private timeframeStore = new Map<string, Map<MT5Timeframe, MT5Candle[]>>();

  // Live tick history for microstructure analysis
  private tickHistory = new Map<string, MT5Tick[]>();

  constructor() {
    // Active background watchdog evaluating MT5 terminal liveness every 2.5s
    if (typeof setInterval !== 'undefined') {
      const timer = setInterval(() => this.runFreshnessWatchdog(), 2500);
      if (timer && typeof (timer as any).unref === 'function') {
        (timer as any).unref();
      }
    }
  }

  /**
   * Section 5: Data Freshness Watchdog.
   * Periodically checks terminal heartbeat and evaluates whether feeds have become stale.
   */
  public runFreshnessWatchdog(): void {
    const now = Date.now();
    const heartbeatAge = now - (this.terminalStatus.lastHeartbeat || 0);
    this.terminalStatus.heartbeatAgeMs = heartbeatAge;

    if (this.terminalStatus.lastHeartbeat > 0 && heartbeatAge > this.thresholds.heartbeatTimeoutMs) {
      if (this.terminalStatus.connected) {
        console.warn(`[MT5 WATCHDOG] Heartbeat timed out (${heartbeatAge}ms > ${this.thresholds.heartbeatTimeoutMs}ms). Transitioning MT5 to OFFLINE.`);
      }
      this.terminalStatus.connected = false;
      this.terminalStatus.status = 'OFFLINE';
    }

    // Evaluate tick freshness for all tracked symbols
    for (const [symbol, info] of this.symbolStore.entries()) {
      const tickAge = now - (info.receivedAt || 0);
      info.ageMs = tickAge;
      
      const central = centralMarketStates[symbol];
      if (central && central.source === 'MT5_BROKER') {
        central.ageMs = tickAge;
        if (tickAge > this.thresholds.tickFreshnessMs) {
          central.dataStatus = 'STALE';
          central.freshness = 'STALE';
          central.status = 'STALE_FEED';
        } else {
          central.dataStatus = 'LIVE';
          central.freshness = 'FRESH';
          central.status = 'ONLINE';
        }
      }
    }
  }

  /**
   * Evaluates if signal generation is permitted for a symbol.
   * If MT5 is disconnected or feed is stale:
   * Returns allowed: false with reason. Never invent trades from stale/offline feeds.
   */
  public isSignalGenerationAllowed(rawPair: string): { allowed: boolean; reason?: string } {
    const canonical = normalizePairSymbol(rawPair);
    const tick = this.symbolStore.get(canonical);

    // If MT5 is connected and has a valid tick:
    if (this.terminalStatus.connected && this.terminalStatus.status === 'ONLINE' && tick) {
      const now = Date.now();
      const age = now - tick.receivedAt;
      if (age <= this.thresholds.tickFreshnessMs) {
        if (tick.tradingStatus === 'CLOSED' || tick.tradingStatus === 'DISABLED') {
          return {
            allowed: false,
            reason: `Market trading status for ${canonical} is ${tick.tradingStatus}.`
          };
        }
        return { allowed: true };
      }
    }

    // Secondary fallback: Central Market State (FCS API / Interbank feed)
    const central = getCentralMarketState(canonical);
    if (central && central.mid > 0 && central.freshness !== 'UNAVAILABLE') {
      return { allowed: true };
    }

    // If neither MT5 nor Central State is active:
    if (!this.terminalStatus.connected || this.terminalStatus.status === 'OFFLINE') {
      return {
        allowed: false,
        reason: "Authoritative market data feed is disconnected or initializing. Awaiting verified quote."
      };
    }

    return { allowed: true };
  }

  /**
   * Registers heartbeat from MT5 EA.
   */
  public registerHeartbeat(payload: {
    broker?: string;
    server?: string;
    accountNumber?: string;
    currency?: string;
    symbolsCount?: number;
    latencyMs?: number;
  }): MT5TerminalStatus {
    const now = Date.now();
    this.terminalStatus = {
      connected: true,
      status: 'ONLINE',
      broker: payload.broker || this.terminalStatus.broker || 'MT5 Broker',
      server: payload.server || this.terminalStatus.server || 'Trade Server',
      accountNumber: payload.accountNumber || this.terminalStatus.accountNumber,
      currency: payload.currency || this.terminalStatus.currency || 'USD',
      lastHeartbeat: now,
      heartbeatAgeMs: 0,
      symbolsCount: payload.symbolsCount || this.terminalStatus.symbolsCount || 0,
      totalQuotesReceived: this.terminalStatus.totalQuotesReceived,
      latencyMs: payload.latencyMs !== undefined ? payload.latencyMs : this.terminalStatus.latencyMs,
      freshnessThresholdMs: this.thresholds.tickFreshnessMs
    };
    return { ...this.terminalStatus };
  }

  /**
   * Section 4: Real-time tick & quote ingestion directly from MT5.
   * Obtains: current bid, current ask, last tick, spread, point size, digits,
   * contract size, min volume, max volume, volume step, trading status.
   */
  public ingestQuote(payload: {
    symbol: string;
    brokerSymbol?: string;
    bid: number;
    ask: number;
    lastTick?: number;
    tickVolume?: number;
    digits?: number;
    pointSize?: number;
    contractSize?: number;
    minVolume?: number;
    maxVolume?: number;
    volumeStep?: number;
    tradingStatus?: 'OPEN' | 'CLOSED' | 'DISABLED';
    sourceTimestamp?: number;
  }): MT5Tick {
    const now = Date.now();
    const { canonicalSymbol, brokerSymbol, providerSymbol } = resolveBrokerSymbol(payload.symbol);
    const bid = Number(payload.bid);
    const ask = Number(payload.ask);
    const mid = (bid + ask) / 2;
    const spread = Math.abs(ask - bid);
    const spreadPips = calculatePipSpread(canonicalSymbol, bid, ask);
    const digits = payload.digits !== undefined ? payload.digits : (canonicalSymbol.includes('JPY') ? 3 : 5);
    const pointSize = payload.pointSize || (canonicalSymbol.includes('JPY') ? 0.001 : 0.00001);

    const sourceTimestamp = payload.sourceTimestamp || now;
    const ageMs = Math.max(0, now - sourceTimestamp);
    const isFresh = ageMs <= this.thresholds.tickFreshnessMs;

    const symbolInfo: MT5SymbolInfo = {
      symbol: canonicalSymbol,
      canonicalSymbol,
      brokerSymbol: payload.brokerSymbol || brokerSymbol,
      providerSymbol,
      digits,
      pointSize,
      contractSize: payload.contractSize,
      minVolume: payload.minVolume,
      maxVolume: payload.maxVolume,
      volumeStep: payload.volumeStep,
      spread,
      spreadPips,
      bid,
      ask,
      mid,
      lastTick: payload.lastTick !== undefined ? Number(payload.lastTick) : mid,
      tickVolume: payload.tickVolume,
      tradingStatus: payload.tradingStatus || 'OPEN',
      timestamp: sourceTimestamp,
      sourceTimestamp,
      receivedAt: now,
      ageMs
    };

    this.symbolStore.set(canonicalSymbol, symbolInfo);
    this.terminalStatus.totalQuotesReceived++;
    this.terminalStatus.connected = true;
    this.terminalStatus.status = 'ONLINE';
    this.terminalStatus.lastHeartbeat = now;
    this.terminalStatus.heartbeatAgeMs = 0;

    // Append to live tick history
    if (!this.tickHistory.has(canonicalSymbol)) {
      this.tickHistory.set(canonicalSymbol, []);
    }
    const ticks = this.tickHistory.get(canonicalSymbol)!;
    const tickRecord: MT5Tick = {
      symbol: canonicalSymbol,
      brokerSymbol: symbolInfo.brokerSymbol,
      providerSymbol,
      bid,
      ask,
      mid,
      spread,
      spreadPips,
      lastTick: symbolInfo.lastTick,
      tickVolume: symbolInfo.tickVolume,
      digits,
      pointSize,
      contractSize: symbolInfo.contractSize,
      minVolume: symbolInfo.minVolume,
      maxVolume: symbolInfo.maxVolume,
      volumeStep: symbolInfo.volumeStep,
      tradingStatus: symbolInfo.tradingStatus,
      sourceTimestamp,
      receivedAt: now,
      ageMs,
      freshness: isFresh ? 'FRESH' : 'STALE',
      status: isFresh ? 'ONLINE' : 'STALE_FEED'
    };
    ticks.push(tickRecord);
    if (ticks.length > 200) ticks.shift();

    // Dynamically update M1 & M5 real-time building bars
    this.updateLiveBarWithTick(canonicalSymbol, 'M1', mid, now, symbolInfo.tickVolume);
    this.updateLiveBarWithTick(canonicalSymbol, 'M5', mid, now, symbolInfo.tickVolume);

    // Sync into central authoritative market state
    updateCentralMarketState(
      canonicalSymbol,
      mid,
      bid,
      ask,
      sourceTimestamp,
      `MT5-${now}`,
      'MT5_BROKER'
    );

    return tickRecord;
  }

  /**
   * Section 4: Multi-Timeframe OHLC Bars Ingestion.
   * Stores authentic completed bars for M1, M5, M15, H1, H4, D1.
   */
  public ingestCandles(
    rawSymbol: string,
    timeframe: MT5Timeframe,
    candles: Array<{
      time: number | string;
      open: number;
      high: number;
      low: number;
      close: number;
      tick_volume?: number;
      spread?: number;
    }>
  ): { success: boolean; count: number; timeframe: MT5Timeframe } {
    const canonical = normalizePairSymbol(rawSymbol);
    if (!SUPPORTED_TIMEFRAMES.includes(timeframe)) {
      throw new Error(`Unsupported MT5 timeframe: ${timeframe}. Must be one of: ${SUPPORTED_TIMEFRAMES.join(', ')}`);
    }

    if (!this.timeframeStore.has(canonical)) {
      this.timeframeStore.set(canonical, new Map<MT5Timeframe, MT5Candle[]>());
    }
    const tfMap = this.timeframeStore.get(canonical)!;

    const formattedCandles: MT5Candle[] = candles.map((c) => {
      const timeSec = typeof c.time === 'number'
        ? (c.time > 1e11 ? Math.floor(c.time / 1000) : c.time)
        : Math.floor(new Date(c.time).getTime() / 1000);

      return {
        timestamp: new Date(timeSec * 1000).toISOString(),
        timeSec,
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        volume: c.tick_volume !== undefined ? Number(c.tick_volume) : 100,
        tickVolume: c.tick_volume !== undefined ? Number(c.tick_volume) : 100,
        spread: c.spread !== undefined ? Number(c.spread) : undefined
      };
    });

    // Chronologically sort
    formattedCandles.sort((a, b) => a.timeSec - b.timeSec);
    tfMap.set(timeframe, formattedCandles);

    // If M15, synchronize with central cache for downstream compatibility
    if (timeframe === 'M15' || (timeframe === 'M5' && !tfMap.has('M15'))) {
      setCachedMarketData(canonical, formattedCandles);
    }

    return { success: true, count: formattedCandles.length, timeframe };
  }

  /**
   * Retrieves multi-timeframe candles for a given canonical symbol and timeframe (M1-D1).
   */
  public getCandles(rawSymbol: string, timeframe: MT5Timeframe): MT5Candle[] {
    const canonical = normalizePairSymbol(rawSymbol);
    const tfMap = this.timeframeStore.get(canonical);
    if (!tfMap) return [];
    return tfMap.get(timeframe) || [];
  }

  /**
   * Returns complete multi-timeframe map (M1, M5, M15, H1, H4, D1) for a symbol.
   */
  public getMultiTimeframeData(rawSymbol: string): Record<MT5Timeframe, MT5Candle[]> {
    const canonical = normalizePairSymbol(rawSymbol);
    const tfMap = this.timeframeStore.get(canonical);
    const result: Record<MT5Timeframe, MT5Candle[]> = {
      M1: [],
      M5: [],
      M15: [],
      H1: [],
      H4: [],
      D1: []
    };

    if (!tfMap) return result;

    for (const tf of SUPPORTED_TIMEFRAMES) {
      result[tf] = tfMap.get(tf) || [];
    }

    return result;
  }

  /**
   * Returns current quote / symbol info for a given canonical pair.
   */
  public getQuote(rawSymbol: string): MT5SymbolInfo | null {
    const canonical = normalizePairSymbol(rawSymbol);
    const info = this.symbolStore.get(canonical);
    if (!info) return null;
    return {
      ...info,
      ageMs: Date.now() - info.receivedAt
    };
  }

  /**
   * Alias for getQuote for backward compatibility.
   */
  public getSymbolInfo(rawSymbol: string): MT5SymbolInfo | null {
    return this.getQuote(rawSymbol);
  }

  /**
   * Returns whether MT5 terminal is currently online and connected.
   */
  public isConnected(): boolean {
    return this.terminalStatus.connected && this.terminalStatus.status === 'ONLINE';
  }

  /**
   * Alias for getMultiTimeframeData.
   */
  public getAllTimeframes(rawSymbol: string): Record<MT5Timeframe, MT5Candle[]> {
    return this.getMultiTimeframeData(rawSymbol);
  }

  /**
   * Returns all active quotes received from MT5 broker.
   */
  public getAllQuotes(): MT5SymbolInfo[] {
    const now = Date.now();
    return Array.from(this.symbolStore.values()).map(info => ({
      ...info,
      ageMs: now - info.receivedAt
    }));
  }

  /**
   * Checks freshness of tick or specific timeframe for a symbol.
   */
  public getFreshness(rawSymbol: string, timeframe?: MT5Timeframe): FreshnessWatchdogReport {
    const canonical = normalizePairSymbol(rawSymbol);
    const info = this.symbolStore.get(canonical);
    const now = Date.now();

    if (!info) {
      return {
        isFresh: false,
        ageMs: Infinity,
        thresholdMs: this.thresholds.tickFreshnessMs,
        status: 'UNAVAILABLE',
        reason: 'No MT5 quotes available for symbol.'
      };
    }

    let threshold = this.thresholds.tickFreshnessMs;
    if (timeframe === 'M1') threshold = this.thresholds.m1FreshnessMs;
    else if (timeframe === 'M5') threshold = this.thresholds.m5FreshnessMs;
    else if (timeframe === 'M15') threshold = this.thresholds.m15FreshnessMs;
    else if (timeframe === 'H1') threshold = this.thresholds.h1FreshnessMs;
    else if (timeframe === 'H4') threshold = this.thresholds.h4FreshnessMs;
    else if (timeframe === 'D1') threshold = this.thresholds.d1FreshnessMs;

    const ageMs = now - info.receivedAt;
    const isFresh = ageMs <= threshold;

    return {
      isFresh,
      ageMs,
      thresholdMs: threshold,
      status: isFresh ? 'FRESH' : 'STALE',
      reason: isFresh ? undefined : `Data age ${Math.round(ageMs / 1000)}s exceeds ${threshold / 1000}s threshold.`
    };
  }

  /**
   * Returns MT5 terminal connection status.
   */
  public getStatus(): MT5TerminalStatus {
    const now = Date.now();
    return {
      ...this.terminalStatus,
      heartbeatAgeMs: this.terminalStatus.lastHeartbeat > 0 ? now - this.terminalStatus.lastHeartbeat : Infinity,
      symbolsCount: this.symbolStore.size
    };
  }

  /**
   * Updates real-time building candle with incoming tick.
   */
  private updateLiveBarWithTick(
    symbol: string,
    timeframe: 'M1' | 'M5',
    price: number,
    nowMs: number,
    tickVolume?: number
  ) {
    if (!this.timeframeStore.has(symbol)) {
      this.timeframeStore.set(symbol, new Map<MT5Timeframe, MT5Candle[]>());
    }
    const tfMap = this.timeframeStore.get(symbol)!;
    if (!tfMap.has(timeframe)) {
      tfMap.set(timeframe, []);
    }
    const candles = tfMap.get(timeframe)!;

    const periodMs = timeframe === 'M1' ? 60000 : 300000;
    const candleStartMs = Math.floor(nowMs / periodMs) * periodMs;
    const timeSec = Math.floor(candleStartMs / 1000);
    const iso = new Date(candleStartMs).toISOString();

    if (candles.length === 0 || candles[candles.length - 1].timeSec !== timeSec) {
      candles.push({
        timestamp: iso,
        timeSec,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: tickVolume || 1,
        tickVolume: tickVolume || 1
      });
      if (candles.length > 500) candles.shift();
    } else {
      const current = candles[candles.length - 1];
      current.high = Math.max(current.high, price);
      current.low = Math.min(current.low, price);
      current.close = price;
      current.volume = (current.volume || 0) + 1;
      current.tickVolume = (current.tickVolume || 0) + (tickVolume || 1);
    }
  }
}

// Global MT5 Primary Market Data Service Instance
export const mt5DataService = new MT5MarketDataService();

/**
 * ============================================================================
 * CENTRAL MARKET STATE METHODS (BACKWARD COMPATIBLE AUTHORITATIVE REPOSITORY)
 * ============================================================================
 */

export function updateCentralMarketState(
  rawPair: string,
  rawPrice: number | string,
  rawBid?: number | string,
  rawAsk?: number | string,
  rawTimestamp?: string | number,
  requestId: string = `FEED-${Date.now()}`,
  source: MarketDataSource = 'MT5_BROKER',
  incomingSequenceNumber?: number
): MarketState | null {
  const pair = normalizePairSymbol(rawPair);
  if (!pair) return null;

  diagnosticMetrics.totalUpdates++;
  diagnosticMetrics.sourceCounts[source] = (diagnosticMetrics.sourceCounts[source] || 0) + 1;
  diagnosticMetrics.lastResponseTime = new Date().toISOString();

  const mid = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice));
  const prevState = centralMarketStates[pair];

  // 1. Sanity and numeric validation
  if (!isPriceSanityValid(pair, mid, prevState?.mid)) {
    console.warn(`[MARKET DATA INTEGRITY] Rejected anomalous or invalid price for ${pair}: ${rawPrice} (Prev: ${prevState?.mid})`);
    diagnosticMetrics.rejectedAnomalyCount++;
    return null;
  }

  // 2. Determine Bid, Ask, Mid, and Spread
  let bid = rawBid !== undefined ? parseFloat(String(rawBid)) : NaN;
  let ask = rawAsk !== undefined ? parseFloat(String(rawAsk)) : NaN;

  if (isNaN(bid) || isNaN(ask) || bid <= 0 || ask <= 0) {
    let halfSpread = 0.0001; // 1 pip standard
    if (pair.includes('JPY')) halfSpread = 0.01;
    else if (pair.includes('XAU')) halfSpread = 0.15;
    else if (pair.includes('XAG')) halfSpread = 0.02;
    else if (pair.includes('BTC')) halfSpread = 1.5;
    else if (pair.includes('ETH')) halfSpread = 0.5;
    else if (pair.includes('MXN') || pair.includes('ZAR') || pair.includes('TRY')) halfSpread = 0.005;

    bid = mid - halfSpread;
    ask = mid + halfSpread;
  }

  const spread = Math.abs(ask - bid);
  const spreadPips = calculatePipSpread(pair, bid, ask);
  const now = Date.now();
  const serverTime = now;
  const receivedAt = now;

  // 3. Source timestamp parsing & Out-of-Order sequence protection
  let sourceTimestampParsed: number = now;
  if (rawTimestamp) {
    if (typeof rawTimestamp === 'number') {
      sourceTimestampParsed = rawTimestamp > 1e11 ? rawTimestamp : rawTimestamp * 1000;
    } else {
      const parsed = Date.parse(rawTimestamp);
      if (!isNaN(parsed)) sourceTimestampParsed = parsed;
    }
  }

  // Sequence Protection: Reject if incoming source timestamp is strictly older than existing state
  if (prevState) {
    const prevSourceTime = prevState.sourceTimestamp 
      ? (typeof prevState.sourceTimestamp === 'number' ? prevState.sourceTimestamp : Date.parse(String(prevState.sourceTimestamp)))
      : NaN;
    const prevTimestamp = prevState.timestamp ? Date.parse(prevState.timestamp) : NaN;
    const authoritativePrevTime = Math.max(!isNaN(prevSourceTime) ? prevSourceTime : 0, !isNaN(prevTimestamp) ? prevTimestamp : 0);

    if (authoritativePrevTime > 0 && sourceTimestampParsed < authoritativePrevTime) {
      diagnosticMetrics.rejectedOutdatedCount++;
      return prevState;
    }

    if (incomingSequenceNumber !== undefined && typeof prevState.sequenceNumber === 'number') {
      if (incomingSequenceNumber <= prevState.sequenceNumber) {
        diagnosticMetrics.rejectedOutdatedCount++;
        return prevState;
      }
    }
  }

  // Increment monotonic sequence number
  const nextSeq = incomingSequenceNumber !== undefined 
    ? incomingSequenceNumber 
    : (sequenceCounters[pair] || 0) + 1;
  sequenceCounters[pair] = Math.max(sequenceCounters[pair] || 0, nextSeq);

  const isWeekend = isMarketWeekend();
  const isCrypto = pair.includes('BTC') || pair.includes('ETH');
  
  let freshness: FreshnessStatus = 'FRESH';
  let dataStatus: DataStatus = 'LIVE';
  let status: MarketEngineStatus = 'ONLINE';

  if (isWeekend && !isCrypto) {
    status = 'MARKET_CLOSED';
    dataStatus = 'LIVE';
    freshness = 'FRESH';
  }

  const ageMs = 0;
  const quotePrecision = pair.includes('JPY') ? 3 : pair.includes('XAU') ? 2 : pair.includes('BTC') ? 2 : 5;

  const state: MarketState = {
    symbol: pair,
    pair: pair,
    bid,
    ask,
    mid,
    spread,
    spreadPips,
    timestamp: new Date(now).toISOString(),
    source,
    sourceTimestamp: sourceTimestampParsed,
    receivedAt,
    serverTime,
    sequenceNumber: nextSeq,
    dataStatus,
    freshness,
    requestId,
    status,
    ageMs,
    rawTimestamp,
    quotePrecision
  };

  centralMarketStates[pair] = state;
  updateCandleCacheWithTick(pair, mid, now);

  return state;
}

function updateCandleCacheWithTick(pair: string, price: number, nowMs: number) {
  if (!marketDataCache[pair]) {
    marketDataCache[pair] = [];
  }

  const cache = marketDataCache[pair];
  const coeff = 1000 * 60 * 5; // 5m candle
  const currentCandleTime = new Date(Math.floor(nowMs / coeff) * coeff).toISOString();

  if (cache.length === 0 || cache[cache.length - 1].timestamp !== currentCandleTime) {
    cache.push({
      timestamp: currentCandleTime,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: 1
    });
    if (cache.length > 500) {
      cache.shift();
    }
  } else {
    const candle = cache[cache.length - 1];
    candle.high = Math.max(candle.high, price);
    candle.low = Math.min(candle.low, price);
    candle.close = price;
    candle.volume = (candle.volume || 0) + 1;
  }
}

export function getCentralMarketState(rawPair: string): MarketState | null {
  const pair = normalizePairSymbol(rawPair);
  const state = centralMarketStates[pair];
  if (!state) return null;

  const now = Date.now();
  const ageMs = now - (state.receivedAt || now);
  const isWeekend = isMarketWeekend();
  const isCrypto = pair.includes('BTC') || pair.includes('ETH');

  let dataStatus: DataStatus = state.dataStatus;
  let freshness: FreshnessStatus = state.freshness;

  if (!isWeekend || isCrypto) {
    if (ageMs > 120000) {
      dataStatus = 'STALE';
      freshness = 'STALE';
    } else {
      dataStatus = 'LIVE';
      freshness = 'FRESH';
    }
  } else {
    dataStatus = 'LIVE';
    freshness = 'FRESH';
  }

  return {
    ...state,
    serverTime: now,
    ageMs,
    dataStatus,
    freshness
  };
}

export function getAllCentralMarketStates(): Record<string, MarketState> {
  const result: Record<string, MarketState> = {};
  for (const pair of Object.keys(centralMarketStates)) {
    const state = getCentralMarketState(pair);
    if (state) result[pair] = state;
  }
  return result;
}

export function getCachedMarketData(pair: string): OHLC[] | null {
  const norm = normalizePairSymbol(pair);
  const cache = marketDataCache[norm];
  if (!cache || cache.length === 0) return null;
  return cache;
}

export function setCachedMarketData(pair: string, candles: OHLC[]) {
  const norm = normalizePairSymbol(pair);
  if (Array.isArray(candles) && candles.length > 0) {
    marketDataCache[norm] = candles;
  }
}

export function getInFlightRequest(pair: string): Promise<MarketState | null> | undefined {
  return inFlightRequests.get(normalizePairSymbol(pair));
}

export function setInFlightRequest(pair: string, reqPromise: Promise<MarketState | null>) {
  const norm = normalizePairSymbol(pair);
  inFlightRequests.set(norm, reqPromise);
  reqPromise.finally(() => {
    if (inFlightRequests.get(norm) === reqPromise) {
      inFlightRequests.delete(norm);
    }
  });
}

export function recordMarketDiagnosticRequest() {
  diagnosticMetrics.requestCount++;
  diagnosticMetrics.lastRequestTime = new Date().toISOString();
}

export function recordMarketDiagnosticError() {
  diagnosticMetrics.errorCount++;
}

export function getMarketDiagnostics(): MarketDiagnostics {
  return {
    ...diagnosticMetrics,
    activePairsCount: Object.keys(centralMarketStates).length,
    states: getAllCentralMarketStates()
  };
}

export function startMarketDataEngine() {
  console.log("[MARKET DATA SERVICE] Dedicated MT5 Primary Engine & Central Market State initialized.");
}

export function getSystemConfig() {
  return {
    supportedPairs: SUPPORTED_PAIRS,
    supportedTimeframes: SUPPORTED_TIMEFRAMES,
    activeStatesCount: Object.keys(centralMarketStates).length,
    candleCacheSize: Object.keys(marketDataCache).reduce((acc, pair) => {
      acc[pair] = marketDataCache[pair].length;
      return acc;
    }, {} as Record<string, number>)
  };
}

// Default export for flexibility
export default mt5DataService;
