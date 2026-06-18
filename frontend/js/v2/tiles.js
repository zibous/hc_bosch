// frontend/js/v2/tiles.js
// Kompakte Card-Komponenten (Hero-Value + Detail-Rows + Sparkline)

/**
 * Erzeugt eine SVG-Sparkline
 * @param {number[]} values - Datenpunkte
 * @param {string} color - Linienfarbe
 * @param {number} width - SVG Breite
 * @param {number} height - SVG Höhe
 */
export function Sparkline(values, color = 'var(--accent)', width = 80, height = 24) {
  if (!values || values.length < 2) return '';
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);

  const points = values.map((v, i) =>
    `${(i * step).toFixed(1)},${(height - 2 - ((v - min) / range) * (height - 4)).toFixed(1)}`
  ).join(' ');

  return `<svg width="${width}" height="${height}" style="display:block;flex-shrink:0;"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/**
 * Erzeugt eine kompakte Info-Card mit Hero-Wert und Detail-Zeilen
 * @param {string} title - Card-Titel
 * @param {string} hero - Großer Hero-Wert (HTML)
 * @param {string} heroSub - Untertitel unter dem Hero
 * @param {Array} rows - [{label, value, color}] Detail-Zeilen
 * @param {string} badge - Status-Badge Text (optional)
 * @param {string} badgeColor - Badge Farbe (optional)
 * @param {string} sparkHtml - Sparkline HTML (optional)
 */
export function Card(title, hero, heroSub, rows = [], badge = '', badgeColor = '', sparkHtml = '') {
  let rowsHtml = rows.map(r =>
    `<div class="cd-row"><span class="cd-lbl">${r.label}</span><span class="cd-val" style="${r.color ? 'color:' + r.color : ''}">${r.value}</span></div>`
  ).join('');

  const badgeHtml = badge
    ? `<span class="cd-badge" style="background:${badgeColor || 'var(--muted)'}20;color:${badgeColor || 'var(--muted)'}">${badge}</span>`
    : '';

  return `<div class="cd">
    <div class="cd-hdr"><span class="cd-title">${title}</span>${badgeHtml}</div>
    <div class="cd-hero-row">
      <div class="cd-hero">${hero}</div>
      ${sparkHtml ? '<div class="cd-spark">' + sparkHtml + '</div>' : ''}
    </div>
    ${heroSub ? '<div class="cd-sub">' + heroSub + '</div>' : ''}
    ${rowsHtml ? '<div class="cd-rows">' + rowsHtml + '</div>' : ''}
  </div>`;
}

/**
 * Erzeugt ein Grid mit Cards
 */
export function CardGrid(cards) {
  return '<div class="cd-grid">' + cards + '</div>';
}

// Legacy-Kompatibilität
export function T(v, l, c, sub, gauge, icon) {
  let h = '<div class="t"><div class="tl">' + l + '</div>';
  if (icon) h += '<div class="ticon">' + icon + '</div>';
  h += '<div class="tv ' + c + '">' + v + '</div>';
  if (sub) h += '<div class="tsub">' + sub + '</div>';
  if (gauge) {
    const pct = Math.min(100, Math.max(0, gauge.pct || 0));
    h += '<div class="tgauge"><div class="tgauge-fill" style="width:' + pct + '%;background:' + (gauge.color || 'var(--accent)') + '"></div></div>';
  }
  return h + '</div>';
}

export function G(t, ti) {
  return '<div class="grp"><div class="grp-t">' + t + '</div><div class="g">' + ti + '</div></div>';
}
