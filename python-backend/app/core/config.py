from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Adaptive Multi-Model Liquidity Engine (AMLE)"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    WS_PATH: str = "/ws"
    
    # Risk Management Config
    MAX_RISK_PER_TRADE_PERCENT: float = 1.0 # Max 1% per trade
    MIN_RISK_REWARD_RATIO: float = 2.0
    
    # Data source config
    MARKET_DATA_WS_URL: str = "wss://mock-market-data.example.com"
    
    class Config:
        case_sensitive = True

settings = Settings()
