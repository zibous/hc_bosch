// frontend/js/v2/historyView.js
// Tages-/Perioden-basierte Historienansicht + Tabelle + CSV

import { F, fD, r2 } from './utils.js';
import { Card, CardGrid, Sparkline, T, G } from './tiles.js';
import { renderMainChart, renderCostChart } from './chartRender.js';
import { getBasePath } from './state.js';

/**
 * Rendert den Historien-Modus für einen Tagesbereich (from/to).
 */
export function renderDayRange(from, to) {
  const _B = getBasePath();
  document.getElementById('cs').innerHTML = '';
  ['cc', 'ccc', 'tc'].forEach(id => { document.getElementById(id).style.display = ''; });

  const label = _buildLabel(from, to);
  document.getElementById('ct').textContent = 'Verbrauch (' + label + ')';
  document.getElementById('cct').textContent = 'Kosten (' + label + ')';
  document.getElementById('tt2').textContent = 'Spülgänge (' + label + ')';

  Promise.all([
    fetch(_B + '/api/daily?from=' + from + '&to=' + to).then(r => r.json()),
    fetch(_B + '/api/stats').then(r => r.json())
  ]).then(([data, st]) => {
    if (!data || !data.length) {
      document.getElementById('stiles').innerHTML = Card('Zeitraum', '0 Spülgänge', label, []);
      document.getElementById('cgrp').innerHTML = '';
      ['cc', 'ccc', 'tc'].forEach(id => { document.getElementById(id).style.display = 'none'; });
      return;
    }
    data = data.filter(d => d.sessions_count > 0).reverse();
    if (!data.length) {
      document.getElementById('stiles').innerHTML = Card('Zeitraum', '0 Spülgänge', label, []);
      document.getElementById('cgrp').innerHTML = '';
      ['cc', 'ccc', 'tc'].forEach(id => { document.getElementById(id).style.display = 'none'; });
      return;
    }

    const costs = st.costs || {};
    const sp2 = costs.strom || 0;
    const wp = costs.wasser || 0;

    let ts = 0, td = 0, tk = 0, tl = 0;
    data.forEach(d => {
      ts += d.sessions_count;
      td += d.total_duration_min;
      tk += d.total_energy_kwh || 0;
      tl += d.total_water_liters || 0;
    });

    if (tk === 0) {
      let te = 0, tw = 0;
      data.forEach(d => {
        te += (d.avg_energy_forecast || 0) * d.sessions_count;
        tw += (d.avg_water_forecast || 0) * d.sessions_count;
      });
      tk = r2(1.05 * te / 100);
      tl = r2(13.0 * tw / 100);
    }

    const cs2 = r2(tk * sp2);
    const cw2 = r2((tl / 1000) * wp);

    // Card: Verbrauch (mit Sparkline)
    const kwhSpark = Sparkline(data.map(d => d.total_energy_kwh || 0), 'var(--strom)', 90, 28);
    const cardVerbrauch = Card('Verbrauch ' + label, ts + ' Spülgänge', fD(td) + ' Gesamtdauer', [
      { label: 'Strom', value: F(tk, 2) + ' kWh', color: 'var(--strom)' },
      { label: 'Wasser', value: F(tl, 0) + ' L', color: 'var(--wasser)' },
    ], '', '', kwhSpark);

    // Card: Kosten (mit Sparkline)
    const costSpark = Sparkline(data.map(d => r2((d.total_energy_kwh || 0) * sp2 + ((d.total_water_liters || 0) / 1000) * wp)), 'var(--orange)', 90, 28);
    const cardKosten = Card('Kosten ' + label, F(cs2 + cw2, 2) + ' €', 'Gesamt', [
      { label: 'Stromkosten', value: F(cs2, 2) + ' €', color: 'var(--strom)' },
      { label: 'Wasserkosten', value: F(cw2, 2) + ' €', color: 'var(--wasser)' },
    ], '', '', costSpark);

    // Card: Durchschnitt
    let cardAvg = '';
    if (ts > 1) {
      cardAvg = Card('Ø pro Spülgang', F((cs2 + cw2) / ts, 2) + ' €', '', [
        { label: 'Dauer', value: F(td / ts, 0) + ' min' },
        { label: 'Strom', value: F(tk / ts, 3) + ' kWh', color: 'var(--strom)' },
        { label: 'Wasser', value: F(tl / ts, 1) + ' L', color: 'var(--wasser)' },
      ]);
    }

    document.getElementById('stiles').innerHTML = CardGrid(cardVerbrauch + cardKosten + cardAvg);
    document.getElementById('cgrp').innerHTML = '';

    const lb = data.map(d => d.date ? d.date.substring(5) : '');
    renderMainChart(lb,
      data.map(d => r2(d.total_energy_kwh || 0)),
      data.map(d => r2(d.total_water_liters || 0)),
      data.map(d => d.sessions_count));
    renderCostChart(lb,
      data.map(d => r2((d.total_energy_kwh || 0) * sp2)),
      data.map(d => r2(((d.total_water_liters || 0) / 1000) * wp)));
  });

  _lstByRange(from, to);
}

