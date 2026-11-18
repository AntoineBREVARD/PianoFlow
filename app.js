import { parseFile } from './parsers.js';
import { DEMOS, compose } from './songs.js';
import * as learn from './learn.js';
import * as mic from './mic.js';
import { shareBlob } from './share.js';
import { createSynth } from './synth.js';
import * as accomp from './accomp.js';

const $ = s => document.querySelector(s);
const NAMES = ['Do', 'Do#', 'Ré', 'Ré#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
const isBlack = m => [1, 3, 6, 8, 10].includes(m % 12);
const freq = m => 440 * 2 ** ((m - 69) / 12);
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};

/* ============================ Audio (synthé piano) ============================ */
let ac, master, synth, recDest;
function audio() {
  if (!ac) {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0.6;
    const comp = ac.createDynamicsCompressor();
    master.connect(comp); comp.connect(ac.destination);
    try { recDest = ac.createMediaStreamDestination(); master.connect(recDest); } catch { recDest = null; } // dérivation pour l'enregistrement
    try { synth = createSynth(ac, master); } catch { synth = null; }
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
function voiceOn(m, vel = 0.85) {
  const a = audio();
  if (settings.piano !== false && synth) { const h = synth.on(m, vel); return { off() { synth.off(h); } }; }
  // repli : ancien synthé simple (téléphones lents)
  const t = a.currentTime, f = freq(m);
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
const settings = Object.assign({ mode: 'wait', hands: 'both', speed: 1, names: true, input: 'touch', metro: false, recall: false, piano: true, accomp: false, rec: false }, store.get('sp.settings', {}));
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
// options ajoutées en JS : métronome, mode « sans les notes »
for (const [id, label] of [['p_metro', 'Métronome (clic) en mode rythme'], ['p_piano', 'Son de piano réaliste'], ['p_recall', 'Sans les notes (rappel actif) : les notes s’estompent'], ['p_accomp', 'Accompagnement (basse ; percussions discrètes en mode rythme), pas avec le micro']]) {
  const l = document.createElement('label'); l.className = 'row'; l.innerHTML = `<input id="${id}" type="checkbox"> ${label}`;
  $('#p_close').parentElement.before(l);
}
{
  const b = document.createElement('button'); b.id = 'p_rec'; b.type = 'button'; b.className = 'ghost';
  const n = document.createElement('p'); n.className = 'hint'; n.textContent = 'Ton enregistrement reste sur ton appareil : rien n’est envoyé sur le réseau. Indisponible avec le micro.';
  $('#p_close').parentElement.before(b, n);
  b.onclick = () => { settings.rec = !settings.rec; refreshPrefs(); };
}
function refreshPrefs() {
  const mic_ = $('#p_input').value === 'mic', ok = typeof MediaRecorder !== 'undefined';
  $('#p_accomp').disabled = mic_; if (mic_) $('#p_accomp').checked = false;
  const r = $('#p_rec'); r.disabled = mic_ || !ok; r.setAttribute('aria-pressed', String(!!settings.rec && !r.disabled));
  r.textContent = r.disabled ? '🎙️ Enregistrer ma partie (indisponible)' : settings.rec ? '🎙️ Enregistrement activé (toucher pour couper)' : '🎙️ Enregistrer ma partie';
}
$('#p_input').addEventListener('change', refreshPrefs);
$('#tabPrefs').onclick = () => $('#prefsBtn').onclick();
$('#prefsBtn').onclick = () => {
  $('#p_input').value = settings.input; $('#p_names').checked = settings.names; $('#p_metro').checked = settings.metro; $('#p_recall').checked = settings.recall; $('#p_piano').checked = settings.piano !== false; $('#p_accomp').checked = !!settings.accomp; refreshPrefs();
  $('#p_lat').value = micLat; $('#p_latVal').textContent = Math.round(micLat * 1000) + ' ms';
  $('#p_recal').textContent = 'Recalibrer le micro'; $('#prefs').hidden = false;
};
$('#p_lat').oninput = e => { micLat = +e.target.value; $('#p_latVal').textContent = Math.round(micLat * 1000) + ' ms'; store.set('sp.micLat', micLat); };
$('#p_recal').onclick = () => { store.set('sp.micFloor', null); $('#p_recal').textContent = 'Recalibrage au prochain lancement ✓'; };
$('#p_close').onclick = () => { settings.input = $('#p_input').value; settings.names = $('#p_names').checked; settings.metro = $('#p_metro').checked; settings.recall = $('#p_recall').checked; settings.piano = $('#p_piano').checked; settings.accomp = $('#p_accomp').checked && settings.input !== 'mic'; if (settings.input === 'mic') settings.rec = false; store.set('sp.settings', settings); $('#prefs').hidden = true; };
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
let micFloor = -90; // lu une seule fois au démarrage du micro
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
      { const f = +store.get('sp.micFloor', -90); micFloor = Number.isFinite(f) ? f : -90; }
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
function stopAuto() { synth?.allOff(); for (const [id, v] of autoV) { clearTimeout(id); v.off(); } autoV.clear(); }
$('#s_recal').onclick = () => { store.set('sp.micFloor', null); $('#s_recal').textContent = 'Recalibrage au prochain lancement ✓'; };
function midiMsg(e) {
  const [st, a, b] = e.data, hi = st & 0xf0;
  if (hi === 0x90 && b > 0) press(a, 'midi' + a, b / 127);
  else if (hi === 0xb0 && a === 64) synth?.setSustain(b >= 64);
  else if (hi === 0x80 || (hi === 0x90 && b === 0)) release('midi' + a);
}

// Détection micro : on ne cherche pas "quelle note", mais "est-ce que les notes ATTENDUES sonnent ?"
// (méthode utilisée pour supporter les accords). Expérimental : calme + micro près du piano.
// État par note attendue : niveau précédent, historique de flux, attaque en attente (ticks), anti-rebond.
const micSt = new Map();
function micTick() {
  if (!analyser || !G || !micBuf) return;
  analyser.getFloatFrequencyData(micBuf);
  const sr = ac.sampleRate, fft = analyser.fftSize, floor = micFloor;
  const exp = new Set(expectedNow().map(n => n.m)), now = performance.now();
  const found = mic.detect(micBuf, sr, fft, exp, { floor });
  for (const m of exp) {
    let s = micSt.get(m); if (!s) micSt.set(m, s = { prev: floor, hist: [], pend: 0, until: 0 });
    const [cur] = mic.levels(micBuf, sr, fft, [m]);
    if (mic.onset(s.prev, cur, s.hist)) s.pend = 3; // attaque : on laisse 3 analyses pour que detect() confirme
    s.prev = isFinite(cur) ? cur : floor;
    if (s.pend > 0) {
      if (found.has(m) && now > s.until) { s.pend = 0; s.until = now + 300; press(m, 'mic' + m, 0.8, true, micLat * bps(), true); setTimeout(() => release('mic' + m), 150); }
      else s.pend--;
    }
  }
  for (const m of micSt.keys()) if (!exp.has(m)) micSt.delete(m);
}
function expectedNow() {
  if (!G) return [];
  if (G.mode === 'wait') {
    const g = G.req[G.gi]; if (!g) return [];
    const out = []; for (let i = G.gi; i < G.req.length && G.req[i].s <= g.s + 1e-6; i++) if (!G.req[i].hit) out.push(G.req[i]);
    return out;
  }
  const out = []; // req trié : tout avant G.mi est déjà joué/raté, on s'arrête après t+0.5
  for (let i = G.mi; i < G.req.length && G.req[i].s < G.t + 0.5; i++) { const n = G.req[i]; if (!n.hit && !n.miss && Math.abs(n.s - G.t) < 0.5) out.push(n); }
  return out;
}

/* ============================ Jeu ============================ */
function startGame(song, warning, opts = {}) {
  const o = { mode: settings.mode, hands: settings.hands, speed: settings.speed, ...opts };
  let src = song.notes;
  if (o.from != null) { src = src.filter(n => n[1] >= o.from - 1e-6 && n[1] < o.to - 1e-6); if (!src.length) src = song.notes; }
  if (o.zones) { const z = src.filter(n => o.zones.some(([a, b]) => n[1] >= a - 1e-6 && n[1] < b - 1e-6)); if (z.length) src = z; } // hors zone : retirées (muettes, non requises) ; le départ saute à la 1re zone
  const notes = src.map(([m, s, d, h, f]) => ({ m, s, d, h, f, hit: 0, miss: false, req: false, dt: null, wrong: 0 }));
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
    maxD: notes.reduce((a, n) => Math.max(a, n.d), 0), total: req.length, hits: 0, wrong: 0, pw: 0, wl: [], missed: 0, streak: 0, best: 0, parts: [], rings: [], bad: null, pop: 0, hud: ['', ''], paused: false, last: performance.now(), beat: Math.floor(notes[0].s - 3) - 1, lastAct: performance.now(), flash: null, mic: settings.input === 'mic', kl: new Float64Array(128).fill(-1e9), kh: new Array(128).fill(null), tier: 0, tierT: 0, missT: 0, missFx: null, pT: 0, pm: 1,
  };
  startAccomp(notes, song); startRec();
  $('#home').hidden = true; $('#result').hidden = true; $('#game').hidden = false;
  $('#pause').hidden = true; $('#hudTitle').textContent = o.label || song.title;
  resize();
  if (warning) flash(warning, '#fbbf24', 3500);
  keepAwake();
  requestAnimationFrame(loop);
}

let wake = null;
function keepAwake() { try { navigator.wakeLock?.request('screen').then(w => { wake = w; }).catch(() => { }); } catch { } }
function pauseGame() { G.paused = true; stopAuto(); stopAccomp(); $('#pause').hidden = false; }
// en arrière-plan : pause auto (le temps de jeu ne saute jamais, Reprendre remet G.last à zéro)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (G && !G.paused) pauseGame(); return; }
  if (G) { G.last = performance.now(); if (!wake || wake.released) keepAwake(); }
  slowT = 0; slowN = 0;
});

