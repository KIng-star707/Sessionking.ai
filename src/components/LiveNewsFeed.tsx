import React, { useState, useEffect } from 'react';
import { Newspaper, ChevronRight, Clock, Target, AlertCircle, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  contentSnippet: string;
}

export default function LiveNewsFeed({ selectedPair }: { selectedPair?: string }) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await fetch('/api/news');
        if (!response.ok) return;
        const result = await response.json();
        if (result.success && result.data) {
          setNews(result.data);
        }
      } catch (error) {
        console.error("Failed to fetch news:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
    const timer = setInterval(fetchNews, 5 * 60 * 1000); // 5 mins
    return () => clearInterval(timer);
  }, []);

  if (loading && news.length === 0) {
    return (
      <div className="glass-card p-6 border-white/10 mb-8 animate-pulse">
        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
          <Newspaper className="w-5 h-5 text-blue-400" />
          Live Market News
        </h3>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="w-16 h-16 bg-white/5 rounded-lg shrink-0"></div>
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-white/5 rounded w-3/4"></div>
                <div className="h-3 bg-white/5 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (news.length === 0) return null;

  const filteredNews = news.filter(item => {
    if (!selectedPair) return true;
    const bases = selectedPair.split('/');
    const lowerTitle = (item.title + " " + (item.contentSnippet || "")).toLowerCase();
    
    // Check if the news mentions any currency in the selected pair
    // Also include central banks for those currencies
    const currencyKeywords: Record<string, string[]> = {
      'USD': ['usd', 'fed', 'fomc', 'us '],
      'EUR': ['eur', 'ecb', 'euro'],
      'GBP': ['gbp', 'boe', 'uk ', 'england'],
      'JPY': ['jpy', 'boj', 'japan'],
      'AUD': ['aud', 'rba', 'australi'],
      'NZD': ['nzd', 'rbnz', 'new zealand'],
      'CAD': ['cad', 'boc', 'canada'],
      'CHF': ['chf', 'snb', 'swiss'],
      'XAU': ['gold', 'xau']
    };

    return bases.some(base => {
      const keywords = currencyKeywords[base] || [base.toLowerCase()];
      return keywords.some(kw => lowerTitle.includes(kw));
    });
  });

  return (
    <div className="glass-card mb-8 overflow-hidden border-white/10 flex flex-col h-[500px]">
      <div className="p-4 sm:p-6 bg-gradient-to-r from-blue-900/20 to-transparent border-b border-white/10 flex justify-between items-center shrink-0">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-blue-400" />
          Live Market News {selectedPair && <span className="text-gray-400 text-sm ml-2">({selectedPair})</span>}
        </h3>
        <span className="text-[10px] font-mono text-blue-400 uppercase tracking-widest px-2 py-1 bg-blue-500/10 rounded hidden sm:inline-block">Live Feed</span>
      </div>
      
      <div className="divide-y divide-white/5 overflow-y-auto no-scrollbar flex-1">
        {filteredNews.length === 0 ? (
          <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center h-full">
             <Newspaper className="w-12 h-12 mb-4 opacity-20" />
             <p>No recent news found for {selectedPair}.<br/>The market is quiet on this front.</p>
          </div>
        ) : filteredNews.map((item, index) => {
          // Parse date
          let formattedDate = "";
          try {
            formattedDate = formatDistanceToNow(new Date(item.pubDate), { addSuffix: true });
          } catch(e) {
             formattedDate = item.pubDate;
          }

          // Generate tags based on keywords
          const tags = [];
          const lowerTitle = (item.title + " " + item.contentSnippet).toLowerCase();
          if (lowerTitle.includes('fed') || lowerTitle.includes('fomc') || lowerTitle.includes('usd')) tags.push({ text: 'USD/FED', color: 'text-green-400 bg-green-400/10' });
          if (lowerTitle.includes('ecb') || lowerTitle.includes('eur')) tags.push({ text: 'EUR/ECB', color: 'text-blue-400 bg-blue-400/10' });
          if (lowerTitle.includes('boe') || lowerTitle.includes('gbp')) tags.push({ text: 'GBP/BOE', color: 'text-purple-400 bg-purple-400/10' });
          if (lowerTitle.includes('boj') || lowerTitle.includes('jpy')) tags.push({ text: 'JPY/BOJ', color: 'text-red-400 bg-red-400/10' });
          if (lowerTitle.includes('gold') || lowerTitle.includes('xau')) tags.push({ text: 'GOLD', color: 'text-yellow-400 bg-yellow-400/10' });
          if (lowerTitle.includes('geopolitical') || lowerTitle.includes('war') || lowerTitle.includes('strike')) tags.push({ text: 'Geopolitics', color: 'text-orange-400 bg-orange-400/10' });

          return (
            <motion.a
              key={index}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="block p-4 sm:p-6 hover:bg-white/5 transition-colors group"
            >
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Clock className="w-3.5 h-3.5" />
                    {formattedDate}
                  </div>
                  {tags.map((tag, i) => (
                    <span key={i} className={`text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded ${tag.color}`}>
                      {tag.text}
                    </span>
                  ))}
                </div>
                
                <h4 className="text-white font-medium text-sm sm:text-base group-hover:text-blue-400 transition-colors line-clamp-2">
                  {item.title}
                </h4>
                
                {item.contentSnippet && (
                  <p className="text-sm text-gray-500 line-clamp-2">
                    {item.contentSnippet.substring(0, 150)}...
                  </p>
                )}
                
                <div className="mt-2 text-xs font-bold text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  Read Full Article <ExternalLink className="w-3 h-3" />
                </div>
              </div>
            </motion.a>
          );
        })}
      </div>
    </div>
  );
}
