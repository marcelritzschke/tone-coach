# Tone Coach

Practise Mandarin tones at the level where they actually go wrong: connected speech.

You get a phrase, hear a native-sounding reading of it, record yourself, and see your
pitch contour against the reference. Unlike a pass/fail pronunciation score, the goal
is to show *what your voice did* — and, from M1 onward, to name the syllable you got
wrong and what to change.

> [!IMPORTANT]
> **17 phrases need a human ear.**
> [`backend/data/phrases.review.md`](backend/data/phrases.review.md) lists every
> place the two grapheme-to-phoneme engines disagreed on a reading, or where tone
> sandhi depends on phrase grouping no library resolves reliably. Until those are
> settled by ear, the app is teaching a handful of readings nobody has verified.
> The corpus is the part of this project a competitor cannot copy — it is worth the
> hour.

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

Early. The plan and its specifications live in [`docs/PLAN.md`](docs/PLAN.md);
[`CLAUDE.md`](CLAUDE.md) carries the decisions and gotchas behind the code.

| | Milestone | State |
| --- | --- | --- |
| M0 | A clone that runs, and a build that stays green | ✅ done |
| M1 | The verdict pipeline — normalise, segment, align, score | next |
| M2 | A chart that shows what the verdict says | |
| M3 | It works on a phone | |
| M4 | Attempt history and weak tone-pair targeting | |

The pitch comparison is still raw hertz on a shared axis, so a 245 Hz reference and a
120 Hz learner never overlap however good the tones are. Speaker normalisation, time
alignment and per-syllable verdicts are M1 — that is the milestone the project exists
for.
