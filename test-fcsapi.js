import https from 'https';

https.get('https://api-v4.fcsapi.com/forex/latest?symbol=EURUSD,GBPUSD,USDJPY,XAUUSD,BTCUSD,ETHUSD&access_key=6KZTkpVBZgj78wXgZeKZ', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log(data));
});
