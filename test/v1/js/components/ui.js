/**
 * Rendert die Gerätestatus-Kacheln (Programmfortschritt, Temperatur, etc.)
 * @param {Object} liveData - Das 'allData.live'-Objekt aus deiner API
 */
export function renderStatusCards(liveData) {
    const liveContainer = document.getElementById('live-container');
    const statsContainer = document.getElementById('stats-container');

    if (!liveData) return;

    // 1. LINKE SPALTE: Live-Zustand (Programm & Temperatur)
    if (liveContainer) {
        // Werte aus deiner API auslesen (mit Fallbacks, falls mal ein Wert fehlt)
        const phase = liveData.phase || "Inaktiv";
        const progress = liveData.progress ?? 0;
        const temperature = liveData.temperature ?? 0;
        const heatingActive = liveData.heating_active ?? false;

        liveContainer.innerHTML = `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <!-- Kachel: Aktuelles Programm -->
                <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col justify-between">
                    <div>
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Aktuelles Programm</span>
                            <span class="${progress > 0 && progress < 100 ? 'animate-pulse bg-cyan-400' : 'bg-slate-700'} flex h-2 w-2 rounded-full"></span>
                        </div>
                        <h3 class="text-2xl font-bold text-cyan-400 flex items-center gap-2">
                            🔄 ${phase}
                        </h3>
                    </div>
                    <div class="mt-4">
                        <div class="flex justify-between text-xs text-slate-400 mb-1">
                            <span>Fortschritt</span>
                            <span>${progress}%</span>
                        </div>
                        <div class="w-full bg-slate-800 rounded-full h-2">
                            <div class="bg-gradient-to-r from-blue-500 to-cyan-400 h-2 rounded-full transition-all duration-500" style="width: ${progress}%"></div>
                        </div>
                    </div>
                </div>

                <!-- Kachel: Live Temperatur -->
                <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
                    <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Heizsystem</span>
                    <h3 class="text-4xl font-black text-slate-100 mt-2 flex items-baseline gap-1">
                        ${temperature} <span class="text-xl font-normal text-slate-400">°C</span>
                    </h3>
                    <p class="text-xs mt-2 flex items-center gap-1 ${heatingActive ? 'text-emerald-400' : 'text-slate-500'}">
                        ${heatingActive ? '🔥 Heizstab aktiv' : '❄️ Heizung aus'}
                    </p>
                </div>
            </div>
        `;
    }

    // 2. RECHTE SPALTE: Statistiken & Füllstände
    if (statsContainer) {
        const waterUsage = liveData.water_usage ?? 0;
        const saltLevel = liveData.salt_status || "OK";
        const rinseAid = liveData.rinse_aid_status || "OK";

        statsContainer.innerHTML = `
            <div class="space-y-6">
                <!-- Kachel: Wasserverbrauch -->
                <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
                    <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Wasserverbrauch (Aktuell)</span>
                    <div class="flex justify-between items-center mt-2">
                        <h3 class="text-3xl font-bold text-blue-400">${waterUsage} L</h3>
                        <span class="text-xs bg-blue-500/10 text-blue-400 px-2 py-1 rounded border border-blue-500/20">Eco-Modus</span>
                    </div>
                </div>

                <!-- Kachel: System-Füllstände -->
                <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
                    <span class="text-xs font-semibold uppercase tracking-wider text-slate-400 block">System-Komponenten</span>

                    <!-- Spezialsalz -->
                    <div class="flex justify-between items-center border-b border-slate-800 pb-2">
                        <span class="text-sm text-slate-300"> Eustach-Salz</span>
                        <span class="text-xs font-bold px-2 py-0.5 rounded ${saltLevel === 'OK' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'}">
                            ${saltLevel}
                        </span>
                    </div>

                    <!-- Klarspüler -->
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-slate-300">✨ Klarspüler</span>
                        <span class="text-xs font-bold px-2 py-0.5 rounded ${rinseAid === 'OK' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'}">
                            ${rinseAid}
                        </span>
                    </div>
                </div>
            </div>
        `;
    }
}
