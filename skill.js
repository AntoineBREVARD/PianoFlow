// PianoFlow - modèle de niveau du joueur (fonctions pures, sans DOM).
//
// MÉTHODE : pour chaque dimension, une compétence latente mu (échelle 0..1, la même que la difficulté d'un
// élément) avec incertitude v (variance), façon ELO/Glicko bayésien en ligne (filtre de Kalman étendu).
//   P(réussir une note) = produit, sur les dimensions mobilisées par la note, de sigmoid(K*(mu_i - d_i)),
//   d_i = difficulté de la note pour la dimension i. L'erreur est répartie entre dimensions au prorata de
//   (1 - p_i) : un échec sur du facile pèse plus, une réussite sur du difficile aussi.
//   Oubli exponentiel : la variance regonfle (+Q) à chaque tentative, donc le modèle suit l'évolution du joueur.
//   Confiance = 1 - écart-type/écart-type a priori, plafonnée par le nombre d'observations.
//
// HYPOTHÈSES ET LIMITES (HONNÊTETÉ) :
//  - Toutes les formules de difficulté, seuils (saut > 5 demi-tons, fenêtres de timing, constantes K/Q/W) sont
//    des HEURISTIQUES posées a priori, NON VALIDÉES sur des données de vrais joueurs. Seule une simulation
//    (test-skill.mjs) vérifie la cohérence interne du modèle, pas sa justesse pédagogique.
//  - Les notes d'une même tentative sont corrélées ; on les atténue (W=0.35) sans modéliser la corrélation :
//    la confiance reste approximative.
//  - Les dimensions se recouvrent (une note de saut à la main gauche nourrit pitch, leftHand et leaps) ; la
//    répartition de la faute est un compromis, des dimensions voisines peuvent être signalées à tort.
//  - "rhythm", "timing" et "tempo" ne sont observés qu'en mode 'rhythm' ; "hesitation" qu'en mode 'wait'
//    (dt = délai de réponse en ms) ; le mode 'demo' est ignoré. Un joueur qui ne fait que du mode wait n'a
//    donc aucune confiance sur rythme/timing/tempo.
//  - "endurance" mesure la CONSTANCE (précision 2e moitié / 1re moitié), pas le niveau absolu.
//  - Un attaque systématiquement en avance/en retard n'entre pas dans le score timing (seulement |dt|) ;
//    elle est signalée par diagnoseAttempt.
//  - predict() : pSuccess = "jouer la section avec une bonne précision" ; la transformation finale
//    (sigmoïde sur le produit des probabilités par note) est une heuristique non calibrée.
//    Unités de features : density = notes/temps, range = demi-tons, leaps/chords/handIndependence/
//    rhythmComplexity = 0..1, tempo = bpm, hands = 'both'|'R'|'L' ; speed = multiplicateur (tempo effectif = tempo*speed).

export const DIMS = ['pitch', 'rhythm', 'timing', 'leftHand', 'rightHand', 'coordination', 'leaps', 'chords', 'tempo', 'endurance', 'hesitation'];
const K = 8, MU0 = 0.4, SD0 = 0.4, Q = 0.002, W = 0.35, HIST = 12;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sig = x => 1 / (1 + Math.exp(-x));
const BLACK = new Set([1, 3, 6, 8, 10]);

