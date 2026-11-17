// node test-ear.mjs — partie pure de ear.js
import assert from 'node:assert/strict';
import { PALIERS, INTERVALS, newState, unlocked, record, pickKey, finish, question, checkChoice, melodyStep, rhythmJudge, fix, DAYS, SESSION, MEL_LO, MEL_HI } from './ear.js';

let seed = 7; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
assert.equal(PALIERS.length, 5);
assert.deepEqual(Object.values(INTERVALS).map(i => i.semi), [2, 3, 4, 5, 7, 12]);

// questions : chaque palier, 300 tirages, cohérence
const S = newState();
for (let p = 0; p < 5; p++) for (let n = 0; n < 300; n++) {
  const q = question(S, p, n % SESSION, rng);
  assert.equal(q.p, p); assert.ok(q.hints.length >= 2);
  if (q.mode === 'seq' && p === 0) { const [a, b] = q.notes; assert.equal(q.answer, b > a ? 'up' : 'down'); assert.ok(a !== b); }
  if (p === 1) { assert.equal(q.notes[1] - q.notes[0], INTERVALS[q.key].semi); assert.ok(checkChoice(q, q.key)); }
  if (p === 2) { assert.ok(q.choices.some(c => c[0] === q.answer)); if (n % SESSION < 6) assert.notEqual(q.key, 'sept'); }
  if (p === 3) { assert.equal(q.notes.length, +q.key.slice(3)); assert.ok(q.notes.length >= 3 && q.notes.length <= 5); assert.ok(q.notes.every(m => m >= MEL_LO && m <= MEL_HI)); }
  if (p === 4) assert.ok(q.bpm >= 60 && q.bpm <= 90);
}
assert.equal(checkChoice({ answer: 'up' }, 'down'), false);

// mélodie
const m = { answer: [60, 62, 64] };
assert.equal(melodyStep(m, 0, 60), 'ok'); assert.equal(melodyStep(m, 1, 61), 'bad'); assert.equal(melodyStep(m, 2, 64), 'done');

// pulsation
assert.equal(rhythmJudge([0, 1000, 2000, 3000, 4000, 5000, 6000, 7000], 1000).ok, true);
assert.equal(rhythmJudge([0, 1000, 2000], 1000).ok, false); // trop peu de taps
assert.equal(rhythmJudge([0, 300, 1500, 1800, 3500, 3600, 5000], 1000).ok, false); // irrégulier
assert.equal(rhythmJudge([0, 1100, 2150, 3300, 4300, 5200, 6300, 7250], 1000).ok, true); // petite dérive tolérée

// Leitner : bonne réponse -> boîte +1 (plafond 4), échec -> boîte 0 ; échéances 1/3/7/14/30 j
const L = newState(), t0 = 1e12, D = 864e5;
assert.deepEqual(DAYS, [1, 3, 7, 14, 30]);
let c = record(L, 1, 'sec', false, t0); assert.equal(c.box, 0); assert.equal(c.due, t0 + D);
c = record(L, 1, 'sec', true, t0); assert.equal(c.box, 1); assert.equal(c.due, t0 + 3 * D);
for (let i = 0; i < 6; i++) c = record(L, 1, 'sec', true, t0);
assert.equal(c.box, 4); assert.equal(c.due, t0 + 30 * D);
c = record(L, 1, 'sec', false, t0); assert.equal(c.box, 0);

// pickKey : carte due prioritaire, évite le dernier tirage
const K = newState(); record(K, 0, 'up', true, t0); // up pas due, down jamais vue
for (let i = 0; i < 20; i++) assert.equal(pickKey(K, 0, t0, rng, null), 'down');
assert.notEqual(pickKey(newState(), 0, t0, rng, 'up'), 'up');
assert.equal(pickKey(K, 0, t0 + 2 * D, rng, 'down'), 'up'); // up due, down exclu

// déblocage ≥ 80 %
const U = newState(); assert.equal(unlocked(U, 0), true); assert.equal(unlocked(U, 1), false);
let r = finish(U, 0, 7, 10); assert.equal(r.pass, false); assert.equal(unlocked(U, 1), false);
r = finish(U, 0, 8, 10); assert.equal(r.pass, true); assert.equal(r.newUnlock, true); assert.equal(unlocked(U, 1), true);
r = finish(U, 0, 10, 10); assert.equal(r.newUnlock, false); r = finish(U, 0, 3, 10); assert.equal(U.best[0], 1);
console.log('test-ear OK');

// état corrompu : box hors 0-4, cards/best null ou de mauvais type
{
  const st = { cards: { 'p0:up': { box: 99, due: NaN }, 'p0:down': 'x' }, best: {} };
  assert.ok(['up', 'down'].includes(pickKey(st, 0, Date.now(), rng, null)));
  assert.ok(record(st, 0, 'up', true).box <= 4);
  assert.equal(finish({ cards: null, best: null }, 0, 9, 10).pass, true);
  assert.equal(unlocked({ best: null }, 1), false);
  assert.ok(Array.isArray(fix({ best: 3 }).best));
}
console.log('ear robustesse OK');
