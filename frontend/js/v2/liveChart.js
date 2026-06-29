// frontend/js/v2/liveChart.js
// Live-Session-Chart Rendering

import { F } from './utils.js';
import { getChartColors } from './chartBase.js';
import { getBasePath } from './state.js';
import { detectPhases, aggregate } from './phaseDetect.js';
import { getAppleIcon } from '../icons.js';

let lsch = null;
let _lschLoaded = false;

export function resetLiveChartLoaded() { _lschLoaded = false; }

export function loadLiveChart(forceRefresh) {
  if (_lschLoaded && !forceRefresh) return;
  const _B = getBasePath();

  fetch(_B + '/api/session/live').then(r => r.json()).then(d => {
    const card = document.getElementById('liveChartCard');
    if (!d.readings || d.readings.length < 2) { card.style.display = 'none'; return; }
    card.style.display = '';

    let rd = d.readings;
    if (!rd.some(r => r.phase)) detectPhases(rd);

    // Aggregierung bei vielen Datenpunkten
    if (rd.length > 300) rd = aggregate(rd, 10);
    else if (rd.length > 100) rd = aggregate(rd, 5);

    const sessionDate = rd[0].timestamp ? rd[0].timestamp.substring(0, 10) : '';
    document.getElementById('liveChartTitle').innerHTML = d.active
      ? getAppleIcon('energy', 14, 1.0, 4) + ' Verbrauch live' : getAppleIcon('energy', 14, 1.0, 4) + ' Verbrauch am ' + sessionDate;

    const labels = rd.map(r => r.timestamp ? r.timestamp.substring(11, 16) : '');
    const pw = rd.map(r => r.power_w);

    // Delta-Berechnung (Verbrauch pro Zeitblock)
    const kwhRaw = rd.map(r => r.kwh_rel);
    const litRaw = rd.map(r => r.liters_rel);
    const kwh = [0], lit = [0];
    for (let i = 1; i < kwhRaw.length; i++) {
      kwh.push(kwhRaw[i] != null && kwhRaw[i - 1] != null ? Math.max(0, Math.round((kwhRaw[i] - kwhRaw[i - 1]) * 10000) / 10000) : 0);
      lit.push(litRaw[i] != null && litRaw[i - 1] != null ? Math.max(0, Math.round((litRaw[i] - litRaw[i - 1]) * 100) / 100) : 0);
    }

    const c = getChartColors();
    const phaseColors = {
      'Vorspülen': 'rgba(100,116,139,.6)', 'Hauptspülen': 'rgba(245,158,11,.6)',
      'Spülen': 'rgba(245,158,11,.6)', 'Klarspülen': 'rgba(59,130,246,.6)',
      'Trocknen': 'rgba(239,68,68,.5)', 'In Bereitschaft': 'rgba(100,116,139,.3)',
      'Bereit': 'rgba(100,116,139,.3)', 'Fertig': 'rgba(16,185,129,.4)'
    };
    const pwColors = rd.map(r => phaseColors[r.phase] || 'rgba(245,158,11,.5)');

    const datasets = _buildDatasets(pw, kwh, lit, pwColors, c);
    if (!datasets.length) { card.style.display = 'none'; return; }

    if (lsch) lsch.destroy();
    const scales = _buildScales(pw, kwh, lit, c);
    _lschLoaded = !d.active;

    lsch = new Chart(document.getElementById('liveSessionChart'), {
      type: 'line',
      data: { labels, datasets },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: c.text, usePointStyle: true, font: { size: 9 } } } }, scales }
    });

    _renderPhaseSummary(rd, kwh, lit);
  }).catch(e => {
    console.error('loadLiveChart error:', e);
    document.getElementById('liveChartCard').style.display = 'none';
  });
}

