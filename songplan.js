// Programme d'apprentissage d'un morceau jusqu'à une échéance. Fonctions pures, sans DOM.
// analyzeSong → makePlan → (séances) adapt / nextTasks / eta. `skill` est injecté (voir skill.js), jamais importé ici.
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const r05 = x => Math.round(x * 2) / 2;
const r2 = x => Math.round(x * 100) / 100;
const BLOCK_MIN = 3; // un bloc de travail = au moins 3 min (reps × durée d'un passage + repos, cf. reps())
const DAY = 864e5, MASTER = 0.95, INTERVALS = [1, 3, 7, 14], SPEEDS = [0.6, 0.8, 1];

// --- dates (jours entiers, calendrier local ; 'YYYY-MM-DD' lu tel quel) ---
const toNum = d => {
  if (typeof d === 'string') { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d); if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY; }
  const x = new Date(d ?? Date.now()); return Number.isNaN(+x) ? NaN : Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()) / DAY;
};
const iso = n => new Date(n * DAY).toISOString().slice(0, 10);
const wd = n => new Date(n * DAY).getUTCDay();
const fr = n => iso(n).split('-').reverse().join('/');

// --- analyse du morceau ---
const norm = n => Array.isArray(n) ? { m: n[0], s: n[1], d: n[2], h: n[3], f: n[4] } : n;
const sigOf = (ns, b0) => ns.map(n => `${n.h}${n.m}@${r2(n.s - b0)}:${n.d}`).sort().join(',');

function bandFeatures(ns, beats, bpm) {
  if (!ns.length) return { density: 0, range: 0, leaps: 0, chords: 0, handIndependence: 0, rhythmComplexity: 0, tempo: 0, hands: 'R' };
  const hs = new Set(ns.map(n => n.h)); const hands = hs.size > 1 ? 'both' : hs.has('L') ? 'L' : 'R';
  const ms = ns.map(n => n.m);
  let steps = 0, leaps = 0, chordN = 0; const times = { R: new Set(), L: new Set() };
  for (const h of hs) {
    const g = new Map();
    for (const n of ns) if (n.h === h) { const k = r2(n.s); (g.get(k) || g.set(k, []).get(k)).push(n.m); times[h === 'L' ? 'L' : 'R'].add(k); }
    let prev = null;
    for (const k of [...g.keys()].sort((a, b) => a - b)) {
      const ps = g.get(k); if (ps.length > 1) chordN += ps.length;
      const top = Math.max(...ps); if (prev != null) { steps++; if (Math.abs(top - prev) > 4) leaps++; } prev = top;
    }
  }
  let hi = 0;
  if (hands === 'both') { const u = new Set([...times.R, ...times.L]); let diff = 0; for (const t of u) if (times.R.has(t) !== times.L.has(t)) diff++; hi = diff / u.size; }
  const irregular = ns.filter(n => r2(n.s) % 0.5 !== 0 || r2(n.d) % 0.5 !== 0).length / ns.length;
  const perSec = ns.length / (beats * 60 / bpm);
  return {
    density: clamp(ns.length / beats / 4), range: clamp((Math.max(...ms) - Math.min(...ms)) / 36),
    leaps: clamp(steps ? 2 * leaps / steps : 0), chords: clamp(1.5 * chordN / ns.length), handIndependence: clamp(hi),
    rhythmComplexity: clamp(2 * irregular), tempo: clamp(perSec / 8), hands,
  };
}
const diffOf = f => clamp(.2 * f.density + .1 * f.range + .15 * f.leaps + .15 * f.chords + .2 * f.handIndependence + .1 * f.rhythmComplexity + .1 * f.tempo + (f.hands === 'both' ? .05 : 0));
const levelOf = d => d < .22 ? 'facile' : d < .42 ? 'moyen' : d < .62 ? 'difficile' : 'très difficile';

