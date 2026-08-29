from typing import List, Optional
from app.data.data_handler import Candle
from app.engine.feature_engineering import detect_liquidity_sweep, detect_bos, detect_crt_levels

def evaluate_crt_qm(candles: List[Candle]) -> Optional[dict]:
    """
    Evaluates CRT + Quasimodo pattern logic.
    """
    if len(candles) < 10: return None
    
    liquidity_sweep = detect_liquidity_sweep(candles)
    structure_shift = detect_bos(candles)
    levels = detect_crt_levels(candles)
    current_price = candles[-1].close
    
    if liquidity_sweep and structure_shift:
        # Determine direction based on where the sweep happened
        direction = "BUY" if candles[-1].close > candles[-1].open else "SELL"
        
        # Simple risk/reward placement
        sl = candles[-1].low - 0.0010 if direction == "BUY" else candles[-1].high + 0.0010
        tp = current_price + 0.0030 if direction == "BUY" else current_price - 0.0030
        
        return {
            "strategy": "CRT_QM",
            "direction": direction,
            "entry": current_price,
            "stop_loss": sl,
            "take_profit": tp,
            "confidence": 85.0
        }
    return None
