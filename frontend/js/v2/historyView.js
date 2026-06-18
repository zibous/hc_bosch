// frontend/js/v2/historyView.js
// Tages-/Perioden-basierte Historienansicht + Tabelle + CSV

import { F, fD, r2 } from './utils.js';
import { T, G } from './tiles.js';
import { renderMainChart, renderCostChart } from './chartRender.js';
import { getBasePath } from './state.js';

/**
 * Rendert den Historien-Modus für einen Tagesbereich (from/to).
 * Ersetzt die alten l30() / "Letzte X Tage" Ansichten.
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
      document.getElementById('stiles').innerHTML = G(label, T('0', 'Spülgänge', 'i'));
      document.getElementById('cgrp').innerHTML = '';
      ['cc', 'ccc', 'tc', 'sc'].forEach(id => { document.getElementById(id).style.display = 'none'; });
      return;
    }
    data = data.filter(d => d.sessions_count > 0).reverse();
    if (!data.length) {
      document.getElementById('stiles').innerHTML = G(label, T('0', 'Spülgänge', 'i'));
      document.getElementById('cgrp').innerHTML = '';
      ['cc', 'ccc', 'tc', 'sc'].forEach(id => { document.getElementById(id).style.display = 'none'; });
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

    document.getElementById('stiles').innerHTML = G('Verbrauch ' + label,
      T(ts, 'Spülgänge', 'i') + T(fD(td), 'Dauer', 'i') +
      T(F(tk, 2) + ' kWh', 'Strom', 's') + T(F(tl, 0) + ' L', 'Wasser', 'wa'));
    document.getElementById('cgrp').innerHTML = G('Kosten ' + label,
      T(F(cs2, 2) + ' €', 'Stromkosten', 's') +
      T(F(cw2, 2) + ' €', 'Wasserkosten', 'wa') +
      T(F(cs2 + cw2, 2) + ' €', 'Gesamt', 'w'));

    const lb = data.map(d => d.date ? d.date.substring(5) : '');
    renderMainChart(lb,
      data.map(d => r2(d.total_energy_kwh || 0)),
      data.map(d => r2(d.total_water_liters || 0)),
      data.map(d => d.sessions_count));
    renderCostChart(lb,
      data.map(d => r2((d.total_energy_kwh || 0) * sp2)),
      data.map(d => r2(((d.total_water_liters || 0) / 1000) * wp)));
    rsum(ts, td, tk, tl, cs2, cw2);
  });

  // Tabelle für den Zeitraum
  _lstByRange(from, to);
}

/** Durchschnitt-Zusammenfassung */
export function rsum(s, dur, kwh, lit, cs2, cw2) {
  if (s <= 1) { document.getElementById('sc').style.display = 'none'; return; }
  const ad = dur / s, ak = kwh / s, al = lit / s, ac = ((cs2 || 0) + (cw2 || 0)) / s;
  let h = '<h3>⌀ pro Spülgang</h3><div class="g">';
  h += T(F(ad, 0) + ' <span class="tu">min</span>', 'Dauer', 'i', null, null, '⏱️');
  h += T(F(ak, 3) + ' <span class="tu">kWh</span>', 'Strom', 's', null, null, '⚡');
  h += T(F(al, 1) + ' <span class="tu">L</span>', 'Wasser', 'wa', null, null, '💧');
  h += T(F(ac, 2) + ' <span class="tu">€</span>', 'Kosten', 'w', null, null, '💰');
  h += '</div>';
  document.getElementById('scc').innerHTML = h;
  document.getElementById('sc').style.display = '';
}

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
    // Nach Datumsbereich filtern
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

/** Erzeugt ein lesbares Label für den Bereich */
function _buildLabel(from, to) {
  if (from === to) return from;
  // Differenz in Tagen berechnen
  const f = new Date(from);
  const t = new Date(to);
  const days = Math.round((t - f) / (1000 * 60 * 60 * 24)) + 1;
  if (days <= 7) return days + ' Tage';
  if (days <= 31) return days + ' Tage';
  return from + ' – ' + to;
}

/** CSV Export */
export function xcsv() {
  window.location.href = getBasePath() + '/api/export/csv';
}
