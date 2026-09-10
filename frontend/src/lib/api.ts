import type { Phrase, PitchContour, PitchResponse, Reference } from '@/types/pitch';

/**
 * Base URL of the analysis backend.
 *
 * Configured rather than hardcoded so the same build runs against a local server,
 * a preview deployment and production.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

/** Reads FastAPI's `{"detail": ...}` error body so the UI can say what went wrong. */
async function failure(response: Response, fallback: string): Promise<Error> {
  try {
    const body = await response.json();
    if (typeof body?.detail === 'string') return new Error(body.detail);
  } catch {
    // Non-JSON error body; fall through to the generic message.
  }
  return new Error(`${fallback} (${response.status})`);
}

function toContour(data: PitchResponse): PitchContour {
  return {
    frames: data.time.map((time, index) => ({ time, pitch: data.pitch[index] ?? 0 })),
    voicedFraction: data.voicedFraction,
  };
}

/**
 * Fetch the whole phrase corpus.
 *
 * It is a few hundred kilobytes and changes only when the backend is redeployed, so
 * one request replaces a round trip per flashcard.
 */
export async function fetchPhrases(signal?: AbortSignal): Promise<Phrase[]> {
  const response = await fetch(`${API_URL}/phrases`, { signal });
  if (!response.ok) throw await failure(response, 'Could not load practice phrases');
  return response.json();
}

/** Fetch the reference recording for a phrase, with its pitch contour. */
export async function fetchReference(text: string, signal?: AbortSignal): Promise<Reference> {
  const response = await fetch(`${API_URL}/reference?text=${encodeURIComponent(text)}`, {
    signal,
  });
  if (!response.ok) throw await failure(response, 'Could not load the reference audio');
  const data = await response.json();
  return {
    // The API returns a path so the host is never baked into the response.
    audioUrl: `${API_URL}${data.audioUrl}`,
    contour: toContour(data.pitch),
  };
}

/** Upload a recording and get its pitch contour back. */
export async function analyzeRecording(
  blob: Blob,
  signal?: AbortSignal,
): Promise<PitchContour> {
  const form = new FormData();
  // The extension follows the blob's real type; Safari records MP4, not WebM.
  const extension = blob.type.includes('mp4') ? 'mp4' : 'webm';
  form.append('file', blob, `recording.${extension}`);

  const response = await fetch(`${API_URL}/analyze`, {
    method: 'POST',
    body: form,
    signal,
  });
  if (!response.ok) throw await failure(response, 'Could not analyse the recording');
  return toContour(await response.json());
}
