// Tests purs de drills.js : validité des exercices, progression de difficulté, recommandations.
import assert from 'node:assert/strict';
import { drillFor, recommend, targetLessons, levelFromScore, DRILL_DIMS, LABELS } from './drills.js';
import { featuresOf, DIMS, emptyProfile, update, analyze } from './skill.js';
import { ALL } from './curriculum.js';
import { compose } from './songs.js';

const toNotes = s => s.notes.map(([m, st, d, h]) => ({ m, s: st, d, h }));
const diff = (s) => { const f = featuresOf(toNotes(s), s.bpm); return f.density + f.range / 12 + f.leaps + f.chords + f.handIndependence + f.rhythmComplexity + f.tempo / 60; };

assert.deepEqual([...DRILL_DIMS].sort(), [...DIMS].sort(), 'une famille d\'exercices par dimension');
for (const d of DRILL_DIMS) {
  let prev = -Infinity;
  for (let l = 0; l < 4; l++) {
    const s = drillFor(d, l);
    assert.ok(s.id && s.title && s.explain && s.bpm >= 20 && s.bpm <= 400, `${d}/${l} métadonnées`);
    assert.equal(s.dim, d); assert.equal(s.level, l);
    assert.ok(s.notes.length >= 8, `${d}/${l} assez de notes`);
    for (const [m, st, du, h] of s.notes) {
      assert.ok(Number.isInteger(m) && m >= 36 && m <= 96, `${d}/${l} tessiture (${m})`);
      assert.ok(st >= 0 && du > 0 && (h === 'R' || h === 'L'), `${d}/${l} note valide`);
    }
    for (let i = 1; i < s.notes.length; i++) assert.ok(s.notes[i][1] >= s.notes[i - 1][1], `${d}/${l} triées`);
    JSON.parse(JSON.stringify(s)); // sérialisable (stockage, postMessage)
    const df = diff(s);
    assert.ok(df > prev, `${d}: le palier ${l} doit être plus difficile que le précédent (${df.toFixed(2)} <= ${prev.toFixed(2)})`);
    prev = df;
  }
}
// les mains annoncées sont bien utilisées
assert.ok(drillFor('leftHand', 1).notes.every(n => n[3] === 'L'));
assert.ok(drillFor('rightHand', 1).notes.every(n => n[3] === 'R'));
for (let l = 0; l < 4; l++) assert.ok(new Set(drillFor('coordination', l).notes.map(n => n[3])).size === 2, 'coordination = deux mains');
// propriétés ciblées
const f = (d, l) => featuresOf(toNotes(drillFor(d, l)), drillFor(d, l).bpm);
assert.ok(f('leaps', 3).range > f('leaps', 0).range && f('leaps', 0).leaps > 0.8, 'sauts croissants');
assert.ok(f('chords', 0).chords === 1, 'accords');
assert.ok(f('rhythm', 3).rhythmComplexity > f('rhythm', 0).rhythmComplexity, 'rythme');
assert.ok(drillFor('tempo', 0).tempos.length === 4 && drillFor('tempo', 0).tempos[3][1] > drillFor('tempo', 0).tempos[0][1], 'tempo croissant');
assert.equal(drillFor('hesitation', 0).mode, 'wait');
assert.equal(drillFor('timing', 0).mode, 'rhythm');
// robustesse
assert.equal(drillFor('pitch', 99).level, 3); assert.equal(drillFor('pitch', -4).level, 0); assert.equal(drillFor('pitch', NaN).level, 0);
assert.throws(() => drillFor('nope', 1));
assert.deepEqual([10, 30, 50, 80].map(levelFromScore), [0, 1, 2, 3]);
// compatible compose (même format que le reste de l'app)
assert.deepEqual(Object.keys(compose('x', 80, 'C4 D4', 'C3')).sort(), ['bpm', 'notes', 'title']);

// recommend : renvoie les 3 pires dimensions fiables
const an = { dims: {}, weaknesses: [{ dim: 'leaps', advice: 'Entraîne tes sauts.' }], overall: { score: 40 } };
const scores = { pitch: 70, rhythm: 60, timing: 55, leftHand: 20, rightHand: 65, coordination: 35, leaps: 10, chords: 50, tempo: 80, endurance: 45, hesitation: 75 };
for (const d of DIMS) an.dims[d] = { score: scores[d], confidence: 0.6, trend: 'flat', n: 30 };
const rec = recommend(an);
assert.deepEqual(rec.map(r => r.dim), ['leaps', 'leftHand', 'coordination']);
assert.equal(rec[0].level, 0); assert.ok(rec[0].reason.includes('Entraîne tes sauts.') && rec[0].reason.includes(LABELS.leaps));
assert.ok(rec.every(r => r.song.dim === r.dim));
// dimension peu fiable : ignorée tant qu'il y a assez de dimensions fiables
an.dims.timing = { score: 0, confidence: 0.05, trend: 'flat', n: 1 };
assert.ok(!recommend(an).some(r => r.dim === 'timing'));
// aucune donnée : 3 exercices par défaut, jamais de plantage
assert.equal(recommend(analyze(emptyProfile())).length, 3);
assert.equal(recommend(null).length, 3);

// targetLessons : ids existants du cours, un résultat par exercice recommandé
const tl = targetLessons(an, ALL);
assert.equal(tl.length, 3);
for (const t of tl) { assert.ok(t.lessons.length >= 1, 'au moins une leçon pour ' + t.dim); for (const l of t.lessons) assert.ok(ALL.some(a => a.id === l.id)); }
assert.ok(tl[1].lessons.some(l => /main gauche|clé de fa|basse/i.test(l.title + (l.intro || ''))), 'main gauche -> leçons main gauche');

// intégration : un profil simulé faible en main gauche
let P = emptyProfile();
for (let i = 0; i < 12; i++) P = update(P, { mode: 'wait', bpm: 90, ts: i, notes: Array.from({ length: 20 }, (_, k) => ({ req: true, hit: k % 2 === 0 ? true : false, wrong: 0, dt: 300, m: 60 + (k % 5), s: k, d: 1, h: k % 2 ? 'L' : 'R' })) });
assert.equal(recommend(analyze(P)).length, 3);
console.log('test-drills : OK');
