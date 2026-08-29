from typing import List, Optional
from app.data.data_handler import Candle
from app.utils.helpers import calculate_atr

def evaluate_breakout(candles: List[Candle]) -> Optional[dict]:
    """
    Evaluates Breakout pattern.
    """
    if len(candles) < 20: return None
    
    current_candle = candles[-1]
    highs = [c.high for c in candles]
    lows = [c.low for c in candles]
    closes = [c.close for c in candles]
    
    atr = calculate_atr(highs, lows, closes, 14)
    recent_high = max(highs[-10:-1])
    recent_low = min(lows[-10:-1])
    
    if current_candle.close > recent_high and current_candle.volume > 1000:
        return {
            "strategy": "BREAKOUT",
            "direction": "BUY",
            "entry": current_candle.close,
            "stop_loss": recent_low,
            "take_profit": current_candle.close + atr * 3,
            "confidence": 80.0
        }
    elif current_candle.close < recent_low and current_candle.volume > 1000:
        return {
            "strategy": "BREAKOUT",
            "direction": "SELL",
            "entry": current_candle.close,
            "stop_loss": recent_high,
            "take_profit": current_candle.close - atr * 3,
            "confidence": 80.0
        }
    return None
