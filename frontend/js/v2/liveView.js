// frontend/js/v2/liveView.js
// Live-Ansicht: Kompakte Cards für Gerätestatus, Verbrauch, Session

import { F, fD, r2, sc, dI, da, rpb } from './utils.js';
import { Card, CardGrid, Sparkline } from './tiles.js';
import { renderMainChart, renderCostChart } from './chartRender.js';
import { loadLiveChart } from './liveChart.js';
import { getBasePath, getConfig, getLastState, setLastState } from './state.js';

export function ll() {
  const _B = getBasePath();
  const cfg = getConfig();

  Promise.all([
    fetch(_B + '/api/live').then(r => r.json()).catch(() => ({})),
    fetch(_B + '/api/stats').then(r => r.json()).catch(() => ({}))
  ]).then(([d, stats]) => {
    const s = d.state || {};
    const today = d.today || {};
    const last = d.last_session || {};
    const pw = d.current_power_w;

    const state = s.state || '–';
    const door = s.door || '–';
    const power = s.power || '–';
    const ef = s.energyforecast || s.EnergyForecast || 0;
    const wf = s.waterforecast || s.Waterforecast || s.WaterForecast || 0;
    const progress = parseInt(s.progress) || 0;
    const remaining = s.remaining || '0:00';
    const prog = s.programm || '–';
    const phase = s.phase || 'In Bereitschaft';
    const isR = (state === 'Run' || state === 'DelayedStart' || state === 'Pause');

    if (state !== getLastState()) { setLastState(state); }

    document.getElementById('cs').innerHTML = s.state
      ? '<span style="color:var(--green)">● Verbunden</span>'
      : '<span style="color:var(--muted)">○ Warte</span>';

    // --- Card 1: Gerätestatus ---
    const statusRows = [
      { label: 'Tür', value: dI(door) + ' ' + door },
      { label: 'Power', value: power, color: power === 'On' ? 'var(--green)' : '' },
      { label: 'Programm', value: prog },
      { label: 'Phase', value: phase, color: isR ? 'var(--green)' : '' },
    ];
    if (pw !== null && pw !== undefined) {
      statusRows.push({ label: 'Leistung', value: F(pw, 0) + ' W', color: pw > 10 ? 'var(--orange)' : '' });
    }
    if (ef > 0) statusRows.push({ label: 'Forecast Strom', value: F(r2(cfg._feMax * ef / 100), 2) + ' kWh', color: 'var(--strom)' });
    if (wf > 0) statusRows.push({ label: 'Forecast Wasser', value: F(r2(cfg._fwMax * wf / 100), 1) + ' L', color: 'var(--wasser)' });

    const cardStatus = Card(
      'Gerätestatus',
      '<span class="cd-state ' + sc(state) + '">' + state + '</span>',
      isR ? prog + ' · ' + progress + '% · ' + remaining : '',
      statusRows,
      isR ? 'LÄUFT' : phase,
      isR ? 'var(--green)' : 'var(--muted)'
    );

    // --- Card 2: Letzte Session ---
    const lastRows = [];
    if (last.start_time) {
      lastRows.push({ label: 'Datum', value: (last.start_time || '').replace('T', ' ').substring(0, 16) });
      lastRows.push({ label: 'Dauer', value: F(last.duration_min || 0, 0) + ' min' });
      if (last.kwh) lastRows.push({ label: 'Strom', value: F(last.kwh, 3) + ' kWh', color: 'var(--strom)' });
      if (last.liters) lastRows.push({ label: 'Wasser', value: F(last.liters, 1) + ' L', color: 'var(--wasser)' });
      if (last.cost_total) lastRows.push({ label: 'Kosten', value: F(last.cost_total, 3) + ' €', color: 'var(--orange)' });
      lastRows.push({ label: 'Ergebnis', value: last.result || '–', color: last.result === 'finished' ? 'var(--green)' : 'var(--red)' });
    }

    const cardLast = Card(
      'Letzte Session',
      last.program || '–',
      last.start_time ? last.start_time.substring(0, 10) : '',
      lastRows,
      last.result === 'finished' ? '✓' : '',
      'var(--green)'
    );

    // --- Card 3: Heute ---
    const todayRows = [];
    if (today.sessions) todayRows.push({ label: 'Spülgänge', value: today.sessions });
    if (today.kwh) todayRows.push({ label: 'Strom', value: F(today.kwh, 3) + ' kWh', color: 'var(--strom)' });
    if (today.liters) todayRows.push({ label: 'Wasser', value: F(today.liters, 1) + ' L', color: 'var(--wasser)' });
    if (today.duration_min) todayRows.push({ label: 'Dauer', value: fD(today.duration_min) });

    const cardToday = todayRows.length > 0 ? Card(
      'Heute',
      today.sessions + ' Spülgang' + (today.sessions > 1 ? 'e' : ''),
      '',
      todayRows
    ) : '';

    // --- Card 4: Jahr ---
    let cardYear = '';
    if (stats.total_sessions) {
      const yr = new Date().getFullYear();
      const ys = stats.year_sessions || 0;
      const yk = stats.year_real_kwh || stats.year_kwh || 0;
      const yl = stats.year_real_liters || stats.year_liters || 0;
      const yc = stats.year_cost_total || r2((stats.year_cost_strom || 0) + (stats.year_cost_wasser || 0));

      const yearRows = [
        { label: 'Monat', value: stats.month_sessions || 0 },
        { label: 'Strom', value: F(yk, 1) + ' kWh', color: 'var(--strom)' },
        { label: 'Wasser', value: F(yl, 0) + ' L', color: 'var(--wasser)' },
        { label: 'Kosten', value: F(yc, 2) + ' €', color: 'var(--orange)' },
      ];
      if (ys > 1) yearRows.push({ label: 'Ø/Spülgang', value: F(yc / ys, 2) + ' €' });

      cardYear = Card(
        'Jahr ' + yr,
        ys + ' Spülgänge',
        '',
        yearRows,
        '', '',
        '' // Sparkline wird nach Daily-Fetch ergänzt
      );
    }
    document.getElementById('stiles').innerHTML = CardGrid(cardStatus + cardLast + cardToday + cardYear);
    document.getElementById('cgrp').innerHTML = '';

    rpb(phase);
    _renderRunningPanel(isR, prog, phase, progress, remaining);

    // Verbrauch, Kosten, Tabelle: letzte 30 Tage anzeigen
    const days = cfg._ld || 14;
    ['cc', 'ccc', 'tc'].forEach(id => { document.getElementById(id).style.display = ''; });

    Promise.all([
      fetch(_B + '/api/daily?days=' + days).then(r => r.json()),
      fetch(_B + '/api/stats').then(r => r.json())
    ]).then(([data, st2]) => {
      if (!data || !data.length || data.filter(d2 => d2.sessions_count > 0).length <= 2) {
        ['cc', 'ccc'].forEach(id => { document.getElementById(id).style.display = 'none'; });
      } else {
        data = data.filter(d2 => d2.sessions_count > 0).reverse();
        const lb = data.map(d2 => d2.date ? d2.date.substring(5) : '');
        const costs2 = st2.costs || {};
        const sp2 = costs2.strom || 0;
        const wp2 = costs2.wasser || 0;

        document.getElementById('ct').textContent = 'Verbrauch (Letzte ' + days + ' Tage)';
        renderMainChart(lb, data.map(d2 => r2(d2.total_energy_kwh || 0)), data.map(d2 => r2(d2.total_water_liters || 0)), data.map(d2 => d2.sessions_count));

        document.getElementById('cct').textContent = 'Kosten (Letzte ' + days + ' Tage)';
        renderCostChart(lb, data.map(d2 => r2((d2.total_energy_kwh || 0) * sp2)), data.map(d2 => r2(((d2.total_water_liters || 0) / 1000) * wp2)));

        // Sparkline in Card injizieren
        const sparkEl = document.querySelector('.cd-spark');
        if (sparkEl && data.length >= 2) {
          sparkEl.innerHTML = Sparkline(data.map(d2 => d2.total_energy_kwh || 0), 'var(--strom)', 90, 28);
        }
      }
    });

    // Tabelle: letzte Sessions
    document.getElementById('tt2').textContent = 'Letzte Spülgänge';
    fetch(_B + '/api/sessions?limit=20').then(r => r.json()).then(sess => {
      if (!sess || !sess.length) {
        document.getElementById('stbl').innerHTML = '<p style="padding:8px;color:var(--muted)">Keine Daten</p>';
        return;
      }
      let h = '<table><thead><tr><th>Start</th><th>Programm</th><th>Dauer</th><th>kWh</th><th>Liter</th><th>€</th><th>Erg.</th></tr></thead><tbody>';
      sess.forEach(s => {
        const st3 = s.start_time ? s.start_time.replace('T', ' ').substring(0, 16) : '–';
        const cl = s.result === 'finished' ? 'color:var(--green)' : s.result === 'running' ? 'color:var(--orange)' : '';
        h += '<tr><td>' + st3 + '</td><td>' + (s.program || '–') + '</td><td class="n">' + (s.duration_min ? F(s.duration_min, 0) + 'm' : '–') + '</td><td class="n">' + (s.kwh_estimate ? F(s.kwh_estimate, 3) : '–') + '</td><td class="n">' + (s.liters_estimate ? F(s.liters_estimate, 1) : '–') + '</td><td class="n">' + (s.cost_total ? F(s.cost_total, 3) : '–') + '</td><td style="' + cl + '">' + (s.result || '–') + '</td></tr>';
      });
      h += '</tbody></table>';
      document.getElementById('stbl').innerHTML = h;
    });

    loadLiveChart(false);
  });
}

function _renderRunningPanel(isR, prog, phase, progress, remaining) {
  const rc = document.getElementById('rc');
  if (isR) {
    rc.style.display = '';
    let rh = '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">';
    rh += '<div><div class="tl">Programm</div><div style="font-size:.95rem;font-weight:700;color:var(--accent)">' + prog + '</div></div>';
    rh += '<div><div class="tl">Phase</div><div style="font-size:.95rem;font-weight:700;color:var(--green)">' + phase + '</div></div>';
    rh += '<div><div class="tl">Fortschritt</div><div style="font-size:.95rem;font-weight:700">' + progress + '%</div></div>';
    rh += '<div><div class="tl">Restzeit</div><div style="font-size:.95rem;font-weight:700">' + remaining + '</div></div>';
    rh += '</div>';
    document.getElementById('rcc').innerHTML = rh;
    document.getElementById('pbar').style.width = progress + '%';
    document.getElementById('plbl').textContent = prog + ' · ' + phase + ' · ' + progress + '%';
  } else {
    rc.style.display = 'none';
  }
}
