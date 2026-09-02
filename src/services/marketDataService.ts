export interface OHLC {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type FreshnessStatus = 'FRESH' | 'STALE' | 'UNAVAILABLE';
export type DataStatus = 'LIVE' | 'DEGRADED' | 'STALE' | 'OFFLINE';
export type MarketEngineStatus = 'ONLINE' | 'MARKET_CLOSED' | 'RATE_LIMITED' | 'ERROR';
export type MarketDataSource = 'FCS_API' | 'BINANCE' | 'INTERBANK' | 'YAHOO_FINANCE' | 'YAHOO_INTERBANK' | 'BROKER' | 'COINBASE' | 'LIVE_FEED' | 'UNAVAILABLE';

export interface MarketState {
  symbol: string;
  pair: string; // Alias for symbol for backward compatibility
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

// Single source of truth in-memory central market states
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
 * Strictly normalizes pair symbols into unified 'BASE/QUOTE' format.
 * Intelligently handles broker suffixes, timeframe labels, parenthesized text, and major commodities/indices.
 */
export function normalizePairSymbol(pair: string): string {
  if (!pair || typeof pair !== 'string') return 'EUR/USD';
  let clean = pair.trim().toUpperCase();
  if (clean === 'UNKNOWN' || clean === 'N/A' || clean === 'UNDEFINED' || clean === 'NULL') {
    return 'EUR/USD';
  }

  // Remove data feed provider prefixes
  clean = clean.replace(/^(FOREX:|FX:|BINANCE:|COINBASE:|OANDA:|FCS:|YAHOO:|TV:)/i, '');

  // Strip parenthesized/bracketed details like (15M), [1H], (D1), {H4}
  clean = clean.replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, '').trim();

  // Strip standalone timeframe or chart indicator tokens
  clean = clean.replace(/\b(M1|M5|M15|M30|H1|H4|D1|W1|MN|1M|5M|15M|30M|1H|4H|1D|1W|DAILY|HOURLY|TIMEFRAME|CHART|CANDLE|CANDLES)\b/gi, '').trim();

  // Strip common broker ticker extensions (.PRO, .RAW, .A, + etc.)
  clean = clean.replace(/[\.\_\-\+\#](PRO|RAW|STD|VIP|MICRO|A|M|SB|ECN)$/i, '').trim();

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

  // If no previous price, verify basic reasonable asset ranges
  if (!prevMid || prevMid <= 0) {
    if (pair.includes('BTC') && (newMid < 1000 || newMid > 1000000)) return false;
    if (pair.includes('ETH') && (newMid < 50 || newMid > 100000)) return false;
    if (pair.includes('XAU') && (newMid < 500 || newMid > 20000)) return false;
    if (pair.includes('JPY') && (newMid < 30 || newMid > 500)) return false;
    if ((pair === 'EUR/USD' || pair === 'GBP/USD' || pair === 'AUD/USD') && (newMid < 0.2 || newMid > 5.0)) return false;
    return true;
  }

  // Instrument-specific max allowable instant delta
  let maxAllowableChangeRatio = 0.25; // 25% max single tick jump on forex
  if (pair.includes('BTC') || pair.includes('ETH')) {
    maxAllowableChangeRatio = 0.50; // 50% max on crypto
  }

  const changeRatio = Math.abs(newMid - prevMid) / prevMid;
  return changeRatio <= maxAllowableChangeRatio;
}

/**
 * Validates, sequences, and updates incoming market data into the SINGLE Central Market State.
 * Rejects stale, out-of-order, or anomalous data.
 */
export function updateCentralMarketState(
  rawPair: string,
  rawPrice: number | string,
  rawBid?: number | string,
  rawAsk?: number | string,
  rawTimestamp?: string | number,
  requestId: string = `FEED-${Date.now()}`,
  source: MarketDataSource = 'FCS_API'
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

  // Derive standard tight institutional spread proxy only if feed is midpoint-only
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

  // Sequence Protection: Reject if incoming source timestamp is strictly older than existing recorded source timestamp
  if (prevState && prevState.sourceTimestamp) {
    const prevSourceTime = typeof prevState.sourceTimestamp === 'number' 
      ? prevState.sourceTimestamp 
      : Date.parse(String(prevState.sourceTimestamp));

    if (!isNaN(prevSourceTime) && sourceTimestampParsed < prevSourceTime) {
      console.warn(`[MARKET DATA INTEGRITY] Dropped out-of-order older packet for ${pair}. Incoming: ${sourceTimestampParsed} < Current: ${prevSourceTime}`);
      diagnosticMetrics.rejectedOutdatedCount++;
      return prevState;
    }
  }

  // Increment monotonic sequence number
  const nextSeq = (sequenceCounters[pair] || 0) + 1;
  sequenceCounters[pair] = nextSeq;

  // 4. Data freshness and market state evaluation
  const isWeekend = isMarketWeekend();
  const isCrypto = pair.includes('BTC') || pair.includes('ETH');
  
  let freshness: FreshnessStatus = 'FRESH';
  let dataStatus: DataStatus = 'LIVE';
  let status: MarketEngineStatus = 'ONLINE';

  if (isWeekend && !isCrypto) {
    status = 'MARKET_CLOSED';
    dataStatus = 'LIVE'; // Preserved Friday close is authoritative
    freshness = 'FRESH';
  }

  const ageMs = 0; // Freshly ingested

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
    rawTimestamp
  };

  // Atomically update single central market state
  centralMarketStates[pair] = state;

  // Update candle stream using authoritative tick
  updateCandleCacheWithTick(pair, mid, now);

  return state;
}

/**
 * Updates candle series with verified authoritative tick.
 */
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

/**
 * Returns the validated, authoritative Single Central Market State for a given pair.
 * Automatically computes age and sets status to STALE if threshold exceeded.
 */
export function getCentralMarketState(rawPair: string): MarketState | null {
  const pair = normalizePairSymbol(rawPair);
  const state = centralMarketStates[pair];
  if (!state) return null;

  const now = Date.now();
  const ageMs = now - (state.receivedAt || now);
  const isWeekend = isMarketWeekend();
  const isCrypto = pair.includes('BTC') || pair.includes('ETH');

  // Staleness detection:
  // For open markets (weekday forex or 24/7 crypto), mark as STALE if age > 30 seconds without updates
  let dataStatus: DataStatus = state.dataStatus;
  let freshness: FreshnessStatus = state.freshness;

  if (!isWeekend || isCrypto) {
    if (ageMs > 30000) { // 30s threshold
      dataStatus = 'STALE';
      freshness = 'STALE';
    } else {
      dataStatus = 'LIVE';
      freshness = 'FRESH';
    }
  } else {
    // Weekend forex close price is valid
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

/**
 * Returns all active Central Market States with real-time age computation.
 */
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

/**
 * In-Flight Request Deduplication (Single Flight Pattern)
 * Prevents multiple components from making duplicate simultaneous upstream requests.
 */
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

/**
 * Records diagnostic API request activity.
 */
export function recordMarketDiagnosticRequest() {
  diagnosticMetrics.requestCount++;
  diagnosticMetrics.lastRequestTime = new Date().toISOString();
}

/**
 * Records diagnostic API error activity.
 */
export function recordMarketDiagnosticError() {
  diagnosticMetrics.errorCount++;
}

/**
 * Returns complete system market data diagnostics.
 */
export function getMarketDiagnostics(): MarketDiagnostics {
  return {
    ...diagnosticMetrics,
    activePairsCount: Object.keys(centralMarketStates).length,
    states: getAllCentralMarketStates()
  };
}

export function startMarketDataEngine() {
  console.log("[MARKET DATA SERVICE] Single Authoritative Central Market State Engine online.");
}

export function getSystemConfig() {
  return {
    supportedPairs: SUPPORTED_PAIRS,
    activeStatesCount: Object.keys(centralMarketStates).length,
    candleCacheSize: Object.keys(marketDataCache).reduce((acc, pair) => {
      acc[pair] = marketDataCache[pair].length;
      return acc;
    }, {} as Record<string, number>)
  };
}
