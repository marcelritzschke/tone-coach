import React, { RefObject, useEffect, useState } from 'react';

import { fetchTTSAudio } from '@/lib/upload-audio';
import { PitchAnalysisResult } from '@/types/pitch';

interface TextToSpeechProps {
  text: string;
  setPitchResultTTS: React.Dispatch<React.SetStateAction<PitchAnalysisResult | null>>;
  referenceAudioRef: RefObject<HTMLAudioElement | null>;
}

const TextToSpeech: React.FC<TextToSpeechProps> = ({
  text,
  setPitchResultTTS,
  referenceAudioRef,
}) => {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!text) return;
    setAudioUrl(null);

    fetchTTSAudio(text)
      .then((res) => {
        setAudioUrl(res.audioUrl);
        setPitchResultTTS(res.pitchResult);
      })
      .catch((error) => {
        console.error('Error fetching TTS audio:', error);
      });
  }, [text]);

  useEffect(() => {
    console.log('AudioUrl result updated:', audioUrl);
  }, [audioUrl]);

  if (!audioUrl) return <div>Loading audio...</div>;

  return (
    <audio ref={referenceAudioRef} controls src={audioUrl}>
      Your browser does not support the audio element.
    </audio>
  );
};

export default TextToSpeech;
