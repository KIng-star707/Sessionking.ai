/**
 * SESSIONKING Live Original Market Price Feed Verification Test
 */

const YAHOO_SYMBOL_MAP: Record<string, string> = {
  'EUR/USD': 'EURUSD=X',
  'GBP/USD': 'GBPUSD=X',
  'USD/JPY': 'USDJPY=X',
  'USD/CAD': 'USDCAD=X',
  'AUD/USD': 'AUDUSD=X',
  'NZD/USD': 'NZDUSD=X',
  'USD/CHF': 'USDCHF=X',
  'EUR/JPY': 'EURJPY=X',
  'GBP/JPY': 'GBPJPY=X',
  'AUD/JPY': 'AUDJPY=X',
  'NZD/JPY': 'NZDJPY=X',
  'AUD/NZD': 'AUDNZD=X',
  'USD/SGD': 'USDSGD=X',
  'USD/HKD': 'USDHKD=X',
  'EUR/GBP': 'EURGBP=X',
  'EUR/CHF': 'EURCHF=X',
  'GBP/CHF': 'GBPCHF=X',
  'EUR/CAD': 'EURCAD=X',
  'GBP/CAD': 'GBPCAD=X',
  'XAU/USD': 'GC=F',
  'XAG/USD': 'SI=F',
  'BTC/USD': 'BTC-USD',
  'ETH/USD': 'ETH-USD',
  'USD/MXN': 'USDMXN=X',
  'USD/BRL': 'USDBRL=X',
  'USD/ZAR': 'USDZAR=X',
  'USD/TRY': 'USDTRY=X'
};

async function verifyOriginalMarketFeed() {
  console.log('====================================================');
  console.log('VERIFYING ORIGINAL LIVE MARKET PRICE INGESTION');
  console.log('====================================================\n');

  let successCount = 0;
  const entries = Object.entries(YAHOO_SYMBOL_MAP);

  await Promise.all(entries.map(async ([pair, sym]) => {
    try {
      const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=5m&range=1d`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
      });
      if (!res.ok) {
        console.error(`❌ [FAIL] ${pair} (${sym}) -> HTTP ${res.status}`);
        return;
      }
      const data = await res.json();
      const meta = data?.chart?.result?.[0]?.meta;
      const price = meta?.regularMarketPrice;
      const time = meta?.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : 'N/A';

      if (typeof price === 'number' && price > 0) {
        console.log(`✅ [LIVE] ${pair.padEnd(8)}: ${String(price).padEnd(10)} (Time: ${time})`);
        successCount++;
      } else {
        console.error(`❌ [FAIL] ${pair} (${sym}) -> Invalid price: ${price}`);
      }
    } catch (e: any) {
      console.error(`❌ [FAIL] ${pair} (${sym}) -> Error: ${e?.message}`);
    }
  }));

  console.log('\n====================================================');
  console.log(`RESULT: ${successCount}/${entries.length} ORIGINAL MARKET FEEDS ACTIVE`);
  console.log('====================================================');

  if (successCount < entries.length * 0.9) {
    process.exit(1);
  }
}

verifyOriginalMarketFeed();
