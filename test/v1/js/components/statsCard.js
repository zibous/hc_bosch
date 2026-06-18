export function renderStatsCard(containerId, liveData) {
    const container = document.getElementById(containerId);
    if (!container || !liveData) return;

    const today = liveData.today || { kwh: 0, liters: 0, sessions: 0, duration_min: 0 };

    container.innerHTML = `
        <div class="bg-slate-900/50 backdrop-blur border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
            <h2 class="text-sm font-semibold tracking-wider text-slate-400 uppercase">Verbrauch Heute</h2>

            <div class="space-y-3">
                <div class="flex justify-between items-center border-b border-slate-800/50 pb-2">
                    <span class="text-slate-400 text-sm">Spülgänge</span>
                    <span class="font-bold text-slate-100 font-mono text-lg">${today.sessions}</span>
                </div>
                <div class="flex justify-between items-center border-b border-slate-800/50 pb-2">
                    <span class="text-slate-400 text-sm">Stromverbrauch</span>
                    <span class="font-bold text-emerald-400 font-mono">${today.kwh.toFixed(2)} kWh</span>
                </div>
                <div class="flex justify-between items-center border-b border-slate-800/50 pb-2">
                    <span class="text-slate-400 text-sm">Wasserverbrauch</span>
                    <span class="font-bold text-blue-400 font-mono">${today.liters.toFixed(1)} Liter</span>
                </div>
                <div class="flex justify-between items-center pt-1">
                    <span class="text-slate-400 text-sm font-medium">Kosten (Gesamt)</span>
                    <span class="font-black text-slate-100 font-mono text-xl">
                        ${((today.kwh * 0.23) + (today.liters / 1000 * 6.97)).toFixed(2)} €
                    </span>
                </div>
            </div>
        </div>
    `;
}