/** Durchschnitt-Zusammenfassung (Legacy – wird nicht mehr aktiv genutzt) */
export function rsum() {}

/** Sessions-Tabelle rendern */
export function lst(limit, year) {
  const _B = getBasePath();
  fetch(_B + '/api/sessions?limit=' + (limit || 30)).then(r => r.json()).then(sess => {
    if (!sess || !sess.length) {
      document.getElementById('stbl').innerHTML = '<p style="padding:8px;color:var(--muted)">Keine Daten</p>';
      return;
    }
    if (year) sess = sess.filter(s => s.start_time && s.start_time.substring(0, 4) === String(year));
    _renderTable(sess);
  }).catch(() => {
    document.getElementById('stbl').innerHTML = '<p style="padding:8px;color:var(--muted)">Fehler</p>';
  });
}

/** Sessions-Tabelle für Datumsbereich */
function _lstByRange(from, to) {
  const _B = getBasePath();
  fetch(_B + '/api/sessions?limit=500').then(r => r.json()).then(sess => {
    if (!sess || !sess.length) {
      document.getElementById('stbl').innerHTML = '<p style="padding:8px;color:var(--muted)">Keine Daten</p>';
      return;
    }
    sess = sess.filter(s => {
      if (!s.start_time) return false;
      const d = s.start_time.substring(0, 10);
      return d >= from && d <= to;
    });
    _renderTable(sess);
  }).catch(() => {
    document.getElementById('stbl').innerHTML = '<p style="padding:8px;color:var(--muted)">Fehler</p>';
  });
}

function _renderTable(sess) {
  if (!sess.length) {
    document.getElementById('stbl').innerHTML = '<p style="padding:8px;color:var(--muted)">Keine Daten</p>';
    return;
  }
  let h = '<table><thead><tr><th>Start</th><th>Programm</th><th>Dauer</th><th>kWh</th><th>Liter</th><th>€ S</th><th>€ W</th><th>€</th><th>Erg.</th></tr></thead><tbody>';
  sess.forEach(s => {
    const st2 = s.start_time ? s.start_time.replace('T', ' ').substring(0, 16) : '–';
    const cl = s.result === 'finished' ? 'color:var(--green)' : s.result === 'running' ? 'color:var(--orange)' : '';
    h += '<tr><td>' + st2 + '</td><td>' + (s.program || '–') + '</td><td class="n">' + (s.duration_min ? F(s.duration_min, 0) + 'm' : '–') + '</td><td class="n">' + (s.kwh_estimate ? F(s.kwh_estimate, 3) : '–') + '</td><td class="n">' + (s.liters_estimate ? F(s.liters_estimate, 1) : '–') + '</td><td class="n">' + (s.cost_strom ? F(s.cost_strom, 3) : '–') + '</td><td class="n">' + (s.cost_wasser ? F(s.cost_wasser, 3) : '–') + '</td><td class="n">' + (s.cost_total ? F(s.cost_total, 3) : '–') + '</td><td style="' + cl + '">' + (s.result || '–') + '</td></tr>';
  });
  h += '</tbody></table>';
  document.getElementById('stbl').innerHTML = h;
}

function _buildLabel(from, to) {
  if (from === to) return from;
  const f = new Date(from);
  const t = new Date(to);
  const days = Math.round((t - f) / (1000 * 60 * 60 * 24)) + 1;
  if (days <= 31) return days + ' Tage';
  return from + ' – ' + to;
}

/** CSV Export */
export function xcsv() {
  window.location.href = getBasePath() + '/api/export/csv';
}
