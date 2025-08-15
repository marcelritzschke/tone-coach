'use client';

import { useState, useRef, useEffect } from 'react';

import ToneChart from '@/components/ToneChart';
import TextToSpeech from '@/components/TextToSpeech';
import { uploadAudio } from '@/lib/upload-audio';
import { PitchAnalysisResult } from '@/types/pitch';
import { getPhrasesCount, getPhrase } from '@/lib/fetch-phrases';

export default function RecordPage() {
  const [phrasesCount, setPhrasesCount] = useState<number | null>(null);

  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [currentPhrase, setCurrentPhrase] = useState(''); // '你在干嘛呢？'

  const userAudioRef = useRef<HTMLAudioElement | null>(null);
  const referenceAudioRef = useRef<HTMLAudioElement | null>(null);
  const [audioPlayTimestamp, setAudioPlayTimestamp] = useState<number | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<'reference' | 'user'>('user');

  const [isRecording, setIsRecording] = useState(false);
  const [userAudioURL, setUserAudioURL] = useState<string | null>(null);
  const [barPosition, setBarPosition] = useState<number | null>(null);
  const [pitchResult, setPitchResult] = useState<PitchAnalysisResult | null>(null);
  const [pitchResultTTS, setPitchResultTTS] = useState<PitchAnalysisResult | null>(null);

  useEffect(() => {
    const fetchPhrasesCount = async () => {
      try {
        const count = await getPhrasesCount();
        setPhrasesCount(count);
        if (count > 0) {
          setCurrentIndex(0);
        }
      } catch (error) {
        console.error('Error fetching phrases count:', error);
      }
    };
    fetchPhrasesCount();
  }, []);

  useEffect(() => {
    const fetchPhrase = async (index: number) => {
      try {
        const phrase = await getPhrase(index);
        setCurrentPhrase(phrase);
      } catch (error) {
        console.error('Error fetching phrase:', error);
      }
    };
    if (currentIndex !== null) {
      fetchPhrase(currentIndex);
    }
  }, [currentIndex]);

  useEffect(() => {
    if (selectedAudio === 'user') {
      if (userAudioRef.current && audioPlayTimestamp) {
        userAudioRef.current.currentTime = audioPlayTimestamp;
        userAudioRef.current.play();
      }
    } else {
      if (referenceAudioRef.current && audioPlayTimestamp) {
        referenceAudioRef.current.currentTime = audioPlayTimestamp;
        referenceAudioRef.current.play();
      }
    }
  }, [audioPlayTimestamp]);

  const syncVerticalBarWithAudio = (audioElement: any, setBarPosition: (pos: number) => void) => {
    if (!audioElement) return;

    const updateBarPosition = () => {
      if (audioElement.currentTime) {
        setBarPosition(audioElement.currentTime);
      }
    };

    audioElement.addEventListener('timeupdate', updateBarPosition);
    audioElement.addEventListener('ended', () => {});
  };

  useEffect(() => {
    if (userAudioRef.current) {
      syncVerticalBarWithAudio(userAudioRef.current, setBarPosition);
    }
  }, [userAudioURL, userAudioRef]);

  useEffect(() => {
    if (referenceAudioRef.current) {
      syncVerticalBarWithAudio(referenceAudioRef.current, setBarPosition);
    }
  }, [referenceAudioRef]);

  // Recording (simplified mock)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new MediaRecorder(stream, {
      mimeType: 'audio/webm',
    });
    chunksRef.current = [];

    mediaRecorderRef.current.ondataavailable = (e) => chunksRef.current.push(e.data);
    mediaRecorderRef.current.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      setUserAudioURL(URL.createObjectURL(blob));
      // TODO: send blob to FastAPI backend
      console.log('Recording stopped, uploading audio...');
      const pitchResult = await uploadAudio(blob);
      setPitchResult(pitchResult);
    };

    mediaRecorderRef.current.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const nextPhrase = () => {
    phrasesCount && setCurrentIndex((prev) => (prev + 1) % phrasesCount);
  };
  const prevPhrase = () => {
    phrasesCount && setCurrentIndex((prev) => (prev === 0 ? phrasesCount - 1 : prev - 1));
  };

  return (
    <>
      <div className="container my-5 text-light">
        {/* Flashcard */}
        <div className="card bg-dark shadow p-4 mb-4">
          {currentPhrase ? (
            <>
              <h2 className="mb-3">{currentPhrase}</h2>
              <TextToSpeech
                text={currentPhrase}
                setPitchResultTTS={setPitchResultTTS}
                referenceAudioRef={referenceAudioRef}
              />
            </>
          ) : (
            <h2 className="mb-3">Loading phrase...</h2>
          )}
        </div>

        {/* Recording Controls */}
        <div className="card bg-dark shadow p-4 mb-4">
          <h4>Your Turn</h4>
          {!isRecording ? (
            <button className="btn btn-danger me-2" onClick={startRecording}>
              ● Record
            </button>
          ) : (
            <button className="btn btn-warning me-2" onClick={stopRecording}>
              ■ Stop
            </button>
          )}

          {userAudioURL && (
            <div className="mt-3">
              <audio ref={userAudioRef} controls src={userAudioURL}></audio>
            </div>
          )}
        </div>

        {/* Pitch Curve Chart */}
        {userAudioURL && pitchResult && pitchResultTTS && (
          <ToneChart
            setAudioPlayTimestamp={setAudioPlayTimestamp}
            selectedAudio={selectedAudio}
            setSelectedAudio={setSelectedAudio}
            barPosition={barPosition}
            pitchResult={pitchResult}
            pitchResultTTS={pitchResultTTS}
          />
        )}

        {/* Navigation */}
        <div className="d-flex justify-content-between mt-4">
          <button className="btn btn-secondary" onClick={prevPhrase}>
            ← Previous
          </button>
          <button className="btn btn-secondary" onClick={nextPhrase}>
            Next →
          </button>
        </div>
      </div>
    </>
  );
}
