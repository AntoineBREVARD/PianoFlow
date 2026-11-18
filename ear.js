// Oreille : 5 paliers (haut/bas, intervalles, accords, mélodie, pulsation), Leitner sous 'sp.ear'.
import { ic } from './ui.js';
import { keyLabel, wireKeys } from './reading.js';
export const SESSION = 10, PASS = 0.8, DAYS = [1, 3, 7, 14, 30];
const DAY = 864e5;

export const INTERVALS = {
  sec: { semi: 2, name: 'Seconde', feel: 'Deux notes voisines : un tout petit pas.', song: '« Au clair de la lune » : le pas entre « de » et « la » (Do → Ré).' },
  t3m: { semi: 3, name: 'Tierce mineure', feel: 'Un petit saut, un peu triste ou doux.', song: '« Greensleeves » : « A-las » (La → Do).' },
  t3M: { semi: 4, name: 'Tierce majeure', feel: 'Un saut moyen, clair et joyeux.', song: '« Quand les saints » (« Oh when the saints ») : Do → Mi.' },
  q4: { semi: 5, name: 'Quarte', feel: 'Un saut franc, stable, comme une fanfare.', song: '« La Marseillaise » : « Al-lons » (Sol → Do).' },
  q5: { semi: 7, name: 'Quinte', feel: 'Un grand saut, ouvert et solide.', song: '« Ah ! vous dirai-je, maman » (Brille, brille petite étoile) : Do Do → Sol Sol.' },
  oct: { semi: 12, name: 'Octave', feel: 'La même note, en plus aiguë : comme deux voix qui se répondent.', song: 'Chante la première note puis la seconde : tu retrouves la même note, plus haut.' },
};
export const CHORD_KINDS = {
  maj: { notes: [0, 4, 7], name: 'Majeur', hint: 'Majeur : un son clair, ouvert, plutôt joyeux.' },
  min: { notes: [0, 3, 7], name: 'Mineur', hint: 'Mineur : un son plus sombre, doux, pensif.' },
  sept: { notes: [0, 4, 7, 10], name: 'Septième', hint: 'Septième : un accord majeur avec une note en plus qui « attend la suite ».' },
};
export const PALIERS = [
  { title: 'Haut ou bas ?', intro: 'Deux notes : la seconde est-elle plus haute ou plus basse ?', keys: ['up', 'down'] },
  { title: 'Les intervalles', intro: 'Deux notes montantes : quel écart entre elles ? Chaque intervalle a sa chanson-repère.', keys: Object.keys(INTERVALS) },
  { title: 'Majeur ou mineur ?', intro: 'Écoute la couleur d\'un accord : clair (majeur) ou sombre (mineur). Un accord de septième apparaît ensuite.', keys: ['maj', 'min', 'sept'] },
  { title: 'Reproduire une mélodie', intro: 'Écoute 3 à 5 notes, puis rejoue-les sur le mini-clavier. Réécoute autant que tu veux.', keys: ['mel3', 'mel4', 'mel5'] },
  { title: 'Pulsation', intro: 'Le clic donne le tempo : après 4 clics d\'intro, tape régulièrement au rythme (8 fois).', keys: ['slow', 'mid'] },
];
const BPM = { slow: 60, mid: 84 };
const SCALE = [0, 2, 4, 5, 7, 9, 11];
export const MEL_LO = 60, MEL_HI = 83;

const pick = (a, rng) => a[Math.floor(rng() * a.length)];

