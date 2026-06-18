// frontend/js/v2/liveView.js
// Live-Ansicht: Gerätestatus, letzter Spülgang, Running-Panel

import { F, fD, r2, sc, dI, da, rpb } from './utils.js';
import { T, G } from './tiles.js';
import { renderMainChart } from './chartRender.js';
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

    // Status-Tiles
    let st = T(state, 'Status', sc(state), null, null, '📊')
      + T(dI(door) + ' ' + door, 'Tür', 'i', null, null, '🚪')
      + T(power, 'Power', power === 'On' ? 'ok' : 'i', null, null, '⚡');

    if (pw !== null && pw !== undefined) {
      st += T(F(pw, 0) + ' W', 'Leistung', pw > 10 ? 'w' : 'i', null, { pct: Math.min(100, pw / 2000 * 100), color: 'var(--orange)' }, '💡');
    }
    st += T(prog, 'Programm', 'i', null, null, '📋')
      + T(phase, 'Phase', isR ? 'ok' : 'i', null, isR ? { pct: progress, color: 'var(--green)' } : null, '🔄');

    // Forecast & Tages-Tiles
    let ct = '';
    const efK = r2(cfg._feMax * ef / 100);
    const wfL = r2(cfg._fwMax * wf / 100);

    if (ef > 0) ct += T(F(efK, 2) + ' <span class="tu">kWh</span>', 'Forecast Strom', 's', null, { pct: ef, color: 'var(--strom)' }, '⚡');
    if (wf > 0) ct += T(F(wfL, 1) + ' <span class="tu">L</span>', 'Forecast Wasser', 'wa', null, { pct: wf, color: 'var(--wasser)' }, '💧');
    if (today.kwh) ct += T(F(today.kwh, 3) + ' <span class="tu">kWh</span>', 'Heute Strom', 's', null, { pct: Math.min(100, today.kwh / 1 * 100), color: 'var(--strom)' }, '⚡');
    if (today.liters) ct += T(F(today.liters, 1) + ' <span class="tu">L</span>', 'Heute Wasser', 'wa', null, { pct: Math.min(100, today.liters / 15 * 100), color: 'var(--wasser)' }, '💧');
    if (cfg._di) {
      ct += T(da(cfg._di), 'Betriebsdauer', 'i');
      const trm = stats.total_duration_min || 0;
      if (trm > 0) ct += T(Math.round(trm / 60) + ' h', 'Laufzeit', 'i');
    }

    document.getElementById('stiles').innerHTML = G('Gerätestatus', st + ct);
    document.getElementById('cgrp').innerHTML = '';

    // Letzter Spülgang
    _renderLastSession(last, phase, isR);
    rpb(phase);
    _renderRunningPanel(isR, prog, phase, progress, remaining);

    document.getElementById('ccc').style.display = 'none';
    document.getElementById('tc').style.display = 'none';

    // Jahres-Statistik
    if (stats.total_sessions) {
      _renderYearStats(stats);
    }

    // Tages-Chart
    fetch(_B + '/api/daily?days=' + cfg._ld).then(r => r.json()).then(data => {
      if (!data || !data.length || data.filter(d2 => d2.sessions_count > 0).length <= 2) {
        document.getElementById('cc').style.display = 'none'; return;
      }
      document.getElementById('cc').style.display = '';
      document.getElementById('ct').textContent = 'Letzte ' + cfg._ld + ' Tage';
      data = data.filter(d2 => d2.sessions_count > 0).reverse();
      const lb = data.map(d2 => d2.date ? d2.date.substring(5) : '');
      renderMainChart(lb, data.map(d2 => r2(d2.total_energy_kwh || 0)), data.map(d2 => r2(d2.total_water_liters || 0)), data.map(d2 => d2.sessions_count));
    });

    loadLiveChart(false);
  });
}

function _renderLastSession(last, phase, isR) {
  let ls = '';
  ls += T(phase, 'Phase', isR ? 'ok' : 'i', null, null, '🔄');
  ls += T((last.start_time || '–').substring(11, 19) || '–', 'Update', 'i', null, null, '🕐');

  if (last.start_time) {
    ls += T(last.program || '–', 'Programm', 'i', null, null, '📋');
    ls += T((last.start_time || '').replace('T', ' ').substring(0, 16), 'Datum', 'i', null, null, '📅');
    ls += T(F(last.duration_min || 0, 0) + ' min', 'Dauer', 'i', null, null, '⏱️');
    if (last.kwh) ls += T(F(last.kwh, 3) + ' <span class="tu">kWh</span>', 'Strom', 's', null, { pct: Math.min(100, last.kwh / 1 * 100), color: 'var(--strom)' }, '⚡');
    if (last.liters) ls += T(F(last.liters, 1) + ' <span class="tu">L</span>', 'Wasser', 'wa', null, { pct: Math.min(100, last.liters / 15 * 100), color: 'var(--wasser)' }, '💧');
    if (last.cost_total) ls += T(F(last.cost_total, 3) + ' <span class="tu">€</span>', 'Kosten', 'w', null, null, '💰');
    ls += T(last.result || '–', 'Ergebnis', last.result === 'finished' ? 'ok' : 'e', null, null, '✅');
  }
  document.getElementById('sgrid').innerHTML = '<div class="g">' + ls + '</div>';
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

function _renderYearStats(stats) {
  const yr = new Date().getFullYear();
  const ys2 = stats.year_sessions || 0;
  const ms2 = stats.month_sessions || 0;
  const yk = stats.year_real_kwh || stats.year_kwh || 0;
  const yl = stats.year_real_liters || stats.year_liters || 0;
  const ycs = stats.year_cost_strom || 0;
  const ycw = stats.year_cost_wasser || 0;
  const yc = stats.year_cost_total || r2(ycs + ycw);

  let sh = '<h3>Jahr ' + yr + '</h3><div class="g">';
  sh += T(ys2, 'Spülgänge', 'i', null, null, '🍽️');
  sh += T(ms2, 'Monat', 'i', null, null, '📅');
  sh += T(F(yk, 1) + ' <span class="tu">kWh</span>', 'Strom', 's', null, null, '⚡');
  sh += T(F(yl, 0) + ' <span class="tu">L</span>', 'Wasser', 'wa', null, null, '💧');
  sh += T(F(yc, 2) + ' <span class="tu">€</span>', 'Kosten', 'w', null, null, '💰');
  if (ys2 > 1) sh += T(F(yc / ys2, 2) + ' <span class="tu">€</span>', '⌀/Spülgang', 'i', null, null, '📊');
  sh += '</div>';
  document.getElementById('scc').innerHTML = sh;
  document.getElementById('sc').style.display = '';
}
