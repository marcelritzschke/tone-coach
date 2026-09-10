"""Audio decoding.

Decodes whatever the browser recorded into the mono float array Praat wants, in
process. Chrome and Firefox produce WebM/Opus; Safari produces MP4/AAC. Neither the
route nor the analysis needs to know which.

This replaces a pydub round trip that shelled out to an ffmpeg binary and wrote the
samples to a temporary WAV file for Praat to read back. That binary was an undeclared
system dependency, and the temp file has already caused one Windows-specific bug.
"""

from __future__ import annotations

import io

import av
import numpy as np

#: Praat's autocorrelation pitch tracker is insensitive to sample rate well above the
#: voice range; 16 kHz keeps the resample cheap without touching f0 accuracy.
TARGET_SAMPLE_RATE = 16_000


class DecodeError(ValueError):
    """The bytes could not be decoded as audio."""


def decode(data: bytes) -> tuple[np.ndarray, int]:
    """Decode encoded audio to mono float32 in ``[-1, 1]``.

    Returns the samples and their sample rate. The container and codec are detected
    from the bytes, so callers never pass a format hint.
    """
    if not data:
        raise DecodeError("no audio data")

    try:
        with av.open(io.BytesIO(data), mode="r") as container:
            if not container.streams.audio:
                raise DecodeError("file contains no audio stream")
            stream = container.streams.audio[0]
            resampler = av.AudioResampler(
                format="fltp", layout="mono", rate=TARGET_SAMPLE_RATE
            )
            blocks: list[np.ndarray] = []
            for frame in container.decode(stream):
                for resampled in resampler.resample(frame):
                    blocks.append(resampled.to_ndarray()[0])
            # The resampler buffers; flush it or the tail of the clip is lost.
            for resampled in resampler.resample(None):
                blocks.append(resampled.to_ndarray()[0])
    except DecodeError:
        raise
    except Exception as exc:
        raise DecodeError(f"could not decode audio: {exc}") from exc

    if not blocks:
        raise DecodeError("decoded to zero samples")

    samples = np.concatenate(blocks).astype(np.float32)
    return samples, TARGET_SAMPLE_RATE
