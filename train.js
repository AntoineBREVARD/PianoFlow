// Onglet « Entraîner » : accords (lettres américaines) en séries de 8 + accès à la lecture de notes.
import { ic } from './ui.js';
import { CHORDS, question, validate, schedule, isFast, session, unlocked, boxOf, mastered, dkey } from './chords.js';

const KEY = 'sp.chords', XP_MAX_DAY = 40;
let S, root, run, q, err, t0, locked, epoch = 0;
const sel = new Set();
const st = () => S.get(KEY, { cards: {} });
const day = dkey;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function mount(el, store) {
  // l'écriture d'un état d'entraînement vaut « entraîné aujourd'hui » (compté dans la séance du jour par learn.js)
  const log = () => store.set('sp.trainLog', { d: dkey() });
  // trainLog = « entraîné aujourd'hui » : écrit seulement pour une vraie réponse (chords ici ; reading/ear appellent S.log)
  S = { get: (k, d) => store.get(k, d), set: (k, v) => { const r = store.set(k, v); if (k === KEY) log(); return r; }, log };
  root = el; midiOff();
  const go = store.get('sp.trainGo', null); // lancé depuis la « Séance du jour »
  if (go) store.set('sp.trainGo', null);
  menu();
  if (go === 'chords') start(); else if (go === 'reading') reading(); else if (go === 'ear') ear();
}

/* ---------- petit synthé local (le synthé de app.js n'est pas exporté) ---------- */
let ac;
function beep(m) {
  try {
    ac ||= new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume();
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle'; o.frequency.value = 440 * 2 ** ((m - 69) / 12);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 1.3);
  } catch { /* pas d'audio : tant pis */ }
}

/* ---------- menu ---------- */
function menu() {
  midiOff();
  const s = st(), u = unlocked(s), due = u.filter(c => s.cards[c.sym] && s.cards[c.sym].due <= Date.now()).length;
  root.innerHTML = `<div class="card"><h2>${ic('bolt', 24)} Entraîner</h2>
    <p class="statpills"><span><b>${u.length}</b>/${CHORDS.length} accords débloqués</span><span><b>${mastered(s).length}</b> maîtrisés</span><span><b>${due}</b> à réviser</span></p>
    <div class="tiles"><button class="tile t1" id="trChords"><span class="ti">${ic('keys', 26)}</span><span class="tt"><b>Accords</b><small>Retrouve les notes d'un accord (lettres)</small></span>${ic('play', 16, 'chev')}</button><button class="tile t2" id="trRead"><span class="ti">${ic('eye', 26)}</span><span class="tt"><b>Lecture de notes</b><small>Apprends à lire la portée, pas à pas</small></span>${ic('play', 16, 'chev')}</button><button class="tile t3" id="trEar"><span class="ti">${ic('ear', 26)}</span><span class="tt"><b>Oreille</b><small>Reconnais intervalles et rythmes</small></span>${ic('play', 16, 'chev')}</button></div></div>`;
  root.querySelector('#trChords').onclick = start;
  root.querySelector('#trRead').onclick = reading;
  root.querySelector('#trEar').onclick = ear;
}
function ear() {
  root.innerHTML = `<button id="trBack" class="ghost">${ic('back', 18)} Menu</button><div id="trEarBox" style="margin-top:10px"></div>`;
  root.querySelector('#trBack').onclick = menu;
  const box = root.querySelector('#trEarBox');
  import('./ear.js').then(m => m.mount(box, S)).catch(() => { box.innerHTML = '<div class="card">Bientôt disponible.</div>'; });
}
function reading() {
  root.innerHTML = `<button id="trBack" class="ghost">${ic('back', 18)} Menu</button><div id="trReadBox" style="margin-top:10px"></div>`;
  root.querySelector('#trBack').onclick = menu;
  const box = root.querySelector('#trReadBox');
  import('./reading.js').then(m => m.mount(box, S)).catch(() => { box.innerHTML = '<div class="card">Bientôt disponible.</div>'; });
}

