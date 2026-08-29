const fetch = require('node-fetch');
async function run() {
  const access_key = process.env.FCS_API_KEY || "6KZTkpVBZgj78wXgZeKZ";
  const url = `https://api-v4.fcsapi.com/forex/multi_url?url[pro_plan]=forex/converter?pair1=USD&pair2=NGN&amount=30&url[premium_plan]=forex/converter?pair1=USD&pair2=NGN&amount=60&url[institutional_plan]=forex/converter?pair1=USD&pair2=NGN&amount=100&url[intelligence_terminal]=forex/converter?pair1=USD&pair2=NGN&amount=5&access_key=${access_key}`;
  const response = await fetch(url);
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}
run();