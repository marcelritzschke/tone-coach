import pytest

from app.services.corpus import get_phrase, load_phrases

TONES = {1, 2, 3, 4, 5}


@pytest.fixture(scope="module")
def phrases():
    return load_phrases()


def test_corpus_is_present_and_populated(phrases):
    assert len(phrases) >= 100


def test_every_syllable_has_a_legal_tone(phrases):
    for phrase in phrases:
        for syllable in phrase.syllables:
            assert syllable.citationTone in TONES, phrase.hanzi
            assert syllable.surfaceTone in TONES, phrase.hanzi


def test_one_syllable_per_character(phrases):
    for phrase in phrases:
        assert len(phrase.syllables) == len(phrase.hanzi), phrase.hanzi


def test_surface_third_tone_never_follows_another():
    """Third-tone sandhi makes a surface 3-3 unreachable in Mandarin.

    If this fails, the sandhi rules in scripts/build_phrases.py have regressed and
    the app is about to teach a tone sequence no native speaker produces.
    """
    for phrase in load_phrases():
        tones = [s.surfaceTone for s in phrase.syllables]
        for first, second in zip(tones, tones[1:], strict=False):
            assert not (first == 3 and second == 3), phrase.hanzi


def test_half_third_marked_only_when_another_syllable_follows(phrases):
    """A tone 3 dips fully only phrase-finally; elsewhere it is a half third."""
    for phrase in phrases:
        syllables = phrase.syllables
        for index, syllable in enumerate(syllables):
            if syllable.surfaceTone != 3:
                continue
            is_final = index == len(syllables) - 1
            expected = "full" if is_final else "half"
            assert syllable.realization == expected, f"{phrase.hanzi} at {index}"


def test_sandhi_examples():
    """The textbook cases, spot-checked end to end."""
    cases = {
        "你好": [2, 3],
        "不客气": [2, 4, 4],
        "一路平安": [2, 4, 2, 1],
    }
    for hanzi, expected in cases.items():
        phrase = next(p for p in load_phrases() if p.hanzi == hanzi)
        assert [s.surfaceTone for s in phrase.syllables] == expected


def test_citation_tones_are_preserved_alongside_surface():
    """The learner needs both: what it is written as, and what it is said as."""
    phrase = next(p for p in load_phrases() if p.hanzi == "你好")
    assert [s.citationTone for s in phrase.syllables] == [3, 3]
    assert [s.surfaceTone for s in phrase.syllables] == [2, 3]


def test_lookup_by_id_round_trips(phrases):
    first = phrases[0]
    assert get_phrase(first.id) == first
    assert get_phrase("does-not-exist") is None
