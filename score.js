// Vue « Partition qui défile » : calculs purs (testés dans test-score.mjs) + dessin canvas.
// Aucun accès au DOM à l'import ni pendant le dessin ; app.js garde toute la logique de jeu.
import { GCLEF, FCLEF } from './reading.js';

/* ---------- calculs purs ---------- */
const SHARP = [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [5, 1], [6, 0]]; // [lettre (Do=0), altération]
const FLAT = [[0, 0], [1, -1], [1, 0], [2, -1], [2, 0], [3, 0], [4, -1], [4, 0], [5, -1], [5, 0], [6, -1], [6, 0]];
export const BOTTOM = { G: 30, F: 18 }; // pas diatoniques de la ligne du bas : Mi4 (Sol) / Sol2 (Fa)

// MIDI -> pas diatonique (Do0 = 0, 7 par octave) + altération (+1 dièse, -1 bémol, 0)
export function spell(m, flats = false) {
  const [l, acc] = (flats ? FLAT : SHARP)[m % 12];
  return { step: (Math.floor(m / 12) - 1) * 7 + l, acc };
}
// demi-pas au-dessus de la ligne du bas de la portée (pair = sur une ligne)
export const posOf = (m, clef, flats = false) => spell(m, flats).step - BOTTOM[clef];
// bémols si le morceau compte plus de Mib/Lab/Sib que de Do#/Fa#
export function preferFlats(notes) {
  let f = 0, s = 0;
  for (const n of notes) { const p = n.m % 12; if (p === 3 || p === 8 || p === 10) f++; else if (p === 1 || p === 6) s++; }
  return f > s;
}
// une seule main -> une portée (clé selon la hauteur médiane) ; deux mains -> Sol (droite) + Fa (gauche)
export function chooseStaves(notes) {
  const l = notes.some(n => n.h === 'L'), r = notes.some(n => n.h !== 'L');
  if (l && r) return ['G', 'F'];
  if (!notes.length) return ['G'];
  const ms = notes.map(n => n.m).sort((a, b) => a - b);
  return [ms[ms.length >> 1] >= 60 ? 'G' : 'F'];
}
export const staffIndex = (h, stv) => stv.length === 1 ? 0 : h === 'L' ? 1 : 0;
// positions des lignes supplémentaires à tracer pour une note
export function ledgerPositions(pos) {
  const out = [];
  for (let p = -2; p >= pos; p -= 2) out.push(p);
  for (let p = 10; p <= pos; p += 2) out.push(p);
  return out;
}
// durée en temps -> figure : hollow (blanche/ronde), stem, flags (crochets), dot (pointée)
const KINDS = new Map();
export function noteKind(d) {
  let b = 0.125; for (const x of [4, 2, 1, 0.5, 0.25]) if (d >= x * 0.85) { b = x; break; }
  const dot = d >= b * 1.3 && b >= 0.25 && b < 4, k = b + (dot ? 'd' : '');
  if (!KINDS.has(k)) KINDS.set(k, { base: b, dot, hollow: b >= 2, stem: b < 4, flags: b >= 1 ? 0 : b >= 0.5 ? 1 : b >= 0.25 ? 2 : 3 });
  return KINDS.get(k);
}
// géométrie : sp = interligne (px), lineX = ligne de lecture (~25 %), bot[i] = y de la ligne du bas de la portée i
export function geometry(W, areaH, n, yMin = 96) {
  const gap = 5, total = n === 2 ? 4 + gap + 4 : 4;
  const avail = Math.max(60, areaH - 8 - yMin), sp = Math.max(6, Math.min(15, avail / (total + 9)));
  const top = yMin + (avail - total * sp) / 2, bot = [top + 4 * sp];
  if (n === 2) bot.push(top + (4 + gap + 4) * sp);
  const clipX = Math.round(8 + 4.2 * sp), lineX = Math.round(Math.max(W * 0.25, clipX + 2.5 * sp));
  return { W, sp, top, bot, clefX: 8 + 1.6 * sp, clipX, lineX, ppb: Math.max(W * 0.105, sp * 3) };
}
// précalcul par note (une fois au lancement) : portée, position, altération, figure, hampe commune pour les accords
export function prepare(notes) {
  const stv = chooseStaves(notes), flats = preferFlats(notes);
  const sc = notes.map(n => {
    const stf = staffIndex(n.h, stv), pos = posOf(n.m, stv[stf], flats);
    return { stf, pos, acc: spell(n.m, flats).acc, k: noteKind(n.d), led: ledgerPositions(pos), up: pos < 4, st: 1, lo: pos, hi: pos };
  });
  for (let i = 0, j; i < notes.length; i = j) { // notes (triées par début) simultanées
    for (j = i; j < notes.length && notes[j].s - notes[i].s < 1e-6; j++);
    for (let f = 0; f < stv.length; f++) {
      let lo = 99, hi = -99, cnt = 0;
      for (let k = i; k < j; k++) if (sc[k].stf === f) { cnt++; lo = Math.min(lo, sc[k].pos); hi = Math.max(hi, sc[k].pos); }
      if (cnt < 2) continue;
      const up = (lo + hi) / 2 < 4; let done = false;
      for (let k = i; k < j; k++) if (sc[k].stf === f) {
        const q = sc[k]; q.lo = lo; q.hi = hi; q.up = up;
        q.st = !done && q.pos === (up ? lo : hi) ? 1 : 0; if (q.st) done = true;
      }
    }
  }
  return { stv, sc };
}

