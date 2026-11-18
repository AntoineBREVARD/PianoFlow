// Programme personnalisé pour apprendre un morceau avant une échéance : logique (pure, testable) + interface.
// Dépend de skill.js (niveau réel du joueur) et songplan.js (analyse, calendrier, adaptation).
// Stockage : 'sp.goals' (objectifs), 'sp.goalProgress' (tentatives par objectif et phrase), 'sp.skill' (profil de niveau).
// LIMITES : heuristiques non validées sur de vrais élèves (voir skill.js et songplan.js).
import * as SK from './skill.js';
import { makePlan, adapt, nextTasks, eta, masteryFrom } from './songplan.js';
import { esc } from './stats.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const r2 = x => Math.round(x * 100) / 100;
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const fin = x => typeof x === 'number' && Number.isFinite(x);
const DAY = 864e5, MASTER = 0.95, MAX_GOALS = 20, MAX_ATT = 20, HIST = 12;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const todayStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addDays = (s, k) => new Date(Date.parse(s + 'T12:00:00Z') + k * DAY).toISOString().slice(0, 10);
export const fr = s => String(s).slice(0, 10).split('-').reverse().join('/');
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / DAY);
export const songIdOf = s => String(s?.id || s?.title || '');
const DOW = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const HANDS = { R: 'main droite', L: 'main gauche', both: 'deux mains' };

// ---------- ton : songplan.js parle en « vous », l'appli en « tu » ----------
const TU = [[/Vous gardez/g, 'Tu gardes'], [/vous faire/g, 'te faire'], [/Dites-moi ce que vous préférez/g, 'Dis-moi ce que tu préfères'], [/Vous avancez/g, 'Tu avances'],
  [/Vous pouvez/g, 'Tu peux'], [/Vous êtes/g, 'Tu es'], [/Choisissez/g, 'Choisis'], [/indiquez/gi, 'indique'], [/Importez/g, 'Importe'], [/Options :/g, 'Options :']];
export const tu = s => TU.reduce((x, [a, b]) => x.replace(a, b), String(s ?? ''));

// ---------- profil de niveau : un profil corrompu repart de emptyProfile() ----------
export function fixSkill(p) {
  try {
    if (!isObj(p) || p.v !== 1 || !isObj(p.dims) || !isObj(p.hist)) return SK.emptyProfile();
    const out = SK.emptyProfile();
    for (const d of SK.DIMS) {
      const s = p.dims[d];
      if (!isObj(s) || !fin(s.mu) || !fin(s.v) || !(s.v > 0) || !fin(s.n)) return SK.emptyProfile();
      out.dims[d] = { mu: clamp(s.mu, -0.5, 1.5), v: Math.min(1, s.v), n: Math.min(1e6, Math.max(0, Math.floor(s.n))) };
      out.hist[d] = Array.isArray(p.hist[d]) ? p.hist[d].filter(fin).slice(-HIST) : [];
    }
    out.attempts = fin(p.attempts) ? Math.min(1e7, Math.max(0, Math.floor(p.attempts))) : 0;
    out.last = fin(p.last) ? p.last : null;
    return out;
  } catch { return SK.emptyProfile(); }
}
export const loadSkill = store => fixSkill(store.get('sp.skill', null));
export function recordSkill(profile, attempt, mod = SK) {
  const p = fixSkill(profile);
  try { return fixSkill(mod.update(p, attempt)); } catch { return p; }
}
// songplan.js décrit une section en valeurs 0..1 ; skill.predict attend notes/temps, demi-tons, bpm : on convertit ici.
export const skillFor = (profile, bpm = 100, mod = SK) => ({
  predict: (f, speed) => mod.predict(profile, { density: (f.density || 0) * 4, range: (f.range || 0) * 36, leaps: f.leaps || 0, chords: (f.chords || 0) / 1.5,
    handIndependence: f.handIndependence || 0, rhythmComplexity: f.rhythmComplexity || 0, tempo: bpm, hands: f.hands }, speed),
});

// ---------- validation du stockage ----------
const okSection = s => isObj(s) && typeof s.id === 'string' && Array.isArray(s.bars) && s.bars.length === 2 && s.bars.every(fin) && fin(s.startBeat) && fin(s.endBeat) && isObj(s.features);
const okPlan = p => isObj(p) && isObj(p.analysis) && Array.isArray(p.analysis.sections) && p.analysis.sections.length > 0 && p.analysis.sections.every(okSection)
  && Array.isArray(p.sessions) && p.sessions.every(s => isObj(s) && ISO.test(s.date) && Array.isArray(s.tasks) && s.tasks.every(t => isObj(t) && typeof t.sectionId === 'string' && fin(t.minutes) && fin(t.speed)))
  && isObj(p.track) && isObj(p.baseline) && Array.isArray(p.milestones) && isObj(p.feasibility) && fin(p.targetSpeed) && Array.isArray(p.days) && fin(p.minutesPerDay) && fin(p.bpm);
