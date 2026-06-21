// locales.js - Lokale Übersetzungen für den Offline-Betrieb
export const translations = {
  de: {
    theme: {
      light: "☀️ Helles Design",
      dark: "🌙 Dunkles Design"
    },
    dashboard: {
      update: (date, time) => `Update: ${date} ${time}`,
      installed: (date) => `Installiert: ${date}`,
      fetch_failed: "Datenabruf fehlgeschlagen:"
    }
  },
  en: {
    theme: {
      light: "☀️ Light Design",
      dark: "🌙 Dark Design"
    },
    dashboard: {
      update: (date, time) => `Update: ${date} ${time}`,
      installed: (date) => `Installed: ${date}`,
      fetch_failed: "Data fetch failed:"
    }
  }
};