/* ----- accompagnement (jamais avec le micro) ----- */
function startAccomp(notes, song) {
  stopAccomp(); if (!G) return;
  if (!settings.accomp || settings.input === 'mic') return;
  try {
    const evs = accomp.events(notes.map(n => [n.m, n.s, n.d, n.h]), song.bpm || 100, { rhythm: G.mode === 'rhythm', timeSig: song.timeSig || '4/4', grid: song.grid, from: Math.max(0, notes[0].s - 3) });
    G.acc = accomp.createAccomp(audio(), master, evs, { volume: 0.5 });
  } catch { G.acc = null; }
}
function stopAccomp() { try { G?.acc?.stop(); } catch { } if (G) G.acc = null; }

/* ----- enregistrement de la partie (local uniquement) ----- */
let rec = null, recUrl = null, recBlob = null;
function startRec() {
  rec = null; if (recUrl) { URL.revokeObjectURL(recUrl); recUrl = null; } recBlob = null;
  if (!settings.rec || settings.input === 'mic' || typeof MediaRecorder === 'undefined') return;
  audio(); if (!recDest) return;
  try {
    const chunks = [], r = new MediaRecorder(recDest.stream);
    r.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    r.onstop = () => { if (r.keep && chunks.length) { recBlob = new Blob(chunks, { type: r.mimeType || 'audio/webm' }); if (!$('#result').hidden) showRec(); } };
    r.start(); rec = r;
  } catch { rec = null; }
}
function endRec(keep) { const r = rec; rec = null; if (r && r.state !== 'inactive') { r.keep = keep; try { r.stop(); } catch { } } }
function showRec() {
  let box = $('#recBox');
  if (!box) {
    box = document.createElement('div'); box.id = 'recBox'; box.className = 'actions'; box.hidden = true;
    box.innerHTML = '<button id="recPlay" class="ghost" type="button">▶ Réécouter</button><button id="recShare" class="ghost" type="button">Partager / Télécharger</button><p class="hint" style="flex-basis:100%;margin:0">Enregistrement local, jamais envoyé sur le réseau.</p>';
    $('#result .actions').before(box);
    let au = null;
    $('#recPlay').onclick = () => { if (!recBlob) return; if (au && !au.paused) { au.pause(); $('#recPlay').textContent = '▶ Réécouter'; return; } recUrl ||= URL.createObjectURL(recBlob); au = new Audio(recUrl); au.onended = () => { $('#recPlay').textContent = '▶ Réécouter'; }; au.play().catch(() => { }); $('#recPlay').textContent = '⏸ Pause'; };
    $('#recShare').onclick = async () => {
      if (!recBlob) return;
      const ext = /mp4/.test(recBlob.type) ? 'm4a' : 'webm', file = new File([recBlob], 'pianoflow-ma-partie.' + ext, { type: recBlob.type });
      try { await shareBlob(recBlob, file.name, { title: 'Ma partie PianoFlow' }); } catch { alert('Partage impossible sur cet appareil.'); }
    };
  }
  box.hidden = !recBlob;
}