// prédiction : skill injecté, sinon valeurs prudentes de débutant
function predict(skill, f, speed) {
  const d = f.difficulty ?? diffOf(f);
  let r; try { r = skill?.predict?.(f, speed); } catch { r = null; }
  const p0 = clamp(.92 - .75 * d * (.4 + .6 * speed), .05, .95);
  const p = Number.isFinite(r?.pSuccess) ? clamp(r.pSuccess, .02, 1) : p0;
  const a = Number.isFinite(r?.expectedAttempts) && r.expectedAttempts > 0 ? r.expectedAttempts : 2 / p;
  return { pSuccess: p, expectedAttempts: clamp(a, 1, 40) };
}

export function analyzeSong(song) {
  const ns = (song?.notes || []).map(norm).filter(n => Number.isFinite(n.m) && Number.isFinite(n.s) && n.s >= 0).map(n => ({ ...n, d: n.d > 0 ? n.d : 0.25 }));
  const bpm = song?.bpm > 0 ? song.bpm : 100;
  if (!ns.length) return { bpm, bars: 0, sections: [], overall: { difficulty: 0, level: 'facile', minutesEstimate: 0 } };
  const total = Math.max(...ns.map(n => n.s + n.d)), bars = Math.max(1, Math.ceil(total / 4 - 1e-9));
  const inBar = Array.from({ length: bars }, (_, b) => ns.filter(n => n.s >= 4 * b - 1e-9 && n.s < 4 * b + 4 - 1e-9));
  const sig = inBar.map((x, b) => sigOf(x, 4 * b));
  // score d'une coupure après la mesure i : silence / note longue qui conclut / reprise d'une phrase
  const cutScore = (i, a, len) => {
    const end = 4 * i + 4; let s = len === 4 ? .5 : len === 2 || len === 8 ? .3 : 0;
    if (!inBar[i].length) s += 3;
    else if (!ns.some(n => n.s < end - .25 && n.s + n.d > end - .25)) s += 2;
    else if (ns.some(n => n.d >= 2 && Math.abs(n.s + n.d - end) < .01)) s += 1.5;
    return s - Math.abs(len - 4) * .02;
  };
  const cuts = [];
  for (let a = 0; a < bars;) {
    const left = bars - a; let len = left;
    if (left > 5) { let best = -1e9; for (let l = 2; l <= Math.min(8, left); l++) { if (left - l === 1) continue; const s = cutScore(a + l - 1, a, l); if (s > best) { best = s; len = l; } } }
    cuts.push([a, a + len - 1]); a += len;
  }
  if (cuts.length > 1 && cuts.at(-1)[1] === cuts.at(-1)[0] && cuts.at(-2)[1] - cuts.at(-2)[0] < 7) { const l = cuts.pop(); cuts.at(-1)[1] = l[1]; }
  const seen = new Map();
  const sections = cuts.map(([a, b], i) => {
    const sub = ns.filter(n => n.s >= 4 * a - 1e-9 && n.s < 4 * b + 4 - 1e-9), beats = 4 * (b - a + 1);
    const features = bandFeatures(sub, beats, bpm), key = sig.slice(a, b + 1).join('|');
    const sec = { id: 's' + (i + 1), bars: [a + 1, b + 1], startBeat: 4 * a, endBeat: 4 * b + 4, features, difficulty: r2(diffOf(features)), label: a === b ? `Mesure ${a + 1}` : `Mesures ${a + 1}-${b + 1}` };
    if (sub.length && seen.has(key)) sec.dupOf = seen.get(key); else if (sub.length) seen.set(key, sec.id);
    return sec;
  });
  const uniq = sections.filter(s => !s.dupOf), w = s => s.bars[1] - s.bars[0] + 1;
  const wsum = uniq.reduce((x, s) => x + w(s), 0) || 1;
  const diff = clamp(uniq.reduce((x, s) => x + s.difficulty * w(s), 0) / wsum * .85 + Math.max(...uniq.map(s => s.difficulty)) * .15);
  const minutesEstimate = Math.round(uniq.reduce((x, s) => x + stageList(s, 1, null, 1).reduce((y, g) => y + g.minutes, 0), 0) * 1.25);
  return { bpm, bars, sections, overall: { difficulty: r2(diff), level: levelOf(diff), minutesEstimate } };
}

