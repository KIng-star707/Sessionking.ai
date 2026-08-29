from fastapi import FastAPI
from contextlib import asynccontextmanager
import asyncio

from app.core.config import settings
from app.core.logger import logger
from app.api.routes import router
from app.data.websocket_client import ingest_market_data

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up AMLE Engine...")
    # Start background websocket client
    task = asyncio.create_task(ingest_market_data(settings.MARKET_DATA_WS_URL))
    yield
    logger.info("Shutting down AMLE Engine...")
    task.cancel()

app = FastAPI(title=settings.PROJECT_NAME, version=settings.VERSION, lifespan=lifespan)

app.include_router(router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {"message": "Adaptive Multi-Model Liquidity Engine API"}
