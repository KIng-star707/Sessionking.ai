import React, { memo } from 'react';

const JARGON_MAP: Record<string, string> = {
  'LIQUIDITY': 'Areas where many stop losses or pending orders are placed.',
  'FVG': 'Fair Value Gap: An imbalance in price action leaving a gap.',
  'BOS': 'Break of Structure: When price breaks past a previous high or low.',
  'CHOCH': 'Change of Character: A shift in market trend direction.',
  'OB': 'Order Block: A zone where institutional buying/selling occurred.',
  'MOMENTUM': 'The strength or speed of price movement.',
  'STRUCTURE': 'The overall pattern of higher highs/lows or lower highs/lows.',
  'SWEEP': 'When price quickly moves past a key level to trigger stops before reversing.',
  'POI': 'Point of Interest: A specific price level or zone to watch for a reaction.',
  'SL': 'Stop Loss: An order placed to close a position when it reaches a certain price, limiting loss.',
  'TP': 'Take Profit: An order placed to close a position once it reaches a certain level of profit.',
  'R:R': 'Risk to Reward Ratio: The potential loss versus the potential profit of a trade.',
  'RR': 'Risk to Reward Ratio: The potential loss versus the potential profit of a trade.',
  'PDH': 'Previous Daily High: The highest price of the previous trading day.',
  'PDL': 'Previous Daily Low: The lowest price of the previous trading day.',
  'EQ': 'Equilibrium: The 50% level of a price range.',
  'OTE': 'Optimal Trade Entry: A specific Fibonacci retracement zone (usually 61.8% to 78.6%).',
  'SMC': 'Smart Money Concepts: Trading methodologies based on institutional order flow.',
  'ICT': 'Inner Circle Trader: A popular trading methodology focusing on liquidity and time.',
  'BULLISH': 'An expectation that prices will rise.',
  'BEARISH': 'An expectation that prices will fall.',
  'CONSOLIDATION': 'A period where price moves sideways within a range.',
  'BREAKOUT': 'When price moves outside a defined support or resistance level with increased volume.',
  'RETEST': 'When price returns to a broken level of support or resistance to confirm it.',
  'SUPPORT': 'A price level where a downtrend tends to pause due to a concentration of demand.',
  'RESISTANCE': 'A price level where an uptrend tends to pause due to a concentration of supply.',
  'SPREAD': 'The difference between the bid and ask price of a currency pair.',
  'PIP': 'Percentage in Point: The smallest price move that a given exchange rate makes.',
  'PIPS': 'Percentage in Point: The smallest price move that a given exchange rate makes.',
  'LOT': 'A standardized quantity of a financial instrument being traded.',
  'DRAWDOWN': 'The peak-to-trough decline during a specific record period of an investment.',
  'MSS': 'Market Structure Shift: A change in the prevailing trend, similar to CHOCH.',
  'HH': 'Higher High: A peak higher than the previous peak, indicating an uptrend.',
  'HL': 'Higher Low: A trough higher than the previous trough, indicating an uptrend.',
  'LH': 'Lower High: A peak lower than the previous peak, indicating a downtrend.',
  'LL': 'Lower Low: A trough lower than the previous trough, indicating a downtrend.',
  'EMA': 'Exponential Moving Average: A moving average that places a greater weight and significance on the most recent data points.',
  'RSI': 'Relative Strength Index: A momentum oscillator that measures the speed and change of price movements.',
};

interface JargonFormatterProps {
  text: string;
}

const JargonFormatter = memo(function JargonFormatter({ text }: JargonFormatterProps) {
  if (!text) return null;

  try {
    if (typeof text !== 'string') {
      return <span>{String(text)}</span>;
    }

    // Split by words, keeping punctuation and whitespace as separate tokens
    const tokens = text.split(/(\s+|[.,;:()!?"'])/);

    return (
      <span>
        {tokens.map((token, index) => {
          const cleanWord = token.replace(/[^a-zA-Z0-9:]/g, '').toUpperCase();
          const tooltipText = JARGON_MAP[cleanWord];

          if (tooltipText && cleanWord.length > 1) {
            return (
              <span key={index} className="group relative inline-block cursor-help text-gold/90 border-b border-gold/30 border-dotted">
                {token}
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-matte-black border border-gold/30 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl font-sans text-left">
                  {tooltipText}
                </span>
              </span>
            );
          }
          return <span key={index}>{token}</span>;
        })}
      </span>
    );
  } catch (error) {
    console.error("Error formatting jargon:", error);
    return (
      <span className="text-gray-400">
        <span className="text-yellow-500 mr-2">⚠️</span>
        {String(text)}
      </span>
    );
  }
});

export default JargonFormatter;
