// Lecture de notes sur portée : paliers, Leitner (sp.reading), exercice SVG. Partie pure exportée en tête (testée par test-reading.mjs).
export const FR = ['Do', 'Ré', 'Mi', 'Fa', 'Sol', 'La', 'Si'], EN = 'CDEFGAB';
const SEMI = [0, 2, 4, 5, 7, 9, 11], DAYS = [1, 3, 7, 14, 30], DAY = 864e5;
export const PASS = 0.85, SESSION = 10;
export const MNEMO = {
  g: { lines: ['Mi', 'Sol', 'Si', 'Ré', 'Fa'], spaces: ['Fa', 'La', 'Do', 'Mi'] },
  f: { lines: ['Sol', 'Si', 'Ré', 'Fa', 'La'], spaces: ['La', 'Do', 'Mi', 'Sol'] },
};
const BASE = { g: 4 * 7 + 2, f: 2 * 7 + 4 }; // nombre diatonique de la ligne du bas (Mi4 / Sol2)

// "C#4" -> {code,l,o,a,midi}
export function parse(code) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(code); if (!m) throw new Error('note ' + code);
  const l = EN.indexOf(m[1]), a = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0, o = +m[3];
  return { code, l, o, a, midi: 12 * (o + 1) + SEMI[l] + a };
}
export const posOf = (n, clef) => n.o * 7 + n.l - BASE[clef]; // demi-pas au-dessus de la ligne du bas (pair = ligne)
export const nameFr = n => FR[n.l] + (n.a > 0 ? '♯' : n.a < 0 ? '♭' : '');

const P = s => s.split(' ');
const g = s => P(s).map(c => ['g', c]), f = s => P(s).map(c => ['f', c]);
export const PALIERS = [
  { id: 'g1', title: 'Clé de Sol : Do Ré Mi', notes: g('C4 D4 E4'), extra: [] },
  { id: 'g2', title: 'Clé de Sol : Fa et Sol', notes: g('F4 G4'), extra: g('C4 D4 E4') },
  { id: 'g3', title: 'Clé de Sol : Do à Sol (main droite)', notes: g('C4 D4 E4 F4 G4'), extra: [] },
  { id: 'f1', title: 'Clé de Fa : Do Si La Sol Fa', notes: f('C3 B2 A2 G2 F2'), extra: g('C4 D4 E4 F4 G4') },
  { id: 'lg', title: 'Lignes et interlignes (mnémoniques)', notes: [...g('E4 G4 B4 D5 F5 F4 A4 C5 E5'), ...f('G2 B2 D3 F3 A3 A2 C3 E3 G3')], extra: [...g('C4 D4'), ...f('C3 B2')] },
  { id: 'acc', title: 'Dièses et bémols', notes: [...g('F#4 Bb4 C#5 Eb4 G#4 Ab4'), ...f('Bb2 F#3 Eb3 C#3 Ab2 G#2')], extra: [...g('E4 G4 B4 F5'), ...f('G2 B2 D3 F3')] },
  { id: 'gd', title: 'Grande portée et Do central', notes: [...g('C4 D4 E4 G4 B4 C5 A3 B3'), ...f('C4 B3 A3 G3 E3 C3 D4 E4')], extra: [...g('F#4 Bb4'), ...f('Bb2 F#3')], grand: true },
  { id: 'far', title: 'Plus loin : lignes supplémentaires', notes: [...g('A3 G3 F3 B5 C6 D6 A5 G5 E3'), ...f('E4 F4 G4 A4 C2 B1 A1 D2 E2')], extra: [...g('C4 B3'), ...f('C4 B3')], grand: true },
].map(p => ({ ...p, notes: p.notes.map(([c, n]) => ({ clef: c, ...parse(n), key: c + ':' + n })), extra: p.extra.map(([c, n]) => ({ clef: c, ...parse(n), key: c + ':' + n })) }));

