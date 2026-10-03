import { useState, useEffect } from 'react';
import type { MarketState } from '../services/marketDataService';
import { marketDataService } from '../lib/marketDataService';

export function usePriceFeed() {
  const [prices, setPrices] = useState<Record<string, number>>(() => {
    const all = marketDataService.getAllStates();
    const init: Record<string, number> = {};
    Object.keys(all).forEach(k => { init[k] = all[k].mid; });
    return init;
  });
  const [states, setStates] = useState<Record<string, MarketState>>(() => marketDataService.getAllStates());
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
            if (message.states) {
              Object.values(message.states).forEach((st: any) => {
                marketDataService.updateState(st);
              });
              setStates(marketDataService.getAllStates());
            }
            if (message.data) {
              Object.entries(message.data).forEach(([p, pr]) => {
                marketDataService.ingestWebSocketUpdate(p, pr as number);
              });
              setPrices(message.data);
            }
            if (message.timestamp) setLastSyncTime(message.timestamp);
          } else if (message.type === 'UPDATE') {
            if (message.timestamp) setLastSyncTime(message.timestamp);
            
            // Validate through central MarketDataService with sequence and timestamp checks
            const acceptedData: Record<string, number> = {};
            const acceptedStates: Record<string, MarketState> = {};

            if (message.states) {
              Object.entries(message.states).forEach(([p, st]: [string, any]) => {
                const accepted = marketDataService.updateState(st);
                if (accepted) {
                  acceptedStates[p] = st;
                }
              });
              if (Object.keys(acceptedStates).length > 0) {
                setStates(prev => ({ ...prev, ...acceptedStates }));
              }
            }

            if (message.data) {
              Object.entries(message.data).forEach(([pair, pr]) => {
                const priceNum = pr as number;
                const accepted = marketDataService.updateState({
                  pair,
                  symbol: pair,
                  mid: priceNum,
                  timestamp: message.timestamp || new Date().toISOString(),
                  source: 'LIVE_FEED'
                });
                if (accepted) {
                  acceptedData[pair] = priceNum;
                }
              });

              if (Object.keys(acceptedData).length > 0) {
                setPrices(prev => {
                  const newPrices = { ...prev, ...acceptedData };
                  const newDirections: Record<string, 'up' | 'down' | 'none'> = {};
                  
                  Object.keys(acceptedData).forEach(pair => {
                    if (prev[pair]) {
                      if (acceptedData[pair] > prev[pair]) newDirections[pair] = 'up';
                      else if (acceptedData[pair] < prev[pair]) newDirections[pair] = 'down';
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
