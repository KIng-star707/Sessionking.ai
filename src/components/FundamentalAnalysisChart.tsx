import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { Globe } from 'lucide-react';

interface FundamentalScores {
  economicGrowth?: number;
  inflation?: number;
  interestRates?: number;
  geopolitics?: number;
  marketSentiment?: number;
}

export default function FundamentalAnalysisChart({ scores }: { scores?: FundamentalScores }) {
  if (!scores) return null;

  const data = [
    { subject: 'Growth', A: scores.economicGrowth || 0, fullMark: 10 },
    { subject: 'Inflation', A: scores.inflation || 0, fullMark: 10 },
    { subject: 'Rates', A: scores.interestRates || 0, fullMark: 10 },
    { subject: 'Geopolitics', A: scores.geopolitics || 0, fullMark: 10 },
    { subject: 'Sentiment', A: scores.marketSentiment || 0, fullMark: 10 },
  ];

  return (
    <div className="w-full h-full relative flex flex-col">
       <div className="flex-1 w-full min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="rgba(255,255,255,0.1)" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 12, fontWeight: 'bold' }} />
            <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
            <Radar name="Fundamentals" dataKey="A" stroke="#fbbf24" fill="#fbbf24" fillOpacity={0.3} />
          </RadarChart>
        </ResponsiveContainer>
       </div>
       <div className="mt-2 text-xs flex justify-between items-center text-gray-500 border-t border-white/5 pt-2">
           <span className="flex items-center gap-1"><Globe className="w-3 h-3 text-gold"/> Macro Fundamental Radar</span>
           <span className="flex items-center gap-1">
               Scores out of 10
           </span>
       </div>
    </div>
  );
}
