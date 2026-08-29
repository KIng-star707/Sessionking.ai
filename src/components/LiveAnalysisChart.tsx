import React, { useEffect, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, Area, AreaChart } from 'recharts';
import { Activity, AlertCircle, TrendingDown, TrendingUp } from 'lucide-react';

interface LiveAnalysisChartProps {
  pair: string;
  bias?: "Bullish" | "Bearish" | "Neutral";
  technicalLevels?: {
    currentPrice?: number;
    entryPrice?: number;
    stopLoss?: number;
    takeProfit1?: number;
    takeProfit2?: number;
    supportLevel?: number;
    resistanceLevel?: number;
  };
}

export default function LiveAnalysisChart({ pair, bias, technicalLevels }: LiveAnalysisChartProps) {
  const [data, setData] = useState<{ time: string; price: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let interval: NodeJS.Timeout;

    const fetchMarketData = async () => {
      try {
        const res = await fetch(`/api/market-data?pair=${encodeURIComponent(pair)}`);
        
        if (res.status === 202) {
           if (isMounted) setError("Warming up market engine...");
           return;
        }
        
        if (!res.ok) {
           throw new Error("Failed to fetch market data");
        }
        
        const json = await res.json();
        if (json.data && Array.isArray(json.data) && isMounted) {
            // json.data is OHLC[]
            const chartData = json.data.map((d: any) => ({
               time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
               price: d.close
            }));
            
            // Sometimes it's empty if not mapped in proxy
            if (chartData.length === 0) {
               setError("Live data not available for this pair.");
               setData([]);
            } else {
               setData(chartData);
               setError(null);
            }
            setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
           setError("Failed to stream live data for " + pair);
           setLoading(false);
        }
      }
    };

    fetchMarketData();
    interval = setInterval(fetchMarketData, 5000); // Polling every 5s for simplicity

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [pair]);

  const color = bias === "Bullish" ? "#22c55e" : bias === "Bearish" ? "#ef4444" : "#eab308";
  
  if (loading && !error) {
     return <div className="flex h-full items-center justify-center text-gray-500 animate-pulse"><Activity className="w-6 h-6 mr-2" /> Initializing Live Context...</div>;
  }

  // Calculate high/low for YAxis domain padding
  let prices = data.map(d => d.price);
  
  if (technicalLevels) {
    const levels = [
      technicalLevels.entryPrice, 
      technicalLevels.stopLoss, 
      technicalLevels.takeProfit1, 
      technicalLevels.takeProfit2,
      technicalLevels.supportLevel,
      technicalLevels.resistanceLevel
    ].filter(v => v !== undefined && v !== null && !isNaN(v as number)) as number[];
    prices = [...prices, ...levels];
  }

  const validPrices = prices.filter(p => typeof p === 'number' && !isNaN(p) && isFinite(p));
  const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : 1.0;
  const maxPrice = validPrices.length > 0 ? Math.max(...validPrices) : 1.001;
  const domainPadding = (maxPrice - minPrice) > 0 ? (maxPrice - minPrice) * 0.1 : 0.001;

  const minDataPrice = data.length > 0 ? Math.min(...data.map(d => d.price)) : null;
  const maxDataPrice = data.length > 0 ? Math.max(...data.map(d => d.price)) : null;

  return (
    <div className="w-full h-full relative flex flex-col">
       {error && <div className="absolute top-2 left-2 z-10 text-[10px] text-gray-400 bg-black/60 px-2 py-1 rounded flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {error}</div>}
       
       <div className="flex-1 w-full min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="time" hide />
            <YAxis 
                domain={[minPrice - domainPadding, maxPrice + domainPadding]} 
                orientation="right" 
                tick={{ fill: '#6b7280', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => typeof val === 'number' && !isNaN(val) ? val.toFixed(4) : ""}
                width={60}
            />
            <Tooltip 
               contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
               itemStyle={{ color: '#fff', fontWeight: 'bold' }}
               labelStyle={{ color: '#9ca3af', fontSize: '12px' }}
            />
            <Area type="monotone" dataKey="price" stroke={color} strokeWidth={2} fillOpacity={1} fill="url(#colorPrice)" isAnimationActive={false} />
            
            {/* Contextual Trend Line */}
            {(!technicalLevels || (!technicalLevels.supportLevel && !technicalLevels.resistanceLevel)) && bias === 'Bullish' && minDataPrice !== null && isFinite(minDataPrice) && <ReferenceLine y={minDataPrice} stroke="#22c55e" strokeDasharray="3 3" label={{ position: 'insideTopLeft', fill: '#22c55e', fontSize: 10, value: 'Support Logic Maintained' }}/>}
            {(!technicalLevels || (!technicalLevels.supportLevel && !technicalLevels.resistanceLevel)) && bias === 'Bearish' && maxDataPrice !== null && isFinite(maxDataPrice) && <ReferenceLine y={maxDataPrice} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'insideBottomLeft', fill: '#ef4444', fontSize: 10, value: 'Resistance Structure Holds' }}/>}

            {/* Technical Levels */}
            {technicalLevels?.supportLevel && <ReferenceLine y={technicalLevels.supportLevel} stroke="#22c55e" strokeWidth={2} strokeDasharray="5 5" label={{ position: 'insideTopLeft', fill: '#22c55e', fontSize: 11, fontWeight: 'bold', value: 'Support' }}/>}
            {technicalLevels?.resistanceLevel && <ReferenceLine y={technicalLevels.resistanceLevel} stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" label={{ position: 'insideBottomLeft', fill: '#ef4444', fontSize: 11, fontWeight: 'bold', value: 'Resistance' }}/>}
            {technicalLevels?.entryPrice && <ReferenceLine y={technicalLevels.entryPrice} stroke="#3b82f6" strokeWidth={2} strokeDasharray="3 3" label={{ position: 'insideTopLeft', fill: '#3b82f6', fontSize: 11, fontWeight: 'bold', value: 'ENTRY' }}/>}
            {technicalLevels?.stopLoss && <ReferenceLine y={technicalLevels.stopLoss} stroke="#f87171" strokeWidth={2} strokeDasharray="4 4" label={{ position: 'insideTopLeft', fill: '#f87171', fontSize: 11, fontWeight: 'bold', value: 'SL' }}/>}
            {technicalLevels?.takeProfit1 && <ReferenceLine y={technicalLevels.takeProfit1} stroke="#4ade80" strokeWidth={2} strokeDasharray="4 4" label={{ position: 'insideBottomLeft', fill: '#4ade80', fontSize: 11, fontWeight: 'bold', value: 'TP1' }}/>}
            {technicalLevels?.takeProfit2 && <ReferenceLine y={technicalLevels.takeProfit2} stroke="#4ade80" strokeWidth={2} strokeDasharray="4 4" label={{ position: 'insideBottomLeft', fill: '#4ade80', fontSize: 11, fontWeight: 'bold', value: 'TP2' }}/>}
          </AreaChart>
        </ResponsiveContainer>
       </div>
       
       <div className="mt-2 text-xs flex justify-between items-center text-gray-500 border-t border-white/5 pt-2">
           <span className="flex items-center gap-1">Live Institutional Feed</span>
           <span className="flex items-center gap-1">
               {bias === "Bullish" ? <TrendingUp className="w-3 h-3 text-green-500"/> : bias === "Bearish" ? <TrendingDown className="w-3 h-3 text-red-500"/> : null} 
               {bias ? `${bias} Bias Applied` : 'Neutral Observation'}
           </span>
       </div>
    </div>
  );
}
