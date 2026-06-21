import { translations } from './locales.js';

// Initialisiert die Sprache (Browser-Standard oder gespeicherter Wert)
let currentLang = localStorage.getItem('dashboard-lang') || navigator.language.substring(0, 2) || 'de';
if (!translations[currentLang]) currentLang = 'de'; // Fallback falls Sprache nicht existiert

export function getLang() {
  return currentLang;
}

// Gibt die passende Übersetzung oder Funktion zurück
export function t(path) {
  const keys = path.split('.');
  let result = translations[currentLang];

  for (const key of keys) {
    if (result && result[key] !== undefined) {
      result = result[key];
    } else {
      return path; // Fallback: Zeige den Key an, wenn Übersetzung fehlt
    }
  }
  return result;
}

// Sprache wechseln und UI informieren
export function changeLanguage(lng) {
  if (translations[lng]) {
    currentLang = lng;
    localStorage.setItem('dashboard-lang', lng);
    document.dispatchEvent(new CustomEvent('languageChanged'));
  }
}
