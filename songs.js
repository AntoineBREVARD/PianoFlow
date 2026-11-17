// Morceaux de démo écrits en mini-notation : "E4 E4:2 C3+E3+G3:4 R:1" (durée en temps, R = silence)
import { finalize } from './parsers.js';

const N = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function seq(str, h) {
  const out = []; let t = 0;
  for (const tok of str.replace(/\|/g, ' ').trim().split(/\s+/)) {
    const [pitches, dur = '1'] = tok.split(':'); const d = parseFloat(dur);
    if (pitches !== 'R') for (const p of pitches.split('+')) {
      const m = /^([A-G])([#b]?)(-?\d)$/.exec(p); if (!m) throw new Error('note ' + p);
      out.push({ m: (+m[3] + 1) * 12 + N[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0), s: t, d, h });
    }
    t += d;
  }
  return out;
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
];
