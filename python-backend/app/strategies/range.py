from typing import List, Optional
from app.data.data_handler import Candle
from app.utils.helpers import calculate_rsi

def evaluate_range(candles: List[Candle]) -> Optional[dict]:
    """
    Evaluates Range pattern (RSI extremities).
    """
    if len(candles) < 15: return None
    
    closes = [c.close for c in candles]
    rsi = calculate_rsi(closes)
    current_price = closes[-1]
    atr = 0.0010 # Stub
    
    if rsi < 30:
        return {
            "strategy": "RANGE",
            "direction": "BUY",
            "entry": current_price,
            "stop_loss": current_price - atr,
            "take_profit": current_price + atr * 2,
            "confidence": 70.0
        }
    elif rsi > 70:
        return {
            "strategy": "RANGE",
            "direction": "SELL",
            "entry": current_price,
            "stop_loss": current_price + atr,
            "take_profit": current_price - atr * 2,
            "confidence": 70.0
        }
    return None
