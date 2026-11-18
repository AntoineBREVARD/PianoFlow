import assert from 'node:assert/strict';
import { analyzeSong, makePlan, adapt, nextTasks, masteryFrom, eta } from './songplan.js';
import { DEMOS } from './songs.js';

const NOW = '2026-11-17';
const rank = { unrealistic: 0, tight: 1, ok: 2 };
const D = n => DEMOS.find(d => d.title.startsWith(n));
const addDays = (s, k) => new Date(Date.parse(s + 'T12:00:00Z') + k * 864e5).toISOString().slice(0, 10);
const learnTypes = new Set(['learn', 'hands', 'together', 'tempo']);
const dow = s => new Date(s + 'T12:00:00Z').getUTCDay();

// ---- analyse ----
for (const d of DEMOS) {
  const a = analyzeSong(d);
  assert.ok(a.bars > 0 && a.sections.length > 0, d.title);
  let next = 1;
  for (const s of a.sections) {
    assert.equal(s.bars[0], next, 'sections contiguës : ' + d.title); next = s.bars[1] + 1;
    assert.ok(s.bars[1] - s.bars[0] + 1 <= 8, 'phrase <= 8 mesures');
    assert.ok(s.difficulty >= 0 && s.difficulty <= 1 && s.endBeat === s.bars[1] * 4 && s.startBeat === (s.bars[0] - 1) * 4);
    for (const k of ['density', 'range', 'leaps', 'chords', 'handIndependence', 'rhythmComplexity', 'tempo']) assert.ok(s.features[k] >= 0 && s.features[k] <= 1, k);
    assert.ok(['R', 'L', 'both'].includes(s.features.hands));
  }
  assert.equal(next - 1, a.bars);
  assert.ok(['facile', 'moyen', 'difficile', 'très difficile'].includes(a.overall.level) && a.overall.minutesEstimate > 0);
}
const tw = analyzeSong(D('Twinkle'));
assert.equal(tw.overall.level, 'facile');
assert.ok(tw.sections.some(s => s.dupOf), 'section identique repérée');
assert.ok(analyzeSong(D('Für Elise')).overall.difficulty > tw.overall.difficulty);
const e0 = analyzeSong({ title: 'vide', bpm: 100, notes: [] });
assert.deepEqual([e0.bars, e0.sections.length, e0.overall.minutesEstimate], [0, 0, 0]);
assert.equal(analyzeSong(undefined).bars, 0);
assert.equal(analyzeSong({ bpm: 90, notes: [{ m: 60, s: 0, d: 1, h: 'R' }, { m: 62, s: 1, d: 1, h: 'R' }] }).bars, 1, 'format objet accepté');

// ---- plan sur tous les morceaux de DEMOS ----
for (const d of DEMOS) {
  const p = makePlan({ song: d, deadline: '2026-12-31', now: NOW, minutesPerDay: 20 });
  assert.notEqual(p.feasibility.verdict, 'unrealistic', d.title + ' : ' + p.feasibility.message);
  let last = ''; const stageSeen = {}, learnLast = {};
  for (const s of p.sessions) {
    assert.ok(s.date >= NOW && s.date < '2026-12-31' && s.date > last); last = s.date;
    assert.ok(s.minutes <= 20 + 1e-9 && s.minutes > 0, 'budget respecté ' + s.date);
    for (const t of s.tasks) {
      assert.ok(t.reps >= 1 && t.goal.accuracy > 0 && t.goal.speed > 0 && t.why && ['R', 'L', 'both'].includes(t.hands));
      if (learnTypes.has(t.type)) {
        const v = { learn: 0, hands: 1, together: 2, tempo: 3 }[t.type] * 10 + t.speed;
        assert.ok(v + 1e-9 >= (stageSeen[t.sectionId] ?? -1), 'ordre des étapes ' + t.sectionId);
        stageSeen[t.sectionId] = v; learnLast[t.sectionId] = s.date;
      }
    }
  }
  const lastLearn = Object.values(learnLast).sort().at(-1);
  for (const s of p.sessions) for (const t of s.tasks) if (t.type === 'polish' || t.type === 'fullrun') assert.ok(s.date >= lastLearn, 'finition seulement après apprentissage');
  const lastS = p.sessions.at(-1);
  assert.ok(lastS.tasks.every(t => t.type === 'fullrun' || t.type === 'review'), 'jour de marge : pas de nouveau travail');
  assert.ok(lastS.date >= addDays('2026-12-31', -3), 'séance de marge juste avant l\'échéance');
  assert.equal(p.milestones.at(-1).date, '2026-12-31');
  for (const s of p.analysis.sections.filter(s => !s.dupOf)) assert.ok(p.sessions.some(x => x.tasks.some(t => t.sectionId === s.id && t.type === 'tempo' && t.speed === 1)), 'section jouée à 100 % : ' + s.id);
  assert.ok(p.sessions.some(x => x.tasks.some(t => t.type === 'review')), 'révisions espacées présentes');
}
// intervalles de révision espacés
{
  const p = makePlan({ song: D('Ode à la joie'), deadline: '2027-01-31', now: NOW, minutesPerDay: 20 });
  let done; const revs = [];
  for (const s of p.sessions) for (const t of s.tasks) {
    if (t.sectionId === 's1' && t.type === 'tempo' && t.speed === 1) done = s.date;
    if (t.sectionId === 's1' && t.type === 'review') revs.push(s.date);
  }
  const gaps = revs.map(r => (Date.parse(r) - Date.parse(done)) / 864e5);
  assert.ok(gaps.length >= 3 && gaps[0] >= 1 && gaps.some(g => g >= 7) && gaps.some(g => g >= 3 && g < 7), 'révisions espacées : ' + gaps);
}
{ // jours de pratique : lun/mer/ven seulement
  const p = makePlan({ song: D('Ode'), deadline: '2026-12-31', now: NOW, minutesPerDay: 20, days: [1, 3, 5] });
  for (const s of p.sessions) assert.ok([1, 3, 5].includes(dow(s.date)), s.date);
}

