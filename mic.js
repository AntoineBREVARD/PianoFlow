// Détection micro pure (sans DOM) : testable sous Node, importable par app.js.
// Entrées : spectre en dB (analyser.getFloatFrequencyData), sampleRate, fftSize.
//
// Paramètres de detect(..., opts) :
//   floor   plancher de bruit en dB (cf. calibrate)            défaut -90
//   margin  marge au-dessus du plancher pour qu'un pic compte   défaut 12 dB
//   w       poids des harmoniques f, 2f, 3f                     défaut [1, .5, .3]
//   wSub    poids de pénalité des sous-harmoniques f/2, f/3     défaut [.5, .3]
//   tol     demi-largeur de recherche du pic, fraction de f     défaut 0.03
//   range   plage dynamique max sous le pic le plus fort (anti fuite spectrale) défaut 60 dB
//   octDb   rejet si le niveau à f/2 dépasse celui de f de ... dB  défaut 3
// onset : minFlux (dB cumulés minimum, défaut 3), ratio (× médiane, défaut 2), hist (longueur, défaut 20).

const freq = m => 440 * 2 ** ((m - 69) / 12);

// Niveau (dB) du pic autour de f, interpolation parabolique sur 3 points.
function peak(spec, binHz, f, tol) {
  const c = Math.round(f / binHz), w = Math.max(1, Math.round(f * tol / binHz));
  let k = -1, pk = -Infinity;
  for (let i = Math.max(1, c - w); i <= c + w && i < spec.length - 1; i++) if (spec[i] > pk) { pk = spec[i]; k = i; }
  if (k < 0) return -Infinity;
  const a = spec[k - 1], b = spec[k], g = spec[k + 1], d = a - 2 * b + g;
  return d < 0 ? b - 0.125 * (a - g) * (a - g) / d : b; // sommet de la parabole
}

export function levels(spec, sr, fftSize, midis, tol = 0.03) {
  const binHz = sr / fftSize;
  return midis.map(m => peak(spec, binHz, freq(m), tol));
}

export function detect(spec, sr, fftSize, expected, opts = {}) {
  const { floor = -90, margin = 12, w = [1, .5, .3], wSub = [.5, .3], tol = 0.03, octDb = 3, range = 60 } = opts;
  const binHz = sr / fftSize, nyq = sr / 2, out = new Set();
  let top = -Infinity; for (let i = 1; i < spec.length; i++) if (spec[i] > top) top = spec[i];
  const thr = Math.max(floor + margin, top - range);
  for (const m of expected) {
    const f = freq(m);
    const L = k => (f * k < nyq ? peak(spec, binHz, f * k, tol) : -Infinity);
    const e = w.map((_, i) => Math.max(0, L(i + 1) - thr));
    const s = wSub.map((_, i) => Math.max(0, L(1 / (i + 2)) - thr));
    const score = e.reduce((a, x, i) => a + w[i] * x, 0) - s.reduce((a, x, i) => a + wSub[i] * x, 0);
    // fondamentale présente, score positif, et pas simplement l'harmonique 2 d'une note une octave plus bas
    if (e[0] > 0 && score > 0 && !(L(.5) > L(1) + octDb)) out.add(m);
  }
  return out;
}

// Plancher de bruit : médiane des niveaux (dB) de tous les bins sur quelques frames de silence.
export function calibrate(frames) {
  const all = [];
  for (const fr of frames) for (let i = 1; i < fr.length; i++) if (isFinite(fr[i])) all.push(fr[i]);
  if (!all.length) return -90;
  all.sort((a, b) => a - b);
  return all[all.length >> 1];
}

// Attaque : flux spectral positif (somme des hausses de niveau) > médiane glissante × ratio.
// prev/cur : tableaux de niveaux (cf. levels) ou nombres ; history : tableau de flux passés (mis à jour ici).
export function onset(prev, cur, history, { minFlux = 3, ratio = 2, hist = 20 } = {}) {
  const flux = Array.isArray(cur)
    ? cur.reduce((a, x, i) => a + (isFinite(x) ? Math.max(0, x - (isFinite(prev[i]) ? prev[i] : x - 20)) : 0), 0)
    : Math.max(0, cur - prev);
  const s = [...history].sort((a, b) => a - b), med = s.length ? s[s.length >> 1] : 0;
  history.push(flux); if (history.length > hist) history.shift();
  return flux > minFlux && flux > med * ratio;
}
