"""Access to the annotated phrase corpus.

The corpus is authored offline by ``scripts/build_phrases.py`` and committed. Tones
are data, never recomputed at request time, so a grapheme-to-phoneme mistake is
caught once in review rather than served to a learner on every request.
"""

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel

#: Repository-relative, not process-relative: the server must behave the same
#: whichever directory it was launched from.
_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_CORPUS_PATH = _BACKEND_ROOT / "data" / "phrases.json"


class Syllable(BaseModel):
    """One character: how it is written, and how it is actually said."""

    hanzi: str
    pinyin: str
    citationPinyin: str
    citationTone: int
    surfaceTone: int
    realization: str
    sandhiRule: str | None = None


class Phrase(BaseModel):
    """One practice phrase, with its reading fully resolved at authoring time."""

    id: str
    hanzi: str
    gloss: str
    words: list[str]
    syllables: list[Syllable]
    tonePairs: list[str]
    citationTonePairs: list[str]
    sandhiNotes: list[str]
    needsReview: bool


class CorpusError(RuntimeError):
    """The corpus is missing or malformed."""


def corpus_path() -> Path:
    return Path(os.getenv("TONE_COACH_CORPUS", DEFAULT_CORPUS_PATH))


@lru_cache(maxsize=1)
def load_phrases() -> tuple[Phrase, ...]:
    """Read and validate the corpus once per process."""
    path = corpus_path()
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise CorpusError(
            f"phrase corpus not found at {path}. Run scripts/build_phrases.py to "
            f"generate it, or set TONE_COACH_CORPUS."
        ) from None
    except json.JSONDecodeError as exc:
        raise CorpusError(f"phrase corpus at {path} is not valid JSON: {exc}") from exc

    if not raw:
        raise CorpusError(f"phrase corpus at {path} is empty")
    return tuple(Phrase.model_validate(item) for item in raw)


def get_phrase(phrase_id: str) -> Phrase | None:
    return next((p for p in load_phrases() if p.id == phrase_id), None)
