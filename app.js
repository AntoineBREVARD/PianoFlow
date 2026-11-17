import { parseFile } from './parsers.js';
import { DEMOS, compose } from './songs.js';
import * as learn from './learn.js';
import * as mic from './mic.js';

const $ = s => document.querySelector(s);
const NAMES = ['Do', 'Do#', 'Ré', 'Ré#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
const isBlack = m => [1, 3, 6, 8, 10].includes(m % 12);
const freq = m => 440 * 2 ** ((m - 69) / 12);
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};

/* ============================ Audio (synthé piano) ============================ */
let ac, master;
function audio() {
  if (!ac) {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0.6;
    const comp = ac.createDynamicsCompressor();
    master.connect(comp); comp.connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
function voiceOn(m, vel = 0.85) {
  const a = audio(), t = a.currentTime, f = freq(m);
  const g = a.createGain(); g.connect(master);
  const oscs = [[1, 1], [2, 0.45], [3, 0.2], [4, 0.1], [5, 0.05]].map(([h, amp]) => {
    const o = a.createOscillator(), pg = a.createGain();
    o.type = 'sine'; o.frequency.value = f * h; pg.gain.value = amp;
    o.connect(pg); pg.connect(g); o.start(t); return o;
  });
  const peak = 0.3 * vel * (m < 48 ? 1 : m > 84 ? 0.7 : 0.9);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.006);
  g.gain.setTargetAtTime(peak * 0.4, t + 0.006, 0.3);
  g.gain.setTargetAtTime(0.0001, t + 0.8, 1.6);
  return {
    off() {
      const n = a.currentTime;
      g.gain.cancelScheduledValues(n);
      g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), n);
      g.gain.setTargetAtTime(0, n, 0.07);
      oscs.forEach(o => o.stop(n + 0.5));
    },
  };
}

/* ============================ État ============================ */
const settings = Object.assign({ mode: 'wait', hands: 'both', speed: 1, names: true, input: 'touch' }, store.get('sp.settings', {}));
let library = store.get('sp.library', []);
let G = null;            // partie en cours
const pressed = new Map(); // midi -> expiration (ms) pour l'affichage
const held = new Map();    // clé -> voix

/* ============================ Écran d'accueil ============================ */
function renderHome() {
  const list = $('#songs'); list.innerHTML = '';
  for (const s of [...library, ...DEMOS]) {
    const li = document.createElement('li');
    const info = document.createElement('div'); info.className = 'info';
    info.innerHTML = `<b></b><small>${s.notes.length} notes · ${s.bpm} bpm${s.demo ? ' · démo' : ''}</small>`;
    info.querySelector('b').textContent = s.title;
    const play = document.createElement('button'); play.textContent = 'Jouer'; play.className = 'primary';
    play.onclick = () => openSetup(s);
    li.append(info, play);
    if (!s.demo) {
      const del = document.createElement('button'); del.textContent = '🗑'; del.className = 'ghost'; del.title = 'Supprimer';
      del.onclick = () => { if (confirm('Supprimer « ' + s.title + ' » ?')) { library = library.filter(x => x !== s); store.set('sp.library', library); renderHome(); } };
      li.append(del);
    }
    list.append(li);
  }
}
async function importFiles(files) {
  const msg = $('#importMsg'); msg.textContent = ''; let last = null;
  for (const f of files) {
    try {
      const song = await parseFile(f);
      song.id = 'u' + Date.now() + Math.random().toString(36).slice(2, 6);
      library.unshift(song); last = song;
      msg.textContent += `✓ ${song.title} (${song.notes.length} notes)\n`;
    } catch (err) { msg.textContent += `✗ ${f.name} : ${err.message}\n`; }
  }
  if (!store.set('sp.library', library)) msg.textContent += '⚠ Stockage plein : la partition ne sera pas gardée après fermeture.\n';
  renderHome();
  if (last && files.length === 1) { learn.refresh(); document.querySelector('[data-tab=songs]').click(); openSetup(last); }
}
$('#file').onchange = async e => { await importFiles([...e.target.files]); e.target.value = ''; };
function doSearch(kind) {
  const q = $('#q').value.trim(); if (!q) { $('#q').focus(); return; }
  const url = kind === 'midi' ? 'https://www.google.com/search?q=' + encodeURIComponent(q + ' midi piano télécharger')
    : 'https://musescore.com/sheetmusic?text=' + encodeURIComponent(q);
  window.open(url, '_blank', 'noopener');
}
$('#qMidi').onclick = () => doSearch('midi'); $('#qMs').onclick = () => doSearch('ms');
$('#q').onkeydown = e => { if (e.key === 'Enter') doSearch('midi'); };
// Partage depuis une autre appli (Fichiers, Téléchargements…) vers PianoFlow (PWA installée)
(async () => {
  if (!/[?&]shared=1/.test(location.search) || !('caches' in window)) return;
  try {
    const c = await caches.open('share'), files = [];
    for (const rq of await c.keys()) { const r = await c.match(rq); files.push(new File([await r.blob()], decodeURIComponent(rq.url.split('/').pop()))); await c.delete(rq); }
    history.replaceState(null, '', location.pathname);
    if (files.length) importFiles(files);
  } catch { }
})();

