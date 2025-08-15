import { type MouseEvent, useEffect, useRef, useState } from 'react';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  CategoryScale,
} from 'chart.js';
import { getRelativePosition } from 'chart.js/helpers';
import { Chart } from 'react-chartjs-2';

import verticalBarPlugin from '@/lib/vertical-bar-plugin';
import { PitchFrame, PitchAnalysisResult } from '@/types/pitch';

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend,
  verticalBarPlugin,
);

interface ToneChartProps {
  setAudioPlayTimestamp: React.Dispatch<React.SetStateAction<any>>;
  selectedAudio: string;
  setSelectedAudio: React.Dispatch<React.SetStateAction<any>>;
  barPosition: number | null;
  pitchResult: PitchAnalysisResult;
  pitchResultTTS: PitchAnalysisResult;
}

const trimFrames = (frames: PitchFrame[]) => {
  let startIndex = frames.findIndex((f) => f.pitch > 0);
  let endIndex = [...frames].reverse().findIndex((f) => f.pitch > 0);

  if (startIndex === -1) {
    return {
      trimmed: [] as PitchFrame[],
      startTime: 0,
      endTime: 0,
      hasVoice: false,
    };
  }

  // Adjust end index since we reversed the array
  endIndex = frames.length - endIndex;

  const trimmed = frames.slice(startIndex, endIndex);
  return {
    trimmed,
    startTime: frames[startIndex].time,
    endTime: frames[endIndex - 1].time,
    hasVoice: true,
  };
};

function toXY(frames: PitchFrame[], offsetStart: number) {
  // shift to start at 0 for display, preserve nulls for no pitch
  return frames.map((f) => ({
    x: f.time - offsetStart,
    y: f.pitch > 0 ? f.pitch : null,
  }));
}

const ToneChart: React.FC<ToneChartProps> = ({
  setAudioPlayTimestamp,
  selectedAudio,
  setSelectedAudio,
  barPosition,
  pitchResult,
  pitchResultTTS,
}) => {
  const chartRef = useRef<ChartJS>(null);

  const refTrim = trimFrames(pitchResultTTS.frames);
  const usrTrim = trimFrames(pitchResult.frames);

  const referenceXY = refTrim.hasVoice ? toXY(refTrim.trimmed, refTrim.startTime) : [];
  const userXY = usrTrim.hasVoice ? toXY(usrTrim.trimmed, usrTrim.startTime) : [];

  const chartOptions = {
    responsive: true,
    parsing: false,
    plugins: {
      title: {
        display: true,
        text: 'Pitch Comparison',
        font: { size: 20 },
        fullSize: true,
      },
      legend: { position: 'top' as const },
      verticalBar: { position: null },
      tooltip: {
        callbacks: {
          // show both displayed time and original time in tooltip
          label: (ctx: any) => {
            const ds: any = ctx.dataset;
            const x = ctx.parsed.x as number; // displayed seconds since first voiced frame
            const orig = x + (ds.offsetStart ?? 0);
            const hz = ctx.parsed.y == null ? '—' : `${Math.round(ctx.parsed.y)} Hz`;
            return `${ds.label}: t=${x.toFixed(2)}s (orig ${orig.toFixed(2)}s), ${hz}`;
          },
        },
      },
    },
    scales: {
      y: { beginAtZero: false, title: { display: true, text: 'Pitch (Hz)' } },
      x: { type: 'linear' as const, title: { display: true, text: 'Time since voice start (s)' } },
    },
  };

  const chartData = {
    // labels: timeLabels,
    datasets: [
      {
        label: 'Reference',
        data: referenceXY,
        borderColor: '#4c8bf5',
        backgroundColor: '#4c8bf5',
        tension: 0.3,
        fill: false,
        spanGaps: false,
        // store original offset so we can map back on clicks
        offsetStart: refTrim.startTime,
      },
      {
        label: 'Your Recording',
        data: userXY,
        borderColor: '#ff9800',
        backgroundColor: '#ff9800',
        tension: 0.3,
        fill: false,
        spanGaps: false,
        // store original offset so we can map back on clicks
        offsetStart: usrTrim.startTime,
      },
    ],
  };

  useEffect(() => {
    const { current: chart } = chartRef;

    if (chart && barPosition) {
      // @ts-ignore
      chart.options.plugins.verticalBar.position = barPosition;
      chart.update();
    }
  }, [barPosition]);

  const onClick = (event: MouseEvent<HTMLCanvasElement>) => {
    const { current: chart } = chartRef;

    if (!chart) {
      return;
    }

    const canvasPosition = getRelativePosition(event.nativeEvent, chart);
    const displayedTime = chart.scales.x.getValueForPixel(canvasPosition.x);
    const dataY = chart.scales.y.getValueForPixel(canvasPosition.y);
    console.log(`Clicked at X: ${displayedTime}, Y: ${dataY}`);

    const datasetIndex = selectedAudio === 'reference' ? 0 : 1;
    const ds = chart.data.datasets[datasetIndex] as any;
    const originalTime = displayedTime + (ds.offsetStart ?? 0);

    if (typeof originalTime === 'number') {
      setAudioPlayTimestamp(originalTime);
    }
    console.log(`Play ${selectedAudio} audio from ${originalTime.toFixed(2)}s`);
  };

  return (
    <div className="card bg-dark shadow p-4">
      <h4>Pitch Comparison</h4>

      {/* Toggle buttons */}
      <div className="form-check form-switch mb-3">
        <input
          className="form-check-input"
          type="checkbox"
          id="audioToggle"
          checked={selectedAudio === 'reference'}
          onChange={(e) => setSelectedAudio(e.target.checked ? 'reference' : 'user')}
        />
        <label className="form-check-label" htmlFor="audioToggle">
          {selectedAudio === 'reference' ? 'Play Reference Audio' : 'Play Your Recording'}
        </label>
      </div>

      <Chart ref={chartRef} type="line" onClick={onClick} data={chartData} options={chartOptions} />
      <p className="mt-3">Click on the chart to replay reference from that point.</p>
    </div>
  );
};

export default ToneChart;
