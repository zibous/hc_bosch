// dateselector.js – Vereinfachter Perioden-Selektor
// "Letzte Session" = Live, Rest = History

const STORAGE_KEY = 'em-period-label';

function calcRange(key) {
    const now = new Date();
    let f = new Date(), t = new Date();
    f.setHours(0, 0, 0, 0);
    t.setHours(23, 59, 59, 999);

    switch (key) {
        case '30tage': f.setDate(now.getDate() - 29); break;
        case 'monat': f.setDate(1); break;
    }
    return { from: fmtDate(f), to: fmtDate(t) };
}

function fmtDate(d) {
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
}

/**
 * Initialize the dropdown period selector.
 * @param {HTMLElement} container - Target container element
 * @param {Function} onPeriodChange - Callback: ({period, params}) => void
 * @param {string} basePath - API base path for /api/years
 * @returns {Function} refresh - Call to re-trigger current period
 */
export function initDateSelector(container, onPeriodChange, basePath = '') {
    let savedLabel = localStorage.getItem(STORAGE_KEY) || 'Letzte Session';

    // Validierung des gespeicherten Labels
    const validLabels = ['Letzte Session', 'Letzte 30 Tage', 'Dieser Monat', 'Individuell'];
    if (!validLabels.includes(savedLabel) && !savedLabel.startsWith('Jahr ')) {
        savedLabel = 'Letzte Session';
    }

    // Inject styles
    if (!document.getElementById('ds-styles')) {
        const style = document.createElement('style');
        style.id = 'ds-styles';
        style.textContent = `
            .ds-wrap { position: relative; display: inline-flex; align-items: center; gap: 6px; }
            .ds-label { font-size: 1.0rem; color: var(--muted); text-transform: uppercase; }
            .ds-btn {
                padding: 6px 14px; border-radius: 999px;
                border: 1px solid var(--border); background: var(--surface);
                color: var(--text); cursor: pointer; font-size: .82rem; font-weight: 500;
            }
            .ds-btn::after { content: " ▾"; opacity: .6; }
            .ds-dropdown {
                position: absolute; top: calc(100% + 6px); left: 0;
                min-width: 220px; border-radius: 12px; padding: 6px;
                z-index: 9999; max-height: 420px; overflow-y: auto;
                backdrop-filter: blur(30px) saturate(160%);
                -webkit-backdrop-filter: blur(30px) saturate(160%);
                box-shadow: 0 16px 48px rgba(0,0,0,.35);
                background: rgba(13, 20, 38, 0.94);
                border: 1px solid rgba(255,255,255,.12);
            }
            body.light .ds-dropdown {
                background: rgba(255,255,255,.92);
                border: 1px solid rgba(0,0,0,.08);
                box-shadow: 0 16px 48px rgba(0,0,0,.15);
            }
            .ds-dropdown.hidden { display: none; }
            .ds-section {
                font-size: .68rem; font-weight: 700; color: var(--muted);
                padding: 8px 12px 2px; text-transform: uppercase; letter-spacing: .5px;
            }
            .ds-item {
                padding: 8px 12px; border-radius: 8px; font-size: .82rem;
                color: var(--text); cursor: pointer;
            }
            .ds-item:hover { background: rgba(128,128,128,.12); }
            .ds-item.active { background: var(--accent); color: #fff; }
            .ds-select {
                width: calc(100% - 24px); margin: 4px 12px; padding: 6px;
                border-radius: 6px; border: 1px solid var(--border);
                background: var(--surface); color: var(--text); font-size: .82rem;
            }
            .ds-custom { padding: 8px 12px; display: none; }
            .ds-custom.show { display: flex; flex-direction: column; gap: 6px; }
            .ds-custom input {
                padding: 5px 8px; border-radius: 6px; border: 1px solid var(--border);
                background: var(--surface); color: var(--text); font-size: .82rem;
            }
            .ds-custom button {
                padding: 6px; border-radius: 6px; border: none;
                background: var(--accent); color: #fff; font-size: .82rem;
                cursor: pointer; font-weight: 600;
            }
        `;
        document.head.appendChild(style);
    }

    // Build HTML
    const wrap = document.createElement('div');
    wrap.className = 'ds-wrap';
    wrap.innerHTML = `
        <span class="ds-label">Zeitraum</span>
        <button class="ds-btn" id="dsBtn">${savedLabel}</button>
        <div class="ds-dropdown hidden" id="dsDrop">
            <div class="ds-section">Aktuell</div>
            <div class="ds-item" data-key="live">Letzte Session</div>
            <div class="ds-section">Zeitraum</div>
            <div class="ds-item" data-key="30tage">Letzte 30 Tage</div>
            <div class="ds-item" data-key="monat">Dieser Monat</div>
            <div class="ds-section">Archiv</div>
            <select class="ds-select" id="dsYear">
                <option value="">Jahr auswählen…</option>
            </select>
            <div class="ds-section" style="cursor:pointer" id="dsCustomToggle">Benutzerdefiniert…</div>
            <div class="ds-custom" id="dsCustom">
                <input type="date" id="dsFrom">
                <input type="date" id="dsTo">
                <button id="dsApply">Anwenden</button>
            </div>
        </div>
    `;

    container.appendChild(wrap);

    const btn = wrap.querySelector('#dsBtn');
    const drop = wrap.querySelector('#dsDrop');
    const yearSel = wrap.querySelector('#dsYear');
    const customToggle = wrap.querySelector('#dsCustomToggle');
    const customBox = wrap.querySelector('#dsCustom');
    const fromInput = wrap.querySelector('#dsFrom');
    const toInput = wrap.querySelector('#dsTo');
    const applyBtn = wrap.querySelector('#dsApply');

    // Jahre dynamisch aus der API laden
    fetch(basePath + '/api/years').then(r => r.json()).then(years => {
        if (!years || !years.length) return;
        yearSel.innerHTML = '<option value="">Jahr auswählen…</option>';
        years.forEach(y => {
            yearSel.innerHTML += `<option value="${y}">Jahr ${y}</option>`;
        });
        // Wenn gespeichertes Label ein Jahr ist, vorselektieren
        if (savedLabel.startsWith('Jahr ')) {
            yearSel.value = savedLabel.replace('Jahr ', '');
        }
    }).catch(() => {});

    // Toggle dropdown
    btn.addEventListener('click', (e) => { e.stopPropagation(); drop.classList.toggle('hidden'); });
    document.addEventListener('click', () => drop.classList.add('hidden'));
    drop.addEventListener('click', (e) => e.stopPropagation());

    // Fire period change
    function fire(label) {
        savedLabel = label;
        localStorage.setItem(STORAGE_KEY, label);
        btn.textContent = label;
        drop.classList.add('hidden');

        // Highlight active
        drop.querySelectorAll('.ds-item').forEach(el => {
            el.classList.toggle('active', el.textContent.trim() === label);
        });

        if (label === 'Letzte Session') {
            onPeriodChange({ period: 'today', params: {} });
        } else if (label === 'Letzte 30 Tage') {
            const range = calcRange('30tage');
            onPeriodChange({ period: 'day', params: { from: range.from, to: range.to } });
        } else if (label === 'Dieser Monat') {
            const range = calcRange('monat');
            onPeriodChange({ period: 'day', params: { from: range.from, to: range.to } });
        } else if (label.startsWith('Jahr ')) {
            const y = label.replace('Jahr ', '');
            onPeriodChange({ period: 'month', params: { from: y + '-01', to: y + '-12' } });
        } else if (label === 'Individuell') {
            const f = fromInput.value;
            const t = toInput.value;
            if (f && t) {
                onPeriodChange({ period: 'day', params: { from: f, to: t } });
            }
        }
    }

    // Item clicks
    drop.querySelectorAll('.ds-item').forEach(item => {
        item.addEventListener('click', () => {
            const key = item.dataset.key;
            const labels = { live: 'Letzte Session', '30tage': 'Letzte 30 Tage', monat: 'Dieser Monat' };
            fire(labels[key] || key);
        });
    });

    // Year select
    yearSel.addEventListener('change', () => {
        if (yearSel.value) fire('Jahr ' + yearSel.value);
    });

    // Custom toggle
    customToggle.addEventListener('click', () => customBox.classList.toggle('show'));

    // Custom apply
    applyBtn.addEventListener('click', () => {
        if (fromInput.value && toInput.value) fire('Individuell');
    });

    // Initial fire
    fire(savedLabel);

    // Return refresh function
    return function () { fire(savedLabel); };
}