// ---- faisable / serré / irréaliste (Douce nuit, 18 mesures, 14 jours) ----
const big = D('Douce nuit'), dl14 = addDays(NOW, 14);
const feas = m => makePlan({ song: big, deadline: dl14, now: NOW, minutesPerDay: m }).feasibility;
assert.equal(feas(60).verdict, 'ok');
const u = feas(5);
assert.equal(u.verdict, 'unrealistic');
assert.match(u.message, /honn[êe]tes/); assert.ok(u.suggestion.length > 10 && u.suggestedMinutesPerDay > 5);
assert.ok(u.suggestedDeadline > dl14, 'date suggérée plus tardive');
let prev = -1; const seen = new Set(), req = new Set();
for (let m = 1; m <= 90; m++) { const f = feas(m); assert.ok(rank[f.verdict] >= prev, 'monotone mpd=' + m); prev = rank[f.verdict]; seen.add(f.verdict); req.add(f.requiredMinutes); }
assert.ok(seen.has('tight') && seen.has('unrealistic') && seen.has('ok'), 'trois verdicts atteignables : ' + [...seen]);
assert.equal(req.size, 1, 'minutes requises indépendantes du budget quotidien');
assert.notEqual(makePlan({ song: big, deadline: dl14, now: NOW, minutesPerDay: u.suggestedMinutesPerDay }).feasibility.verdict, 'unrealistic', 'suggestion de minutes valable');
assert.notEqual(makePlan({ song: big, deadline: u.suggestedDeadline, now: NOW, minutesPerDay: 5 }).feasibility.verdict, 'unrealistic', 'suggestion de date valable');
prev = -1;
for (let k = 3; k <= 120; k += 3) { const v = rank[makePlan({ song: big, deadline: addDays(NOW, k), now: NOW, minutesPerDay: 15 }).feasibility.verdict]; assert.ok(v >= prev, 'monotone échéance ' + k); prev = v; }
assert.equal(prev, 2);
// le profil injecté change le temps requis
const mk = (p, a) => ({ predict: () => ({ pSuccess: p, expectedAttempts: a }) });
const reqOf = skill => makePlan({ song: D('Ode'), deadline: '2027-01-31', now: NOW, minutesPerDay: 30, skill }).feasibility.requiredMinutes;
assert.ok(reqOf(mk(.2, 12)) > reqOf(undefined) && reqOf(undefined) > reqOf(mk(.95, 1.5)), 'profil faible => plus de temps');
assert.ok(reqOf({ predict: () => { throw new Error('x'); } }) > 0, 'skill défaillant => valeurs par défaut');