/* ---------- dessin ---------- */
const LINE = 'rgba(203,213,225,.55)', INK = '#e2e8f0', HOLE = '#12163a';
let gPath = null, fPath = null;

// fond statique (portées, barre d'accolade, clés) : appelé une fois par taille d'écran, sur un canvas pré-rendu
export function drawBg(g, sg, stv) {
  const sp = sg.sp, last = stv.length - 1;
  g.strokeStyle = LINE; g.lineWidth = 1.2; g.beginPath();
  for (let i = 0; i <= last; i++) for (let k = 0; k < 5; k++) { const y = Math.round(sg.bot[i] - k * sp) + 0.5; g.moveTo(6, y); g.lineTo(sg.W, y); }
  g.stroke();
  g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(6.5, sg.bot[0] - 4 * sp); g.lineTo(6.5, sg.bot[last]); g.stroke();
  gPath ||= new Path2D(GCLEF); fPath ||= new Path2D(FCLEF);
  for (let i = 0; i <= last; i++) {
    g.save(); g.translate(sg.clefX, sg.bot[i] - (stv[i] === 'G' ? 1 : 3) * sp); g.scale(sp / 10, sp / 10);
    g.strokeStyle = INK; g.fillStyle = INK; g.lineWidth = 3; g.lineCap = g.lineJoin = 'round';
    if (stv[i] === 'G') g.stroke(gPath);
    else { g.stroke(fPath); g.beginPath(); g.arc(-1, 0, 3.5, 0, 7); g.fill(); g.beginPath(); g.arc(19, -5, 2, 0, 7); g.fill(); g.beginPath(); g.arc(19, 5, 2, 0, 7); g.fill(); }
    g.restore();
  }
}

function sharp(c, x, y, sp) {
  c.lineWidth = Math.max(1, sp * 0.13); c.beginPath();
  c.moveTo(x - sp * 0.18, y - sp * 1.05); c.lineTo(x - sp * 0.18, y + sp * 1.2); c.moveTo(x + sp * 0.18, y - sp * 1.2); c.lineTo(x + sp * 0.18, y + sp * 1.05); c.stroke();
  c.lineWidth = Math.max(1.6, sp * 0.24); c.beginPath();
  for (let d = -1; d <= 1; d += 2) { c.moveTo(x - sp * 0.46, y + d * sp * 0.36 + sp * 0.14); c.lineTo(x + sp * 0.46, y + d * sp * 0.36 - sp * 0.14); }
  c.stroke();
}
function flat(c, x, y, sp) {
  c.lineWidth = Math.max(1.2, sp * 0.14); c.beginPath();
  c.moveTo(x - sp * 0.25, y - sp * 1.8); c.lineTo(x - sp * 0.25, y + sp * 0.5);
  c.bezierCurveTo(x + sp * 0.6, y + sp * 0.15, x + sp * 0.6, y - sp * 0.85, x - sp * 0.25, y - sp * 0.4); c.stroke();
}

