"""Main entry point for the Tone Coach Backend FastAPI application."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.routes import analyze
from app.routes import tts
from app.routes import phrases


MEDIA_ROOT = Path("media")  # or an absolute path
MEDIA_ROOT.mkdir(exist_ok=True)


app = FastAPI(title="Tone Coach Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000"
    ],  # or ["*"] for all origins (not recommended for production)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/media", StaticFiles(directory=str(MEDIA_ROOT)), name="media")

# Register routes
app.include_router(analyze.router)
app.include_router(tts.router)
app.include_router(phrases.router)
