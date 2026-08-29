from typing import Dict
from pydantic import BaseModel

class PairProfile(BaseModel):
    reversal_score: float = 1.0
    trend_score: float = 1.0
    range_score: float = 1.0
    breakout_score: float = 1.0
    volatility_profile: str = "NORMAL"

# In-memory pair profiles
pair_profiles: Dict[str, PairProfile] = {
    "EURUSD": PairProfile(),
    "GBPUSD": PairProfile(),
    "XAUUSD": PairProfile()
}

def get_pair_profile(pair: str) -> PairProfile:
    if pair not in pair_profiles:
        pair_profiles[pair] = PairProfile()
    return pair_profiles[pair]
