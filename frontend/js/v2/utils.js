// frontend/js/v2/utils.js
// Gemeinsame Hilfsfunktionen

import { getAppleIcon } from '../icons.js';

/** Zahlen-Formatierung de-DE */
export function F(v, d) {
  d = d || 0;
  return (v || 0).toLocaleString('de-DE', {
    minimumFractionDigits: d,
    maximumFractionDigits: d
  });
}

/** Dauer in Minuten → "Xh Ym" */
export function fD(m) {
  const h = Math.floor((m || 0) / 60);
  const mi = Math.round((m || 0) % 60);
  return h > 0 ? h + 'h ' + mi + 'm' : mi + ' min';
}

/** Runden auf 2 Nachkommastellen */
export function r2(v) {
  return Math.round((v || 0) * 100) / 100;
}

/** Chart-Farben basierend auf Theme */
export function CL(dk) {
  return {
    text: dk ? '#e2e8f0' : '#0f172a',
    grid: dk ? '#334155' : '#e2e8f0',
    muted: dk ? '#64748b' : '#94a3b8'
  };
}

/** Monats-Abkürzungen */
export const MN = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

/** Status-Klasse berechnen */
export function sc(s) {
  if (!s) return 'i';
  if (s === 'Run' || s === 'DelayedStart') return 'ok';
  if (s === 'Finished') return 'ok';
  if (s === 'Error' || s === 'Aborting') return 'e';
  if (s === 'Ready' || s === 'Inactive') return 'i';
  return 'w';
}

/** Tür-Icon */
export function dI(d) {
  const lockIcon = `<svg style="width:14px;height:14px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round;display:inline-block;vertical-align:text-bottom;" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
  const unlockIcon = `<svg style="width:14px;height:14px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round;display:inline-block;vertical-align:text-bottom;" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`;
  return d === 'Closed' ? lockIcon : unlockIcon;
}

/** Betriebsdauer seit Installation */
export function da(inst) {
  if (!inst) return '–';
  const d = new Date(inst.replace(' ', 'T'));
  if (isNaN(d)) return '–';
  const n = new Date();
  let y = n.getFullYear() - d.getFullYear();
  let m = n.getMonth() - d.getMonth();
  if (m < 0) { y--; m += 12; }
  return y > 0 ? y + 'J ' + m + 'M' : m + 'M';
}

/** Spülphasen-Definition */
export const PHASES = [
  { k: 'In Bereitschaft', l: 'Bereit' },
  { k: 'Vorspülen', l: 'Vorspülen' },
  { k: 'Hauptspülen', l: 'Spülen' },
  { k: 'Klarspülen', l: 'Klarspülen' },
  { k: 'Trocknen', l: 'Trocknen' },
  { k: 'Fertig', l: 'Fertig' }
];

/** Phasen-Fortschrittsbalken rendern */
export function rpb(cur) {
  let idx = -1;
  for (let i = 0; i < PHASES.length; i++) {
    if (PHASES[i].k === cur || PHASES[i].l === cur) { idx = i; break; }
  }
  let h = '';
  for (let i = 0; i < PHASES.length; i++) {
    let cl = 'ps';
    if (i === idx) cl += ' a';
    else if (idx > 0 && i < idx) cl += ' d';
    h += '<div class="' + cl + '" data-ph="' + PHASES[i].l + '"><div class="ps-bar"></div><span>' + PHASES[i].l + '</span></div>';
  }
  document.getElementById('pbar2').innerHTML = h;
}
