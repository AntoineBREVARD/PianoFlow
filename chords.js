// Accords (lettres américaines) : données, questions, validation, révision espacée (Leitner). Pur, sans DOM.
const mk = (sym, name, notes, bass) => ({ sym, name, notes, ...(bass == null ? {} : { bass }) });
// Ordre = progression par paliers (C F G · Am Dm Em · G7 C7 D A E · Bm · Cmaj7 Fmaj7 · Bb Eb · renversements)
export const CHORDS = [
  mk('C', 'Do majeur', [60, 64, 67]), mk('F', 'Fa majeur', [60, 65, 69]), mk('G', 'Sol majeur', [59, 62, 67]),
  mk('Am', 'La mineur', [57, 60, 64]), mk('Dm', 'Ré mineur', [62, 65, 69]), mk('Em', 'Mi mineur', [64, 67, 71]),
  mk('G7', 'Sol septième', [55, 59, 62, 65]), mk('C7', 'Do septième', [60, 64, 67, 70]), mk('D', 'Ré majeur', [62, 66, 69]),
  mk('A', 'La majeur', [57, 61, 64]), mk('E', 'Mi majeur', [64, 68, 71]), mk('Bm', 'Si mineur', [59, 62, 66]),
  mk('Cmaj7', 'Do septième majeure', [60, 64, 67, 71]), mk('Fmaj7', 'Fa septième majeure', [60, 64, 65, 69]),
  mk('Bb', 'Si bémol majeur', [58, 62, 65]), mk('Eb', 'Mi bémol majeur', [63, 67, 70]),
  mk('C/E', 'Do, 1er renversement', [64, 67, 72], 4), mk('C/G', 'Do, 2e renversement', [67, 72, 76], 7),
  mk('F/A', 'Fa, 1er renversement', [57, 60, 65], 9), mk('F/C', 'Fa, 2e renversement', [60, 65, 69], 0),
  mk('G/B', 'Sol, 1er renversement', [59, 62, 67], 11), mk('G/D', 'Sol, 2e renversement', [62, 67, 71], 2),
];
const PC = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export const noteName = m => PC[((m % 12) + 12) % 12];
export const INTERVALS = [1, 3, 7, 14, 30]; // jours, par boîte 0-4
const DAY = 864e5, FAST_MS = 8000;
const pcs = a => new Set(a.map(m => ((m % 12) + 12) % 12));

// Validation : mêmes classes de hauteur que l'accord (octave libre) ; renversement : la note la plus grave est imposée.
export function validate(chord, played) {
  if (!played.length) return false;
  const a = pcs(chord.notes), b = pcs(played);
  if (a.size !== b.size || [...a].some(x => !b.has(x))) return false;
  return chord.bass == null || ((Math.min(...played) % 12) + 12) % 12 === chord.bass;
}
export function question(chord) {
  const root = chord.bass != null ? noteName(chord.bass) : chord.sym.match(/^[A-G][b#]?/)[0];
  return { chord, sym: chord.sym, name: chord.name, root, size: chord.notes.length, names: chord.notes.map(noteName) };
}

// État : { cards: { sym: { box, due, seen } } }
// Jour local AAAA-MM-JJ (même format que dkey de learn.js) : clé de date unique de l'entraînement
export const dkey = (d = new Date()) => d.toLocaleDateString('sv');
// boîte Leitner valide : entier 0-4 (une carte corrompue retombe en 0)
export const clampBox = b => Number.isFinite(+b) ? Math.min(4, Math.max(0, Math.trunc(+b))) : 0;
const card = (st, sym) => { const c = st.cards?.[sym]; return c && typeof c === 'object' ? c : null; };
export const boxOf = (st, sym) => { const c = card(st, sym); return c ? clampBox(c.box) : -1; };
// Débloquage : 2 accords au départ, puis 2 de plus chaque fois que tous les accords débloqués sont en boîte >= 2.
export function unlocked(st) {
  let n = st.n || 2; // cliquet : un accord débloqué le reste, même après une erreur
  while (n < CHORDS.length && CHORDS.slice(0, n).every(c => boxOf(st, c.sym) >= 2)) n += 2;
  st.n = n;
  return CHORDS.slice(0, n);
}
export function schedule(st, sym, correct, fast, now = Date.now()) {
  if (!st.cards || typeof st.cards !== 'object') st.cards = {};
  const cards = st.cards, c = card(st, sym) || (cards[sym] = { box: 0, due: 0, seen: 0 });
  c.box = clampBox(c.box); c.seen = (+c.seen || 0) + 1; unlocked(st); // fige les débloquages avant une éventuelle rechute en boîte 0
  c.box = !correct ? 0 : fast ? Math.min(4, c.box + 1) : c.box;
  c.due = now + INTERVALS[c.box] * DAY;
  return c.box;
}
export const isFast = ms => ms <= FAST_MS;
const shuffle = (a, rnd) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// Série de n questions : nouveaux (max 3) + à réviser, complétés par des accords débloqués au hasard.
export function session(st, now = Date.now(), n = 8, rnd = Math.random) {
  const u = unlocked(st), cd = c => card(st, c.sym);
  const fresh = u.filter(c => !cd(c)).slice(0, 3);
  const due = u.filter(c => cd(c) && !(cd(c).due > now)).sort((a, b) => cd(a).due - cd(b).due);
  const q = [...fresh, ...due].slice(0, n);
  while (q.length < n) q.push(u[Math.floor(rnd() * u.length)]);
  return shuffle(q, rnd);
}
export const mastered = st => CHORDS.filter(c => boxOf(st, c.sym) >= 3);