// --- maîtrise : ≥ 85 % à la vitesse cible sur 2 tentatives consécutives, jamais sur une seule ---
export function masteryFrom(attempts, target = 1) {
  const a = (attempts || []).map(t => ({ acc: t.acc > 1 ? t.acc / 100 : +t.acc || 0, speed: +t.speed || 0, ts: t.ts }));
  if (!a.length) return { mastery: 0, mastered: false, attempts: 0, bestAcc: 0, lastSpeed: 0, lastTs: null };
  const ok = t => t.acc >= .85 && t.speed >= target - .01;
  let streak = 0; for (let i = a.length - 1; i >= 0 && ok(a[i]); i--) streak++;
  const mastered = streak >= 2, last = a.slice(-3);
  const q = last.reduce((x, t) => x + t.acc * Math.min(1, t.speed / target), 0) / last.length;
  const l = a.at(-1);
  return { mastery: mastered ? 1 : r2(Math.min(.9, q * .9)), mastered, attempts: a.length, bestAcc: Math.max(...a.map(t => t.acc)), lastSpeed: l.speed, lastTs: l.ts ?? null };
}

// --- étapes d'une section : main(s) puis ensemble puis tempo 60 → 100 % ---
function stageList(sec, targetSpeed, skill, slow) {
  const f = sec.features, bars = sec.bars[1] - sec.bars[0] + 1, d = sec.difficulty, st = [];
  const add = (type, hands, speed, w, acc) => {
    const ff = { ...f, hands, handIndependence: hands === 'both' ? f.handIndependence : 0, difficulty: d };
    const factor = clamp(predict(skill, ff, speed).expectedAttempts / 3, .5, 4);
    st.push({ type, hands, speed, acc, minutes: Math.max(BLOCK_MIN, r05(bars * (.35 + 1.4 * d) * w * factor * slow)) });
  };
  if (f.hands === 'both') { add('learn', 'R', .5, .9, .8); add('hands', 'L', .5, .8, .8); add('together', 'both', .5, 1.3, .8); }
  else add('learn', f.hands, .5, .9, .8);
  SPEEDS.forEach((x, i) => add('tempo', f.hands, r2(x * targetSpeed), [.5, .5, .7][i], i === 2 ? .85 : .8));
  return st;
}
const WHY = {
  learn: 'Lecture lente et attentive : on installe les notes sans se presser.',
  hands: 'Seconde main seule, lentement, pour qu\'elle devienne aussi sûre que la première.',
  together: 'Les deux mains ensemble, à vitesse lente : on assemble sans forcer.',
  tempo: 'On monte le tempo par paliers ; on ne passe au palier suivant que quand celui-ci est propre.',
  review: 'Révision espacée : un rappel court maintenant évite de tout réapprendre plus tard.',
  polish: 'On relie deux phrases pour que le passage de l\'une à l\'autre soit fluide.',
  fullrun: 'Passage complet, comme au jour J : on joue sans s\'arrêter.',
};
const reps = (min, bars, bpm, speed) => Math.round(clamp(min * 60 / (bars * 4 * 60 / bpm / Math.max(.3, speed) * 1.3), 2, 20));
const mkTask = (type, sec, hands, speed, minutes, acc, bpm, why) => ({
  type, sectionId: sec.id, hands, speed, reps: reps(minutes, sec.bars[1] - sec.bars[0] + 1, bpm, speed),
  goal: { accuracy: acc, speed }, why: why || WHY[type], minutes,
});

