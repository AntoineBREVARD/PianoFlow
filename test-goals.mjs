// Logique non-DOM de goals.js : création, progression, adaptation retard/avance (faux skill), profil corrompu.
import assert from 'node:assert/strict';
import * as SK from './skill.js';
import { DEMOS } from './songs.js';
import * as G from './goals.js';

const NOW = '2026-11-17', add = G.addDays;
const song = DEMOS.find(d => d.notes.length > 40) || DEMOS[0];
const fake = { predict: () => ({ pSuccess: 0.8, expectedAttempts: 1.25 }) }; // faux skill
const prof = SK.emptyProfile();
const mk = (dl = add(NOW, 60), mpd = 20) => G.createGoal({ song, deadline: dl, minutesPerDay: mpd, days: [0, 1, 2, 3, 4, 5, 6], now: NOW, profile: prof, mod: fake, id: 'g1' });
const O = { now: NOW, profile: prof, mod: fake };

// ---- création ----
const g = mk();
assert.equal(g.status, 'active'); assert.equal(g.songId, G.songIdOf(song)); assert.ok(g.plan.sessions.length > 5);
assert.equal(G.fixGoals([g]).length, 1, 'un objectif valide survit à la validation');
const st = { goals: [g], gp: {} };
G.addGoal(st, mk(add(NOW, 40))); assert.equal(st.goals.filter(x => x.status === 'active').length, 1, 'un seul actif par morceau');
st.goals = [g]; g.status = 'active';

// ---- tâches du jour ----
const t0 = G.todayTasks(g, NOW); assert.ok(t0.length > 0);
for (const { info } of t0) { assert.ok(['wait', 'rhythm'].includes(info.mode) && ['R', 'L', 'both'].includes(info.hands)); if (info.zones) assert.ok(info.zones[0][1] > info.zones[0][0]); }
assert.match(t0.find(x => x.info.zones).info.label, /Phrase \d+( \((début|fin)\))? · (main droite|main gauche|deux mains) · \d+ %/);

// ---- tentative synthétique : toutes les notes d'une phrase ----
const uniq = g.plan.analysis.sections.filter(s => !s.dupOf), sec = uniq[0], h0 = sec.features.hands === 'both' ? 'R' : sec.features.hands;
const attemptFor = (s, { acc = 1, speed = 1, hands = 'both', ts = Date.now() } = {}) => ({ songId: g.songId, ts, mode: 'rhythm', hands, speed, bpm: 100,
  notes: song.notes.filter(n => n[1] >= s.startBeat - 1e-6 && n[1] < s.endBeat - 1e-6).map(([m, s_, d, h], i) => ({ i, m, s: s_, d, h, req: hands === 'both' || h === hands, hit: (i % 100) / 100 < acc, wrong: 0, dt: 10 })) });
const hits = G.sectionHits(g.plan, attemptFor(sec)); assert.equal(hits[0].sid, sec.id); assert.ok(hits[0].acc > 0.95);
assert.deepEqual(G.sectionHits(g.plan, { notes: [] }), []); assert.deepEqual(G.sectionHits(g.plan, null), []);
assert.deepEqual(G.applyAttempt(st, { ...attemptFor(sec), mode: 'demo' }, O), [], 'démo ignorée');
assert.deepEqual(G.applyAttempt(st, { ...attemptFor(sec), songId: 'autre' }, O), [], 'autre morceau ignoré');

// ---- progression : 2 tentatives réussies valident l'étape ----
const m0 = G.progressOf(g, st.gp)[sec.id];
for (let i = 0; i < 2; i++) assert.equal(G.applyAttempt(st, attemptFor(sec, { speed: 0.5, hands: h0 }), O).length, 1);
const m1 = G.progressOf(g, st.gp)[sec.id];
assert.ok(m1.mastery > m0.mastery && m1.stage >= 1, 'la maîtrise progresse'); assert.equal(st.gp.g1[sec.id].length, 2); assert.ok(g.reasons.length >= 1);

// ---- retard : 10 jours sans pratiquer, rien n'est sauté ----
const lateG = mk(), sl = { goals: [lateG], gp: {} }, later = add(NOW, 10);
G.dailyAdapt(sl, { now: later, profile: prof, mod: fake });
assert.equal(lateG.pace, 'behind'); assert.match(lateG.reasons[0], /moins vite|on reste/);
assert.ok(lateG.plan.sessions[0].date >= later, 'le calendrier repart d\'aujourd\'hui');
assert.ok(lateG.plan.sessions.flatMap(s => s.tasks).some(t => t.sectionId === uniq[0].id && t.type !== 'review'), 'la 1re phrase non maîtrisée reste au programme');

