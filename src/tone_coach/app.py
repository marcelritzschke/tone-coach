"""Streamlit app for comparing user-recorded Mandarin tones with a native reference.

This module provides an interface to upload or record reference audio, record user
audio, and visualize pitch curves for comparison.
"""

import plotly.graph_objects as go
import streamlit as st
from audio_processing import extract_pitch, handle_webrtc_recording

# st.title("🎤 ToneCoach Prototype")
# st.write("Compare your Mandarin tones with a native reference.")


st.header("Step 1: Upload or Record Reference Audio")
with st.container(border=True):
    ref_mode = st.selectbox(
        "Choose reference input method:", ["Upload", "Record"], key="ref_mode"
    )
    ref_file = None

    if ref_mode == "Upload":
        ref_file = st.file_uploader(
            "Upload reference .wav", type=["wav"], key="ref_upload"
        )
        # Clear any previous recording
        st.session_state.ref_audio_processor = None
        st.session_state.ref_audio_recorded = None

    elif ref_mode == "Record":
        handle_webrtc_recording(
            key="ref_audio",
            processor_key="ref_audio_processor",
            audio_key="ref_audio_recorded",
            label_prefix="Reference",
        )


st.header("Step 2: Record Your Voice")
with st.container(border=True):
    if "user_audio_recorded" not in st.session_state:
        st.session_state.user_audio_recorded = None

    handle_webrtc_recording(
        key="user_audio",
        processor_key="user_audio_processor",
        audio_key="user_audio_recorded",
        label_prefix="User",
    )


st.header("Step 3: Generate Curves")
with st.container(border=True):
    reference_audio = None
    if "ref_audio_recorded" in st.session_state and st.session_state.ref_audio_recorded:
        reference_audio = st.session_state.ref_audio_recorded
    elif ref_file is not None:
        reference_audio = ref_file.read()

    if not reference_audio:
        st.info("No reference audio available!")
    if not st.session_state.user_audio_recorded:
        st.info("No user recording available!")

    if reference_audio and st.session_state.user_audio_recorded:
        status_placeholder = st.empty()
        status_placeholder.info("Processing both recordings...")

        ref_times, ref_pitch = extract_pitch(reference_audio)
        user_times, user_pitch = extract_pitch(st.session_state.user_audio_recorded)

        # Plot
        fig = go.Figure()
        fig.add_trace(
            go.Scatter(
                x=ref_times,
                y=ref_pitch,
                mode="lines",
                name="Reference",
                line=dict(color="blue"),
            )
        )
        fig.add_trace(
            go.Scatter(
                x=user_times,
                y=user_pitch,
                mode="lines",
                name="Your Recording",
                line=dict(color="red"),
            )
        )
        fig.update_layout(
            title="Pitch Comparison",
            xaxis_title="Time (s)",
            yaxis_title="Pitch (Hz)",
            hovermode="x unified",
        )
        status_placeholder.empty()
        st.plotly_chart(fig, use_container_width=True)