/* ---------- état et Leitner ---------- */
export const newState = () => ({ best: [], cards: {} });
// état lu du stockage : tolère cards/best null ou de mauvais type, boîtes hors 0-4
export function fix(S) {
  if (!S.cards || typeof S.cards !== 'object') S.cards = {};
  if (!Array.isArray(S.best)) S.best = [];
  for (const k in S.cards) { const c = S.cards[k]; if (!c || typeof c !== 'object') delete S.cards[k]; else { c.box = Number.isFinite(+c.box) ? Math.min(4, Math.max(0, Math.trunc(+c.box))) : 0; if (!Number.isFinite(+c.due)) c.due = 0; } }
  return S;
}
export const unlocked = (S, i) => i === 0 || (fix(S).best[i - 1] ?? 0) >= PASS;
export function record(S, p, key, ok, now = Date.now()) {
  fix(S); const id = 'p' + p + ':' + key, c = S.cards[id] || { box: 0, due: 0 };
  c.box = ok ? Math.min(4, c.box + 1) : 0; c.due = now + DAYS[c.box] * DAY; S.cards[id] = c; return c;
}
export function pickKey(S, p, now, rng, last, pool = PALIERS[p].keys) {
  fix(S);
  let c = pool.filter(k => k !== last); if (!c.length) c = pool;
  const card = k => S.cards['p' + p + ':' + k];
  const due = c.filter(k => !card(k) || !(card(k).due > now));
  const src = due.length ? due : c, m = Math.min(...src.map(k => card(k)?.box ?? 0));
  return pick(src.filter(k => (card(k)?.box ?? 0) === m), rng);
}
export function finish(S, p, right, total) {
  fix(S);
  const pct = total ? right / total : 0, was = unlocked(S, p + 1) || p === PALIERS.length - 1;
  S.best[p] = Math.max(S.best[p] ?? 0, pct);
  return { pct, pass: pct >= PASS, newUnlock: pct >= PASS && !was && p < PALIERS.length - 1 };
}

/* ---------- questions ---------- */
export function question(S, p, n, rng = Math.random, last = null, now = Date.now()) {
  const pool = p === 2 && n < 6 ? ['maj', 'min'] : PALIERS[p].keys, key = pickKey(S, p, now, rng, last, pool), q = { p, n, key };
  if (p === 0) {
    const a = 60 + Math.floor(rng() * 12), d = 2 + Math.floor(rng() * 8), up = key === 'up';
    Object.assign(q, { mode: 'seq', notes: up ? [a, a + d] : [a + d, a], answer: key,
      choices: [['up', '⬆ Plus haut'], ['down', '⬇ Plus bas']],
      hints: ['Haut = vers la droite du piano, bas = vers la gauche.', 'Chante les deux notes : ta voix monte-t-elle ou descend-elle ?'] });
  } else if (p === 1) {
    const a = 55 + Math.floor(rng() * 10), I = INTERVALS[key];
    Object.assign(q, { mode: 'seq', notes: [a, a + I.semi], answer: key, choices: Object.entries(INTERVALS).map(([k, v]) => [k, v.name]), hints: [I.feel, 'Chanson-repère : ' + I.song] });
  } else if (p === 2) {
    const r = 55 + Math.floor(rng() * 8), C = CHORD_KINDS[key], ids = n < 6 ? ['maj', 'min'] : ['maj', 'min', 'sept'];
    Object.assign(q, { mode: 'chord', notes: C.notes.map(x => r + x), answer: key, choices: ids.map(k => [k, CHORD_KINDS[k].name]),
      hints: [CHORD_KINDS[ids[0]].hint + ' ' + CHORD_KINDS[ids[1]].hint, C.hint] });
  } else if (p === 3) {
    const len = +key.slice(3); let d = Math.floor(rng() * 8), notes = [];
    const midi = i => 60 + 12 * Math.floor(i / 7) + SCALE[((i % 7) + 7) % 7];
    for (let i = 0; i < len; i++) { notes.push(midi(d)); d += (rng() < 0.5 ? -1 : 1) * (1 + Math.floor(rng() * 2)); d = Math.max(0, Math.min(13, d)); }
    Object.assign(q, { mode: 'melody', notes, answer: notes, hints: ['Les notes sont voisines : elles montent ou descendent par petits pas.', 'La première note est allumée sur le clavier.'] });
  } else {
    Object.assign(q, { mode: 'rhythm', bpm: BPM[key], answer: null, hints: ['Compte « 1, 2, 3, 4 » avec les clics, puis tape sur chaque clic.', 'Tape doucement, sans te presser : la régularité compte plus que la précision.'] });
  }
  return q;
}
export const checkChoice = (q, id) => id === q.answer;
// 'ok' (bonne note, suite), 'done' (mélodie finie), 'bad'
export const melodyStep = (q, idx, midi) => q.answer[idx] !== midi ? 'bad' : idx + 1 >= q.answer.length ? 'done' : 'ok';
// taps en ms ; au moins 6 taps, ≥ 70 % d'intervalles à ±25 % de la période (pas de latence à régler)
export function rhythmJudge(taps, period) {
  const iv = taps.slice(1).map((t, i) => t - taps[i]), good = iv.filter(x => Math.abs(x / period - 1) <= 0.25).length;
  return { ok: taps.length >= 6 && iv.length > 0 && good / iv.length >= 0.7, good, total: iv.length };
}

