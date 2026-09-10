"""Reference audio for a phrase.

Synthesis is content-addressed: the filename is a hash of the text, so each phrase is
rendered once ever and every later request is a disk read. That cache is the one part
of the original ElevenLabs route worth keeping, and it is what makes an outage in the
voice engine degrade to "no new phrases" rather than "app down".
"""

import hashlib
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

from app.models.response import PitchResponse, ReferenceResponse
from app.services.pitch import PitchError, analyze_audio, voiced_fraction
from app.services.voice import VoiceError, get_voice
from app.settings import settings

router = APIRouter(prefix="/reference", tags=["Reference"])

#: Bounds the work a single unauthenticated request can cause.
MAX_TEXT_LENGTH = 60


def cache_path(text: str, suffix: str) -> Path:
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return settings.media_root / f"tts_{digest}.{suffix}"


@router.get("", response_model=ReferenceResponse)
async def reference(text: str = Query(..., min_length=1, max_length=MAX_TEXT_LENGTH)):
    """Return a URL for the phrase's reference audio, with its pitch contour."""
    voice = get_voice()
    path = cache_path(text, voice.audio_format)

    if not path.exists():
        try:
            audio = await voice.synthesize(text)
        except VoiceError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        settings.media_root.mkdir(parents=True, exist_ok=True)
        # Write via a temporary name so a crash mid-write cannot poison the cache.
        tmp = path.with_suffix(path.suffix + ".part")
        tmp.write_bytes(audio)
        tmp.replace(path)

    try:
        times, freqs = analyze_audio(path.read_bytes())
    except PitchError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return ReferenceResponse(
        audioUrl=f"{settings.media_url_prefix}/{path.name}",
        pitch=PitchResponse(
            time=times.tolist(),
            pitch=freqs.tolist(),
            voicedFraction=voiced_fraction(freqs),
        ),
    )