// --- construction du calendrier à partir de la progression connue ---
function schedule(an, o) {
  const { nowN, dlN, mpd, days, targetSpeed, skill, slow, progress } = o;
  const uniq = an.sections.filter(s => !s.dupOf), bpm = an.bpm, bars = s => s.bars[1] - s.bars[0] + 1;
  const avail = []; for (let n = nowN; n < dlN; n++) if (days.includes(wd(n))) avail.push(n);
  const margin = !o.noMargin && avail.length >= 4 ? avail.at(-1) : null, lastN = avail.at(-1);
  const revs = {}, track = {}, doneDay = {}, baseline = {};
  const st = uniq.map(sec => {
    const p = progress?.[sec.id], m = clamp(p?.mastery ?? 0, 0, 1), stages = stageList(sec, targetSpeed, skill, slow);
    const done = m >= MASTER ? stages.length : Math.floor(m / MASTER * stages.length);
    baseline[sec.id] = m; track[sec.id] = [];
    return { sec, stages, idx: done, rem: stages[done]?.minutes, p, m };
  });
  const rvMin = sec => Math.max(1, r05(bars(sec) * .3 * (.5 + sec.difficulty)));
  const addRev = (sec, n, I, first) => {
    let day = avail.find(x => x >= n + I && x <= (margin ?? lastN)); if (day == null) { if (!first) return; day = margin ?? lastN; }
    if (day == null) return;
    (revs[day] ||= []).push(mkTask('review', sec, sec.features.hands, targetSpeed, rvMin(sec), .85, bpm));
  };
  // révisions déjà dues pour les sections maîtrisées au départ
  let reqReview = 0;
  for (const s of st) {
    if (s.idx < s.stages.length) { reqReview += 4 * rvMin(s.sec); continue; }
    const el = s.p?.lastTs != null ? Math.max(0, nowN - toNum(s.p.lastTs)) : 0, left = INTERVALS.filter(I => I > el);
    if (!left.length) { addRev(s.sec, nowN, 0, true); reqReview += rvMin(s.sec); continue; }
    left.forEach((I, i) => addRev(s.sec, nowN - el, I, i === 0)); reqReview += left.length * rvMin(s.sec);
  }
  const reqLearn = st.reduce((x, s) => x + s.stages.slice(s.idx).reduce((y, g, i) => y + (i === 0 ? s.rem : g.minutes), 0), 0);
  const songMin = an.bars * 4 / bpm / Math.max(.3, targetSpeed), fullMin = Math.max(2, r05(songMin * 1.5));
  const polish = []; for (let i = 0; i + 1 < an.sections.length; i++) {
    const a = an.sections[i], b = an.sections[i + 1], d = (a.difficulty + b.difficulty) / 2;
    polish.push({ a, b, minutes: Math.max(1.5, r05((bars(a) + bars(b)) * .3 * (.5 + d))) });
  }
  const reqPolish = polish.reduce((x, p) => x + p.minutes, 0), reqFull = 2 * fullMin;
  const required = { learn: reqLearn, review: reqReview, polish: reqPolish, full: reqFull, total: Math.round(reqLearn + reqReview + reqPolish + reqFull) };

  const sessions = []; let fullQ = 1; const polishQ = [...polish];
  for (let k = 0; k < avail.length; k++) {
    const n = avail[k], tasks = []; let rem = mpd;
    for (const t of revs[n] || []) {
      if (t.minutes <= rem + 1e-9) { tasks.push(t); rem -= t.minutes; }
      else if (avail[k + 1] != null) (revs[avail[k + 1]] ||= []).unshift(t);
    }
    if (n === margin) {
      const m = Math.min(fullMin, r05(rem)); if (m >= 1) tasks.push({ type: 'fullrun', sectionId: 'all', hands: 'both', speed: targetSpeed, reps: Math.max(1, Math.round(m / Math.max(.5, songMin))), goal: { accuracy: .85, speed: targetSpeed }, why: 'Dernière séance avant le jour J : un passage complet tranquille, puis on s\'arrête. Pas de nouveau travail la veille.', minutes: m });
    } else {
      const used = {};
      for (;;) {
        if (rem < 1) break;
        const pend = st.filter(s => s.idx < s.stages.length);
        if (pend.length) {
          const cap = pend.length === 1 ? Infinity : Math.max(mpd * .6, 3);
          // ponytail : si tous les passages ont atteint leur plafond, on le lève plutôt que de gâcher le budget du jour (seul le report « passage difficile » reste)
          const s = pend.find(s => s.blockedDay !== n && (used[s.sec.id] || 0) < cap - 1e-9) || pend.find(s => s.blockedDay !== n);
          if (!s) break;
          const g = s.stages[s.idx], piece = r05(Math.min(s.rem, rem, cap - (used[s.sec.id] || 0)));
          if (piece < 1 && s.rem >= 1) break;
          const mins = piece < 1 ? s.rem : piece;
          tasks.push(mkTask(g.type, s.sec, g.hands, g.speed, mins, g.acc, bpm));
          track[s.sec.id].push({ date: iso(n), minutes: mins });
          used[s.sec.id] = (used[s.sec.id] || 0) + mins; rem -= mins; s.rem = r05(s.rem - mins);
          if (s.rem <= 0.01) {
            s.idx++; s.rem = s.stages[s.idx]?.minutes;
            if (s.sec.difficulty > .45) s.blockedDay = n; // difficile : l'étape suivante attend un autre jour
            if (s.idx >= s.stages.length) { doneDay[s.sec.id] = n; INTERVALS.forEach((I, i) => addRev(s.sec, n, I, i === 0)); }
          }
        } else if (polishQ.length) {
          const p = polishQ[0]; if (p.minutes > rem + 1e-9) break; polishQ.shift();
          tasks.push({ type: 'polish', sectionId: `${p.a.id}+${p.b.id}`, hands: 'both', speed: targetSpeed, reps: 3, goal: { accuracy: .85, speed: targetSpeed }, why: WHY.polish, minutes: p.minutes }); rem -= p.minutes;
        } else if (fullQ > 0 && !tasks.some(t => t.type === 'fullrun') && rem >= Math.min(fullMin, 2)) {
          const m = Math.min(fullMin, r05(rem)); fullQ--; rem -= m;
          tasks.push({ type: 'fullrun', sectionId: 'all', hands: 'both', speed: targetSpeed, reps: 1, goal: { accuracy: .85, speed: targetSpeed }, why: WHY.fullrun, minutes: m });
        } else break;
      }
    }
    if (tasks.length) {
      const minutes = r05(tasks.reduce((x, t) => x + t.minutes, 0)), ses = { date: iso(n), minutes, tasks };
      if (minutes < mpd - 1 && n !== margin) ses.note = `Séance courte aujourd'hui : il ne reste que ${minutes} min de travail utile.`;
      sessions.push(ses);
    }
  }
  const leftover = st.filter(s => s.idx < s.stages.length).length + polishQ.length + fullQ;
  // jalons : un par tiers du morceau, puis le jour J
  const dones = uniq.filter(s => doneDay[s.sec?.id ?? s.id] != null).map(s => s.id), milestones = [];
  const ids = id => [id, ...an.sections.filter(x => x.dupOf === id).map(x => x.id)];
  const chunk = Math.max(1, Math.ceil(uniq.length / (uniq.length > 4 ? 3 : uniq.length)));
  for (let i = 0; i < dones.length; i += chunk) {
    const grp = dones.slice(i, i + chunk), last = Math.max(...grp.map(id => doneDay[id]));
    const secs = grp.flatMap(ids), ss = an.sections.filter(x => secs.includes(x.id));
    milestones.push({ date: iso(last), label: `Maîtrisé : ${ss.map(x => x.label.toLowerCase()).join(', ')}`, sections: secs });
  }
  if (margin != null) milestones.push({ date: iso(margin), label: 'Marge : passage complet tranquille', sections: an.sections.map(s => s.id) });
  milestones.push({ date: iso(dlN), label: 'Jour J : morceau complet', sections: an.sections.map(s => s.id) });
  return { sessions, milestones, track, baseline, leftover, required, avail, margin, st };
}

