from fastapi import APIRouter
from pathlib import Path
import json

router = APIRouter(prefix="/phrases", tags=["Phrases"])

BASE_DIR = Path(__file__).resolve().parent.parent.parent
PHRASES_PATH = BASE_DIR / "media" / "phrases.json"

@router.get("/count")
def get_phrases_count():
    with open(PHRASES_PATH, "r", encoding="utf-8") as f:
        phrases = json.load(f)
    return {"count": len(phrases)}

@router.get("/{index}")
def get_phrase(index: int):
    with open(PHRASES_PATH, "r", encoding="utf-8") as f:
        phrases = json.load(f)

    if 0 <= index < len(phrases):
        return {"phrase": phrases[index]["zh"]}
    return {"error": "Index out of range"}
