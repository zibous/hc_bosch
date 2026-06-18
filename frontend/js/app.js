    
        /* Base path for reverse proxy */
        var _B = (function () { var p = window.location.pathname.replace(/\/+$/, ''); return (p === '' || p === '/index.html') ? '' : p })();
        document.getElementById('devImg').src = _B + '/static/device.png';
        
        /* Background color picker */
        var _bgC = localStorage.getItem('dw-bg') || '';
        function setBg(c) { document.body.style.background = c; localStorage.setItem('dw-bg', c) }
        if (_bgC) document.body.style.background = _bgC;
        
        /* Theme */
        var dk = localStorage.getItem('dw-theme') !== 'light', mch = null, cch = null, lsch = null, cp = 'live', _ld = 7, _di = '', _feMax = 1.05, _fwMax = 13.0;
        function at() { document.body.classList.toggle('light', !dk); document.getElementById('themeBtn').textContent = dk ? '🌙' : '☀️'; localStorage.setItem('dw-theme', dk ? 'dark' : 'light'); if (mch) ld() }
        function tt() { dk = !dk; at() }
        at();
        try { document.getElementById('bgPick').value = _bgC || getComputedStyle(document.body).getPropertyValue('--bg').trim() } catch (e) { }
        
        /* Helpers */
        var F = function (v, d) { d = d || 0; return (v || 0).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }) };
        var fD = function (m) { var h = Math.floor((m || 0) / 60), mi = Math.round((m || 0) % 60); return h > 0 ? h + 'h ' + mi + 'm' : mi + ' min' };
        var r2 = function (v) { return Math.round((v || 0) * 100) / 100 };
        var CL = function () { return { text: dk ? '#e2e8f0' : '#0f172a', grid: dk ? '#1e2235' : '#e2e8f0', muted: dk ? '#64748b' : '#94a3b8' } };
        var MN = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
        function sc(s) { if (!s) return 'i'; if (s === 'Run' || s === 'DelayedStart') return 'ok'; if (s === 'Finished') return 'ok'; if (s === 'Error' || s === 'Aborting') return 'e'; if (s === 'Ready' || s === 'Inactive') return 'i'; return 'w' }
        function dI(d) { return d === 'Closed' ? '🔒' : '🔓' }
        var _ph = [{ k: 'In Bereitschaft', l: 'Bereit' }, { k: 'Vorspülen', l: 'Vorspülen' }, { k: 'Hauptspülen', l: 'Spülen' }, { k: 'Klarspülen', l: 'Klarspülen' }, { k: 'Trocknen', l: 'Trocknen' }, { k: 'Fertig', l: 'Fertig' }];
        function rpb(cur) { var idx = -1; for (var i = 0; i < _ph.length; i++) { if (_ph[i].k === cur || _ph[i].l === cur) { idx = i; break } } var h = ''; for (var i = 0; i < _ph.length; i++) { var cl = 'ps'; if (i === idx) cl += ' a'; else if (idx > 0 && i < idx) cl += ' d'; h += '<div class="' + cl + '" data-ph="' + _ph[i].l + '"><div class="ps-bar"></div><span>' + _ph[i].l + '</span></div>' } document.getElementById('pbar2').innerHTML = h }
        function da(inst) { if (!inst) return '–'; var d = new Date(inst.replace(' ', 'T')); if (isNaN(d)) return '–'; var n = new Date(), y = n.getFullYear() - d.getFullYear(), m = n.getMonth() - d.getMonth(); if (m < 0) { y--; m += 12 } return y > 0 ? y + 'J ' + m + 'M' : m + 'M' }
        function T(v, l, c, sub, gauge, icon) {
            var h = '<div class="t"><div class="tl">' + l + '</div>';
            if (icon) h += '<div class="ticon">' + icon + '</div>';
            h += '<div class="tv ' + c + '">' + v + '</div>';
            if (sub) h += '<div class="tsub">' + sub + '</div>';
            if (gauge) h += '<div class="tgauge"><div class="tgauge-fill" style="width:' + Math.min(100, Math.max(0, gauge.pct || 0)) + '%;background:' + (gauge.color || 'var(--accent)') + '"></div></div>';
            return h + '</div>';
        }
        function G(t, ti) { return '<div class="grp"><div class="grp-t">' + t + '</div><div class="g">' + ti + '</div></div>' }
        function sp(p) {
            cp = p; _lschLoaded = false; localStorage.setItem('dw-tab', p); document.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('on', t.dataset.p === p) }); document.getElementById('ys').style.display = p === 'year' ? '' : 'none'; document.getElementById('lc').style.display = p === 'live' ? '' : 'none';
            document.getElementById('pbar2').style.display = p === 'live' ? 'flex' : 'none';
            document.getElementById('liveChartCard').style.display = 'none'; document.getElementById('rc').style.display = 'none'; document.getElementById('sc').style.display = 'none'; ld(); sr()
        }
        function ly() { fetch(_B + '/api/years').then(function (r) { return r.json() }).then(function (y) { var s = document.getElementById('ys'); s.innerHTML = ''; if (!y || !y.length) y = [String(new Date().getFullYear())]; y.forEach(function (v) { var o = document.createElement('option'); o.value = v; o.textContent = v; s.appendChild(o) }) }) }
        ly();
        function ld() { if (cp === 'live') ll(); else if (cp === '30d') l30(); else if (cp === 'year') lyr(); else if (cp === 'all') lall(); document.getElementById('ri').textContent = 'Aktualisiert: ' + new Date().toLocaleTimeString('de-DE') }
        
        /* Chart options builder */
        function CO(c, yt) { return { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: c.text, usePointStyle: true, font: { size: 9 } } } }, scales: { x: { ticks: { color: c.muted, maxRotation: 45, font: { size: 8 } }, grid: { color: c.grid } }, y: { position: 'left', ticks: { color: '#ef4444', font: { size: 9 } }, grid: { color: c.grid }, title: { display: true, text: 'kWh', color: '#ef4444' }, beginAtZero: true }, y2: { position: 'right', ticks: { color: '#3b82f6', font: { size: 9 } }, grid: { display: false }, title: { display: true, text: 'Liter', color: '#3b82f6' }, beginAtZero: true }, y1: { display: false } } } }
        function DS(kw, li, cn) { return [{ label: 'kWh', data: kw, backgroundColor: '#ef4444cc', borderRadius: 3, yAxisID: 'y', maxBarThickness: 40 }, { label: 'Liter', data: li, backgroundColor: '#3b82f6cc', borderRadius: 3, yAxisID: 'y2', maxBarThickness: 40 }, { label: 'Sessions', data: cn, type: 'line', borderColor: '#f59e0b', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 3, tension: .3, yAxisID: 'y1' }] }
        function costDS(cs, cw) { return [{ label: 'Strom €', data: cs, backgroundColor: '#ef4444cc', borderRadius: 3, stack: 'c' }, { label: 'Wasser €', data: cw, backgroundColor: '#3b82f6cc', borderRadius: 3, stack: 'c' }] }
        function costOpts(c) { return { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: c.text, usePointStyle: true, font: { size: 9 } } } }, scales: { x: { ticks: { color: c.muted, maxRotation: 45, font: { size: 8 } }, grid: { color: c.grid } }, y: { stacked: true, ticks: { color: c.muted, font: { size: 9 } }, grid: { color: c.grid }, title: { display: true, text: '€', color: c.muted } } } } }
    
    
        /* LIVE */
        function ll() {
            Promise.all([fetch(_B + '/api/live').then(function (r) { return r.json() }).catch(function () { return {} }), fetch(_B + '/api/stats').then(function (r) { return r.json() }).catch(function () { return {} })]).then(function (res) {
                var d = res[0], stats = res[1], s = d.state || {}, today = d.today || {}, last = d.last_session || {}, pw = d.current_power_w;
                var state = s.state || '–', door = s.door || '–', power = s.power || '–', ef = s.energyforecast || 0, wf = s.waterforecast || 0;
                var progress = parseInt(s.progress) || 0, remaining = s.remaining || '0:00', prog = s.programm || '–', phase = s.phase || 'In Bereitschaft';
                var isR = (state === 'Run' || state === 'DelayedStart' || state === 'Pause');
                /* Refresh-Intervall anpassen wenn State sich ändert */
                if (state !== _lastState) { _lastState = state; sr(); }
                document.getElementById('cs').innerHTML = s.state ? '<span style="color:var(--green)">● Verbunden</span>' : '<span style="color:var(--muted)">○ Warte</span>';
                var st = T(state, 'Status', sc(state), null, null, '📊') + T(dI(door) + ' ' + door, 'Tür', 'i', null, null, '🚪') + T(power, 'Power', power === 'On' ? 'ok' : 'i', null, null, '⚡');
                if (pw !== null && pw !== undefined) st += T(F(pw, 0) + ' W', 'Leistung', pw > 10 ? 'w' : 'i', null, { pct: Math.min(100, pw / 2000 * 100), color: 'var(--orange)' }, '💡');
                st += T(prog, 'Programm', 'i', null, null, '📋') + T(phase, 'Phase', isR ? 'ok' : 'i', null, isR ? { pct: progress, color: 'var(--green)' } : null, '🔄');
                var ct = '', efK = r2(_feMax * ef / 100), wfL = r2(_fwMax * wf / 100);
                if (ef > 0) ct += T(F(efK, 2) + ' <span class="tu">kWh</span>', 'Forecast Strom', 's', null, { pct: ef, color: 'var(--strom)' }, '⚡');
                if (wf > 0) ct += T(F(wfL, 1) + ' <span class="tu">L</span>', 'Forecast Wasser', 'wa', null, { pct: wf, color: 'var(--wasser)' }, '💧');
                if (today.kwh) ct += T(F(today.kwh, 3) + ' <span class="tu">kWh</span>', 'Heute Strom', 's', null, { pct: Math.min(100, today.kwh / 1 * 100), color: 'var(--strom)' }, '⚡');
                if (today.liters) ct += T(F(today.liters, 1) + ' <span class="tu">L</span>', 'Heute Wasser', 'wa', null, { pct: Math.min(100, today.liters / 15 * 100), color: 'var(--wasser)' }, '💧');
                if (_di) { ct += T(da(_di), 'Betriebsdauer', 'i'); var trm = stats.total_duration_min || 0; if (trm > 0) ct += T(Math.round(trm / 60) + ' h', 'Laufzeit', 'i') }
                document.getElementById('stiles').innerHTML = G('Gerätestatus', st + ct);
                document.getElementById('cgrp').innerHTML = '';
                /* Live Status as tiles */
                var ls = '';
                ls += T(phase, 'Phase', isR ? 'ok' : 'i', null, null, '🔄');
                ls += T((s.lastupdate || '–').substring(11, 19), 'Update', 'i', null, null, '🕐');
                if (last.start_time) {
                    ls += T(last.program || '–', 'Programm', 'i', null, null, '📋');
                    ls += T((last.start_time || '').replace('T', ' ').substring(0, 16), 'Datum', 'i', null, null, '📅');
                    ls += T(F(last.duration_min || 0, 0) + ' min', 'Dauer', 'i', null, null, '⏱️');
                    if (last.kwh) ls += T(F(last.kwh, 3) + ' <span class="tu">kWh</span>', 'Strom', 's', null, { pct: Math.min(100, last.kwh / 1 * 100), color: 'var(--strom)' }, '⚡');
                    if (last.liters) ls += T(F(last.liters, 1) + ' <span class="tu">L</span>', 'Wasser', 'wa', null, { pct: Math.min(100, last.liters / 15 * 100), color: 'var(--wasser)' }, '💧');
                    if (last.cost_total) ls += T(F(last.cost_total, 3) + ' <span class="tu">€</span>', 'Kosten', 'w', null, null, '💰');
                    ls += T(last.result || '–', 'Ergebnis', last.result === 'finished' ? 'ok' : 'e', null, null, '✅');
                }
                document.getElementById('sgrid').innerHTML = '<div class="g">' + ls + '</div>';
                rpb(phase);
                var rc = document.getElementById('rc');
                if (isR) {
                    rc.style.display = ''; var rh = '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">';
                    rh += '<div><div class="tl">Programm</div><div style="font-size:.95rem;font-weight:700;color:var(--accent)">' + prog + '</div></div>';
                    rh += '<div><div class="tl">Phase</div><div style="font-size:.95rem;font-weight:700;color:var(--green)">' + phase + '</div></div>';
                    rh += '<div><div class="tl">Fortschritt</div><div style="font-size:.95rem;font-weight:700">' + progress + '%</div></div>';
                    rh += '<div><div class="tl">Restzeit</div><div style="font-size:.95rem;font-weight:700">' + remaining + '</div></div>';
                    rh += '</div>'; document.getElementById('rcc').innerHTML = rh; document.getElementById('pbar').style.width = progress + '%'; document.getElementById('plbl').textContent = prog + ' · ' + phase + ' · ' + progress + '%'
                } else { rc.style.display = 'none' }
                document.getElementById('ccc').style.display = 'none'; document.getElementById('tc').style.display = 'none';
                if (stats.total_sessions) {
                    var ys2 = stats.year_sessions || 0, ms2 = stats.month_sessions || 0, yk = stats.year_real_kwh || stats.year_kwh || 0, yl = stats.year_real_liters || stats.year_liters || 0, ycs = stats.year_cost_strom || 0, ycw = stats.year_cost_wasser || 0, yc = stats.year_cost_total || r2(ycs + ycw), yr = new Date().getFullYear();
                    var sh = '<h3>Jahr ' + yr + '</h3><div class="g">';
                    sh += T(ys2, 'Spülgänge', 'i', null, null, '🍽️');
                    sh += T(ms2, 'Monat', 'i', null, null, '📅');
                    sh += T(F(yk, 1) + ' <span class="tu">kWh</span>', 'Strom', 's', null, null, '⚡');
                    sh += T(F(yl, 0) + ' <span class="tu">L</span>', 'Wasser', 'wa', null, null, '💧');
                    sh += T(F(yc, 2) + ' <span class="tu">€</span>', 'Kosten', 'w', null, null, '💰');
                    if (ys2 > 1) sh += T(F(yc / ys2, 2) + ' <span class="tu">€</span>', '⌀/Spülgang', 'i', null, null, '📊');
                    sh += '</div>'; document.getElementById('scc').innerHTML = sh; document.getElementById('sc').style.display = ''
                }
                fetch(_B + '/api/daily?days=' + _ld).then(function (r) { return r.json() }).then(function (data) {
                    if (!data || !data.length || data.filter(function (d) { return d.sessions_count > 0 }).length <= 2) { document.getElementById('cc').style.display = 'none'; return }
                    document.getElementById('cc').style.display = ''; document.getElementById('ct').textContent = 'Letzte ' + _ld + ' Tage';
                    data = data.filter(function (d) { return d.sessions_count > 0 });
                    data.reverse();
                    var lb = data.map(function (d) { return d.date ? d.date.substring(5) : '' });
                    var c = CL(); if (mch) mch.destroy();
                    mch = new Chart(document.getElementById('mc'), { type: 'bar', data: { labels: lb, datasets: DS(data.map(function (d) { return r2(d.total_energy_kwh || 0) }), data.map(function (d) { return r2(d.total_water_liters || 0) }), data.map(function (d) { return d.sessions_count })) }, options: CO(c) })
                });
                /* Live session chart */
                loadLiveChart(false)
            })
        }
    
    
        /* 30 DAYS */
        function l30() {
            document.getElementById('cs').innerHTML = '';['cc', 'ccc', 'tc'].forEach(function (id) { document.getElementById(id).style.display = '' });
            document.getElementById('ct').textContent = 'Verbrauch (30 Tage)'; document.getElementById('cct').textContent = 'Kosten (30 Tage)'; document.getElementById('tt2').innerHTML = 'Spülgänge (30 Tage) <button class="xb" onclick="xcsv()">📥 CSV</button>';
            Promise.all([fetch(_B + '/api/daily?days=30').then(function (r) { return r.json() }), fetch(_B + '/api/stats').then(function (r) { return r.json() })]).then(function (res) {
                var data = res[0], st = res[1]; if (!data || !data.length) { document.getElementById('stiles').innerHTML = ''; return }
                data = data.filter(function (d) { return d.sessions_count > 0 });
                data.reverse(); var costs = st.costs || {}, sp2 = costs.strom || 0, wp = costs.wasser || 0;
                var ts = 0, td = 0, tk = 0, tl = 0; data.forEach(function (d) { ts += d.sessions_count; td += d.total_duration_min; tk += d.total_energy_kwh || 0; tl += d.total_water_liters || 0 });
                if (tk === 0) { var te = 0, tw = 0; data.forEach(function (d) { te += d.avg_energy_forecast * d.sessions_count; tw += d.avg_water_forecast * d.sessions_count }); tk = r2(_feMax * te / 100); tl = r2(_fwMax * tw / 100) }
                var cs2 = r2(tk * sp2), cw2 = r2((tl / 1000) * wp);
                document.getElementById('stiles').innerHTML = G('Verbrauch 30 Tage', T(ts, 'Spülgänge', 'i') + T(fD(td), 'Dauer', 'i') + T(F(tk, 2) + ' kWh', 'Strom', 's') + T(F(tl, 0) + ' L', 'Wasser', 'wa'));
                document.getElementById('cgrp').innerHTML = G('Kosten 30 Tage', T(F(cs2, 2) + ' €', 'Stromkosten', 's') + T(F(cw2, 2) + ' €', 'Wasserkosten', 'wa') + T(F(cs2 + cw2, 2) + ' €', 'Gesamt', 'w'));
                var lb = data.map(function (d) { return d.date ? d.date.substring(5) : '' });
                var c = CL(); if (mch) mch.destroy();
                mch = new Chart(document.getElementById('mc'), { type: 'bar', data: { labels: lb, datasets: DS(data.map(function (d) { return r2(d.total_energy_kwh || 0) }), data.map(function (d) { return r2(d.total_water_liters || 0) }), data.map(function (d) { return d.sessions_count })) }, options: CO(c) });
                if (cch) cch.destroy();
                cch = new Chart(document.getElementById('coc'), { type: 'bar', data: { labels: lb, datasets: costDS(data.map(function (d) { return r2((d.total_energy_kwh || 0) * sp2) }), data.map(function (d) { return r2(((d.total_water_liters || 0) / 1000) * wp) })) }, options: costOpts(c) });
                rsum(ts, td, tk, tl, cs2, cw2)
            }); lst(30)
        }
        /* YEAR */
        function lyr() {
            var year = document.getElementById('ys').value || new Date().getFullYear();
            document.getElementById('cs').innerHTML = '';['cc', 'ccc', 'tc'].forEach(function (id) { document.getElementById(id).style.display = '' });
            document.getElementById('ct').textContent = 'Verbrauch ' + year; document.getElementById('cct').textContent = 'Kosten ' + year; document.getElementById('tt2').innerHTML = 'Spülgänge ' + year + ' <button class="xb" onclick="xcsv()">📥 CSV</button>';
            Promise.all([fetch(_B + '/api/monthly?year=' + year).then(function (r) { return r.json() }), fetch(_B + '/api/sessions?limit=200').then(function (r) { return r.json() })]).then(function (res) {
                var data = res[0]; if (!data) { document.getElementById('stiles').innerHTML = ''; return }
                var ts = 0, tk = 0, tl = 0, tcs = 0, tcw = 0, td = 0; data.forEach(function (d) { ts += d.sessions_count; tk += d.kwh || 0; tl += d.liters || 0; tcs += d.cost_strom || 0; tcw += d.cost_wasser || 0; td += d.total_duration_min || 0 });
                document.getElementById('stiles').innerHTML = G('Verbrauch ' + year, T(ts, 'Spülgänge', 'i') + T(fD(td), 'Dauer', 'i') + T(F(tk, 1) + ' kWh', 'Strom', 's') + T(F(tl, 0) + ' L', 'Wasser', 'wa'));
                document.getElementById('cgrp').innerHTML = G('Kosten ' + year, T(F(tcs, 2) + ' €', 'Stromkosten', 's') + T(F(tcw, 2) + ' €', 'Wasserkosten', 'wa') + T(F(tcs + tcw, 2) + ' €', 'Gesamt', 'w'));
                var lb = data.map(function (d) { var m = parseInt(d.month.substring(5)); return MN[m - 1] || d.month });
                var c = CL(); if (mch) mch.destroy();
                mch = new Chart(document.getElementById('mc'), { type: 'bar', data: { labels: lb, datasets: DS(data.map(function (d) { return d.kwh || 0 }), data.map(function (d) { return d.liters || 0 }), data.map(function (d) { return d.sessions_count || 0 })) }, options: CO(c) });
                if (cch) cch.destroy();
                cch = new Chart(document.getElementById('coc'), { type: 'bar', data: { labels: lb, datasets: costDS(data.map(function (d) { return d.cost_strom || 0 }), data.map(function (d) { return d.cost_wasser || 0 })) }, options: costOpts(c) });
                rsum(ts, td, tk, tl, tcs, tcw)
            }); lst(200, year)
        }
        /* ALL YEARS */
        function lall() {
            document.getElementById('cs').innerHTML = '';['cc', 'ccc', 'tc'].forEach(function (id) { document.getElementById(id).style.display = '' });
            document.getElementById('ct').textContent = 'Alle Jahre'; document.getElementById('cct').textContent = 'Kosten alle Jahre'; document.getElementById('tt2').innerHTML = 'Alle Spülgänge <button class="xb" onclick="xcsv()">📥 CSV</button>';
            Promise.all([fetch(_B + '/api/years').then(function (r) { return r.json() }), fetch(_B + '/api/costs').then(function (r) { return r.json() }), fetch(_B + '/api/sessions?limit=9999').then(function (r) { return r.json() })]).then(function (res) {
                var years = res[0] || [], allC = res[1] || {}, sess = res[2] || []; if (!years.length) { document.getElementById('stiles').innerHTML = ''; return }
                var yd = [], gts = 0, gtk = 0, gtl = 0, gtcs = 0, gtcw = 0, gtd = 0;
                years.sort().forEach(function (y) {
                    var ys = sess.filter(function (s) { return s.start_time && s.start_time.substring(0, 4) === y && s.result !== 'running' });
                    var co = allC[parseInt(y)] || { strom: 0.23, wasser: 6.97 }; var tk = 0, tl = 0, td2 = 0;
                    ys.forEach(function (s) { var ek = s.energy_kwh || 0, wl = s.water_liters || 0; if (!ek && s.energy_forecast) ek = r2(1.05 * s.energy_forecast / 100); if (!wl && s.water_forecast) wl = r2(10 * s.water_forecast / 100); tk += ek; tl += wl; td2 += (s.duration_min || 0) });
                    var cs2 = r2(tk * (co.strom || 0)), cw2 = r2((tl / 1000) * (co.wasser || 0));
                    yd.push({ year: y, sessions: ys.length, kwh: r2(tk), liters: r2(tl), costS: cs2, costW: cw2 }); gts += ys.length; gtk += tk; gtl += tl; gtcs += cs2; gtcw += cw2; gtd += td2
                });
                document.getElementById('stiles').innerHTML = G('Alle Jahre', T(gts, 'Spülgänge', 'i') + T(fD(gtd), 'Dauer', 'i') + T(F(gtk, 1) + ' kWh', 'Strom', 's') + T(F(gtl, 0) + ' L', 'Wasser', 'wa'));
                document.getElementById('cgrp').innerHTML = G('Kosten gesamt', T(F(gtcs, 2) + ' €', 'Strom', 's') + T(F(gtcw, 2) + ' €', 'Wasser', 'wa') + T(F(gtcs + gtcw, 2) + ' €', 'Gesamt', 'w'));
                var lb = yd.map(function (d) { return d.year }); var c = CL();
                if (mch) mch.destroy(); mch = new Chart(document.getElementById('mc'), { type: 'bar', data: { labels: lb, datasets: DS(yd.map(function (d) { return d.kwh }), yd.map(function (d) { return d.liters }), yd.map(function (d) { return d.sessions })) }, options: CO(c) });
                if (cch) cch.destroy(); cch = new Chart(document.getElementById('coc'), { type: 'bar', data: { labels: lb, datasets: costDS(yd.map(function (d) { return d.costS }), yd.map(function (d) { return d.costW })) }, options: costOpts(c) });
                rsum(gts, gtd, gtk, gtl, gtcs, gtcw)
            }); lst(9999)
        }
    
    
        /* SUMMARY */
        function rsum(s, dur, kwh, lit, cs2, cw2) {
            if (s <= 1) { document.getElementById('sc').style.display = 'none'; return }
            var ad = dur / s, ak = kwh / s, al = lit / s, ac = ((cs2 || 0) + (cw2 || 0)) / s;
            var h = '<h3>⌀ pro Spülgang</h3><div class="g">';
            h += T(F(ad, 0) + ' <span class="tu">min</span>', 'Dauer', 'i', null, null, '⏱️');
            h += T(F(ak, 3) + ' <span class="tu">kWh</span>', 'Strom', 's', null, null, '⚡');
            h += T(F(al, 1) + ' <span class="tu">L</span>', 'Wasser', 'wa', null, null, '💧');
            h += T(F(ac, 2) + ' <span class="tu">€</span>', 'Kosten', 'w', null, null, '💰');
            h += '</div>'; document.getElementById('scc').innerHTML = h; document.getElementById('sc').style.display = ''
        }
        /* TABLE */
        function lst(limit, year) {
            fetch(_B + '/api/sessions?limit=' + (limit || 30)).then(function (r) { return r.json() }).then(function (sess) {
                if (!sess || !sess.length) { document.getElementById('stbl').innerHTML = '<p style="padding:8px;color:var(--muted)">Keine Daten</p>'; return }
                if (year) sess = sess.filter(function (s) { return s.start_time && s.start_time.substring(0, 4) === String(year) });
                var h = '<table><thead><tr><th>Start</th><th>Programm</th><th>Dauer</th><th>kWh</th><th>Liter</th><th>€ S</th><th>€ W</th><th>€</th><th>Erg.</th></tr></thead><tbody>';
                sess.forEach(function (s) {
                    var st2 = s.start_time ? s.start_time.replace('T', ' ').substring(0, 16) : '–'; var cl = s.result === 'finished' ? 'color:var(--green)' : s.result === 'running' ? 'color:var(--orange)' : '';
                    h += '<tr><td>' + st2 + '</td><td>' + (s.program || '–') + '</td><td class="n">' + (s.duration_min ? F(s.duration_min, 0) + 'm' : '–') + '</td><td class="n">' + (s.kwh_estimate ? F(s.kwh_estimate, 3) : '–') + '</td><td class="n">' + (s.liters_estimate ? F(s.liters_estimate, 1) : '–') + '</td><td class="n">' + (s.cost_strom ? F(s.cost_strom, 3) : '–') + '</td><td class="n">' + (s.cost_wasser ? F(s.cost_wasser, 3) : '–') + '</td><td class="n">' + (s.cost_total ? F(s.cost_total, 3) : '–') + '</td><td style="' + cl + '">' + (s.result || '–') + '</td></tr>'
                });
                h += '</tbody></table>'; document.getElementById('stbl').innerHTML = h
            }).catch(function () { document.getElementById('stbl').innerHTML = '<p style="padding:8px;color:var(--muted)">Fehler</p>' })
        }
        /* CSV */
        function xcsv() { window.location.href = _B + '/api/export/csv' }
        /* LIVE SESSION CHART */
        var _lschLoaded = false;
        function _aggregate(rd, intervalMin) {
            /* Fasst Readings in N-Minuten-Blöcke zusammen */
            if (!rd || rd.length < 2) return rd;
            var ms = intervalMin * 60 * 1000;
            var buckets = [], cur = null;
            rd.forEach(function (r) {
                var t = new Date(r.timestamp.replace(' ', 'T')).getTime();
                if (!cur || t - cur.t0 >= ms) {
                    if (cur) buckets.push(cur);
                    cur = { t0: t, ts: r.timestamp, pw_sum: 0, pw_cnt: 0, kwh: null, lit: null, phase: r.phase || null };
                }
                if (r.power_w != null) { cur.pw_sum += r.power_w; cur.pw_cnt++; }
                if (r.kwh_rel != null) cur.kwh = r.kwh_rel;
                if (r.liters_rel != null) cur.lit = r.liters_rel;
                if (r.phase) cur.phase = r.phase;
            });
            if (cur) buckets.push(cur);
            return buckets.map(function (b) {
                return { timestamp: b.ts, power_w: b.pw_cnt > 0 ? Math.round(b.pw_sum / b.pw_cnt) : null, kwh_rel: b.kwh, liters_rel: b.lit, phase: b.phase };
            });
        }
        function loadLiveChart(forceRefresh) {
            if (_lschLoaded && !forceRefresh) return;
            fetch(_B + '/api/session/live').then(function (r) { return r.json() }).then(function (d) {
                var card = document.getElementById('liveChartCard');
                if (!d.readings || d.readings.length < 2) { card.style.display = 'none'; return }
                card.style.display = '';
                /* Aggregieren: >100 Punkte → 5min Blöcke, >300 → 10min */
                var rd = d.readings;

                /* Phasen auf Rohdaten erkennen (vor Aggregation) */
                var hasPhase = rd.some(function (r) { return r.phase });
                if (!hasPhase) {
                    var heatBlocks = [], inBlock = false, blockStart = 0;
                    for (var i = 0; i < rd.length; i++) {
                        var w = rd[i].power_w || 0;
                        if (w > 300) {
                            if (!inBlock) { blockStart = i; inBlock = true; }
                        } else if (inBlock) {
                            /* Kurze Pause (<8 Readings ~4min) überbrücken */
                            var resumed = false;
                            for (var j = i; j < Math.min(i + 8, rd.length); j++) {
                                if ((rd[j].power_w || 0) > 300) { i = j - 1; resumed = true; break; }
                            }
                            if (!resumed) {
                                heatBlocks.push({ start: blockStart, end: i - 1 });
                                inBlock = false;
                            }
                        }
                    }
                    if (inBlock) heatBlocks.push({ start: blockStart, end: rd.length - 1 });

                    var phaseNames = ['Vorspülen', 'Hauptspülen', 'Klarspülen'];
                    heatBlocks.forEach(function (b, idx) {
                        var name = phaseNames[idx] || 'Spülen';
                        for (var i = b.start; i <= b.end; i++) rd[i].phase = name;
                    });
                    if (heatBlocks.length > 0) {
                        var dryStart = heatBlocks[heatBlocks.length - 1].end + 1;
                        for (var i = dryStart; i < rd.length; i++) {
                            if (!rd[i].phase) rd[i].phase = 'Trocknen';
                        }
                    }
                }

                /* Jetzt aggregieren (mit Phase) */
                if (rd.length > 300) rd = _aggregate(rd, 10);
                else if (rd.length > 100) rd = _aggregate(rd, 5);
                var sessionDate = rd[0].timestamp ? rd[0].timestamp.substring(0, 10) : '';
                var titleEl = document.getElementById('liveChartTitle');
                titleEl.textContent = d.active ? '⚡ Verbrauch live' : '⚡ Verbrauch am ' + sessionDate;
                var labels = rd.map(function (r) { return r.timestamp ? r.timestamp.substring(11, 16) : '' });
                var pw = rd.map(function (r) { return r.power_w });
                /* Delta statt kumulativ: Verbrauch pro Zeitblock */
                var kwhRaw = rd.map(function (r) { return r.kwh_rel });
                var litRaw = rd.map(function (r) { return r.liters_rel });
                var kwh = [0], lit = [0];
                for (var i = 1; i < kwhRaw.length; i++) {
                    kwh.push(kwhRaw[i] != null && kwhRaw[i - 1] != null ? Math.max(0, Math.round((kwhRaw[i] - kwhRaw[i - 1]) * 10000) / 10000) : 0);
                    lit.push(litRaw[i] != null && litRaw[i - 1] != null ? Math.max(0, Math.round((litRaw[i] - litRaw[i - 1]) * 100) / 100) : 0);
                }
                var c = CL();
                var datasets = [];
                /* Phasen-Farben für Watt-Balken */
                var phaseColors = { 'Vorspülen': 'rgba(100,116,139,.6)', 'Hauptspülen': 'rgba(245,158,11,.6)', 'Spülen': 'rgba(245,158,11,.6)', 'Klarspülen': 'rgba(59,130,246,.6)', 'Trocknen': 'rgba(239,68,68,.5)', 'In Bereitschaft': 'rgba(100,116,139,.3)', 'Bereit': 'rgba(100,116,139,.3)', 'Fertig': 'rgba(16,185,129,.4)' };
                var pwColors = rd.map(function (r) { return phaseColors[r.phase] || 'rgba(245,158,11,.5)' });
                if (pw.some(function (v) { return v !== null })) datasets.push({ label: 'Watt', data: pw, type: 'bar', backgroundColor: pwColors, borderColor: pwColors.map(function (c) { return c.replace(/[\d.]+\)$/, '1)') }), borderWidth: 1, borderRadius: 2, yAxisID: 'yW' });
                if (kwh.some(function (v) { return v > 0 })) datasets.push({ label: 'kWh', data: kwh, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,.15)', borderWidth: 2, pointRadius: 2, tension: .3, yAxisID: 'yE', fill: true });
                if (lit.some(function (v) { return v > 0 })) datasets.push({ label: 'Liter', data: lit, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,.15)', borderWidth: 2, pointRadius: 2, tension: .3, yAxisID: 'yL', fill: true });
                if (!datasets.length) { card.style.display = 'none'; return }
                if (lsch) lsch.destroy();
                var scales = { x: { ticks: { color: c.muted, maxRotation: 45, maxTicksLimit: 20, autoSkip: true, font: { size: 8 } }, grid: { color: c.grid } } };
                if (pw.some(function (v) { return v !== null })) scales.yW = { position: 'left', ticks: { color: '#f59e0b', font: { size: 9 } }, grid: { color: c.grid }, title: { display: true, text: 'W', color: '#f59e0b' }, beginAtZero: true };
                if (kwh.some(function (v) { return v !== null })) scales.yE = { position: 'right', ticks: { color: '#ef4444', font: { size: 9 } }, grid: { display: false }, title: { display: true, text: 'kWh', color: '#ef4444' }, beginAtZero: true };
                if (lit.some(function (v) { return v !== null })) scales.yL = { position: 'right', ticks: { color: '#3b82f6', font: { size: 9 } }, grid: { display: false }, title: { display: true, text: 'L', color: '#3b82f6' }, beginAtZero: true };
                _lschLoaded = !d.active;
                lsch = new Chart(document.getElementById('liveSessionChart'), { type: 'line', data: { labels: labels, datasets: datasets }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: c.text, usePointStyle: true, font: { size: 9 } } } }, scales: scales } });
                /* Phasen-Zusammenfassung */
                var ps = document.getElementById('phaseSummary');
                var phaseEmoji = { 'Vorspülen': '🔄', 'Hauptspülen': '🧽', 'Spülen': '🧽', 'Klarspülen': '💧', 'Trocknen': '🔥', 'Fertig': '✅' };
                var phaseClr = { 'Vorspülen': '#64748b', 'Hauptspülen': '#f59e0b', 'Spülen': '#f59e0b', 'Klarspülen': '#3b82f6', 'Trocknen': '#ef4444', 'Fertig': '#10b981' };

                /* Phasen aggregieren */
                var phases = {};
                rd.forEach(function (r, i) {
                    var ph = r.phase;
                    if (!ph) return;
                    if (!phases[ph]) phases[ph] = { kwh: 0, lit: 0, count: 0 };
                    phases[ph].kwh += kwh[i] || 0;
                    phases[ph].lit += lit[i] || 0;
                    phases[ph].count++;
                });

                /* Watt-Balken einfärben (auch bei rekonstruierten Phasen) */
                pwColors = rd.map(function (r) { return phaseClr[r.phase] ? phaseClr[r.phase].replace(')', ',.6)').replace('rgb', 'rgba') : 'rgba(245,158,11,.5)' });
                if (lsch && lsch.data.datasets[0]) {
                    lsch.data.datasets[0].backgroundColor = pwColors;
                    lsch.update('none');
                }

                var pKeys = Object.keys(phases);
                if (pKeys.length > 0) {
                    var ph = '';
                    pKeys.forEach(function (k) {
                        var p = phases[k], em = phaseEmoji[k] || '·', cl = phaseClr[k] || 'var(--muted)';
                        ph += '<span style="color:' + cl + '">' + em + ' ' + k + ': ' + F(p.kwh, 3) + ' kWh · ' + F(p.lit, 1) + ' L</span>';
                    });
                    ps.innerHTML = ph;
                } else {
                    var totalKwh = kwh.reduce(function (a, b) { return a + b }, 0);
                    var totalLit = lit.reduce(function (a, b) { return a + b }, 0);
                    ps.innerHTML = '<span>Σ ' + F(totalKwh, 3) + ' kWh · ' + F(totalLit, 1) + ' L</span>';
                }
            }).catch(function (e) { console.error('loadLiveChart error:', e); document.getElementById('liveChartCard').style.display = 'none' })
        }
        /* REFRESH – adaptive: 10s wenn Gerät läuft, 120s im Standby */
        var _rt = null, _lastState = '';
        function sr() {
            if (_rt) clearInterval(_rt);
            var interval = (cp === 'live' && (_lastState === 'Run' || _lastState === 'DelayedStart' || _lastState === 'Pause')) ? 10000 : 120000;
            _rt = setInterval(ld, interval);
        }
        fetch(_B + '/api/config').then(function (r) { return r.json() }).then(function (cfg) { _ld = cfg.live_days || 7; _di = cfg.device_installed || ''; _feMax = cfg.forecast_energy_max_kwh || 1.05; _fwMax = cfg.forecast_water_max_l || 13.0 }).catch(function () { }).finally(function () { sp(localStorage.getItem('dw-tab') || 'live'); sr() });
    
