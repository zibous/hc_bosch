// frontend/js/v2/layout.js
// Erzeugt das komplette HTML-Skelett der SPA im Root-Container

export function buildHTMLSkeleton() {
  const root = document.getElementById('app-root');
  if (!root) return;

  root.innerHTML = `
    <div class="hdr">
      <img src="" alt="" class="di" id="devImg">
      <h1>Geschirrspüler</h1>
      <span id="cs" style="font-size:.68rem;margin-left:auto;flex-shrink:0"></span>
    </div>

    <div class="ctl">
      <div id="ds-container"></div>
      <div class="rctl">
        <input type="color" id="bgPick" title="Hintergrundfarbe"
          style="width:22px;height:20px;padding:0;border:1px solid var(--border);border-radius:4px;cursor:pointer;vertical-align:middle">
        <button class="ibtn" id="themeBtn">🌙</button>
      </div>
    </div>

    <div class="grp" style="margin-bottom:8px">
      <div id="stiles"></div>
      <div id="pbar2" style="display:flex;gap:1px;margin-top:8px"></div>
    </div>

    <div class="c" id="rc" style="display:none">
      <h3>🔄 Spülgang läuft</h3>
      <div id="rcc"></div>
      <div style="margin-top:5px">
        <div class="pb"><div class="pf" id="pbar" style="width:0%"></div></div>
        <div style="text-align:center;font-size:.65rem;color:var(--muted)" id="plbl"></div>
      </div>
    </div>

    <div class="c" id="liveChartCard" style="display:none">
      <h3 id="liveChartTitle">⚡ Verbrauch</h3>
      <div class="cw"><canvas id="liveSessionChart"></canvas></div>
      <div id="phaseSummary" style="margin-top:6px;font-size:.7rem;color:var(--muted);display:flex;flex-wrap:wrap;gap:8px;justify-content:center"></div>
    </div>

    <div id="cgrp"></div>

    <div class="grp" id="lc" style="display:none">
      <div class="grp-t">📊 Letzter Spülgang</div>
      <div id="sgrid"></div>
    </div>

    <div class="grp" id="sc" style="display:none">
      <div id="scc"></div>
    </div>

    <div class="c" id="cc" style="display:none">
      <h3 id="ct">Spülgänge</h3>
      <div class="cw"><canvas id="mc"></canvas></div>
    </div>

    <div class="c" id="ccc" style="display:none">
      <h3 id="cct">Kosten</h3>
      <div class="cw"><canvas id="coc"></canvas></div>
    </div>

    <div class="c" id="tc" style="display:none">
      <h3><span id="tt2">Spülgänge</span> <button class="xb" id="csvBtn">📥 CSV</button></h3>
      <div class="tw" id="stbl"></div>
    </div>

    <div class="rf" id="ri"></div>
    <footer>Geschirrspüler · Bosch SMV4HCX48E v11</footer>
  `;
}
