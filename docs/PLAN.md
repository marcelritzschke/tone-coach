# Tone Coach — plan

From a pitch plot to a verdict: the app should stop drawing two curves and start
naming the syllable you got wrong and what to change about it.

Milestones are ordered. Each ends in something demonstrable, so progress is visible
without reading the diff.

---

## Definition of done for the prototype

- [x] `git clone` then one command brings up both services — no manual steps, no
      missing files, no system packages, no API key.
- [x] CI is green: `next build`, `tsc`, `eslint`, `ruff`, `pytest`.
- [x] The practice screen shows hanzi, pinyin with tone marks, and a gloss.
- [ ] You record, and within a second you see your contour *and* the reference on one
      semitone axis, time-aligned, overlapping.
- [ ] Under the chart, one line per syllable, in words: *"干 gàn — target 4th tone,
      falling. You rose. Start higher and drop."*
- [ ] Tapping a syllable plays that slice of either recording.
- [ ] It works on an iPhone, in Safari, held at arm's length.
- [x] The signal-processing path has tests against audio fixtures with known tones.

---

## The architecture that makes this feasible

Reference audio and syllable timing are **two separate problems**, behind two seams:

| Seam | Module | Contract |
| --- | --- | --- |
| `ReferenceVoice` | `backend/app/services/voice.py` | text in, audio out |
| `SyllableSegmenter` | `backend/app/services/segment.py` *(M1)* | audio + syllable count in, boundaries out |

An earlier draft of this plan got both from one vendor's timestamped TTS endpoint, so
losing the vendor cost both. The split is not tidiness: the destination is curated
human recordings, and those carry no timestamps at all, so timing has to be derived
from the audio no matter where the audio came from.

Segmentation is tractable because the syllable count is known from the corpus. Score
each frame as a boundary candidate from its intensity dip and voicing discontinuity,
then choose the best N−1 splits by dynamic programming under a syllable-duration
prior.

---

## M0 — a clone that runs, and a build that stays green ✅

- [x] Commit the phrase corpus with real per-syllable tone data.
- [x] Fix the TypeScript errors so `next build` passes; add CI.
- [x] Move to `uv` with a committed lockfile.
- [x] Replace hardcoded API origins with configuration.
- [x] `compose.yaml` and a root README.
- [x] Swap ElevenLabs for keyless edge-tts behind `ReferenceVoice`.
- [x] Delete the dead code rather than leaving it commented.

Pulled forward from M1, because M0's own gate needs them: PyAV decoding (which
removes the undeclared ffmpeg dependency) and two-pass Praat pitch bounds.

**Gate:** clone on a machine with no ffmpeg, run one command, record, see a chart. ✅

---

## M1 — the verdict pipeline

All backend, all testable without a browser. This is the point of the project.

- [x] Decode with PyAV — container-agnostic bytes to a mono numpy array.
- [x] Two-pass pitch: find the speaker's range, then track bounded to that speaker.
- [ ] **Normalise.** `st = 12 * log2(f / median_voiced_f)`, unvoiced as NaN, keeping
      the median so the axis can still be labelled in hertz. Without this a 245 Hz
      reference and a 120 Hz learner never overlap however good the tones are.
- [ ] **Segment the reference** — the `SyllableSegmenter` seam above. Validate
      against a hand-labelled set of twenty phrases before building on it.
- [ ] **Align.** DTW over the two semitone contours, Sakoe–Chiba band of ±25%.
      Interpolate voiceless gaps under 60 ms, break longer ones. At roughly 200×200
      cells a hand-rolled implementation runs in single-digit milliseconds.
- [ ] **Project the boundaries** through the warping path onto the learner's timeline.
- [ ] **Score** — two numbers per syllable, see below.

**Gate:** `pytest` over fixture recordings, one correct and one with a deliberately
wrong third tone, asserting the wrong syllable is the one flagged.

**First task, and it needs a human ear:** synthesise twenty phrases and hand-label
the syllable boundaries in Praat or Audacity. That set is the fixture the segmenter
is built against and the input to every threshold below.

---

## M2 — a chart that shows what the verdict says

- [ ] Replace Chart.js with a hand-drawn SVG using `d3-scale`. Semitone y-axis,
      gridlines at 0 and ±6.
- [ ] Syllable bands tinted by verdict, labelled with hanzi and pinyin.
- [ ] Both contours on the same normalised scale, so they genuinely overlap.
- [ ] Playhead driven by `requestAnimationFrame` reading `audio.currentTime`.
- [ ] Click a band to play that syllable from either recording.
- [ ] The verdict list under the chart, in plain language.
- [ ] Render tests. The M0 crash — a bare `null` where Chart.js expected a point —
      compiled, linted and built clean, and only failed in front of a human.

Chart.js is being replaced because the chart *is* the product. The playhead already
needed a custom plugin and a `@ts-ignore`; syllable bands, alignment ribbons and a
live trace each fight it harder.

**Gate:** record a phrase with one tone deliberately wrong. That band is the only red
one, its sentence names the error, and tapping it plays your version then the
reference.

---

## M3 — it works on a phone