function judge(an, o, sc) {
  const availableMinutes = sc.avail.length * o.mpd, req = sc.required.total, ratio = req / Math.max(1, availableMinutes);
  const verdict = sc.leftover ? 'unrealistic' : ratio <= .8 ? 'ok' : ratio <= 1 ? 'tight' : 'unrealistic';
  const f = { verdict, requiredMinutes: req, availableMinutes, message: '', suggestion: '' };
  if (verdict === 'ok') f.message = `Objectif réaliste : environ ${req} min de travail pour ${availableMinutes} min disponibles (${sc.sessions.length} séances planifiées). Vous gardez de la marge, et une séance manquée ne posera pas de problème.`;
  else if (verdict === 'tight') f.message = `C'est faisable, mais avec peu de marge : environ ${req} min nécessaires pour ${availableMinutes} min disponibles. Chaque séance compte ; si l'une saute, je rééquilibrerai le programme sans vous faire sauter d'étape.`;
  else {
    f.message = ratio > 1
      ? `Soyons honnêtes : avec ${o.mpd} min par jour jusqu'au ${fr(o.dlN)}, il manque environ ${Math.round(req - availableMinutes)} min pour maîtriser ce morceau sans le bâcler. Mieux vaut le savoir maintenant que de survoler les passages difficiles.`
      : `Le temps total pourrait suffire, mais pas le nombre de séances : un apprentissage solide demande de répartir les passages difficiles sur plusieurs jours, et il n'y en a pas assez avant le ${fr(o.dlN)}.`;
    let needMpd = Math.ceil(req * 1.15 / Math.max(1, sc.avail.length));
    while (needMpd < 600 && schedule(an, { ...o, mpd: needMpd }).leftover) needMpd++; // blocs de 3 min : la suggestion doit vraiment tenir
    // échéance suggérée : on repousse jusqu'à ce que le calendrier tienne avec ~15 % de marge
    let dl = o.dlN, found = null;
    for (let i = 0; i < 400 && found == null; i++) {
      dl += i < 14 ? 1 : 7; const s2 = schedule(an, { ...o, dlN: dl });
      if (!s2.leftover && s2.required.total / Math.max(1, s2.avail.length * o.mpd) <= .85) found = dl;
    }
    const uniq = an.sections.filter(s => !s.dupOf); let acc = 0, k = 0;
    const per = uniq.map(s => stageList(s, o.targetSpeed, o.skill, o.slow).reduce((x, g) => x + g.minutes, 0));
    for (; k < uniq.length && acc + per[k] <= availableMinutes * .6; k++) acc += per[k];
    f.suggestedMinutesPerDay = needMpd; if (found) f.suggestedDeadline = iso(found);
    f.suggestion = [`passer à environ ${needMpd} min par jour`, found ? `repousser l'échéance au ${fr(found)}` : null,
      k > 0 && k < uniq.length ? `viser d'abord ${k === 1 ? uniq[0].label.toLowerCase() : `les mesures ${uniq[0].bars[0]}-${uniq[k - 1].bars[1]}`} et garder le reste pour plus tard` : null]
      .filter(Boolean).map((x, i) => `(${i + 1}) ${x}`).join(' ; ');
    f.suggestion = 'Options : ' + f.suggestion + '. Dites-moi ce que vous préférez.';
  }
  return f;
}

