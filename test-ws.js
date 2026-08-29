import WebSocket from 'ws';

const ws = new WebSocket('wss://ws-v4.fcsapi.com/8I9WTCPmdOTR3wSr2Yj9a');

ws.on('open', () => {
  console.log('Connected');
});

ws.on('message', (data) => {
  console.log('Message:', data.toString());
});

ws.on('error', (err) => {
  console.error('Error:', err);
});

ws.on('close', () => {
  console.log('Closed');
});