// E : { now, RM, HAND, HITC, MISSC, GHOSTC, FING, NAMES, names, recall, hintSet, glow(couleur), pulse } fourni par app.js (un seul objet réutilisé)
export function drawScore(c, G, E) {
  const { sg, notes, sc, stv } = G, sp = sg.sp, lx = sg.lineX, ppb = sg.ppb, t = G.t, now = E.now, demo = G.mode === 'demo';
  const nst = stv.length, yTop = sg.bot[0] - 4 * sp, yBot = sg.bot[nst - 1], rx = sp * 0.66, ry = sp * 0.48, half = sp / 2;
  c.save(); c.beginPath(); c.rect(sg.clipX, 0, sg.W - sg.clipX, G.hitY); c.clip();
  // barres de mesure (4 temps) et numéros
  c.strokeStyle = 'rgba(226,232,240,.5)'; c.lineWidth = 1.5; c.beginPath();
  const kMin = Math.max(0, Math.ceil((t - (lx - sg.clipX) / ppb) / 4) * 4);
  for (let k = kMin, x; (x = lx + (k - t) * ppb) < sg.W; k += 4) { const px = Math.round(x) + 0.5; c.moveTo(px, yTop); c.lineTo(px, yBot); }
  c.stroke();
  c.fillStyle = 'rgba(165,180,252,.85)'; c.font = `700 ${Math.max(9, sp * 0.7) | 0}px system-ui`; c.textAlign = 'left';
  for (let k = kMin, x; (x = lx + (k - t) * ppb) < sg.W; k += 4) c.fillText(k / 4 + 1, x + 4, yTop - sp * 0.7);
  // notes visibles : départ par dichotomie, arrêt dès qu'une note est à droite de l'écran
  const lim = t - (lx - sg.clipX + 3 * sp) / ppb, tMax = t + (sg.W - lx + 3 * sp) / ppb;
  let a = 0, b = notes.length; while (a < b) { const mid = (a + b) >> 1; if (notes[mid].s < lim) a = mid + 1; else b = mid; }
  const fr = Math.max(6.5, sp * 0.52);
  for (let i = a; i < notes.length; i++) {
    const n = notes[i]; if (n.s > tMax) break;
    const q = sc[i], x = lx + (n.s - t) * ppb, base = sg.bot[q.stf], y = base - q.pos * half;
    const P = n.hit ? E.HITC : n.miss ? E.MISSC : !n.req ? E.GHOSTC : (E.HAND[n.h] || E.HAND.R), live = n.req && !n.hit && !n.miss;
    if (n.s <= t && t < n.s + n.d && (!n.req || demo || n.hit)) { G.kl[n.m] = now; G.kh[n.m] = n.h; } // touche allumée pendant la note
    const al = (n.hit && !demo ? Math.max(0.25, 1 - (t - n.s) * 1.5) : E.recall && !n.hit && !demo ? 0.15 : 1) * (n.req || demo ? 1 : 0.5);
    if (live && E.hintSet.has(n.m) && Math.abs(n.s - t) < 0.5) { c.globalAlpha = al * 0.55; const g = sp * 4.2; c.drawImage(E.glow(P.b), x - g / 2, y - g / 2, g, g); }
    c.globalAlpha = al; c.strokeStyle = INK; c.lineWidth = 1.4;
    if (q.led.length) { c.beginPath(); for (let j = 0; j < q.led.length; j++) { const ly = base - q.led[j] * half; c.moveTo(x - sp * 1.0, ly); c.lineTo(x + sp * 1.0, ly); } c.stroke(); }
    if (q.acc) { c.strokeStyle = P.b; if (q.acc > 0) sharp(c, x - sp * 1.35, y, sp); else flat(c, x - sp * 1.3, y, sp); }
    c.beginPath(); c.ellipse(x, y, rx, ry, -0.38, 0, 7);
    if (q.k.hollow) { c.fillStyle = HOLE; c.fill(); c.lineWidth = sp * 0.2; c.strokeStyle = P.b; c.stroke(); }
    else { c.fillStyle = P.b; c.fill(); c.lineWidth = 1; c.strokeStyle = P.l; c.stroke(); }
    if (q.st && q.k.stem) { // hampe (une pour tout l'accord), crochets
      const sx = q.up ? x + rx - 0.6 : x - rx + 0.6, d = q.up ? -1 : 1;
      const endPos = q.up ? Math.max(q.hi + 6.6, 4) : Math.min(q.lo - 6.6, 4), ey = base - endPos * half;
      c.strokeStyle = P.b; c.lineWidth = Math.max(1.3, sp * 0.12); c.beginPath(); c.moveTo(sx, y); c.lineTo(sx, ey); c.stroke();
      if (q.k.flags) {
        c.lineWidth = Math.max(1.6, sp * 0.2); c.beginPath();
        for (let f = 0; f < q.k.flags; f++) { const fy = ey - d * f * sp * 0.6; c.moveTo(sx, fy); c.quadraticCurveTo(sx + sp * 0.9, fy - d * sp * 0.9, sx + sp * 0.55, fy - d * sp * 1.9); }
        c.stroke();
      }
    }
    if (q.k.dot) { c.fillStyle = P.b; c.beginPath(); c.arc(x + rx + sp * 0.5, y - (q.pos & 1 ? 0 : half), Math.max(1.4, sp * 0.14), 0, 7); c.fill(); }
    const chord = q.lo !== q.hi, side = q.up ? 1 : -1; // doigté / nom du côté opposé à la hampe (accords : doigté à côté de la tête)
    let dy = chord ? 0 : side * sp * 1.75;
    if (n.f) {
      const fx = chord ? x + (q.up ? -sp * 2.3 - (q.acc ? sp * 0.8 : 0) : sp * 1.7) : x, fy = y + dy;
      c.globalAlpha = al; c.fillStyle = E.FING[n.f] || '#fff'; c.beginPath(); c.arc(fx, fy, fr, 0, 7); c.fill();
      c.fillStyle = '#0b0e22'; c.font = `800 ${Math.max(9, fr * 1.25) | 0}px system-ui`; c.textAlign = 'center'; c.fillText(n.f, fx, fy + fr * 0.4);
      dy += side * (fr + sp * 0.75);
    } else if (!chord) dy = side * sp * 1.2;
    if (E.names && !chord) {
      c.fillStyle = 'rgba(226,232,240,.85)'; c.font = `700 ${Math.max(9, sp * 0.62) | 0}px system-ui`; c.textAlign = 'center';
      c.fillText(E.NAMES[n.m % 12], x, y + dy + sp * 0.25);
    }
  }
  c.globalAlpha = 1; c.restore();
  // ligne de lecture
  c.fillStyle = '#7dd3fc'; c.globalAlpha = 0.1 + E.pulse * 0.12; c.fillRect(lx - sp * 0.9, yTop - sp * 1.6, sp * 1.8, yBot - yTop + sp * 3.2);
  c.globalAlpha = 0.9; c.fillStyle = 'rgba(224,242,254,.9)'; c.fillRect(lx - 1.25, yTop - sp * 1.6, 2.5, yBot - yTop + sp * 3.2); c.globalAlpha = 1;
}
