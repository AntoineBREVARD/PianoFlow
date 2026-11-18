// Briques visuelles partagées (présentation uniquement) : icônes SVG, logo, flamme, anneau de progression, confettis, ripple.
const P = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5"/><path d="M22 9v6"/>',
  note: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  medal: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14 7 22l5-3 5 3-1.5-8"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 17l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  pencil: '<path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19z"/>',
  ear: '<path d="M6 9a6 6 0 0 1 12 0c0 3-2 4-3 6s-1 4-3.5 4A3.5 3.5 0 0 1 8 15.5"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  keys: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M9 5v14M15 5v14"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  snow: '<path d="M12 2v20M4 7l16 10M20 7L4 17"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  seat: '<path d="M7 3v9h9l2 9M7 12H5M10 21h5"/>',
  warn: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17.5v.5"/>',
  ok: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
  rocket: '<path d="M5 19c-1 0-2-1-2-2 0-2 1-4 3-5l-1-4 5 1c4-5 9-6 11-6 0 2-1 7-6 11l1 5-4-1c-1 2-3 3-5 3z"/><circle cx="15" cy="9" r="1.5"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  snail: '<path d="M3 19h15a3 3 0 0 0 0-6H8"/><circle cx="12" cy="9" r="5"/><path d="M5 19c-2 0-2-4-1-5"/>',
};
const FILLED = new Set(['play', 'star']);
/** Icône SVG inline (héritée de currentColor), décorative (aria-hidden). */
export const ic = (name, size = 20, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="${FILLED.has(name) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[name] || ''}</svg>`;

/** Logo : touches de piano sur pastille dégradée (dégradé défini par les <defs> d'index.html : #pfGrad). */
export const logo = (size = 40) => `<svg class="logo" viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true" focusable="false"><rect width="48" height="48" rx="13" fill="url(#pfGrad)"/><rect x="9" y="14" width="30" height="22" rx="4" fill="#fff"/><path d="M19 14v22M29 14v22" stroke="#9aa4d6" stroke-width="1.2"/><rect x="15.5" y="14" width="7" height="13" rx="2" fill="#0b0e22"/><rect x="25.5" y="14" width="7" height="13" rx="2" fill="#0b0e22"/><circle cx="36" cy="9" r="3" fill="#fde68a"/></svg>`;

/** Flamme de série (animée en CSS ; grise si la série est à 0). */
export const flame = (on = true, size = 44) => `<svg class="flame ${on ? 'on' : 'off'}" viewBox="0 0 24 28" width="${size}" height="${Math.round(size * 28 / 24)}" aria-hidden="true" focusable="false"><path class="f1" d="M12 1c1.2 4.2 7 6.8 7 13.5a7 7 0 0 1-14 0c0-2.6 1.2-4.3 2.6-5.6.2 1.8 1 2.9 2 3.4C9.4 8.7 10 4.6 12 1z" fill="url(#pfFlame)"/><path class="f2" d="M12 14c.6 1.6 3 2.7 3 5.2a3 3 0 0 1-6 0c0-1.2.6-2 1.2-2.6.2.8.6 1.2 1 1.4-.2-1.6.2-3 .8-4z" fill="#fff6c8"/></svg>`;

/** Anneau de progression : pct 0-100, contenu central (texte déjà échappé), label accessible. */
export const ring = (pct, inner = '', label = '', size = 76, sw = 8) => {
  const r = (size - sw) / 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, +pct || 0)), o = c * (1 - p / 100);
  return `<span class="ringw" style="width:${size}px;height:${size}px"><svg class="ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${label}"><circle class="ring-bg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${sw}" fill="none"/><circle class="ring-fg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${sw}" fill="none" stroke-linecap="round" stroke="url(#pfGradH)" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${o.toFixed(1)}" style="--c:${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg><span class="ring-in">${inner}</span></span>`;
};

/** Étoiles ★★☆ (HTML). */
export const starsHtml = n => { n = Math.max(0, Math.min(3, Math.floor(+n) || 0)); return `<span class="stars" role="img" aria-label="${n} étoile${n > 1 ? 's' : ''} sur 3">${[1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}" aria-hidden="true">★</i>`).join('')}</span>`; };

const reduced = () => { try { return matchMedia('(prefers-reduced-motion:reduce)').matches; } catch { return false; } };
/** Éclat de confettis (montée de niveau, nouveau badge). Sans effet si l'utilisateur réduit les animations. */
export function confetti(n = 56) {
  if (reduced() || typeof document === 'undefined') return;
  const host = document.createElement('div'); host.className = 'confetti'; host.setAttribute('aria-hidden', 'true');
  const cols = ['#38bdf8', '#818cf8', '#fbbf24', '#fb923c', '#34d399', '#f472b6'];
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i'), a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 260;
    s.style.cssText = `--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d - 140}px;--r:${Math.random() * 900 - 450}deg;--d:${(Math.random() * 0.25).toFixed(2)}s;background:${cols[i % cols.length]};width:${6 + Math.random() * 6}px;height:${8 + Math.random() * 8}px;border-radius:${Math.random() < 0.4 ? '50%' : '2px'}`;
    host.append(s);
  }
  document.body.append(host); setTimeout(() => host.remove(), 2600);
}

/** Effet « press » : position du ripple sous le doigt (le dessin est en CSS : button::after). */
export function initRipple() {
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest?.('button'); if (!b) return;
    const r = b.getBoundingClientRect(); b.style.setProperty('--px', (e.clientX - r.left) + 'px'); b.style.setProperty('--py', (e.clientY - r.top) + 'px');
  }, { passive: true });
}
