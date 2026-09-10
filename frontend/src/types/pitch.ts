/** A pitch contour as the API returns it: parallel arrays, 0 Hz where unvoiced. */
export interface PitchResponse {
  time: number[];
  pitch: number[];
  /** Share of frames carrying pitch. Low values mean the recording was too noisy. */
  voicedFraction: number;
}

export interface PitchFrame {
  /** Seconds from the start of the recording. */
  time: number;
  /** Hertz, or 0 when the frame is unvoiced. */
  pitch: number;
}

export interface PitchContour {
  frames: PitchFrame[];
  voicedFraction: number;
}

/** How a tone 3 is actually produced: a full dip only at the end of a phrase. */
export type Realization = 'full' | 'half';

export interface Syllable {
  hanzi: string;
  /** Pinyin for the tone actually produced, after sandhi. */
  pinyin: string;
  /** Pinyin for the tone the character is written with. */
  citationPinyin: string;
  citationTone: number;
  surfaceTone: number;
  realization: Realization;
  sandhiRule: string | null;
}

export interface Phrase {
  id: string;
  hanzi: string;
  gloss: string;
  words: string[];
  syllables: Syllable[];
  tonePairs: string[];
  citationTonePairs: string[];
  sandhiNotes: string[];
  needsReview: boolean;
}

export interface Reference {
  audioUrl: string;
  contour: PitchContour;
}