const emptyPlan = (an, o, message, extra = {}) => ({
  version: 1, title: o.title, bpm: an.bpm, deadline: o.deadline, createdAt: iso(o.nowN), minutesPerDay: o.mpd, days: o.days, targetSpeed: o.targetSpeed, slow: 1,
  analysis: an, baseline: {}, track: {}, milestones: [], sessions: [],
  feasibility: { verdict: 'unrealistic', message, requiredMinutes: an.overall.minutesEstimate, availableMinutes: 0, suggestion: '', ...extra },
});

function norm_opts(p) {
  const days = Array.isArray(p.days) && p.days.length ? [...new Set(p.days.filter(d => d >= 0 && d <= 6))] : [0, 1, 2, 3, 4, 5, 6];
  return { nowN: toNum(p.now), dlN: toNum(p.deadline), mpd: Number.isFinite(+p.minutesPerDay) ? +p.minutesPerDay : 0, days, targetSpeed: clamp(+p.targetSpeed || 1, .3, 1.5), skill: p.skill, progress: p.progress || {}, slow: p.slow || 1, deadline: p.deadline, title: p.song?.title };
}

export function makePlan(p) {
  const an = analyzeSong(p.song), o = norm_opts(p);
  if (!an.sections.length) return emptyPlan(an, o, 'Ce morceau ne contient aucune note : il n\'y a rien à apprendre pour l\'instant. Importez une autre partition.');
  if (!Number.isFinite(o.dlN)) return emptyPlan(an, o, 'La date d\'échéance n\'est pas valide : indiquez-la au format AAAA-MM-JJ.');
  if (o.dlN <= o.nowN) {
    const f = Math.max(7, Math.ceil(an.overall.minutesEstimate / Math.max(10, o.mpd || 15)) * 2);
    return emptyPlan(an, o, o.dlN < o.nowN ? 'Cette échéance est déjà passée. Choisissez une nouvelle date : on repart de là sans pression.' : 'L\'échéance est aujourd\'hui : il n\'y a plus de temps pour un apprentissage espacé.', { suggestedDeadline: iso(o.nowN + f), suggestion: `Option : fixer l'échéance vers le ${fr(o.nowN + f)}.` });
  }
  if (!(o.mpd > 0)) return emptyPlan(an, o, 'Sans temps disponible (0 minute par jour), je ne peux pas construire de programme honnête. Indiquez au moins 5 minutes par jour.', { suggestedMinutesPerDay: Math.max(5, Math.ceil(an.overall.minutesEstimate / Math.max(1, o.dlN - o.nowN))), suggestion: 'Même 10 minutes par jour régulières valent mieux qu\'une longue séance rare.' });
  const sc = schedule(an, o), feasibility = judge(an, o, sc);
  return { version: 1, title: o.title, bpm: an.bpm, deadline: o.deadline, createdAt: iso(o.nowN), minutesPerDay: o.mpd, days: o.days, targetSpeed: o.targetSpeed, slow: o.slow, analysis: an, baseline: sc.baseline, track: sc.track, feasibility, milestones: sc.milestones, sessions: sc.sessions };
}

