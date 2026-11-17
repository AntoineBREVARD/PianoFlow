import assert from 'node:assert/strict';
import { partials, envelope } from './synth.js';

const hz = m => 440 * 2 ** ((m - 69) / 12);
for (const m of [21, 36, 60, 72, 96, 108]) {
  const ps = partials(m, 0.8);
  assert.ok(ps.length >= 3, 'partiels ' + m);
  assert.ok(ps.every(p => p.freq > 0 && p.freq <= 12000 && p.amp > 0 && p.tau > 0));
  assert.ok(Math.abs(ps.reduce((s, p) => s + p.amp, 0) - 1) < 1e-9);
  assert.ok(Math.abs(ps[0].freq / hz(m) - 1) < 0.01, 'fondamental ' + m);
}
// inharmonicité : le partiel 5 est plus haut que 5*f0, de l'ordre de B*n^2/2 (~1e-4 en médium)
const p60 = partials(60).find(p => p.n === 5);
const stretch = p60.freq / (5 * hz(60)) - 1;
assert.ok(stretch > 5e-4 && stretch < 5e-3, 'stretch ' + stretch);
// cordes désaccordées : 2 entrées de signe opposé pour le fondamental
const f = partials(60).filter(p => p.n === 1);
assert.equal(f.length, 2); assert.equal(f[0].detune, -f[1].detune); assert.ok(f[1].detune > 0 && f[1].detune < 3);
// partiels hauts décroissent plus vite ; aigus plus vite que graves
const ps = partials(60);
assert.ok(ps.at(-1).tau < ps[0].tau);
assert.ok(partials(90)[0].tau < partials(40)[0].tau);
// brillance liée à la vélocité
const ratio = v => { const q = partials(60, v); return q.filter(p => p.n >= 3).reduce((s, p) => s + p.amp, 0); };
assert.ok(ratio(1) > ratio(0.2));
// enveloppe
for (const m of [24, 60, 100]) {
  const e = envelope(m, 0.8);
  assert.ok(e.attack >= 0.003 && e.attack <= 0.006);
  assert.ok(e.release > 0.04 && e.release < 0.25);
  assert.ok(e.tauSlow > e.tauFast && e.peak > 0 && e.peak < 0.5);
}
assert.ok(envelope(60, 1).attack < envelope(60, 0.1).attack);
assert.ok(envelope(60, 1).peak > envelope(60, 0.1).peak);
assert.ok(envelope(30).tauSlow > envelope(90).tauSlow);
console.log('test-synth OK');
