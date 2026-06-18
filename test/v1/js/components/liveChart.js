function _calculateDeltas(rd) {
    return {
        // Holt die Uhrzeit (HH:MM) für die X-Achse
        labels: rd.map(function(r) {
            return r.timestamp ? r.timestamp.substring(11, 16) : '';
        }),

        // Holt die reinen Watt-Leistungswerte
        pw: rd.map(function(r) {
            return r.power_w;
        }),

        // Berechnet den kWh-Verbrauch pro Block im Vergleich zum vorherigen Punkt
        kwh: rd.map(function(r, i, arr) {
            if (i === 0 || !r || !arr[i - 1]) return 0;
            var val = r.kwh_rel, prev = arr[i - 1].kwh_rel;
            if (val == null || prev == null) return 0;
            return Math.max(0, Math.round((val - prev) * 10000) / 10000);
        }),

        // Berechnet den Liter-Wasserverbrauch pro Block im Vergleich zum vorherigen Punkt
        lit: rd.map(function(r, i, arr) {
            if (i === 0 || !r || !arr[i - 1]) return 0;
            var val = r.liters_rel, prev = arr[i - 1].liters_rel;
            if (val == null || prev == null) return 0;
            return Math.max(0, Math.round((val - prev) * 100) / 100);
        })
    };
}

var CL = function () { return { text: dk ? '#e2e8f0' : '#0f172a', grid: dk ? '#1e2235' : '#e2e8f0', muted: dk ? '#64748b' : '#94a3b8' } };

function renderDishwasherChart(rd, dataPackage) {
    var c = CL(); // Holt deine Dashboard-Theme-Farben
    var datasets = [];

    // 1. Phasen-Farben für die Watt-Balken definieren
    var phaseColors = {
        'Vorspülen': 'rgba(100,116,139,.6)',
        'Hauptspülen': 'rgba(245,158,11,.6)',
        'Spülen': 'rgba(245,158,11,.6)',
        'Klarspülen': 'rgba(59,130,246,.6)',
        'Trocknen': 'rgba(239,68,68,.5)',
        'Fertig': 'rgba(16,185,129,.4)'
    };

    // Färbt jeden Watt-Balken passend zu seiner Spülphase ein
    var pwColors = rd.map(function (r) {
        return phaseColors[r.phase] || 'rgba(245,158,11,.5)';
    });

    // 2. Datensätze befüllen (Watt, kWh, Liter)
    if (dataPackage.pw.some(function (v) { return v !== null })) {
        datasets.push({
            label: 'Watt', data: dataPackage.pw, type: 'bar',
            backgroundColor: pwColors,
            borderColor: pwColors.map(function (col) { return col.replace(/[\d.]+\)$/, '1)') }),
            borderWidth: 1, borderRadius: 2, yAxisID: 'yW'
        });
    }
    if (dataPackage.kwh.some(function (v) { return v > 0 })) {
        datasets.push({ label: 'kWh', data: dataPackage.kwh, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,.15)', borderWidth: 2, pointRadius: 2, tension: .3, yAxisID: 'yE', fill: true });
    }
    if (dataPackage.lit.some(function (v) { return v > 0 })) {
        datasets.push({ label: 'Liter', data: dataPackage.lit, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,.15)', borderWidth: 2, pointRadius: 2, tension: .3, yAxisID: 'yL', fill: true });
    }

    // 3. Altes Chart zerstören, falls vorhanden (verhindert Grafik-Flackern)
    if (lsch) lsch.destroy();

    // 4. Achsen-Skalierung definieren
    var scales = {
        x: { ticks: { color: c.muted, maxRotation: 45, maxTicksLimit: 20, autoSkip: true, font: { size: 8 } }, grid: { color: c.grid } }
    };
    scales.yW = { position: 'left', ticks: { color: '#f59e0b', font: { size: 9 } }, grid: { color: c.grid }, title: { display: true, text: 'W', color: '#f59e0b' }, beginAtZero: true };
    scales.yE = { position: 'right', ticks: { color: '#ef4444', font: { size: 9 } }, grid: { display: false }, title: { display: true, text: 'kWh', color: '#ef4444' }, beginAtZero: true };
    scales.yL = { position: 'right', ticks: { color: '#3b82f6', font: { size: 9 } }, grid: { display: false }, title: { display: true, text: 'L', color: '#3b82f6' }, beginAtZero: true };

    // 5. Chart.js Grafik neu zeichnen
    lsch = new Chart(document.getElementById('liveSessionChart'), {
        type: 'line',
        data: { labels: dataPackage.labels, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: c.text, usePointStyle: true, font: { size: 9 } } } },
            scales: scales
        }
    });
}

// /api/session/live

// 1. Schritt: Daten vereinfacht berechnen
var datenPaket = _calculateDeltas(rd);

// 2. Schritt: Grafik direkt zeichnen lassen
renderDishwasherChart(rd, datenPaket);