// Test de placement : données + calcul pur (aucun DOM). answers = tableau de booléens (réponse juste ?).
// hl = index de la touche blanche surlignée (0 = Do … 6 = Si) dans le mini clavier d'une octave.
export const QUESTIONS = [
  { q: 'Sur ce clavier, quelle est la touche colorée ? (elle est juste à gauche du groupe de 2 touches noires)', hl: 0, choices: ['Do', 'Mi', 'Fa', 'La'], ok: 0 },
  { q: 'Et celle-ci ? (elle est juste à gauche du groupe de 3 touches noires)', hl: 3, choices: ['Ré', 'Fa', 'Si', 'Sol'], ok: 1 },
  { q: 'Je joue une note, puis une autre située plus à droite sur le clavier. Que s\'entend-il ?', choices: ['Ça monte (plus aigu)', 'Ça descend (plus grave)', 'Ça ne change pas'], ok: 0 },
  { q: 'On compte « 1 – 2 – 3, 1 – 2 – 3 » comme dans une valse. Combien y a-t-il de temps dans chaque groupe ?', choices: ['2', '3', '4'], ok: 1 },
  { q: 'En général, quelle main joue les notes les plus graves ?', choices: ['La main droite', 'La main gauche', 'Ça n\'a pas d\'importance'], ok: 1 },
];
// 0-1 juste → niveau 1 ; puis 2→2, 3→3, 4→5, 5→6. Jamais éliminatoire : c'est un conseil.
const MAP = [1, 1, 2, 3, 5, 6];
export const placementLevel = answers => MAP[Math.min(answers.filter(Boolean).length, MAP.length - 1)];