$('#newSong').onclick = () => { $('#c_msg').textContent = ''; $('#composer').hidden = false; };
$('#c_cancel').onclick = () => { $('#composer').hidden = true; };
$('#c_save').onclick = () => {
  try {
    const song = compose($('#c_title').value.trim() || 'Mon morceau', +$('#c_bpm').value || 100, $('#c_rh').value, $('#c_lh').value);
    song.id = 'c' + Date.now(); library.unshift(song); store.set('sp.library', library);
    $('#composer').hidden = true; renderHome();
  } catch (e) { $('#c_msg').textContent = e.message.startsWith('note') ? 'Note inconnue : ' + e.message.slice(5) : e.message; }
};

// réglages généraux (leçons comprises) : entrée, noms de notes, décalage micro
$('#prefsBtn').onclick = () => {
  $('#p_input').value = settings.input; $('#p_names').checked = settings.names;
  $('#p_lat').value = micLat; $('#p_latVal').textContent = Math.round(micLat * 1000) + ' ms';
  $('#p_recal').textContent = 'Recalibrer le micro'; $('#prefs').hidden = false;
};
$('#p_lat').oninput = e => { micLat = +e.target.value; $('#p_latVal').textContent = Math.round(micLat * 1000) + ' ms'; store.set('sp.micLat', micLat); };
$('#p_recal').onclick = () => { store.set('sp.micFloor', null); $('#p_recal').textContent = 'Recalibrage au prochain lancement ✓'; };
$('#p_close').onclick = () => { settings.input = $('#p_input').value; settings.names = $('#p_names').checked; store.set('sp.settings', settings); $('#prefs').hidden = true; };
let setupSong = null;
function openSetup(song) {
  setupSong = song; $('#setupTitle').textContent = song.title;
  for (const k of ['mode', 'hands', 'input']) $('#s_' + k).value = settings[k];
  $('#s_speed').value = settings.speed; $('#speedVal').textContent = Math.round(settings.speed * 100) + ' %';
  $('#s_names').checked = settings.names;
  $('#setup').hidden = false;
}
$('#s_speed').oninput = e => { $('#speedVal').textContent = Math.round(e.target.value * 100) + ' %'; };
$('#setupCancel').onclick = () => { $('#setup').hidden = true; };
$('#setupGuided').onclick = () => { $('#setup').hidden = true; learn.guided(setupSong); };
$('#setupGo').onclick = async () => {
  for (const k of ['mode', 'hands', 'input']) settings[k] = $('#s_' + k).value;
  settings.speed = +$('#s_speed').value; settings.names = $('#s_names').checked;
  store.set('sp.settings', settings);
  $('#setup').hidden = true;
  begin(setupSong);
};
// démarre une partie (débloque le son, ouvre micro/MIDI si besoin)
async function begin(song, opts) {
  audio();
  const err = await startInputs();
  startGame(song, err, opts);
}

