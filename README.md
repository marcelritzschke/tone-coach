# Tone Coach

Practise Mandarin tones at the level where they actually go wrong: connected speech.

You get a phrase, hear a native-sounding reading of it, record yourself, and see your
pitch contour against the reference. Unlike a pass/fail pronunciation score, the goal
is to show *what your voice did* — and, from M1 onward, to name the syllable you got
wrong and what to change.

## Run it

```bash
docker compose up
```

Then open <http://localhost:3000>. There is no ffmpeg to install and no API key to
obtain: audio is decoded in process by PyAV, and reference speech comes from the
keyless `edge-tts` voices.

## Run it without Docker

```bash
# backend — http://localhost:8000
cd backend && uv sync && uv run uvicorn app.main:app --reload

# frontend — http://localhost:3000
cd frontend && npm ci && npm run dev
```

## Layout

| Path                          | What it is                                              |
| ----------------------------- | ------------------------------------------------------- |
| `backend/app/services/`       | Audio decoding, pitch extraction, the voice seam, corpus |
| `backend/data/phrases.json`   | The annotated corpus — the spine of the whole project    |
| `backend/scripts/`            | Corpus authoring, run offline and committed              |
| `frontend/src/app/record/`    | The practice screen                                      |

## The phrase corpus

`backend/data/phrases.json` carries, per syllable, both the tone the character is
*written* with and the tone it is actually *said* with. Those differ whenever tone
sandhi applies, and that gap is a large part of what the app exists to teach.

Tones are resolved once, offline, and committed — never recomputed at request time —
so a grapheme-to-phoneme mistake is caught in review rather than served to a learner.

To change the corpus, edit `backend/data/phrases.source.tsv` and rebuild:

```bash
cd backend && uv sync --extra corpus && uv run python scripts/build_phrases.py
```

The generator consults two independent g2p engines and writes every disagreement to
`backend/data/phrases.review.md`. **Those entries need a human ear** — neither engine
is reliable enough to trust unattended, and CI enforces that the committed corpus
matches what the generator produces.

## Status

M0 is complete: the project builds, runs from a clean clone, and is covered by tests
and CI. The pitch comparison is still raw hertz on a shared axis, which is why two
different voices do not overlap even when the tones are correct. Speaker
normalisation, time alignment and per-syllable verdicts are M1.
