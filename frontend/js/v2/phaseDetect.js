// frontend/js/v2/phaseDetect.js
// Automatische Phasen-Erkennung aus Leistungsdaten

/**
 * Erkennt Spülphasen anhand von Leistungsschwellen (>300W = aktive Phase)
 * Modifiziert das readings-Array in-place mit phase-Property
 */
export function detectPhases(rd) {
  const heatBlocks = [];
  let inBlock = false, blockStart = 0;

  for (let i = 0; i < rd.length; i++) {
    const w = rd[i].power_w || 0;
    if (w > 300) {
      if (!inBlock) { blockStart = i; inBlock = true; }
    } else if (inBlock) {
      let resumed = false;
      for (let j = i; j < Math.min(i + 8, rd.length); j++) {
        if ((rd[j].power_w || 0) > 300) { i = j - 1; resumed = true; break; }
      }
      if (!resumed) { heatBlocks.push({ start: blockStart, end: i - 1 }); inBlock = false; }
    }
  }
  if (inBlock) heatBlocks.push({ start: blockStart, end: rd.length - 1 });

  const phaseNames = ['Vorspülen', 'Hauptspülen', 'Klarspülen'];
  heatBlocks.forEach((b, idx) => {
    const name = phaseNames[idx] || 'Spülen';
    for (let i = b.start; i <= b.end; i++) rd[i].phase = name;
  });

  if (heatBlocks.length > 0) {
    const dryStart = heatBlocks[heatBlocks.length - 1].end + 1;
    for (let i = dryStart; i < rd.length; i++) {
      if (!rd[i].phase) rd[i].phase = 'Trocknen';
    }
  }
}

/**
 * Aggregiert Readings in N-Minuten-Blöcke (Durchschnitt der Leistung)
 */
export function aggregate(rd, intervalMin) {
  if (!rd || rd.length < 2) return rd;
  const ms = intervalMin * 60 * 1000;
  const buckets = [];
  let cur = null;

  rd.forEach(r => {
    const t = new Date(r.timestamp.replace(' ', 'T')).getTime();
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

  return buckets.map(b => ({
    timestamp: b.ts,
    power_w: b.pw_cnt > 0 ? Math.round(b.pw_sum / b.pw_cnt) : null,
    kwh_rel: b.kwh,
    liters_rel: b.lit,
    phase: b.phase
  }));
}
