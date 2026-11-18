// Validation par simulation de skill.js : joueurs synthétiques à niveau caché connu.
// Le simulateur a ses PROPRES formules de difficulté et un modèle génératif en produit de portes ;
// l'estimateur est donc volontairement mal spécifié (cas réaliste).
import assert from 'node:assert/strict';
import { DEMOS } from './songs.js';
import { emptyProfile, update, analyze, predict, diagnoseAttempt, featuresOf, annotate } from './skill.js';

const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const sig = x => 1 / (1 + Math.exp(-x)), clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const songs = DEMOS.map(d => ({ id: d.id, bpm: d.bpm, notes: d.notes.map(([m, s, dd, h, f]) => ({ m, s, d: dd, h, f })) }));

const base = (v, o = {}) => ({ pitch: v, rhythm: v, left: v, right: v, coord: v, leaps: v, chords: v, tempo: v, ...o });
const PLAYERS = {
  beginner: { th: base(0.2), sd: 110, tired: 0.35, hes: 1500 },
  intermediate: { th: base(0.5), sd: 70, tired: 0.15, hes: 800 },
  advanced: { th: base(0.8), sd: 35, tired: 0.05, hes: 450 },
  weakLeft: { th: base(0.55, { left: 0.1 }), sd: 70, tired: 0.1, hes: 800 },
  weakLeaps: { th: base(0.55, { leaps: 0.05 }), sd: 70, tired: 0.1, hes: 800 },
};

// Difficultés du simulateur (formules différentes de skill.js)
function simPlay(P, song, mode, R) {
  const notes = song.notes.map((n, i) => ({ ...n, i })).sort((a, b) => a.s - b.s);
  const an = annotate(notes); const ai = new Map(an.map(a => [a.n, a]));
  const med = notes[notes.length >> 1].s, eff = song.bpm, out = [];
  for (const n of notes) {
    const a = ai.get(n);
    const g = (th, d) => sig(7 * (th - d));
    let p = g(P.th.pitch, a.pd * 0.9 + 0.03) * g(n.h === 'L' ? P.th.left : P.th.right, a.pd * 0.9 + 0.03);
    if (a.leap > 5) p *= g(P.th.leaps, 0.25 + 0.6 * clamp((a.leap - 5) / 19));
    if (a.size >= 2) p *= g(P.th.chords, 0.3 + 0.12 * (a.size - 2));
    if (a.coord) p *= g(P.th.coord, 0.45 + (a.indep ? 0.15 : 0));
    if (mode === 'rhythm') p *= g(P.th.rhythm, a.rd * 0.9) * g(P.th.tempo, 0.1 + 0.7 * clamp((eff - 40) / 140));
    if (n.s >= med) p *= 1 - P.tired;
    const hit = R() < p;
    let dt = null;
    if (hit) { const z = Math.sqrt(-2 * Math.log(R() + 1e-9)) * Math.cos(2 * Math.PI * R()); dt = mode === 'rhythm' ? Math.round(-5 + P.sd * z) : Math.round(Math.max(150, P.hes * (1 + 0.4 * z))); }
    const wrong = hit ? (R() < 0.15 * (1 - p) ? 1 : 0) : (R() < 0.3 ? 1 : 0);
    out.push({ i: n.i, m: n.m, s: n.s, d: n.d, h: n.h, f: n.f, req: true, hit, wrong: wrong || undefined, dt });
  }
  return { songId: song.id, ts: 0, mode, hands: 'both', speed: 1, bpm: song.bpm, secs: 60, notes: out, wrongs: out.filter(n => n.wrong).map(n => ({ m: n.m, s: n.s })) };
}

function train(P, seed, N) {
  const R = rng(seed); let pr = emptyProfile(); const confs = [];
  for (let k = 0; k < N; k++) {
    const mode = R() < 0.35 ? 'wait' : 'rhythm';
    pr = update(pr, simPlay(P, songs[Math.floor(R() * songs.length)], mode, R));
    confs.push(analyze(pr).overall.confidence);
  }
  return { pr, confs };
}

const TRUE_DIMS = [['pitch', 'pitch'], ['rhythm', 'rhythm'], ['leftHand', 'left'], ['rightHand', 'right'], ['coordination', 'coord'], ['leaps', 'leaps'], ['chords', 'chords'], ['tempo', 'tempo']];
const SEEDS = 12, N = 40, report = {};

// 0. Contrat de base
{
  const e = emptyProfile(), a = analyze(e);
  assert.equal(Object.keys(a.dims).length, 11);
  assert.equal(a.overall.confidence, 0);
  const R = rng(1), at = simPlay(PLAYERS.intermediate, songs[1], 'rhythm', R);
  const frozen = JSON.stringify(e); const p2 = update(e, at);
  assert.equal(JSON.stringify(e), frozen, 'update doit être immuable');
  assert.notEqual(p2, e); assert.equal(update(p2, { ...at, mode: 'demo' }), p2);
}

