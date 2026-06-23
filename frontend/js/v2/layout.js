// frontend/js/v2/layout.js
// Erzeugt das komplette HTML-Skelett: header > content > footer

import { getAppleIcon } from '../icons.js';

export function buildHTMLSkeleton() {
  const root = document.body;
  if (!root) return;

  root.innerHTML = `
    <header class="app-header" style="padding-right: 20px;">
      <div class="header-left">
        <img src="" alt="" class="di" id="devImg">
        <div>
          <h1 id="app-title"><span style="color: #0ea5e9;">Geschirr</span><span style="color: #94a3b8;">spüler</span></h1>
          <div class="header-sub" id="app-subtitle">Bosch SMV4HCX48E</div>
        </div>
      </div>

      <div class="header-right">
        <span id="cs" style="font-size:.68rem"></span>
        <span id="ri" style="font-size:.68rem;color:var(--muted)"></span>
      </div>

      <div class="header-bg-wrapper" style="position: absolute; right: 20px; top: 50%; transform: translateY(-50%); pointer-events: none; z-index: 1;">
        <svg style="width: auto; height: 75px; stroke: currentColor; stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; opacity: 0.45;" viewBox="0 0 800 200">
          <circle cx="150" cy="100" r="10" stroke="#0ea5e9" stroke-width="3" fill="#0ea5e9" fill-opacity="0.1" />
          <path d="M 110 100 L 190 100 M 150 60 L 150 140" stroke="#0ea5e9" stroke-width="4" />
          <!-- Sprühdüsen-Punkte -->
          <circle cx="125" cy="100" r="3" fill="#0ea5e9" stroke="none" />
          <circle cx="175" cy="100" r="3" fill="#0ea5e9" stroke="none" />
          <circle cx="150" cy="75" r="3" fill="#0ea5e9" stroke="none" />
          <circle cx="150" cy="125" r="3" fill="#0ea5e9" stroke="none" />

          <!-- ⚡ Erste Verbindungslinie (In der Textfarbe des Dashboards) -->
          <path d="M 50 100 L 95 100 M 205 100 L 290 100 L 305 100 L 315 45 L 330 155 L 345 25 L 360 135 L 370 100 L 410 100" stroke="currentColor" stroke-width="5" />

          <!-- 🌊 Spül-Wasserwellen Mitte-Rechts (Intensiveres Blau) -->
          <path d="M 410 100 L 440 100 L 450 65 L 465 145 L 480 35 L 490 100 L 520 100" stroke="#0ea5e9" stroke-width="5" />
          <path d="M 410 115 L 435 115 L 445 80 L 460 160 L 475 50 L 485 115 L 520 115" stroke="#38bdf8" stroke-width="4" opacity="0.8" />

          <!-- ⚡ Zweite Verbindungslinie nach den Wellen -->
          <path d="M 520 100 L 590 100" stroke="currentColor" stroke-width="5" />

          <!-- ✨ Glänzende Sauberkeits-Sterne ganz rechts (Platin-Silber/Cyan) -->
          <!-- Großer Stern -->
          <path d="M 650 65 L 655 85 L 675 90 L 655 95 L 650 115 L 645 95 L 625 90 L 645 85 Z" stroke="#38bdf8" fill="#38bdf8" fill-opacity="0.15" stroke-width="3" />
          <!-- Kleiner Stern daneben -->
          <path d="M 690 105 L 693 115 L 703 117 L 693 120 L 690 130 L 687 120 L 677 117 L 687 115 Z" stroke="#94a3b8" fill="#94a3b8" fill-opacity="0.2" stroke-width="2" />

          <!-- Abschlusslinie -->
          <path d="M 715 100 L 760 100" stroke="currentColor" stroke-width="5" />
        </svg>
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

    <!-- 🌟 OPTIMIERT: Der Design-Wechsler wurde harmonisch und klickbar in den Footer integriert -->
    <footer class="app-footer" style="user-select: none;">
      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
        <div>
          <span>Geschirrspüler · Bosch SMV4HCX48E v11</span>
          <span id="footer-update" style="font-size:.65rem;color:var(--muted); margin-left: 8px;"></span>
        </div>
        <div style="font-size: .65rem;">
          <span id="themeToggleFooter" style="cursor: pointer; font-weight: 500; text-decoration: underline;">🌓 Design wechseln</span>
        </div>
      </div>
    </footer>
  `;
}
