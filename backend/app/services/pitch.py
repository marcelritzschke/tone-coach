import tempfile
from io import BytesIO

import numpy as np
import parselmouth
from pydub import AudioSegment

from app.models.response import PitchResponse

SAMPLE_RATE_FOR_ANALYZE = 44100
NUM_CHANNELS_FOR_ANALYZE = 1


def filter_unvoiced_frames(times, freqs):
    valid = (~np.isnan(freqs)) & (freqs > 0)
    return times[valid], freqs[valid]


def filter_outlier_frames(times, freqs):
    if len(freqs) == 0:
        return times, freqs

    median_pitch = np.median(freqs)
    max_allowed = median_pitch * 2  # Allow up to 2x (next octave)
    min_allowed = median_pitch / 2  # Allow up to 1/2x (previous octave)
    valid = (freqs < max_allowed) & (freqs > min_allowed)

    return times[valid], freqs[valid]


def smooth_curve(freqs, window=5):
    if window > 1 and len(freqs) >= window:
        return np.convolve(freqs, np.ones(window) / window, mode="same")
    else:
        return freqs


def add_gaps(times, freqs, gap_threshold=0.01):
    new_times = [times[0]]
    new_freqs = [freqs[0]]
    for i in range(1, len(times)):
        if times[i] - times[i - 1] > gap_threshold + 1e-5:
            # Insert NaN to break line
            new_times.append(times[i])
            new_freqs.append(np.nan)
        new_times.append(times[i])
        new_freqs.append(freqs[i])
    return new_times, new_freqs


def extract_pitch(audio_file: AudioSegment, filter=False):
    """Extract pitch (frequency) values from WAV audio data using Parselmouth.

    Parameters
    ----------
    sound_data : bytes
        WAV audio data as bytes.
    filter : bool, optional
        Whether to filter unvoiced and outlier frames and smooth the pitch curve.

    Returns
    -------
    tuple of np.ndarray
        Tuple containing times (in seconds) and corresponding frequency values (in Hz).

    """
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        audio_file.export(tmp.name, format="wav")
        tmp_path = tmp.name
    try:
        sound = parselmouth.Sound(tmp_path)
        pitch = sound.to_pitch_ac()
        times = pitch.xs().tolist()
        freqs = pitch.selected_array["frequency"].tolist()
        # sampling_rate = times[1] - times[0]

        # if filter:
        #     times, freqs = filter_unvoiced_frames(times, freqs)
        #     times, freqs = filter_outlier_frames(times, freqs)
        #     times, freqs = add_gaps(times, freqs, gap_threshold=sampling_rate)
        #     freqs = smooth_curve(freqs, window=1)

        return times, freqs
    finally:
        # Clean up the temporary file
        import os

        os.remove(tmp_path)


def analyze_audio(audio_bytes: bytes) -> PitchResponse:
    """Use Parselmouth to extract pitch curve."""
    audio = AudioSegment.from_file(BytesIO(audio_bytes), format="webm")
    audio = audio.set_channels(NUM_CHANNELS_FOR_ANALYZE)
    audio = audio.set_frame_rate(SAMPLE_RATE_FOR_ANALYZE)
    audio = audio.set_sample_width(2)  # 16-bit PCM

    times, pitch = extract_pitch(audio)

    return PitchResponse(
        time=times,
        pitch=pitch,
        message="Pitch analysis successful (mock data).",
    )
