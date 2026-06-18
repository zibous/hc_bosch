// frontend/js/v2/theme.js
// Theme-Management (Dark/Light)

let dk = localStorage.getItem('dw-theme') !== 'light';

export function isDark() { return dk; }

export function initTheme() {
  applyTheme();
  try {
    const bgC = localStorage.getItem('dw-bg') || '';
    if (bgC) document.body.style.background = bgC;
    document.getElementById('bgPick').value = bgC || getComputedStyle(document.body).getPropertyValue('--bg').trim();
  } catch (e) { /* ignore */ }
}

export function toggleTheme(onToggle) {
  dk = !dk;
  applyTheme();
  if (onToggle) onToggle();
}

function applyTheme() {
  document.body.classList.toggle('light', !dk);
  document.getElementById('themeBtn').textContent = dk ? '🌙' : '☀️';
  localStorage.setItem('dw-theme', dk ? 'dark' : 'light');
}

export function setBg(c) {
  document.body.style.background = c;
  localStorage.setItem('dw-bg', c);
}