// métronome : clic synthétisé discret (accent sur le 1er temps de mesure)
function click(accent) {
  const a = audio(), t = a.currentTime, o = a.createOscillator(), g = a.createGain();
  o.frequency.value = accent ? 1500 : 1000; g.gain.setValueAtTime(accent ? 0.35 : 0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.06);
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
    if (gate && prev + adv >= gate.s) { adv = Math.max(0, gate.s - prev); if (gate.arr == null) gate.arr = performance.now(); }
  }
  G.t = prev + adv;
  if (G.mode === 'rhythm') {
    for (const b = Math.floor(G.t); G.beat < b;) { G.beat++; if (settings.metro && G.beat <= G.end) click(G.beat % 4 === 0); }
  }
  if (G.mode === 'rhythm') {
    for (; G.mi < G.req.length; G.mi++) {
      const n = G.req[G.mi];
      if (n.hit || n.miss) continue;
      if (n.s < G.t - 0.4) { n.miss = true; G.missed++; G.streak = 0; G.missT = performance.now(); G.missFx = { m: n.m, t: G.missT }; flash('Raté', '#f87171', 600); } else break;
    }
  }
  if (G.acc && !G.paused) G.acc.tick(G.t, bps());
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
  const g = G; stopAccomp(); G = null; stopMic(); stopAuto(); pressed.clear(); endRec(true);
  held.forEach(v => v.off()); held.clear();
  $('#game').hidden = true;
  if (g.mode === 'demo') { $('#home').hidden = false; learn.refresh(); return; }
  const score = Math.max(0, g.hits - g.wrong * 0.5) / Math.max(1, g.total);
  const stars = score >= 0.95 ? 3 : score >= 0.8 ? 2 : score >= 0.5 ? 1 : 0;
  learn.onTime(g.secs);
  const attempt = {
    songId: g.song.id || g.song.title, ts: Date.now(), mode: g.mode, hands: g.opts.hands || settings.hands, speed: g.sp, bpm: Math.round(g.song.bpm * g.sp), secs: g.secs,
    notes: g.notes.map((n, i) => ({ i, m: n.m, s: n.s, d: n.d, h: n.h, f: n.f, req: n.req, hit: !!n.hit, wrong: n.wrong, dt: n.hit ? n.dt : null })),
    wrongs: g.wl,
  };
  if (g.opts.work) { attempt.zone = true; attempt.measures = [...new Set(g.req.map(n => Math.floor(n.s / 4) + 1))].sort((a, b) => a - b); }
  try { if (typeof learn.recordAttempt === 'function') learn.recordAttempt(attempt); } catch (e) { console.warn(e); }
  if (g.opts.work) return workDone(g);
  // mesures (4 temps) contenant au moins une note requise non jouée
  const weak = [...new Set(g.req.filter(n => !n.hit).map(n => Math.floor(n.s / 4) + 1))].sort((a, b) => a - b);
  const next = g.opts.onDone?.({ stars, score, hits: g.hits, total: g.total, wrong: g.wrong, secs: g.secs, weak, attempt });
  $('#next').hidden = !next?.run; $('#hint').textContent = next?.hint || '';
  if (next?.run) { $('#next').textContent = next.label; $('#next').onclick = () => { $('#result').hidden = true; $('#home').hidden = false; learn.refresh(); next.run(); }; }
  revealStars(stars);
  $('#resTitle').textContent = g.opts.label || g.song.title;
  const acc = Math.round(g.hits / Math.max(1, g.total + g.wrong) * 100);
  $('#resStats').textContent = `Précision ${acc} % · ${g.hits} justes · ${g.total - g.hits} ratées · ${g.wrong} fausses · meilleur enchaînement ${g.best}`;
  $('#resWeak').textContent = weak.length ? 'Mesures à retravailler : ' + weak.slice(0, 8).join(', ') : 'Aucune mesure à retravailler, bravo !';
  stuck(attempt);
  $('#result').hidden = false; showRec();
  $('#again').onclick = () => { $('#result').hidden = true; begin(g.song, g.opts); };
  $('#toMenu').onclick = () => { $('#result').hidden = true; $('#home').hidden = false; learn.refresh(); };
  $('#work').hidden = !weak.length;
  $('#work').onclick = () => {
    $('#result').hidden = true;
    const base = g.opts, orig = base.speed ?? settings.speed;
    runWork(g.song, { zones: weak.map(k => [(k - 2) * 4, (k + 1) * 4]), orig, sp: Math.max(0.5 * orig, 0.8 * orig), ok: 0, base });
  };
}

