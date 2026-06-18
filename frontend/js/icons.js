// frontend/static/js/v3/icons.js

/**
 * Liefert ein mathematisch präzises Apple-Health/Lucide SVG-Icon zurück
 * @param {string} name - Name des Icons
 * @param {number} size - Quadratische Größe in Pixeln (z.B. 14, 16, 18)
 * @param {number} opacity - Deckkraft von 0.0 bis 1.0 (Standard 1.0)
 * @param {number} marginRight - Abstand nach rechts in Pixeln (Standard 0)
 * @param {string} color - CSS-Farbe (Standard "currentColor")
 * @param {string} className - Optionale CSS-Klasse
 */
export function getAppleIcon(name, size = 16, opacity = 1.0, marginRight = 0, color = 'currentColor', className = '') {
  const finalStyle = `width:${size}px; height:${size}px; stroke:${color}; stroke-width:2; fill:none; stroke-linecap:round; stroke-linejoin:round; display:inline-block; vertical-align:text-bottom; flex-shrink:0; opacity:${opacity}; margin-right:${marginRight}px;`;
  const cls = className ? `class="${className}"` : '';

  const svgLibrary = {
    // --- BRAND LOGO ---
    // 🌟 NEU: Das zukunftssichere Solar-Wechselrichter-Logo für deinen Header
    logo: `<svg ${cls} style="${finalStyle}" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><path d="M7 10h4M13 14h4M7 14l3-3M14 13l3-3M3 9h18M3 15h18"/></svg>`,

    // --- BASIS ICONS ---
    energy: `<svg ${cls} style="${finalStyle}" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
    trend: `<svg ${cls} style="${finalStyle}" viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="m18.7 8-5.1 5.2-2.8-2.7L7 14.3"/></svg>`,
    sync: `<svg ${cls} style="${finalStyle}" viewBox="0 0 24 24"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>`,
    calendar: `<svg ${cls} style="${finalStyle}" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
    sun: `<svg ${cls} style="${finalStyle}" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`,
    moon: `<svg ${cls} style="${finalStyle}" viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/></svg>`,
    radar: `<svg ${cls} style="${finalStyle}" viewBox="0 0 24 24"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/><path d="M12 2v20M2 12h20"/></svg>`,
    bar: `<svg ${cls} style="${finalStyle}" viewBox="0 0 24 24"><path d="M18 20V10M12 20V4M6 20v-6M3 20h18"/></svg>`,
    signal: `<svg ${cls} style="${finalStyle}" viewBox="0 0 24 24"><path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.59 16.11a6 6 0 0 1 6.82 0M12 20h.01"/></svg>`,
    power: `<svg ${cls} style="${finalStyle}" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
    curpower: `<svg ${cls} style="${finalStyle}" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
    week: `<svg ${cls} style="${finalStyle}" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`,
    clock: `<svg ${cls} style="${finalStyle}" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`,
    co2: `<svg ${cls} style="${finalStyle}" viewBox="0 0 24 24"><path d="M4.5 16.5c-1.5 0-2.5-1-2.5-2.5s1-2.5 2.5-2.5c.5 0 1 .1 1.5.4C6.5 10 8 8.5 10 8.5c2.2 0 4 1.8 4 4v4H4.5z"/><path d="M12 16.5h7.5c1.5 0 2.5-1 2.5-2.5s-1-2.5-2.5-2.5c-.5 0-1 .1-1.5.4c-.5-1.9-2-3.4-4-3.4c-1 0-2 .4-2.7 1"/></svg>`,
    tree: `<svg ${cls} style="${finalStyle}" viewBox="0 0 24 24"><path d="m12 2 8 13H4L12 2zM12 15v6M9 21h6"/></svg>`,
    voltage: `<svg ${cls} style="${finalStyle}" viewBox="0 0 24 24"><path d="M13 2 3 14h9l-1 8 10-12h-9z"/></svg>`,
    ampere: `<svg ${cls} style="${finalStyle}" viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
    efficiency: `<svg ${cls} style="${finalStyle}" viewBox="0 0 24 24"><path d="M2 20h20M21 6l-7 7-4-4-6 6M21 6h-4M21 6v4"/></svg>`,
    reactive_power: `<svg ${cls} style="${finalStyle}" viewBox="0 0 24 24"><path d="m3 3 18 18M21 3v6M3 21h6"/></svg>`,
    symmetry: `<svg ${cls} style="${finalStyle}" viewBox="0 0 24 24"><path d="M12 3v18M3 12h18M5 19l14-14"/></svg>`,
    car: `<svg ${cls} style="${finalStyle}" viewBox="0 0 24 24"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="15" cy="17" r="2"/></svg>`
  };

  return svgLibrary[name] || '';
}
