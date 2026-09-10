"""Main entry point for the Tone Coach backend."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routes import analyze, phrases, reference
from app.services.corpus import CorpusError, load_phrases
from app.settings import settings

app = FastAPI(title="Tone Coach Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

settings.media_root.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=settings.media_root), name="media")

app.include_router(analyze.router)
app.include_router(reference.router)
app.include_router(phrases.router)


@app.get("/health", tags=["Health"])
def health() -> dict[str, object]:
    """Liveness probe that also proves the corpus is loadable.

    A missing or malformed corpus is the failure that previously surfaced as a 500 on
    the first flashcard. Surfacing it here means a container reports itself unhealthy
    instead of looking fine until someone tries to practise.
    """
    try:
        count = len(load_phrases())
    except CorpusError as exc:
        return {"status": "degraded", "corpus": str(exc)}
    return {"status": "ok", "phrases": count}
