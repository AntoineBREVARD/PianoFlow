// PianoFlow - page « 🧠 Mon niveau » : radar des compétences, niveau global honnête, forces/faiblesses, évolution.
// mount(container, store, opts) ; opts.start?.(song, options) lance un exercice ; opts.openLesson?.(id) ouvre une leçon.
import { DRILL_DIMS, LABELS, drillFor, levelFromScore, recommend, lessonsFor } from './drills.js';

const SHORT = { pitch: 'Notes', rhythm: 'Rythme', timing: 'Timing', leftHand: 'M. gauche', rightHand: 'M. droite', coordination: 'Coordination', leaps: 'Sauts', chords: 'Accords', tempo: 'Vitesse', endurance: 'Endurance', hesitation: 'Réactivité' };
const TREND = { up: ['↗', 'en progrès'], flat: ['→', 'stable'], down: ['↘', 'en baisse'] };
const LEVEL_NAMES = ['palier 1 (très doux)', 'palier 2', 'palier 3', 'palier 4 (exigeant)'];
const NS = 'http://www.w3.org/2000/svg';
let seq = 0;

const CSS = `
.ml-wrap{max-width:760px;margin:0 auto;padding:14px;color:var(--fg)}
.ml-wrap h2{margin:0 0 4px;font-size:1.3rem}.ml-wrap h3{margin:0 0 8px;font-size:1.05rem}
.ml-card{background:var(--grad-card,var(--card));border:1px solid var(--line);border-radius:16px;padding:16px;margin:12px 0;box-shadow:var(--sh1,none);animation:rise .5s var(--ease,ease) both}.ml-wrap>.ml-card:nth-child(2){animation-delay:.06s}.ml-wrap>.ml-card:nth-child(3){animation-delay:.12s}.ml-wrap>.ml-card:nth-child(n+4){animation-delay:.18s}
.ml-mut{color:var(--mut);font-size:.9rem}
.ml-radar{display:block;width:100%;max-width:440px;margin:0 auto;height:auto}
.ml-radar text{fill:var(--fg);font-size:11px}
.ml-grid{fill:none;stroke:var(--line);stroke-width:1}
.ml-shape{fill:var(--acc);fill-opacity:.28;stroke:var(--acc);stroke-width:2.5;stroke-linejoin:round;transform-box:view-box;transform-origin:220px 190px;animation:ml-draw .9s var(--ease,ease) both}@keyframes ml-draw{from{transform:scale(.05);opacity:0}}
.ml-dot{fill:var(--acc);stroke:var(--bg);stroke-width:1.5;animation:pop .5s .5s var(--ease-spring,ease) both;transform-box:fill-box;transform-origin:center}.ml-dot.ml-lo{fill:var(--bg);stroke:var(--acc);stroke-width:2;stroke-dasharray:2 2}
.ml-big{font-size:2.4rem;font-weight:800;font-family:var(--font-display,inherit);background:linear-gradient(135deg,var(--acc),var(--acc2));-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent}
.ml-pill{display:inline-block;padding:3px 12px;border-radius:99px;border:1px solid var(--acc);margin-left:8px;font-size:.85rem;font-weight:700;color:var(--acc);vertical-align:middle}
.ml-dims{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:6px}
.ml-dims li{display:grid;grid-template-columns:9.5em 1fr auto;gap:8px;align-items:center;font-size:.92rem}
.ml-bar{height:10px;border-radius:5px;background:var(--track,var(--line));overflow:hidden}.ml-bar i{display:block;height:100%;background:linear-gradient(90deg,var(--acc),var(--acc2));border-radius:5px;transform-origin:left;animation:fill .9s var(--ease,ease) both}
.ml-bar.ml-lo i{background:repeating-linear-gradient(45deg,var(--acc),var(--acc) 4px,transparent 4px,transparent 7px)}
.ml-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;padding:8px 0;border-top:1px solid var(--line)}
.ml-row:first-of-type{border-top:0}.ml-wrap ul{list-style:none}.ml-wrap li{display:list-item;border:0;padding:3px 0}.ml-dims li,.ml-evo li{display:grid}.ml-evo li{display:block}
.ml-btn{background:linear-gradient(135deg,var(--acc),var(--acc2));color:var(--onacc,var(--bg));border:0;border-radius:12px;padding:8px 16px;font:inherit;font-weight:700;cursor:pointer;min-height:44px;box-shadow:0 4px 14px rgba(56,189,248,.22);transition:transform .18s var(--ease,ease)}.ml-btn:active{transform:scale(.97)}
.ml-btn:focus-visible{outline:3px solid var(--acc2);outline-offset:2px}
.ml-tag{font-weight:600}.ml-spark{vertical-align:middle;width:90px;height:26px}.ml-spark polyline{fill:none;stroke:var(--acc2);stroke-width:2}
.ml-evo{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:6px 14px;list-style:none;margin:0;padding:0;font-size:.9rem}
.ml-drill{margin-top:8px;padding:10px;border:1px dashed var(--acc2);border-radius:10px;font-size:.92rem}
.ml-empty{text-align:center;padding:26px 14px}.ml-empty .ml-big{font-size:2.6rem}
@media(max-width:480px){.ml-dims li{grid-template-columns:7.5em 1fr auto}}
`;

