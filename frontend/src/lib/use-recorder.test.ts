import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useRecorder } from './use-recorder';

const stop = vi.fn();

function stubMediaRecorder(supported: string[]) {
  class FakeMediaRecorder {
    static isTypeSupported = (type: string) => supported.includes(type);
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    constructor(
      public stream: MediaStream,
      public options: { mimeType: string },
    ) {}
    start() {}
    stop() {
      this.ondataavailable?.({ data: new Blob(['audio']) });
      this.onstop?.();
    }
  }
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
  return FakeMediaRecorder;
}

function stubMicrophone(granted = true) {
  const tracks = [{ stop }];
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: granted
        ? vi.fn().mockResolvedValue({ getTracks: () => tracks })
        : vi.fn().mockRejectedValue(new Error('denied')),
    },
  });
}

beforeEach(() => stop.mockReset());
afterEach(() => vi.unstubAllGlobals());

describe('useRecorder', () => {
  it('prefers WebM where the browser supports it', async () => {
    const Recorder = stubMediaRecorder(['audio/webm;codecs=opus', 'audio/mp4']);
    stubMicrophone();

    const { result } = renderHook(() => useRecorder(vi.fn()));
    await act(() => result.current.start());

    expect(Recorder.isTypeSupported('audio/webm;codecs=opus')).toBe(true);
    await waitFor(() => expect(result.current.isRecording).toBe(true));
  });

  it('falls back to MP4 on Safari instead of throwing on a WebM type', async () => {
    // Safari records MP4/AAC and rejects a WebM mimeType outright. Hardcoding WebM
    // is what made the app desktop-only.
    stubMediaRecorder(['audio/mp4']);
    stubMicrophone();

    const onComplete = vi.fn();
    const { result } = renderHook(() => useRecorder(onComplete));
    await act(() => result.current.start());

    await waitFor(() => expect(result.current.isRecording).toBe(true));
    expect(result.current.error).toBeNull();
  });

  it('reports a browser that can record nothing at all', async () => {
    stubMediaRecorder([]);
    stubMicrophone();

    const { result } = renderHook(() => useRecorder(vi.fn()));
    await act(() => result.current.start());

    expect(result.current.error).toMatch(/cannot record/i);
    expect(result.current.isRecording).toBe(false);
  });

  it('releases the microphone on stop, so the recording indicator goes out', async () => {
    stubMediaRecorder(['audio/webm']);
    stubMicrophone();

    const { result } = renderHook(() => useRecorder(vi.fn()));
    await act(() => result.current.start());
    act(() => result.current.stop());

    await waitFor(() => expect(stop).toHaveBeenCalled());
    expect(result.current.isRecording).toBe(false);
  });

  it('hands the finished recording to the caller', async () => {
    stubMediaRecorder(['audio/webm']);
    stubMicrophone();

    const onComplete = vi.fn();
    const { result } = renderHook(() => useRecorder(onComplete));
    await act(() => result.current.start());
    act(() => result.current.stop());

    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
    expect(onComplete.mock.calls[0][0]).toBeInstanceOf(Blob);
  });

  it('explains a denied microphone rather than hanging', async () => {
    stubMediaRecorder(['audio/webm']);
    stubMicrophone(false);

    const { result } = renderHook(() => useRecorder(vi.fn()));
    await act(() => result.current.start());

    expect(result.current.error).toMatch(/denied/i);
    expect(result.current.isRecording).toBe(false);
  });
});
