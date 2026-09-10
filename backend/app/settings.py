"""Runtime configuration.

Every path is resolved from the package location rather than the process working
directory, so the server behaves the same however it was launched. Every value can be
overridden by an environment variable, so nothing needs a code change to deploy.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent


def _env_list(name: str, default: list[str]) -> list[str]:
    raw = os.getenv(name)
    return [item.strip() for item in raw.split(",") if item.strip()] if raw else default


@dataclass(frozen=True)
class Settings:
    """Everything the process needs to know that is not code."""

    #: Where synthesised reference audio is cached. Safe to delete; it refills.
    media_root: Path = field(
        default_factory=lambda: Path(
            os.getenv("TONE_COACH_MEDIA_ROOT", BACKEND_ROOT / "media")
        )
    )
    #: Public path the cache is served under, joined to the audio filename.
    media_url_prefix: str = field(
        default_factory=lambda: os.getenv("TONE_COACH_MEDIA_URL", "/media")
    )
    #: Browser origins permitted to call the API.
    cors_origins: list[str] = field(
        default_factory=lambda: _env_list(
            "TONE_COACH_CORS_ORIGINS", ["http://localhost:3000"]
        )
    )


settings = Settings()
