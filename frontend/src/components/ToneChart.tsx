'use client';

import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  type ChartOptions,
} from 'chart.js';
import { getRelativePosition } from 'chart.js/helpers';
import { type MouseEvent, useState } from 'react';
import { Line } from 'react-chartjs-2';

import type { PitchContour, PitchFrame } from '@/types/pitch';

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend,
);

interface ToneChartProps {
  reference: PitchContour;
  user: PitchContour;
  onSeek: (seconds: number, which: 'reference' | 'user') => void;
}

/**
 * A plotted frame. Every entry has an `x`; an unvoiced frame carries `y: null`.
 *
 * The point object itself is never null. Chart.js reads `.x` off each item, so a bare
 * null in the array is a crash rather than a gap — the type here exists to keep that
 * from being expressible.
 */
interface ContourPoint {
  x: number;
  y: number | null;
}

interface Series {
  points: ContourPoint[];
  offset: number;
}

/**
 * Drop leading and trailing silence and shift the contour so speech starts at zero.
 *
 * This is alignment by first voiced frame only. It is not enough — a learner speaking
 * at a different rate drifts out of phase within a couple of syllables — and it is
 * replaced by proper time warping in M1.
 */
function toSeries(frames: PitchFrame[]): Series {
  const first = frames.findIndex((frame) => frame.pitch > 0);
  if (first === -1) return { points: [], offset: 0 };

  let last = frames.length - 1;
  while (last > first && frames[last].pitch <= 0) last -= 1;

  const offset = frames[first].time;
  const points = frames.slice(first, last + 1).map((frame) => ({
    x: frame.time - offset,
    // A null y breaks the line at an unvoiced frame instead of dropping it to zero.
    y: frame.pitch > 0 ? frame.pitch : null,
  }));
  return { points, offset };
}

export default function ToneChart({ reference, user, onSeek }: ToneChartProps) {
  const [selected, setSelected] = useState<'reference' | 'user'>('user');

  const referenceSeries = toSeries(reference.frames);
  const userSeries = toSeries(user.frames);

  const data = {
    datasets: [
      {
        label: 'Reference',
        data: referenceSeries.points,
        borderColor: '#2f6690',
        backgroundColor: '#2f6690',
        tension: 0.3,
        spanGaps: false,
        pointRadius: 0,
      },
      {
        label: 'Your recording',
        data: userSeries.points,
        borderColor: '#b0521a',
        backgroundColor: '#b0521a',
        tension: 0.3,
        spanGaps: false,
        pointRadius: 0,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      tooltip: {
        callbacks: {
          label: (context) => {
            const seconds = context.parsed.x.toFixed(2);
            const hz = context.parsed.y == null ? 'unvoiced' : `${Math.round(context.parsed.y)} Hz`;
            return `${context.dataset.label}: ${hz} at ${seconds}s`;
          },
        },
      },
    },
    scales: {
      y: { beginAtZero: false, title: { display: true, text: 'Pitch (Hz)' } },
      x: { type: 'linear', title: { display: true, text: 'Seconds since voice start' } },
    },
  };

  const handleClick = (event: MouseEvent<HTMLCanvasElement>) => {
    const chart = ChartJS.getChart(event.currentTarget);
    if (!chart) return;
    const position = getRelativePosition(event.nativeEvent, chart);
    const displayed = chart.scales.x.getValueForPixel(position.x);
    if (displayed === undefined) return;
    const offset = selected === 'reference' ? referenceSeries.offset : userSeries.offset;
    onSeek(displayed + offset, selected);
  };

  return (
    <div className="card shadow-sm p-4">
      <h5>Pitch comparison</h5>
      <p className="text-body-secondary small">
        Both curves are raw hertz on a shared axis, so two different voices will not
        overlap even when the tones are right. Speaker normalisation and time alignment
        land in M1.
      </p>

      <div className="btn-group mb-3" role="group" aria-label="Which audio to replay">
        <button
          type="button"
          className={`btn btn-sm ${selected === 'user' ? 'btn-primary' : 'btn-outline-primary'}`}
          onClick={() => setSelected('user')}
        >
          Replay yours
        </button>
        <button
          type="button"
          className={`btn btn-sm ${
            selected === 'reference' ? 'btn-primary' : 'btn-outline-primary'
          }`}
          onClick={() => setSelected('reference')}
        >
          Replay reference
        </button>
      </div>

      <Line data={data} options={options} onClick={handleClick} />
      <p className="mt-3 mb-0 small text-body-secondary">
        Click the chart to replay the selected recording from that point.
      </p>
    </div>
  );
}
