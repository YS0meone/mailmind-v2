import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, contacts, drafts, emails, sync, threads, webhooks
from app.config import settings

# Configure logging — all app loggers print to stdout
logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown


app = FastAPI(
    title="mailmind",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.backend_cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(contacts.router, prefix="/api/v1")
app.include_router(drafts.router, prefix="/api/v1")
app.include_router(threads.router, prefix="/api/v1")
app.include_router(emails.router, prefix="/api/v1")
app.include_router(sync.router, prefix="/api/v1")
app.include_router(webhooks.router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok"}
