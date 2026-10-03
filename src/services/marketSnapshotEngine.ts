/**
 * SESSIONKING - Authoritative Single Immutable Market Snapshot Engine
 * 
 * Every downstream intelligence module (Regime, Structure, Momentum, Liquidity,
 * Order Blocks, Risk, Decision Gate, Gemini ML Layer) MUST evaluate the EXACT
 * same snapshot.
 */

import { mt5DataService, MT5Candle, MT5Timeframe } from "./mt5DataService";
import { 
  getCentralMarketState, 
  getCachedMarketData, 
  normalizePairSymbol,
  calculatePipSpread,
  isMarketWeekend,
  OHLC,
  MarketState 
} from "./marketDataService";

export interface SnapshotCandle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface ImmutableMarketSnapshot {
  snapshotId: string;
  symbol: string;           // Canonical symbol (e.g. 'EUR/USD')
  brokerSymbol: string;     // Raw broker ticker (e.g. 'EURUSD.pro')
  providerSymbol: string;   // Provider ticker
  provider: 'MT5' | 'FCS_API' | 'INTERBANK' | 'UNAVAILABLE';
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  spreadPips: number;
  quotePrecision: number;
  pointSize: number;
  contractSize?: number;
  volume?: number;
  timestamp: string;
  serverTimestamp: number;
  receivedAt: number;
  dataAgeMs: number;
  freshness: 'FRESH' | 'STALE' | 'UNAVAILABLE';
  marketStatus: 'OPEN' | 'CLOSED' | 'WEEKEND_HOLD' | 'OFFLINE';
  session: 'Asian' | 'London' | 'New York' | 'London-New York Overlap' | 'Off-Hours';
  volatility: {
    atr14: number;
    rangeRatio: number;
    volatilityState: 'LOW' | 'NORMAL' | 'HIGH' | 'EXTREME';
  };
  timeframes: {
    M1?: SnapshotCandle[];
    M5: SnapshotCandle[];
    M15: SnapshotCandle[];
    H1: SnapshotCandle[];
    H4: SnapshotCandle[];
    D1: SnapshotCandle[];
  };
  meta: {
    generatedAt: string;
    isAuthoritative: boolean;
  };
}

/**
 * Calculates current market session from UTC time.
 */
export function getCurrentMarketSession(): 'Asian' | 'London' | 'New York' | 'London-New York Overlap' | 'Off-Hours' {
  const now = new Date();
  const utcHour = now.getUTCHours();

  // London-NY Overlap: 12:00 - 16:00 UTC
  if (utcHour >= 12 && utcHour < 16) return 'London-New York Overlap';
  // London: 07:00 - 16:00 UTC
  if (utcHour >= 7 && utcHour < 16) return 'London';
  // New York: 12:00 - 21:00 UTC
  if (utcHour >= 12 && utcHour < 21) return 'New York';
  // Asian: 00:00 - 08:00 UTC
  if (utcHour >= 0 && utcHour < 8) return 'Asian';

  return 'Off-Hours';
}

/**
 * Resamples M5 / M15 candles into higher timeframes when native MT5 H1/H4/D1 are not directly fed.
 */
function resampleCandles(candles: SnapshotCandle[], timeframeMinutes: number): SnapshotCandle[] {
  if (!candles || candles.length === 0) return [];
  const intervalMs = timeframeMinutes * 60 * 1000;
  const groups = new Map<number, SnapshotCandle[]>();

  for (const c of candles) {
    const timeMs = new Date(c.timestamp).getTime();
    if (isNaN(timeMs)) continue;
    const bucket = Math.floor(timeMs / intervalMs) * intervalMs;
    if (!groups.has(bucket)) groups.set(bucket, []);
    groups.get(bucket)!.push(c);
  }

  const resampled: SnapshotCandle[] = [];
  const sortedBuckets = Array.from(groups.keys()).sort((a, b) => a - b);

  for (const bucket of sortedBuckets) {
    const bucketCandles = groups.get(bucket)!;
    const open = bucketCandles[0].open;
    const close = bucketCandles[bucketCandles.length - 1].close;
    let high = -Infinity;
    let low = Infinity;
    let volume = 0;

    for (const bc of bucketCandles) {
      if (bc.high > high) high = bc.high;
      if (bc.low < low) low = bc.low;
      volume += (bc.volume || 0);
    }

    resampled.push({
      timestamp: new Date(bucket).toISOString(),
      open,
      high,
      low,
      close,
      volume
    });
  }

  return resampled;
}

/**
 * Computes ATR 14 from OHLC candles.
 */
