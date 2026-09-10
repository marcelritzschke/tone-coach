'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Formats to try, best first.
 *
 * Chrome and Firefox record WebM/Opus; Safari records MP4/AAC and throws if handed a
 * WebM MIME type. The backend decodes whatever arrives, so the only job here is to
 * pick something the browser will actually accept.
 */
const CANDIDATE_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return CANDIDATE_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

export interface Recorder {
  isRecording: boolean;
  isSupported: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

/**
 * Microphone recording, with the stream released when it is no longer in use.
 *
 * Leaving the tracks live keeps the browser's recording indicator lit after the user
 * has pressed stop, which reads as the app still listening.
 */
export function useRecorder(onComplete: (blob: Blob) => void): Recorder {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const onCompleteRef = useRef(onComplete);

  // Keep the latest callback without making it a dependency of start().
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const release = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(() => release, [release]);

  const start = useCallback(async () => {
    setError(null);
    const mimeType = pickMimeType();
    if (!mimeType) {
      setError('This browser cannot record audio.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        release();
        setIsRecording(false);
        if (blob.size > 0) onCompleteRef.current(blob);
      };

      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      release();
      setIsRecording(false);
      setError('Microphone access was denied. Allow it and try again.');
    }
  }, [release]);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  return {
    isRecording,
    isSupported: typeof MediaRecorder !== 'undefined',
    error,
    start,
    stop,
  };
}
