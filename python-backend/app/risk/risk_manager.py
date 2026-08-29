def calculate_lot_size(account_balance: float, risk_percent: float, entry: float, stop_loss: float) -> float:
    risk_amount = account_balance * (risk_percent / 100)
    points_at_risk = abs(entry - stop_loss) * 100000 # Standard fore pip conversion
    if points_at_risk == 0: return 0.0
    return round(risk_amount / points_at_risk, 2)
    
def validate_risk_reward(entry: float, stop_loss: float, take_profit: float, min_rr: float = 2.0) -> bool:
    risk = abs(entry - stop_loss)
    reward = abs(take_profit - entry)
    if risk == 0: return False
    return (reward / risk) >= min_rr