// ---- cas limites ----
let p = makePlan({ song: D('Ode'), deadline: '2026-11-10', now: NOW, minutesPerDay: 20 });
assert.equal(p.feasibility.verdict, 'unrealistic'); assert.match(p.feasibility.message, /passée/); assert.equal(p.sessions.length, 0); assert.ok(p.feasibility.suggestedDeadline > NOW);
p = makePlan({ song: D('Ode'), deadline: NOW, now: NOW, minutesPerDay: 20 });
assert.equal(p.feasibility.verdict, 'unrealistic'); assert.equal(p.sessions.length, 0);
for (const bad of [0, -5, NaN, undefined]) {
  p = makePlan({ song: D('Ode'), deadline: '2026-12-15', now: NOW, minutesPerDay: bad });
  assert.equal(p.feasibility.verdict, 'unrealistic'); assert.equal(p.sessions.length, 0); assert.match(p.feasibility.message, /minute/);
}
p = makePlan({ song: { title: 'vide', bpm: 90, notes: [] }, deadline: '2026-12-15', now: NOW, minutesPerDay: 20 });
assert.equal(p.sessions.length, 0); assert.match(p.feasibility.message, /aucune note/);
p = makePlan({ song: D('Ode'), deadline: 'pas une date', now: NOW, minutesPerDay: 20 }); assert.equal(p.sessions.length, 0);
p = makePlan({ song: D('Ode'), deadline: '2026-12-15', now: NOW, minutesPerDay: 20, days: [] }); assert.ok(p.sessions.length > 0, 'days vide => tous les jours');
p = makePlan({ song: D('Ode'), deadline: addDays(NOW, 2), now: NOW, minutesPerDay: 30 }); assert.equal(p.feasibility.verdict, 'unrealistic');
assert.deepEqual(JSON.parse(JSON.stringify(p)), p, 'plan sérialisable');
// adapt sur échéance dépassée / vide
{
  const pl = makePlan({ song: D('Ode'), deadline: '2026-12-15', now: NOW, minutesPerDay: 20 });
  const r = adapt({ plan: pl, progress: {}, now: '2026-12-20' });
  assert.equal(r.status, 'behind'); assert.equal(r.plan.sessions.length, 0); assert.match(r.reasons[0], /dépassée/); assert.ok(r.plan.feasibility.suggestedDeadline > '2026-12-20');
  assert.deepEqual(nextTasks(pl, '2026-12-20'), []);
}

// ---- maîtrise ----
const A = (acc, speed = 1) => ({ acc, speed, ts: 1 });
assert.equal(masteryFrom([]).mastery, 0);
assert.equal(masteryFrom([A(.95)]).mastered, false, 'une seule tentative ne suffit jamais');
assert.ok(masteryFrom([A(.99)]).mastery < .95);
assert.equal(masteryFrom([A(.9), A(.86)]).mastered, true);
assert.equal(masteryFrom([A(.9), A(.7), A(.9)]).mastered, false, 'consécutives');
assert.equal(masteryFrom([A(.95, .8), A(.95, .8)]).mastered, false, 'vitesse cible requise');
assert.equal(masteryFrom([A(95), A(90)]).mastered, true, 'pourcentages acceptés');
assert.equal(masteryFrom([A(.95, .8), A(.95, .8)], .8).mastered, true);
assert.equal(masteryFrom([A(.9), A(.9)]).mastery, 1);