// ---- avance : tout maîtrisé tôt => terminé ; moitié maîtrisée => pas de retard ----
const fastG = mk(), sf = { goals: [fastG], gp: {} };
for (const s of uniq) for (let i = 0; i < 3; i++) G.applyAttempt(sf, attemptFor(s), { ...O, now: add(NOW, 1) });
assert.equal(fastG.status, 'done', 'tout maîtrisé => programme terminé');
const aheadG = mk(), sa = { goals: [aheadG], gp: {} };
for (const s of uniq.slice(0, Math.ceil(uniq.length / 2))) for (let i = 0; i < 3; i++) G.applyAttempt(sa, attemptFor(s), { ...O, now: add(NOW, 1) });
assert.ok(['ahead', 'on_track'].includes(aheadG.pace), 'en avance : pas de retard déclaré');

// ---- faux skill défaillant : pas de plantage ----
const bad = { predict: () => { throw new Error('x'); } };
assert.ok(G.createGoal({ song, deadline: add(NOW, 30), minutesPerDay: 15, days: [1, 3, 5], now: NOW, profile: prof, mod: bad }).plan.sessions.length > 0);

// ---- stockage corrompu ----
const e = SK.emptyProfile();
const cs = [null, undefined, 3, 'x', [], {}, { v: 1 }, { v: 1, dims: {}, hist: {} }, { v: 2, dims: e.dims, hist: e.hist },
  { ...e, dims: { ...e.dims, pitch: { mu: 'a', v: 1, n: 1 } } }, { ...e, dims: { ...e.dims, pitch: { mu: NaN, v: 1, n: 1 } } }];
for (const c of cs) assert.deepEqual(G.fixSkill(c), e, 'profil corrompu => emptyProfile');
const good = SK.update(e, attemptFor(sec)); assert.equal(G.fixSkill(good).attempts, good.attempts);
assert.equal(G.fixSkill({ ...good, hist: { ...good.hist, pitch: Array.from({ length: 500 }, (_, i) => i / 500) } }).hist.pitch.length, 12, 'historique plafonné');
assert.equal(G.recordSkill(good, attemptFor(sec)).attempts, good.attempts + 1);
assert.deepEqual(G.recordSkill('zzz', attemptFor(sec), { update: () => { throw new Error('x'); } }), e, 'update défaillant => profil sain');
assert.deepEqual(G.fixGoals('x'), []);
assert.deepEqual(G.fixGoals([null, 1, {}, { id: 'a', plan: 3 }, { ...g, plan: { ...g.plan, sessions: 'x' } }, { ...g, deadline: 'demain' }]), []);
assert.deepEqual(G.fixGoalProgress({ a: { s1: [{ acc: 'x', speed: 1 }, { acc: 0.9, speed: 1, hands: 'Z', ts: 1 }] }, b: 4 }), { a: { s1: [{ acc: 0.9, speed: 1, hands: 'both', ts: 1 }] } });
const store = { m: { 'sp.goals': 'junk', 'sp.goalProgress': [1], 'sp.skill': { v: 9 } }, get(k, d) { return this.m[k] ?? d; }, set(k, v) { this.m[k] = JSON.parse(JSON.stringify(v)); return true; } };
assert.deepEqual(G.load(store), { goals: [], gp: {}, gt: {} }); assert.deepEqual(G.loadSkill(store), e);
G.save(store, { goals: [g], gp: { g1: { x: [] }, zombie: {} } });
assert.equal(G.load(store).goals.length, 1); assert.ok(!('zombie' in store.m['sp.goalProgress']), 'progression orpheline supprimée');

// ---- ton, échéance passée ----
assert.equal(G.tu('Vous gardez de la marge.'), 'Tu gardes de la marge.');
assert.equal(mk(add(NOW, -2)).plan.sessions.length, 0);
console.log('test-goals OK');