const el = (tag, attrs, ...kids) => {
  const e = document.createElement(tag);
  for (const k in attrs || {}) k === 'text' ? (e.textContent = attrs[k]) : k.startsWith('on') ? (e[k] = attrs[k]) : e.setAttribute(k, attrs[k]);
  for (const c of kids.flat(Infinity)) if (c != null) e.append(c);
  return e;
};
const sv = (tag, attrs, ...kids) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
  for (const c of kids) if (c != null) e.append(c);
  return e;
};

// Valide le profil stocké : tout écart de forme => null (état vide), jamais d'exception.
export function validProfile(p, DIMS) {
  try {
    if (!p || typeof p !== 'object' || !Number.isFinite(p.attempts) || p.attempts < 0 || !p.dims || typeof p.dims !== 'object' || !p.hist || typeof p.hist !== 'object') return null;
    for (const d of DIMS) {
      const s = p.dims[d];
      if (!s || ![s.mu, s.v, s.n].every(Number.isFinite) || s.v < 0 || s.n < 0 || !Array.isArray(p.hist[d]) || !p.hist[d].every(Number.isFinite)) return null;
    }
    return p;
  } catch { return null; }
}

function radar(dims, summary) {
  const n = DRILL_DIMS.length, cx = 220, cy = 190, R = 110;
  const pt = (i, r) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a), Math.cos(a)]; };
  const svg = sv('svg', { class: 'ml-radar', viewBox: '0 0 440 380', role: 'img', 'aria-label': summary });
  for (const f of [0.25, 0.5, 0.75, 1]) svg.append(sv('polygon', { class: 'ml-grid', points: DRILL_DIMS.map((_, i) => pt(i, R * f).slice(0, 2).join(',')).join(' ') }));
  DRILL_DIMS.forEach((d, i) => {
    const [x, y] = pt(i, R); svg.append(sv('line', { class: 'ml-grid', x1: cx, y1: cy, x2: x, y2: y }));
    const [lx, ly, c] = pt(i, R + 14), t = sv('text', { x: lx, y: ly + 4, 'text-anchor': c > 0.3 ? 'start' : c < -0.3 ? 'end' : 'middle' });
    t.textContent = SHORT[d] + (dims[d].confidence < 0.3 ? ' ?' : ''); svg.append(t);
  });
  svg.append(sv('polygon', { class: 'ml-shape', points: DRILL_DIMS.map((d, i) => pt(i, (R * dims[d].score) / 100).slice(0, 2).join(',')).join(' ') }));
  DRILL_DIMS.forEach((d, i) => { const [x, y] = pt(i, (R * dims[d].score) / 100); svg.append(sv('circle', { class: 'ml-dot' + (dims[d].confidence < 0.3 ? ' ml-lo' : ''), cx: x, cy: y, r: 4.5 })); });
  return svg;
}