// étoiles qui apparaissent une à une (sans animation si prefers-reduced-motion)
let starTok = 0;
function revealStars(stars) {
  const el = $('#stars'), tok = ++starTok, all = n => '★'.repeat(n) + '☆'.repeat(3 - n);
  if (RM || !stars) { el.textContent = all(stars); return; }
  el.textContent = all(0);
  for (let i = 1; i <= stars; i++) setTimeout(() => {
    if (tok !== starTok || $('#result').hidden) return;
    el.textContent = all(i); el.animate?.([{ transform: 'scale(1.7)', opacity: 0.4 }, { transform: 'scale(1)', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.2,1.6,.4,1)' });
  }, 350 * i);
}

// « Ce qui a coincé » : diagnostics facultatifs (skill.js absent ou en erreur : rien)
async function stuck(attempt) {
  const box = $('#resStuck'); box.hidden = true; box.textContent = '';
  try {
    const { diagnoseAttempt } = await import('./skill.js');
    const list = diagnoseAttempt(attempt).sort((a, b) => b.severity - a.severity).slice(0, 3);
    if (!list.length) return;
    const h = document.createElement('strong'); h.textContent = 'Ce qui a coincé'; box.append(h);
    const ul = document.createElement('ul');
    for (const d of list) { const li = document.createElement('li'); li.textContent = d.message + (d.measures?.length && !/mesure/.test(d.message) ? ' (mesure' + (d.measures.length > 1 ? 's ' : ' ') + d.measures.join(', ') + ')' : ''); ul.append(li); }
    box.append(ul); box.hidden = false;
  } catch (e) { /* rien */ }
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
function press(m, key, vel = 0.85, silent = false, lat = 0, soft = false) {
  if (!silent) { held.get(key)?.off(); held.set(key, voiceOn(m, vel)); }
  pressed.set(m, Infinity);
  if (!G || G.paused) return;
  judge(m, lat, soft);
}
function release(key) {
  const v = held.get(key); if (v) { v.off(); held.delete(key); }
  const m = key.startsWith('mic') ? +key.slice(3) : key.startsWith('midi') ? +key.slice(4) : null;
  if (m != null) { pressed.delete(m); return; }
  // touche écran : retrouve la note
  for (const [k, mm] of keyOwner) if (k === key) { pressed.delete(mm); keyOwner.delete(k); }
}
function judge(m, lat = 0, soft = false) { // soft : détection micro d'une note attendue, hors fenêtre de jugement = on ignore (ce n'est pas une faute)
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
    cand.hit = 1; cand.wrong = G.pw; G.pw = 0;
    cand.dt = Math.round(G.mode === 'wait' ? (cand.arr != null ? now - cand.arr : (t - cand.s) * 60000 / (G.song.bpm * G.sp)) : (t - cand.s) * 60000 / (bpmAt(cand.s) * G.sp));
    G.lastAct = now; G.hits++; G.streak++; G.best = Math.max(G.best, G.streak);
    if (r && !RM) {
      const x = r.x + r.w / 2, y = G.hitY;
      const hc = HAND[cand.h] || HAND.R; G.rings.push({ x, y, t: now, c: hc.b });
      for (let i = 0; i < 18 && G.parts.length < 120; i++) { // plafond 120 particules, objets recyclés
        const a = Math.PI * (1 + Math.random()), v = 60 + Math.random() * 140, p = partPool.pop() || {};
        p.x = x; p.y = y; p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v; p.t = now; p.c = i % 2 ? hc.b : '#fde68a';
        G.parts.push(p);
      }
    }
    if (G.streak % 5 === 0) G.pop = now;
  } else if (!soft) {
    G.wrong++; G.pw++; G.wl.push({ m, s: +t.toFixed(3) }); G.streak = 0; G.lastAct = now;
    G.bad = { m, t: now }; flash('Oups', '#f87171', 500);
  }
}

/* ----- clavier à l'écran ----- */
const partPool = [];
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
addEventListener('keydown', e => { if (e.repeat || !G || e.ctrlKey || e.metaKey || e.altKey) return; const k = e.key.toLowerCase(), i = k.length === 1 ? KEYMAP.indexOf(k) : -1; if (i >= 0) { keyOwner.set('k' + k, 60 + i); press(60 + i, 'k' + k); } });
addEventListener('keyup', e => { const k = 'k' + e.key.toLowerCase(); if (keyOwner.has(k)) release(k); });

/* ----- affichage ----- */
let dpr = 1, dprCap = 2;
function resize() {
  dpr = Math.min(devicePixelRatio || 1, dprCap);
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
// palette par main : b = base, l = reflet, d = ombre
const HAND = { R: { b: '#38bdf8', l: '#e0f7ff' }, L: { b: '#fb923c', l: '#ffedd5' } };
const HITC = { b: '#34d399', l: '#d1fae5' }, MISSC = { b: '#64748b', l: '#cbd5e1' }, GHOSTC = { b: '#94a3b8', l: '#e2e8f0' };
const FING = ['#fff', '#f87171', '#fbbf24', '#a3e635', '#22d3ee', '#c084fc'];
const COMBOC = ['#e2e8f0', '#fde68a', '#fbbf24', '#fb923c'];
const ease = k => 1 - (1 - k) * (1 - k);

/* sprites pré-rendus (mis en cache) : halo radial, traînée verticale */
const sprites = {};
function glowSpr(c) {
  return sprites['g' + c] || (sprites['g' + c] = (() => {
    const s = document.createElement('canvas'); s.width = s.height = 64; const g = s.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, c + 'ff'); gr.addColorStop(0.35, c + '66'); gr.addColorStop(1, c + '00'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return s;
  })());
}
function fadeSpr(c, up) { // dégradé vertical : transparent en haut -> couleur en bas (up) ou l'inverse
  const k = (up ? 'u' : 'd') + c;
  return sprites[k] || (sprites[k] = (() => {
    const s = document.createElement('canvas'); s.width = 4; s.height = 64; const g = s.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, c + (up ? '00' : 'cc')); gr.addColorStop(1, c + (up ? 'cc' : '00')); g.fillStyle = gr; g.fillRect(0, 0, 4, 64); return s;
  })());
}
const DUST = new Float32Array(40 * 4); for (let i = 0; i < 40; i++) { DUST[i * 4] = Math.random(); DUST[i * 4 + 1] = Math.random(); DUST[i * 4 + 2] = 0.2 + Math.random() * 0.8; DUST[i * 4 + 3] = Math.random() * 6.28; }

let bgc = null, bgKey = '', gBase = '', kbW, kbB, kbShadow, beatBand;
const hintSet = new Set();
function layers() {
  const { W, H, hitY } = G, key = `${W}x${H}|${hitY}|${dpr}|${G.lo}-${G.hi}`;
  if (key === bgKey) return; bgKey = key;
  // fond + lignes de touches pré-rendus une fois
  bgc = bgc || document.createElement('canvas'); bgc.width = Math.ceil(W * dpr); bgc.height = Math.ceil(hitY * dpr);
  const g = bgc.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  let gr = g.createLinearGradient(0, 0, 0, hitY); gr.addColorStop(0, '#080a1c'); gr.addColorStop(1, '#171b3d'); g.fillStyle = gr; g.fillRect(0, 0, W, hitY);
  gr = g.createRadialGradient(W * 0.2, hitY * 0.3, 0, W * 0.2, hitY * 0.3, W * 0.8); gr.addColorStop(0, 'rgba(99,102,241,.18)'); gr.addColorStop(1, 'rgba(99,102,241,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, hitY);
  gr = g.createRadialGradient(W * 0.85, hitY * 0.65, 0, W * 0.85, hitY * 0.65, W * 0.7); gr.addColorStop(0, 'rgba(14,165,233,.14)'); gr.addColorStop(1, 'rgba(14,165,233,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, hitY);
  g.fillStyle = 'rgba(0,0,0,.11)'; for (const m of G.blacks) { const r = G.keys.get(m); g.fillRect(r.x, 0, r.w, hitY); }
  g.lineWidth = 1;
  for (const m of G.whites) { const r = G.keys.get(m); g.strokeStyle = m % 12 === 0 ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.06)'; g.beginPath(); g.moveTo(r.x, 0); g.lineTo(r.x, hitY); g.stroke(); }
  gr = g.createLinearGradient(0, 0, 0, 90); gr.addColorStop(0, 'rgba(8,10,28,.7)'); gr.addColorStop(1, 'rgba(8,10,28,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, 90);
  // dégradés du clavier et de la ligne d'impact (coordonnées absolues, partagés par toutes les touches)
  const kb = G.kbH, bk = G.bkH;
  kbW = ctx.createLinearGradient(0, hitY, 0, H); kbW.addColorStop(0, '#ffffff'); kbW.addColorStop(0.85, '#e2e5f1'); kbW.addColorStop(1, '#b8bdd6');

  kbB = ctx.createLinearGradient(0, hitY, 0, hitY + bk); kbB.addColorStop(0, '#454556'); kbB.addColorStop(0.7, '#1b1b25'); kbB.addColorStop(1, '#0c0c12');
  kbShadow = ctx.createLinearGradient(0, hitY, 0, hitY + 12); kbShadow.addColorStop(0, 'rgba(0,0,0,.55)'); kbShadow.addColorStop(1, 'rgba(0,0,0,0)');
  beatBand = ctx.createLinearGradient(0, hitY - 36, 0, hitY); beatBand.addColorStop(0, 'rgba(56,189,248,0)'); beatBand.addColorStop(1, 'rgba(125,211,252,.55)');
}

function draw() {
  const { W, H, hitY, ppb } = G, now = performance.now();
  layers();
  const bt = Math.max(G.bad ? G.bad.t : 0, G.missT), bad = G.bad && now - G.bad.t < 350 ? G.bad : null;
  const shk = !RM && now - bt < 350 ? Math.sin(now * 0.12) * 3 * (1 - (now - bt) / 350) : 0;
  ctx.setTransform(dpr, 0, 0, dpr, shk * dpr, 0);
  ctx.fillStyle = '#080a1c'; ctx.fillRect(-6, 0, W + 12, H);
  ctx.drawImage(bgc, 0, 0, W, hitY);
  // pulsation sur le tempo (se fige quand le jeu attend la bonne touche)
  const mv = G.t !== G.pT; G.pT = G.t; G.pm += ((mv ? 1 : 0) - G.pm) * 0.08;
  const ph = G.t - Math.floor(G.t), pulse = RM ? 0.25 : 0.2 + (1 - ph) ** 3 * 0.8 * G.pm;
  ctx.globalAlpha = 0.12 + pulse * 0.2; ctx.drawImage(glowSpr('#38bdf8'), -W * 0.2, hitY - 180, W * 1.4, 360); ctx.globalAlpha = 1;
  // poussière d'étoiles (parallaxe)
  ctx.fillStyle = '#c7d2fe';
  for (let i = 0; i < 40; i++) {
    const d = DUST[i * 4 + 2], p = DUST[i * 4 + 3], y = ((DUST[i * 4 + 1] + (RM ? 0 : now * 0.00002 * d)) % 1) * hitY, x = DUST[i * 4] * W + (RM ? 0 : Math.sin(now * 0.0004 + p) * 6 * d), s = 1 + d * 1.6;
    ctx.globalAlpha = (0.12 + 0.3 * d) * (RM ? 1 : 0.65 + 0.35 * Math.sin(now * 0.002 + p)); ctx.fillRect(x, y, s, s);
  }
  // lignes de temps (défilent avec les notes), plus marquées à chaque mesure
  ctx.globalAlpha = 1; ctx.lineWidth = 1;
  const k0 = Math.floor(G.t);
  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = pass ? 'rgba(165,180,252,.2)' : 'rgba(165,180,252,.07)'; ctx.beginPath();
    for (let k = k0, y; (y = hitY - (k - G.t) * ppb) > 0; k++) if (y < hitY && (k % 4 === 0) === !!pass) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
  }
  // notes qui tombent
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, hitY); ctx.clip();
  hintSet.clear();
  if (!settings.recall || now - G.lastAct > 3000 || G.bad && now - G.bad.t < 3000) for (const n of expectedNow()) hintSet.add(n.m);
  // fenêtre visible : notes triées par début ; départ par dichotomie (s >= t - maxD), arrêt dès qu'une note est au-dessus de l'écran
  const NS = G.notes, tMax = G.t + (hitY + 4) / ppb, demo = G.mode === 'demo';
  let a = 0, b = NS.length; for (const lim = G.t - G.maxD; a < b;) { const mid = (a + b) >> 1; if (NS[mid].s < lim) a = mid + 1; else b = mid; }
  for (let i = a; i < NS.length; i++) {
    const n = NS[i]; if (n.s > tMax) break;
    const yb = hitY - (n.s - G.t) * ppb, yt = hitY - (n.s + n.d - G.t) * ppb;
    if (yb < -4 || yt > hitY) continue;
    const r = G.keys.get(n.m); if (!r) continue;
    const bh = Math.max(yb - yt - 8, 20), top = yb - bh;
    const bw = isBlack(n.m) ? r.w * 0.9 : r.w * 0.84, bx = r.x + (r.w - bw) / 2;
    const P = n.hit ? HITC : n.miss ? MISSC : !n.req ? GHOSTC : (HAND[n.h] || HAND.R), live = n.req && !n.hit && !n.miss;
    if (n.s <= G.t && G.t < n.s + n.d && (!n.req || demo || n.hit)) { G.kl[n.m] = now; G.kh[n.m] = n.h; } // touche allumée pendant la note
    const al = n.hit && !demo ? Math.max(0.25, 1 - (G.t - n.s) * 1.5) : settings.recall && !n.hit && !demo ? 0.15 : 1;
    ctx.globalAlpha = al * (n.req || demo ? 1 : 0.5);
    if (live) { // traînée de mouvement + halo
      ctx.globalAlpha = al * 0.35; ctx.drawImage(fadeSpr(P.b, true), bx + bw * 0.2, top - 54, bw * 0.6, 54);
      ctx.globalAlpha = al * 0.4; ctx.drawImage(glowSpr(P.b), bx - bw * 0.35, top - 14, bw * 1.7, bh + 28);
      ctx.globalAlpha = al;
    }
    ctx.fillStyle = P.b; rr(bx, top, bw, bh - 2, Math.min(8, bw / 2)); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.3)'; rr(bx + 2, top + 2, bw - 4, Math.min(bh * 0.4, 16), Math.min(6, bw / 2)); ctx.fill(); // reflet
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(bx + bw * 0.12, yb - 12, bw * 0.76, 3); // ombre du bas
    if (bh > 44) { ctx.fillStyle = P.l; ctx.globalAlpha = al * 0.28; rr(bx + bw * 0.3, top + 22, bw * 0.4, bh - 46, bw * 0.2); ctx.fill(); ctx.globalAlpha = al * (n.req || demo ? 1 : 0.5); } // corps lumineux des notes longues
    ctx.strokeStyle = P.l; ctx.lineWidth = 1.5; ctx.globalAlpha *= 0.7; rr(bx + 0.75, top + 0.75, bw - 1.5, bh - 3.5, Math.min(8, bw / 2)); ctx.stroke();
    ctx.globalAlpha = 1;
    if (n.f && bh >= 20 && bw > 14) {
      const fx = bx + bw / 2, fy = top + 13;
      ctx.fillStyle = FING[n.f] || '#fff'; ctx.beginPath(); ctx.arc(fx, fy, 10, 0, 7); ctx.fill();
      ctx.fillStyle = '#0b0e22'; ctx.font = '800 12px system-ui'; ctx.textAlign = 'center'; ctx.fillText(n.f, fx, fy + 4.5);
    }
    if (settings.names && bw > 16 && bh > (n.f ? 46 : 18)) {
      ctx.fillStyle = 'rgba(0,0,0,.72)'; ctx.font = `700 ${Math.min(13, bw * 0.5) | 0}px system-ui`; ctx.textAlign = 'center';
      ctx.fillText(NAMES[n.m % 12], bx + bw / 2, yb - 16);
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  // ligne d'impact
  ctx.globalAlpha = 0.5 + pulse * 0.5; ctx.fillStyle = beatBand; ctx.fillRect(0, hitY - 36, W, 36); ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(224,242,254,.75)'; ctx.fillRect(0, hitY - 2, W, 2);
  // faisceaux et halos des touches actives
  ctx.globalCompositeOperation = 'lighter';
  for (let q = 0; q < 2; q++) for (const m of q ? G.blacks : G.whites) {
    const gl = 1 - (now - G.kl[m]) / 300; if (!(gl > 0) && !pressed.has(m)) continue;
    const r = G.keys.get(m), c = (HAND[G.kh[m]] || { b: '#22d3ee' }).b, k = pressed.has(m) ? 1 : gl;
    ctx.globalAlpha = k * 0.3; ctx.drawImage(fadeSpr(c, true), r.x, hitY - 110, r.w, 110);
    ctx.globalAlpha = k * 0.4; ctx.drawImage(glowSpr(c), r.x + r.w / 2 - r.w * 1.1, hitY - r.w * 1.1, r.w * 2.2, r.w * 2.2);
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  // clavier : touches qui s'enfoncent et s'illuminent
  ctx.fillStyle = '#05060f'; ctx.fillRect(-6, hitY, W + 12, H - hitY + 4);
  const hp = 0.55 + 0.3 * Math.sin(now * 0.008);
  for (const m of G.whites) {
    const r = G.keys.get(m), pr = pressed.has(m), k = pr ? 1 : Math.max(0, 1 - (now - G.kl[m]) / 300), dy = 3 * k;
    ctx.fillStyle = kbW; rr(r.x + 0.5, hitY + dy, r.w - 1, G.kbH - dy, [0, 0, 5, 5]); ctx.fill();
    if (k > 0) { ctx.globalAlpha = k * 0.5; ctx.fillStyle = (HAND[G.kh[m]] || { b: '#22d3ee' }).b; ctx.fillRect(r.x + 0.5, hitY + dy, r.w - 1, G.kbH - dy); ctx.globalAlpha = 1; }
    else if (hintSet.has(m)) { ctx.globalAlpha = RM ? 0.8 : hp; ctx.fillStyle = '#fbbf24'; rr(r.x + 0.5, hitY, r.w - 1, G.kbH, [0, 0, 5, 5]); ctx.fill(); ctx.globalAlpha = 1; }
    if (settings.names && (r.w > 20 || m % 12 === 0)) {
      ctx.fillStyle = '#64748b'; ctx.font = `${Math.min(11, r.w * 0.45) | 0}px system-ui`; ctx.textAlign = 'center';
      ctx.fillText(r.w > 20 ? NAMES[m % 12] : 'Do' + (Math.floor(m / 12) - 1), r.x + r.w / 2, H - 8 + dy * 0.5);
    }
  }
  for (const m of G.blacks) {
    const r = G.keys.get(m), pr = pressed.has(m), k = pr ? 1 : Math.max(0, 1 - (now - G.kl[m]) / 300), dy = 2 * k;
    ctx.fillStyle = kbB; rr(r.x, hitY + dy, r.w, G.bkH - dy, [0, 0, 4, 4]); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(r.x + r.w * 0.16, hitY + dy, r.w * 0.2, G.bkH * 0.78);
    if (k > 0) { ctx.globalAlpha = k * 0.75; ctx.fillStyle = (HAND[G.kh[m]] || { b: '#22d3ee' }).b; rr(r.x, hitY + dy, r.w, G.bkH - dy, [0, 0, 4, 4]); ctx.fill(); ctx.globalAlpha = 1; }
    else if (hintSet.has(m)) { ctx.globalAlpha = RM ? 0.8 : hp; ctx.fillStyle = '#f59e0b'; rr(r.x, hitY, r.w, G.bkH, [0, 0, 4, 4]); ctx.fill(); ctx.globalAlpha = 1; }
  }
  ctx.fillStyle = kbShadow; ctx.fillRect(0, hitY, W, 12);
  // colonne rouge doux sur fausse note / note ratée
  if (bad) { const r = G.keys.get(bad.m); if (r) { ctx.globalAlpha = 0.28 * (1 - (now - bad.t) / 350); ctx.fillStyle = '#f87171'; ctx.fillRect(r.x, 0, r.w, hitY); ctx.globalAlpha = 1; } }
  if (G.missFx && now - G.missFx.t < 400) { const r = G.keys.get(G.missFx.m); if (r) { ctx.globalAlpha = 0.2 * (1 - (now - G.missFx.t) / 400); ctx.fillStyle = '#f87171'; ctx.fillRect(r.x, 0, r.w, hitY); ctx.globalAlpha = 1; } }
  // anneaux et étincelles (600 ms)
  for (let i = G.rings.length - 1; i >= 0; i--) {
    const p = G.rings[i], k = (now - p.t) / 600; if (k >= 1) { G.rings.splice(i, 1); continue; }
    ctx.strokeStyle = p.c || '#34d399'; ctx.globalAlpha = 1 - k; ctx.lineWidth = 3 * (1 - k) + 1; ctx.beginPath(); ctx.arc(p.x, p.y, 8 + ease(k) * 40, 0, 7); ctx.stroke();
    ctx.globalAlpha = (1 - k) * 0.5; ctx.beginPath(); ctx.arc(p.x, p.y, 4 + ease(k) * 22, 0, 7); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'lighter';
  for (let i = G.parts.length - 1; i >= 0; i--) {
    const p = G.parts[i], s = (now - p.t) / 1000, k = s / 0.6; if (k >= 1) { partPool.push(p); G.parts.splice(i, 1); continue; }
    const z = 9 * (1 - k * 0.6); ctx.globalAlpha = 1 - k;
    ctx.drawImage(glowSpr(p.c), p.x + p.vx * s - z / 2, p.y + p.vy * s + 400 * s * s - z / 2, z, z);
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  // retour visuel Parfait / Bien / Raté : texte qui monte, pop, halo et flash
  ctx.lineJoin = 'round';
  if (G.flash && now < G.flash.until) {
    const f = G.flash, age = now - f.from, al = Math.min(1, (f.until - now) / 300);
    const pop = RM ? 1 : 1 + 0.45 * Math.max(0, 1 - age / 180), y = hitY - 44 - (RM ? 0 : ease(Math.min(1, age / 450)) * 34);
    if (!RM && age < 260) { ctx.globalAlpha = (1 - age / 260) * 0.4; ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowSpr(f.color), 0, hitY - 90, W, 180); ctx.globalCompositeOperation = 'source-over'; }
    ctx.globalAlpha = al; ctx.font = `800 ${(28 * pop) | 0}px system-ui`; ctx.textAlign = 'center';
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(5,7,20,.85)'; ctx.strokeText(f.text, W / 2, y); ctx.fillStyle = f.color; ctx.fillText(f.text, W / 2, y); ctx.globalAlpha = 1;
  }
  // compteur de combo : grossit tous les 5, paliers 10/25/50 (flammes aux deux derniers)
  const tier = G.streak >= 50 ? 3 : G.streak >= 25 ? 2 : G.streak >= 10 ? 1 : 0;
  if (tier > G.tier) G.tierT = now; G.tier = tier;
  if (G.streak >= 3 && !demo) {
    const pop = RM ? 0 : Math.max(0, 1 - (now - G.pop) / 250) * 0.25, size = 20 + Math.min(G.streak, 50) / 5 * 3 + tier * 4, cy = 84 + size / 2, tc = COMBOC[tier];
    if (tier >= 2 && !RM) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) {
        const u = ((now * 0.0012 * (0.8 + (i % 3) * 0.25) + i * 0.37) % 1), fx = W / 2 + (i - 3) * size * 0.42 + Math.sin(now * 0.006 + i) * 4, fs = size * (0.9 + 0.5 * tier / 3) * (1 - u * 0.7);
        ctx.globalAlpha = (1 - u) * 0.7; ctx.drawImage(glowSpr(i % 2 ? '#f97316' : tier === 3 ? '#fde047' : '#fb923c'), fx - fs / 2, cy - size * 0.2 - u * size * 1.4 - fs / 2, fs, fs);
      }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = 0.18 + tier * 0.08; ctx.drawImage(glowSpr(tc), W / 2 - size * 2.4, cy - size * 1.5, size * 4.8, size * 3); ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.font = '700 11px system-ui'; ctx.fillStyle = 'rgba(203,213,225,.8)'; ctx.fillText('COMBO', W / 2, cy - size * 0.62);
    ctx.font = `800 ${(size * (1 + pop)) | 0}px system-ui`; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(5,7,20,.8)'; ctx.strokeText(`x${G.streak}`, W / 2, cy + size * 0.35); ctx.fillStyle = tc; ctx.fillText(`x${G.streak}`, W / 2, cy + size * 0.35);
    if (!RM && now - G.tierT < 600) { const k = (now - G.tierT) / 600; ctx.strokeStyle = tc; ctx.globalAlpha = 1 - k; ctx.lineWidth = 4 * (1 - k) + 1; ctx.beginPath(); ctx.arc(W / 2, cy, size + ease(k) * size * 3, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
  }
  // décompte 3 2 1 puis « Go ! »
  const rem = G.notes[0].s - G.t, cd = Math.ceil(rem - 1e-6);
  if (!demo && ((cd >= 1 && cd <= 3) || (G.mode === 'rhythm' && rem <= 0 && rem > -0.6))) {
    const go = cd < 1, k = go ? -rem / 0.6 : cd - rem, txt = go ? 'Go !' : cd, sc = RM ? 1 : go ? 1 + k * 0.5 : 1.6 - 0.6 * ease(Math.min(1, k * 3)), cy = hitY * 0.45;
    ctx.globalAlpha = go ? 1 - k : 1 - k * k; ctx.font = `800 ${(go ? 80 : 110) * sc | 0}px system-ui`; ctx.textAlign = 'center'; ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(5,7,20,.8)'; ctx.strokeText(txt, W / 2, cy); ctx.fillStyle = go ? '#34d399' : '#fff'; ctx.fillText(txt, W / 2, cy);
    if (!RM) { ctx.strokeStyle = go ? '#34d399' : '#38bdf8'; ctx.lineWidth = 3; ctx.globalAlpha *= 0.6; ctx.beginPath(); ctx.arc(W / 2, cy - 36, 50 + ease(k) * 130, 0, 7); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  // progression du morceau : filet lumineux sur le bord droit
  const pg = Math.max(0, Math.min(1, (G.t - G.notes[0].s + 3) / (G.end - G.notes[0].s + 3))), y0 = 60, y1 = hitY - 10, py = y0 + (y1 - y0) * pg;
  ctx.fillStyle = 'rgba(165,180,252,.18)'; ctx.fillRect(W - 4, y0, 2, y1 - y0);
  ctx.fillStyle = '#38bdf8'; ctx.fillRect(W - 4, y0, 2, py - y0); ctx.globalAlpha = 0.9; ctx.drawImage(glowSpr('#7dd3fc'), W - 15, py - 11, 22, 22); ctx.globalAlpha = 1;
  // HUD : DOM écrit seulement si la valeur change
  const hs = G.mode === 'demo' ? 'Démo' : `${G.hits}/${G.total}` + (G.streak > 2 ? ` · 🔥${G.streak}` : '');
  const bw2 = (pg * 100).toFixed(1) + '%';
  if (G.hud[0] !== hs) $('#hudScore').textContent = G.hud[0] = hs;
  if (G.hud[1] !== bw2) $('#bar').style.width = G.hud[1] = bw2;
}

let micFrame = 0, slowT = 0, slowN = 0;
function loop(now) {
  if (!G) return;
  const raw = now - G.last, dt = Math.min(0.1, raw / 1000); G.last = now;
  // dpr adaptatif : moyenne > 24 ms sur 2 s => plafond 1.5 (frames d'au plus 100 ms comptées, pause ignorée)
  if (!G.paused && raw < 100) { slowT += raw; slowN++; if (slowT >= 2000) { if (slowT / slowN > 24 && dprCap > 1.5) { dprCap = 1.5; resize(); } slowT = 0; slowN = 0; } }
  if (!G.paused) { G.secs += dt; update(dt); if (G && ++micFrame % 3 === 0) micTick(); }
  if (G) { draw(); requestAnimationFrame(loop); }
}

$('#pauseBtn').onclick = pauseGame;
$('#resume').onclick = () => { G.paused = false; startAccomp(G.notes, G.song); G.last = G.lastAct = performance.now(); $('#pause').hidden = true; };
$('#quit').onclick = () => { learn.onTime(G.secs); learn.refresh(); G.mode = 'demo'; G.paused = false; $('#pause').hidden = true; G.t = Infinity; $('#home').hidden = false; $('#game').hidden = true; stopAccomp(); G = null; stopMic(); stopAuto(); endRec(false); held.forEach(v => v.off()); held.clear(); pressed.clear(); };

renderHome();
learn.init({ store, begin });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
if (/[?&]debug=1/.test(location.search) || ['localhost', '127.0.0.1'].includes(location.hostname)) window.__sp = { get G() { return G; }, setLat(v) { micLat = +v; store.set('sp.micLat', micLat); }, press, startGame, settings, library: () => library };

/* Panneaux : Échap ferme, focus initial puis restitué à l'élément déclencheur */
{
  const panels = ['modal', 'prefs', 'setup', 'composer'].map(id => document.getElementById(id)).filter(Boolean);
  const opener = new Map();
  const obs = new MutationObserver(ms => ms.forEach(({ target: el }) => {
    if (!el.hidden) {
      if (!opener.has(el)) opener.set(el, document.activeElement);
      setTimeout(() => (el.querySelector('input:not([type=hidden]),select,textarea,button') || el).focus?.(), 0);
    } else if (opener.has(el)) { const o = opener.get(el); opener.delete(el); if (o && o.isConnected && o.focus) o.focus(); }
  }));
  panels.forEach(el => { obs.observe(el, { attributes: true, attributeFilter: ['hidden'] }); if (!el.hasAttribute('tabindex')) el.tabIndex = -1; });
  addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = panels.filter(el => !el.hidden).pop();
    if (open) { e.preventDefault(); open.hidden = true; }
  });
  const hs = document.getElementById('hudScore'); if (hs) hs.setAttribute('aria-live', 'polite');
}