/* ============================ Entrées : micro & MIDI ============================ */
let micStream = null, analyser = null, midiAccess = null, micBuf = null;
let micLat = +store.get('sp.micLat', 0.15) || 0; // latence micro (s) soustraite au temps de jugement ; réglable : __sp.setLat(0.2)
const bindMidi = () => midiAccess.inputs.forEach(i => { i.onmidimessage = midiMsg; });
function calibMsg(t) {
  let d = $('#calib');
  if (!t) { d?.remove(); return; }
  if (!d) { d = document.createElement('div'); d.id = 'calib'; d.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;background:#000c;color:#fff;font-size:1.4rem;z-index:99;text-align:center'; document.body.append(d); }
  d.textContent = t;
}
async function startInputs() {
  stopMic();
  try {
    if (settings.input === 'mic') {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const a = audio(); const src = a.createMediaStreamSource(micStream);
      analyser = a.createAnalyser(); analyser.fftSize = 16384; analyser.smoothingTimeConstant = 0;
      src.connect(analyser);
      micBuf = new Float32Array(analyser.frequencyBinCount); // alloué une seule fois par session micro
      if (store.get('sp.micFloor', null) == null) {
        calibMsg('Silence 2 s…');
        const frames = [];
        for (let i = 0; i < 20; i++) {
          await new Promise(r => setTimeout(r, 100));
          if (i >= 3) { analyser.getFloatFrequencyData(micBuf); frames.push(micBuf.slice()); } // 3 premières : analyseur pas encore rempli
        }
        store.set('sp.micFloor', mic.calibrate(frames));
      }
    } else if (settings.input === 'midi') {
      if (!navigator.requestMIDIAccess) return 'MIDI USB non disponible ici : installe PianoFlow depuis Chrome (Ajouter à l\'écran d\'accueil).';
      midiAccess ||= await navigator.requestMIDIAccess();
      bindMidi(); midiAccess.onstatechange = bindMidi; // affectation (pas d'empilement)
      if (!midiAccess.inputs.size) return 'Aucun piano MIDI détecté : branche-le puis relance le morceau.';
    }
  } catch (e) { stopMic(); settings.input = 'touch'; return 'Entrée indisponible (' + (e.message || e.name) + ') : clavier tactile utilisé.'; }
  finally { calibMsg(); }
  return null;
}
function stopMic() {
  if (micStream) micStream.getTracks().forEach(t => t.stop());
  micStream = null; analyser = null; micBuf = null; micSt.clear();
}
// sons automatiques (démo / main non travaillée) : timers suivis pour pouvoir les couper
const autoV = new Map();
function stopAuto() { for (const [id, v] of autoV) { clearTimeout(id); v.off(); } autoV.clear(); }
$('#s_recal').onclick = () => { store.set('sp.micFloor', null); $('#s_recal').textContent = 'Recalibrage au prochain lancement ✓'; };
function midiMsg(e) {
  const [st, a, b] = e.data, hi = st & 0xf0;
  if (hi === 0x90 && b > 0) press(a, 'midi' + a, b / 127);
  else if (hi === 0x80 || (hi === 0x90 && b === 0)) release('midi' + a);
}

// Détection micro : on ne cherche pas "quelle note", mais "est-ce que les notes ATTENDUES sonnent ?"
// (méthode utilisée pour supporter les accords). Expérimental : calme + micro près du piano.
// État par note attendue : niveau précédent, historique de flux, attaque en attente (ticks), anti-rebond.
const micSt = new Map();
function micTick() {
  if (!analyser || !G || !micBuf) return;
  analyser.getFloatFrequencyData(micBuf);
  const sr = ac.sampleRate, fft = analyser.fftSize, floor = store.get('sp.micFloor', -90);
  const exp = new Set(expectedNow().map(n => n.m)), now = performance.now();
  const found = mic.detect(micBuf, sr, fft, exp, { floor });
  for (const m of exp) {
    let s = micSt.get(m); if (!s) micSt.set(m, s = { prev: floor, hist: [], pend: 0, until: 0 });
    const [cur] = mic.levels(micBuf, sr, fft, [m]);
    if (mic.onset(s.prev, cur, s.hist)) s.pend = 3; // attaque : on laisse 3 analyses pour que detect() confirme
    s.prev = isFinite(cur) ? cur : floor;
    if (s.pend > 0) {
      if (found.has(m) && now > s.until) { s.pend = 0; s.until = now + 300; press(m, 'mic' + m, 0.8, true, micLat * bps()); setTimeout(() => release('mic' + m), 150); }
      else s.pend--;
    }
  }
  for (const m of micSt.keys()) if (!exp.has(m)) micSt.delete(m);
}
function expectedNow() {
  if (!G) return [];
  if (G.mode === 'wait') {
    const g = G.req[G.gi]; if (!g) return [];
    return G.req.slice(G.gi).filter(n => !n.hit && n.s <= g.s + 1e-6);
  }
  return G.req.filter(n => !n.hit && !n.miss && Math.abs(n.s - G.t) < 0.5);
}

/* ============================ Jeu ============================ */
function startGame(song, warning, opts = {}) {
  const o = { mode: settings.mode, hands: settings.hands, speed: settings.speed, ...opts };
  let src = song.notes;
  if (o.from != null) { src = src.filter(n => n[1] >= o.from - 1e-6 && n[1] < o.to - 1e-6); if (!src.length) src = song.notes; }
  if (o.zones) { const z = src.filter(n => o.zones.some(([a, b]) => n[1] >= a - 1e-6 && n[1] < b - 1e-6)); if (z.length) src = z; } // hors zone : retirées (muettes, non requises) ; le départ saute à la 1re zone
  const notes = src.map(([m, s, d, h, f]) => ({ m, s, d, h, f, hit: 0, miss: false, req: false }));
  notes.sort((a, b) => a.s - b.s || a.m - b.m);
  notes.forEach(n => { n.req = o.mode !== 'demo' && (o.hands === 'both' || o.hands === n.h); });
  if (!notes.some(n => n.req) && o.mode !== 'demo') notes.forEach(n => { n.req = true; });
  let lo = notes.reduce((a, n) => Math.min(a, n.m), 127), hi = notes.reduce((a, n) => Math.max(a, n.m), 0);
  while (isBlack(lo)) lo--; while (isBlack(hi)) hi++;
  while (hi - lo < 23) { if (hi < 108) hi++; if (hi - lo < 23 && lo > 21) lo--; }
  while (isBlack(lo)) lo--; while (isBlack(hi)) hi++;
  const req = notes.filter(n => n.req);
  G = {
    song, notes, req, lo, hi, mode: o.mode, sp: o.speed, opts: o, secs: 0,
    t: notes[0].s - 3, gi: 0, mi: 0, ai: 0, end: notes.reduce((a, n) => Math.max(a, n.s + n.d), 0),
    total: req.length, hits: 0, wrong: 0, missed: 0, streak: 0, best: 0, parts: [], rings: [], bad: null, pop: 0, hud: ['', ''], paused: false, last: performance.now(), flash: null, mic: settings.input === 'mic',
  };
  $('#home').hidden = true; $('#result').hidden = true; $('#game').hidden = false;
  $('#pause').hidden = true; $('#hudTitle').textContent = o.label || song.title;
  resize();
  if (warning) flash(warning, '#fbbf24', 3500);
  try { navigator.wakeLock?.request('screen').catch(() => { }); } catch { }
  requestAnimationFrame(loop);
}

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
function flash(text, color, ms = 700) { G.flash = { text, color, until: performance.now() + ms, from: performance.now() }; }

function bpmAt(t) {
  const tm = G.song.tempos; if (!tm) return G.song.bpm;
  let b = tm[0][1]; for (const x of tm) { if (x[0] <= t + 1e-6) b = x[1]; else break; } return b;
}
function bps() { return bpmAt(G.t) / 60 * G.sp; }

function update(dt) {
  const prev = G.t; let adv = bps() * dt;
  if (G.mode === 'wait') {
    while (G.gi < G.req.length && G.req[G.gi].hit) G.gi++;
    const gate = G.req[G.gi];
    if (gate && prev + adv > gate.s) adv = Math.max(0, gate.s - prev);
  }
  G.t = prev + adv;
  if (G.mode === 'rhythm') {
    for (; G.mi < G.req.length; G.mi++) {
      const n = G.req[G.mi];
      if (n.hit || n.miss) continue;
      if (n.s < G.t - 0.4) { n.miss = true; G.missed++; G.streak = 0; } else break;
    }
  }
  // sons automatiques (main non travaillée / mode démo). Muet avec le micro pour éviter le larsen.
  for (; G.ai < G.notes.length; G.ai++) {
    const n = G.notes[G.ai]; if (n.s > G.t) break;
    if ((!n.req || G.mode === 'demo') && !G.mic) {
      const v = voiceOn(n.m, 0.6), id = setTimeout(() => { v.off(); autoV.delete(id); }, Math.max(120, n.d / bps() * 950));
      autoV.set(id, v);
    }
    if (G.mode === 'demo') n.hit = 1;
  }
  const done = G.mode === 'wait' ? (G.gi >= G.req.length && G.req.every(n => n.hit)) : false;
  if (done || G.t > G.end + 1.2) finish();
}

function finish() {
  const g = G; G = null; stopMic(); stopAuto(); pressed.clear();
  held.forEach(v => v.off()); held.clear();
  $('#game').hidden = true;
  if (g.mode === 'demo') { $('#home').hidden = false; learn.refresh(); return; }
  const score = Math.max(0, g.hits - g.wrong * 0.5) / Math.max(1, g.total);
  const stars = score >= 0.95 ? 3 : score >= 0.8 ? 2 : score >= 0.5 ? 1 : 0;
  learn.onTime(g.secs);
  if (g.opts.work) return workDone(g);
  // mesures (4 temps) contenant au moins une note requise non jouée
  const weak = [...new Set(g.req.filter(n => !n.hit).map(n => Math.floor(n.s / 4) + 1))].sort((a, b) => a - b);
  const next = g.opts.onDone?.({ stars, score, hits: g.hits, total: g.total, wrong: g.wrong, secs: g.secs, weak });
  $('#next').hidden = !next?.run; $('#hint').textContent = next?.hint || '';
  if (next?.run) { $('#next').textContent = next.label; $('#next').onclick = () => { $('#result').hidden = true; $('#home').hidden = false; learn.refresh(); next.run(); }; }
  $('#stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  $('#resTitle').textContent = g.opts.label || g.song.title;
  const acc = Math.round(g.hits / Math.max(1, g.total + g.wrong) * 100);
  $('#resStats').textContent = `Précision ${acc} % · ${g.hits} justes · ${g.total - g.hits} ratées · ${g.wrong} fausses · meilleur enchaînement ${g.best}`;
  $('#resWeak').textContent = weak.length ? 'Mesures à retravailler : ' + weak.slice(0, 8).join(', ') : 'Aucune mesure à retravailler, bravo !';
  $('#result').hidden = false;
  $('#again').onclick = () => { $('#result').hidden = true; begin(g.song, g.opts); };
  $('#toMenu').onclick = () => { $('#result').hidden = true; $('#home').hidden = false; learn.refresh(); };
  $('#work').hidden = !weak.length;
  $('#work').onclick = () => {
    $('#result').hidden = true;
    const base = g.opts, orig = base.speed ?? settings.speed;
    runWork(g.song, { zones: weak.map(k => [(k - 2) * 4, (k + 1) * 4]), orig, sp: Math.max(0.5 * orig, 0.8 * orig), ok: 0, base });
  };
}

/* ----- « Répète le passage » : boucle sur les mesures ratées (± 1 mesure), sans XP ni onDone ----- */
function runWork(song, w, msg) {
  const opts = { ...w.base, zones: w.zones, speed: w.sp, work: w, onDone: null, label: 'Passage · ' + Math.round(w.sp / w.orig * 100) + ' % du tempo' };
  begin(song, opts).then(() => { if (G && msg) flash(msg, '#34d399', 2500); });
}
function workDone(g) {
  const w = g.opts.work, acc = g.hits / Math.max(1, g.total + g.wrong);
  if (acc >= 0.85) w.ok++; else w.ok = 0;
  if (w.ok >= 3) {
    $('#stars').textContent = '★★★'; $('#resTitle').textContent = 'Passage maîtrisé !';
    $('#resStats').textContent = 'Bravo, 3 réussites d\'affilée : ce passage est solide.';
    $('#resWeak').textContent = ''; $('#hint').textContent = 'Prêt à rejouer le morceau entier ?';
    $('#next').hidden = true; $('#work').hidden = true;
    $('#again').onclick = () => { $('#result').hidden = true; begin(g.song, w.base); };
    $('#toMenu').onclick = () => { $('#result').hidden = true; $('#home').hidden = false; learn.refresh(); };
    $('#result').hidden = false; return;
  }
  let msg;
  if (acc >= 0.85) { if (w.ok === 2) w.sp = Math.min(w.orig, w.sp + 0.05 * w.orig); msg = `Bien joué ! ${w.ok}/3`; }
  else { w.sp = Math.max(0.5 * w.orig, w.sp - 0.1 * w.orig); msg = 'On y retourne, un peu plus doucement'; }
  runWork(g.song, w, msg);
}

/* ----- saisie ----- */
function press(m, key, vel = 0.85, silent = false, lat = 0) {
  if (!silent) { held.get(key)?.off(); held.set(key, voiceOn(m, vel)); }
  pressed.set(m, Infinity);
  if (!G || G.paused) return;
  judge(m, lat);
}
function release(key) {
  const v = held.get(key); if (v) { v.off(); held.delete(key); }
  const m = key.startsWith('mic') ? +key.slice(3) : key.startsWith('midi') ? +key.slice(4) : null;
  if (m != null) { pressed.delete(m); return; }
  // touche écran : retrouve la note
  for (const [k, mm] of keyOwner) if (k === key) { pressed.delete(mm); keyOwner.delete(k); }
}
function judge(m, lat = 0) {
  if (G.mode === 'demo') return;
  let cand = null;
  const t = G.t - lat; // temps de jugement corrigé de la latence micro (en temps de partition)
  if (G.mode === 'wait') {
    for (let i = G.gi; i < G.req.length; i++) {
      const n = G.req[i]; if (n.s > t + 0.3) break;
      if (!n.hit && n.m === m) { cand = n; break; }
    }
  } else {
    let bd = 1e9;
    for (let i = G.mi; i < G.req.length; i++) {
      const n = G.req[i]; if (n.s > t + 0.5) break;
      if (n.hit || n.miss || n.m !== m) continue;
      const d = Math.abs(n.s - t); if (d <= 0.4 && d < bd) { bd = d; cand = n; }
    }
    if (cand) flash(bd < 0.12 ? 'Parfait !' : bd < 0.25 ? 'Bien' : 'Un peu décalé', bd < 0.12 ? '#34d399' : bd < 0.25 ? '#60a5fa' : '#fbbf24');
  }
  const r = G.keys.get(m), now = performance.now();
  if (cand) {
    cand.hit = 1; G.hits++; G.streak++; G.best = Math.max(G.best, G.streak);
    if (r && !RM) {
      const x = r.x + r.w / 2, y = G.hitY;
      G.rings.push({ x, y, t: now });
      for (let i = 0; i < 14; i++) {
        const a = Math.PI * (1 + Math.random()), v = 60 + Math.random() * 140;
        G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: now, c: i % 2 ? '#34d399' : '#fde68a' });
      }
    }
    if (G.streak % 5 === 0) G.pop = now;
  } else {
    G.wrong++; G.streak = 0;
    G.bad = { m, t: now };
  }
}

