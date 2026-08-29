def calculate_trade_score(
    liquidity_sweep: bool,
    structure_shift: bool,
    htf_bias_aligned: bool,
    rsi_confirmation: bool,
    volume_confirmation: bool,
    london_ny_session: bool
) -> int:
    score = 0
    if liquidity_sweep: score += 2
    if structure_shift: score += 2
    if htf_bias_aligned: score += 2
    if rsi_confirmation: score += 1
    if volume_confirmation: score += 1
    if london_ny_session: score += 1
    return score

def is_tradable(score: int, min_threshold: int = 6) -> bool:
    return score >= min_threshold
