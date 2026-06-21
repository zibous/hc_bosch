// frontend/js/v2/theme.js
// Theme-Management (Dark/Light)

import { getAppleIcon } from '../icons.js';

let dk = localStorage.getItem('dw-theme') !== 'light';

export function isDark() { return dk; }

export function initTheme() {
  applyTheme();
}

export function toggleTheme(onToggle) {
  dk = !dk;
  applyTheme();
  if (onToggle) onToggle();
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', dk ? 'dark' : 'light');
  document.body.classList.toggle('light', !dk);
  document.getElementById('themeBtn').innerHTML = dk ? getAppleIcon('moon', 16, '#94a3b8') : getAppleIcon('sun', 16, '#f59e0b');
  localStorage.setItem('dw-theme', dk ? 'dark' : 'light');
}

export function setBg(c) {
  document.body.style.background = c;
  localStorage.setItem('dw-bg', c);
}
