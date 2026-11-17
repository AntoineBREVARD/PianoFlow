// node test-reading.mjs — partie pure de reading.js
import assert from 'node:assert/strict';
import { keyLabel, parse, posOf, PALIERS, newState, unlocked, nextQuestion, check, record, finish, kbStart, nameFr, hintText, PASS, staffSvg, makePhrase, phraseStart, phrasePalier, GCLEF } from './reading.js';

assert.equal(parse('C4').midi, 60); assert.equal(parse('F#4').midi, 66); assert.equal(parse('Bb2').midi, 46);
assert.equal(posOf(parse('E4'), 'g'), 0); assert.equal(posOf(parse('F5'), 'g'), 8); assert.equal(posOf(parse('C4'), 'g'), -2);
assert.equal(posOf(parse('G2'), 'f'), 0); assert.equal(posOf(parse('A3'), 'f'), 8); assert.equal(posOf(parse('C4'), 'f'), 10);
assert.equal(nameFr(parse('Bb4')), 'Si♭'); assert.throws(() => parse('H4'));

// paliers : toutes les notes ont une clé unique par palier et une position cohérente
assert.equal(PALIERS.length, 8);
for (const p of PALIERS) for (const n of [...p.notes, ...p.extra]) assert.ok(Number.isInteger(posOf(n, n.clef)), n.key);

// déblocage à 85 %
const st = newState();
assert.ok(unlocked(st, 0)); assert.ok(!unlocked(st, 1));
let r = finish(st, 0, 8, 10); assert.ok(!r.passed && !unlocked(st, 1));
r = finish(st, 0, 9, 10); assert.ok(r.passed && r.unlockedNext && unlocked(st, 1));
finish(st, 0, 5, 10); assert.equal(st.best[0], 0.9); // le meilleur score est conservé
assert.equal(finish(st, 0, 9, 10).unlockedNext, false);

// Leitner 1/3/7/14/30 j, boîtes 0-4
const D = 864e5, t0 = 1e12, s2 = newState();
record(s2, 'g:C4', true, t0); assert.equal(s2.cards['g:C4'].b, 1); assert.equal(s2.cards['g:C4'].due, t0 + 3 * D);
for (let i = 0; i < 6; i++) record(s2, 'g:C4', true, t0);
assert.equal(s2.cards['g:C4'].b, 4); assert.equal(s2.cards['g:C4'].due, t0 + 30 * D);
record(s2, 'g:C4', false, t0); assert.equal(s2.cards['g:C4'].b, 0); assert.equal(s2.cards['g:C4'].due, t0 + D);

// génération : appartient au palier, pas deux fois de suite, favorise les ratées, validation
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const keys = new Set(PALIERS[1].notes.concat(PALIERS[1].extra).map(n => n.key));
let prev = null;
for (let i = 0; i < 200; i++) { const q = nextQuestion(newState(), 1, { rnd, last: prev }); assert.ok(keys.has(q.key)); assert.notEqual(q.key, prev); prev = q.key; }
const cnt = {}; for (let i = 0; i < 600; i++) { const q = nextQuestion(newState(), 2, { rnd, missed: ['g:G4'] }); cnt[q.key] = (cnt[q.key] || 0) + 1; }
assert.ok(cnt['g:G4'] > cnt['g:C4'] * 2);
const q = nextQuestion(newState(), 0, { rnd }); assert.ok(check(q, q.midi) && !check(q, q.midi + 1));
assert.ok(PALIERS.every((_, i) => nextQuestion(newState(), i, { rnd }).grand === !!PALIERS[i].grand));

// clavier : la cible est toujours dans la fenêtre de 2 octaves
for (let i = 0; i < PALIERS.length; i++) for (const n of PALIERS[i].notes) { const s = kbStart(n), lo = 12 * (s + 1); assert.ok(n.midi >= lo && n.midi < lo + 24, n.key); }
assert.match(hintText({ clef: 'g', pos: 2 }), /Lignes/);
assert.match(hintText({ clef: 'g', pos: 3 }), /Interlignes/);
assert.match(hintText({ clef: 'g', pos: -2 }), /Do central/);
// clés en tracés SVG, plus de glyphes Unicode
for (const [c, n] of [['g', 'F5'], ['f', 'G3']]) { const x = parse(n), svg = staffSvg({ clef: c, ...x, pos: posOf(x, c) }); assert.ok(svg.includes('<path') && !/[\u{1D11E}\u{1D122}]/u.test(svg)); }
assert.ok(GCLEF.startsWith('M'));
// mode rythme : la note porte la classe d'animation seulement si demandé
const qn = { clef: 'g', ...parse('C4'), pos: -2 };
assert.ok(staffSvg(qn, 0, { slide: true }).includes('class="rd-n"') && !staffSvg(qn, 0).includes('rd-n'));
// phrase : 4 notes, même clé, voisines, sans répétition, toutes sur le clavier, dans le palier
const p4 = new Set(PALIERS.flatMap((p, i) => i < 4 ? [] : [...p.notes, ...p.extra].map(n => n.key)));
for (let pi = 4; pi < PALIERS.length; pi++) for (let k = 0; k < 100; k++) {
  const ph = makePhrase(pi, { rnd }), ms = ph.notes.map(n => n.midi), s0 = phraseStart(ph.notes), lo = 12 * (s0 + 1);
  assert.equal(ph.notes.length, 4); assert.ok(ph.notes.every(n => n.clef === ph.clef && p4.has(n.key)));
  assert.ok(Math.max(...ms) - Math.min(...ms) <= 12); assert.ok(ms.every(m => m >= lo && m < lo + 24), ph.notes.map(n => n.key).join());
  assert.ok(ph.notes.every((n, j) => !j || n.key !== ph.notes[j - 1].key));
}
assert.equal(phrasePalier(newState()), -1);
const sp = newState(); for (let i = 0; i < 4; i++) sp.best[i] = 1; assert.equal(phrasePalier(sp), 4);
sp.best[4] = 1; assert.equal(phrasePalier(sp), 5);
const sg = staffSvg({ clef: 'g', grand: false, pos: 0 }, 0, { seq: [{ pos: 0, a: 0 }, { pos: 2, a: 1 }], cur: 1 }); assert.equal((sg.match(/<ellipse/g) || []).length, 2);
console.log('reading: OK', PASS);

// cartes corrompues : boîte hors 0-4, cards/best null ou de mauvais type, due NaN
{
  const st = { cards: { 'g:C4': { b: 9, due: 'x' }, 'g:D4': { b: -3, due: 0 }, 'g:E4': null }, best: null };
  const q = nextQuestion(st, 0, { rnd: () => 0.5 });
  assert.ok(q && Number.isFinite(q.pos));
  record(st, 'g:C4', true); assert.ok(st.cards['g:C4'].b <= 4 && Number.isFinite(st.cards['g:C4'].due));
  record(st, 'g:D4', true); assert.equal(st.cards['g:D4'].b, 1);
  assert.equal(finish({ cards: 5, best: 'zz' }, 0, 9, 10).passed, true);
  assert.equal(unlocked({ cards: null, best: [1] }, 1), true);
  assert.equal(keyLabel(60), 'C4, do'); assert.equal(keyLabel(61), 'C♯4, do dièse');
}
console.log('reading robustesse OK');
