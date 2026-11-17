import assert from 'node:assert/strict';
import { summarize, levelOf, exportData, parseImport, fixPlan, fixProfile, esc, cardModel, cardLayout, CARD } from './stats.js';
import { ALL } from './curriculum.js';

const now = new Date(2026, 10, 17, 12); // 17 nov 2026 (mardi)
// vide
let s = summarize({}, now);
assert.equal(s.level.level, 1); assert.equal(s.level.pct, 0);
assert.equal(s.calendar.length, 30); assert.equal(s.calendar[29].date, '2026-11-17');
assert.equal(s.lessons.done, 0); assert.equal(s.lessons.total, ALL.length);
assert.deepEqual(s.chords, []); assert.equal(s.known.length, 0);
assert.match(s.next, /Leçon suivante : /); assert.ok(s.messages[0].includes('commence'));

assert.equal(levelOf(0), 1); assert.equal(levelOf(50), 2); assert.equal(levelOf(200), 3);

const a = ALL[0].id, b = ALL[1].id, c = ALL[2].id;
s = summarize({
  'sp.profile': { xp: 120, hits: 40 },
  'sp.progress': { [a]: { stars: 3 }, [b]: { stars: 1 } },
  'sp.days': { '2026-11-17': { sec: 1200, done: [a] }, '2026-11-16': { sec: 100, done: [b, c] }, '2026-11-02': { sec: 600, done: [] }, '2026-10-20': { sec: 3000, done: [a] } },
  'sp.chords': { cards: { C: { box: 3 }, F: { box: 2 }, Am: { box: 4 } } },
  'sp.reading': { best: { 0: 0.9, 1: 0.5 } }, 'sp.ear': { best: [0.85, 0.9, 0.7] },
}, now);
assert.equal(s.level.level, 2); assert.equal(s.level.into, 70); assert.equal(s.level.span, 150);
assert.equal(s.minutes.week, 22); // lun 16 + mar 17 : 100s->2 + 20 = 22 (arrondi 2)
assert.equal(s.minutes.month, 22 + 10);
assert.equal(s.monthLessons, 3);
assert.equal(s.messages[0], '+3 leçons ce mois-ci, plus que le mois dernier !');
assert.deepEqual(s.chords, ['C', 'Am']);
assert.deepEqual([s.reading.done, s.ear.done], [1, 2]);
assert.deepEqual(s.known, [ALL[0].title]);
assert.equal(s.lessons.done, 2); assert.equal(s.calendar[29].lvl, 3); assert.equal(s.calendar[28].lvl, 1);
assert.equal(s.next, 'Leçon suivante : ' + ALL[2].title);
assert.ok(s.messages.every(m => !/retard|manqu|perdu|culpab/i.test(m)));

// export/import
const d = { 'sp.profile': { xp: 5, hits: 0, badges: {} }, 'sp.days': {} };
assert.deepEqual(parseImport(exportData(d)).data, d);
const imp = data => parseImport(JSON.stringify({ app: 'pianoflow', data }));
assert.deepEqual(imp({ 'sp.profile': { xp: 1 }, evil: 1 }).data, { 'sp.profile': { xp: 1, hits: 0, badges: {} } }); // clé inconnue ignorée
assert.ok(parseImport('pas du json').error); assert.ok(parseImport('{"app":"autre","data":{"sp.x":1}}').error);
assert.ok(parseImport('null').error); assert.ok(parseImport('[]').error); assert.ok(imp({ evil: 1 }).error);
// fichiers valides complets
const ok = imp({ 'sp.plan': { days: [1, 3], minutes: 15, time: '08:30', start: 3 }, 'sp.progress': { [a]: { stars: 3, plays: 2, last: 1e12, box: 2, due: 1e12 } },
  'sp.days': { '2026-11-17': { sec: 60, done: [a] } }, 'sp.week': { id: '2026-W47', sec: 5, lessons: 1, reviews: 0 }, 'sp.chords': { n: 3, cards: { C: { box: 2, due: 1, seen: 3 } }, xpDay: { d: '2026-11-17', n: 4 } },
  'sp.reading': { cards: { c4: { b: 1, due: 5 } }, best: { 0: 0.9 }, labels: true, scroll: false }, 'sp.ear': { best: [0.9], cards: { 'p0:up': { box: 1, due: 2 } } }, 'sp.guided': { x: 2 },
  'sp.settings': { mode: 'wait', speed: 1, names: true }, 'sp.micLat': 0.15, 'sp.library': [{ id: 'c1', title: 'T', notes: [[60, 0, 1]] }] });