// 1. Convergence : erreur moyenne par dimension (échelle 0..1) + ordre débutant < intermédiaire < avancé
{
  const err = {}, ov = {};
  for (const name of ['beginner', 'intermediate', 'advanced']) {
    let e = 0, o = 0;
    for (let s = 0; s < SEEDS; s++) {
      const a = analyze(train(PLAYERS[name], 100 + s, N).pr);
      e += TRUE_DIMS.reduce((x, [d, t]) => x + Math.abs(a.dims[d].score / 100 - PLAYERS[name].th[t]), 0) / TRUE_DIMS.length; o += a.overall.score;
    }
    err[name] = +(e / SEEDS).toFixed(3); ov[name] = +(o / SEEDS).toFixed(1);
  }
  report.errMAE = err; report.overall = ov;
  for (const k in err) assert.ok(err[k] < 0.2, `erreur ${k} = ${err[k]}`);
  assert.ok(ov.beginner < ov.intermediate && ov.intermediate < ov.advanced, 'ordre des niveaux');
  assert.equal(analyze(train(PLAYERS.advanced, 5, N).pr).overall.label, analyze(train(PLAYERS.advanced, 5, N).pr).overall.label);
}

// 2. Faiblesses identifiées (rappel / précision) + timing, endurance, réactivité monotones
{
  const plant = { weakLeft: 'leftHand', weakLeaps: 'leaps' }, S = 20;
  let tp = 0, flagged = 0, total = 0, lenient = 0;
  const okSet = { weakLeft: new Set(['leftHand', 'coordination', 'chords', 'pitch']), weakLeaps: new Set(['leaps']) };
  for (const name in plant) for (let s = 0; s < S; s++) {
    const a = analyze(train(PLAYERS[name], 300 + s, 50).pr); total++;
    if (a.weaknesses.some(w => w.dim === plant[name])) tp++;
    flagged += a.weaknesses.length; lenient += a.weaknesses.filter(w => okSet[name].has(w.dim)).length;
    a.weaknesses.forEach(w => assert.ok(w.label && w.advice));
  }
  const recall = tp / total, precision = tp / flagged, precL = lenient / flagged;
  report.weakness = { recall: +recall.toFixed(2), precisionStrict: +precision.toFixed(2), precisionLenient: +precL.toFixed(2) };
  assert.ok(recall >= 0.8, 'rappel ' + recall);
  assert.ok(precL >= 0.6, 'précision lenient ' + precL);
  // aucune "force" fantôme : la faiblesse plantée n'est jamais listée comme force
  const a = analyze(train(PLAYERS.weakLeft, 999, 50).pr); assert.ok(!a.strengths.some(x => x.dim === 'leftHand'));
  // timing / réactivité / endurance
  const m = n => { let t = 0, h = 0, e = 0; for (let s = 0; s < 8; s++) { const x = analyze(train(PLAYERS[n], 700 + s, N).pr).dims; t += x.timing.score; h += x.hesitation.score; e += x.endurance.score; } return { t: t / 8, h: h / 8, e: e / 8 }; };
  const b = m('beginner'), i = m('intermediate'), ad = m('advanced');
  report.timing = [b.t, i.t, ad.t].map(Math.round); report.hesitation = [b.h, i.h, ad.h].map(Math.round); report.endurance = [b.e, i.e, ad.e].map(Math.round);
  assert.ok(b.t < i.t && i.t < ad.t, 'timing monotone'); assert.ok(b.h < i.h && i.h < ad.h, 'hésitation monotone'); assert.ok(b.e < ad.e, 'endurance');
}

// 3. Confiance croissante avec le nombre d'observations
{
  const { confs } = train(PLAYERS.intermediate, 42, 30);
  report.confidence = [confs[0], confs[4], confs[29]].map(c => +c.toFixed(2));
  assert.ok(confs[0] < confs[4] && confs[4] < confs[29], 'confiance croissante');
  assert.ok(confs[29] > 0.5);
}

