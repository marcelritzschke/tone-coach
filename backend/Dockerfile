FROM python:3.12-slim

# No ffmpeg, no build toolchain: PyAV and parselmouth both ship manylinux wheels,
# and audio is decoded in process.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    TONE_COACH_MEDIA_ROOT=/app/media

# Dependencies resolve from the lockfile and cache separately from the source, so a
# code change does not reinstall the world.
COPY pyproject.toml uv.lock README.md ./
COPY app/__about__.py app/__about__.py
RUN uv sync --locked --no-install-project --no-dev

COPY app app
COPY data data
COPY scripts scripts
RUN uv sync --locked --no-dev

ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