assert.equal(ok.error, undefined); assert.equal(Object.keys(ok.data).length, 11);
// fichiers malveillants / corrompus : rejetés avec un message, rien d'écrit
for (const [k, v] of [
  ['sp.profile', { xp: '<img src=x onerror=alert(1)>' }], ['sp.profile', { xp: 1e300 }], ['sp.profile', { xp: -5 }], ['sp.profile', { badges: [] }], ['sp.profile', { badges: { a: '<b>' } }],
  ['sp.plan', { days: 'x', minutes: 10, time: '18:00' }], ['sp.plan', { days: [9], minutes: 10, time: '18:00' }], ['sp.plan', { days: [1], minutes: 99999, time: '18:00' }],
  ['sp.plan', { days: [1], minutes: 10, time: '"><script>' }], ['sp.plan', { days: [1], minutes: 10, time: '18:00', start: 1e6 }],
  ['sp.progress', { a: { stars: 1e9 } }], ['sp.progress', { a: { stars: 1.5 } }], ['sp.progress', { 'a<b': { stars: 1 } }], ['sp.progress', []],
  ['sp.days', { 'k': { sec: -1 } }], ['sp.days', { k: { sec: 1, done: 'x' } }], ['sp.week', { id: '<x>' }], ['sp.chords', { cards: { C: { box: 99 } } }], ['sp.reading', { best: { 0: 5 } }],
  ['sp.ear', { best: 'x' }], ['sp.guided', { s: '1' }], ['sp.settings', { mode: '<x>' }], ['sp.settings', { speed: 0 }], ['sp.micLat', 'a'], ['sp.library', [{ title: 1, notes: [] }]], ['sp.library', 'x'],
]) { const r = imp({ [k]: v }); assert.ok(r.error && !r.data, `devrait être rejeté : ${k} ${JSON.stringify(v)}`); assert.match(r.error, /rien n'a été modifié|Sauvegarde invalide/); }
assert.ok(imp({ 'sp.profile': { xp: 1 }, 'sp.plan': { days: 'x' } }).error); // un seul champ invalide rejette tout
// taille
assert.match(parseImport('x'.repeat(1.1e6)).error, /volumineux/);
const big = imp({ 'sp.profile': { xp: 1 }, 'sp.library': Array.from({ length: 150 }, (_, i) => ({ id: 'c' + i, title: 't', notes: Array.from({ length: 300 }, () => [60, 0, 1, 1, 1]) })) });
assert.ok(big.warnings.length && !('sp.library' in big.data) && 'sp.profile' in big.data); // bibliothèque > 500 Ko : ignorée avec avertissement
// summarize tolère les données corrompues
for (const bad of [null, undefined, 'x', 5, [], { 'sp.profile': 'x', 'sp.progress': 3, 'sp.days': { '2026-11-17': null, '2026-11-16': { sec: 'x', done: 'y' } }, 'sp.chords': { cards: { C: null } }, 'sp.reading': 'z', 'sp.ear': { best: null } },
  { 'sp.profile': { xp: 'NaN', hits: null, badges: 5 }, 'sp.progress': { [a]: { stars: 1e9 } } }]) { const r = summarize(bad, now); assert.ok(Number.isFinite(r.level.level) && r.calendar.length === 30); }
assert.equal(summarize({ 'sp.progress': { [a]: { stars: 1e9 } } }, now).lessons.done, 0);
// helpers
assert.deepEqual(fixPlan({ days: 'x', minutes: 1e9, time: '<', start: -1 }), { days: [1, 3, 5], minutes: 10, start: 0, time: '18:00' });
assert.equal(fixPlan('x'), null); assert.deepEqual(fixProfile({ xp: 'a', badges: 3 }), { xp: 0, hits: 0, badges: {} });
assert.equal(esc(`<a href="x" onclick='y'>&`), '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;');
// carte de partage
const cm = cardModel(s);
assert.equal(cm.level, 'Niveau 2'); assert.equal(cm.streak, 2); assert.deepEqual(cm.chords, ['C', 'Am']);
assert.equal(cardModel(summarize({}, now)).streak, 0);
const one = s.calendar.map((c, i) => ({ ...c, min: i === 28 ? 5 : 0 })); // aujourd'hui vide, hier joué : la série d'hier compte
assert.equal(cardModel({ ...s, calendar: one }).streak, 1);
const many = cardModel({ ...s, chords: Array.from({ length: 30 }, (_, i) => 'X' + i) }); assert.equal(many.chords.length, 14); assert.equal(many.more, 16);
const ops = cardLayout(many); assert.ok(ops.length > 40);
for (const o of ops) assert.ok(o.x >= 0 && o.y >= 0 && (o.k === 'text' ? o.x <= CARD.w && o.y <= CARD.h : o.x + o.w <= CARD.w + 0.5 && o.y + o.h <= CARD.h), JSON.stringify(o));
console.log('test-stats OK');