// 4. predict : monotone avec la difficulté, et cohérent avec la simulation
{
  const pr = train(PLAYERS.intermediate, 77, 40).pr;
  const f0 = { density: 1, range: 12, leaps: 0.1, chords: 0.1, handIndependence: 0.1, rhythmComplexity: 0.2, tempo: 90, hands: 'both' };
  const p0 = predict(pr, f0, 1);
  for (const [k, v] of [['density', 3], ['range', 36], ['leaps', 0.6], ['chords', 0.6], ['handIndependence', 0.8], ['rhythmComplexity', 0.9], ['tempo', 160]])
    assert.ok(predict(pr, { ...f0, [k]: v }, 1).pSuccess < p0.pSuccess, 'monotone ' + k);
  assert.ok(predict(pr, f0, 1.5).pSuccess < p0.pSuccess, 'monotone speed');
  assert.ok(predict(pr, f0, 1.5).expectedAttempts > p0.expectedAttempts);
  assert.ok(predict(pr, { ...f0, hands: 'R' }, 1).pSuccess >= p0.pSuccess);
  assert.ok(predict(emptyProfile(), f0, 1).pSuccess > 0 && p0.pSuccess <= 1);
  // pSuccess prédit vs réussite réelle (>=80 % de notes justes) sur les démos, joueur entraîné
  const R = rng(5), rows = songs.map(s => {
    let ok = 0; for (let k = 0; k < 30; k++) { const at = simPlay(PLAYERS.intermediate, s, 'rhythm', R); ok += Math.min(1, at.notes.filter(n => n.hit).length / at.notes.length / 0.8); }
    return { p: predict(pr, featuresOf(s.notes, s.bpm), 1).pSuccess, r: ok / 30 };
  });
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length, mp = mean(rows.map(r => r.p)), mr = mean(rows.map(r => r.r));
  const corr = rows.reduce((x, r) => x + (r.p - mp) * (r.r - mr), 0) / Math.sqrt(rows.reduce((x, r) => x + (r.p - mp) ** 2, 0) * rows.reduce((x, r) => x + (r.r - mr) ** 2, 0));
  report.predictCorr = +corr.toFixed(2);
  assert.ok(corr > 0.4, 'corrélation predict/réel ' + corr);
}

// 5. diagnoseAttempt : retrouve les problèmes plantés
{
  const R = rng(9); let hitLeaps = 0, hitLeft = 0, K = 0;
  for (let k = 0; k < 20; k++) for (const [pl, kinds] of [['weakLeaps', ['leaps', 'bigLeaps']], ['weakLeft', ['leftHand', 'chords']]]) {
    const song = songs[[1, 3, 4, 8, 15].map(x => x % songs.length)[k % 5]];
    const d = diagnoseAttempt(simPlay(PLAYERS[pl], song, 'rhythm', R));
    assert.ok(d.length <= 3); d.forEach(x => assert.ok(x.message && Array.isArray(x.measures)));
    if (pl === 'weakLeaps') { K++; if (d.some(x => kinds.includes(x.kind))) hitLeaps++; } else if (d.some(x => kinds.includes(x.kind))) hitLeft++;
  }
  report.diagnose = { leaps: hitLeaps + '/' + K, left: hitLeft + '/' + K };
  // cas déterministe : en avance sur les croches + saut d'octave raté
  const mk = (i, m, s, d, hit, dt) => ({ i, m, s, d, h: 'R', req: true, hit, dt });
  const notes = [];
  for (let i = 0; i < 12; i++) notes.push(mk(i, 60 + (i % 2) * 2, i * 0.5, 0.5, true, -90));
  notes.push(mk(12, 60, 6, 1, true, 0), mk(13, 76, 7, 1, false, null), mk(14, 60, 8, 1, true, 0), mk(15, 77, 9, 1, false, null));
  const dd = diagnoseAttempt({ mode: 'rhythm', notes });
  assert.ok(dd.some(x => x.kind === 'early' && /avance/.test(x.message)), JSON.stringify(dd));
  assert.ok(dd.some(x => x.kind === 'bigLeaps' && x.measures.length), JSON.stringify(dd));
  assert.deepEqual(diagnoseAttempt({ mode: 'wait', notes: notes.slice(0, 2) }), []);
}

// Faux accords : une note à chaque main au même temps n'est PAS un accord (coordination) ; 2 notes d'une même main l'est.
{
  const two = [0, 1, 2, 3].flatMap(i => [{ m: 60, s: i, d: 1, h: 'R' }, { m: 48, s: i, d: 1, h: 'L' }]);
  assert.equal(featuresOf(two).chords, 0); assert.ok(annotate(two).every(a => a.size === 1 && a.coord));
  const ch = [0, 1, 2, 3].flatMap(i => [{ m: 60, s: i, d: 1, h: 'R' }, { m: 64, s: i, d: 1, h: 'R' }]);
  assert.equal(featuresOf(ch).chords, 1);
  const nt = two.map(n => ({ ...n, req: true, hit: false }));
  assert.ok(!diagnoseAttempt({ mode: 'wait', notes: nt }).some(x => x.kind === 'chords'));
  const P = update(emptyProfile(), { mode: 'wait', notes: two.map(n => ({ ...n, req: true, hit: true })) });
  assert.equal(P.dims.chords.n, 0, 'mains simultanées : aucune observation « accords »'); assert.ok(P.dims.coordination.n > 0);
}

console.log(JSON.stringify(report, null, 1));
console.log('test-skill OK');
