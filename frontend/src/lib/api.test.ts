import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { analyzeRecording, fetchPhrases, fetchReference } from './api';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => vi.unstubAllGlobals());

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response;
}

describe('fetchPhrases', () => {
  it('surfaces the backend detail so the UI can say what went wrong', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'corpus not found' }, false, 500));
    await expect(fetchPhrases()).rejects.toThrow('corpus not found');
  });

  it('falls back to a status when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('not json');
      },
    } as unknown as Response);
    await expect(fetchPhrases()).rejects.toThrow('502');
  });
});

describe('fetchReference', () => {
  it('turns parallel arrays into frames and keeps the voiced fraction', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        audioUrl: '/media/tts_abc.mp3',
        pitch: { time: [0, 0.01], pitch: [200, 0], voicedFraction: 0.5 },
      }),
    );
    const reference = await fetchReference('你好');

    expect(reference.contour.frames).toEqual([
      { time: 0, pitch: 200 },
      { time: 0.01, pitch: 0 },
    ]);
    expect(reference.contour.voicedFraction).toBe(0.5);
  });

  it('makes the media path absolute, since audio is fetched by the browser', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        audioUrl: '/media/tts_abc.mp3',
        pitch: { time: [], pitch: [], voicedFraction: 0 },
      }),
    );
    const reference = await fetchReference('你好');
    expect(reference.audioUrl).toMatch(/^https?:\/\/.+\/media\/tts_abc\.mp3$/);
  });

  it('encodes hanzi into the query string', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ audioUrl: '/m.mp3', pitch: { time: [], pitch: [], voicedFraction: 0 } }),
    );
    await fetchReference('你好吗');
    expect(fetchMock.mock.calls[0][0]).toContain(encodeURIComponent('你好吗'));
  });
});

describe('analyzeRecording', () => {
  it('names a Safari recording .mp4 rather than claiming it is webm', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ time: [0], pitch: [180], voicedFraction: 1 }),
    );
    await analyzeRecording(new Blob(['x'], { type: 'audio/mp4' }));

    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect((body.get('file') as File).name).toBe('recording.mp4');
  });

  it('names a Chrome recording .webm', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ time: [0], pitch: [180], voicedFraction: 1 }),
    );
    await analyzeRecording(new Blob(['x'], { type: 'audio/webm;codecs=opus' }));

    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect((body.get('file') as File).name).toBe('recording.webm');
  });

  it('reports an undecodable upload in the backend’s own words', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ detail: 'could not decode audio' }, false, 415),
    );
    await expect(analyzeRecording(new Blob(['x']))).rejects.toThrow('could not decode audio');
  });
});
