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
assert.match(t0.find(x => x.info.zones).info.label, /Phrase \d+ · (main droite|main gauche|deux mains) · \d+ %/);

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
assert.deepEqual(G.load(store), { goals: [], gp: {} }); assert.deepEqual(G.loadSkill(store), e);
G.save(store, { goals: [g], gp: { g1: { x: [] }, zombie: {} } });
assert.equal(G.load(store).goals.length, 1); assert.ok(!('zombie' in store.m['sp.goalProgress']), 'progression orpheline supprimée');

// ---- ton, échéance passée ----
assert.equal(G.tu('Vous gardez de la marge.'), 'Tu gardes de la marge.');
assert.equal(mk(add(NOW, -2)).plan.sessions.length, 0);
console.log('test-goals OK');