const LABELS = {
  pitch: 'Lecture des notes', rhythm: 'Rythme', timing: 'Précision du timing', leftHand: 'Main gauche', rightHand: 'Main droite',
  coordination: 'Coordination des deux mains', leaps: 'Sauts', chords: 'Accords', tempo: 'Vitesse', endurance: 'Endurance', hesitation: 'Réactivité',
};
const ADVICE = {
  pitch: 'Ralentis et joue des passages courts en nommant chaque note avant de la jouer.',
  rhythm: 'Travaille au métronome lent, en comptant à voix haute, sur les passages à notes courtes.',
  timing: 'Joue avec le métronome et écoute si tu es plutôt en avance ou en retard, puis corrige par petites touches.',
  leftHand: 'Répète la main gauche seule, lentement, jusqu\'à ce qu\'elle devienne automatique.',
  rightHand: 'Répète la main droite seule, par phrases de 2 mesures.',
  coordination: 'Passe de chaque main seule aux deux mains à vitesse réduite, mesure par mesure.',
  leaps: 'Regarde le clavier le moins possible : entraîne tes déplacements de main sur les sauts, très lentement.',
  chords: 'Prépare la forme de l\'accord avant de le jouer et pose tous les doigts ensemble.',
  tempo: 'Augmente la vitesse par paliers de 5 %, seulement quand le palier précédent est propre.',
  endurance: 'Fais des tentatives plus longues, avec des pauses courtes ; garde la même attention jusqu\'à la fin.',
  hesitation: 'Lis un peu en avance : regarde la note suivante pendant que tu joues la note courante.',
};

export function emptyProfile() {
  const dims = {}, hist = {};
  for (const d of DIMS) { dims[d] = { mu: MU0, v: SD0 * SD0, n: 0 }; hist[d] = []; }
  return { v: 1, attempts: 0, last: null, dims, hist };
}

// Annotation des notes (déjà filtrées sur celles qui comptent) : saut, accord, passage à deux mains, difficultés.
export function annotate(notes) {
  const arr = [...notes].sort((a, b) => a.s - b.s || a.m - b.m);
  const key = n => n.h + '|' + Math.round(n.s * 1000);
  const groups = new Map(), byHand = { R: [], L: [] };
  for (const n of arr) { const k = key(n); if (!groups.has(k)) { const g = []; groups.set(k, g); (byHand[n.h] || (byHand[n.h] = [])).push(g); } groups.get(k).push(n); }
  const prevOf = new Map();
  for (const h in byHand) byHand[h].forEach((g, i) => prevOf.set(g, byHand[h][i - 1]));
  return arr.map(n => {
    const g = groups.get(key(n)), pg = prevOf.get(g);
    const leap = g.length === 1 && pg ? Math.min(...pg.map(p => Math.abs(n.m - p.m))) : 0;
    const ms = g.map(x => x.m), span = Math.max(...ms) - Math.min(...ms);
    const other = arr.filter(o => o.h !== n.h && o.s <= n.s + 0.01 && o.s + o.d > n.s + 0.01);
    const coord = other.length > 0, indep = coord && !other.some(o => Math.abs(o.s - n.s) < 0.01);
    const dist = Math.max(0, 60 - n.m, n.m - 72);
    const pd = clamp(0.2 + (BLACK.has(n.m % 12) ? 0.12 : 0) + 0.1 * clamp(dist / 18));
    const frac = ((n.s % 1) + 1) % 1;
    const rd = clamp((n.d <= 0.26 ? 0.8 : n.d <= 0.51 ? 0.6 : n.d < 1 ? 0.45 : 0.2) + (frac > 0.01 && Math.abs(frac - 0.5) > 0.01 ? 0.15 : frac > 0.01 ? 0.1 : 0));
    return { n, leap, size: g.length, span, coord, indep, pd, rd };
  });
}

const leapD = l => 0.3 + 0.5 * clamp((l - 5) / 19);
const chordD = (size, span) => 0.35 + 0.1 * (size - 2) + (span > 12 ? 0.1 : 0);
const coordD = indep => 0.4 + (indep ? 0.2 : 0);
const tempoD = eff => 0.1 + 0.8 * clamp((eff - 40) / 140);

function step(P, items, y, w) {
  const ps = items.map(it => sig(K * (P.dims[it.dim].mu - it.d)));
  const Pn = clamp(ps.reduce((a, b) => a * b, 1), 0.02, 0.98);
  items.forEach((it, j) => {
    const s = P.dims[it.dim], dP = Pn * (1 - ps[j]) * K, den = Pn * (1 - Pn);
    const vn = 1 / (1 / s.v + w * dP * dP / den);
    s.mu = clamp(s.mu + vn * w * (y - Pn) * dP / den, -0.2, 1.2); s.v = vn; s.n++;
  });
}

