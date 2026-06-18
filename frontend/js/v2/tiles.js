// frontend/js/v2/tiles.js
// Tile- und Gruppen-Rendering

/**
 * Erzeugt eine einzelne Tile-Kachel
 * @param {string} v - Wert
 * @param {string} l - Label
 * @param {string} c - CSS-Klasse (Status-Farbe)
 * @param {string|null} sub - Untertitel
 * @param {object|null} gauge - { pct, color }
 * @param {string|null} icon - Emoji-Icon
 */
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

/**
 * Erzeugt eine Tile-Gruppe mit Header
 * @param {string} t - Gruppen-Titel
 * @param {string} ti - Inner-HTML (Tiles)
 */
export function G(t, ti) {
  return '<div class="grp"><div class="grp-t">' + t + '</div><div class="g">' + ti + '</div></div>';
}