// ---- simulation d'utilisateur ----
// Effort cumulé en minutes d'apprentissage ; maîtrise réelle = effort / besoin réel (besoin prévu / rate).
function simulate(song, deadline, rate, { days = 45, mpd = 20 } = {}) {
  let plan = makePlan({ song, deadline, now: NOW, minutesPerDay: mpd });
  const first = plan, need = {}, effort = {}, prog = {};
  for (const s of plan.analysis.sections.filter(s => !s.dupOf)) { need[s.id] = plan.track[s.id].reduce((x, y) => x + y.minutes, 0) / rate; effort[s.id] = 0; }
  const log = { statuses: [], first, plans: [plan], prog, checks: 0 };
  for (let k = 0; k < days; k++) {
    for (const t of nextTasks(plan, addDays(NOW, k))) if (learnTypes.has(t.type)) effort[t.sectionId] += t.minutes;
    for (const id of Object.keys(need)) prog[id] = { mastery: Math.min(1, effort[id] / need[id] * .95), attempts: 3, bestAcc: .9, lastSpeed: 1, lastTs: addDays(NOW, k) };
    if (k % 2 !== 1) continue;
    const r = adapt({ plan, progress: prog, now: addDays(NOW, k + 1) });
    log.statuses.push(r.status); log.plans.push(r.plan); log.last = r;
    // invariant : toute section non maîtrisée a encore du travail d'apprentissage ; jamais de finition avant la fin de l'apprentissage
    const todo = Object.keys(need).filter(id => prog[id].mastery < .95);
    const learnDates = {}; let lastLearn = '';
    for (const s of r.plan.sessions) for (const t of s.tasks) if (learnTypes.has(t.type)) { learnDates[t.sectionId] = true; if (s.date > lastLearn) lastLearn = s.date; }
    if (r.plan.sessions.length) for (const id of todo) assert.ok(learnDates[id], `jour ${k} : section ${id} non maîtrisée mais plus planifiée`);
    for (const s of r.plan.sessions) for (const t of s.tasks) if (t.type === 'polish' || t.type === 'fullrun') {
      if (s.date < lastLearn) assert.fail(`jour ${k} : ${t.type} planifié avant la fin de l'apprentissage`);
    }
    // l'étape finale à 100 % n'est jamais promise à une section qui n'a pas fait ses étapes lentes
    for (const id of todo) assert.ok(!r.plan.sessions.some(s => s.tasks.some(t => t.sectionId === id && t.type === 'tempo' && t.speed === 1 && prog[id].mastery < .3 && s.date === addDays(NOW, k + 1))), 'pas de saut direct à 100 %');
    plan = r.plan; log.checks++;
  }
  return log;
}
const lastLearnDate = pl => pl.sessions.filter(s => s.tasks.some(t => learnTypes.has(t.type))).at(-1)?.date;
const remaining = (pl, from) => pl.sessions.filter(s => s.date >= from).reduce((x, s) => x + s.minutes, 0);

// en retard : moitié moins vite que prévu
{
  const log = simulate(D('Ode'), '2026-12-31', 0.5);
  assert.ok(log.statuses.includes('behind'), 'retard détecté : ' + log.statuses);
  assert.ok(log.checks > 10);
  const firstBehind = log.statuses.indexOf('behind');
  assert.ok(lastLearnDate(log.plans[firstBehind + 1]) > lastLearnDate(log.first), 'le plan rallonge');
  assert.ok(log.plans[firstBehind + 1].slow > 1, 'durée des étapes allongée');
  // à terme, tout est maîtrisé et jamais sauté (les invariants sont vérifiés à chaque ajustement)
  assert.ok(Object.values(log.prog).every(p => p.mastery >= .95), 'toutes les sections finissent maîtrisées');
}
// en retard avec échéance courte : verdict honnête, suggestion de réduire / repousser
{
  const song = D('Douce nuit'), dl = addDays(NOW, 21);
  let plan = makePlan({ song, deadline: dl, now: NOW, minutesPerDay: 15 });
  assert.notEqual(plan.feasibility.verdict, 'unrealistic');
  const prog = {}; for (const s of plan.analysis.sections.filter(s => !s.dupOf)) prog[s.id] = { mastery: .05, attempts: 4, bestAcc: .5, lastSpeed: .5, lastTs: addDays(NOW, 9) };
  const r = adapt({ plan, progress: prog, now: addDays(NOW, 10) });
  assert.equal(r.status, 'behind');
  assert.ok(r.plan.slow > 1);
  assert.equal(r.plan.feasibility.verdict, 'unrealistic');
  assert.match(r.plan.feasibility.message, /honn[êe]tes/);
  assert.ok(r.plan.feasibility.suggestedDeadline > dl && /Options/.test(r.plan.feasibility.suggestion));
  assert.ok(r.changes.length && r.reasons.length);
  // rien de non maîtrisé n'est sauté même quand c'est irréaliste
  for (const sec of r.plan.analysis.sections.filter(s => !s.dupOf)) assert.ok(r.plan.sessions.some(s => s.tasks.some(t => t.sectionId === sec.id && learnTypes.has(t.type))) || r.plan.feasibility.verdict === 'unrealistic');
}
// un seul jour de retard n'est pas dramatique
{
  const plan = makePlan({ song: D('Ode'), deadline: '2026-12-31', now: NOW, minutesPerDay: 20 });
  const r = adapt({ plan, progress: {}, now: NOW });
  assert.equal(r.status, 'on_track');
}
// en avance : deux fois plus vite
{
  const log = simulate(D('Ode'), '2026-12-31', 2.2);
  assert.ok(log.statuses.includes('ahead'), 'avance détectée : ' + log.statuses);
  const i = log.statuses.indexOf('ahead');
  assert.ok(lastLearnDate(log.plans[i + 1]) <= lastLearnDate(log.first), 'le plan se raccourcit');
  assert.ok(log.plans[i + 1].slow < 1);
  const r = adapt({ plan: log.plans[i], progress: log.prog, now: addDays(NOW, 2 * i + 2) });
  assert.ok(r.changes.some(c => /accélérer|second morceau/.test(c)), 'propose d\'accélérer ou d\'ajouter un morceau');
}
// maîtrisé d'avance : révisions dues planifiées, plus d'apprentissage
{
  const plan = makePlan({ song: D('Ode'), deadline: '2026-12-31', now: NOW, minutesPerDay: 20 });
  const prog = {}; for (const s of plan.analysis.sections) prog[s.id] = { mastery: 1, attempts: 5, bestAcc: .95, lastSpeed: 1, lastTs: addDays(NOW, -3) };
  const r = adapt({ plan, progress: prog, now: NOW });
  assert.equal(r.status, 'ahead');
  assert.ok(r.plan.sessions.every(s => s.tasks.every(t => !learnTypes.has(t.type))), 'plus d\'apprentissage');
  assert.ok(r.plan.sessions.some(s => s.tasks.some(t => t.type === 'review')));
  assert.ok(r.plan.sessions.find(s => s.tasks.some(t => t.type === 'review')).date <= addDays(NOW, 4), 'révision due planifiée tôt');
}

