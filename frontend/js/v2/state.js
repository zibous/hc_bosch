// frontend/js/v2/state.js
// Zentraler App-State (vermeidet zirkuläre Imports)

let _basePath = '';
let _lastState = '';
let _refreshCallback = null;
let _config = { _ld: 7, _di: '', _feMax: 1.05, _fwMax: 13.0 };

// Aktueller Modus und Periodenparameter
let _currentMode = 'live'; // 'live' | 'history'
let _periodParams = { period: 'today', params: {} };

export function getBasePath() { return _basePath; }
export function setBasePath(p) { _basePath = p; }

export function getConfig() { return _config; }
export function setConfig(cfg) { Object.assign(_config, cfg); }

export function getLastState() { return _lastState; }
export function setLastState(s) {
  if (s !== _lastState) {
    _lastState = s;
    if (_refreshCallback) _refreshCallback();
  }
}

export function setRefreshCallback(fn) { _refreshCallback = fn; }

export function getCurrentMode() { return _currentMode; }
export function setCurrentMode(m) { _currentMode = m; }

export function getPeriodParams() { return _periodParams; }
export function setPeriodParams(p) { _periodParams = p; }
