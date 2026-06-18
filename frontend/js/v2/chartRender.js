// frontend/js/v2/chartRender.js
// Chart-Instanz-Management und Rendering

import { CO, DS, costDS, costOpts, getChartColors } from './chartBase.js';
import { r2 } from './utils.js';

let mch = null;
let cch = null;

export function getMainChart() { return mch; }
export function getCostChart() { return cch; }

/** Haupt-Verbrauchschart rendern */
export function renderMainChart(labels, kwData, liData, cnData) {
  const c = getChartColors();
  if (mch) mch.destroy();
  mch = new Chart(document.getElementById('mc'), {
    type: 'bar',
    data: { labels, datasets: DS(kwData, liData, cnData) },
    options: CO(c)
  });
}

/** Kosten-Chart rendern */
export function renderCostChart(labels, csData, cwData) {
  const c = getChartColors();
  if (cch) cch.destroy();
  cch = new Chart(document.getElementById('coc'), {
    type: 'bar',
    data: { labels, datasets: costDS(csData, cwData) },
    options: costOpts(c)
  });
}

/** Alle Charts zerstören (Cleanup) */
export function destroyCharts() {
  if (mch) { mch.destroy(); mch = null; }
  if (cch) { cch.destroy(); cch = null; }
}
