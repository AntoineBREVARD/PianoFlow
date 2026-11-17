// PianoFlow - exercices ciblés sur les faiblesses du modèle de niveau (fonctions pures, sans DOM).
// drillFor(dim, level 0..3) -> morceau { id, title, bpm, notes[, tempos], dim, level, mode, speed, explain }
// recommend(analysis) -> 3 exercices prioritaires ; targetLessons(analysis, ALL) -> leçons du cours à revoir.
// HEURISTIQUES : les motifs et paliers de difficulté sont posés a priori, non validés sur de vrais élèves.
import { compose, seq } from './songs.js';
import { finalize } from './parsers.js';

export const LABELS = {
  pitch: 'Lecture des notes', rhythm: 'Rythme', timing: 'Précision du timing', leftHand: 'Main gauche', rightHand: 'Main droite',
  coordination: 'Coordination des deux mains', leaps: 'Sauts', chords: 'Accords', tempo: 'Vitesse', endurance: 'Endurance', hesitation: 'Réactivité',
};
const NM = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'], MAJ = [0, 2, 4, 5, 7, 9, 11];
const nn = m => NM[m % 12] + (Math.floor(m / 12) - 1);
const scale = (s, n) => Array.from({ length: n }, (_, i) => s + 12 * Math.floor(i / 7) + MAJ[i % 7]);
const updown = a => [...a, ...a.slice(0, -1).reverse()];
const line = (ms, d = 1) => ms.map(m => nn(m) + (d === 1 ? '' : ':' + d)).join(' ');
const rep = (s, n) => Array(n).fill(s).join(' ');
const chord = ms => ms.map(nn).join('+');
const BPM = [60, 70, 80, 92];
export const levelFromScore = s => (s < 25 ? 0 : s < 45 ? 1 : s < 65 ? 2 : 3);

// triades compactes (position serrée autour de Do4) ; progression C - F - G - Am
const TRI = { C: [60, 64, 67], F: [60, 65, 69], G: [59, 62, 67], Am: [60, 64, 69] };
const LHC = { C: [36, 43], F: [41, 48], G: [43, 50], Am: [45, 52] };

