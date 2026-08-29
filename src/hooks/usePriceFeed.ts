import { useState, useEffect } from 'react';
import type { MarketState } from '../services/marketDataService';

export function usePriceFeed() {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [states, setStates] = useState<Record<string, MarketState>>({});
  const [directions, setDirections] = useState<Record<string, 'up' | 'down' | 'none'>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/api/price-stream`;
    
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;
    let reconnectAttempts = 0;
    
    const MAX_RECONNECT_DELAY = 10000;
    
    const connect = () => {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttempts = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'INIT') {
            if (message.data) setPrices(message.data);
            if (message.states) setStates(message.states);
            if (message.timestamp) setLastSyncTime(message.timestamp);
          } else if (message.type === 'UPDATE') {
            if (message.timestamp) setLastSyncTime(message.timestamp);
            if (message.states) {
              setStates(prev => ({ ...prev, ...message.states }));
            }
            if (message.data) {
              setPrices(prev => {
                const newPrices = { ...prev, ...message.data };
                const newDirections: Record<string, 'up' | 'down' | 'none'> = {};
                
                Object.keys(message.data).forEach(pair => {
                  if (prev[pair]) {
                    if (message.data[pair] > prev[pair]) newDirections[pair] = 'up';
                    else if (message.data[pair] < prev[pair]) newDirections[pair] = 'down';
                    else newDirections[pair] = 'none';
                  }
                });
                
                if (isActive) {
                  setDirections(prevDir => ({ ...prevDir, ...newDirections }));
                }
                return newPrices;
              });
            }
          }
        } catch (err) {
          // ignore malformed socket payload
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
        reconnectTimeout = setTimeout(connect, delay);
        reconnectAttempts++;
      };
      
      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();

    return () => {
      isActive = false;
      clearTimeout(reconnectTimeout);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, []);

  return { prices, states, directions, isConnected, lastSyncTime };
}