// ---- état des tâches du jour (accueil) ----
{
  const gg = mk(add(NOW, 60), 15), ts0 = Date.parse(NOW + 'T10:00:00'), tk = G.todayTasks(gg, NOW)[0].t, sid = String(tk.sectionId).split('+')[0];
  const th = tk.hands === 'R' || tk.hands === 'L' ? tk.hands : 'both', accT = tk.goal.accuracy;
  const gpOf = a => ({ [gg.id]: { [sid]: a } }), at = o => ({ acc: accT, speed: tk.speed, hands: th, ts: ts0, ...o });
  const only = String(tk.sectionId).includes('+') || tk.sectionId === 'all' ? null : true;
  console.log('tâche testée:', tk.sectionId); if (only) {
    assert.equal(G.taskState(gg, {}, tk, NOW), 'todo');
    const R = tk.reps, many = o => Array.from({ length: R }, () => at(o));
    assert.ok(R >= 1);
    assert.equal(G.taskState(gg, gpOf(many({})), tk, NOW), 'done');
    assert.equal(G.taskState(gg, gpOf(many({ acc: accT - 0.2 })), tk, NOW), 'doing', 'précision insuffisante = en cours');
    assert.equal(G.taskState(gg, gpOf(many({ speed: tk.speed / 2 })), tk, NOW), 'todo', 'vitesse insuffisante : tâche non entamée');
    assert.equal(G.taskState(gg, gpOf([at({ ts: ts0 - 864e5 })]), tk, NOW), 'todo', 'tentative d hier ignorée');
    if (th !== 'both') assert.equal(G.taskState(gg, gpOf(many({ hands: th === 'R' ? 'L' : 'R' })), tk, NOW), 'todo', 'autre main ignorée');
  }
}
console.log('test-goals : état des tâches OK');

