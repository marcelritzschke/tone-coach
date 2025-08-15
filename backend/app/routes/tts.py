from typing import Any
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import FileResponse
import hashlib
import os
from pydub import AudioSegment
import io

from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs
from elevenlabs.core.api_error import ApiError

from app.services.pitch import analyze_tts_audio

MEDIA_FOLDER = "media"

def get_file_name(text: str) -> str:
    hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return f"tts_{hash}.mp3"

def save_audio_to_disk(audio: Any, audio_path: str) -> None:
    os.makedirs(MEDIA_FOLDER, exist_ok=True)
    with open(audio_path, "wb") as f:
        for chunk in audio:
            f.write(chunk)
    # pcm_bytes = b"".join(audio)

    # os.makedirs(MEDIA_FOLDER, exist_ok=True)
    # audio_segment = AudioSegment(
    #     data=pcm_bytes,
    #     sample_width=2,
    #     frame_rate=44100,
    #     channels=1
    # )
    # audio_segment.export(audio_path, format="wav")

router = APIRouter(prefix="/tts", tags=["TTS"])

@router.get("/")
async def tts(text: str = Query(...)):
    # return {
    #     "audio_url": "",
    #     "pitch": ""
    # }

    file_name = get_file_name(text)
    audio_path = os.path.join(MEDIA_FOLDER, file_name)
    if not os.path.exists(audio_path):
        print(f"No audio file found, generating new one for {text} ...")
        # Generate audio using ElevenLabs API (implement this part)
        load_dotenv()
        elevenlabs = ElevenLabs(
            api_key=os.getenv("ELEVENLABS_API_KEY"),
        )

        try:
            audio = elevenlabs.text_to_speech.convert(
                text=text,
                voice_id="pTOe8BQRdydOEIgv0wFL",
                language_code="zh",
                model_id="eleven_turbo_v2_5",
                output_format="mp3_44100_128",
            )
        except ApiError as e:
            print(f"ElevenLabs API error: {e}")
            raise HTTPException(status_code=502, detail=f"ElevenLabs API error: {e}")

        save_audio_to_disk(audio, audio_path)

    else:
        print(f"Return existing audio file {audio_path}.")

    pitch = analyze_tts_audio(audio_path)
    
    return {
        "audio_url": f"http://localhost:8000/{audio_path}",
        "pitch": pitch
    }