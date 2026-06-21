// frontend/js/v2/main.js
// Entry-Point: Layout, DateSelector, Modus-Steuerung

import { buildHTMLSkeleton } from './layout.js';
import { initTheme, toggleTheme, setBg } from './theme.js';
import { initDateSelector } from '../dateselector.js';
import {
  setBasePath, getBasePath, setConfig, setRefreshCallback,
  getCurrentMode, setCurrentMode, setPeriodParams, getPeriodParams,
  getLastState
} from './state.js';
import { resetLiveChartLoaded } from './liveChart.js';
import { ll } from './liveView.js';
import { renderDayRange, xcsv } from './historyView.js';
import { lyr } from './yearView.js';

let _rt = null;

/**
 * Callback vom DateSelector bei jeder Periodenänderung.
 */
function onPeriodChange({ period, params }) {
  setPeriodParams({ period, params });

  if (period === 'today') {
    setCurrentMode('live');
    _showLiveUI();
    ll();
  } else {
    setCurrentMode('history');
    resetLiveChartLoaded();
    _showHistoryUI();

    if (period === 'day') {
      renderDayRange(params.from, params.to);
    } else if (period === 'month') {
      const year = params.from.substring(0, 4);
      lyr(year);
    }
  }

  sr();
  _updateTimestamp();
}

function _showLiveUI() {
  document.getElementById('pbar2').style.display = 'flex';
  document.getElementById('liveChartCard').style.display = 'none';
  document.getElementById('rc').style.display = 'none';
  // History-Elemente ausblenden
  document.getElementById('cc').style.display = 'none';
  document.getElementById('ccc').style.display = 'none';
  document.getElementById('tc').style.display = 'none';
}

function _showHistoryUI() {
  document.getElementById('pbar2').style.display = 'none';
  document.getElementById('liveChartCard').style.display = 'none';
  document.getElementById('rc').style.display = 'none';
  // History-Bereiche zurücksetzen
  document.getElementById('stiles').innerHTML = '';
  document.getElementById('cgrp').innerHTML = '';
}

/** Lade-Dispatcher (Auto-Refresh) */
function ld() {
  const { period, params } = getPeriodParams();
  if (getCurrentMode() === 'live') {
    ll();
  } else if (period === 'day') {
    renderDayRange(params.from, params.to);
  } else if (period === 'month') {
    lyr(params.from.substring(0, 4));
  }
  _updateTimestamp();
}

/** Adaptive Refresh-Steuerung */
function sr() {
  if (_rt) clearInterval(_rt);
  const lastState = getLastState();
  const isLive = getCurrentMode() === 'live';
  const isRunning = (lastState === 'Run' || lastState === 'DelayedStart' || lastState === 'Pause');
  const interval = (isLive && isRunning) ? 10000 : isLive ? 60000 : 300000;
  _rt = setInterval(ld, interval);
}

function _updateTimestamp() {
  const el = document.getElementById('ri');
  if (el) el.textContent = 'Aktualisiert: ' + new Date().toLocaleTimeString('de-DE');
  const el2 = document.getElementById('footer-update');
  if (el2) el2.textContent = 'Aktualisiert: ' + new Date().toLocaleTimeString('de-DE');
}

// --- Initialisierung ---
function init() {
  // Base-Path berechnen
  const p = window.location.pathname.replace(/\/+$/, '');
  const basePath = (p === '' || p === '/index.html') ? '' : p;
  setBasePath(basePath);

  // DOM-Skelett erzeugen (schreibt nun direkt in den body)
  buildHTMLSkeleton();

  // 🌟 FIX: Absolut bombensichere Zuweisung für das Geräte-Bild!
  const deviceImage = document.getElementById('devImg');
  if (deviceImage !== null && deviceImage !== undefined) {
    deviceImage.src = basePath + '/device.png';
  }

  // Theme initialisieren + Event-Handler
  initTheme(() => {
    resetLiveChartLoaded();
    ld();
  });

  // CSV-Button
  const csvButton = document.getElementById('csvBtn');
  if (csvButton) csvButton.addEventListener('click', xcsv);

  // Refresh-Callback für State-Änderungen
  setRefreshCallback(sr);

  // DateSelector initialisieren
  const dsContainer = document.getElementById('ds-container');
  if (dsContainer) {
    initDateSelector(dsContainer, onPeriodChange, basePath);
  }

  // Konfig laden
  fetch(basePath + '/api/config').then(r => r.json()).then(cfg => {
    setConfig({
      _ld: cfg.live_days || 7,
      _di: cfg.device_installed || '',
      _feMax: cfg.forecast_energy_max_kwh || 1.05,
      _fwMax: cfg.forecast_water_max_l || 13.0
    });
  }).catch(() => {});
}


init();

/* ----------------------------------------------------
   INFO
---------------------------------------------------- */
const appinfo = {
  name: "✓ BoschDishwasher-dashboard ",
  app: "hc_smet",
  version: "3.0.0"
};

console.info(
  "%c " + appinfo.name + "    %c ▪︎▪︎▪︎▪︎ Version: " + appinfo.version + " ▪︎▪︎▪︎▪︎ ",
  "color:#FFFFFF; background:#3498db;display:inline-block;font-size:12px;font-weight:200;padding: 4px 0 4px 0",
  "color:#2c3e50; background:#ecf0f1;display:inline-block;font-size:12px;font-weight:200;padding: 4px 0 4px 0"
);
console.log("[cards-layout] loaded — version:", appinfo.version);
