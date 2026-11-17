// node test.mjs — tests sans framework : détection micro (mic.js) + chargement des morceaux (songs.js).
import assert from 'node:assert/strict';
import { detect, onset, calibrate, levels } from './mic.js';
import { DEMOS } from './songs.js';
import { parseMidi } from './parsers.js';

const SR = 44100, N = 16384, freq = m => 440 * 2 ** ((m - 69) / 12);
let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5;

function fft(re, im) { // Cooley-Tukey itératif en place
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len;
    for (let i = 0; i < n; i += len) for (let k = 0; k < len / 2; k++) {
      const c = Math.cos(a * k), s = Math.sin(a * k), u = i + k, v = u + len / 2;
      const tr = re[v] * c - im[v] * s, ti = re[v] * s + im[v] * c;
      re[v] = re[u] - tr; im[v] = im[u] - ti; re[u] += tr; im[u] += ti;
    }
  }
}
// notes = [[midi, gain]] ; bruit = amplitude du bruit blanc. Retourne le spectre en dB (Hann, comme AnalyserNode).
function spectrum(notes, noise = 1e-3) {
  const re = new Float64Array(N), im = new Float64Array(N); let ws = 0;
  for (let i = 0; i < N; i++) {
    let x = 2 * noise * rnd();
    for (const [m, g] of notes) [1, .5, .33, .2].forEach((a, k) => { x += g * a * Math.sin(2 * Math.PI * freq(m) * (k + 1) * i / SR); });
    const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N); ws += w; re[i] = x * w;
  }
  fft(re, im);
  return Float32Array.from({ length: N / 2 }, (_, i) => 20 * Math.log10(2 * Math.hypot(re[i], im[i]) / ws + 1e-12));
}
const run = (notes, expected, opts) => [...detect(spectrum(notes), SR, N, expected, { floor, ...opts })].sort((a, b) => a - b);

const floor = calibrate([spectrum([]), spectrum([])]);
assert.ok(floor < -80 && floor > -200, 'plancher de bruit plausible : ' + floor);

const C4 = 60, E4 = 64, G4 = 67, D4 = 62;
assert.deepEqual(run([[C4, .1]], [C4, D4, G4]), [C4], 'note seule');
assert.deepEqual(run([[C4, .1], [E4, .1], [G4, .1]], [C4, E4, G4, D4]), [C4, E4, G4], 'accord do-mi-sol');
assert.deepEqual(run([], [C4, E4, G4]), [], 'silence');
const white = spectrum([], 0.05);
assert.deepEqual([...detect(white, SR, N, [C4, E4, G4, 72, 48], { floor: calibrate([white]) })], [], 'bruit blanc (plancher recalibré)');
assert.deepEqual(run([[C4 - 12, .1]], [C4]), [], 'octave inférieure jouée, C4 attendu : rejeté');
assert.deepEqual(run([[C4 - 12, .1]], [C4 - 12, C4]), [C4 - 12], 'octave inférieure : seule la vraie note');
assert.deepEqual(run([[C4, .1]], [C4], { floor: floor + 90 }), [], 'note sous le seuil relevé');

// Répétition : décroissance lente puis nouvelle frappe -> une attaque seulement à la re-frappe.
{
  const hist = [], gains = [.1, .095, .09, .085, .08, .075, .07, .1, .095, .09], hits = [];
  let prev = levels(spectrum([]), SR, N, [C4]);
  gains.forEach((g, i) => {
    const cur = levels(spectrum([[C4, g]]), SR, N, [C4]);
    if (onset(prev, cur, hist)) hits.push(i);
    prev = cur;
  });
  assert.deepEqual(hits, [0, 7], 'attaques : 1re note et répétition');
}

// Données du projet : ESM + morceaux
assert.equal(typeof parseMidi, 'function');
assert.ok(Array.isArray(DEMOS) && DEMOS.length > 0, 'DEMOS non vide');
for (const d of DEMOS) assert.ok(d.title && d.notes.length > 0 && d.notes.every(n => Number.isFinite(n[0]) && n[1] >= 0), 'morceau valide : ' + d.title);

console.log('OK : tous les tests passent (' + DEMOS.length + ' morceaux)');
