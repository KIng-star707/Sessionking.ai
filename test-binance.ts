import WebSocket from "ws";

const pairs = ["eurusdt", "gbpusdt", "usdtjpy", "audusdt", "usdtcad"];

pairs.forEach(p => {
  const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${p}@kline_5m`);
  ws.on("open", () => console.log("Connected", p));
  ws.on("message", (data) => console.log(p, data.toString()));
  ws.on("error", (e) => console.log(p, "ERROR", e));
  ws.on("close", () => console.log(p, "CLOSED"));
});

setTimeout(() => process.exit(0), 15000);
