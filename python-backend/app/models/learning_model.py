from app.engine.pair_profile import get_pair_profile

def update_strategy_weights(pair: str, strategy: str, is_win: bool):
    """
    Simple online learning mechanism to adjust weights.
    """
    profile = get_pair_profile(pair)
    adjustment = 0.05 if is_win else -0.02
    
    if strategy == "CRT_QM":
        profile.reversal_score = max(0.1, min(2.0, profile.reversal_score + adjustment))
    elif strategy == "TREND":
        profile.trend_score = max(0.1, min(2.0, profile.trend_score + adjustment))
    elif strategy == "RANGE":
        profile.range_score = max(0.1, min(2.0, profile.range_score + adjustment))
    elif strategy == "BREAKOUT":
        profile.breakout_score = max(0.1, min(2.0, profile.breakout_score + adjustment))
