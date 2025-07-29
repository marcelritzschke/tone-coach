"""Audio processing utilities for Tone Coach.

This module provides classes and functions for recording, processing,
and analyzing audio, including pitch extraction and WebRTC integration.
"""

import tempfile
import wave
from io import BytesIO

import av
import numpy as np
import parselmouth
import streamlit as st
from pydub import AudioSegment
from streamlit_webrtc import WebRtcMode, webrtc_streamer

SAMPLE_RATE_FOR_ANALYZE = 44100
NUM_CHANNELS_FOR_ANALYZE = 1


class AudioProcessor:
    """Processes audio frames for recording and conversion to WAV format."""

    def __init__(self):
        """Initialize the AudioProcessor with an empty list of audio frames."""
        self.reset()

    def reset(self):
        """Reset the stored audio frames to an empty list."""
        self.frames = []
        self.sample_width = None
        self.frame_rate = None
        self.channels = None

    def recv_audio(self, frame: av.AudioFrame):
        """Receive an audio frame, convert it to ndarray, and store it."""
        frame_data = frame.to_ndarray()
        new_sample_width = frame.format.bytes
        new_frame_rate = frame.sample_rate
        new_channels = len(frame.layout.channels)

        audio_segment = AudioSegment(
            data=frame_data.tobytes(),
            sample_width=new_sample_width,
            frame_rate=new_frame_rate,
            channels=new_channels,
        )
        mono_audio = audio_segment.set_channels(
            NUM_CHANNELS_FOR_ANALYZE
        ).set_frame_rate(SAMPLE_RATE_FOR_ANALYZE)

        if mono_audio.raw_data is not None:
            self.frames.append(np.frombuffer(mono_audio.raw_data, dtype=np.int16))
        else:
            print("Warning: mono_audio.raw_data is None and will be skipped.")

        if self.sample_width is not None and self.sample_width != new_sample_width:
            print(
                f"Warning: sample_width changed from {self.sample_width} "
                f"to {new_sample_width}"
            )
        if self.frame_rate is not None and self.frame_rate != new_frame_rate:
            print(
                f"Warning: frame_rate changed from {self.frame_rate} "
                f"to {new_frame_rate}"
            )
        if self.channels is not None and self.channels != new_channels:
            print(f"Warning: channels changed from {self.channels} to {new_channels}")

        self.sample_width = new_sample_width
        self.frame_rate = new_frame_rate
        self.channels = new_channels
        return frame

    def get_wav_bytes(self):
        """Convert the recorded audio frames to WAV format and return as bytes."""
        if not self.frames:
            return None

        pcm = np.concatenate(self.frames)

        wav_buffer = BytesIO()
        with wave.open(wav_buffer, "wb") as wf:
            wf.setnchannels(NUM_CHANNELS_FOR_ANALYZE)
            wf.setsampwidth(self.sample_width or 2)
            wf.setframerate(SAMPLE_RATE_FOR_ANALYZE)
            wf.writeframes(pcm.tobytes())

        return wav_buffer.getvalue()


def handle_webrtc_recording(key, processor_key, audio_key, label_prefix=""):
    """Handle audio recording via WebRTC and store the result in Streamlit sess state.

    Parameters
    ----------
    key : str
        Unique key for the webrtc_streamer component.
    processor_key : str
        Session state key for the AudioProcessor instance.
    audio_key : str
        Session state key to store the recorded WAV audio bytes.
    label_prefix : str, optional
        Prefix for UI labels and messages (default is "").

    Returns
    -------
    ctx : streamlit_webrtc.WebRtcStreamerContext
        The context object for the WebRTC streamer.

    """
    if processor_key not in st.session_state or st.session_state[processor_key] is None:
        st.session_state[processor_key] = AudioProcessor()
    ctx = webrtc_streamer(
        key=key,
        mode=WebRtcMode.SENDONLY,
        audio_receiver_size=256,
        media_stream_constraints={"audio": True, "video": False},
        audio_frame_callback=st.session_state[processor_key].recv_audio,
    )
    if ctx.state.playing:
        st.info(f"Recording {label_prefix}... click STOP when done.")
    elif ctx.state.playing is False and st.session_state[processor_key]:
        wav_data = st.session_state[processor_key].get_wav_bytes()
        if wav_data:
            st.session_state[audio_key] = wav_data
            st.success(f"{label_prefix} recording saved!")
            st.session_state[processor_key].reset()
        else:
            st.error(f"No {label_prefix.lower()} audio captured yet.")
    return ctx


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


def extract_pitch(sound_data, filter=False):
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
        tmp.write(sound_data)
        tmp.flush()
        tmp_path = tmp.name
    try:
        sound = parselmouth.Sound(tmp_path)
        pitch = sound.to_pitch_ac()
        times = pitch.xs()
        freqs = pitch.selected_array["frequency"]
        sampling_rate = times[1] - times[0]

        if filter:
            times, freqs = filter_unvoiced_frames(times, freqs)
            times, freqs = filter_outlier_frames(times, freqs)
            times, freqs = add_gaps(times, freqs, gap_threshold=sampling_rate)
            freqs = smooth_curve(freqs, window=1)

        return times, freqs
    finally:
        # Clean up the temporary file
        import os

        os.remove(tmp_path)