const okNote = n => n.req && n.hit;
const good = n => (n.hit ? (n.wrong ? 0.6 : 1) : 0);

export function update(profile, attempt) {
  if (!attempt || attempt.mode === 'demo') return profile;
  const P = structuredClone(profile);
  const notes = (attempt.notes || []).filter(n => n.req);
  if (!notes.length) return P;
  const rhythm = attempt.mode === 'rhythm', eff = (attempt.bpm || 100) * (attempt.speed || 1);
  const obs = []; // { items, y, w }
  for (const a of annotate(notes)) {
    const n = a.n, items = [{ dim: 'pitch', d: a.pd }, { dim: n.h === 'L' ? 'leftHand' : 'rightHand', d: a.pd }];
    if (a.leap > 5) items.push({ dim: 'leaps', d: leapD(a.leap) });
    if (a.size >= 2) items.push({ dim: 'chords', d: chordD(a.size, a.span) });
    if (a.coord) items.push({ dim: 'coordination', d: coordD(a.indep) });
    if (rhythm) items.push({ dim: 'rhythm', d: a.rd }, { dim: 'tempo', d: tempoD(eff) });
    obs.push({ items, y: good(n), w: W });
    if (n.hit && n.dt != null) {
      if (rhythm) obs.push({ items: [{ dim: 'timing', d: 0.25 + 0.5 * clamp((eff - 50) / 150) + (n.d <= 0.51 ? 0.1 : 0) }], y: clamp(1 - (Math.abs(n.dt) - 40) / 180), w: W });
      else if (attempt.mode === 'wait') obs.push({ items: [{ dim: 'hesitation', d: 0.35 + (a.leap > 5 || a.size >= 2 ? 0.1 : 0) }], y: clamp(1 - (Math.abs(n.dt) - 250) / 1750), w: W });
    }
  }
  if (notes.length >= 16) { // endurance : précision 2e moitié / 1re moitié
    const ss = notes.map(n => n.s).sort((a, b) => a - b), med = ss[ss.length >> 1];
    const half = f => { const l = notes.filter(f); return l.length ? l.reduce((a, n) => a + good(n), 0) / l.length : 0; };
    const a1 = half(n => n.s < med), a2 = half(n => n.s >= med);
    if (a1 >= 0.3) obs.push({ items: [{ dim: 'endurance', d: 0.55 }], y: Math.min(1, a2 / a1), w: 1.5 });
  }
  const touched = new Set(obs.flatMap(o => o.items.map(i => i.dim)));
  for (const d of touched) P.dims[d].v = Math.min(SD0 * SD0, P.dims[d].v + Q); // oubli
  for (const o of obs) step(P, o.items, o.y, o.w);
  for (const d of touched) P.hist[d] = [...P.hist[d], P.dims[d].mu].slice(-HIST);
  P.attempts++; P.last = attempt.ts ?? P.last;
  return P;
}

function trend(h) {
  if (h.length < 4) return 'flat';
  const m = Math.min(3, h.length >> 1), avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  const diff = avg(h.slice(-m)) - avg(h.slice(-2 * m, -m));
  return diff > 0.03 ? 'up' : diff < -0.03 ? 'down' : 'flat';
}

const levelLabel = (s, c) => c < 0.15 ? 'Niveau en cours d\'évaluation' : s < 25 ? 'Débutant' : s < 40 ? 'Débutant confirmé' : s < 55 ? 'Intermédiaire' : s < 70 ? 'Intermédiaire avancé' : 'Avancé';

