"""Analysis of a learner's recording."""

from typing import Annotated

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.models.response import PitchResponse
from app.services.audio import DecodeError
from app.services.pitch import PitchError, analyze_audio, voiced_fraction

router = APIRouter(prefix="/analyze", tags=["Analyze"])

#: Practice phrases are a few seconds; anything much larger is a mistake or an abuse.
MAX_UPLOAD_BYTES = 10 * 1024 * 1024


@router.post("", response_model=PitchResponse)
async def analyze(file: Annotated[UploadFile, File()]) -> PitchResponse:
    """Extract the pitch contour of an uploaded recording.

    Accepts whatever the browser produced — WebM/Opus from Chrome and Firefox,
    MP4/AAC from Safari — without a format hint.
    """
    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Recording too large")

    try:
        times, freqs = analyze_audio(contents)
    except DecodeError as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc
    except PitchError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return PitchResponse(
        time=times.tolist(),
        pitch=freqs.tolist(),
        voicedFraction=voiced_fraction(freqs),
    )