export function fixGoals(v) {
  if (!Array.isArray(v)) return [];
  return v.filter(g => isObj(g) && typeof g.id === 'string' && typeof g.songId === 'string' && typeof g.title === 'string' && ISO.test(g.deadline) && ISO.test(g.createdAt)
    && ['active', 'done', 'archived'].includes(g.status) && okPlan(g.plan)).slice(0, MAX_GOALS)
    .map(g => ({ ...g, title: g.title.slice(0, 200), minutesPerDay: fin(g.minutesPerDay) ? g.minutesPerDay : g.plan.minutesPerDay, days: g.plan.days,
      pace: ['on_track', 'behind', 'ahead'].includes(g.pace) ? g.pace : 'on_track', reasons: Array.isArray(g.reasons) ? g.reasons.filter(x => typeof x === 'string').slice(0, 6) : [] }));
}
export function fixGoalProgress(v) {
  const out = {};
  if (!isObj(v)) return out;
  for (const gid of Object.keys(v).slice(0, 50)) {
    if (!isObj(v[gid])) continue;
    out[gid] = {};
    for (const sid of Object.keys(v[gid]).slice(0, 100)) {
      if (!Array.isArray(v[gid][sid])) continue;
      out[gid][sid] = v[gid][sid].filter(t => isObj(t) && fin(t.acc) && fin(t.speed)).slice(-MAX_ATT)
        .map(t => ({ acc: clamp(t.acc), speed: clamp(t.speed, 0, 3), hands: ['R', 'L', 'both'].includes(t.hands) ? t.hands : 'both', ts: fin(t.ts) ? t.ts : 0 }));
    }
  }
  return out;
}
const okTask = t => isObj(t) && typeof t.type === 'string' && typeof t.sectionId === 'string' && ['R', 'L', 'both'].includes(t.hands) && fin(t.speed) && t.speed > 0 && fin(t.minutes) && t.minutes > 0
  && Number.isInteger(t.reps) && t.reps >= 1 && t.reps <= 99 && isObj(t.goal) && fin(t.goal.accuracy);
// liste figée du jour : une entrée corrompue est simplement ignorée (elle sera regénérée)
export function fixGoalToday(v) {
  const out = {};
  if (!isObj(v)) return out;
  for (const gid of Object.keys(v).slice(0, 50)) {
    const e = v[gid];
    if (isObj(e) && ISO.test(e.date) && Array.isArray(e.tasks) && e.tasks.length > 0 && e.tasks.length <= 40 && e.tasks.every(okTask)) out[gid] = { date: e.date, tasks: e.tasks.map(t => ({ ...t, why: String(t.why ?? '').slice(0, 300) })) };
  }
  return out;
}
export const load = store => ({ goals: fixGoals(store.get('sp.goals', [])), gp: fixGoalProgress(store.get('sp.goalProgress', {})), gt: fixGoalToday(store.get('sp.goalToday', {})) });
export function save(store, st) {
  const live = new Set(st.goals.map(g => g.id));
  for (const k of Object.keys(st.gp)) if (!live.has(k)) delete st.gp[k];
  st.gt ||= {}; for (const k of Object.keys(st.gt)) if (!live.has(k)) delete st.gt[k];
  store.set('sp.goals', st.goals); store.set('sp.goalProgress', st.gp); store.set('sp.goalToday', st.gt);
}

// ---------- création ----------
// limitBars : ne garder que les N premières mesures (suggestion « réduire le morceau »)
export const subSong = (song, limitBars) => !limitBars ? song : { ...song, notes: song.notes.filter(n => n[1] < limitBars * 4 - 1e-6) };
export function createGoal({ song, deadline, minutesPerDay, days, now = todayStr(), profile, mod = SK, id, limitBars, plan }) {
  const bpm = song.bpm > 0 ? song.bpm : 100;
  plan = plan || makePlan({ song: subSong(song, limitBars), now, deadline, minutesPerDay, days, targetSpeed: 1, skill: skillFor(profile || SK.emptyProfile(), bpm, mod), progress: {} });
  return { id: id || 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), songId: songIdOf(song), title: String(song.title || 'Morceau'), createdAt: now, deadline, minutesPerDay,
    days: plan.days, plan, status: 'active', pace: 'on_track', lastAdapt: now, reasons: [], ...(limitBars ? { limitBars } : {}) };
}
// un seul objectif actif par morceau : le nouveau remplace l'ancien
export function addGoal(st, goal) {
  for (const g of st.goals) if (g.songId === goal.songId && g.status === 'active') g.status = 'archived';
  st.goals = [goal, ...st.goals].slice(0, MAX_GOALS);
  return goal;
}

