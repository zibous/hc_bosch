// frontend/js/v2/layout.js
// Erzeugt das komplette HTML-Skelett: header > content > footer

import { getAppleIcon } from '../icons.js';

export function buildHTMLSkeleton() {
  const root = document.getElementById('app-root');
  if (!root) return;

  root.innerHTML = `
    <header class="app-header">
      <div class="header-left">
        <img src="" alt="" class="di" id="devImg">
        <div>
          <h1 id="app-title">Geschirrspüler</h1>
          <div class="header-sub" id="app-subtitle">Bosch SMV4HCX48E</div>
        </div>
      </div>
      <div class="header-right">
        <span id="cs" style="font-size:.68rem"></span>
        <span id="ri" style="font-size:.68rem;color:var(--muted)"></span>
        <button class="ibtn" id="themeBtn"></button>
      </div>
    </header>

    <main class="app-content">
      <div class="ctl">
        <div id="ds-container"></div>
      </div>

      <div id="stiles"></div>
      <div id="pbar2" style="display:flex;gap:1px;margin-top:4px;margin-bottom:8px"></div>

      <div class="c" id="rc" style="display:none">
        <h3>${getAppleIcon('sync', 14, 1.0, 4)} Spülgang läuft</h3>
        <div id="rcc"></div>
        <div style="margin-top:5px">
          <div class="pb"><div class="pf" id="pbar" style="width:0%"></div></div>
          <div style="text-align:center;font-size:.65rem;color:var(--muted)" id="plbl"></div>
        </div>
      </div>

      <div class="c" id="liveChartCard" style="display:none">
        <h3 id="liveChartTitle">${getAppleIcon('energy', 14, 1.0, 4)} Verbrauch</h3>
        <div class="cw"><canvas id="liveSessionChart"></canvas></div>
        <div id="phaseSummary" style="margin-top:6px;font-size:.7rem;color:var(--muted);display:flex;flex-wrap:wrap;gap:8px;justify-content:center"></div>
      </div>

      <div id="cgrp"></div>

      <div class="c" id="cc" style="display:none">
        <h3 id="ct">Spülgänge</h3>
        <div class="cw"><canvas id="mc"></canvas></div>
      </div>

      <div class="c" id="ccc" style="display:none">
        <h3 id="cct">Kosten</h3>
        <div class="cw"><canvas id="coc"></canvas></div>
      </div>

      <div class="c" id="tc" style="display:none">
        <h3><span id="tt2">Spülgänge</span> <button class="xb" id="csvBtn">${getAppleIcon('download', 12, 1.0, 3)} CSV</button></h3>
        <div class="tw" id="stbl"></div>
      </div>
    </main>

    <footer class="app-footer">
      <span>Geschirrspüler · Bosch SMV4HCX48E v11</span>
      <span id="footer-update" style="font-size:.65rem;color:var(--muted)"></span>
    </footer>
  `;
}
