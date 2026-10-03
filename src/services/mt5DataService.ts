/**
 * SESSIONKING - MetaTrader 5 (MT5) Market Data Service Adapter
 * 
 * Re-exports the unified MT5 Primary Market Data Service and types from marketDataService.ts
 */

import {
  mt5DataService,
  MT5MarketDataService,
  type MT5Timeframe,
  type MT5Candle,
  type MT5SymbolInfo,
  type MT5Tick,
  type MT5TerminalStatus,
  type FreshnessThresholds,
  type FreshnessWatchdogReport,
  SUPPORTED_TIMEFRAMES,
  normalizePairSymbol,
  resolveBrokerSymbol
} from './marketDataService';

export {
  mt5DataService,
  MT5MarketDataService,
  type MT5Timeframe,
  type MT5Candle,
  type MT5SymbolInfo,
  type MT5Tick,
  type MT5TerminalStatus,
  type FreshnessThresholds,
  type FreshnessWatchdogReport,
  SUPPORTED_TIMEFRAMES,
  normalizePairSymbol,
  resolveBrokerSymbol
};

export default mt5DataService;