// ---------- maîtrise d'une phrase ----------
// Échelle d'étapes identique à celle de songplan.js (stageList) : main(s) lentement, deux mains, puis tempo 60/80/100 %.
const ladder = (sec, ts) => {
  const h = sec.features?.hands || 'both', st = [];
  if (h === 'both') st.push({ h: 'R', s: 0.5, a: 0.8 }, { h: 'L', s: 0.5, a: 0.8 }, { h: 'both', s: 0.5, a: 0.8 }); else st.push({ h, s: 0.5, a: 0.8 });
  [0.6, 0.8, 1].forEach((x, i) => st.push({ h, s: r2(x * ts), a: i === 2 ? 0.85 : 0.8 }));
  return st;
};
// ponytail : masteryFrom seul (vitesse/cible) ne ferait jamais passer l'étape « deux mains à 50 % » ni ne distinguerait les mains ;
// on valide donc chaque étape par 2 tentatives consécutives qualifiées, et la dernière étape via masteryFrom.
export function masteryOf(sec, atts, ts = 1) {
  const L = ladder(sec, ts), A = Array.isArray(atts) ? atts : [], n = L.length;
  const compat = st => A.filter(t => t.hands === 'both' || t.hands === st.h);
  const ok = (st, t) => t.acc >= st.a && t.speed >= st.s - 0.01;
  let idx = 0;
  for (; idx < n; idx++) {
    const st = L[idx], c = compat(st);
    if (idx === n - 1) { if (masteryFrom(c.filter(t => t.speed >= st.s - 0.01), ts).mastered) idx++; break; }
    let cleared = false; for (let j = 0; j + 1 < c.length && !cleared; j++) cleared = ok(st, c[j]) && ok(st, c[j + 1]);
    if (!cleared) break;
  }
  const cur = L[idx], last = cur ? compat(cur).at(-1) : null;
  const frac = cur && last && ok(cur, last) ? 0.5 : 0;
  return { mastery: idx >= n ? 1 : Math.min(0.94, (idx + frac + 1e-6) / n * MASTER), mastered: idx >= n, stage: idx, stages: n, attempts: A.length, lastTs: A.at(-1)?.ts ?? null };
}
export function progressOf(goal, gp) {
  const out = {};
  for (const s of goal.plan.analysis.sections.filter(s => !s.dupOf)) out[s.id] = masteryOf(s, gp?.[goal.id]?.[s.id], goal.plan.targetSpeed);
  return out;
}
export function overallPct(goal, prog) {
  const us = goal.plan.analysis.sections.filter(s => !s.dupOf), w = s => s.bars[1] - s.bars[0] + 1;
  const tot = us.reduce((x, s) => x + w(s), 0) || 1;
  return Math.round(100 * us.reduce((x, s) => x + w(s) * Math.min(1, (prog[s.id]?.mastery ?? 0) / MASTER), 0) / tot);
}

// ---------- tentative → phrases concernées ----------
// Une tentative compte pour une phrase si elle couvre au moins la moitié de ses mesures ; les répétitions (dupOf) créditent la phrase d'origine.
export function sectionHits(plan, attempt) {
  const notes = (Array.isArray(attempt?.notes) ? attempt.notes : []).filter(n => isObj(n) && n.req && fin(n.s));
  const acc = new Map();
  for (const s of plan.analysis.sections) {
    const ns = notes.filter(n => n.s >= s.startBeat - 1e-6 && n.s < s.endBeat - 1e-6);
    if (!ns.length) continue;
    const total = s.bars[1] - s.bars[0] + 1, bars = new Set(ns.map(n => Math.floor(n.s / 4)));
    if (bars.size < Math.ceil(total / 2)) continue;
    const good = Math.max(0, ns.filter(n => n.hit).length - 0.5 * ns.reduce((x, n) => x + (n.wrong > 0 ? n.wrong : 0), 0));
    const k = s.dupOf || s.id, c = acc.get(k) || { good: 0, n: 0 };
    c.good += good; c.n += ns.length; acc.set(k, c);
  }
  return [...acc].map(([sid, c]) => ({ sid, acc: clamp(c.good / c.n) }));
}

