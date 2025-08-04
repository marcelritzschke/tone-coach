from fastapi import APIRouter, File, UploadFile

from app.models.response import PitchResponse
from app.services.pitch import analyze_audio

router = APIRouter(prefix="/analyze", tags=["Analyze"])


@router.post("/", response_model=PitchResponse)
async def analyze(file: UploadFile = File(...)):
    """Accept audio file and return pitch curve data."""
    contents = await file.read()  # We have the binary audio data here
    pitch_data = analyze_audio(contents)
    return pitch_data
