// Morceaux de démo écrits en mini-notation : "E4 E4:2 C3+E3+G3:4 R:1" (durée en temps, R = silence)
import { finalize } from './parsers.js';

const N = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function seq(str, h) {
  const out = []; let t = 0;
  for (const tok0 of str.replace(/\|/g, ' ').trim().split(/\s+/).filter(Boolean)) {
    // syntaxe : NOTE[+NOTE][:durée][^doigt[+doigt]]   ex : C3+G3:4^5+1
    const [tok, fin] = tok0.split('^'); const fs = fin ? fin.split('+').map(Number) : [];
    const [pitches, dur = '1'] = tok.split(':'); const d = parseFloat(dur);
    if (pitches !== 'R') pitches.split('+').forEach((p, i) => {
      const m = /^([A-G])([#b]?)(-?\d)$/.exec(p); if (!m) throw new Error('note ' + p);
      out.push({ m: (+m[3] + 1) * 12 + N[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0), s: t, d, h, f: fs[i] });
    });
    t += d;
  }
  return out;
}
export function compose(title, bpm, rh, lh) {
  return finalize({ title, bpm, raw: [...seq(rh || '', 'R'), ...(lh ? seq(lh, 'L') : [])] });
}
const make = (title, bpm, rh, lh) => ({ id: 'demo-' + title, demo: true, ...finalize({ title, bpm, raw: [...seq(rh, 'R'), ...(lh ? seq(lh, 'L') : [])] }) });

export const DEMOS = [
  make('Twinkle Twinkle (facile)', 90,
    'C4 C4 G4 G4 | A4 A4 G4:2 | F4 F4 E4 E4 | D4 D4 C4:2 | G4 G4 F4 F4 | E4 E4 D4:2 | G4 G4 F4 F4 | E4 E4 D4:2 | C4 C4 G4 G4 | A4 A4 G4:2 | F4 F4 E4 E4 | D4 D4 C4:2'),
  make('Ode à la joie', 100,
    'E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4:1.5 D4:.5 D4:2 | E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4:1.5 C4:.5 C4:2',
    'C3+G3:4 | G2+D3:4 | C3+G3:4 | G2+D3:4 | C3+G3:4 | G2+D3:4 | C3+G3:4 | G2+D3:2 C3+G3:2'),
  make('Frère Jacques', 110,
    'C4 D4 E4 C4 | C4 D4 E4 C4 | E4 F4 G4:2 | E4 F4 G4:2 | G4:.5 A4:.5 G4:.5 F4:.5 E4 C4 | G4:.5 A4:.5 G4:.5 F4:.5 E4 C4 | C4 G3 C4:2 | C4 G3 C4:2',
    'C3:4 | C3:4 | C3:4 | C3:4 | C3:4 | C3:4 | C3:4 | C3:4'),
  make('Joyeux anniversaire', 100,
    'G4:.75 G4:.25 | A4 G4 C5 | B4:2 G4:.75 G4:.25 | A4 G4 D5 | C5:2 G4:.75 G4:.25 | G5 E5 C5 | B4 A4 F5:.75 F5:.25 | E5 C5 D5 | C5:3',
    'R:1 | C3+G3:3 | G2+D3:3 | G2+D3:3 | C3+G3:3 | C3+G3:3 | G2+D3:3 | G2+D3:3 | C3+G3:3'),
  make('Jingle Bells (refrain)', 120,
    'E4 E4 E4:2 | E4 E4 E4:2 | E4 G4 C4:1.5 D4:.5 | E4:4 | F4 F4 F4:1.5 F4:.5 | F4 E4 E4 E4:.5 E4:.5 | E4 D4 D4 E4 | D4:2 G4:2',
    'C3+G3:4 | C3+G3:4 | C3+G3:4 | C3+G3:4 | F2+C3:4 | C3+G3:4 | G2+D3:4 | G2+D3:4'),
  make('Für Elise (début)', 70,
    'E5:.25 D#5:.25 E5:.25 D#5:.25 E5:.25 B4:.25 D5:.25 C5:.25 | A4:.5 R:.25 C4:.25 E4:.25 A4:.25 | B4:.5 R:.25 E4:.25 G#4:.25 B4:.25 | C5:.5 R:.25 E4:.25 E5:.25 D#5:.25 | E5:.25 D#5:.25 E5:.25 B4:.25 D5:.25 C5:.25 | A4:.5 R:.25 C4:.25 E4:.25 A4:.25 | B4:.5 R:.25 E4:.25 C5:.25 B4:.25 | A4:1.5'),
  make('Menuet en Sol (Petzold)', 100,
    'D5:1 G4:.5 A4:.5 B4:.5 C5:.5 | D5 G4 G4 | E5 C5:.5 D5:.5 E5:.5 F#5:.5 | G5 G4 G4',
    'G3+B3:3 | G3+B3:3 | C3+G3:3 | B2+D3:3'),
];
