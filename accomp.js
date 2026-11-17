// Accompagnement léger : basse (fondamentale temps 1 et 3) + hi-hat/clap très discrets. Fonctions pures + petit moteur planifié sur l'horloge audio.
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const hz = m => 440 * 2 ** ((m - 69) / 12);
// nombre de temps par mesure depuis '4/4', '3/4', '6/8' ou [n, d] (noires)
export function beatsPerBar(timeSig = '4/4') {
  const [n, d] = Array.isArray(timeSig) ? timeSig : String(timeSig).split('/').map(Number);
  return n > 0 && d > 0 ? n * 4 / d : 4;
}
// motif d'une mesure : [{ b (temps dans la mesure), kind: 'hat' | 'clap' }] ; hi-hat à chaque demi-temps, clap sur les temps pairs (2 et 4)
export function pattern(timeSig = '4/4') {
  const n = Math.max(1, Math.round(beatsPerBar(timeSig))), out = [];
  for (let i = 0; i < n; i++) {
    out.push({ b: i, kind: i % 2 ? 'clap' : 'hat' }, { b: i + 0.5, kind: 'hat' });
  }
  return out;
}
// basse : par mesure, fondamentale = note la plus grave de la main gauche qui démarre dans la mesure (ramenée entre 28 et 52), jouée sur le temps 1 et le temps 3.
// notes : [[m, s, d, hand]] ou [{ m, s, d, h }] ; grid (optionnelle) : [{ s, m }] racines imposées (s en temps) ; bpm sert à exprimer la durée en secondes (t, dt).
export function bassLine(notes, bpm = 100, { grid, timeSig = '4/4', from = 0, to } = {}) {
  const bar = beatsPerBar(timeSig), sec = 60 / (bpm || 100), roots = [];
  const fold = m => { while (m > 52) m -= 12; while (m < 28) m += 12; return m; };
  if (grid?.length) for (const g of grid) roots.push({ s: g.s, m: fold(g.m) });
  else {
    const lh = (notes || []).map(n => Array.isArray(n) ? { m: n[0], s: n[1], h: n[3] } : n).filter(n => n.h === 'L');
    const byBar = new Map();
    for (const n of lh) { const k = Math.floor(n.s / bar + 1e-6); if (!byBar.has(k) || n.m < byBar.get(k)) byBar.set(k, n.m); }
    for (const [k, m] of byBar) roots.push({ s: k * bar, m: fold(m) });
    roots.sort((a, b) => a.s - b.s);
  }
  const out = [];
  const end = to ?? Math.max(0, ...(notes || []).map(n => (Array.isArray(n) ? n[1] + n[2] : n.s + n.d)));
  for (let i = 0; i < roots.length; i++) {
    const r = roots[i], next = i + 1 < roots.length ? roots[i + 1].s : Math.max(end, r.s + bar);
    const offs = bar >= 4 ? [0, 2] : [0];
    for (const o of offs) {
      const s = r.s + o;
      if (s < from || s >= next - 1e-6) continue;
      out.push({ kind: 'bass', m: r.m, s, d: Math.min(2, next - s) * 0.9, t: s * sec });
    }
  }
  return out;
}
// tous les évènements triés : basse toujours, percussions seulement si rhythm
export function events(notes, bpm, { rhythm = false, ...o } = {}) {
  const ev = bassLine(notes, bpm, o);
  if (rhythm) {
    const end = Math.max(0, ...(notes || []).map(n => (Array.isArray(n) ? n[1] + n[2] : n.s + n.d))), bar = beatsPerBar(o.timeSig), p = pattern(o.timeSig);
    for (let k = Math.floor((o.from || 0) / bar); k * bar < end; k++) for (const x of p) { const s = k * bar + x.b; if (s >= (o.from || 0)) ev.push({ kind: x.kind, s }); }
  }
  return ev.sort((a, b) => a.s - b.s);
}

// moteur : tick(tBeats, beatsPerSecond) à appeler souvent (chaque image) ; planifie ~150 ms à l'avance sur l'horloge audio.
export function createAccomp(ac, dest, evs, { volume = 0.5, lookahead = 0.15 } = {}) {
  const out = ac.createGain(); out.gain.value = clamp(volume, 0, 1) * 0.5; out.connect(dest);
  let i = 0, noise = null, stopped = false; const live = [];
  const nbuf = () => noise || (noise = (() => { const b = ac.createBuffer(1, ac.sampleRate * 0.1 | 0, ac.sampleRate), d = b.getChannelData(0); for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1; return b; })());
  function play(e, when, secPerBeat) {
    if (e.kind === 'bass') {
      const o = ac.createOscillator(), g = ac.createGain(), dur = Math.max(0.15, e.d * secPerBeat);
      o.type = 'triangle'; o.frequency.value = hz(e.m);
      g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(0.35, when + 0.015); g.gain.setTargetAtTime(0, when + dur * 0.7, 0.08);
      o.connect(g); g.connect(out); o.start(when); o.stop(when + dur + 0.6); live.push(o);
    } else {
      const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), clap = e.kind === 'clap';
      s.buffer = nbuf(); f.type = 'highpass'; f.frequency.value = clap ? 1500 : 7000;
      g.gain.setValueAtTime(clap ? 0.12 : 0.06, when); g.gain.exponentialRampToValueAtTime(0.0001, when + (clap ? 0.09 : 0.04));
      s.connect(f); f.connect(g); g.connect(out); s.start(when); s.stop(when + 0.1);
    }
  }
  return {
    tick(tBeats, bps) {
      if (stopped || !(bps > 0)) return;
      const now = ac.currentTime, spb = 1 / bps;
      while (i < evs.length && evs[i].s < tBeats - 0.02) i++;        // évènements déjà passés (ou saut) : ignorés
      while (i < evs.length && evs[i].s < tBeats + lookahead * bps) { play(evs[i], now + Math.max(0, (evs[i].s - tBeats) * spb), spb); i++; }
    },
    seek() { i = 0; },
    setVolume(v) { out.gain.value = clamp(v, 0, 1) * 0.5; },
    stop() { stopped = true; for (const o of live) try { o.stop(); } catch {} out.disconnect(); },
  };
}
