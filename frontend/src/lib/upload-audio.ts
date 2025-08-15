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

export const fetchTTSAudio = async (
  text: string,
): Promise<{ audioUrl: string; pitchResult: PitchAnalysisResult }> => {
  const response = await fetch(`http://localhost:8000/tts?text=${encodeURIComponent(text)}`);
  if (!response.ok) {
    throw new Error('Failed to fetch TTS audio');
  }
  // console.log(await response.json());
  // const audioBlob = await response.blob();
  // const audioUrl = URL.createObjectURL(audioBlob);
  const data = await response.json();
  console.log('TTS response data:', data);
  const audioUrl = data.audio_url;
  const pitchResult = parsePitchData(data.pitch);
  return { audioUrl, pitchResult };
};
