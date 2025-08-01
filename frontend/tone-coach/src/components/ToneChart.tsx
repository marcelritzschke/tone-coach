import { type MouseEvent, useEffect, useRef } from 'react';
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
  barPosition: number | null;
}

const ToneChart: React.FC<ToneChartProps> = ({ setAudioPlayTimestamp, barPosition }) => {
  // Mock pitch data
  const mockReferenceCurve = [100, 110, 105, 120, 130, 125, 140];
  const mockUserCurve = [90, 100, 110, 118, 135, 130, 138];
  const timeLabels = [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0];

  const chartRef = useRef<ChartJS>(null);

  const chartOptions = {
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: 'Pitch Comparison',
        font: { size: 20 },
        fullSize: true,
      },
      legend: { position: 'top' as const },
      verticalBar: { position: null },
    },
    scales: {
      y: { beginAtZero: false, title: { display: true, text: 'Pitch (Hz)' } },
      x: { type: 'linear' as const, title: { display: true, text: 'Time (s)' } },
    },
  };

  const chartData = {
    labels: timeLabels,
    datasets: [
      {
        label: 'Reference',
        data: mockReferenceCurve,
        borderColor: '#4c8bf5',
        backgroundColor: '#4c8bf5',
        tension: 0.3,
        fill: false,
      },
      {
        label: 'Your Recording',
        data: mockUserCurve,
        borderColor: '#ff9800',
        backgroundColor: '#ff9800',
        tension: 0.3,
        fill: false,
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
    const time = chart.scales.x.getValueForPixel(canvasPosition.x);
    const dataY = chart.scales.y.getValueForPixel(canvasPosition.y);
    console.log(`Clicked at X: ${time}, Y: ${dataY}`);

    if (time && (time < 0 || time > timeLabels[-1])) {
      console.warn('Clicked out of bounds');
      return;
    }

    if (typeof time === 'number') {
      setAudioPlayTimestamp(time);
    }
  };

  return (
    <div className="card bg-dark shadow p-4">
      <h4>Pitch Comparison</h4>
      <Chart ref={chartRef} type="line" onClick={onClick} data={chartData} options={chartOptions} />
      <p className="mt-3">Click on the chart to replay reference from that point.</p>
    </div>
  );
};

export default ToneChart;