// ---- blocs : regroupement, compteur, liste figée, changement de jour, corruption ----
{
  const mkSong = (song, mpd) => G.createGoal({ song, deadline: add(NOW, 30), minutesPerDay: mpd, days: [0, 1, 2, 3, 4, 5, 6], now: NOW, profile: prof, mod: fake, id: 'gb' });
  for (const song of DEMOS.slice(0, 3)) for (const mpd of [10, 15, 30]) {
    const ts = G.todayTasks(mkSong(song, mpd), NOW).map(x => x.t);
    assert.ok(ts.length >= 1 && ts.length <= 12, `${song.title} ${mpd} min : ${ts.length} blocs`);
    assert.ok(ts.reduce((x, t) => x + t.minutes, 0) <= mpd + 0.5, 'budget respecté');
    // seul le dernier bloc de la séance peut être un reste plus court (étape qui se termine ou budget épuisé)
    for (const t of ts.slice(0, -1).filter(t => ['learn', 'hands', 'together', 'tempo'].includes(t.type))) assert.ok(t.minutes >= 3 && t.reps >= 2, `bloc d'au moins 3 min : ${t.minutes}`);
  }
  const tw = DEMOS.find(d => /Twinkle/.test(d.title)), n15 = G.todayTasks(mkSong(tw, 15), NOW).length, n10 = G.todayTasks(mkSong(tw, 10), NOW).length;
  assert.ok(n15 >= 3 && n15 <= 5, 'séance de 15 min : 3 à 5 blocs, pas ' + n15); assert.ok(n10 >= 3 && n10 <= 5 && n10 <= n15);
  const gb = mkSong(tw, 15), sb = { goals: [gb], gp: {}, gt: {} }, tasks0 = G.todayTasks(gb, NOW);
  assert.match(tasks0[0].info.label, /^Phrase \d+( \((début|fin)\))? · (main droite|main gauche|deux mains) · \d+ % · \d+ fois$/);
  // liste figée : générée une fois, stable après plusieurs tentatives (le calendrier, lui, est replanifié)
  assert.equal(G.ensureToday(sb, gb, NOW), true); assert.equal(G.ensureToday(sb, gb, NOW), false, 'pas de regénération le même jour');
  const frozen = JSON.stringify(sb.gt.gb);
  const us = gb.plan.analysis.sections.filter(s => !s.dupOf), s0 = us.find(s => s.id === tasks0[0].t.sectionId.split('+')[0]);
  const att = (s, ts) => ({ songId: gb.songId, ts, mode: 'rhythm', hands: 'both', speed: 1, bpm: 100, notes: tw.notes.filter(n => n[1] >= s.startBeat - 1e-6 && n[1] < s.endBeat - 1e-6).map(([m, s_, d, h], i) => ({ i, m, s: s_, d, h, req: true, hit: true, wrong: 0, dt: 10 })) });
  const t0 = tasks0[0].t, noon = Date.parse(NOW + 'T10:00:00');
  const before = G.taskProgress(gb, sb.gp, t0, NOW); assert.equal(before.n, 0);
  G.applyAttempt(sb, att(s0, noon), O); assert.deepEqual(G.taskProgress(gb, sb.gp, t0, NOW), { state: 'doing', n: 1, reps: t0.reps }, 'compteur +1 par tentative valide');
  G.applyAttempt(sb, att(s0, noon + 1), O);
  const half = Math.ceil(t0.reps / 2); assert.ok(t0.reps > 2 && t0.reps <= 8);
  assert.equal(G.taskProgress(gb, sb.gp, t0, NOW).state, 'doing', '2 réussites valident l étape mais le bloc n est pas ✓ avant la moitié des répétitions');
  for (let i = 2; i < half; i++) G.applyAttempt(sb, att(s0, noon + 1 + i), O);
  assert.equal(G.taskProgress(gb, sb.gp, t0, NOW).state, 'done', 'étape validée + moitié des répétitions : bloc ✓');
  assert.equal(JSON.stringify(sb.gt.gb), frozen, 'liste du jour inchangée après les tentatives');
  assert.deepEqual(G.frozenTasks(sb, gb, NOW).map(x => x.t), tasks0.map(x => x.t));
  // tentative insuffisante : le compteur n'avance pas
  const sw = { goals: [gb], gp: {}, gt: {} }; G.ensureToday(sw, gb, NOW);
  G.applyAttempt(sw, { ...att(s0, noon), notes: att(s0, noon).notes.map(n => ({ ...n, hit: false })) }, O);
  assert.equal(G.taskProgress(gb, sw.gp, t0, NOW).n, 0);
  // étape validée en cours de journée : bloc ✓ sans objet, toujours présent
  const gm = { [gb.id]: { [s0.id]: [{ acc: 1, speed: 1, hands: 'both', ts: noon }, { acc: 1, speed: 1, hands: 'both', ts: noon + 1 }, { acc: 1, speed: 1, hands: 'both', ts: noon + 2 }] } };
  assert.equal(G.taskProgress(gb, gm, t0, NOW).state, 'done');
  // changement de jour : régénération
  const next = add(NOW, 1); assert.equal(G.ensureToday(sb, gb, next), true); assert.equal(sb.gt.gb.date, next);
  // réorganisation explicite
  assert.equal(G.ensureToday(sb, gb, next, true), true);
  // corruption : entrées invalides ignorées (=> regénérées), jamais d'exception
  const good1 = { date: NOW, tasks: tasks0.map(x => x.t) };
  for (const bad1 of [null, 3, 'x', [], { gb: 5 }, { gb: { date: 'hier', tasks: good1.tasks } }, { gb: { date: NOW, tasks: [] } }, { gb: { date: NOW, tasks: 'x' } },
    { gb: { date: NOW, tasks: [{ ...good1.tasks[0], reps: 'a' }] } }, { gb: { date: NOW, tasks: [{ ...good1.tasks[0], speed: NaN }] } }, { gb: { date: NOW, tasks: [null] } }, { gb: { date: NOW, tasks: [{ ...good1.tasks[0], hands: 'Z' }] } }])
    assert.deepEqual(G.fixGoalToday(bad1), {}, 'goalToday corrompu ignoré : ' + JSON.stringify(bad1)?.slice(0, 40));
  assert.deepEqual(Object.keys(G.fixGoalToday({ gb: good1 })), ['gb']);
  const stc = { goals: [gb], gp: {}, gt: { gb: { date: NOW, tasks: [{ ...good1.tasks[0], sectionId: 'inconnue' }] } } };
  assert.equal(G.ensureToday(stc, gb, NOW), true, 'tâche sans phrase connue : regénération'); assert.equal(G.frozenTasks(stc, gb, NOW).length, tasks0.length);
  const stor = { m: { 'sp.goals': [gb], 'sp.goalToday': { gb: good1, zombie: good1 } }, get(k, d) { return this.m[k] ?? d; }, set(k, v) { this.m[k] = JSON.parse(JSON.stringify(v)); return true; } };
  const ld = G.load(stor); G.save(stor, ld); assert.ok(!('zombie' in stor.m['sp.goalToday']), 'liste d\'un objectif supprimé purgée');
}
console.log('test-goals : blocs OK');
