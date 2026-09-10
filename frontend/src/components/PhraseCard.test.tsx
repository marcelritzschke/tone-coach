import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import PhraseCard from './PhraseCard';
import type { Phrase, Syllable } from '@/types/pitch';

function syllable(overrides: Partial<Syllable> & Pick<Syllable, 'hanzi'>): Syllable {
  return {
    pinyin: 'ni',
    citationPinyin: 'ni',
    citationTone: 1,
    surfaceTone: 1,
    realization: 'full',
    sandhiRule: null,
    ...overrides,
  };
}

function phrase(syllables: Syllable[], sandhiNotes: string[] = []): Phrase {
  return {
    id: 'p001',
    hanzi: syllables.map((s) => s.hanzi).join(''),
    gloss: 'Hello',
    words: [],
    syllables,
    tonePairs: [],
    citationTonePairs: [],
    sandhiNotes,
    needsReview: false,
  };
}

describe('PhraseCard', () => {
  it('flags a syllable whose spoken tone differs from its written one', () => {
    // 你好: 你 is written nǐ but said ní. That gap is the thing the app teaches.
    render(
      <PhraseCard
        phrase={phrase([
          syllable({
            hanzi: '你',
            pinyin: 'ní',
            citationPinyin: 'nǐ',
            citationTone: 3,
            surfaceTone: 2,
            sandhiRule: 'third-tone-sandhi',
          }),
          syllable({ hanzi: '好', pinyin: 'hǎo', citationPinyin: 'hǎo', citationTone: 3, surfaceTone: 3 }),
        ])}
      />,
    );

    expect(screen.getByText('written nǐ')).toBeInTheDocument();
    expect(screen.getByText('ní')).toBeInTheDocument();
  });

  it('leaves a syllable unmarked when nothing shifted', () => {
    render(<PhraseCard phrase={phrase([syllable({ hanzi: '好' })])} />);
    expect(screen.queryByText(/^written /)).not.toBeInTheDocument();
  });

  it('describes a half third as low with no rise, not as dipping', () => {
    // Telling a learner to dip here would teach a contour no native speaker uses.
    render(
      <PhraseCard
        phrase={phrase([
          syllable({ hanzi: '很', citationTone: 3, surfaceTone: 3, realization: 'half' }),
        ])}
      />,
    );
    expect(screen.getByText('low, no rise')).toBeInTheDocument();
    expect(screen.queryByText('low dipping')).not.toBeInTheDocument();
  });

  it('describes a phrase-final third tone as dipping', () => {
    render(
      <PhraseCard
        phrase={phrase([
          syllable({ hanzi: '好', citationTone: 3, surfaceTone: 3, realization: 'full' }),
        ])}
      />,
    );
    expect(screen.getByText('low dipping')).toBeInTheDocument();
  });

  it('shows the sandhi notes that explain the shift', () => {
    render(
      <PhraseCard
        phrase={phrase([syllable({ hanzi: '你' })], ['third-tone sandhi across 你好'])}
      />,
    );
    expect(screen.getByText('third-tone sandhi across 你好')).toBeInTheDocument();
  });
});
