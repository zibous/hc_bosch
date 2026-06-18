export function renderDebugCard(containerId, threadData) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!threadData) {
        container.innerHTML = `<p class="text-xs text-red-400 font-mono">Core-Diagnose nicht erreichbar</p>`;
        return;
    }

    const threadBadges = threadData.threads.map(t => `
        <div class="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800/80">
            <span class="w-2 h-2 rounded-full ${t.is_alive ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}"></span>
            <span class="text-xs font-mono text-slate-300">${t.name}</span>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="bg-slate-900/20 p-4 rounded-xl border border-slate-900 space-y-3">
            <h3 class="text-xs font-bold tracking-widest text-slate-500 uppercase">Core Thread-Zustand</h3>
            <div class="flex flex-wrap gap-3">
                ${threadBadges}
            </div>
        </div>
    `;
}
