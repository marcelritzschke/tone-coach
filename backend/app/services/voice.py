"""Reference audio synthesis.

The app needs a native-sounding rendering of each phrase to compare the learner
against. Which engine produces it is deliberately not the caller's concern: the
destination is curated human recordings, and a swap to those should not touch
anything but this module.

Timing is *not* part of this interface. Syllable boundaries come from
:mod:`app.services.segment`, which works the same on synthesised and human audio.
Coupling the two to one vendor is what made the previous ElevenLabs dependency
load-bearing.
"""

from __future__ import annotations

import os
from typing import Protocol, runtime_checkable

DEFAULT_VOICE = "zh-CN-XiaoxiaoNeural"


@runtime_checkable
class ReferenceVoice(Protocol):
    """Text in, audio bytes out."""

    #: Container of the returned bytes, e.g. ``"mp3"``. Decoding is PyAV's problem.
    audio_format: str

    async def synthesize(self, text: str) -> bytes:
        """Render ``text`` to audio. Raises :class:`VoiceError` on failure."""
        ...


class VoiceError(RuntimeError):
    """The engine could not produce audio for this text."""


class EdgeTTSVoice:
    """Microsoft Edge read-aloud voices, via the ``edge-tts`` client.

    Free and keyless, with eight zh-CN neural voices. It is an unofficial client for
    an undocumented endpoint, which is acceptable for a prototype and is why this
    class sits behind :class:`ReferenceVoice` rather than being called directly.
    """

    audio_format = "mp3"

    def __init__(self, voice: str = DEFAULT_VOICE) -> None:
        """Select which of the zh-CN neural voices to render with."""
        self.voice = voice

    async def synthesize(self, text: str) -> bytes:
        """Render ``text`` to MP3 bytes."""
        import edge_tts

        try:
            communicate = edge_tts.Communicate(text, self.voice)
            chunks = [
                chunk["data"]
                async for chunk in communicate.stream()
                if chunk["type"] == "audio"
            ]
        except Exception as exc:  # the client raises a wide range of transport errors
            raise VoiceError(f"edge-tts failed for {text!r}: {exc}") from exc

        if not chunks:
            raise VoiceError(f"edge-tts returned no audio for {text!r}")
        return b"".join(chunks)


_ENGINES = {"edge-tts": EdgeTTSVoice}


def get_voice() -> ReferenceVoice:
    """Build the configured engine. Override with ``TONE_COACH_VOICE_ENGINE``."""
    name = os.getenv("TONE_COACH_VOICE_ENGINE", "edge-tts")
    try:
        engine = _ENGINES[name]
    except KeyError:
        raise VoiceError(
            f"unknown voice engine {name!r}; available: {', '.join(sorted(_ENGINES))}"
        ) from None
    return engine(os.getenv("TONE_COACH_VOICE", DEFAULT_VOICE))