// ---- nextTasks / eta ----
{
  const plan = makePlan({ song: D('Ode'), deadline: '2026-12-31', now: NOW, minutesPerDay: 20 });
  const today = nextTasks(plan, NOW);
  assert.ok(today.length > 0 && today.every(t => t.type && t.sectionId));
  assert.equal(nextTasks(plan, NOW, 3).length, 1, 'au moins une tâche, puis plafonné par le temps disponible');
  assert.equal(nextTasks(plan, NOW, 1000).length, today.length);
  assert.equal(nextTasks(plan, NOW, 0).length, 0);
  assert.deepEqual(nextTasks(plan, '2025-01-01'), []);
  assert.deepEqual(nextTasks(plan, new Date(2026, 10, 17, 9)).map(t => t.sectionId), today.map(t => t.sectionId), 'Date acceptée');
  const e = eta(plan, {}, NOW);
  assert.ok(e.date && e.onTime && e.total === 2 && e.mastered === 0 && e.pct === 0);
  const full = {}; for (const s of plan.analysis.sections) full[s.id] = { mastery: 1, lastTs: NOW };
  const e2 = eta(plan, full, NOW);
  assert.ok(e2.pct === 100 && e2.remainingMinutes < e.remainingMinutes);
  const slowPlan = { ...plan, slow: 6 };
  assert.ok(eta(slowPlan, {}, NOW).remainingMinutes > e.remainingMinutes);
}

// ---- défauts QA : même nombre de séances partout, budget du jour utilisé ou expliqué ----
{
  for (const d of DEMOS) for (const mpd of [10, 15, 30]) {
    const plan = makePlan({ song: d, now: NOW, deadline: addDays(NOW, 30), minutesPerDay: mpd, days: [0, 1, 2, 3, 4, 5, 6], targetSpeed: 1 });
    const m = /\((\d+) séances planifiées\)/.exec(plan.feasibility.message);
    if (m) assert.equal(+m[1], plan.sessions.length, `${d.title} ${mpd} : verdict et calendrier doivent compter pareil`);
    for (const ses of plan.sessions) {
      assert.ok(Number.isInteger(ses.minutes * 2) && ses.minutes <= mpd + 1e-9, 'minutes entières ou demi, dans le budget');
      if (ses.minutes < mpd - 1 && !ses.tasks.some(t => t.type === 'fullrun' && t.sectionId === 'all' && /Dernière/.test(t.why))) assert.match(ses.note || '', /Séance courte/, `${d.title} ${mpd} ${ses.date} : écart de budget non expliqué`);
    }
  }
}

console.log('test-songplan : OK');
