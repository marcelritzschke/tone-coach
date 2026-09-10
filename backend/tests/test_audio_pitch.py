import numpy as np
import pytest

from app.services.audio import TARGET_SAMPLE_RATE, DecodeError, decode
from app.services.pitch import PitchError, analyze_audio, extract_pitch, voiced_fraction


def test_decodes_chrome_webm(level_tone_webm):
    samples, rate = decode(level_tone_webm)
    assert rate == TARGET_SAMPLE_RATE
    assert 0.9 < samples.size / rate < 1.1


def test_decodes_safari_mp4(level_tone_mp4):
    """Safari records MP4/AAC, not WebM. The route must not care which arrived."""
    samples, rate = decode(level_tone_mp4)
    assert rate == TARGET_SAMPLE_RATE
    assert 0.9 < samples.size / rate < 1.15


def test_both_browser_formats_decode_to_the_same_length(level_tone_webm, level_tone_mp4):
    webm, _ = decode(level_tone_webm)
    mp4, _ = decode(level_tone_mp4)
    assert abs(webm.size - mp4.size) < TARGET_SAMPLE_RATE * 0.1


@pytest.mark.parametrize("payload", [b"", b"not audio at all"])
def test_rejects_junk(payload):
    with pytest.raises(DecodeError):
        decode(payload)


def test_recovers_a_known_level_pitch(level_tone_webm):
    times, freqs = analyze_audio(level_tone_webm)
    voiced = freqs[freqs > 0]
    assert voiced.size > 50
    assert np.median(voiced) == pytest.approx(200.0, rel=0.03)
    assert times.size == freqs.size


def test_recovers_a_rising_contour(rising_tone_webm):
    """The property the whole product rests on: the contour's direction is real."""
    _, freqs = analyze_audio(rising_tone_webm)
    voiced = freqs[freqs > 0]
    head = np.median(voiced[: voiced.size // 4])
    tail = np.median(voiced[-voiced.size // 4 :])
    assert tail > head + 50


def test_two_pass_bounds_do_not_produce_octave_errors(rising_tone_webm):
    """A jump to double or half the neighbouring frame is the classic tracker failure."""
    _, freqs = analyze_audio(rising_tone_webm)
    voiced = freqs[freqs > 0]
    ratios = voiced[1:] / voiced[:-1]
    assert np.all((ratios > 0.6) & (ratios < 1.7))


def test_silence_is_reported_not_guessed():
    silence = np.zeros(TARGET_SAMPLE_RATE, dtype=np.float32)
    with pytest.raises(PitchError):
        extract_pitch(silence, TARGET_SAMPLE_RATE)


def test_voiced_fraction_flags_a_usable_recording(level_tone_webm):
    _, freqs = analyze_audio(level_tone_webm)
    assert voiced_fraction(freqs) > 0.5
    assert voiced_fraction(np.zeros(10)) == 0.0
