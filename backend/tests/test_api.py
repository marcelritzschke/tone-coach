import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_health_reports_the_corpus(client):
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["phrases"] >= 100


def test_lists_the_corpus(client):
    response = client.get("/phrases")
    assert response.status_code == 200
    phrases = response.json()
    assert len(phrases) >= 100
    assert {"hanzi", "gloss", "syllables", "tonePairs"} <= phrases[0].keys()


def test_unknown_phrase_is_404_not_a_200_carrying_an_error(client):
    """The old route returned {"error": ...} with status 200, so the client's
    response.ok check passed and the page rendered an undefined phrase."""
    response = client.get("/phrases/nope")
    assert response.status_code == 404


def test_analyze_returns_a_contour(client, level_tone_webm):
    response = client.post(
        "/analyze", files={"file": ("clip.webm", level_tone_webm, "audio/webm")}
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["time"]) == len(body["pitch"])
    assert body["voicedFraction"] > 0.5


def test_analyze_rejects_undecodable_upload(client):
    response = client.post(
        "/analyze", files={"file": ("clip.webm", b"garbage", "audio/webm")}
    )
    assert response.status_code == 415


def test_analyze_rejects_silence_with_a_useful_status(client):
    silence = b"\x00" * 1024
    response = client.post(
        "/analyze", files={"file": ("clip.webm", silence, "audio/webm")}
    )
    assert response.status_code in (415, 422)


def test_reference_text_length_is_bounded(client):
    """The endpoint is unauthenticated; an unbounded text field is unbounded work."""
    response = client.get("/reference", params={"text": "好" * 500})
    assert response.status_code == 422