- [x] Negotiate the recording format instead of hardcoding `audio/webm`.
- [x] Release the microphone tracks on stop.
- [x] Guard seek positions on null rather than truthiness, so second 0 is reachable.
- [ ] Lay the practice screen out for one hand: big record button, chart above the
      fold, verdicts scrollable underneath.
- [ ] Drop `bg-dark text-light` so the theme switcher works on the page that matters.
- [ ] Measure the round trip. Budget: under 800 ms from stop to verdict.

**Gate:** a full practice loop on a real iPhone over the local network.

---

## M4 — a reason to open it again tomorrow

- [ ] Persist every attempt: phrase, syllable, target tone, deviation, verdict.
      SQLite is plenty; key on a browser-local id until there are accounts.
- [ ] Roll it into a profile over **tone pairs**, not tones. Learners fail at specific
      transitions — tone 2 after tone 4, and tone 3 before tone 3 — and undirected
      drilling never finds them. The corpus already ships `citationTonePairs`, which
      is the right unit for drilling sandhi.
- [ ] Weight phrase selection toward the worst pairs.
- [ ] A progress view: the pairs coloured by mean deviation, improving over time.

**Gate:** deliberately fluff every tone-3 pair for ten phrases; the app starts serving
those phrases and the grid shows that pair as weakest.

---

## Specifications

### Scoring — two numbers per syllable

**Deviation** is RMS difference in semitones between the learner's warped contour and
the reference over that syllable. This is the truthful measure, and because it is
computed against the reference rather than an idealised shape, sandhi and
coarticulation are handled for free.

**Verdict** is a named shape error, used only to *explain* a high deviation in words.
Take `onset` as the mean of the first 20% of the syllable, `offset` as the mean of the
last 20%, `net = offset − onset`, and `level` as the mean within the speaker's range.

| Target | Expected | Passes when | Typical error → what you say |
| --- | --- | --- | --- |
| T1 ˥ | high, level | \|net\| ≤ 1.5 st, level in top third | net < −2 → "you let it drop; hold it flat and high" |
| T2 ˧˥ | rising | net ≥ +2.5 st | net ≈ 0 → "flat, not rising; carry it upward" |
| T3 full ˨˩˦ | low, dips and returns — **phrase-final only** | level in bottom third, dip ≥ 1.5 st | net < −3 → "that was a 4th tone; stay low and come back up" |
| T3 half ˨˩ | low fall, **no** rise — before any non-T3 | level in bottom third, −3 ≤ net ≤ 0 | rises at the end → "don't lift it back up here" |
| T4 ˥˩ | falling, sharp | net ≤ −3.5 st | −3.5 < net < −1 → "too shallow; start higher, drop further" |
| T5 · | short, unstressed | duration below phrase mean | over-long → "don't give this one a tone" |

The half-third split is load-bearing. A tone 3 before any non-tone-3 falls low without
rising; expecting a dip everywhere would mark correct connected speech as wrong. Which
variant applies is deterministic from the following syllable and is already decided in
the corpus (`realization: "full" | "half"`).

Thresholds are a starting point from the phonetics, not from users. Calibrate against
the twenty-clip set and commit those as fixtures.

### `POST /analyze` response, once M1 lands

```json
{
  "reference":  { "times": [], "semitones": [], "medianHz": 208.4 },
  "user":       { "times": [], "semitones": [], "medianHz": 116.2 },
  "warpedUser": [],
  "syllables": [
    {
      "index": 0, "hanzi": "你", "pinyin": "nǐ", "targetTone": 2,
      "refStart": 0.0, "refEnd": 0.31, "userStart": 0.04, "userEnd": 0.4,
      "deviationSt": 1.2, "verdict": "ok", "message": "Good rise."
    }
  ],
  "overall": { "score": 78, "worstSyllable": 2, "tempoRatio": 1.18 }
}
```

`tempoRatio` matters more than it looks. DTW warps time away, so a learner with
correct tones at the wrong rhythm scores perfectly on deviation. Reporting the warp
separately keeps that honest.

---

## Risks

| Risk | Mitigation |
| --- | --- |
| Syllables with voiced onsets don't split — 你好 breaks on the voiceless *h*, 我们 may not | Knowing there are exactly N syllables forces a split on the intensity dip alone. Hand-label twenty phrases and measure; past ~30 ms error, switch to `torchaudio.pipelines.MMS_FA` behind the same seam. |
| DTW hides rhythm errors | Report `tempoRatio` separately and cap the warping band at ±25%. |
| Thresholds are guesses | Record the twenty-clip calibration set *before* writing the classifier. |
| Phone mics in real rooms | Below ~40% voiced, tell the learner it was too noisy instead of scoring it. `voicedFraction` already ships for this. |
| TTS mispronounces the phrase, teaching a wrong tone | Run the classifier over the reference itself and quarantine any phrase whose synthesised contour disagrees with the corpus. Runs in CI. |
| edge-tts is an unofficial client and could break | The `ReferenceVoice` seam, plus a permanent per-phrase cache: an outage degrades to "no new phrases", not "app down". |