export const newState = () => ({ cards: {}, best: {}, labels: true, scroll: false });
// état lu du stockage : tolère cards/best null ou de mauvais type, boîtes hors 0-4
export function fix(st) {
  if (!st.cards || typeof st.cards !== 'object') st.cards = {};
  if (!st.best || typeof st.best !== 'object') st.best = {};
  for (const k in st.cards) { const c = st.cards[k]; if (!c || typeof c !== 'object') delete st.cards[k]; else { c.b = Number.isFinite(+c.b) ? Math.min(4, Math.max(0, Math.trunc(+c.b))) : 0; if (!Number.isFinite(+c.due)) c.due = 0; } }
  return st;
}
export const unlocked = (st, i) => i === 0 || (fix(st).best[i - 1] ?? 0) >= PASS;
const LET = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'], FRN = ['do', 'do dièse', 'ré', 'ré dièse', 'mi', 'fa', 'fa dièse', 'sol', 'sol dièse', 'la', 'la dièse', 'si'];
// libellé lecteur d'écran d'une touche : lettre + octave, nom français
export const keyLabel = m => `${LET[m % 12]}${Math.floor(m / 12) - 1}, ${FRN[m % 12]}`;
const kAttr = m => `tabindex="0" role="button" aria-label="${keyLabel(m)}"`;
// clic/tactile + Entrée/Espace sur les touches d'un clavier
export const wireKeys = (root, sel, press) => root.querySelectorAll(sel).forEach(k => {
  k.addEventListener('pointerdown', e => { e.preventDefault(); press(+k.dataset.midi); });
  k.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); press(+k.dataset.midi); } });
});

// Choisit la prochaine question (pondération Leitner : nouvelles/dues/ratées d'abord). rnd() dans [0,1[.
export function nextQuestion(st, pi, { now = Date.now(), rnd = Math.random, last = null, missed = [] } = {}) {
  fix(st); const p = PALIERS[pi], pool = [...p.notes.map(n => [n, 1]), ...p.extra.map(n => [n, 0.4])];
  const cand = pool.filter(([n]) => n.key !== last || pool.length === 1);
  const w = cand.map(([n, base]) => {
    const c = st.cards[n.key]; let x = base;
    if (!c) x *= 3; else x *= !(c.due > now) ? 1 + (4 - c.b) : 0.3;
    if (missed.includes(n.key)) x *= 6;
    return x;
  });
  let r = rnd() * w.reduce((a, b) => a + b, 0), i = 0;
  while (i < w.length - 1 && (r -= w[i]) >= 0) i++;
  const n = cand[i][0];
  return { ...n, pos: posOf(n, n.clef), grand: !!p.grand, palier: pi };
}
export const check = (q, midi) => q.midi === midi;
// Leitner 0-4 : juste du premier coup = boîte+1, sinon retour boîte 0. Retourne l'état (muté).
export function record(st, key, ok, now = Date.now()) {
  fix(st); const c = st.cards[key] || { b: 0, due: 0 };
  c.b = ok ? Math.min(4, c.b + 1) : 0; c.due = now + DAYS[c.b] * DAY; st.cards[key] = c; return st;
}
export function finish(st, pi, right, total) {
  fix(st); const acc = total ? right / total : 0, was = st.best[pi] ?? 0;
  st.best[pi] = Math.max(was, acc);
  return { acc, pct: Math.round(acc * 100), passed: acc >= PASS, unlockedNext: acc >= PASS && was < PASS && pi + 1 < PALIERS.length };
}
// Fenêtre de 2 octaves du clavier (octave de départ), sans toujours placer la cible dans la première
export const kbStart = q => Math.max(1, q.o - ((q.l + q.o) % 2));
export function hintText(q) {
  const m = MNEMO[q.clef], pos = q.pos, who = q.clef === 'g' ? 'Sol' : 'Fa';
  if (pos < 0 || pos > 8) return `Ligne supplémentaire : compte les lignes depuis la portée${q.clef === 'g' && pos === -2 || q.clef === 'f' && pos === 10 ? ' (c’est le Do central)' : ''}.`;
  return pos % 2 ? `Interlignes en clé de ${who} : ${m.spaces.join(' – ')} (de bas en haut).` : `Lignes en clé de ${who} : ${m.lines.join(' – ')} (de bas en haut).`;
}

/* ============================ Interface ============================ */
const profile = store => { const p = store.get('sp.profile', { xp: 0, hits: 0, badges: {} }); p.badges = p.badges || {}; return p; };
let ac;
function beep(midi) {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume();
    const o = ac.createOscillator(), gn = ac.createGain(), t = ac.currentTime;
    o.type = 'triangle'; o.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(0.35, t + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(gn); gn.connect(ac.destination); o.start(t); o.stop(t + 0.75);
  } catch { /* pas d'audio : tant pis */ }
}

