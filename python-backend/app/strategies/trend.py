from typing import List, Optional
from app.data.data_handler import Candle
from app.utils.helpers import calculate_ema

def evaluate_trend(candles: List[Candle]) -> Optional[dict]:
    """
    Evaluates Trend pattern (EMA crossovers).
    """
    if len(candles) < 200: return None
    
    closes = [c.close for c in candles]
    ema_50 = calculate_ema(closes, 50)
    ema_200 = calculate_ema(closes, 200)
    current_price = closes[-1]
    
    if ema_50 > ema_200 and current_price > ema_50:
        return {
            "strategy": "TREND",
            "direction": "BUY",
            "entry": current_price,
            "stop_loss": ema_200,
            "take_profit": current_price + (current_price - ema_200) * 2,
            "confidence": 75.0
        }
    elif ema_50 < ema_200 and current_price < ema_50:
        return {
            "strategy": "TREND",
            "direction": "SELL",
            "entry": current_price,
            "stop_loss": ema_200,
            "take_profit": current_price - (ema_200 - current_price) * 2,
            "confidence": 75.0
        }
    return None
