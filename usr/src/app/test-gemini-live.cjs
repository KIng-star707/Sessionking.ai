const fetch = require('node-fetch');
async function test() {
  const payload = {
    feature: "signal",
    model: "gemini-2.5-flash",
    contents: [{ parts: [{ text: "pair = EUR/USD" }] }],
    config: {}
  };
  const res = await fetch("http://localhost:3000/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  console.log(await res.text());
}
test();
