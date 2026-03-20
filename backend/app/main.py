from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from dotenv import load_dotenv

# Ensure backend/.env is loaded before any module-level settings are instantiated.
load_dotenv()

from app.models.base import Base
import app.models  # noqa: F401
from app.routes.auth import router as auth_router
from app.routes.dev import router as dev_router
from app.routes.health import router as health_router
from app.routes.chats import router as chats_router
from app.utils.db import engine
import logging

logger = logging.getLogger(__name__)

app = FastAPI(
    title="DataChat AI API",
    version="0.1.0",
    description="Backend service for DataChat AI by Codezista.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TEMP: allow all origins for debugging
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(health_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(chats_router, prefix="/api")
app.include_router(dev_router, prefix="/api")


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)


@app.on_event("shutdown")
def on_shutdown() -> None:
    # Helps avoid lingering DB sockets/resources between restarts.
    try:
        engine.dispose()
    except Exception:
        logger.exception("Failed to dispose SQLAlchemy engine on shutdown.")