// ---------- après une tentative ----------
const handsOf = a => (['R', 'L'].includes(a.hands) ? a.hands : 'both');
const pushAtt = (gp, gid, sid, t) => { const l = ((gp[gid] ||= {})[sid] ||= []); l.push(t); if (l.length > MAX_ATT) l.splice(0, l.length - MAX_ATT); };
function paceReasons(goal, res, prog) {
  const us = goal.plan.analysis.sections.filter(s => !s.dupOf), lines = [];
  if (res.status === 'behind') {
    const w = us.filter(s => (prog[s.id]?.mastery ?? 0) < MASTER && prog[s.id]?.attempts).sort((a, b) => prog[a.id].mastery - prog[b.id].mastery)[0];
    lines.push(w ? `Tu avances moins vite que prévu : demain on reviendra sur la phrase ${w.id.slice(1)} : on la rallonge plutôt que de passer à la suite. Chaque main a son rythme, ce n'est pas grave.` : 'Tu avances moins vite que prévu : demain on reviendra sur ce qui n\'est pas encore solide plutôt que de passer à la suite.');
  } else if (res.status === 'ahead') lines.push('Tu avances plus vite que prévu : bravo ! Tu pourras finir avant la date limite.');
  else lines.push('Tu es dans les temps : continue comme ça.');
  return [...lines, ...res.reasons.slice(1).map(tu), ...(res.status === 'ahead' ? res.changes.slice(0, 1).map(tu) : [])];
}
// Rejoue le calendrier depuis aujourd'hui avec la progression réelle ; met à jour pace/reasons/status. Retourne le résultat.
export function reschedule(goal, st, { now, profile, mod = SK }) {
  const prog = progressOf(goal, st.gp);
  const res = adapt({ plan: goal.plan, progress: prog, now, skill: skillFor(profile, goal.plan.bpm, mod) });
  goal.plan = res.plan; goal.pace = res.status; goal.lastAdapt = now; goal.reasons = paceReasons(goal, res, prog).slice(0, 6);
  const done = goal.plan.analysis.sections.filter(s => !s.dupOf).every(s => prog[s.id].mastered);
  if (done) goal.status = 'done';
  return { goalId: goal.id, status: res.status, reasons: goal.reasons, done, pct: overallPct(goal, prog) };
}
export function applyAttempt(st, attempt, { now = todayStr(), profile, mod = SK } = {}) {
  const out = [];
  if (!isObj(attempt) || attempt.mode === 'demo') return out;
  profile = profile || SK.emptyProfile();
  for (const g of st.goals) {
    if (g.status !== 'active' || g.songId !== String(attempt.songId)) continue;
    const hits = sectionHits(g.plan, attempt); if (!hits.length) continue;
    ensureToday(st, g, now); // la liste du jour est figée avant que le calendrier ne bouge
    const t = { speed: clamp(+attempt.speed || 0, 0, 3), hands: handsOf(attempt), ts: fin(attempt.ts) ? attempt.ts : Date.now() };
    for (const h of hits) pushAtt(st.gp, g.id, h.sid, { acc: r2(h.acc), ...t });
    out.push(reschedule(g, st, { now, profile, mod }));
  }
  return out;
}
// au changement de jour : on replanifie même sans tentative (retard = les séances manquées reviennent, rien n'est sauté)
export function dailyAdapt(st, { now = todayStr(), profile, mod = SK } = {}) {
  let changed = false;
  for (const g of st.goals) if (g.status === 'active' && g.lastAdapt !== now) { reschedule(g, st, { now, profile, mod }); changed = true; }
  return changed;
}

