export function renderLiveCard(containerId, liveData) {
    const container = document.getElementById(containerId);
    if (!container || !liveData) return;

    const state = liveData.state || {};
    const isRunning = ["Run", "DelayedStart", "Pause"].includes(state.state);

    container.innerHTML = `
        <div class="bg-slate-900/50 backdrop-blur border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
            <div class="flex justify-between items-center">
                <h2 class="text-sm font-semibold tracking-wider text-slate-400 uppercase">Live-Status</h2>
                <span class="px-3 py-1 rounded-full text-xs font-black tracking-wide ${isRunning ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}">
                    ${state.state || 'STANDBY'}
                </span>
            </div>

            <div class="grid grid-cols-2 gap-4 pt-2">
                <div>
                    <p class="text-xs text-slate-500 font-medium">Gewähltes Programm</p>
                    <p class="text-lg font-bold text-slate-200">${state.programm || 'Keins'}</p>
                </div>
                <div>
                    <p class="text-xs text-slate-500 font-medium">Aktuelle Phase</p>
                    <p class="text-lg font-bold text-slate-200">${state.phase || '-'}</p>
                </div>
                <div>
                    <p class="text-xs text-slate-500 font-medium">Restlaufzeit</p>
                    <p class="text-lg font-bold text-cyan-400 font-mono">${state.remaining || '0:00'}</p>
                </div>
                <div>
                    <p class="text-xs text-slate-500 font-medium">Live-Leistung</p>
                    <p class="text-lg font-bold text-amber-400 font-mono">${liveData.current_power_w || 0} W</p>
                </div>
            </div>

            <!-- Progress Bar -->
            <div class="space-y-1 pt-2">
                <div class="flex justify-between text-xs text-slate-500 font-mono">
                    <span>Fortschritt</span>
                    <span>${state.progress || 0}%</span>
                </div>
                <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div class="bg-gradient-to-r from-blue-500 to-cyan-400 h-full transition-all duration-500" style="width: ${state.progress || 0}%"></div>
                </div>
            </div>
        </div>
    `;
}
