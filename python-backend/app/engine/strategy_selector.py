from typing import List, Dict, Any
from app.data.data_handler import Candle
from app.engine.market_regime import detect_market_regime
from app.engine.pair_profile import get_pair_profile
from app.core.logger import logger

def select_strategy(pair: str, candles: List[Candle]) -> str:
    """
    Selects the best strategy based on market regime and pair profile.
    """
    regime = detect_market_regime(candles)
    profile = get_pair_profile(pair)
    
    logger.info(f"[{pair}] Detected Regime: {regime}")
    
    # Calculate weighted scores based on regime and profile
    strategy_scores = {
        "CRT_QM": profile.reversal_score * (2.0 if regime == "MANIPULATION" else 0.5),
        "TREND": profile.trend_score * (2.0 if regime == "TREND" else 0.5),
        "RANGE": profile.range_score * (2.0 if regime == "RANGE" else 0.5),
        "BREAKOUT": profile.breakout_score * (2.0 if regime == "BREAKOUT" else 0.5)
    }
    
    # Find the strategy with the highest score
    best_strategy = max(strategy_scores.items(), key=lambda item: item[1])
    
    # If the score is too low (e.g., < 1.0), it might not be worth taking a trade
    if best_strategy[1] < 1.0 or regime == "UNKNOWN":
        return "UNKNOWN"
        
    selected = best_strategy[0]
    
    logger.info(f"[{pair}] Selected Strategy: {selected} (Score: {best_strategy[1]:.2f})")
    
    return selected
