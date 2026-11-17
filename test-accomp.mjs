import assert from 'node:assert/strict';
import { bassLine, pattern, events, beatsPerBar } from './accomp.js';
assert.equal(beatsPerBar('3/4'), 3); assert.equal(beatsPerBar('6/8'), 3); assert.equal(beatsPerBar([4, 4]), 4); assert.equal(beatsPerBar('x'), 4);
assert.deepEqual(pattern('4/4').filter(x => x.kind === 'clap').map(x => x.b), [1, 3]);
assert.equal(pattern('3/4').length, 6);
const notes = [[72, 0, 1, 'R'], [48, 0, 2, 'L'], [55, 1, 1, 'L'], [43, 4, 2, 'L'], [60, 8, 1, 'R']];
const b = bassLine(notes, 120);
assert.deepEqual(b.map(x => [x.s, x.m]), [[0, 48], [2, 48], [4, 43], [6, 43]]);       // racine = note grave de la mesure, temps 1 et 3
assert.equal(b[1].t, 1);                                                               // 2 temps à 120 bpm = 1 s
assert.ok(b.every(x => x.m >= 28 && x.m <= 52));
assert.deepEqual(bassLine([[72, 0, 1, 'R']], 100), []);                                // pas de main gauche : rien
assert.deepEqual(bassLine(notes, 100, { grid: [{ s: 0, m: 60 }, { s: 4, m: 67 }] }).map(x => [x.s, x.m]), [[0, 48], [2, 48], [4, 43], [6, 43]]); // 60 -> 48, 67 -> 43 (repliées)
assert.deepEqual(bassLine(notes, 100, { timeSig: '3/4', grid: [{ s: 0, m: 40 }] }).map(x => x.s), [0]);
const e = events(notes, 100, { rhythm: true });
assert.ok(e.some(x => x.kind === 'hat') && e.some(x => x.kind === 'clap'));
assert.ok(e.every((x, i) => !i || e[i - 1].s <= x.s));
assert.equal(events(notes, 100).every(x => x.kind === 'bass'), true);
console.log('accomp OK');
