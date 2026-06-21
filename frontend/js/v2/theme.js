// frontend/js/v2/theme.js
// Theme-Management (Dark/Light)

// Initialisiert das Theme (Standardmäßig dark, es sei denn, health-theme oder dw-theme ist explizit light)
let dk = localStorage.getItem('health-theme') !== 'light' && localStorage.getItem('dw-theme') !== 'light';

export function isDark() { return dk; }

export function initTheme(onToggle) {
  applyTheme();

  // Globaler Klick-Abfänger für den neuen Footer-Link
  document.addEventListener('click', (event) => {
    if (event.target && event.target.id === 'themeToggleFooter') {
      toggleTheme(onToggle);
    }
  });
}

export function toggleTheme(onToggle) {
  dk = !dk;
  applyTheme();
  if (onToggle) onToggle();
}

function applyTheme() {
  const themeValue = dk ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', themeValue);
  document.body.classList.toggle('light', !dk);

  // 🌟 FIX: Sicherheitsabfrage eingebaut, falls der Footer im DOM noch nicht existiert!
  const footerBtn = document.getElementById('themeToggleFooter');
  if (footerBtn) {
    footerBtn.innerHTML = dk ? '☀️ Helles Design' : '🌙 Dunkles Design';
  }

  // Synchronisation für das aktuelle und alle anderen Dashboards im Projekt
  localStorage.setItem('dw-theme', themeValue);
  localStorage.setItem('health-theme', themeValue);
}

export function setBg(c) {
  document.body.style.background = c;
  localStorage.setItem('dw-bg', c);
}
