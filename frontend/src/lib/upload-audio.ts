import { PitchFrame, PitchAnalysisResult } from '@/types/pitch';

const parsePitchData = (data: any): PitchAnalysisResult => {
  const frames: PitchFrame[] = data.time.map((t: number, index: number) => ({
    time: t,
    pitch: data.pitch[index],
  }));

  return {
    frames,
    message: data.message || 'Pitch analysis result',
  };
};

export const uploadAudio = async (blob: Blob): Promise<PitchAnalysisResult> => {
  const formData = new FormData();
  formData.append('file', blob, 'recording.wav');

  const response = await fetch('http://localhost:8000/analyze', {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  const pitchResult = parsePitchData(data);

  console.log('Parsed pitch data:', pitchResult);

  return pitchResult;
};
