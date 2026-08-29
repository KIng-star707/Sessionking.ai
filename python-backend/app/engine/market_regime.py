from typing import List
from app.data.data_handler import Candle
from app.engine.feature_engineering import calculate_volatility, detect_liquidity_sweep, detect_higher_highs_lows
from app.utils.helpers import calculate_adx, detect_volume_spike

def detect_market_regime(candles: List[Candle]) -> str:
    """
    Detects the current market regime based on simple heuristics.
    Regimes: TREND, RANGE, MANIPULATION, BREAKOUT, UNKNOWN
    """
    if len(candles) < 30:
        return "UNKNOWN"
        
    volatility = calculate_volatility(candles)
    structure = detect_higher_highs_lows(candles)
    liquidity_sweep = detect_liquidity_sweep(candles)
    
    highs = [c.high for c in candles]
    lows = [c.low for c in candles]
    closes = [c.close for c in candles]
    volumes = [c.volume for c in candles]
    
    adx_value = calculate_adx(highs, lows, closes, 14)
    volume_spike = detect_volume_spike(volumes, 20)
    
    is_trending_structure = structure in ["BULLISH", "BEARISH"]

    # Market Regime Logic using ADX, ATR (via volatility classification), and Volume Spikes
    if liquidity_sweep and (volume_spike or volatility == "HIGH"):
        return "MANIPULATION"
    elif volatility == "HIGH" and volume_spike and not liquidity_sweep:
        return "BREAKOUT"
    elif adx_value > 25 and is_trending_structure:
        return "TREND"
    elif adx_value < 20 or (volatility == "LOW" and not is_trending_structure):
        return "RANGE"
        
    return "UNKNOWN" # Default when mixed signals