const optsOf = (plan, extra = {}) => ({ nowN: toNum(extra.now), dlN: toNum(plan.deadline), mpd: plan.minutesPerDay, days: plan.days, targetSpeed: plan.targetSpeed, skill: extra.skill, progress: extra.progress, slow: plan.slow || 1, deadline: plan.deadline, title: plan.title });
const lastDate = pl => pl.sessions.filter(s => s.tasks.some(t => t.type !== 'review' && t.type !== 'fullrun')).at(-1)?.date;

export function adapt({ plan, progress = {}, now, skill }) {
  const o = optsOf(plan, { now, progress, skill }), an = plan.analysis, today = iso(o.nowN);
  const uniq = an.sections.filter(s => !s.dupOf), reasons = [], changes = [];
  let wTot = 0, dExp = 0, dAct = 0, gExp = 0, gAct = 0; const lag = [], lead = [];
  for (const s of uniq) {
    const tr = plan.track[s.id] || [], tot = tr.reduce((x, t) => x + t.minutes, 0), w = s.bars[1] - s.bars[0] + 1;
    const frac = tot ? tr.filter(t => t.date < today).reduce((x, t) => x + t.minutes, 0) / tot : 1;
    const base = plan.baseline[s.id] ?? 0, exp = base + (MASTER - base) * frac, act = clamp(progress[s.id]?.mastery ?? 0, 0, 1);
    wTot += w; dExp += w * exp; dAct += w * act; gExp += w * (exp - base); gAct += w * Math.max(0, act - base);
    if (exp - act > .15) lag.push(s); else if (act - exp > .15) lead.push(s);
  }
  const D = (dAct - dExp) / Math.max(1, wTot);
  const status = D < -.08 || (lag.length && D < 0) ? 'behind' : D > .08 ? 'ahead' : 'on_track';
  let slow = plan.slow || 1;
  if (status === 'behind' && gExp > 0) slow *= clamp(gExp / Math.max(gAct, .1 * gExp), 1, 2.5);
  else if (status === 'ahead' && gExp > 0) slow *= clamp(gExp / gAct, .6, 1);
  slow = r2(clamp(slow, .5, 4));
  const o2 = { ...o, slow }, oldEnd = lastDate(plan);
  let np;
  if (o.dlN <= o.nowN) {
    np = { ...plan, slow, sessions: [], milestones: [], feasibility: makePlanPast(an, o2, progress) };
    reasons.push(o.dlN < o.nowN ? 'L\'échéance est dépassée.' : 'L\'échéance est aujourd\'hui.');
    changes.push('Plus de séances possibles avant l\'échéance : choisissez une nouvelle date pour repartir de votre niveau actuel, sans rien perdre de ce qui est maîtrisé.');
    return { plan: np, status: uniq.every(s => (progress[s.id]?.mastery ?? 0) >= MASTER) ? 'on_track' : 'behind', reasons, changes };
  }
  const sc = schedule(an, o2), feasibility = judge(an, o2, sc);
  np = { ...plan, slow, baseline: sc.baseline, track: sc.track, feasibility, milestones: sc.milestones, sessions: sc.sessions };
  const pct = x => Math.round(x * 100) + ' %';
  if (status === 'behind') {
    reasons.push('Vous avancez un peu moins vite que prévu : c\'est normal, chaque main a son rythme.');
    for (const s of lag) reasons.push(`${s.label} : maîtrise ${pct(progress[s.id]?.mastery ?? 0)}, en dessous du calendrier prévu.`);
    changes.push(`Durée des étapes ajustée ×${slow} : les passages non maîtrisés sont conservés, on ne saute rien.`);
    if (feasibility.verdict !== 'ok') changes.push(feasibility.message + ' ' + feasibility.suggestion);
  } else if (status === 'ahead') {
    reasons.push('Vous avancez plus vite que prévu : bravo !');
    for (const s of lead) reasons.push(`${s.label} : déjà maîtrisé à ${pct(progress[s.id]?.mastery ?? 0)}.`);
    const nl = lastDate(np);
    changes.push(`Vous pouvez terminer l'apprentissage ${oldEnd && nl && nl < oldEnd ? `dès le ${fr(toNum(nl))} au lieu du ${fr(toNum(oldEnd))}` : 'en avance'} : accélérer le programme, ou ajouter un second morceau avec le temps gagné.`);
  } else reasons.push('Vous êtes dans les temps : continuez ainsi.');
  const oldMin = plan.sessions.reduce((x, s) => x + s.minutes, 0), newMin = np.sessions.reduce((x, s) => x + s.minutes, 0);
  if (status !== 'on_track') changes.push(`Travail restant prévu : ${Math.round(newMin)} min (contre ${Math.round(oldMin)} min dans l'ancien calendrier, qui incluait le passé).`);
  return { plan: np, status, reasons, changes };
}
function makePlanPast(an, o, progress) {
  const f = Math.max(7, Math.ceil(an.overall.minutesEstimate / Math.max(10, o.mpd || 15)) * 2);
  return { verdict: 'unrealistic', message: 'L\'échéance est dépassée ou arrive aujourd\'hui. Choisissez une nouvelle date : ce qui est déjà maîtrisé est conservé.', requiredMinutes: an.overall.minutesEstimate, availableMinutes: 0, suggestedDeadline: iso(o.nowN + f), suggestion: `Option : fixer l'échéance vers le ${fr(o.nowN + f)}.` };
}

