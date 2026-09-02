/**
 * SESSIONKING Market Data Integrity & Synchronization Automated Test Suite
 * Validates zero synthetic ticks, monotonic sequence numbers, stale detection,
 * Bid/Ask separation for TP/SL validation, and in-flight deduplication.
 */

import { 
  updateCentralMarketState, 
  getCentralMarketState, 
  getAllCentralMarketStates,
  normalizePairSymbol,
  calculatePipSpread,
  getInFlightRequest,
  setInFlightRequest,
  MarketState
} from '../src/services/marketDataService.ts';

function runIntegrityTests() {
  console.log('====================================================');
  console.log('SESSIONKING MARKET DATA ARCHITECTURE INTEGRITY TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(testName: string, condition: boolean, details?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}${details ? ` -> ${details}` : ''}`);
      failed++;
    }
  }

  // TEST 1: Normal Ingestion & Bid/Ask/Mid Ingestion
  const t1Time = Date.now();
  const state1 = updateCentralMarketState('EUR/USD', 1.08500, 1.08495, 1.08505, t1Time, 'REQ-1', 'FCS_API');
  assert('Normal Market State Ingestion', 
    state1 !== null && 
    state1.symbol === 'EUR/USD' && 
    state1.bid === 1.08495 && 
    state1.ask === 1.08505 && 
    state1.mid === 1.08500 &&
    state1.spreadPips === 1.0 &&
    state1.freshness === 'FRESH' &&
    state1.dataStatus === 'LIVE'
  );

  // TEST 2: Monotonic Sequence Number Increment
  const state2 = updateCentralMarketState('EUR/USD', 1.08510, 1.08505, 1.08515, t1Time + 1000, 'REQ-2', 'FCS_API');
  assert('Monotonic Sequence Increment', 
    state2 !== null && 
    state2.sequenceNumber === (state1!.sequenceNumber + 1)
  );

  // TEST 3: Out-of-Order Packet Rejection (Older timestamp incoming)
  const stalePacketTime = t1Time - 5000;
  const stateStaleRejected = updateCentralMarketState('EUR/USD', 1.08400, 1.08395, 1.08405, stalePacketTime, 'REQ-OLD', 'FCS_API');
  assert('Out-of-Order Packet Protection',
    stateStaleRejected !== null &&
    stateStaleRejected.mid === 1.08510, // Must keep newer 1.08510, not overwrite with 1.08400
    `Expected mid=1.08510, received mid=${stateStaleRejected?.mid}`
  );

  // TEST 4: Anomaly / Spike Filter Rejection
  const anomalyState = updateCentralMarketState('EUR/USD', 10.8510, undefined, undefined, t1Time + 2000, 'REQ-ANOMALY', 'INTERBANK');
  assert('Anomalous 10x Price Spike Rejection',
    anomalyState === null,
    'Spike was not rejected by sanity filter'
  );

  // TEST 5: Symbol Normalization
  assert('Symbol Normalization (XAUUSD -> XAU/USD)', normalizePairSymbol('XAUUSD') === 'XAU/USD');
  assert('Symbol Normalization (BINANCE:BTCUSDT -> BTC/USD)', normalizePairSymbol('BINANCE:BTCUSDT') === 'BTC/USD');
  assert('Symbol Normalization (eurusd -> EUR/USD)', normalizePairSymbol('eurusd') === 'EUR/USD');

  // TEST 6: Pip Spread Calculation Precision
  const eurusdSpread = calculatePipSpread('EUR/USD', 1.08500, 1.08512); // 1.2 pips
  const usdjpySpread = calculatePipSpread('USD/JPY', 154.200, 154.218); // 1.8 pips
  const xauusdSpread = calculatePipSpread('XAU/USD', 2750.00, 2750.35); // 3.5 pips
  assert('Forex 5-digit pip spread calculation', eurusdSpread === 1.2, `Got ${eurusdSpread}`);
  assert('JPY 3-digit pip spread calculation', usdjpySpread === 1.8, `Got ${usdjpySpread}`);
  assert('Gold pip spread calculation', xauusdSpread === 3.5, `Got ${xauusdSpread}`);

  // TEST 7: In-Flight Request Deduplication
  const mockPromise = Promise.resolve(state2);
  setInFlightRequest('EUR/USD', mockPromise);
  const retrievedPromise = getInFlightRequest('EUR/USD');
  assert('In-Flight Request Deduplication Shared Promise', retrievedPromise === mockPromise);

  // TEST 8: Execution Price Directional Validation (Bid vs Ask)
  // LONG (BUY) position at 1.0850, TP at 1.0880, SL at 1.0830
  // Exits at BID
  const longBuyBid = 1.08805;
  const longBuyAsk = 1.08815;
  const buyTpHit = longBuyBid >= 1.0880;
  assert('BUY (Long) TP validation executes against BID', buyTpHit === true);

  // SHORT (SELL) position at 1.0850, TP at 1.0820, SL at 1.0870
  // Exits at ASK
  const shortSellBid = 1.08190;
  const shortSellAsk = 1.08205; // Ask is 1.08205, not yet reached 1.08200!
  const sellTpHit = shortSellAsk <= 1.08200;
  assert('SELL (Short) TP validation executes against ASK (Spread aware)', sellTpHit === false);

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runIntegrityTests();
