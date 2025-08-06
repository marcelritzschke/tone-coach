export default {
  id: 'verticalBar',
  afterDraw: (chart: any) => {
    if (chart.config.options.plugins.verticalBar) {
      const {
        ctx,
        chartArea: { top, bottom },
        scales: { x },
      } = chart;
      const position = chart.config.options.plugins.verticalBar.position;

      if (position !== null) {
        const xPos = x.getPixelForValue(position);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(xPos, top);
        ctx.lineTo(xPos, bottom);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'red';
        ctx.stroke();
        ctx.restore();
      }
    }
  },
};
