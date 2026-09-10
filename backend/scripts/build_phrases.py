"""Build the annotated phrase corpus from the seed sentence list.

Reads ``backend/data/phrases.source.tsv`` (hanzi + gloss), resolves the reading of
every character, applies Mandarin tone sandhi, and writes ``backend/data/phrases.json``.

Tones are authored once here and committed. Nothing downstream recomputes them, so
the accuracy of this script is an authoring concern rather than a runtime risk.

Two independent grapheme-to-phoneme engines are consulted. Neither is trusted on its
own: where they disagree the phrase is written to a review report for a human to
settle, because polyphone errors teach learners the wrong word.

Usage::

    python backend/scripts/build_phrases.py            # build + report
    python backend/scripts/build_phrases.py --report   # report only, no write
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

import jieba
from pypinyin import Style, pinyin

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
SOURCE_PATH = DATA_DIR / "phrases.source.tsv"
OUTPUT_PATH = DATA_DIR / "phrases.json"
REVIEW_PATH = DATA_DIR / "phrases.review.md"

NEUTRAL = 5

#: Characters whose citation tone differs from the reading pypinyin returns in
#: context, because pypinyin bakes their sandhi into its phrase dictionary.
CITATION_OVERRIDES = {"不": 4, "一": 1}

TONE_MARKS = {
    "a": "āáǎà",
    "e": "ēéěè",
    "i": "īíǐì",
    "o": "ōóǒò",
    "u": "ūúǔù",
    "v": "ǖǘǚǜ",
}


@dataclass
class Syllable:
    """One character, with the tone it is written with and the tone it is said with."""

    hanzi: str
    base: str  # pinyin without tone digit, e.g. "ni"
    citation_tone: int  # the dictionary tone
    surface_tone: int = 0  # the tone actually produced, after sandhi
    realization: str = "full"  # "full" | "half" — only meaningful for tone 3
    rule: str | None = None  # which sandhi rule fired, for the UI to explain


@dataclass
class Phrase:
    """One source sentence, fully annotated and ready to serialise."""

    id: str
    hanzi: str
    gloss: str
    syllables: list[Syllable]
    words: list[str]
    notes: list[str] = field(default_factory=list)
    review: list[str] = field(default_factory=list)


def to_tone_mark(base: str, tone: int) -> str:
    """Render numbered pinyin as accented pinyin: ``ni``+3 -> ``nǐ``."""
    if tone == NEUTRAL or tone == 0:
        return base.replace("v", "ü")
    # Standard placement: a/e win; in "ou" the o takes it; otherwise the last vowel.
    if "a" in base:
        target = "a"
    elif "e" in base:
        target = "e"
    elif "ou" in base:
        target = "o"
    else:
        vowels = [c for c in base if c in "aeiouv"]
        if not vowels:
            return base
        target = vowels[-1]
    marked = TONE_MARKS[target][tone - 1]
    return base.replace(target, marked, 1).replace("v", "ü")


def split_reading(reading: str) -> tuple[str, int]:
    """Split ``"hao3"`` into ``("hao", 3)``."""
    if reading and reading[-1].isdigit():
        return reading[:-1], int(reading[-1])
    return reading, NEUTRAL


def read_with_pypinyin(hanzi: str) -> list[tuple[str, int]]:
    rows = pinyin(hanzi, style=Style.TONE3, neutral_tone_with_five=True, heteronym=False)
    return [split_reading(r[0]) for r in rows]


@lru_cache(maxsize=1)
def _g2pm_model() -> Any | None:
    """Load the neural model once, or report that it is unavailable."""
    try:
        from g2pM import G2pM
    except ImportError:
        return None
    return G2pM()


def read_with_g2pm(hanzi: str) -> list[tuple[str, int]] | None:
    """Second opinion. Returns None when g2pM is not installed."""
    model = _g2pm_model()
    if model is None:
        return None
    return [split_reading(r) for r in model(hanzi, tone=True, char_split=True)]


def apply_sandhi(sylls: list[Syllable]) -> list[str]:
    """Fill in ``surface_tone``, ``realization`` and ``rule``. Returns phrase notes.

    Rules, applied in this order:

    1. ``一`` becomes tone 2 before a tone 4, tone 4 before tones 1-3, else tone 1.
    2. ``不`` becomes tone 2 before a tone 4, else tone 4.
    3. In a run of tone-3 syllables, every one but the last becomes tone 2.
    4. A surviving tone 3 followed by any other tone is a half-third: it falls low
       and stops, with no rise. Only a phrase-final tone 3 gets the full dip.

    Rule 4 is the one that matters most for scoring: expecting a dip on every tone 3
    would mark correct connected speech as wrong.
    """
    notes: list[str] = []
    n = len(sylls)
    for s in sylls:
        s.surface_tone = s.citation_tone

    # Rules 1 and 2 read the citation tone of the following syllable.
    for i, s in enumerate(sylls):
        nxt = sylls[i + 1].citation_tone if i + 1 < n else None
        if s.hanzi == "一" and nxt is not None:
            s.surface_tone = 2 if nxt == 4 else 4
            s.rule = "yi-sandhi"
            notes.append(f"一 → tone {s.surface_tone} before tone {nxt}")
        elif s.hanzi == "不" and nxt is not None:
            s.surface_tone = 2 if nxt == 4 else 4
            if s.surface_tone != 4:
                s.rule = "bu-sandhi"
                notes.append("不 → tone 2 before tone 4")

    # Rule 3: maximal runs of tone 3.
    i = 0
    while i < n:
        if sylls[i].surface_tone != 3:
            i += 1
            continue
        j = i
        while j + 1 < n and sylls[j + 1].surface_tone == 3:
            j += 1
        run = j - i + 1
        if run >= 2:
            for k in range(i, j):
                sylls[k].surface_tone = 2
                sylls[k].rule = "third-tone-sandhi"
            word = "".join(s.hanzi for s in sylls[i : j + 1])
            notes.append(f"third-tone sandhi across {word}")
        i = j + 1

    # Rule 4: half-third.
    for i, s in enumerate(sylls):
        if s.surface_tone == 3:
            following = sylls[i + 1].surface_tone if i + 1 < n else None
            s.realization = "half" if following is not None else "full"

    return notes


def build_phrase(index: int, hanzi: str, gloss: str) -> Phrase:
    primary = read_with_pypinyin(hanzi)
    secondary = read_with_g2pm(hanzi)

    sylls: list[Syllable] = []
    review: list[str] = []

    for pos, (char, (base, tone)) in enumerate(zip(hanzi, primary, strict=False)):
        citation = CITATION_OVERRIDES.get(char, tone)
        sylls.append(Syllable(hanzi=char, base=base, citation_tone=citation))

        if secondary and pos < len(secondary):
            alt_base, alt_tone = secondary[pos]
            # 不 and 一 differ by design: pypinyin reports the sandhi form and g2pM the
            # citation form. That is not a disagreement about the reading, and putting
            # it in the review queue would bury the real conflicts in noise.
            expected_split = char in CITATION_OVERRIDES and alt_base == base
            if (alt_base, alt_tone) != (base, tone) and not expected_split:
                review.append(
                    f"{char} (position {pos + 1}): pypinyin says {base}{tone}, "
                    f"g2pM says {alt_base}{alt_tone}"
                )

    notes = apply_sandhi(sylls)

    # Runs of three or more tone 3 are grouping-dependent; a human must confirm.
    run = 0
    for s in sylls:
        run = run + 1 if s.citation_tone == 3 else 0
        if run >= 3:
            review.append(
                "three or more consecutive tone-3 syllables — the correct sandhi "
                "depends on how the phrase groups, confirm by ear"
            )
            break

    return Phrase(
        id=f"p{index:03d}",
        hanzi=hanzi,
        gloss=gloss,
        syllables=sylls,
        words=[w for w in jieba.cut(hanzi) if w.strip()],
        notes=notes,
        review=review,
    )


def serialize(p: Phrase) -> dict:
    return {
        "id": p.id,
        "hanzi": p.hanzi,
        "gloss": p.gloss,
        "words": p.words,
        "syllables": [
            {
                "hanzi": s.hanzi,
                "pinyin": to_tone_mark(s.base, s.surface_tone),
                "citationPinyin": to_tone_mark(s.base, s.citation_tone),
                "citationTone": s.citation_tone,
                "surfaceTone": s.surface_tone,
                "realization": s.realization,
                "sandhiRule": s.rule,
            }
            for s in p.syllables
        ],
        # Surface pairs are what the learner must actually produce. Citation pairs are
        # what they think they are producing, and are the right unit for drilling
        # sandhi: a 3-3 citation pair is exactly the case where the two diverge.
        "tonePairs": [
            f"{a.surface_tone}-{b.surface_tone}"
            for a, b in zip(p.syllables, p.syllables[1:], strict=False)
        ],
        "citationTonePairs": [
            f"{a.citation_tone}-{b.citation_tone}"
            for a, b in zip(p.syllables, p.syllables[1:], strict=False)
        ],
        "sandhiNotes": p.notes,
        "needsReview": bool(p.review),
    }


def load_source() -> list[tuple[str, str]]:
    rows = []
    for line in SOURCE_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        hanzi, _, gloss = line.partition("\t")
        if not gloss:
            print(f"skipping malformed line: {line!r}", file=sys.stderr)
            continue
        rows.append((hanzi.strip(), gloss.strip()))
    return rows


def write_review(phrases: list[Phrase]) -> int:
    flagged = [p for p in phrases if p.review]
    lines = [
        "# Phrase corpus review queue",
        "",
        "Generated by `backend/scripts/build_phrases.py`. Every entry below is a place "
        "where the two grapheme-to-phoneme engines disagreed, or where tone sandhi "
        "depends on phrase grouping that no library resolves reliably.",
        "",
        f"**{len(flagged)} of {len(phrases)} phrases need a human ear.**",
        "",
    ]
    for p in flagged:
        lines.append(f"## {p.id} · {p.hanzi} — {p.gloss}")
        lines.append("")
        for r in p.review:
            lines.append(f"- {r}")
        lines.append("")
    REVIEW_PATH.write_text("\n".join(lines), encoding="utf-8")
    return len(flagged)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--report", action="store_true", help="print the report, write nothing"
    )
    args = ap.parse_args()

    jieba.setLogLevel(60)
    rows = load_source()
    phrases = [build_phrase(i + 1, h, g) for i, (h, g) in enumerate(rows)]

    serialized = [serialize(p) for p in phrases]
    surface = {t for p in serialized for t in p["tonePairs"]}
    citation = {t for p in serialized for t in p["citationTonePairs"]}
    flagged = sum(1 for p in phrases if p.review)
    sandhi = sum(1 for p in phrases if p.notes)

    print(f"phrases:          {len(phrases)}")
    print(f"syllables:        {sum(len(p.syllables) for p in phrases)}")
    print(f"surface pairs:    {len(surface)} of 24 reachable")
    print(f"citation pairs:   {len(citation)} of 25")
    print(f"with sandhi:      {sandhi}")
    print(f"needing review:   {flagged}")

    # A surface 3-3 is unreachable in Mandarin: third-tone sandhi always turns the
    # first of the pair into a 2. Seeing one means the sandhi rules regressed.
    if "3-3" in surface:
        print("\nERROR: surface tone pair 3-3 exists — third-tone sandhi is broken.")
        return 1

    if args.report:
        return 0

    OUTPUT_PATH.write_text(
        json.dumps([serialize(p) for p in phrases], ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    n = write_review(phrases)
    print(f"\nwrote {OUTPUT_PATH.relative_to(DATA_DIR.parent)}")
    print(f"wrote {REVIEW_PATH.relative_to(DATA_DIR.parent)} ({n} entries)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
