/**
 * Freelance Money Planner — charts (js/charts.js)
 *
 * Tiny hand-rolled canvas charts. No library, no network, no build step —
 * the app must work from a double-clicked index.html. Charts are drawn
 * crisply on high-DPI screens (devicePixelRatio scaling) and degrade to a
 * plain "no data yet" message when there is nothing to plot.
 */

'use strict';

(function (global) {
  const FMP = global.FMP;

  /** Size a canvas to its CSS box, scaled for the screen's pixel ratio. */
  function setupCanvas(canvas) {
    const dpr = global.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(280, Math.round(rect.width));
    const height = Math.round(canvas.getAttribute('height') || 220);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, width, height };
  }

  /** Draw "no data" text in the middle of an empty chart. */
  function emptyState(ctx, width, height, message) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#64748b';
    ctx.font = '14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(message, width / 2, height / 2);
  }

  /**
   * Horizontal bar chart: [{ label, valueMinor, color }].
   * Values are money (minor units); labels are category names.
   */
  function barChart(canvas, items, currency) {
    const { ctx, width, height } = setupCanvas(canvas);
    const data = (items || []).filter(function (d) { return d.valueMinor > 0; });
    if (!data.length) {
      emptyState(ctx, width, height, 'No spending in this month yet — add an expense to see it here.');
      return;
    }
    const padLeft = 130, padRight = 90, padTop = 12, padBottom = 12;
    const chartW = width - padLeft - padRight;
    const rowH = Math.min(34, (height - padTop - padBottom) / data.length);
    const max = Math.max.apply(null, data.map(function (d) { return d.valueMinor; }));

    ctx.clearRect(0, 0, width, height);
    ctx.font = '12px system-ui, sans-serif';
    data.forEach(function (d, i) {
      const y = padTop + i * rowH;
      const barW = Math.max(2, (d.valueMinor / max) * chartW);
      // Label (truncated so it never overlaps the bar).
      ctx.fillStyle = '#334155';
      ctx.textAlign = 'right';
      const label = d.label.length > 18 ? d.label.slice(0, 17) + '…' : d.label;
      ctx.fillText(label, padLeft - 8, y + rowH / 2 + 4);
      // Bar.
      ctx.fillStyle = d.color || '#1d4ed8';
      const r = 4;
      ctx.beginPath();
      ctx.roundRect(padLeft, y + 5, barW, rowH - 12, r);
      ctx.fill();
      // Value.
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'left';
      ctx.fillText(FMP.formatMoneyShort(d.valueMinor, currency), padLeft + barW + 8, y + rowH / 2 + 4);
    });
  }

  /**
   * Grouped line chart: income vs expenses over months.
   * series = [{ month: "2026-09", incomeMinor, expenseMinor }, ...]
   */
  function lineChart(canvas, series, currency) {
    const { ctx, width, height } = setupCanvas(canvas);
    const hasData = (series || []).some(function (s) { return s.incomeMinor > 0 || s.expenseMinor > 0; });
    if (!hasData) {
      emptyState(ctx, width, height, 'Add income or expenses in different months to see the trend.');
      return;
    }
    const padLeft = 76, padRight = 16, padTop = 26, padBottom = 28;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;
    const max = Math.max.apply(null, series.map(function (s) {
      return Math.max(s.incomeMinor, s.expenseMinor);
    }).concat([1]));

    const x = function (i) { return padLeft + (series.length === 1 ? chartW / 2 : (i / (series.length - 1)) * chartW); };
    const y = function (v) { return padTop + chartH - (v / max) * chartH; };

    ctx.clearRect(0, 0, width, height);
    ctx.font = '11px system-ui, sans-serif';

    // Gridlines + y-axis labels (0, 25%, 50%, 75%, 100% of max).
    ctx.strokeStyle = '#e2e8f0';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'right';
    [0, 0.25, 0.5, 0.75, 1].forEach(function (f) {
      const gy = padTop + chartH - f * chartH;
      ctx.beginPath();
      ctx.moveTo(padLeft, gy);
      ctx.lineTo(width - padRight, gy);
      ctx.stroke();
      ctx.fillText(FMP.formatMoneyShort(Math.round(max * f), currency), padLeft - 8, gy + 4);
    });

    // Month labels.
    ctx.textAlign = 'center';
    series.forEach(function (s, i) {
      ctx.fillStyle = '#334155';
      ctx.fillText(s.month.slice(5) + '/' + s.month.slice(2, 4), x(i), height - 8);
    });

    // Two lines: income (blue) and expenses (rose).
    const drawLine = function (key, color) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      series.forEach(function (s, i) {
        if (i === 0) ctx.moveTo(x(i), y(s[key]));
        else ctx.lineTo(x(i), y(s[key]));
      });
      ctx.stroke();
      ctx.fillStyle = color;
      series.forEach(function (s, i) {
        ctx.beginPath();
        ctx.arc(x(i), y(s[key]), 3.5, 0, Math.PI * 2);
        ctx.fill();
      });
    };
    drawLine('incomeMinor', '#1d4ed8');
    drawLine('expenseMinor', '#e11d48');

    // Legend.
    ctx.textAlign = 'left';
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(padLeft, 4, 12, 12);
    ctx.fillStyle = '#334155';
    ctx.fillText('Income', padLeft + 18, 14);
    ctx.fillStyle = '#e11d48';
    ctx.fillRect(padLeft + 80, 4, 12, 12);
    ctx.fillStyle = '#334155';
    ctx.fillText('Expenses', padLeft + 98, 14);
  }

  global.FMPCharts = { barChart, lineChart };
})(typeof window !== 'undefined' ? window : globalThis);
