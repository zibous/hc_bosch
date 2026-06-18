// frontend/js/v2/chartBase.js
// Chart.js Optionen- und Dataset-Builder

import { CL } from './utils.js';
import { isDark } from './theme.js';

/** Standard-Chart-Optionen (Verbrauch) */
export function CO(c, yt) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: c.text, usePointStyle: true, font: { size: 9 } }
      }
    },
    scales: {
      x: {
        ticks: { color: c.muted, maxRotation: 45, font: { size: 8 } },
        grid: { color: c.grid }
      },
      y: {
        position: 'left',
        ticks: { color: '#ef4444', font: { size: 9 } },
        grid: { color: c.grid },
        title: { display: true, text: 'kWh', color: '#ef4444' },
        beginAtZero: true
      },
      y2: {
        position: 'right',
        ticks: { color: '#3b82f6', font: { size: 9 } },
        grid: { display: false },
        title: { display: true, text: 'Liter', color: '#3b82f6' },
        beginAtZero: true
      },
      y1: { display: false }
    }
  };
}

/** Verbrauchs-Datasets (kWh, Liter, Sessions) */
export function DS(kw, li, cn) {
  return [
    { label: 'kWh', data: kw, backgroundColor: '#ef4444cc', borderRadius: 3, yAxisID: 'y', maxBarThickness: 40 },
    { label: 'Liter', data: li, backgroundColor: '#3b82f6cc', borderRadius: 3, yAxisID: 'y2', maxBarThickness: 40 },
    { label: 'Sessions', data: cn, type: 'line', borderColor: '#f59e0b', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 3, tension: 0.3, yAxisID: 'y1' }
  ];
}

/** Kosten-Datasets (Strom €, Wasser €) */
export function costDS(cs, cw) {
  return [
    { label: 'Strom €', data: cs, backgroundColor: '#ef4444cc', borderRadius: 3, stack: 'c' },
    { label: 'Wasser €', data: cw, backgroundColor: '#3b82f6cc', borderRadius: 3, stack: 'c' }
  ];
}

/** Kosten-Chart-Optionen */
export function costOpts(c) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: c.text, usePointStyle: true, font: { size: 9 } }
      }
    },
    scales: {
      x: {
        ticks: { color: c.muted, maxRotation: 45, font: { size: 8 } },
        grid: { color: c.grid }
      },
      y: {
        stacked: true,
        ticks: { color: c.muted, font: { size: 9 } },
        grid: { color: c.grid },
        title: { display: true, text: '€', color: c.muted }
      }
    }
  };
}

/** Liefert aktuelle Theme-Farben */
export function getChartColors() {
  return CL(isDark());
}