export function analyze(profile) {
  const dims = {};
  for (const d of DIMS) {
    const s = profile.dims[d];
    dims[d] = { score: Math.round(clamp(s.mu) * 100), confidence: +(clamp((1 - Math.sqrt(s.v) / SD0) * Math.min(1, s.n / 15))).toFixed(3), trend: trend(profile.hist[d]), n: s.n };
  }
  const conf = DIMS.filter(d => dims[d].confidence >= 0.3);
  const ref = conf.length ? conf.reduce((a, d) => a + dims[d].score, 0) / conf.length : 0;
  const strengths = conf.filter(d => dims[d].score > ref + 10).sort((a, b) => dims[b].score - dims[a].score).slice(0, 3).map(d => ({ dim: d, label: LABELS[d] }));
  const weaknesses = conf.filter(d => dims[d].score < ref - 10).sort((a, b) => dims[a].score - dims[b].score).slice(0, 3).map(d => ({ dim: d, label: LABELS[d], advice: ADVICE[d] }));
  const wsum = DIMS.reduce((a, d) => a + dims[d].confidence, 0);
  const score = wsum ? Math.round(DIMS.reduce((a, d) => a + dims[d].score * dims[d].confidence, 0) / wsum) : 0;
  const confidence = +(wsum / DIMS.length).toFixed(3);
  return { dims, strengths, weaknesses, overall: { score, confidence, label: levelLabel(score, confidence) } };
}

// Description d'une section de morceau. notes = [{m,s,d,h}] ; hands = 'both'|'R'|'L'.
export function featuresOf(notes, bpm = 100, hands = 'both') {
  const ns = notes.filter(n => hands === 'both' || n.h === hands);
  if (!ns.length) return { density: 0, range: 0, leaps: 0, chords: 0, handIndependence: 0, rhythmComplexity: 0, tempo: bpm, hands };
  const an = annotate(ns), len = Math.max(...ns.map(n => n.s + n.d)) - Math.min(...ns.map(n => n.s)), ms = ns.map(n => n.m);
  const f = p => an.filter(p).length / an.length;
  return {
    density: ns.length / Math.max(1, len), range: Math.max(...ms) - Math.min(...ms), leaps: f(a => a.leap > 5), chords: f(a => a.size >= 2),
    handIndependence: f(a => a.indep), rhythmComplexity: clamp((an.reduce((s, a) => s + a.rd, 0) / an.length - 0.2) / 0.5), tempo: bpm, hands,
  };
}

export function predict(profile, f, speed = 1) {
  const eff = (f.tempo || 100) * speed, both = f.hands === 'both' || !f.hands;
  const pd = 0.2 + 0.25 * clamp((f.density || 0) / 3) + 0.25 * clamp((f.range || 0) / 36);
  const it = [['pitch', pd, 1], ['rhythm', 0.2 + 0.5 * (f.rhythmComplexity || 0), 1], ['tempo', tempoD(eff), 1],
    ['leaps', 0.55, 3 * (f.leaps || 0)], ['chords', 0.45, 3 * (f.chords || 0)], ['coordination', 0.5, both ? 3 * (f.handIndependence || 0) : 0]];
  if (f.hands !== 'L') it.push(['rightHand', pd, 1]);
  if (f.hands !== 'R') it.push(['leftHand', pd, 1]);
  const mu = d => profile.dims[d].mu;
  let lw = 0, ws = 0;
  for (const [d, dif, w] of it) { lw += w * Math.log(sig(K * (mu(d) - dif))); ws += w; }
  const pNote = Math.exp(lw / ws);
  const pSuccess = sig(12 * (pNote - 0.6));
  return { pSuccess: +pSuccess.toFixed(4), expectedAttempts: +Math.min(99, 1 / Math.max(pSuccess, 0.01)).toFixed(1) };
}

const bad = n => !n.hit || n.wrong > 0;
const meas = ns => [...new Set(ns.map(n => Math.floor(n.s / 4) + 1))].sort((a, b) => a - b).slice(0, 8);
const where = ns => { const m = meas(ns); return m.length ? ` (mesure${m.length > 1 ? 's' : ''} ${m.join(', ')})` : ''; };