const CSS = `.rd{max-width:520px;margin:0 auto;padding:12px;color:var(--fg)}.rd h2{margin:6px 0 10px;font-size:20px}
.rd .rd-card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px;margin:8px 0}
.rd button{font:inherit;color:var(--fg);background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 14px;cursor:pointer}
.rd button.rd-p{background:linear-gradient(135deg,var(--acc),var(--acc2));border:0;font-weight:600}
.rd .rd-pal{display:flex;width:100%;text-align:left;gap:10px;align-items:center;margin:6px 0}.rd .rd-pal[disabled]{opacity:.45;cursor:not-allowed}
.rd .rd-pal small{display:block;color:var(--mut)}.rd .rd-head{display:flex;justify-content:space-between;color:var(--mut);font-size:14px;align-items:center}
.rd .rd-msg{min-height:44px;margin:6px 0;color:var(--mut)}.rd .rd-msg b{color:var(--fg)}
.rd svg{display:block;width:100%;height:auto;touch-action:manipulation;user-select:none}
.rd .rd-staff{background:#f7f7fb;border-radius:12px}.rd .rd-w{fill:#fff;stroke:#334;stroke-width:1}.rd .rd-b{fill:#222}
.rd .rd-w.rd-lit,.rd .rd-b.rd-lit{fill:var(--acc)}.rd .rd-k{cursor:pointer}.rd .rd-k.rd-no{fill:#fcd9d9}
.rd .rd-bar{height:8px;background:var(--line);border-radius:4px}.rd .rd-bar div{height:100%;background:var(--acc);border-radius:4px;transition:width .3s}
.rd label{display:flex;gap:8px;align-items:center;margin:8px 0;color:var(--mut)}
@keyframes rd-in{from{transform:translateX(130px);opacity:0}}.rd .rd-n{animation:rd-in 1.2s ease-out}
@media (prefers-reduced-motion:reduce){.rd *{transition:none!important;animation:none!important}}`;

const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// Clés en tracés SVG (indépendantes de la police). Repère : interligne = 10, origine = ligne de référence (Sol / Fa).
export const GCLEF = 'M -6,17 C -6,23 1,24 1,17 L 1,-30 C 1,-42 6,-50 9,-44 C 12,-38 4,-28 -4,-18 C -14,-6 -12,8 -2,9 C 8,10 12,-2 6,-8 C 0,-13 -8,-6 -4,0 C -2,3 3,2 3,-2';
export const FCLEF = 'M -3,0 C -2,-8 12,-9 13,2 C 14,14 4,24 -8,30';
const clefSvg = (clef, bot) => `<g transform="translate(${clef === 'g' ? 58 : 56} ${clef === 'g' ? bot - 10 : bot - 30})" fill="none" stroke="#223" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`
  + (clef === 'g' ? `<path d="${GCLEF}"/>` : `<path d="${FCLEF}"/><circle cx="-1" cy="0" r="3.5" fill="#223"/><circle cx="19" cy="-5" r="2" fill="#223" stroke="none"/><circle cx="19" cy="5" r="2" fill="#223" stroke="none"/>`) + '</g>';

// Une note (ligne(s) supplémentaire(s), altération, tête) ; pos = demi-pas au-dessus de la ligne du bas, bot = y de cette ligne
const noteSvg = (pos, a, x, bot, col = '#111') => {
  const y = bot - pos * 5; let s = '';
  const led = []; for (let p = -2; p >= pos; p -= 2) led.push(p); for (let p = 10; p <= pos; p += 2) led.push(p);
  for (const p of led) s += `<line x1="${x - 14}" x2="${x + 14}" y1="${bot - p * 5}" y2="${bot - p * 5}" stroke="#334" stroke-width="1.2"/>`;
  if (a) s += `<text x="${x - 30}" y="${y + 6}" font-size="22" fill="${col}">${a > 0 ? '♯' : '♭'}</text>`;
  return s + `<ellipse cx="${x}" cy="${y}" rx="7" ry="5" fill="${col}" transform="rotate(-20 ${x} ${y})"/>`;
};