// Chaque générateur renvoie { rh, lh, explain, mode?, speed?, tempos?, bpm? } pour le niveau l (0..3).
const GEN = {
  leaps: l => ({
    rh: [[7, 8, 9], [9, 10, 12], [12, 14, 16], [16, 19, 21, 24]][l].map(j => rep(`${nn(57)} ${nn(57 + j)}`, 2)).join(' | '),
    explain: 'Deux notes éloignées, répétées, avec des sauts de plus en plus grands. Garde la main souple et vise la touche sans regarder tes doigts.',
  }),
  leftHand: l => ({
    lh: l < 2 ? line(updown(scale(48, [5, 8][l]))) : line(updown(scale(36, 15)), l === 3 ? 0.5 : 1),
    explain: 'Gammes de Do à la main gauche seule : 5 notes, puis l\'octave, puis deux octaves, enfin en croches. Le pouce est en haut : 5-4-3-2-1.',
  }),
  rightHand: l => ({
    rh: l < 2 ? line(updown(scale(60, [5, 8][l]))) : line(updown(scale(60, 15)), l === 3 ? 0.5 : 1),
    explain: 'Gammes de Do à la main droite seule : 5 notes, puis l\'octave, puis deux octaves, enfin en croches. Garde un son régulier.',
  }),
  coordination: l => {
    const up = scale(60, 5), dn = scale(48, 5), sc = scale(60, 8);
    if (l === 0) return { rh: line(updown(up), 1), lh: line(updown(dn), 1), explain: 'Les deux mains jouent la même gamme à l\'octave, exactement ensemble : c\'est la base de la coordination.' };
    if (l === 1) return { rh: line(updown(up), 2), lh: 'R:1 ' + line(updown(dn), 2), explain: 'Canon : la main gauche reprend la même mélodie un temps plus tard. Les deux mains ne tombent plus ensemble.' };
    if (l === 2) return { rh: line(updown(sc), 1), lh: 'R:.5 ' + line(updown(scale(48, 8)), 1), explain: 'Canon serré : la main gauche suit la droite avec un demi-temps de retard, sur toute la gamme.' };
    return { rh: line(updown(sc), 0.5), lh: line(scale(48, 8).reverse()), explain: 'Mains opposées : la droite monte en croches pendant que la gauche descend en noires. Chaque main garde sa propre pulsation.' };
  },
  chords: l => {
    const P = l < 1 ? ['C', 'F', 'G', 'C'] : ['C', 'F', 'G', 'Am', 'C', 'F', 'G', 'C'], d = l === 0 ? 2 : 1;
    const rh = P.map(c => chord(l === 3 ? [...TRI[c], TRI[c][0] + 12] : TRI[c]) + (d === 1 ? '' : ':' + d)).join(' ');
    const lh = l >= 2 ? P.map(c => chord(LHC[c]) + (d === 1 ? '' : ':' + d)).join(' ') : null;
    return { rh, lh, explain: 'Enchaînement C - F - G - Am : prépare la forme de l\'accord avant de le jouer et pose tous les doigts ensemble. Les paliers ajoutent des accords, la main gauche, puis les octaves.' };
  },
  rhythm: l => ({
    rh: ['C4 C4 C4:2 | C4 C4 C4:2 | C4:2 C4 C4 | C4:4', 'C4 C4:.5 C4:.5 C4 C4 | C4:.5 C4:.5 C4:.5 C4:.5 C4:2 | C4 C4:.5 C4:.5 C4:2 | C4:4',
      'C4:1.5 C4:.5 C4 C4 | C4:.5 C4:.5 C4:1 C4:.5 C4:.5 C4 | C4:1.5 C4:.5 C4:2 | C4:4', 'C4:.5 C4:1 C4:.5 C4:1 C4:1 | C4:.5 C4:1 C4:.5 C4:1.5 C4:.5 | R:.5 C4:1 C4:.5 C4:1 C4:1 | C4:.5 C4:1 C4:.5 C4:2'][l],
    mode: 'rhythm', speed: 0.8, explain: 'Une seule note, pour ne penser qu\'au rythme : noires et blanches, puis croches, puis notes pointées, enfin syncopes. Compte à voix haute.',
  }),
  timing: l => ({
    rh: [rep('C4:2', 8), 'C4 R:1 C4 R:1 C4 C4 R:1 C4 | C4 R:1 C4 R:1 C4 C4 R:1 C4', rep('C4 C4:.5 C4:.5 C4 C4', 3), rep('C4:.5', 16)][l],
    mode: 'rhythm', speed: 0.8, explain: 'Pulsations régulières sur une seule note, comme un métronome : un temps sur deux, puis sur chaque temps avec des silences, puis avec des croches, enfin en croches continues. Écoute si tu es en avance ou en retard.',
  }),
  tempo: l => {
    const base = BPM[l], m = line([60, 62, 64, 67, 64, 62, 60, 62, 64, 67, 69, 67, 64, 62, 60, 60]), step = [1.1, 1.15, 1.2, 1.3][l];
    return { rh: [m, m, m, m].join(' '), bpm: base, tempos: [0, 1, 2, 3].map(i => [i * 16, Math.round(base * step ** i)]), mode: 'rhythm', speed: 0.8,
      explain: 'Le même motif joué quatre fois, de plus en plus vite. Ne monte d\'un palier que quand le précédent est propre.' };
  },
  pitch: l => {
    const iv = [[2, 3, 2, 4], [2, 4, 5, 3, 7], [3, 5, 7, 4, 9, 6], [1, 6, 8, 11, 5, 13, 10]][l], ms = [60];
    let cur = 60, dir = 1;
    for (const i of [...iv, ...iv]) { let nx = cur + dir * i; if (nx < 55 || nx > 80) { dir = -dir; nx = cur + dir * i; } ms.push(nx); cur = nx; dir = -dir; }
    return { rh: line(ms), explain: 'Des intervalles variés (secondes, tierces, quintes, septièmes...), touches noires comprises à partir du palier 3. Nomme chaque note avant de la jouer.' };
  },
  hesitation: l => {
    const [lo, n] = [[60, 5], [60, 8], [57, 11], [55, 15]][l], pool = scale(lo, n); let x = 7 + l, prev = -1; const ms = [];
    while (ms.length < 16) { x = (x * 17 + 11) % 97; const i = x % pool.length; if (i !== prev) { ms.push(pool[i]); prev = i; } }
    return { rh: line(ms), mode: 'wait', explain: 'Notes dans le désordre, pour reconnaître chaque touche très vite. Le morceau t\'attend : vise une réponse immédiate, sans tâtonner.' };
  },
  endurance: l => {
    const ph = line([60, 62, 64, 65, 67, 65, 64, 62]) + ' ' + line([64, 65, 67, 69, 67, 65, 64, 62]) + ' ' + line([60, 64, 67, 64, 60, 67, 64, 60], l >= 2 ? 0.5 : 1);
    const r = [2, 3, 4, 5][l];
    return { rh: rep(ph, r), lh: l === 3 ? rep(`C3+G3:4 G2+D3:4 C3+G3:4 G2+D3:4`, r * 2).split(' ').slice(0, r * 8).join(' ') : null,
      explain: 'Une longue phrase qui se répète, de plus en plus de fois. Garde la même attention jusqu\'à la dernière note : respire, relâche les épaules.' };
  },
};
export const DRILL_DIMS = Object.keys(GEN);