export function nextTasks(plan, now, minutesAvailable = Infinity) {
  const s = plan?.sessions?.find(x => x.date === iso(toNum(now)));
  if (!s) return [];
  const out = []; let used = 0;
  for (const t of s.tasks) { if (out.length && used + t.minutes > minutesAvailable + 1e-9) break; if (!out.length && t.minutes > minutesAvailable) { if (!(minutesAvailable > 0)) break; } out.push(t); used += t.minutes; }
  return out;
}

// estimation de la fin de l'apprentissage au rythme actuel (sans jour de marge ni limite d'échéance)
export function eta(plan, progress = {}, now, skill) {
  const o = { ...optsOf(plan, { now, progress, skill }), noMargin: true }; o.dlN = o.nowN + 730;
  const sc = schedule(plan.analysis, o), uniq = plan.analysis.sections.filter(s => !s.dupOf);
  const mastered = uniq.filter(s => (progress[s.id]?.mastery ?? 0) >= MASTER).length;
  const date = sc.leftover ? null : sc.sessions.at(-1)?.date ?? iso(o.nowN);
  return { date, onTime: !!date && toNum(date) < toNum(plan.deadline), mastered, total: uniq.length, remainingMinutes: Math.round(sc.required.total), pct: uniq.length ? Math.round(100 * mastered / uniq.length) : 100 };
}