// o.slide : la note défile depuis la droite (mode rythme) ; o.seq : phrase [{pos,a}] dont o.cur est la note attendue
export function staffSvg(q, hint = 0, o = {}) {
  const grand = q.grand, W = 320, tb = 120, bb = grand ? 180 : 120; // y de la ligne du bas de chaque portée
  const bot = q.clef === 'g' || !grand ? tb : bb, y = bot - q.pos * 5, x = 190;
  const staff = (b, clef) => {
    let s = '';
    for (let i = 0; i < 5; i++) s += `<line x1="40" x2="${W - 10}" y1="${b - i * 10}" y2="${b - i * 10}" stroke="#334" stroke-width="1.2"/>`;
    return s + clefSvg(clef, b) + `<text x="14" y="${b - 16}" font-size="11" fill="#667">${clef === 'g' ? 'Sol' : 'Fa'}</text>`;
  };
  let s = `<svg class="rd-staff" viewBox="0 0 ${W} ${grand ? 230 : 175}" role="img" aria-label="Portée en clé de ${q.clef === 'g' ? 'Sol' : 'Fa'}">`;
  s += grand ? staff(tb, 'g') + staff(bb, 'f') + `<line x1="40" x2="40" y1="${tb - 40}" y2="${bb}" stroke="#334" stroke-width="2"/>` : staff(tb, q.clef);
  if (o.seq) return s + o.seq.map((n, i) => noteSvg(n.pos, n.a, 120 + i * 45, bot, i < o.cur ? '#16a34a' : '#111') + (i === o.cur ? `<circle cx="${120 + i * 45}" cy="${bot - n.pos * 5}" r="13" fill="none" stroke="#0ea5e9" stroke-width="2"/>` : '')).join('') + '</svg>';
  if (hint >= 1 && q.pos >= 0 && q.pos <= 8) s += q.pos % 2 ? `<rect x="40" y="${y - 5}" width="${W - 50}" height="10" fill="#38bdf8" opacity=".35"/>` : `<line x1="40" x2="${W - 10}" y1="${y}" y2="${y}" stroke="#0ea5e9" stroke-width="3.5"/>`;
  s += `<g class="${o.slide ? 'rd-n' : ''}">` + noteSvg(q.pos, q.a, x, bot) + '</g>';
  if (hint >= 1 && (q.pos < 0 || q.pos > 8)) s += `<circle cx="${x}" cy="${y}" r="12" fill="none" stroke="#0ea5e9" stroke-width="2"/>`;
  return s + '</svg>';
}

// Mini-test de phrase : len notes d'une même clé, voisines (écart <= 6 demi-tons de la 1re), jamais deux fois la même de suite.
export function makePhrase(pi, { rnd = Math.random, len = 4 } = {}) {
  const p = PALIERS[pi], all = [...p.notes, ...p.extra], first = p.notes[Math.floor(rnd() * p.notes.length)];
  const pool = all.filter(n => n.clef === first.clef && Math.abs(n.midi - first.midi) <= 6), notes = [first];
  while (notes.length < len) {
    const c = pool.filter(n => n.key !== notes[notes.length - 1].key);
    notes.push((c.length ? c : pool)[Math.floor(rnd() * (c.length || pool.length))]);
  }
  return { clef: first.clef, grand: !!p.grand, notes };
}
// Octave de départ du clavier (2 octaves) pour couvrir toute la phrase
export const phraseStart = notes => Math.max(1, Math.min(...notes.map(n => n.o)));
// Palier de la phrase = le plus avancé débloqué, à partir du palier 5 ("lignes et interlignes") ; -1 sinon
export const phrasePalier = st => { let k = -1; PALIERS.forEach((_, i) => { if (unlocked(st, i)) k = i; }); return k >= 4 ? k : -1; };

export function keyboardSvg(start, { labels = true, lit = -1, bad = -1 } = {}) {
  const lo = 12 * (start + 1), WW = 22, H = 110, white = [], black = [];
  let wx = 0;
  for (let m = lo; m < lo + 24; m++) {
    const pc = m % 12;
    if ([1, 3, 6, 8, 10].includes(pc)) { black.push([m, wx * WW - 7]); continue; }
    white.push([m, wx * WW]); wx++;
  }
  let s = `<svg viewBox="0 0 ${wx * WW} ${H}" role="group" aria-label="Clavier">`;
  for (const [m, x] of white) {
    const l = SEMI.indexOf(m % 12), oct = Math.floor(m / 12) - 1;
    s += `<g class="rd-k" ${kAttr(m)} data-midi="${m}"><rect class="rd-w ${m === lit ? 'rd-lit' : ''} ${m === bad ? 'rd-no' : ''}" x="${x}" y="0" width="${WW}" height="${H}" rx="3"/>`;
    if (labels) s += `<text x="${x + WW / 2}" y="${H - 22}" text-anchor="middle" font-size="9" fill="#223" pointer-events="none">${FR[l]}</text><text x="${x + WW / 2}" y="${H - 8}" text-anchor="middle" font-size="9" fill="#667" pointer-events="none">${EN[l]}${l === 0 ? oct : ''}</text>`;
    s += '</g>';
  }
  for (const [m, x] of black) s += `<g class="rd-k" ${kAttr(m)} data-midi="${m}"><rect class="rd-b ${m === lit ? 'rd-lit' : ''} ${m === bad ? 'rd-no' : ''}" x="${x}" y="0" width="14" height="68" rx="2"/></g>`;
  return s + '</svg>';
}

