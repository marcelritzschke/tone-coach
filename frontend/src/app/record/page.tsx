'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import PhraseCard from '@/components/PhraseCard';
import ToneChart from '@/components/ToneChart';
import { analyzeRecording, fetchPhrases, fetchReference } from '@/lib/api';
import { useRecorder } from '@/lib/use-recorder';
import type { Phrase, PitchContour, Reference } from '@/types/pitch';

type Status = 'idle' | 'loading' | 'analyzing' | 'ready';

export default function RecordPage() {
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [index, setIndex] = useState(0);
  const [reference, setReference] = useState<Reference | null>(null);
  const [userContour, setUserContour] = useState<PitchContour | null>(null);
  const [userAudioUrl, setUserAudioUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);

  const userAudioRef = useRef<HTMLAudioElement | null>(null);
  const referenceAudioRef = useRef<HTMLAudioElement | null>(null);

  const phrase = phrases[index] ?? null;

  useEffect(() => {
    const controller = new AbortController();
    fetchPhrases(controller.signal)
      .then((loaded) => {
        setPhrases(loaded);
        setStatus('idle');
      })
      .catch((cause: Error) => {
        if (controller.signal.aborted) return;
        setError(cause.message);
        setStatus('idle');
      });
    return () => controller.abort();
  }, []);

  // Reset per-attempt state and load the new reference whenever the phrase changes.
  useEffect(() => {
    if (!phrase) return;
    const controller = new AbortController();

    setReference(null);
    setUserContour(null);
    setError(null);

    fetchReference(phrase.hanzi, controller.signal)
      .then(setReference)
      .catch((cause: Error) => {
        if (!controller.signal.aborted) setError(cause.message);
      });

    return () => controller.abort();
  }, [phrase]);

  // Object URLs are leaked memory until explicitly revoked.
  useEffect(() => {
    return () => {
      if (userAudioUrl) URL.revokeObjectURL(userAudioUrl);
    };
  }, [userAudioUrl]);

  const handleRecording = useCallback(async (blob: Blob) => {
    setStatus('analyzing');
    setError(null);
    setUserAudioUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(blob);
    });
    try {
      setUserContour(await analyzeRecording(blob));
      setStatus('ready');
    } catch (cause) {
      setError((cause as Error).message);
      setStatus('idle');
    }
  }, []);

  const recorder = useRecorder(handleRecording);

  const seek = useCallback((seconds: number, which: 'reference' | 'user') => {
    const element = which === 'reference' ? referenceAudioRef.current : userAudioRef.current;
    if (!element) return;
    // Guard on null, not on truthiness: second 0 is a legitimate position.
    element.currentTime = Math.max(0, seconds);
    void element.play();
  }, []);

  const step = (delta: number) => {
    if (phrases.length === 0) return;
    setIndex((current) => (current + delta + phrases.length) % phrases.length);
  };

  if (status === 'loading') {
    return <p className="text-center my-5">Loading phrases…</p>;
  }

  if (!phrase) {
    return (
      <div className="alert alert-danger my-5">
        <h5>No practice phrases available</h5>
        <p className="mb-0">{error ?? 'The phrase corpus could not be loaded.'}</p>
      </div>
    );
  }

  return (
    <div className="my-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <button className="btn btn-outline-secondary" onClick={() => step(-1)}>
          ← Previous
        </button>
        <span className="text-body-secondary small">
          {index + 1} of {phrases.length}
        </span>
        <button className="btn btn-outline-secondary" onClick={() => step(1)}>
          Next →
        </button>
      </div>

      <PhraseCard phrase={phrase} />

      <div className="card shadow-sm p-4 mb-4">
        <h5>Listen</h5>
        {reference ? (
          <audio ref={referenceAudioRef} controls src={reference.audioUrl} className="w-100" />
        ) : (
          <p className="text-body-secondary mb-0">Loading reference audio…</p>
        )}
      </div>

      <div className="card shadow-sm p-4 mb-4">
        <h5>Your turn</h5>
        <div className="d-flex gap-2 align-items-center flex-wrap">
          {recorder.isRecording ? (
            <button className="btn btn-warning" onClick={recorder.stop}>
              ■ Stop
            </button>
          ) : (
            <button
              className="btn btn-danger"
              onClick={recorder.start}
              disabled={!recorder.isSupported || status === 'analyzing'}
            >
              ● Record
            </button>
          )}
          {status === 'analyzing' && <span className="text-body-secondary">Analysing…</span>}
        </div>

        {userAudioUrl && (
          <audio ref={userAudioRef} controls src={userAudioUrl} className="w-100 mt-3" />
        )}

        {(recorder.error ?? error) && (
          <div className="alert alert-warning mt-3 mb-0">{recorder.error ?? error}</div>
        )}

        {userContour && userContour.voicedFraction < 0.35 && (
          <div className="alert alert-warning mt-3 mb-0">
            That recording was mostly silence or noise. Try again somewhere quieter.
          </div>
        )}
      </div>

      {reference && userContour && (
        <ToneChart reference={reference.contour} user={userContour} onSeek={seek} />
      )}
    </div>
  );
}