/* ---------- synthé local doux ---------- */
let ac;
const hz = m => 440 * 2 ** ((m - 69) / 12);
function tone(m, at, dur = 0.7, vol = 0.14, type = 'sine') {
  try {
    ac ||= new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume();
    const t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = type; o.frequency.value = hz(m); f.type = 'lowpass'; f.frequency.value = 1800;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + 0.05);
  } catch { /* audio indisponible : l'exercice reste faisable à l'œil */ }
}
export function play(q) {
  if (q.mode === 'chord') { q.notes.forEach(m => tone(m, 0, 1.3, 0.1)); q.notes.forEach((m, i) => tone(m, 1.5 + i * 0.3, 0.8, 0.1)); }
  else q.notes.forEach((m, i) => tone(m, i * 0.75, 0.9));
}
const click = acc => tone(acc ? 88 : 81, 0, 0.12, 0.12, 'triangle');

/* ---------- UI ---------- */
const CSS = `.ea{color:var(--fg);display:flex;flex-direction:column;gap:10px}.ea *{box-sizing:border-box}
.ea-card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px}.ea button{font:inherit;color:var(--fg);background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 12px;cursor:pointer;min-height:44px}
.ea button.ea-pri{background:var(--acc);color:#fff;border-color:var(--acc)}.ea button:disabled{opacity:.45;cursor:default}.ea-pal{display:flex;gap:10px;align-items:center;text-align:left;width:100%;margin-top:8px}
.ea-pal small,.ea small{color:var(--mut);display:block}.ea-head{display:flex;justify-content:space-between;align-items:center;gap:8px}.ea-bar{height:8px;background:var(--line);border-radius:4px;overflow:hidden}.ea-bar>div{height:100%;background:var(--acc2);transition:width .3s}
.ea-ch{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px}.ea-ch button.ea-no{opacity:.4;text-decoration:line-through}.ea-ch button.ea-yes{border-color:var(--acc2);box-shadow:0 0 0 2px var(--acc2) inset}
.ea-msg{min-height:3em}.ea-tap{width:100%;min-height:120px;font-size:20px}.ea-pulse{width:16px;height:16px;border-radius:50%;background:var(--acc2);display:inline-block;opacity:.3}.ea-pulse.on{opacity:1}
.ea-kb{width:100%;height:auto;touch-action:manipulation;user-select:none}.ea-w{fill:#fff;stroke:#555}.ea-b{fill:#222}.ea-lit{fill:var(--acc2)}.ea-wrong{fill:#e9a}.ea-k{cursor:pointer}
@media (prefers-reduced-motion:reduce){.ea *{transition:none!important;animation:none!important}}`;

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
function keyboardSvg(lit, bad) {
  const W = 30, whites = [], blacks = []; let wi = 0;
  for (let m = MEL_LO; m <= MEL_HI; m++) { const pc = m % 12; if ([1, 3, 6, 8, 10].includes(pc)) blacks.push([m, wi * W - 9]); else { whites.push([m, wi * W]); wi++; } }
  const cls = (m, base) => base + (m === lit ? ' ea-lit' : '') + (m === bad ? ' ea-wrong' : '');
  return `<svg class="ea-kb" viewBox="0 0 ${wi * W} 110" role="group" aria-label="Mini-clavier de deux octaves">` +
    whites.map(([m, x]) => `<g class="ea-k" tabindex="0" role="button" aria-label="${keyLabel(m)}" data-midi="${m}"><rect class="${cls(m, 'ea-w')}" x="${x}" y="0" width="${W}" height="110" rx="3"/></g>`).join('') +
    blacks.map(([m, x]) => `<g class="ea-k" tabindex="0" role="button" aria-label="${keyLabel(m)}" data-midi="${m}"><rect class="${cls(m, 'ea-b')}" x="${x}" y="0" width="18" height="66" rx="2"/></g>`).join('') + '</svg>';
}
const profile = store => { const p = store.get('sp.profile', null) || {}; return Object.assign({ xp: 0, hits: 0, badges: {} }, p); };
const addXp = store => { const p = profile(store); p.xp += 1; store.set('sp.profile', p); };

