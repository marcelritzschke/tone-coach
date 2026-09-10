"""Pitch extraction.

Wraps Praat, via parselmouth, to turn decoded samples into an f0 contour.

Normalisation, alignment and scoring are deliberately not here — they belong to the
analysis layer built in M1. This module answers one question: what was the
fundamental frequency at each moment?
"""

from __future__ import annotations

import numpy as np
import parselmouth

from app.services.audio import decode

#: Praat frame rate. 10 ms is the usual choice for prosody work: fine enough to see a
#: tone contour turn, coarse enough that a syllable is still tens of frames.
TIME_STEP = 0.01

#: Bounds for the first pass. Wide enough for any adult speaker of either sex; the
#: second pass narrows to the individual, which is what stops octave errors.
COARSE_FLOOR = 60.0
COARSE_CEILING = 600.0


class PitchError(ValueError):
    """The audio could not be pitch-tracked."""


def _track(sound: parselmouth.Sound, floor: float, ceiling: float) -> np.ndarray:
    pitch = sound.to_pitch_ac(
        time_step=TIME_STEP, pitch_floor=floor, pitch_ceiling=ceiling
    )
    return np.asarray(pitch.selected_array["frequency"], dtype=np.float64)


def extract_pitch(samples: np.ndarray, sample_rate: int) -> tuple[np.ndarray, np.ndarray]:
    """Return ``(times, frequencies)`` in seconds and hertz, 0 Hz where unvoiced.

    Two passes. The first finds the speaker's range with Praat's default-ish wide
    bounds; the second re-runs bounded to that speaker. Praat's own guidance is that
    a range fitted to the voice removes most octave jumps, which is the failure the
    original code tried to clean up afterwards with a median filter.
    """
    if samples.size == 0:
        raise PitchError("no samples to analyse")

    sound = parselmouth.Sound(samples.astype(np.float64), sampling_frequency=sample_rate)

    coarse = _track(sound, COARSE_FLOOR, COARSE_CEILING)
    voiced = coarse[coarse > 0]
    if voiced.size == 0:
        raise PitchError(
            "no voiced frames detected — the recording may be silent or noisy"
        )

    q25, q75 = np.percentile(voiced, [25, 75])
    floor = max(COARSE_FLOOR, 0.75 * q25)
    ceiling = min(COARSE_CEILING, 1.5 * q75)
    # A near-monotone speaker can collapse the two bounds; Praat needs headroom.
    if ceiling <= floor * 1.5:
        floor, ceiling = COARSE_FLOOR, COARSE_CEILING

    freqs = _track(sound, floor, ceiling)
    times = np.arange(freqs.size, dtype=np.float64) * TIME_STEP
    return times, freqs


def voiced_fraction(freqs: np.ndarray) -> float:
    """Share of frames carrying pitch. Low values mean noise, not speech."""
    return float(np.count_nonzero(freqs > 0) / freqs.size) if freqs.size else 0.0


def analyze_audio(data: bytes) -> tuple[np.ndarray, np.ndarray]:
    """Decode encoded audio of any browser format and extract its pitch contour."""
    samples, sample_rate = decode(data)
    return extract_pitch(samples, sample_rate)
