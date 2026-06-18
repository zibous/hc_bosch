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
  // Live-spezifisch einblenden
  document.getElementById('lc').style.display = '';
  document.getElementById('pbar2').style.display = 'flex';
  // Live-dynamisch (werden von ll() gesteuert)
  document.getElementById('liveChartCard').style.display = 'none';
  document.getElementById('rc').style.display = 'none';
  // History-Elemente ausblenden
  document.getElementById('cc').style.display = 'none';
  document.getElementById('ccc').style.display = 'none';
  document.getElementById('tc').style.display = 'none';
}

function _showHistoryUI() {
  // Live-spezifisch ausblenden
  document.getElementById('lc').style.display = 'none';
  document.getElementById('pbar2').style.display = 'none';
  document.getElementById('liveChartCard').style.display = 'none';
  document.getElementById('rc').style.display = 'none';
  document.getElementById('sc').style.display = 'none';
  // History-Bereiche zurücksetzen (werden von renderDayRange/lyr gefüllt)
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
}

// --- Initialisierung ---
function init() {
  // Base-Path berechnen
  const p = window.location.pathname.replace(/\/+$/, '');
  const basePath = (p === '' || p === '/index.html') ? '' : p;
  setBasePath(basePath);

  // DOM-Skelett erzeugen
  buildHTMLSkeleton();

  // Device-Bild setzen
  document.getElementById('devImg').src = basePath + '/device.png';

  // Theme initialisieren + Event-Handler
  initTheme();
  document.getElementById('themeBtn').addEventListener('click', () => toggleTheme(ld));
  document.getElementById('bgPick').addEventListener('input', e => setBg(e.target.value));

  // CSV-Button
  document.getElementById('csvBtn').addEventListener('click', xcsv);

  // Refresh-Callback für State-Änderungen
  setRefreshCallback(sr);

  // DateSelector initialisieren
  initDateSelector(document.getElementById('ds-container'), onPeriodChange, basePath);

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
