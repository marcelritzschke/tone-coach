export interface PitchFrame {
  time: number; // Time in seconds
  pitch: number; // Pitch in Hz (0 means unvoiced)
}

export interface PitchAnalysisResult {
  frames: PitchFrame[]; // Combined (time + pitch per frame)
  message: string;
}