export function mount(container, store) {
  if (!document.getElementById('ea-style')) { const s = document.createElement('style'); s.id = 'ea-style'; s.textContent = CSS; document.head.appendChild(s); }
  const raw = store.get('sp.ear', null), S = fix(Object.assign(newState(), raw && typeof raw === 'object' ? raw : {})), save = () => store.set('sp.ear', S);
  const root = document.createElement('div'); root.className = 'ea'; container.replaceChildren(root);
  let timer = null; const stop = () => { clearInterval(timer); timer = null; };

  function menu() {
    stop();
    root.innerHTML = `<h2>${ic('ear', 24)} Entraîner l'oreille</h2><div class="ea-card">Pas à pas, ton oreille apprend à reconnaître les sons. Il faut ${PASS * 100} % de réussite pour ouvrir le palier suivant. Une erreur est une information, pas un échec.<div id="eap"></div></div>`;
    PALIERS.forEach((P, i) => {
      const ok = unlocked(S, i), b = S.best[i], btn = document.createElement('button'); btn.className = 'ea-pal'; btn.disabled = !ok;
      btn.innerHTML = `<span style="font-size:22px">${ok ? (b >= PASS ? '✅' : '🎧') : '🔒'}</span><span><b>${i + 1}. ${esc(P.title)}</b><small>${ok ? (b != null ? 'Meilleur score : ' + Math.round(b * 100) + ' %' : esc(P.intro)) : 'Réussis le palier ' + i + ' à ' + PASS * 100 + ' % pour l\'ouvrir'}</small></span>`;
      btn.onclick = () => quiz(i); root.querySelector('#eap').appendChild(btn);
    });
  }

  function quiz(p) {
    let n = 0, right = 0, last = null;
    const ask = () => {
      stop();
      if (n >= SESSION) return report(p, right);
      const q = question(S, p, n, Math.random, last); last = q.key;
      let errs = 0, done = false, bad = -1, idx = 0, taps = [], running = false;
      const head = `<div class="ea-head"><button id="eaq">← Menu</button><span>Question ${n + 1} / ${SESSION}</span></div><div class="ea-bar"><div style="width:${n * 10}%"></div></div><div class="ea-card"><b>${esc(PALIERS[p].title)}</b><small>${esc(PALIERS[p].intro)}</small></div>`;
      const msgEl = () => root.querySelector('.ea-msg'), say = t => { msgEl().textContent = t; };
      const end = ok => {
        done = true; stop(); record(S, p, q.key, ok); if (ok) { right++; addXp(store); } save(); store.log?.();
        const nb = root.querySelector('#eanext'); nb.hidden = false; nb.focus();
      };
      const hint = () => q.hints[Math.min(errs - 1, q.hints.length - 1)];
      const finishNext = () => { n++; ask(); };
      const wire = () => {
        root.querySelector('#eaq').onclick = menu; root.querySelector('#eanext').onclick = finishNext;
        const pl = root.querySelector('#eaplay'); if (pl) pl.onclick = () => play(q);
      };
      const nextBtn = '<button id="eanext" class="ea-pri" hidden>Question suivante →</button>';
      if (q.mode === 'melody') {
        const draw = () => {
          root.innerHTML = head + `<div class="ea-card"><button id="eaplay" class="ea-pri">🔊 Réécouter (${q.notes.length} notes)</button><div class="ea-msg" aria-live="polite">Écoute, puis touche les notes sur le clavier.</div>${keyboardSvg(errs >= 2 && !done ? q.answer[idx] : -1, bad)}</div>${nextBtn}`;
          wire(); wireKeys(root, '.ea-k', press);
        };
        const press = m => {
          if (done) return; tone(m, 0, 0.8);
          const r = melodyStep(q, idx, m);
          if (r === 'bad') { errs++; idx = 0; bad = m; draw(); say('Pas cette note, mais ce n\'est pas grave : ' + hint() + ' Recommence depuis le début.'); setTimeout(() => { if (bad === m) { bad = -1; } }, 600); }
          else { bad = -1; idx++; if (r === 'done') { end(!errs); root.querySelector('.ea-msg').textContent = errs ? 'Bravo, tu y es arrivé ! On retravaillera cette mélodie bientôt.' : 'Parfait, du premier coup !'; } else say('Bien ! Note ' + idx + ' sur ' + q.answer.length + '.'); }
        };
        draw(); setTimeout(() => play(q), 300); return;
      }
      if (q.mode === 'rhythm') {
        const period = 60000 / q.bpm;
        root.innerHTML = head + `<div class="ea-card"><div class="ea-msg" aria-live="polite">Appuie sur « Démarrer » : 4 clics d'intro, puis tape 8 fois au rythme.</div><span id="eap" class="ea-pulse" aria-hidden="true"></span> <small>${q.bpm} battements par minute</small></div>
          <button id="eago" class="ea-pri">▶ Démarrer</button><button id="eatap" class="ea-tap" disabled>Tape ici (ou Espace / Entrée)</button>${nextBtn}`;
        wire();
        const tapBtn = root.querySelector('#eatap'), go = root.querySelector('#eago'), pulse = root.querySelector('#eap');
        const tap = () => { if (running) { taps.push(performance.now()); tone(72, 0, 0.15, 0.08, 'triangle'); } };
        tapBtn.addEventListener('pointerdown', e => { e.preventDefault(); tap(); });
        tapBtn.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tap(); } });
        go.onclick = () => {
          taps = []; running = false; let beat = 0; go.disabled = true; tapBtn.disabled = false; tapBtn.focus();
          const tick = () => {
            if (!root.isConnected || !pulse.isConnected) return stop();
            if (beat >= 12) { stop(); running = false; tapBtn.disabled = true; return judge(); }
            click(beat % 4 === 0); pulse.classList.add('on'); setTimeout(() => pulse.classList.remove('on'), 120);
            running = beat >= 4; say(beat < 4 ? 'Écoute… ' + (beat + 1) : 'Tape ! ' + (beat - 3) + ' / 8'); beat++;
          };
          tick(); timer = setInterval(tick, period);
        };
        const judge = () => {
          const r = rhythmJudge(taps, period);
          if (r.ok) { end(true); say('Beau sens du rythme ! ' + r.good + ' intervalles réguliers sur ' + r.total + '.'); }
          else { errs++; go.disabled = false; say((taps.length < 6 ? 'Il manquait quelques taps. ' : 'Un peu irrégulier, c\'est normal au début. ') + hint() + ' Réessaie (ou passe à la suite).'); if (errs >= 2) end(false); }
        };
        return;
      }
      // choix (haut/bas, intervalles, accords)
      root.innerHTML = head + `<div class="ea-card"><button id="eaplay" class="ea-pri">🔊 Réécouter</button><div class="ea-msg" aria-live="polite">Écoute, puis choisis.</div>
        <div class="ea-ch">${q.choices.map(([id, l]) => `<button data-id="${id}">${esc(l)}</button>`).join('')}</div></div>${nextBtn}`;
      wire(); setTimeout(() => play(q), 300);
      root.querySelectorAll('.ea-ch button').forEach(b => b.onclick = () => {
        if (done) return; play(q);
        if (checkChoice(q, b.dataset.id)) { b.classList.add('ea-yes'); end(!errs); say(errs ? 'Voilà, c\'était ça. Tu le retrouveras bientôt pour t\'entraîner.' : 'Juste, bravo !'); }
        else {
          errs++; b.classList.add('ea-no'); b.disabled = true;
          if (errs >= 2) { const a = root.querySelector(`[data-id="${q.answer}"]`); a.classList.add('ea-yes'); end(false); say('Ce n\'est pas grave : c\'était « ' + a.textContent + ' ». ' + hint()); }
          else say('Pas tout à fait, et c\'est une information utile. Indice : ' + hint());
        }
      });
    };
    ask();
  }

  function report(p, right) {
    const r = finish(S, p, right, SESSION); save();
    root.innerHTML = `<div class="ea-card"><h2>${r.pass ? '🎉' : '💪'} ${right} / ${SESSION} (${Math.round(r.pct * 100)} %)</h2>
      <p>${r.pass ? (r.newUnlock ? 'Palier suivant débloqué !' : 'Palier validé, bravo !') : 'Il faut ' + PASS * 100 + ' % pour passer au palier suivant. Tu progresses à chaque série : refais-en une, les sons reviendront à ton rythme.'}</p>
      <p><small>+${right} XP gagnés</small></p></div>
      <button id="eare" class="ea-pri">Refaire une série</button><button id="eam">Menu des paliers</button>`;
    root.querySelector('#eare').onclick = () => quiz(p); root.querySelector('#eam').onclick = menu;
  }
  menu();
}