export function diagnoseAttempt(attempt) {
  const notes = (attempt.notes || []).filter(n => n.req);
  if (notes.length < 4) return [];
  const an = annotate(notes), errAll = notes.filter(bad).length / notes.length, out = [];
  const cat = (kind, label, list) => {
    if (list.length < 2) return;
    const b = list.filter(bad), sev = (b.length / list.length - errAll) * Math.sqrt(list.length);
    if (b.length) out.push({ kind, message: `Tu bloques surtout sur ${label}`, measures: meas(b), severity: sev });
  };
  const sel = p => an.filter(p).map(a => a.n);
  cat('bigLeaps', 'tes sauts de plus d\'une octave', sel(a => a.leap > 12));
  cat('leaps', 'tes sauts de plus de 5 demi-tons', sel(a => a.leap > 5 && a.leap <= 12));
  cat('chords', 'les accords', sel(a => a.size >= 2));
  cat('leftHand', 'la main gauche', notes.filter(n => n.h === 'L'));
  cat('rightHand', 'la main droite', notes.filter(n => n.h === 'R'));
  cat('shortNotes', 'les notes courtes (croches et plus rapides)', notes.filter(n => n.d <= 0.51));
  cat('coordination', 'les passages à deux mains', sel(a => a.coord));
  for (const e of out) e.message += where(notes.filter(n => e.measures.includes(Math.floor(n.s / 4) + 1) && bad(n)));
  if (attempt.mode === 'rhythm') {
    for (const [label, test] of [['les croches et notes rapides', n => n.d <= 0.51], ['l\'ensemble du morceau', () => true]]) {
      const l = notes.filter(n => n.hit && n.dt != null && test(n));
      if (l.length < 4) continue;
      const mean = l.reduce((a, n) => a + n.dt, 0) / l.length;
      if (Math.abs(mean) >= 50) {
        const far = l.filter(n => mean < 0 ? n.dt < -40 : n.dt > 40);
        out.push({ kind: mean < 0 ? 'early' : 'late', message: `Tu joues en ${mean < 0 ? 'avance' : 'retard'} sur ${label} (${Math.round(Math.abs(mean))} ms en moyenne)${where(far)}`, measures: meas(far), severity: Math.abs(mean) / 200 * Math.sqrt(l.length) * (label[0] === 'l' && label[1] === '\'' ? 0.8 : 1) });
        break;
      }
    }
  }
  if (attempt.mode === 'wait') {
    const l = notes.filter(n => n.hit && n.dt != null), mean = l.length ? l.reduce((a, n) => a + Math.abs(n.dt), 0) / l.length : 0;
    if (l.length >= 4 && mean > 1200) out.push({ kind: 'hesitation', message: `Tu hésites longtemps avant de jouer (${(mean / 1000).toFixed(1)} s en moyenne)`, measures: meas(l.filter(n => Math.abs(n.dt) > 1200)), severity: (mean - 1200) / 1000 * Math.sqrt(l.length) });
  }
  if (notes.length >= 16) {
    const ss = notes.map(n => n.s).sort((a, b) => a - b), med = ss[ss.length >> 1];
    const f = n => !bad(n) ? 1 : 0, p = l => l.reduce((a, n) => a + f(n), 0) / Math.max(1, l.length);
    const h1 = notes.filter(n => n.s < med), h2 = notes.filter(n => n.s >= med), drop = p(h1) - p(h2);
    if (drop > 0.15) out.push({ kind: 'endurance', message: 'Tu perds en précision dans la seconde moitié du morceau', measures: meas(h2.filter(bad)), severity: drop * Math.sqrt(notes.length / 2) });
  }
  const bn = notes.filter(bad);
  if (bn.length >= 3) { // concentration des erreurs sur 2 mesures voisines
    const cnt = {}; bn.forEach(n => { const m = Math.floor(n.s / 4) + 1; cnt[m] = (cnt[m] || 0) + 1; });
    let best = null; for (const m of Object.keys(cnt).map(Number)) { const c = (cnt[m] || 0) + (cnt[m + 1] || 0); if (!best || c > best.c) best = { m, c }; }
    if (best.c / bn.length >= 0.5) out.push({ kind: 'cluster', message: `Tes erreurs se concentrent sur les mesures ${best.m} à ${best.m + 1}`, measures: [best.m, best.m + 1], severity: best.c / bn.length * Math.sqrt(bn.length) * 0.8 });
  }
  return out.filter(o => o.severity > 0.15).sort((a, b) => b.severity - a.severity).slice(0, 3);
}
