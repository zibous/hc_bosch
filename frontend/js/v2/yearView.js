// frontend/js/v2/yearView.js
// Jahres-Ansicht und Alle-Jahre-Ansicht

import { F, fD, r2, MN } from './utils.js';
import { T, G } from './tiles.js';
import { renderMainChart, renderCostChart } from './chartRender.js';
import { getBasePath } from './state.js';
import { rsum, lst } from './historyView.js';

/**
 * Jahres-Ansicht – zeigt Monatswerte eines bestimmten Jahres
 * @param {string} year - z.B. "2024"
 */
export function lyr(year) {
  const _B = getBasePath();
  year = year || String(new Date().getFullYear());

  document.getElementById('cs').innerHTML = '';
  ['cc', 'ccc', 'tc'].forEach(id => { document.getElementById(id).style.display = ''; });
  document.getElementById('ct').textContent = 'Verbrauch ' + year;
  document.getElementById('cct').textContent = 'Kosten ' + year;
  document.getElementById('tt2').textContent = 'Spülgänge ' + year;

  Promise.all([
    fetch(_B + '/api/monthly?year=' + year).then(r => r.json()),
    fetch(_B + '/api/sessions?limit=200').then(r => r.json())
  ]).then(([data]) => {
    if (!data) { document.getElementById('stiles').innerHTML = ''; return; }
    let ts = 0, tk = 0, tl = 0, tcs = 0, tcw = 0, td = 0;
    data.forEach(d => {
      ts += d.sessions_count; tk += d.kwh || 0; tl += d.liters || 0;
      tcs += d.cost_strom || 0; tcw += d.cost_wasser || 0; td += d.total_duration_min || 0;
    });

    document.getElementById('stiles').innerHTML = G('Verbrauch ' + year,
      T(ts, 'Spülgänge', 'i') + T(fD(td), 'Dauer', 'i') +
      T(F(tk, 1) + ' kWh', 'Strom', 's') + T(F(tl, 0) + ' L', 'Wasser', 'wa'));
    document.getElementById('cgrp').innerHTML = G('Kosten ' + year,
      T(F(tcs, 2) + ' €', 'Stromkosten', 's') +
      T(F(tcw, 2) + ' €', 'Wasserkosten', 'wa') +
      T(F(tcs + tcw, 2) + ' €', 'Gesamt', 'w'));

    const lb = data.map(d => {
      const m = parseInt(d.month.substring(5));
      return MN[m - 1] || d.month;
    });
    renderMainChart(lb,
      data.map(d => d.kwh || 0),
      data.map(d => d.liters || 0),
      data.map(d => d.sessions_count || 0));
    renderCostChart(lb,
      data.map(d => d.cost_strom || 0),
      data.map(d => d.cost_wasser || 0));
    rsum(ts, td, tk, tl, tcs, tcw);
  });
  lst(200, year);
}

/**
 * Alle-Jahre-Ansicht – Gesamtüberblick aller Jahre
 */
export function lall() {
  const _B = getBasePath();
  document.getElementById('cs').innerHTML = '';
  ['cc', 'ccc', 'tc'].forEach(id => { document.getElementById(id).style.display = ''; });
  document.getElementById('ct').textContent = 'Alle Jahre';
  document.getElementById('cct').textContent = 'Kosten alle Jahre';
  document.getElementById('tt2').textContent = 'Alle Spülgänge';

  Promise.all([
    fetch(_B + '/api/years').then(r => r.json()),
    fetch(_B + '/api/costs').then(r => r.json()),
    fetch(_B + '/api/sessions?limit=9999').then(r => r.json())
  ]).then(([years, allC, sess]) => {
    years = years || []; allC = allC || {}; sess = sess || [];
    if (!years.length) { document.getElementById('stiles').innerHTML = ''; return; }

    const yd = [];
    let gts = 0, gtk = 0, gtl = 0, gtcs = 0, gtcw = 0, gtd = 0;

    years.sort().forEach(y => {
      const ys = sess.filter(s => s.start_time && s.start_time.substring(0, 4) === y && s.result !== 'running');
      const co = allC[parseInt(y)] || { strom: 0.23, wasser: 6.97 };
      let tk = 0, tl2 = 0, td2 = 0;

      ys.forEach(s => {
        let ek = s.energy_kwh || 0, wl = s.water_liters || 0;
        if (!ek && s.energy_forecast) ek = r2(1.05 * s.energy_forecast / 100);
        if (!wl && s.water_forecast) wl = r2(10 * s.water_forecast / 100);
        tk += ek; tl2 += wl; td2 += (s.duration_min || 0);
      });

      const cs2 = r2(tk * (co.strom || 0));
      const cw2 = r2((tl2 / 1000) * (co.wasser || 0));
      yd.push({ year: y, sessions: ys.length, kwh: r2(tk), liters: r2(tl2), costS: cs2, costW: cw2 });
      gts += ys.length; gtk += tk; gtl += tl2; gtcs += cs2; gtcw += cw2; gtd += td2;
    });

    document.getElementById('stiles').innerHTML = G('Alle Jahre',
      T(gts, 'Spülgänge', 'i') + T(fD(gtd), 'Dauer', 'i') +
      T(F(gtk, 1) + ' kWh', 'Strom', 's') + T(F(gtl, 0) + ' L', 'Wasser', 'wa'));
    document.getElementById('cgrp').innerHTML = G('Kosten gesamt',
      T(F(gtcs, 2) + ' €', 'Strom', 's') +
      T(F(gtcw, 2) + ' €', 'Wasser', 'wa') +
      T(F(gtcs + gtcw, 2) + ' €', 'Gesamt', 'w'));

    const lb = yd.map(d => d.year);
    renderMainChart(lb, yd.map(d => d.kwh), yd.map(d => d.liters), yd.map(d => d.sessions));
    renderCostChart(lb, yd.map(d => d.costS), yd.map(d => d.costW));
    rsum(gts, gtd, gtk, gtl, gtcs, gtcw);
  });
  lst(9999);
}
