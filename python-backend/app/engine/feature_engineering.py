from typing import List
from app.data.data_handler import Candle
from app.utils.helpers import calculate_ema, calculate_rsi, calculate_atr

def detect_higher_highs_lows(candles: List[Candle]) -> str:
    if len(candles) < 4:
        return "NEUTRAL"
    close_prices = [c.close for c in candles]
    if close_prices[-1] > close_prices[-2] and close_prices[-2] > close_prices[-3]:
        return "BULLISH"
    elif close_prices[-1] < close_prices[-2] and close_prices[-2] < close_prices[-3]:
        return "BEARISH"
    return "NEUTRAL"

def detect_bos(candles: List[Candle]) -> bool:
    # Break of Structure simplification: current close breaks recent high/low significantly
    if len(candles) < 10: return False
    recent_high = max([c.high for c in candles[-10:-1]])
    return candles[-1].close > recent_high * 1.0005 # simple threshold

def detect_choch(candles: List[Candle]) -> bool:
    # Change of character (simplified)
    if len(candles) < 10: return False
    recent_low = min([c.low for c in candles[-10:-1]])
    return candles[-1].close < recent_low * 0.9995

def detect_liquidity_sweep(candles: List[Candle]) -> bool:
    if len(candles) < 5: return False
    # Wick goes below recent low but closes inside range
    recent_low = min([c.low for c in candles[-5:-1]])
    current_candle = candles[-1]
    return current_candle.low < recent_low and current_candle.close > recent_low

def calculate_volatility(candles: List[Candle]) -> str:
    if len(candles) < 15: return "NORMAL"
    highs = [c.high for c in candles]
    lows = [c.low for c in candles]
    closes = [c.close for c in candles]
    atr = calculate_atr(highs, lows, closes, 14)
    # Simple threshold, normally dynamically calculated based on historical ATR
    if atr < 0.0005: return "LOW"
    elif atr > 0.0020: return "HIGH"
    return "NORMAL"

def detect_crt_levels(candles: List[Candle]) -> dict:
    if len(candles) < 2: return {}
    prev_candle = candles[-2]
    return {
        "crt_high": prev_candle.high,
        "crt_low": prev_candle.low,
        "crt_mid": (prev_candle.high + prev_candle.low) / 2
    }
