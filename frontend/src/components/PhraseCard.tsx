import type { Phrase, Syllable } from '@/types/pitch';

const TONE_NAMES: Record<number, string> = {
  1: 'high level',
  2: 'rising',
  3: 'low dipping',
  4: 'falling',
  5: 'neutral',
};

function toneLabel(syllable: Syllable): string {
  const name = TONE_NAMES[syllable.surfaceTone] ?? 'unknown';
  if (syllable.surfaceTone === 3 && syllable.realization === 'half') {
    return 'low, no rise';
  }
  return name;
}

/**
 * The phrase under practice: characters, the reading, and what each tone should do.
 *
 * A syllable whose written tone differs from its spoken tone is marked, because that
 * gap is the thing learners are never taught and the reference audio proves.
 */
export default function PhraseCard({ phrase }: { phrase: Phrase }) {
  return (
    <div className="card shadow-sm p-4 mb-4">
      <div className="d-flex flex-wrap gap-3 mb-3">
        {phrase.syllables.map((syllable, index) => {
          const shifted = syllable.surfaceTone !== syllable.citationTone;
          return (
            <div key={index} className="text-center">
              <div style={{ fontSize: '2.5rem', lineHeight: 1.1 }}>{syllable.hanzi}</div>
              <div className="fw-semibold">{syllable.pinyin}</div>
              <div className="small text-body-secondary">{toneLabel(syllable)}</div>
              {shifted && (
                <div className="badge text-bg-warning mt-1 fw-normal">
                  written {syllable.citationPinyin}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mb-0 text-body-secondary fst-italic">{phrase.gloss}</p>

      {phrase.sandhiNotes.length > 0 && (
        <ul className="mt-3 mb-0 small text-body-secondary">
          {phrase.sandhiNotes.map((note, index) => (
            <li key={index}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