// ---------- tâches du jour ----------
export function taskInfo(goal, t) {
  const secs = goal.plan.analysis.sections, by = id => secs.find(s => s.id === id), id = String(t.sectionId);
  let zones = null, name = null;
  if (id === 'all') name = 'Morceau entier';
  else if (id.includes('+')) { const [a, b] = id.split('+').map(by); if (a && b) { zones = [[a.startBeat, b.endBeat]]; name = a.phrase && a.phrase === b.phrase ? `Phrase ${a.phrase} entière` : `Phrases ${a.id.slice(1)}-${b.id.slice(1)}`; } }
  else { const s = by(id); if (s) { zones = [[s.startBeat, s.endBeat]]; name = s.part ? `Phrase ${s.phrase} (${s.part === 1 ? 'début' : 'fin'})` : 'Phrase ' + s.id.slice(1); } }
  if (!name) return null;
  const hands = t.hands === 'R' || t.hands === 'L' ? t.hands : 'both';
  return { label: `${t.type === 'review' ? 'Révision · ' : ''}${name} · ${HANDS[hands]} · ${Math.round(t.speed * 100)} % · ${t.reps} fois`, mode: t.type === 'learn' || t.type === 'hands' ? 'wait' : 'rhythm',
    hands, speed: t.speed, zones, minutes: t.minutes, reps: t.reps, why: String(t.why || '') };
}
// état d'une tâche du jour d'après les tentatives de 'sp.goalProgress' : 'done' (tentative du jour qualifiante), 'doing' (tentative du jour insuffisante), 'todo'
// bloc = une étape d'une phrase × reps répétitions. n = tentatives du jour qualifiantes (précision, vitesse, main) ;
// ✓ quand le compteur est plein, ou quand l'étape est validée (maîtrise) ET que la moitié au moins des répétitions est faite. Retourne { state: 'done'|'doing'|'todo', n, reps }.
export function taskProgress(goal, gp, t, now) {
  const us = goal.plan.analysis.sections.filter(s => !s.dupOf), id = String(t.sectionId);
  const ids = id === 'all' ? us.map(s => s.id) : id.split('+'), mine = gp?.[goal.id] || {}, reps = Math.max(1, Math.floor(+t.reps) || 1);
  const th = t.hands === 'R' || t.hands === 'L' ? t.hands : 'both', acc = t.goal?.accuracy ?? 0.8;
  const today = a => fin(a.ts) && todayStr(new Date(a.ts)) === now && (a.hands === 'both' || a.hands === th) && a.speed >= t.speed - 0.01;
  let any = false, n = Infinity;
  for (const sid of ids) {
    const l = (mine[sid] || []).filter(today); if (l.length) any = true;
    n = Math.min(n, l.filter(a => a.acc >= acc - 1e-9).length);
  }
  if (!ids.length || n === Infinity) n = 0;
  const sec = ids.length === 1 && !['review', 'polish', 'fullrun'].includes(t.type) ? us.find(s => s.id === ids[0]) : null;
  if (sec) {
    const L = ladder(sec, goal.plan.targetSpeed), k = L.findIndex(x => x.h === th && Math.abs(x.s - t.speed) < 0.011);
    if (k >= 0 && masteryOf(sec, mine[sec.id], goal.plan.targetSpeed).stage > k && n >= Math.ceil(reps / 2)) return { state: 'done', n: Math.min(n, reps), reps };
  }
  return { state: n >= reps ? 'done' : any ? 'doing' : 'todo', n: Math.min(n, reps), reps };
}
export const taskState = (goal, gp, t, now) => taskProgress(goal, gp, t, now).state;
export const todayTasks = (goal, now) => nextTasks(goal.plan, now, goal.minutesPerDay + 0.5).map(t => ({ t, info: taskInfo(goal, t) })).filter(x => x.info);
// liste figée du jour (st.gt[goal.id] = { date, tasks }) : générée une fois par jour, jamais réorganisée ensuite.
// Retourne true si l'entrée a été (re)créée (absente, d'un autre jour, corrompue ou force) : l'appelant sauvegarde.
export function ensureToday(st, goal, now, force = false) {
  const gt = (st.gt ||= {}), e = gt[goal.id];
  if (!force && e && e.date === now && Array.isArray(e.tasks) && e.tasks.every(t => taskInfo(goal, t))) return false;
  const tasks = todayTasks(goal, now).map(x => x.t);
  if (tasks.length) gt[goal.id] = { date: now, tasks }; else delete gt[goal.id];
  return true;
}
export const frozenTasks = (st, goal, now) => { const e = st.gt?.[goal.id]; return (e && e.date === now ? e.tasks : []).map(t => ({ t, info: taskInfo(goal, t) })).filter(x => x.info); };
export const nextSession = (goal, now) => goal.plan.sessions.find(s => s.date > now)?.date || null;

// ---------- interface ----------
const $ = (r, s) => r.querySelector(s);
const sectionBars = an => an.sections.map(s => `<div style="display:flex;align-items:center;gap:8px;margin:4px 0"><small style="width:44%;flex:none">${esc(s.label)}${s.dupOf ? ' <span class="mut">(reprise)</span>' : ''}</small><div class="progress" style="flex:1;margin:0"><div style="width:${Math.round(s.difficulty * 100)}%"></div></div><small style="width:34px;text-align:right">${Math.round(s.difficulty * 100)}%</small></div>`).join('');
const VERDICT = { ok: ['✅', 'Réaliste'], tight: ['⚠️', 'Serré'], unrealistic: ['🛑', 'Irréaliste'] };

