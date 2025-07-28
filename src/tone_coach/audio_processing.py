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
from streamlit_webrtc import WebRtcMode, webrtc_streamer


class AudioProcessor:
    """Processes audio frames for recording and conversion to WAV format."""

    def __init__(self):
        """Initialize the AudioProcessor with an empty list of audio frames."""
        self.frames = []

    def recv_audio(self, frame: av.AudioFrame):
        """Receive an audio frame, convert it to ndarray, and store it."""
        self.frames.append(frame.to_ndarray())
        return frame

    def get_wav_bytes(self):
        """Convert the recorded audio frames to WAV format and return as bytes."""
        if not self.frames:
            return None
        pcm = np.concatenate(self.frames)
        wav_buffer = BytesIO()
        with wave.open(wav_buffer, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(44100)
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
        else:
            st.error(f"No {label_prefix.lower()} audio captured yet.")
    return ctx


def extract_pitch(sound_data):
    """Extract pitch (frequency) values from WAV audio data using Parselmouth.

    Parameters
    ----------
    sound_data : bytes
        WAV audio data as bytes.

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
        frequencies = pitch.selected_array["frequency"]
        valid = ~np.isnan(frequencies)
        return times[valid], frequencies[valid]
    finally:
        # Clean up the temporary file
        import os
        os.remove(tmp_path)
