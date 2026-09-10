"""The practice phrase corpus."""

from fastapi import APIRouter, HTTPException

from app.services.corpus import CorpusError, Phrase, get_phrase, load_phrases

router = APIRouter(prefix="/phrases", tags=["Phrases"])


@router.get("", response_model=list[Phrase])
def list_phrases() -> list[Phrase]:
    """Return the whole corpus.

    It is a few hundred kilobytes and changes only when the repository does, so the
    client fetches it once instead of making a round trip per flashcard.
    """
    try:
        return list(load_phrases())
    except CorpusError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/{phrase_id}", response_model=Phrase)
def read_phrase(phrase_id: str) -> Phrase:
    try:
        phrase = get_phrase(phrase_id)
    except CorpusError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    if phrase is None:
        raise HTTPException(status_code=404, detail=f"No phrase with id {phrase_id!r}")
    return phrase