export function openGoalModal({ song, store, modal, closeModal, onSaved, begin }) {
  const today = todayStr(), profile = loadSkill(store), bpm = song.bpm > 0 ? song.bpm : 100;
  const gp = (() => { try { const p = store.get('sp.plan', null); return isObj(p) && Array.isArray(p.days) && p.days.length ? p : null; } catch { return null; } })();
  const days0 = (gp?.days || [1, 3, 5]).filter(d => Number.isInteger(d) && d >= 0 && d <= 6), mpd0 = fin(+gp?.minutes) && gp.minutes > 0 ? Math.round(gp.minutes) : 10;
  let limit = 0, plan = null;
  const b = modal(`<h2>🎯 Mon objectif</h2><p class="hint" style="margin-top:0"><b>${esc(song.title)}</b> : dis-moi pour quand tu veux savoir le jouer, je prépare un programme adapté à ton niveau.</p>
    <div id="g_an"></div>
    <label>Date limite<input type="date" id="g_date" min="${addDays(today, 1)}" value="${addDays(today, 30)}"></label>
    <div class="chips"><button class="chip" type="button" data-d="14">2 semaines</button><button class="chip" type="button" data-d="30">1 mois</button><button class="chip" type="button" data-d="90">3 mois</button></div>
    <label>Minutes par jour<input type="number" id="g_min" min="1" max="180" step="1" value="${mpd0}"></label>
    <div class="dayrow">${[1, 2, 3, 4, 5, 6, 0].map(d => `<label class="day"><input type="checkbox" value="${d}" ${days0.includes(d) ? 'checked' : ''}><span>${DOW[d]}</span></label>`).join('')}</div>
    <div id="g_verdict" role="status"></div><div id="g_cal"></div>
    <div class="actions"><button class="ghost" id="g_no" type="button">Annuler</button><button class="primary" id="g_ok" type="button" disabled>Créer mon programme</button></div>`);
  const read = () => ({ deadline: $(b, '#g_date').value, mpd: Math.round(+$(b, '#g_min').value), days: [...b.querySelectorAll('.day input:checked')].map(i => +i.value) });
  const compute = () => {
    const r = read(), ok = ISO.test(r.deadline) && r.mpd > 0 && r.days.length > 0;
    $(b, '#g_ok').disabled = true;
    if (!ok) { $(b, '#g_verdict').innerHTML = '<p class="hint">Choisis une date, une durée par jour et au moins un jour.</p>'; $(b, '#g_cal').innerHTML = ''; return; }
    plan = makePlan({ song: subSong(song, limit), now: today, deadline: r.deadline, minutesPerDay: r.mpd, days: r.days, targetSpeed: 1, skill: skillFor(profile, bpm), progress: {} });
    const an = plan.analysis, f = plan.feasibility, v = VERDICT[f.verdict] || VERDICT.unrealistic, valid = plan.sessions.length > 0;
    $(b, '#g_an').innerHTML = `<div class="card" style="margin:0 0 12px"><b>Niveau du morceau : ${esc(an.overall.level)}</b> <small class="mut">· difficulté ${Math.round(an.overall.difficulty * 100)} % · ${an.bars} mesures · ≈ ${an.overall.minutesEstimate} min de travail</small>${limit ? `<br><small class="mut">Programme limité aux ${limit} premières mesures.</small>` : ''}<div style="margin-top:8px">${sectionBars(an)}</div></div>`;
    const sug = [];
    if (f.verdict !== 'ok') {
      if (f.suggestedMinutesPerDay) sug.push(`<button class="chip" type="button" data-m="${+f.suggestedMinutesPerDay}">${+f.suggestedMinutesPerDay} min par jour</button>`);
      if (ISO.test(f.suggestedDeadline || '')) sug.push(`<button class="chip" type="button" data-dl="${esc(f.suggestedDeadline)}">Échéance au ${fr(f.suggestedDeadline)}</button>`);
      if (f.verdict === 'unrealistic' && an.sections.length > 1 && !limit) sug.push('<button class="chip" type="button" id="g_cut">Réduire le morceau</button>');
    }
    $(b, '#g_verdict').innerHTML = `<div class="card" style="margin:0 0 12px"><b>${v[0]} ${v[1]}</b><p style="margin:6px 0">${esc(tu(f.message))}</p>${sug.length ? `<div class="chips">${sug.join('')}</div>` : ''}</div>`;
    const ses = plan.sessions.slice(0, 6).map(s => `<li><small><b>${DOW[new Date(s.date + 'T12:00:00Z').getUTCDay()]} ${fr(s.date).slice(0, 5)}</b> · ${s.minutes} min${s.note ? ' (courte)' : ''} · ${esc([...new Set(s.tasks.map(t => taskInfo({ plan }, t)?.label.replace(/ · \d+ %( · \d+ fois)?$/, '') || '').filter(Boolean))].slice(0, 2).join(' + '))}</small></li>`).join('');
    $(b, '#g_cal').innerHTML = valid ? `<div class="card" style="margin:0 0 12px"><b>Aperçu du calendrier</b> <small class="mut">· ${plan.sessions.length} séances</small><ul style="margin:6px 0;padding-left:18px">${ses}</ul><small class="mut">Jalons : ${esc(plan.milestones.map(m => fr(m.date).slice(0, 5)).slice(0, 4).join(' · '))} · jour J ${fr(plan.deadline)}</small></div>` : '';
    $(b, '#g_ok').disabled = !valid;
    b.querySelectorAll('[data-m]').forEach(x => x.onclick = () => { $(b, '#g_min').value = x.dataset.m; compute(); });
    b.querySelectorAll('[data-dl]').forEach(x => x.onclick = () => { $(b, '#g_date').value = x.dataset.dl; compute(); });
    const cut = $(b, '#g_cut');
    if (cut) cut.onclick = () => { // plus grand début du morceau dont le verdict n'est plus « irréaliste »
      const total = an.bars; let found = 0;
      for (let k = total - 1; k >= 1 && !found; k--) {
        const p2 = makePlan({ song: subSong(song, k), now: today, deadline: r.deadline, minutesPerDay: r.mpd, days: r.days, targetSpeed: 1, skill: skillFor(profile, bpm), progress: {} });
        if (p2.sessions.length && p2.feasibility.verdict !== 'unrealistic') found = k;
      }
      limit = found || 1; compute();
    };
  };
  let timer = 0; const later = () => { clearTimeout(timer); timer = setTimeout(compute, 150); };
  b.querySelectorAll('#g_date,#g_min,.day input').forEach(x => { x.oninput = later; x.onchange = later; });
  b.querySelectorAll('[data-d]').forEach(x => x.onclick = () => { $(b, '#g_date').value = addDays(today, +x.dataset.d); compute(); });
  $(b, '#g_no').onclick = closeModal;
  $(b, '#g_ok').onclick = () => {
    clearTimeout(timer); compute(); const r = read();
    if (!plan?.sessions.length) return;
    const st = load(store), g = addGoal(st, createGoal({ song, deadline: r.deadline, minutesPerDay: r.mpd, days: plan.days, now: today, profile, plan, limitBars: limit }));
    save(store, st); closeModal(); onSaved?.(g);
  };
  compute();
}