function calculateAtr(candles: SnapshotCandle[], period = 14): number {
  if (!candles || candles.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - prev.close),
      Math.abs(current.low - prev.close)
    );
    trs.push(tr);
  }

  if (trs.length === 0) return 0;
  const slice = trs.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

/**
 * Builds the Single Authoritative Immutable Market Snapshot.
 */
export function buildImmutableMarketSnapshot(
  rawPair: string,
  preferredSource: 'AUTO' | 'MT5' | 'FCS' = 'AUTO',
  options?: {
    currentPrice?: number | null;
    candles?: SnapshotCandle[] | OHLC[];
    state?: Partial<MarketState>;
  }
): ImmutableMarketSnapshot {
  const canonical = normalizePairSymbol(rawPair);
  const now = Date.now();
  const session = getCurrentMarketSession();
  const isWeekend = isMarketWeekend();
  const isCrypto = canonical.includes('BTC') || canonical.includes('ETH');

  // Check MT5 data availability
  const mt5Connected = mt5DataService.isConnected();
  const mt5Symbol = mt5DataService.getSymbolInfo(canonical);
  const mt5Candles = mt5DataService.getAllTimeframes(canonical);

  // Check Central Market State (FCS / Interbank)
  const centralState = getCentralMarketState(canonical);
  const baseCandles = (options?.candles && options.candles.length > 0) 
    ? options.candles 
    : (getCachedMarketData(canonical) || []);

  let provider: 'MT5' | 'FCS_API' | 'INTERBANK' | 'UNAVAILABLE' = 'UNAVAILABLE';
  let bid = 0;
  let ask = 0;
  let mid = 0;
  let spread = 0;
  let spreadPips = 0;
  let quotePrecision = canonical.includes('JPY') ? 3 : (canonical.includes('BTC') || canonical.includes('ETH') || canonical.includes('XAU')) ? 2 : 5;
  let pointSize = canonical.includes('JPY') ? 0.001 : 0.00001;
  let contractSize: number | undefined = undefined;
  let volume: number | undefined = undefined;
  let brokerSymbol = canonical.replace('/', '');
  let providerSymbol = canonical;
  let dataAgeMs = Infinity;
  let freshness: 'FRESH' | 'STALE' | 'UNAVAILABLE' = 'UNAVAILABLE';
  let marketStatus: 'OPEN' | 'CLOSED' | 'WEEKEND_HOLD' | 'OFFLINE' = 'OFFLINE';
  let sourceTimestamp = now;

  // 1. PRIMARY SOURCE: MetaTrader 5
  if ((preferredSource === 'AUTO' || preferredSource === 'MT5') && mt5Connected && mt5Symbol) {
    provider = 'MT5';
    bid = mt5Symbol.bid;
    ask = mt5Symbol.ask;
    mid = (bid + ask) / 2;
    spread = mt5Symbol.spread;
    spreadPips = mt5Symbol.spreadPips;
    quotePrecision = mt5Symbol.digits;
    pointSize = mt5Symbol.pointSize;
    contractSize = mt5Symbol.contractSize;
    volume = mt5Symbol.tickVolume;
    brokerSymbol = mt5Symbol.brokerSymbol;
    providerSymbol = mt5Symbol.symbol;
    sourceTimestamp = mt5Symbol.timestamp;
    dataAgeMs = Math.max(0, now - mt5Symbol.timestamp);

    freshness = dataAgeMs < 45000 ? 'FRESH' : dataAgeMs < 120000 ? 'STALE' : 'UNAVAILABLE';
    marketStatus = mt5Symbol.tradingStatus === 'OPEN' ? 'OPEN' : 'CLOSED';
  } 
  // 2. SECONDARY SOURCE: Central Market State (FCS API / Interbank feed)
  else if (centralState && centralState.mid > 0) {
    provider = centralState.source === 'FCS_API' ? 'FCS_API' : 'INTERBANK';
    bid = centralState.bid;
    ask = centralState.ask;
    mid = centralState.mid;
    spread = centralState.spread;
    spreadPips = centralState.spreadPips;
    brokerSymbol = canonical.replace('/', '');
    providerSymbol = centralState.pair;
    dataAgeMs = centralState.ageMs;
    sourceTimestamp = typeof centralState.sourceTimestamp === 'number' ? centralState.sourceTimestamp : now;
    freshness = centralState.freshness;

    if (isWeekend && !isCrypto) {
      marketStatus = 'WEEKEND_HOLD';
      freshness = 'FRESH'; // Authoritative preserved close
    } else {
      marketStatus = centralState.dataStatus === 'LIVE' ? 'OPEN' : 'CLOSED';
    }
  }
  // 3. Fallback from options (verified price & candles passed directly)
  else if (options?.currentPrice && options.currentPrice > 0) {
    provider = 'INTERBANK';
    const halfSpread = pointSize * 1.0;
    mid = options.currentPrice;
    bid = options.state?.bid || (mid - halfSpread);
    ask = options.state?.ask || (mid + halfSpread);
    spread = Math.abs(ask - bid);
    spreadPips = calculatePipSpread(canonical, bid, ask);
    brokerSymbol = canonical.replace('/', '');
    providerSymbol = canonical;
    dataAgeMs = 0;
    sourceTimestamp = now;
    freshness = 'FRESH';
    marketStatus = isWeekend && !isCrypto ? 'WEEKEND_HOLD' : 'OPEN';
  }

  // Build Timeframe Candles
  const convertCandles = (cList: Array<{ timestamp?: string; open: number; high: number; low: number; close: number; volume?: number }>): SnapshotCandle[] => {
    return cList.map(c => ({
      timestamp: c.timestamp || new Date().toISOString(),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume
    }));
  };

  let m1List: SnapshotCandle[] = [];
  let m5List: SnapshotCandle[] = [];
  let m15List: SnapshotCandle[] = [];
  let h1List: SnapshotCandle[] = [];
  let h4List: SnapshotCandle[] = [];
  let d1List: SnapshotCandle[] = [];

  // Use MT5 native multi-timeframes if present
  if (provider === 'MT5' && mt5Candles) {
    if (mt5Candles.M1) m1List = convertCandles(mt5Candles.M1);
    if (mt5Candles.M5) m5List = convertCandles(mt5Candles.M5);
    if (mt5Candles.M15) m15List = convertCandles(mt5Candles.M15);
    if (mt5Candles.H1) h1List = convertCandles(mt5Candles.H1);
    if (mt5Candles.H4) h4List = convertCandles(mt5Candles.H4);
    if (mt5Candles.D1) d1List = convertCandles(mt5Candles.D1);
  }

  // Fallback to cached OHLC base candles for missing timeframes
  const convertedBase = convertCandles(baseCandles);
  if (m15List.length === 0 && convertedBase.length > 0) {
    m15List = convertedBase;
  }
  if (m5List.length === 0) {
    m5List = m15List;
  }
  if (h1List.length === 0 && m15List.length >= 8) {
    h1List = resampleCandles(m15List, 60);
  }
  if (h4List.length === 0 && (h1List.length >= 8 || m15List.length >= 32)) {
    h4List = resampleCandles(h1List.length > 0 ? h1List : m15List, 240);
  }
  if (d1List.length === 0 && (h4List.length >= 6 || m15List.length >= 96)) {
    d1List = resampleCandles(h4List.length > 0 ? h4List : m15List, 1440);
  }

  // Calculate Volatility Metrics
  const activeCandles = m15List.length > 0 ? m15List : m5List;
  const atr14 = calculateAtr(activeCandles, 14);
  const ranges = activeCandles.slice(-20).map(c => c.high - c.low);
  const avgRange = ranges.length > 0 ? ranges.reduce((a, b) => a + b, 0) / ranges.length : 0.001;
  const recentRange = ranges.slice(-3).reduce((a, b) => a + b, 0) / Math.max(1, ranges.slice(-3).length);
  const rangeRatio = avgRange > 0 ? recentRange / avgRange : 1.0;

  let volatilityState: 'LOW' | 'NORMAL' | 'HIGH' | 'EXTREME' = 'NORMAL';
  if (rangeRatio < 0.6) volatilityState = 'LOW';
  else if (rangeRatio > 2.2) volatilityState = 'EXTREME';
  else if (rangeRatio > 1.4) volatilityState = 'HIGH';

  const snapshot: ImmutableMarketSnapshot = {
    snapshotId: `SNAP-${canonical.replace('/', '')}-${now}`,
    symbol: canonical,
    brokerSymbol,
    providerSymbol,
    provider,
    bid,
    ask,
    mid,
    spread,
    spreadPips,
    quotePrecision,
    pointSize,
    contractSize,
    volume,
    timestamp: new Date(sourceTimestamp).toISOString(),
    serverTimestamp: now,
    receivedAt: now,
    dataAgeMs,
    freshness,
    marketStatus,
    session,
    volatility: {
      atr14,
      rangeRatio,
      volatilityState
    },
    timeframes: {
      M1: m1List,
      M5: m5List,
      M15: m15List,
      H1: h1List,
      H4: h4List,
      D1: d1List
    },
    meta: {
      generatedAt: new Date(now).toISOString(),
      isAuthoritative: provider !== 'UNAVAILABLE' && mid > 0
    }
  };

  // Object.freeze ensures snapshot cannot be mutated by downstream engines
  return Object.freeze(snapshot);
}
