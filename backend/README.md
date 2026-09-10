# Tone Coach — backend

FastAPI service: decodes a recording, extracts its pitch contour with Praat, and
serves the phrase corpus and reference audio. See the [root README](../README.md) to
run the whole stack.

```bash
uv sync                                  # runtime + dev dependencies
uv run uvicorn app.main:app --reload     # http://localhost:8000
uv run pytest -q
uv run ruff check . && uv run ruff format --check .
uv run mypy
```

`uv sync --extra corpus` additionally installs the g2p libraries, which are needed
only to regenerate `data/phrases.json` and never at runtime.

## Endpoints

| Method | Path              | Purpose                                             |
| ------ | ----------------- | --------------------------------------------------- |
| `GET`  | `/health`         | Liveness, and proof the corpus loads                |
| `GET`  | `/phrases`        | The whole corpus in one request                     |
| `GET`  | `/phrases/{id}`   | One phrase, 404 if unknown                          |
| `GET`  | `/reference?text=`| Reference audio URL plus its pitch contour          |
| `POST` | `/analyze`        | Upload a recording, get its pitch contour           |

## Configuration

| Variable                   | Default                    | Notes                                    |
| -------------------------- | -------------------------- | ---------------------------------------- |
| `TONE_COACH_CORS_ORIGINS`  | `http://localhost:3000`    | Comma separated                          |
| `TONE_COACH_MEDIA_ROOT`    | `backend/media`            | Reference audio cache; safe to delete    |
| `TONE_COACH_MEDIA_URL`     | `/media`                   | Public path the cache is served under    |
| `TONE_COACH_CORPUS`        | `backend/data/phrases.json`| Corpus location                          |
| `TONE_COACH_VOICE_ENGINE`  | `edge-tts`                 | Which `ReferenceVoice` implementation    |
| `TONE_COACH_VOICE`         | `zh-CN-XiaoxiaoNeural`     | Voice within that engine                 |

Paths resolve from the package, not the working directory, so the server behaves the
same however it was launched.

## Two seams worth knowing about

`app/services/voice.py` turns text into audio. `app/services/audio.py` turns encoded
bytes into samples. Neither knows about the other, and neither owns syllable timing —
that lands in `app/services/segment.py` in M1.

Keeping them apart is deliberate. The previous design got both reference audio *and*
syllable timestamps from one vendor, so losing the vendor cost both. The destination
is curated human recordings, which have no timestamps at all, so timing has to be
derived from the audio regardless of where the audio came from.