function _buildDatasets(pw, kwh, lit, pwColors, c) {
  const datasets = [];
  if (pw.some(v => v !== null)) {
    datasets.push({ label: 'Watt', data: pw, type: 'bar', backgroundColor: pwColors, borderColor: pwColors.map(c2 => c2.replace(/[\d.]+\)$/, '1)')), borderWidth: 1, borderRadius: 2, yAxisID: 'yW' });
  }
  if (kwh.some(v => v > 0)) {
    datasets.push({ label: 'kWh', data: kwh, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,.15)', borderWidth: 2, pointRadius: 2, tension: 0.3, yAxisID: 'yE', fill: true });
  }
  if (lit.some(v => v > 0)) {
    datasets.push({ label: 'Liter', data: lit, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,.15)', borderWidth: 2, pointRadius: 2, tension: 0.3, yAxisID: 'yL', fill: true });
  }
  return datasets;
}

function _buildScales(pw, kwh, lit, c) {
  const scales = { x: { ticks: { color: c.muted, maxRotation: 45, maxTicksLimit: 20, autoSkip: true, font: { size: 8 } }, grid: { color: c.grid } } };
  if (pw.some(v => v !== null)) scales.yW = { position: 'left', ticks: { color: '#f59e0b', font: { size: 9 } }, grid: { color: c.grid }, title: { display: true, text: 'W', color: '#f59e0b' }, beginAtZero: true };
  if (kwh.some(v => v !== null)) scales.yE = { position: 'right', ticks: { color: '#ef4444', font: { size: 9 } }, grid: { display: false }, title: { display: true, text: 'kWh', color: '#ef4444' }, beginAtZero: true };
  if (lit.some(v => v !== null)) scales.yL = { position: 'right', ticks: { color: '#3b82f6', font: { size: 9 } }, grid: { display: false }, title: { display: true, text: 'L', color: '#3b82f6' }, beginAtZero: true };
  return scales;
}

function _renderPhaseSummary(rd, kwh, lit) {
  const ps = document.getElementById('phaseSummary');
  const phaseEmoji = { 'Vorspülen': getAppleIcon('sync', 12, 1.0, 2), 'Hauptspülen': getAppleIcon('scrub', 12, 1.0, 2), 'Spülen': getAppleIcon('scrub', 12, 1.0, 2), 'Klarspülen': getAppleIcon('drop', 12, 1.0, 2), 'Trocknen': getAppleIcon('flame', 12, 1.0, 2), 'Fertig': getAppleIcon('check', 12, 1.0, 2) };
  const phaseClr = { 'Vorspülen': '#64748b', 'Hauptspülen': '#f59e0b', 'Spülen': '#f59e0b', 'Klarspülen': '#3b82f6', 'Trocknen': '#ef4444', 'Fertig': '#10b981' };

  const phases = {};
  rd.forEach((r, i) => {
    if (!r.phase) return;
    if (!phases[r.phase]) phases[r.phase] = { kwh: 0, lit: 0 };
    phases[r.phase].kwh += kwh[i] || 0;
    phases[r.phase].lit += lit[i] || 0;
  });

  const badge = (icon, label, value, color) =>
    `<div style="display:flex;flex-direction:column;align-items:center;padding:8px 14px;border:1px solid var(--border,#334155);border-radius:10px;background:var(--surface,#1e2235);min-width:100px;">
      <span style="font-size:1rem;font-weight:700;color:${color};line-height:1.2;">${value}</span>
      <span style="font-size:.65rem;color:var(--muted,#64748b);margin-top:2px;white-space:nowrap;">${icon} ${label}</span>
    </div>`;

  const pKeys = Object.keys(phases);
  if (pKeys.length > 0) {
    ps.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;padding:10px 0;">` +
      pKeys.map(k => {
        const p = phases[k];
        const val = F(p.kwh, 3) + ' kWh · ' + F(p.lit, 1) + ' L';
        return badge(phaseEmoji[k] || '·', k, val, phaseClr[k] || 'var(--text)');
      }).join('') + `</div>`;
  } else {
    const totalKwh = kwh.reduce((a, b) => a + b, 0);
    const totalLit = lit.reduce((a, b) => a + b, 0);
    ps.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;padding:10px 0;">` +
      badge('Σ', 'Energie', F(totalKwh, 3) + ' kWh', '#ef4444') +
      badge('Σ', 'Wasser', F(totalLit, 1) + ' L', '#3b82f6') +
      `</div>`;
  }
}
