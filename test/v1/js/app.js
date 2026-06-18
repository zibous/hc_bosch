// frontend/js/app.js

import { fetchAllData, fetchThreadData } from './api.js';
import { renderLiveCard } from './components/liveCard.js';
import { renderStatsCard } from './components/statsCard.js';
import { renderDebugCard } from './components/debugCard.js';
import { renderStatusCards } from './components/ui.js';


import { renderChartCard } from './components/chartCard.js';

async function tick() {
    const [allData, threadData] = await Promise.all([
        fetchAllData(),
        fetchThreadData()
    ]);

    const badge = document.getElementById('connection-badge');
    if (allData && badge) {
        const isOnline = allData.health?.device_connected;
        badge.innerText = isOnline ? "BOSCH CLOUD ONLINE" : "OFFLINE MODE";
        badge.className = `text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`;
    }

    if (allData) {
        renderLiveCard('live-container', allData.live);
        renderStatsCard('stats-container', allData.live);
        renderStatusCards(allData.live);

        // 2. DIAGRAMM MIT LIVE-DATEN SPEISEN
        // Nutzt das vom Backend vorbereitete 'session_live'-Objekt
        renderChartCard('chart-container', allData.session_live);
    }
    renderDebugCard('debug-container', threadData);
}

tick();
setInterval(tick, 5000);
