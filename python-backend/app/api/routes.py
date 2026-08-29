from fastapi import APIRouter
from app.engine.pair_profile import pair_profiles
from pydantic import BaseModel

router = APIRouter()

class TradeResult(BaseModel):
    pair: str
    strategy: str
    pnl: float
    is_win: bool

@router.get("/status")
async def get_status():
    return {"status": "online", "message": "AMLE Engine is running"}

@router.get("/pairs")
async def get_pairs():
    return {"profiles": pair_profiles}

@router.get("/signals")
async def get_signals():
    # In a real app, query database or in-memory recent signals
    return {"signals": []}

@router.post("/trade-result")
async def post_trade_result(result: TradeResult):
    from app.models.learning_model import update_strategy_weights
    update_strategy_weights(result.pair, result.strategy, result.is_win)
    return {"status": "success", "message": "Weights updated"}
