import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ToneChart from './ToneChart';
import type { PitchContour } from '@/types/pitch';

/**
 * Capture what the chart is handed instead of rendering it.
 *
 * Chart.js needs a real canvas, which jsdom does not provide — and the defect these
 * tests exist for was never in Chart.js. It was in the shape of the data we passed.
 */
const datasets = vi.hoisted(() => ({ last: null as unknown }));

vi.mock('react-chartjs-2', () => ({
  Line: (props: { data: unknown }) => {
    datasets.last = props.data;
    return <canvas data-testid="chart" />;
  },
}));

function contour(pitches: number[]): PitchContour {
  return {
    frames: pitches.map((pitch, index) => ({ time: index * 0.01, pitch })),
    voicedFraction: pitches.filter((p) => p > 0).length / pitches.length,
  };
}

function renderChart(reference: PitchContour, user: PitchContour) {
  render(<ToneChart reference={reference} user={user} onSeek={vi.fn()} />);
  return (datasets.last as { datasets: { data: { x: number; y: number | null }[] }[] })
    .datasets;
}

describe('ToneChart', () => {
  it('never emits a null point for an unvoiced frame', () => {
    // The M0 regression: unvoiced frames were bare nulls, and Chart.js reads .x off
    // every item, so the array threw instead of drawing a gap.
    const withGap = contour([200, 0, 0, 210, 220]);
    for (const dataset of renderChart(withGap, withGap)) {
      expect(dataset.data.length).toBeGreaterThan(0);
      for (const point of dataset.data) {
        expect(point).not.toBeNull();
        expect(typeof point.x).toBe('number');
        expect(Number.isNaN(point.x)).toBe(false);
      }
    }
  });

  it('represents an unvoiced frame as a null y, so the line breaks', () => {
    const [reference] = renderChart(contour([200, 0, 210]), contour([150, 160, 170]));
    expect(reference.data.map((point) => point.y)).toEqual([200, null, 210]);
  });

  it('trims leading and trailing silence and starts the contour at zero', () => {
    const [reference] = renderChart(contour([0, 0, 200, 210, 0]), contour([150]));
    expect(reference.data).toHaveLength(2);
    expect(reference.data[0].x).toBeCloseTo(0);
    expect(reference.data[0].y).toBe(200);
  });

  it('survives a contour with no voiced frame at all', () => {
    const [reference] = renderChart(contour([0, 0, 0]), contour([150, 160]));
    expect(reference.data).toEqual([]);
  });
});