export function drillFor(dim, level = 0) {
  const g = GEN[dim];
  if (!g) throw new Error('dimension inconnue : ' + dim);
  const l = Math.min(3, Math.max(0, Math.round(Number.isFinite(level) ? level : 0)));
  const x = g(l), title = `${LABELS[dim]} · palier ${l + 1}/4`, bpm = x.bpm || BPM[l];
  const song = x.tempos
    ? finalize({ title, bpm, tempos: x.tempos, raw: seq(x.rh, 'R') })
    : compose(title, bpm, x.rh, x.lh);
  return { ...song, id: `drill-${dim}-${l}`, dim, level: l, mode: x.mode || 'wait', ...(x.speed ? { speed: x.speed } : {}), explain: x.explain };
}

const DEFAULT = ['pitch', 'rhythm', 'rightHand'];
export function recommend(analysis) {
  const dims = analysis?.dims || {}, sc = d => dims[d]?.score ?? 50, cf = d => dims[d]?.confidence ?? 0;
  const known = DRILL_DIMS.filter(d => cf(d) >= 0.2).sort((a, b) => sc(a) - sc(b));
  const rest = DRILL_DIMS.filter(d => cf(d) < 0.2).sort((a, b) => cf(b) - cf(a) || DEFAULT.indexOf(b) - DEFAULT.indexOf(a));
  const advice = new Map((analysis?.weaknesses || []).map(w => [w.dim, w.advice]));
  return [...known, ...rest].slice(0, 3).map(d => {
    const known_ = cf(d) >= 0.2, s = sc(d);
    return {
      dim: d, label: LABELS[d], score: s, level: levelFromScore(s), song: drillFor(d, levelFromScore(s)),
      reason: known_ ? `${LABELS[d]} est ton point le plus fragile en ce moment (${s}/100). ${advice.get(d) || ''}`.trim()
        : `On manque de données sur « ${LABELS[d]} » : cet exercice sert aussi à mieux l'évaluer.`,
    };
  });
}

const KEYS = {
  pitch: /clavier|lecture|portée|clé|intervalle|Do – Ré/i, rhythm: /croche|noire|silence|syncope|pointée|mesure|rythme/i, timing: /pouls|pulsation|noire|rythme/i,
  leftHand: /main gauche|clé de fa|basse/i, rightHand: /main droite|gamme/i, coordination: /deux mains|croisement|ensemble/i,
  leaps: /saut|arpège|croisement|octave/i, chords: /accord|grille|arpège|septième/i, tempo: /gamme|étude|vitesse/i,
  endurance: /étude|canon|blues|classique|Ode|Für/i, hesitation: /lecture|portée|clé|intervalle|clavier/i,
};
// Leçons les plus pertinentes pour une dimension ; proches du niveau global du joueur (échelle 0..9).
export function lessonsFor(dim, ALL, overall = 30, n = 3) {
  const re = KEYS[dim], target = Math.min(9, Math.round(overall / 10));
  if (!re) return [];
  return ALL.map(l => ({ l, s: (re.test(l.title) ? 2 : 0) + (re.test(l.intro || '') ? 1 : 0) - Math.abs(l.level - target) * 0.3 }))
    .filter(x => re.test(x.l.title + ' ' + (x.l.intro || ''))).sort((a, b) => b.s - a.s).slice(0, n).map(x => x.l);
}

export function targetLessons(analysis, ALL) {
  const ov = analysis?.overall?.score ?? 30;
  return recommend(analysis).map(r => ({ dim: r.dim, label: r.label, lessons: lessonsFor(r.dim, ALL, ov) }));
}
