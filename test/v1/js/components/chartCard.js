// frontend/js/components/chartCard.js

let dishwasherChart = null; // Speichert die Chart-Instanz global im Modul-Scope

export function renderChartCard(containerId, sessionLive) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Falls kein aktiver Spülgang läuft und keine alten Messwerte da sind, Kachel ausblenden oder Info zeigen
    if (!sessionLive || !sessionLive.readings || sessionLive.readings.length === 0) {
        container.innerHTML = `
            <div class="bg-slate-900/50 backdrop-blur border border-slate-800 p-6 rounded-2xl shadow-xl flex items-center justify-center h-64">
                <p class="text-sm text-slate-500 font-mono">Warte auf aktiven Spülgang für Live-Leistungsdiagramm...</p>
            </div>
        `;
        if (dishwasherChart) {
            dishwasherChart.destroy();
            dishwasherChart = null;
        }
        return;
    }

    // 1. Grundgerüst der Kachel einmalig bauen, falls noch nicht geschehen
    if (!document.getElementById('dishwasherLiveChart')) {
        container.innerHTML = `
            <div class="bg-slate-900/50 backdrop-blur border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
                <div class="flex justify-between items-center">
                    <h2 class="text-sm font-semibold tracking-wider text-slate-400 uppercase">Live Spülverlauf (Leistung)</h2>
                    <span class="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                        Aufzeichnung aktiv
                    </span>
                </div>
                <div class="relative w-full h-64">
                    <canvas id="dishwasherLiveChart"></canvas>
                </div>
            </div>
        `;
    }

    // 2. Daten für Chart.js aufbereiten
    // Formatiert Zeitstempel von "2026-06-13T15:19:32" zu "15:19:32"
    const labels = sessionLive.readings.map(r => {
        if (!r.timestamp) return '';
        return r.timestamp.includes('T') ? r.timestamp.split('T')[1].substring(0, 8) : r.timestamp.substring(11, 19);
    });

    const powerData = sessionLive.readings.map(r => r.power_w || 0);

    // Phasen für den Tooltip extrahieren (z.B. "Vorspülen", "Trocknen")
    const phases = sessionLive.readings.map(r => r.phase || 'Unbekannt');

    const ctx = document.getElementById('dishwasherLiveChart').getContext('2d');

    // 3. Chart-Instanz erzeugen oder bestehende Instanz updaten (Verhindert Flackern)
    if (dishwasherChart) {
        dishwasherChart.data.labels = labels;
        dishwasherChart.data.datasets[0].data = powerData;
        // Spezifisches Extra für Phasen-Tooltip updaten
        dishwasherChart.options.plugins.tooltip.callbacks.footer = (tooltipItems) => {
            const index = tooltipItems[0].dataIndex;
            return `Phase: ${phases[index]}`;
        };
        dishwasherChart.update('none'); // 'none' deaktiviert die native zappeliges Re-Animation beim Update
    } else {
        dishwasherChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Leistung (Watt)',
                    data: powerData,
                    borderColor: '#f59e0b', // Amber-Gelb passend zum Dashboard
                    borderWidth: 2,
                    pointRadius: labels.length > 50 ? 0 : 2, // Punkte bei vielen Datensätzen ausblenden für bessere Performance
                    pointBackgroundColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.05)', // Transparenter Flächen-Fill unter der Kurve
                    fill: true,
                    tension: 0.3 // Leicht geschwungene Kurve
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#64748b', font: { family: 'monospace', size: 10 }, maxTicksLimit: 8 }
                    },
                    y: {
                        grid: { color: 'rgba(100, 116, 139, 0.1)' },
                        ticks: { color: '#64748b', font: { family: 'monospace', size: 10 } },
                        suggestedMax: 2500 // Spülmaschinen-Heizelemente ziehen oft bis zu 2200W
                    }
                },
                plugins: {
                    legend: { display: false }, // Legende ausblenden, da Titel selbsterklärend
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: '#0f172a',
                        titleColor: '#94a3b8',
                        bodyColor: '#f8fafc',
                        borderColor: '#334155',
                        borderWidth: 1,
                        callbacks: {
                            footer: (tooltipItems) => {
                                const index = tooltipItems[0].dataIndex;
                                return `Phase: ${phases[index]}`;
                            }
                        }
                    }
                }
            }
        });
    }
}
