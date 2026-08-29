async function run() {
  const r = await fetch('https://api.binance.com/api/v3/exchangeInfo');
  const d = await r.json();
  const fiatBase = d.symbols.filter((s:any)=> s.quoteAsset === 'USDT' && ["EUR","GBP","JPY","AUD","CAD","CHF","NZD"].includes(s.baseAsset)).map((s:any)=>s.symbol);
  
  const fiatQuote = d.symbols.filter((s:any)=> s.baseAsset === 'USDT' && ["EUR","GBP","JPY","AUD","CAD","CHF","NZD"].includes(s.quoteAsset)).map((s:any)=>s.symbol);
  console.log("Fiat Base", fiatBase);
  console.log("Fiat Quote", fiatQuote);
}
run();