const PACE = { on_track: '✅ En bonne voie', behind: '🐢 Un peu en retard', ahead: '🚀 En avance' };
// carte(s) « Programme » de l'accueil. ctx : { store, begin, record, refresh, confirm }
export function mountToday(box, ctx, now = todayStr()) {
  box.innerHTML = '';
  let st; try { st = load(ctx.store); } catch { return; }
  const profile = loadSkill(ctx.store);
  try { if (dailyAdapt(st, { now, profile })) save(ctx.store, st); } catch (e) { console.warn(e); }
  try { let ch = false; for (const g of st.goals.filter(x => x.status === 'active')) ch = ensureToday(st, g, now) || ch; if (ch) save(ctx.store, st); } catch (e) { console.warn(e); }
  for (const g of st.goals.filter(x => x.status !== 'archived').slice(0, 3)) {
    const prog = progressOf(g, st.gp), pct = overallPct(g, prog), left = daysBetween(now, g.deadline);
    let e = null; try { e = eta(g.plan, Object.fromEntries(Object.entries(prog).map(([k, v]) => [k, { mastery: v.mastery, lastTs: v.lastTs }])), now, skillFor(profile, g.plan.bpm)); } catch { /* estimation facultative */ }
    const sec = document.createElement('section'); sec.className = 'card goal';
    const us = g.plan.analysis.sections.filter(s => !s.dupOf);
    const strip = us.map(s => { const m = prog[s.id]; return `<span title="Phrase ${esc(s.id.slice(1))}" style="display:inline-block;width:22px;text-align:center">${m.mastered ? '✓' : m.stage > 0 ? '◐' : '○'}</span>`; }).join('');
    const tasks = g.status === 'active' ? frozenTasks(st, g, now) : [];
    const nx = nextSession(g, now);
    sec.innerHTML = `<h2>🎯 Programme : <span class="gt"></span></h2>
      <small class="mut">Date limite : ${fr(g.deadline)} ${left > 0 ? `(dans ${left} j)` : left === 0 ? '(aujourd\'hui)' : '(dépassée)'} · ${esc(g.minutesPerDay)} min/jour</small>
      <div class="progress"><div style="width:${pct}%"></div></div>
      <small class="mut">${pct} % · ${e ? `${e.mastered}/${e.total} phrases maîtrisées${e.date ? ` · fin estimée le ${fr(e.date)}` : ''}` : ''}</small>
      <div style="margin:6px 0"><small>${strip}</small></div>
      ${g.status === 'done' ? '<p>🎉 Programme terminé : tu maîtrises ce morceau !</p>' : `<p style="margin:6px 0"><b>${PACE[g.pace] || PACE.on_track}</b></p>${g.reasons.map(r => `<small class="mut" style="display:block">${esc(r)}</small>`).join('')}`}
      ${g.status === 'active' ? (tasks.length ? '<h3 style="margin:10px 0 4px;font-size:15px">Aujourd\'hui</h3><div class="tp"></div><ul class="gl"></ul>' : `<p class="hint">Pas de séance prévue aujourd'hui${nx ? ` · prochaine le ${fr(nx)}` : ''}.</p>`) : ''}
      <div class="actions">${g.status === 'active' ? '<button class="ghost gr">Recalculer mon programme</button>' : ''}<button class="ghost gx"></button></div>`;
    sec.querySelector('.gt').textContent = g.title;
    const gx = sec.querySelector('.gx'); gx.textContent = g.status === 'done' ? 'OK, archiver' : 'Abandonner';
    gx.onclick = () => { if (g.status === 'done' || (ctx.confirm || confirm)('Abandonner ce programme ?')) { g.status = 'archived'; save(ctx.store, st); ctx.refresh?.(); } };
    const gr = sec.querySelector('.gr');
    if (gr) gr.onclick = () => { try { reschedule(g, st, { now, profile }); ensureToday(st, g, now, true); save(ctx.store, st); } catch (e) { console.warn(e); } ctx.refresh?.(); };
    const ul = sec.querySelector('.gl'), progs = tasks.map(x => taskProgress(g, st.gp, x.t, now)), states = progs.map(x => x.state), nDone = states.filter(x => x === 'done').length;
    if (ul) {
      const ses = g.plan.sessions.find(x => x.date === now);
      sec.querySelector('.tp').innerHTML = `<small>${nDone}/${tasks.length} blocs aujourd'hui</small><div class="progress"><div style="width:${Math.round(100 * nDone / tasks.length)}%"></div></div>${nDone === tasks.length ? '<small class="mut" style="display:block">Séance du jour terminée, bravo. À demain !</small>' : ses?.note ? `<small class="mut" style="display:block">${esc(ses.note)}</small>` : ''}`;
    }
    tasks.forEach(({ t, info }, i) => {
      const li = document.createElement('li');
      li.innerHTML = '<div class="info"><b></b><small></small></div>';
      li.querySelector('b').textContent = ({ done: '✓ ', doing: '◐ ', todo: '○ ' })[states[i]] + info.label + ` (${progs[i].n}/${progs[i].reps})`;
      li.querySelector('small').textContent = `~${info.minutes} min${info.why ? ' · ' + info.why : ''}`;
      const bt = document.createElement('button'); bt.className = states[i] === 'done' ? 'ghost' : 'primary'; bt.textContent = states[i] === 'done' ? 'Refaire' : 'Jouer';
      bt.onclick = () => runTask(g, info, ctx);
      li.append(bt); ul.append(li);
    });
    box.append(sec);
  }
}
function runTask(g, info, ctx) {
  const song = ctx.findSong?.(g.songId);
  if (!song) { alert('Ce morceau n\'est plus dans ta bibliothèque.'); return; }
  ctx.begin(song, { mode: info.mode, hands: info.hands, speed: info.speed, ...(info.zones ? { zones: info.zones } : {}), label: `${g.title} — ${info.label}`,
    onDone: s => {
      let res = null; try { res = s?.attempt ? ctx.record?.(s.attempt) : null; } catch (e) { console.warn(e); }
      const r = res?.find(x => x.goalId === g.id), now = todayStr();
      const hint = r ? (r.done ? '🎉 Morceau maîtrisé : programme terminé !\n' : '') + r.reasons.slice(0, 2).join('\n') + `\nProgression : ${r.pct} %` : '';
      try {
        const st = load(ctx.store), g2 = st.goals.find(x => x.id === g.id), nx = g2 && g2.status === 'active' ? frozenTasks(st, g2, now).find(x => taskState(g2, st.gp, x.t, now) !== 'done') : null;
        if (nx) return { label: 'Tâche suivante : ' + nx.info.label, hint, run: () => runTask(g2, nx.info, ctx) };
      } catch { /* sans suite proposée */ }
      return { hint };
    } });
}