/* ----- clavier à l'écran ----- */
const keyOwner = new Map(); // clé pointeur -> midi
function keyAt(x, y) {
  if (!G || y < G.hitY) return null;
  const ky = y - G.hitY;
  for (const m of G.blacks) { const r = G.keys.get(m); if (x >= r.x && x < r.x + r.w && ky <= G.bkH) return m; }
  for (const m of G.whites) { const r = G.keys.get(m); if (x >= r.x && x < r.x + r.w) return m; }
  return null;
}
const cv = $('#cv'), ctx = cv.getContext('2d');
cv.addEventListener('pointerdown', e => {
  if (!G) return; cv.setPointerCapture(e.pointerId);
  const m = keyAt(e.clientX, e.clientY); if (m == null) return;
  const k = 'p' + e.pointerId; keyOwner.set(k, m); press(m, k);
});
cv.addEventListener('pointermove', e => {
  const k = 'p' + e.pointerId; if (!keyOwner.has(k) || !G) return;
  const m = keyAt(e.clientX, e.clientY);
  if (m != null && m !== keyOwner.get(k)) { release(k); keyOwner.set(k, m); press(m, k); }
});
for (const ev of ['pointerup', 'pointercancel']) cv.addEventListener(ev, e => { release('p' + e.pointerId); });
// clavier d'ordinateur (test) : A W S E D F T G Y H U J K -> Do4..Do5
const KEYMAP = 'awsedftgyhujkolp';
addEventListener('keydown', e => { if (e.repeat || !G) return; const i = KEYMAP.indexOf(e.key); if (i >= 0) { keyOwner.set('k' + e.key, 60 + i); press(60 + i, 'k' + e.key); } });
addEventListener('keyup', e => { if (keyOwner.has('k' + e.key)) release('k' + e.key); });