const spark = h => {
  const v = h.map(x => Math.min(100, Math.max(0, x * 100))), w = 90, ht = 26;
  const pts = v.map((y, i) => `${(i * w) / (v.length - 1)},${(ht - 2) - (y / 100) * (ht - 4)}`).join(' ');
  return sv('svg', { class: 'ml-spark', viewBox: `0 0 ${w} ${ht}`, 'aria-hidden': 'true' }, sv('polyline', { points: pts }));
};

const confWord = c => (c >= 0.6 ? 'fiable' : c >= 0.3 ? 'indicatif' : 'peu de données');

export async function mount(container, store, opts = {}) {
  const my = ++seq;
  container.replaceChildren();
  if (!document.getElementById('ml-style')) document.head.append(el('style', { id: 'ml-style', text: CSS }));
  const wrap = el('div', { class: 'ml-wrap' });
  container.append(wrap);
  const alive = () => my === seq && wrap.isConnected;
  const empty = (msg) => wrap.replaceChildren(el('h2', { text: '🧠 Mon niveau' }), el('div', { class: 'ml-card ml-empty' },
    el('div', { class: 'ml-big', 'aria-hidden': 'true', text: '🌱' }), el('p', { text: msg || 'Ton niveau apparaîtra ici après quelques morceaux.' }),
    el('p', { class: 'ml-mut', text: 'Joue 2 ou 3 morceaux ou leçons, même simples : chaque note jouée m\'aide à comprendre ce que tu maîtrises. Aucune obligation de bien jouer !' })));

  let skill, A, P, ALL = [];
  try {
    skill = await import('./skill.js');
    let raw = null; try { raw = store.get('sp.skill', null); } catch { raw = null; }
    P = validProfile(raw, skill.DIMS);
    if (!P || P.attempts < 2) return alive() && empty(raw && !P ? 'Je n\'ai pas pu relire ton profil de niveau : il repartira de zéro dès ta prochaine séance.' : '');
    A = skill.analyze(P);
  } catch { return alive() && empty('Je n\'ai pas pu calculer ton niveau pour le moment.'); }
  try { ALL = (await import('./curriculum.js')).ALL; } catch { ALL = []; }
  if (!alive()) return;

  const { dims, overall } = A, ci = Math.round(5 + (1 - overall.confidence) * 25);
  const lowData = overall.confidence < 0.3;
  const summary = 'Radar de tes compétences sur 100 : ' + DRILL_DIMS.map(d => `${LABELS[d]} ${dims[d].score}${dims[d].confidence < 0.3 ? ' (estimation fragile)' : ''}`).join(', ') + '.';

  // (b) niveau global
  const head = el('div', { class: 'ml-card' },
    el('h2', { text: '🧠 Mon niveau' }),
    el('div', {}, el('span', { class: 'ml-big', text: `${overall.score}/100` }), el('span', { class: 'ml-pill', text: overall.label })),
    el('p', { class: 'ml-mut', text: `Estimation : entre ${Math.max(0, overall.score - ci)} et ${Math.min(100, overall.score + ci)} (confiance ${Math.round(overall.confidence * 100)} %, ${P.attempts} tentative${P.attempts > 1 ? 's' : ''}).` + (lowData ? ' Encore peu de données : joue quelques morceaux de plus pour affiner.' : '') }),
    el('p', { class: 'ml-mut', text: 'C\'est une estimation indicative basée sur ton jeu, pas un examen : elle se précise au fil des morceaux.' }));

  // (a) radar + liste textuelle équivalente
  const list = el('ul', { class: 'ml-dims', 'aria-label': 'Scores détaillés' }, DRILL_DIMS.map(d => {
    const x = dims[d], low = x.confidence < 0.3;
    return el('li', {}, el('span', { text: LABELS[d] }), el('span', { class: 'ml-bar' + (low ? ' ml-lo' : ''), 'aria-hidden': 'true' }, el('i', { style: `width:${x.score}%` })),
      el('span', { text: `${x.score}/100 · ${confWord(x.confidence)}` }));
  }));
  const radarCard = el('div', { class: 'ml-card' }, el('h3', { text: 'Mes compétences' }), radar(dims, summary),
    el('p', { class: 'ml-mut', text: 'Point plein = mesure assez fiable ; point creux et « ? » = estimation encore fragile.' }), list);

  // (e) exercice proposé
  const drillBox = el('div', { class: 'ml-drill', hidden: '', role: 'status', 'aria-live': 'polite' });
  const work = (dim, score) => {
    const lv = levelFromScore(score), song = drillFor(dim, lv);
    drillBox.hidden = false;
    drillBox.replaceChildren(el('strong', { text: `Exercice : ${song.title}` }), el('p', { text: song.explain }),
      el('p', { class: 'ml-mut', text: `${LEVEL_NAMES[lv]} · ${song.notes.length} notes · ${song.bpm} bpm` + (opts.start ? '' : ' · le lancement automatique n\'est pas disponible ici : retrouve cet exercice dans l\'entraînement.') }));
    try { opts.start?.(song, { mode: song.mode, ...(song.speed ? { speed: song.speed } : {}), drill: dim }); } catch (e) { console.warn('mylevel: start', e); }
    drillBox.scrollIntoView?.({ block: 'nearest' });
  };

  // (c) forces et faiblesses
  const sw = el('div', { class: 'ml-card' }, el('h3', { text: 'Forces' }),
    A.strengths.length ? el('ul', {}, A.strengths.map(s => el('li', {}, el('span', { class: 'ml-tag', text: '✔ ' + s.label }), ` (${dims[s.dim].score}/100)`)))
      : el('p', { class: 'ml-mut', text: 'Pas encore de point fort net : ton niveau est homogène ou il manque de données.' }),
    el('h3', { style: 'margin-top:14px', text: 'À travailler' }),
    A.weaknesses.length ? A.weaknesses.map(w => {
      const ls = lessonsFor(w.dim, ALL, overall.score, 2);
      return el('div', { class: 'ml-row' },
        el('div', { style: 'flex:1;min-width:200px' }, el('span', { class: 'ml-tag', text: '▲ ' + w.label }), ` (${dims[w.dim].score}/100)`, el('div', { class: 'ml-mut', text: w.advice }),
          ls.length ? el('div', { class: 'ml-mut' }, 'Leçons utiles : ', ls.map((l, i) => [i ? ' · ' : '', opts.openLesson ? el('a', { href: '#', onclick: ev => { ev.preventDefault(); opts.openLesson(l.id); } }, l.title) : l.title])) : null),
        el('button', { class: 'ml-btn', type: 'button', onclick: () => work(w.dim, dims[w.dim].score), 'aria-label': `Travailler ma faiblesse : ${w.label}` }, 'Travailler ma faiblesse'));
    }) : el('p', { class: 'ml-mut', text: 'Aucune faiblesse marquée pour l\'instant : continue comme ça !' }),
    drillBox);

  // exercices recommandés (inclut le cas « aucune faiblesse marquée »)
  const rec = recommend(A);
  const recCard = el('div', { class: 'ml-card' }, el('h3', { text: 'Mes 3 exercices prioritaires' }),
    rec.map(r => el('div', { class: 'ml-row' }, el('div', { style: 'flex:1;min-width:200px' }, el('span', { class: 'ml-tag', text: r.label }), el('div', { class: 'ml-mut', text: r.reason })),
      el('button', { class: 'ml-btn', type: 'button', onclick: () => work(r.dim, r.score), 'aria-label': `Lancer l'exercice : ${r.label}` }, 'Essayer'))));

  // (d) évolution
  const evo = el('div', { class: 'ml-card' }, el('h3', { text: 'Évolution' }),
    el('ul', { class: 'ml-evo' }, DRILL_DIMS.filter(d => dims[d].n > 0).map(d => {
      const h = P.hist[d], [arrow, word] = TREND[dims[d].trend] || TREND.flat;
      return el('li', {}, `${SHORT[d]} `, h.length >= 3 ? spark(h) : null, ` ${arrow} ${word}`);
    })),
    el('p', { class: 'ml-mut', text: 'Courbes : tes dernières tentatives (plus à droite = plus récent). La flèche et le mot donnent la tendance.' }));

  wrap.replaceChildren(head, radarCard, sw, recCard, evo);
}
