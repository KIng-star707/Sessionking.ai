import WebSocket from "ws";

const ws = new WebSocket("wss://streamer.finance.yahoo.com/");

ws.on("open", () => {
    console.log("Connected to Yahoo");
    ws.send(JSON.stringify({ subscribe: ["EURUSD=X", "USDJPY=X", "AAPL"] }));
});

ws.on("message", (data) => {
    console.log("Raw message", data);
});

setTimeout(() => process.exit(0), 10000);
