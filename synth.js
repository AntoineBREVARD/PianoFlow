// Synthé piano WebAudio sans fichiers audio : partiels inharmoniques + cordes désaccordées + bruit de marteau.
const MAX_VOICES = 32;
const hz = m => 440 * 2 ** ((m - 69) / 12);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// Partiels d'une note : [{ n, freq, amp, tau, detune }]. amp relative (somme ~1), tau = constante de décroissance (s).
export function partials(midi, velocity = 0.8) {
  const f0 = hz(midi), v = clamp(velocity, 0, 1);
  const B = clamp(1e-4 * 2 ** ((midi - 60) / 14), 2e-5, 4e-3);          // inharmonicité
  const N = midi < 48 ? 10 : midi < 72 ? 7 : midi < 96 ? 4 : 3;
  const T = 0.5 + 7 * 2 ** (-(midi - 36) / 16);                         // durée du fondamental (grave long, aigu court)
  const bright = 0.35 + 1.15 * v;                                       // plus fort = plus brillant
  const out = [];
  let sum = 0;
  for (let n = 1; n <= N; n++) {
    const freq = n * f0 * Math.sqrt(1 + B * n * n);
    if (freq > 12000) break;
    const amp = Math.exp(-(n - 1) * (1.9 - bright) * 0.55) / n ** 0.6;
    const tau = T / (1 + 0.7 * (n - 1) ** 1.2) / 2.2;
    // 2 cordes légèrement désaccordées sur les 2 premiers partiels (battements)
    const d = (0.6 + 0.5 * ((midi * 7) % 3)) * (n === 1 ? 1 : 1.5);
    if (n <= 2) { out.push({ n, freq, amp: amp / 2, tau, detune: -d }, { n, freq, amp: amp / 2, tau, detune: d }); }
    else out.push({ n, freq, amp, tau, detune: 0 });
    sum += amp;
  }
  for (const p of out) p.amp /= sum;
  return out;
}

// Enveloppe globale : attaque, double exponentielle (fast -> slow), relâchement avec étouffoir.
export function envelope(midi, velocity = 0.8) {
  const v = clamp(velocity, 0, 1);
  const T = 0.5 + 7 * 2 ** (-(midi - 36) / 16);
  return {
    attack: 0.003 + 0.003 * (1 - v),            // 3 à 6 ms
    peak: 0.22 * (0.15 + 0.85 * v ** 1.4) * (midi < 40 ? 0.85 : 1),
    tauFast: 0.25 + 0.05 * T,                   // chute initiale rapide
    level: 0.45,                                // niveau atteint avant la queue lente
    tauSlow: T,                                 // queue longue
    release: clamp(0.18 - (midi - 36) * 0.0022, 0.05, 0.18),
  };
}

export function createSynth(ac, destination) {
  const out = ac.createGain(), lim = ac.createDynamicsCompressor(); out.gain.value = 0.8;
  lim.threshold.value = -10; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = 0.002; lim.release.value = 0.15;
  out.connect(lim); lim.connect(destination);
  let noise = null;
  const noiseBuf = () => noise || (noise = (() => {
    const b = ac.createBuffer(1, Math.ceil(ac.sampleRate * 0.05), ac.sampleRate), d = b.getChannelData(0);
    let s = 1; for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = s / 1073741823 - 1; }
    return b;
  })());
  let voices = [], sustain = false;

  function kill(v, when, rel) {
    if (v.dead) return; v.dead = true;
    const g = v.gain.gain, t = Math.max(when, ac.currentTime);
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.setTargetAtTime(0, t, rel);
    v.oscs.forEach(o => { try { o.stop(t + rel * 8); } catch {} });
  }
  function release(v, when) { kill(v, when, v.env.release); }

  function on(midi, velocity = 0.8, when = ac.currentTime) {
    if (voices.length >= MAX_VOICES) { const old = voices.find(x => !x.dead) || voices[0]; kill(old, when, 0.03); voices = voices.filter(x => x !== old); }
    const env = envelope(midi, velocity), ps = partials(midi, velocity);
    const gain = ac.createGain(), nodes = [gain], oscs = [];
    const t0 = when, t1 = t0 + env.attack;
    const g = gain.gain;
    g.setValueAtTime(0, t0);
    g.linearRampToValueAtTime(env.peak, t1);
    g.setTargetAtTime(env.peak * env.level, t1, env.tauFast);
    g.setTargetAtTime(0.0001, t1 + env.tauFast * 3, env.tauSlow);
    gain.connect(out);
    for (const p of ps) {
      const o = ac.createOscillator(), pg = ac.createGain();
      o.type = 'sine'; o.frequency.value = p.freq; o.detune.value = p.detune;
      pg.gain.setValueAtTime(p.amp, t0);
      pg.gain.setTargetAtTime(p.amp * 0.15, t1, p.tau);                 // partiels hauts s'éteignent plus vite
      o.connect(pg); pg.connect(gain); o.start(t0); o.stop(t0 + 20);
      oscs.push(o); nodes.push(o, pg);
    }
    // bruit de marteau : très bref, filtré
    const ns = ac.createBufferSource(), bp = ac.createBiquadFilter(), ng = ac.createGain();
    ns.buffer = noiseBuf(); bp.type = 'bandpass'; bp.frequency.value = clamp(hz(midi) * 3, 600, 5000); bp.Q.value = 0.8;
    ng.gain.setValueAtTime(env.peak * 0.5 * velocity, t0); ng.gain.setTargetAtTime(0, t0, 0.006);
    ns.connect(bp); bp.connect(ng); ng.connect(gain); ns.start(t0); nodes.push(ns, bp, ng);
    const v = { midi, gain, oscs, env, dead: false, held: false };
    oscs[0].onended = () => { nodes.forEach(n => { try { n.disconnect(); } catch {} }); voices = voices.filter(x => x !== v); };
    voices.push(v);
    return v;
  }

  function off(h, when = ac.currentTime) {
    const v = typeof h === 'number' ? [...voices].reverse().find(x => x.midi === h && !x.dead && !x.held) : h;
    if (!v || v.dead) return;
    if (sustain) { v.held = true; return; }
    release(v, when);
  }
  function setSustain(on_) {
    sustain = !!on_;
    if (!sustain) voices.forEach(v => { if (v.held) { v.held = false; release(v, ac.currentTime); } });
  }
  function allOff() { voices.forEach(v => { v.held = false; kill(v, ac.currentTime, 0.04); }); }
  function setVolume(x) { out.gain.setTargetAtTime(clamp(x, 0, 2), ac.currentTime, 0.02); }
  return { on, off, setSustain, allOff, setVolume };
}
