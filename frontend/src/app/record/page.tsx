'use client';

import { useState, useRef, useEffect } from 'react';

import ToneChart from '@/components/ToneChart';
import { uploadAudio } from '@/lib/upload-audio';
import { PitchAnalysisResult } from '@/types/pitch';

export default function RecordPage() {
  // Mock phrase deck
  const phrases = [
    { text: '你在干嘛呢？', audio: '/audio/reference1.mp3' },
    { text: '真的吗？', audio: '/audio/reference2.mp3' },
    { text: '好久不见！', audio: '/audio/reference3.mp3' },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const currentPhrase = phrases[currentIndex];

  const referenceAudioRef = useRef<HTMLAudioElement | null>(null);
  const userAudioRef = useRef<HTMLAudioElement | null>(null);
  const [audioPlayTimestamp, setAudioPlayTimestamp] = useState<number | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [userAudioURL, setUserAudioURL] = useState<string | null>(null);
  const [barPosition, setBarPosition] = useState<number | null>(null);
  const [pitchResult, setPitchResult] = useState<PitchAnalysisResult | null>(null);

  useEffect(() => {
    if (userAudioRef.current && audioPlayTimestamp) {
      userAudioRef.current.currentTime = audioPlayTimestamp;
      userAudioRef.current.play();
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

  const nextPhrase = () => setCurrentIndex((prev) => (prev + 1) % phrases.length);
  const prevPhrase = () => setCurrentIndex((prev) => (prev === 0 ? phrases.length - 1 : prev - 1));

  return (
    <>
      <div className="container my-5 text-light">
        {/* Flashcard */}
        <div className="card bg-dark shadow p-4 mb-4">
          <h2 className="mb-3">{currentPhrase.text}</h2>
          <div className="mb-3">
            <audio ref={referenceAudioRef} src={currentPhrase.audio}></audio>
            <button
              className="btn btn-primary me-2"
              onClick={() => referenceAudioRef.current?.play()}
            >
              ▶ Play Original
            </button>
          </div>
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
        {userAudioURL && pitchResult && (
          <ToneChart
            setAudioPlayTimestamp={setAudioPlayTimestamp}
            barPosition={barPosition}
            pitchResult={pitchResult}
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
