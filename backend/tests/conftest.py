import io

import av
import numpy as np
import pytest

SAMPLE_RATE = 48_000


def synth(f0_start: float, f0_end: float = None, seconds: float = 1.0) -> np.ndarray:
    """A voice-like tone, optionally gliding from one pitch to another.

    A sine alone is a poor test signal: Praat's autocorrelation tracker is built for
    speech, so the fixture carries harmonics and a fade to look like a voiced vowel.
    """
    f0_end = f0_start if f0_end is None else f0_end
    t = np.linspace(0, seconds, int(SAMPLE_RATE * seconds), endpoint=False)
    freq = np.linspace(f0_start, f0_end, t.size)
    phase = 2 * np.pi * np.cumsum(freq) / SAMPLE_RATE
    wave = sum(np.sin(phase * n) / n for n in (1, 2, 3, 4))
    envelope = np.minimum(1.0, np.minimum(t, seconds - t) * 20)
    return (0.5 * wave / np.max(np.abs(wave)) * envelope).astype(np.float32)


def encode(samples: np.ndarray, fmt: str, codec: str) -> bytes:
    """Wrap samples in a real container, the way a browser upload arrives."""
    buffer = io.BytesIO()
    with av.open(buffer, mode="w", format=fmt) as container:
        stream = container.add_stream(codec, rate=SAMPLE_RATE, layout="mono")
        resampler = av.AudioResampler(
            format=stream.format.name, layout="mono", rate=SAMPLE_RATE
        )
        source = av.AudioFrame.from_ndarray(
            samples.reshape(1, -1), format="flt", layout="mono"
        )
        source.sample_rate = SAMPLE_RATE
        for frame in resampler.resample(source):
            frame.pts = None
            for packet in stream.encode(frame):
                container.mux(packet)
        for packet in stream.encode(None):
            container.mux(packet)
    return buffer.getvalue()


@pytest.fixture(scope="session")
def level_tone_webm() -> bytes:
    """A steady 200 Hz tone in Chrome's recording format."""
    return encode(synth(200.0), "webm", "libopus")


@pytest.fixture(scope="session")
def level_tone_mp4() -> bytes:
    """The same tone in Safari's recording format."""
    return encode(synth(200.0), "mp4", "aac")


@pytest.fixture(scope="session")
def rising_tone_webm() -> bytes:
    """A rise from 150 Hz to 260 Hz, the shape of a second tone."""
    return encode(synth(150.0, 260.0), "webm", "libopus")