/* ---------- série d'accords ---------- */
function start() { run = { qs: session(st()), i: 0, ok: 0, xp: 0, bad: [], seen: new Set() }; next(); }
function next() {
  midiOff();
  if (run.i >= run.qs.length) return recap();
  q = question(run.qs[run.i]); err = 0; sel.clear(); locked = false; t0 = Date.now();
  // rappel actif : accords en boîte >= 3, clavier masqué
  // Web MIDI (si dispo) valide l'accord joué sur le vrai piano ; sinon / en repli : auto-évaluation.
  const recall = boxOf(st(), q.sym) >= 3;
  root.innerHTML = `<div class="card" style="text-align:center">
    <div class="qtop"><span>Question ${run.i + 1} / ${run.qs.length}</span><span>${run.ok} juste${run.ok > 1 ? 's' : ''}</span></div><div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${run.qs.length}" aria-valuenow="${run.i}"><div style="width:${run.i / run.qs.length * 100}%"></div></div>
    <div class="chord">${esc(q.sym)}</div>
    <div class="muted">${esc(q.name)}</div>
    <p id="trMsg" aria-live="polite" style="min-height:2.6em">${recall ? "Joue cet accord sur ton piano, sans clavier à l'écran." : "Touche les notes de l'accord."}</p>
    <div id="trKb" ${recall ? 'hidden' : ''}>${kbd()}</div>
    <div class="actions" id="trAct">${recall ? '<button class="primary" id="trPlayed">Je l\'ai joué</button>' : '<button id="trClr">Effacer</button><button class="primary" id="trOk">Valider</button>'}</div>
    <p><button id="trQuit" class="ghost" style="min-height:44px;font-size:14px">Quitter la série</button></p></div>`;
  root.querySelector('#trQuit').onclick = menu;
  if (recall) {
    midiOn(held => {
      if (locked || held.size < q.size) return;
      if (validate(q.chord, [...held])) { midiOff(); settle(true, isFast(Date.now() - t0)); nextBtn(`✓ Bien joué sur ton piano : ${q.names.join(' · ')}`); }
      else msg('Pas tout à fait : relâche tout et rejoue ' + (q.chord.bass != null ? `en commençant par ${q.root}` : `depuis ${q.root}`) + ' (ou utilise « Je l\'ai joué »).');
    });
    root.querySelector('#trPlayed').onclick = () => {
      midiOff(); show(q.chord.notes); root.querySelector('#trKb').hidden = false; locked = true;
      msg(`Notes : ${q.names.join(' · ')}. Tu l'avais ?`);
      const a = root.querySelector('#trAct'); a.innerHTML = '<button id="trYes" class="primary">Oui</button><button id="trNo">À revoir</button>';
      a.querySelector('#trYes').onclick = () => { settle(true, isFast(Date.now() - t0)); nextBtn('✓ Super.'); };
      a.querySelector('#trNo').onclick = () => { settle(false, false); nextBtn('Pas de souci, on le reverra.'); };
    };
    return;
  }
  const hit = m => {
    if (!m || locked) return;
    if (sel.delete(m)) return paint();
    sel.add(m); beep(m); paint();
    if (sel.size >= q.size) check(); // accord « complet » : validation automatique
  };
  const kb = root.querySelector('#trKb svg');
  kb.addEventListener('pointerdown', e => { const m = +e.target.dataset?.m; if (!m) return; e.preventDefault(); hit(m); });
  kb.addEventListener('keydown', e => { const m = +e.target.dataset?.m; if (m && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); hit(m); } });
  root.querySelector('#trClr').onclick = () => { sel.clear(); paint(); };
  root.querySelector('#trOk').onclick = check;
}
/* ---------- Web MIDI : notes maintenues sur le vrai piano ---------- */
let midiIns = [];
function midiOff() { epoch++; midiIns.forEach(i => { i.onmidimessage = null; }); midiIns = []; }
function midiOn(cb) {
  if (!navigator.requestMIDIAccess) return;
  const held = new Set(), my = epoch;
  navigator.requestMIDIAccess().then(a => {
    if (locked || my !== epoch) return;
    midiOff(); midiIns = [...a.inputs.values()];
    midiIns.forEach(i => { i.onmidimessage = e => {
      const [c, n, v] = e.data, on = (c & 0xf0) === 0x90 && v > 0;
      if (on) { held.add(n); cb(held); } else if ((c & 0xf0) === 0x80 || (c & 0xf0) === 0x90) held.delete(n);
    }; });
    if (midiIns.length) msg("Joue cet accord sur ton piano (détecté en MIDI), ou utilise « Je l'ai joué ».");
  }).catch(() => { /* MIDI refusé : auto-évaluation */ });
}
const msg = t => { const m = root.querySelector('#trMsg'); if (m) m.textContent = t; };
function paint() { root.querySelectorAll('#trKb [data-m]').forEach(k => k.classList.toggle('on', sel.has(+k.dataset.m))); }
function show(notes) { // surligne les classes de hauteur de l'accord (octave libre)
  const p = new Set(notes.map(m => m % 12));
  root.querySelectorAll('#trKb [data-m]').forEach(k => k.classList.toggle('hint', p.has(k.dataset.m % 12)));
}
function check() {
  if (locked || !sel.size) return;
  if (validate(q.chord, [...sel])) { settle(true, err === 0 && isFast(Date.now() - t0)); return nextBtn(`✓ Bien joué : ${q.names.join(' · ')}`); }
  err++; sel.clear(); paint();
  const bass = q.chord.bass != null ? `joue d'abord la note la plus grave (${q.root})` : `commence par la fondamentale (${q.root})`;
  if (err === 1) msg('Pas tout à fait, essaie encore : ' + bass + '.');
  else if (err === 2) { msg(`Un coup de pouce, les notes : ${q.names.join(' · ')}`); show(q.chord.notes); }
  else { show(q.chord.notes); settle(false, false); nextBtn(`On le reverra bientôt. Les notes : ${q.names.join(' · ')}`); }
}
function settle(ok, fast) {
  locked = true;
  const s = st();
  if (!(ok && run.seen.has(q.sym))) schedule(s, q.sym, ok, fast); // une carte ne monte qu'une fois par série
  run.seen.add(q.sym);
  if (ok) { run.ok++; run.xp += bump(s); } else run.bad.push(q.sym);
  S.set(KEY, s);
}
function bump(s) { // +1 XP par bonne réponse, plafonné par jour ; profil partagé avec learn.js
  if (s.xpDay?.d !== day()) s.xpDay = { d: day(), n: 0 };
  if (s.xpDay.n >= XP_MAX_DAY) return 0;
  s.xpDay.n++;
  const p = S.get('sp.profile', { xp: 0, hits: 0, badges: {} }); p.xp += 1; S.set('sp.profile', p);
  return 1;
}
function nextBtn(m) {
  msg(m); root.querySelector('#trAct').innerHTML = `<button class="primary" id="trNext">${run.i + 1 >= run.qs.length ? 'Terminer' : 'Suivant'}</button>`;
  root.querySelector('#trNext').onclick = () => { run.i++; next(); };
}
function recap() {
  const s = st(), m = mastered(s).map(c => c.sym), bad = [...new Set(run.bad)];
  root.innerHTML = `<div class="card" style="text-align:center"><h2 style="justify-content:center">Série terminée</h2>
    <div class="score">${run.ok} / ${run.qs.length}</div>
    <p>+${run.xp} XP</p>
    <p>${m.length ? 'Accords maîtrisés : <b>' + m.map(esc).join(', ') + '</b>' : "Aucun accord maîtrisé pour l'instant : c'est normal, la répétition fait le travail."}</p>
    ${bad.length ? '<p class="muted">À retravailler : ' + bad.map(esc).join(', ') + '</p>' : ''}
    <div class="actions"><button class="primary" id="trAgain">Rejouer</button><button id="trMenu">Menu</button></div></div>`;
  root.querySelector('#trAgain').onclick = start; root.querySelector('#trMenu').onclick = menu;
}

/* ---------- mini-clavier SVG, 2 octaves (C4 à B5) ---------- */
const LET = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'], FRN = ['do', 'do dièse', 'ré', 'ré dièse', 'mi', 'fa', 'fa dièse', 'sol', 'sol dièse', 'la', 'la dièse', 'si'];
const a11y = m => `tabindex="0" role="button" aria-label="${LET[m % 12]}${Math.floor(m / 12) - 1}, ${FRN[m % 12]}"`;
function kbd() {
  let w = '', b = '', x = 0;
  for (let m = 60; m <= 83; m++) {
    if ([1, 3, 6, 8, 10].includes(m % 12)) b += `<rect class="bk" ${a11y(m)} data-m="${m}" x="${x * 40 - 12}" y="0" width="24" height="92" rx="3"/>`;
    else { w += `<rect class="wk" ${a11y(m)} data-m="${m}" x="${x * 40}" y="0" width="40" height="150" rx="4"/>`; x++; }
  }
  return `<svg viewBox="0 0 560 150" role="group" aria-label="Clavier" style="width:100%;touch-action:manipulation;user-select:none">${w}${b}</svg>`;
}