export function mount(container, store) {
  if (!document.getElementById('rd-style')) { const st = document.createElement('style'); st.id = 'rd-style'; st.textContent = CSS; document.head.appendChild(st); }
  const raw = store.get('sp.reading', null), S = fix(Object.assign(newState(), raw && typeof raw === 'object' ? raw : {})); let sess = 0;
  const save = () => store.set('sp.reading', S);
  const root = document.createElement('div'); root.className = 'rd'; container.replaceChildren(root);

  function menu() {
    sess++;
    root.innerHTML = `<h2>👀 Lire les notes</h2><div class="rd-card">Pas à pas, tu apprends à lire la portée. Il faut ${Math.round(PASS * 100)} % de réussite pour ouvrir le palier suivant. Pas de stress : chaque erreur est une chance d'apprendre.</div>
    <label><input type="checkbox" id="rdl" ${S.labels ? 'checked' : ''}> Afficher les noms (Do Ré Mi / C D E) sur les touches</label>
    <label><input type="checkbox" id="rds" ${S.scroll ? 'checked' : ''}> Mode rythme : la note défile vers la portée (lecture lente)</label>
    <div id="rdp"></div>`;
    root.querySelector('#rds').onchange = e => { S.scroll = e.target.checked; save(); };
    root.querySelector('#rdl').onchange = e => { S.labels = e.target.checked; save(); };
    PALIERS.forEach((p, i) => {
      const ok = unlocked(S, i), b = S.best[i], btn = document.createElement('button');
      btn.className = 'rd-pal'; btn.disabled = !ok;
      btn.innerHTML = `<span style="font-size:22px">${ok ? (b >= PASS ? '✅' : '🎼') : '🔒'}</span><span><b>${i + 1}. ${esc(p.title)}</b><small>${ok ? (b != null ? 'Meilleur score : ' + Math.round(b * 100) + ' %' : 'Nouveau') : 'Réussis le palier précédent à ' + Math.round(PASS * 100) + ' %'}</small></span>`;
      btn.onclick = () => quiz(i); root.querySelector('#rdp').appendChild(btn);
    });
    const pp = phrasePalier(S), pb = document.createElement('button');
    pb.className = 'rd-pal'; pb.disabled = pp < 0;
    pb.innerHTML = `<span style="font-size:22px">${pp < 0 ? '🔒' : '🎶'}</span><span><b>Mini-test : lire une phrase</b><small>${pp < 0 ? 'Réussis le palier 4 à ' + Math.round(PASS * 100) + ' %' : '4 notes à rejouer à la suite au clavier'}</small></span>`;
    pb.onclick = () => phrase(pp); root.querySelector('#rdp').appendChild(pb);
  }

  function quiz(pi) {
    let n = 0, right = 0, last = null; const missed = [], sid = ++sess;
    const ask = () => {
      const q = nextQuestion(S, pi, { last, missed }); last = q.key;
      let errs = 0, done = false, bad = -1, slide = !!S.scroll;
      const draw = (msg, hint, lit) => {
        root.innerHTML = `<div class="rd-head"><button id="rdq">← Menu</button><span>Question ${n + 1} / ${SESSION}</span></div>
        <div class="rd-bar" style="margin:8px 0"><div style="width:${n * 100 / SESSION}%"></div></div>
        <div class="rd-card" style="padding:6px">${staffSvg(q, hint, { slide })}</div><div class="rd-msg" aria-live="polite">${msg}</div>
        <div class="rd-card" style="padding:6px">${keyboardSvg(kbStart(q), { labels: S.labels, lit, bad })}</div>`;
        slide = false; root.querySelector('#rdq').onclick = menu;
        wireKeys(root, '.rd-k', press);
      };
      const press = midi => {
        if (done) return; beep(midi);
        if (check(q, midi)) {
          done = true; if (!errs) { right++; const p = profile(store); p.xp += 1; store.set('sp.profile', p); } else missed.push(q.key);
          record(S, q.key, !errs); save(); store.log?.(); n++;
          draw(`<b>${nameFr(q)}</b> (${EN[q.l]}${q.a > 0 ? '♯' : q.a < 0 ? '♭' : ''}) — ${errs ? 'Bien, tu l’as trouvée !' : 'Juste ! 🎉'}${errs ? '' : ' +1 XP'}`, errs ? 1 : 0, midi);
          setTimeout(() => { if (sid !== sess) return; if (n >= SESSION) summary(pi, right); else ask(); }, errs ? 1500 : 900);
        } else {
          errs++; bad = midi;
          draw(errs === 1 ? 'Presque ! Regarde l’indice : ' + esc(hintText(q)) : 'On t’aide : la bonne touche est allumée. Touche-la.', Math.min(errs, 2), errs >= 2 ? q.midi : -1);
        }
      };
      draw('Quelle est cette note ? Touche la bonne touche.', 0, -1);
    };
    ask();
  }

  function phrase(pi) {
    const ph = makePhrase(pi), q0 = { clef: ph.clef, grand: ph.grand, pos: 0 }, seq = ph.notes.map(n => ({ pos: posOf(n, n.clef), a: n.a }));
    let i = 0, errs = 0, bad = -1, stuck = 0;
    const draw = (msg, lit = -1) => {
      root.innerHTML = `<div class="rd-head"><button id="rdq">← Menu</button><span>Phrase de ${seq.length} notes</span></div>
      <div class="rd-card" style="padding:6px">${staffSvg(q0, 0, { seq, cur: i })}</div><div class="rd-msg" aria-live="polite">${msg}</div>
      <div class="rd-card" style="padding:6px">${keyboardSvg(phraseStart(ph.notes), { labels: S.labels, lit, bad })}</div>${i >= seq.length ? '<button class="rd-p" id="more">Une autre phrase</button>' : ''}`;
      root.querySelector('#rdq').onclick = menu; const m = root.querySelector('#more'); if (m) m.onclick = () => phrase(pi);
      wireKeys(root, '.rd-k', press);
    };
    const press = midi => {
      if (i >= seq.length) return; beep(midi);
      if (midi === ph.notes[i].midi) {
        i++; bad = -1; stuck = 0; if (i >= seq.length) store.log?.();
        if (i < seq.length) return draw('Bien ! Note suivante.');
        const p = profile(store), ok = !errs; if (ok) { p.xp += 2; store.set('sp.profile', p); }
        return draw(ok ? 'Phrase parfaite ! 🎉 +2 XP' : `Phrase jouée avec ${errs} erreur${errs > 1 ? 's' : ''}. Recommence pour un sans-faute !`);
      }
      errs++; bad = midi; stuck++;
      draw(stuck >= 2 ? 'On t’aide : la bonne touche est allumée.' : 'Pas tout à fait, regarde la note entourée.', stuck >= 2 ? ph.notes[i].midi : -1);
    };
    draw('Lis les 4 notes puis rejoue-les dans l’ordre, de gauche à droite.');
  }

  function summary(pi, right) {
    const r = finish(S, pi, right, SESSION); save(); store.log?.();
    const msg = r.passed ? (r.unlockedNext ? 'Bravo ! Le palier suivant est débloqué 🎉' : 'Bravo, palier maîtrisé !') : 'Tu progresses ! Encore une série et ça va devenir naturel. Il faut ' + Math.round(PASS * 100) + ' % pour passer au palier suivant.';
    root.innerHTML = `<h2>Bilan</h2><div class="rd-card"><div style="font-size:34px;font-weight:700">${right} / ${SESSION} <small style="font-size:16px;color:var(--mut)">(${r.pct} %)</small></div><p>${msg}</p><p style="color:var(--mut)">+${right} XP</p></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="rd-p" id="again">Rejouer ce palier</button>${r.passed && pi + 1 < PALIERS.length ? '<button class="rd-p" id="next">Palier suivant →</button>' : ''}<button id="menu">Menu</button></div>`;
    root.querySelector('#again').onclick = () => quiz(pi); root.querySelector('#menu').onclick = menu;
    const nx = root.querySelector('#next'); if (nx) nx.onclick = () => quiz(pi + 1);
  }

  menu();
}