/* ----- affichage ----- */
let dpr = 1;
function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  const W = innerWidth, H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  if (!G) return;
  G.W = W; G.H = H;
  G.kbH = Math.round(Math.min(Math.max(H * 0.22, 90), 160)); G.hitY = H - G.kbH; G.bkH = G.kbH * 0.62;
  G.whites = []; G.blacks = []; G.keys = new Map();
  for (let m = G.lo; m <= G.hi; m++) (isBlack(m) ? G.blacks : G.whites).push(m);
  const ww = W / G.whites.length, bw = ww * 0.6;
  G.whites.forEach((m, i) => G.keys.set(m, { x: i * ww, w: ww }));
  for (const m of G.blacks) { const lw = G.keys.get(m - 1); G.keys.set(m, { x: lw.x + lw.w - bw / 2, w: bw }); }
  G.ppb = G.hitY / 6;
}
addEventListener('resize', resize);

const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); };
const COL = { R: ['#38bdf8', '#0ea5e9'], L: ['#fb923c', '#ea580c'] };

function draw() {
  const { W, H, hitY, ppb } = G, now = performance.now();
  const bad = G.bad && now - G.bad.t < 350 ? G.bad : null, shk = bad && !RM ? Math.sin(now * 0.12) * 3 * (1 - (now - bad.t) / 350) : 0;
  ctx.setTransform(dpr, 0, 0, dpr, shk * dpr, 0);
  const bg = ctx.createLinearGradient(0, 0, 0, hitY); bg.addColorStop(0, '#0b0e22'); bg.addColorStop(1, '#171b3d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // lignes de touches
  ctx.lineWidth = 1;
  for (const m of G.whites) {
    const r = G.keys.get(m); ctx.strokeStyle = m % 12 === 0 ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.06)';
    ctx.beginPath(); ctx.moveTo(r.x, 0); ctx.lineTo(r.x, hitY); ctx.stroke();
  }
  // notes qui tombent
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, hitY); ctx.clip();
  const hint = new Set(expectedNow().map(n => n.m));
  for (const n of G.notes) {
    const yb = hitY - (n.s - G.t) * ppb, yt = hitY - (n.s + n.d - G.t) * ppb;
    if (yb < -4 || yt > hitY) continue;
    const r = G.keys.get(n.m); if (!r) continue;
    const bh = Math.max(yb - yt - 8, 20), top = yb - bh;
    const bw = isBlack(n.m) ? r.w * 0.9 : r.w * 0.84, bx = r.x + (r.w - bw) / 2;
    let c = COL[n.h] || COL.R;
    let fill = c[0];
    if (n.hit) fill = '#34d399'; else if (n.miss) fill = '#64748b'; else if (!n.req) fill = 'rgba(148,163,184,.45)';
    ctx.globalAlpha = n.hit && G.mode !== 'demo' ? Math.max(0.25, 1 - (G.t - n.s) * 1.5) : 1;
    ctx.fillStyle = fill; rr(bx, top, bw, bh - 2, 6); ctx.fill();
    ctx.globalAlpha = 1;
    if (n.f && bh >= 20 && bw > 14) {
      ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.beginPath(); ctx.arc(bx + bw / 2, top + 12, 9, 0, 7); ctx.fill();
      ctx.fillStyle = '#0b0e22'; ctx.font = '700 12px system-ui'; ctx.textAlign = 'center'; ctx.fillText(n.f, bx + bw / 2, top + 16.5);
    }
    if (settings.names && bw > 16 && bh > (n.f ? 44 : 18)) {
      ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.font = `600 ${Math.min(13, bw * 0.5)}px system-ui`; ctx.textAlign = 'center';
      ctx.fillText(NAMES[n.m % 12], bx + bw / 2, yb - 8);
    }
  }
  ctx.restore();
  // ligne d'impact
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(0, hitY - 2, W, 2);
  // clavier
  for (const m of G.whites) {
    const r = G.keys.get(m), p = pressed.has(m);
    ctx.fillStyle = p ? '#a5f3fc' : hint.has(m) ? '#fde68a' : '#f4f4f8';
    ctx.fillRect(r.x + 0.5, hitY, r.w - 1, G.kbH);
    if (settings.names && (r.w > 20 || m % 12 === 0)) {
      ctx.fillStyle = '#64748b'; ctx.font = `${Math.min(11, r.w * 0.45)}px system-ui`; ctx.textAlign = 'center';
      ctx.fillText(r.w > 20 ? NAMES[m % 12] : 'Do' + (Math.floor(m / 12) - 1), r.x + r.w / 2, H - 8);
    }
  }
  for (const m of G.blacks) {
    const r = G.keys.get(m), p = pressed.has(m);
    ctx.fillStyle = p ? '#22d3ee' : hint.has(m) ? '#f59e0b' : '#1c1c24';
    rr(r.x, hitY, r.w, G.bkH, [0, 0, 4, 4]); ctx.fill();
  }
  // message flash
  if (G.flash && now < G.flash.until) {
    const a = Math.min(1, (G.flash.until - now) / 300);
    ctx.globalAlpha = a; ctx.fillStyle = G.flash.color; ctx.font = '700 26px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(G.flash.text, W / 2, hitY - 24); ctx.globalAlpha = 1;
  }
  // flash rouge doux sur la colonne d'une fausse note
  if (bad) {
    const r = G.keys.get(bad.m);
    if (r) { ctx.fillStyle = `rgba(248,113,113,${0.25 * (1 - (now - bad.t) / 350)})`; ctx.fillRect(r.x, 0, r.w, G.H); }
  }
  // anneaux et particules (600 ms)
  for (let i = G.rings.length - 1; i >= 0; i--) {
    const p = G.rings[i], k = (now - p.t) / 600; if (k >= 1) { G.rings.splice(i, 1); continue; }
    ctx.strokeStyle = `rgba(52,211,153,${1 - k})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, 8 + k * 34, 0, 7); ctx.stroke();
  }
  for (let i = G.parts.length - 1; i >= 0; i--) {
    const p = G.parts[i], s = (now - p.t) / 1000, k = s / 0.6; if (k >= 1) { G.parts.splice(i, 1); continue; }
    ctx.globalAlpha = 1 - k; ctx.fillStyle = p.c;
    ctx.fillRect(p.x + p.vx * s, p.y + p.vy * s + 400 * s * s, 4, 4);
  }
  ctx.globalAlpha = 1;
  // compteur de combo : grossit tous les 5, paliers 10/25/50
  if (G.streak >= 3 && G.mode !== 'demo') {
    const tier = G.streak >= 50 ? 3 : G.streak >= 25 ? 2 : G.streak >= 10 ? 1 : 0;
    const pop = RM ? 0 : Math.max(0, 1 - (now - G.pop) / 250) * 0.25;
    const size = 20 + Math.min(G.streak, 50) / 5 * 3 + tier * 4;
    ctx.fillStyle = ['#e2e8f0', '#fde68a', '#fbbf24', '#f59e0b'][tier];
    ctx.font = `800 ${size * (1 + pop)}px system-ui`; ctx.textAlign = 'center';
    ctx.fillText(`x${G.streak}`, W / 2, 80 + size / 2);
  }
  // HUD : DOM écrit seulement si la valeur change
  const hs = G.mode === 'demo' ? 'Démo' : `${G.hits}/${G.total}` + (G.streak > 2 ? ` · 🔥${G.streak}` : '');
  const bw2 = Math.max(0, Math.min(100, (G.t - G.notes[0].s + 3) / (G.end - G.notes[0].s + 3) * 100)).toFixed(1) + '%';
  if (G.hud[0] !== hs) $('#hudScore').textContent = G.hud[0] = hs;
  if (G.hud[1] !== bw2) $('#bar').style.width = G.hud[1] = bw2;
}

let micFrame = 0;
function loop(now) {
  if (!G) return;
  const dt = Math.min(0.1, (now - G.last) / 1000); G.last = now;
  if (!G.paused) { G.secs += dt; update(dt); if (G && ++micFrame % 3 === 0) micTick(); }
  if (G) { draw(); requestAnimationFrame(loop); }
}

$('#pauseBtn').onclick = () => { G.paused = true; stopAuto(); $('#pause').hidden = false; };
$('#resume').onclick = () => { G.paused = false; G.last = performance.now(); $('#pause').hidden = true; };
$('#quit').onclick = () => { learn.onTime(G.secs); learn.refresh(); G.mode = 'demo'; G.paused = false; $('#pause').hidden = true; G.t = Infinity; $('#home').hidden = false; $('#game').hidden = true; G = null; stopMic(); stopAuto(); held.forEach(v => v.off()); held.clear(); pressed.clear(); };

renderHome();
learn.init({ store, begin });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
window.__sp = { get G() { return G; }, setLat(v) { micLat = +v; store.set('sp.micLat', micLat); }, press, startGame, settings, library: () => library };
