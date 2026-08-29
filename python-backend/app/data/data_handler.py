from collections import defaultdict, deque
from typing import Dict, List, Optional
from pydantic import BaseModel

class Candle(BaseModel):
    pair: str
    timeframe: str
    open: float
    high: float
    low: float
    close: float
    volume: float
    timestamp: int

class MarketDataCache:
    def __init__(self, max_candles: int = 1000):
        # A dictionary holding pairs -> timeframe -> deque of candles
        self.data: Dict[str, Dict[str, deque]] = defaultdict(lambda: defaultdict(lambda: deque(maxlen=max_candles)))
        self.latest_tick: Dict[str, float] = {}
        
    def add_candle(self, candle: Candle):
        self.data[candle.pair][candle.timeframe].append(candle)
        self.latest_tick[candle.pair] = candle.close

    def get_candles(self, pair: str, timeframe: str) -> List[Candle]:
        return list(self.data[pair][timeframe])
        
    def get_latest_price(self, pair: str) -> Optional[float]:
        return self.latest_tick.get(pair)

market_data_cache = MarketDataCache()
