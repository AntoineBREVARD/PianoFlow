// « Ma progression » : bilan motivant, sans classement. Partie pure (summarize) testée par test-stats.mjs.
import { LEVELS, ALL } from './curriculum.js';
import { CHORDS } from './chords.js';
import { PALIERS as READ } from './reading.js';
import { PALIERS as EAR } from './ear.js';

export const KEYS = ['sp.profile', 'sp.progress', 'sp.days', 'sp.plan', 'sp.week', 'sp.chords', 'sp.reading', 'sp.ear', 'sp.guided', 'sp.settings', 'sp.micLat', 'sp.library'];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v, max = 1e9) => { v = typeof v === 'number' ? v : NaN; return Number.isFinite(v) && v >= 0 ? Math.min(v, max) : 0; }; // tolérant (affichage/lecture)
const int = (v, lo, hi, d) => Number.isInteger(v) && v >= lo && v <= hi ? v : d;
export const DEFAULT_PLAN = { days: [1, 3, 5], minutes: 10, start: 0, time: '18:00' };
/** Plan sûr pour l'UI : champs invalides remplacés par le défaut (null si pas un objet). */
export const fixPlan = p => !isObj(p) ? null : {
  ...p, days: Array.isArray(p.days) && p.days.length && p.days.every(d => Number.isInteger(d) && d >= 0 && d <= 6) ? [...new Set(p.days)] : [...DEFAULT_PLAN.days],
  minutes: int(p.minutes, 1, 120, DEFAULT_PLAN.minutes), start: int(p.start, 0, 200, 0), time: typeof p.time === 'string' && /^\d\d:\d\d$/.test(p.time) ? p.time : DEFAULT_PLAN.time,
};
/** Profil sûr : nombres valides, badges = objet de timestamps. */
export const fixProfile = p => { p = isObj(p) ? p : {}; const badges = {}; if (isObj(p.badges)) for (const k in p.badges) if (/^\w{1,30}$/.test(k) && Number.isFinite(p.badges[k])) badges[k] = p.badges[k]; return { ...p, xp: num(p.xp, 1e7), hits: num(p.hits, 1e8), badges }; };
const dkey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const levelOf = xp => Math.floor(Math.sqrt((xp || 0) / 50)) + 1;
const lvFloor = lv => 50 * (lv - 1) ** 2;

export function summarize(data = {}, now = new Date()) {
  data = isObj(data) ? data : {};
  const profile = fixProfile(data['sp.profile']), o = v => (v && typeof v === 'object' ? v : {});
  const progress = o(data['sp.progress']), daysRaw = Object.fromEntries(Object.entries(o(data['sp.days'])).filter(([, v]) => isObj(v)));
  const lv = levelOf(profile.xp), lo = lvFloor(lv), hi = lvFloor(lv + 1);
  const level = { level: lv, xp: profile.xp, into: profile.xp - lo, span: hi - lo, pct: Math.min(100, Math.round(100 * (profile.xp - lo) / (hi - lo))) };

  // 30 derniers jours (du plus ancien au plus récent)
  const cal = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const min = Math.round((num(daysRaw[dkey(d)]?.sec, 864e3)) / 60);
    cal.push({ date: dkey(d), min, lvl: min <= 0 ? 0 : min < 5 ? 1 : min < 15 ? 2 : min < 30 ? 3 : 4 });
  }
  const monthPrefix = dkey(now).slice(0, 7);
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1), prevPrefix = dkey(prev).slice(0, 7);
  const sumMin = f => Math.round(Object.entries(daysRaw).filter(([k]) => f(k)).reduce((s, [, v]) => s + num(v.sec, 864e3), 0) / 60);
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const wk = dkey(weekStart);
  const minutes = { week: sumMin(k => k >= wk && k <= dkey(now)), month: sumMin(k => k.startsWith(monthPrefix)), daysPlayed: cal.filter(c => c.min > 0).length };
  const lessonsIn = p => Object.entries(daysRaw).filter(([k]) => k.startsWith(p)).reduce((s, [, v]) => s + (Array.isArray(v.done) ? v.done.length : 0), 0);
  const monthLessons = lessonsIn(monthPrefix), prevLessons = lessonsIn(prevPrefix);

  // leçons
  const stars = l => int(progress[l.id]?.stars, 0, 3, 0);
  const perLevel = LEVELS.map((lv, i) => ({ title: lv.title, done: lv.lessons.filter(l => stars(l) >= 1).length, total: lv.lessons.length }));
  const lessons = { done: ALL.filter(l => stars(l) >= 1).length, total: ALL.length, perLevel };

  // accords maîtrisés (boîte >= 3)
  const cards = o(o(data['sp.chords']).cards);
  const chords = CHORDS.filter(c => num(o(cards[c.sym]).box, 4) >= 3 && cards[c.sym]?.box !== undefined).map(c => c.sym);

  // paliers atteints = nombre de paliers réussis
  const readBest = o(o(data['sp.reading']).best), earBest = o(o(data['sp.ear']).best);
  const reading = { done: READ.filter((_, i) => num(readBest[i], 1) >= 0.85).length, total: READ.length };
  const ear = { done: EAR.filter((_, i) => num(earBest[i], 1) >= 0.8).length, total: EAR.length };

  // « Ce que tu sais jouer maintenant » : leçons ★★★ + parcours guidés terminés d'un morceau
  const known = ALL.filter(l => stars(l) >= 3).map(l => l.title);

  // prochaine étape
  let next;
  const nl = ALL.find(l => stars(l) < 1);
  if (nl) next = `Leçon suivante : ${nl.title}`;
  else if (ALL.some(l => stars(l) < 3)) next = `Viser ★★★ sur : ${ALL.find(l => stars(l) < 3).title}`;
  else if (reading.done < reading.total) next = `Entraînement lecture : ${READ[reading.done].title}`;
  else if (ear.done < ear.total) next = `Entraînement oreille : ${EAR[ear.done].title}`;
  else next = 'Tu as tout parcouru : rejoue tes morceaux préférés !';

  // encouragements (toujours positifs, relatifs à soi-même)
  const msgs = [];
  if (monthLessons > 0) msgs.push(`+${monthLessons} leçon${monthLessons > 1 ? 's' : ''} ce mois-ci${monthLessons > prevLessons && prevLessons > 0 ? ', plus que le mois dernier' : ''} !`);
  if (minutes.week > 0) msgs.push(`${minutes.week} min jouées cette semaine : bravo !`);
  if (minutes.daysPlayed > 0) msgs.push(`${minutes.daysPlayed} jour${minutes.daysPlayed > 1 ? 's' : ''} de piano sur les 30 derniers.`);
  if (chords.length) msgs.push(`${chords.length} accord${chords.length > 1 ? 's' : ''} maîtrisé${chords.length > 1 ? 's' : ''}.`);
  if (!msgs.length) msgs.push(lessons.done ? 'Chaque reprise compte : même 5 minutes aujourd\'hui, c\'est un pas de plus.' : 'Ton aventure commence ici : une première leçon de 5 minutes suffit !');

  return { level, calendar: cal, minutes, monthLessons, lessons, chords, reading, ear, known, next, messages: msgs };
}

/* ---------- export / import ---------- */
export const exportData = data => JSON.stringify({ app: 'pianoflow', version: 1, date: new Date().toISOString(), data }, null, 1);
export const MAX_IMPORT = 1e6, MAX_LIBRARY = 5e5;
const fail = m => { throw new Error(m); };
const need = (c, m = 'valeur invalide') => c || fail(m);
const fin = (v, hi = 1e9) => need(typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= hi, 'nombre hors limites') && v;
const ent = (v, lo, hi) => need(Number.isInteger(v) && v >= lo && v <= hi, 'entier hors limites') && v;
const rec = (v, max = 1000) => need(isObj(v) && Object.keys(v).length <= max, 'objet attendu') && v;
const ID = /^[\w.:+#-]{1,80}$/;
const map = (v, f, max = 1000) => Object.fromEntries(Object.entries(rec(v, max)).map(([k, x]) => [need(ID.test(k), 'clé invalide') && k, f(x)]));
const str = (v, re) => need(typeof v === 'string' && re.test(v), 'texte invalide') && v;
const bool = v => need(typeof v === 'boolean', 'booléen attendu') && v;
const card = x => { x = rec(x, 20); const o = {}; for (const k of ['box', 'b']) if (k in x) o[k] = ent(x[k], 0, 4); if ('due' in x) o.due = fin(x.due, 4e12); if ('seen' in x) o.seen = fin(x.seen, 1e9); return o; };
const best = v => Array.isArray(v) ? (need(v.length <= 50), v.map(x => fin(x, 1))) : map(v, x => fin(x, 1), 50);
// Un schéma par clé : retourne la valeur nettoyée (champs inconnus supprimés) ou lève une erreur.
const SCHEMA = {
  'sp.profile': v => { rec(v, 20); return { xp: fin(v.xp ?? 0, 1e7), hits: fin(v.hits ?? 0, 1e8), badges: map(v.badges ?? {}, x => fin(x, 4e12), 50) }; },
  'sp.progress': v => map(v, x => { x = rec(x, 20); const o = { stars: ent(x.stars ?? 0, 0, 3) }; for (const k of ['plays']) if (k in x) o[k] = ent(x[k], 0, 1e6); for (const k of ['last', 'due']) if (k in x) o[k] = fin(x[k], 4e12); if ('box' in x) o.box = ent(x.box, 0, 4); return o; }, 500),
  'sp.days': v => map(v, x => { x = rec(x, 20); const o = { sec: fin(x.sec ?? 0, 864e3), done: (Array.isArray(x.done ?? []) && (x.done ?? []).length <= 300) ? (x.done ?? []).map(i => str(i, ID)) : fail('liste attendue') }; if ('train' in x) o.train = ent(x.train, 0, 1); return o; }, 1000),
  'sp.plan': v => { rec(v, 20); need(Array.isArray(v.days) && v.days.length >= 1 && v.days.length <= 7, 'plan.days : tableau attendu'); return { days: [...new Set(v.days.map(d => ent(d, 0, 6)))], minutes: ent(v.minutes, 1, 120), time: str(v.time, /^\d\d:\d\d$/), start: ent(v.start ?? 0, 0, 200) }; },
  'sp.week': v => { rec(v, 20); return { id: str(v.id, /^\d{4}-W\d{1,2}$/), sec: fin(v.sec ?? 0, 7 * 864e3), lessons: ent(v.lessons ?? 0, 0, 1e4), reviews: ent(v.reviews ?? 0, 0, 1e4) }; },
  'sp.chords': v => { rec(v, 20); const o = { cards: map(v.cards ?? {}, card, 200) }; if ('n' in v) o.n = ent(v.n, 0, 200); if (v.xpDay != null) o.xpDay = { d: str(rec(v.xpDay, 5).d, /^[\d-]{1,12}$/), n: ent(v.xpDay.n, 0, 1e4) }; return o; },
  'sp.reading': v => { rec(v, 20); const o = { cards: map(v.cards ?? {}, card, 200), best: best(v.best ?? {}) }; for (const k of ['labels', 'scroll']) if (k in v) o[k] = bool(v[k]); return o; },
  'sp.ear': v => { rec(v, 20); return { best: best(v.best ?? []), cards: map(v.cards ?? {}, card, 500) }; },
  'sp.guided': v => map(v, x => ent(x, 0, 1e4), 500),
  'sp.settings': v => { rec(v, 20); const o = {}; for (const k of ['mode', 'hands', 'input']) if (k in v) o[k] = str(v[k], /^\w{1,20}$/); if ('speed' in v) { o.speed = fin(v.speed, 4); need(o.speed >= 0.1); } for (const k of ['names', 'metro', 'recall', 'piano']) if (k in v) o[k] = bool(v[k]); return o; },
  'sp.micLat': v => fin(v, 2),
  'sp.library': v => { need(Array.isArray(v) && v.length <= 200, 'liste attendue'); return v.map(s => { rec(s, 30); need(typeof s.title === 'string' && s.title.length <= 300 && Array.isArray(s.notes) && s.notes.every(n => Array.isArray(n) && n.length <= 10 && n.every(x => typeof x === 'number' || typeof x === 'string' || typeof x === 'boolean')), 'morceau invalide'); return s; }); },
};
/** -> { data, warnings } ou { error } ; rien n'est écrit ici. Clés inconnues ignorées, schéma strict par clé. */
export function parseImport(text) {
  if (typeof text !== 'string' || text.length > MAX_IMPORT) return { error: 'Fichier trop volumineux (maximum 1 Mo).' };
  let j; try { j = JSON.parse(text); } catch { return { error: 'Fichier illisible : ce n\'est pas du JSON valide.' }; }
  if (!isObj(j) || j.app !== 'pianoflow' || !isObj(j.data)) return { error: 'Ce fichier n\'est pas une sauvegarde PianoFlow.' };
  const data = {}, warnings = [];
  for (const k of KEYS) {
    if (j.data[k] == null) continue;
    if (k === 'sp.library' && JSON.stringify(j.data[k]).length >= MAX_LIBRARY) { warnings.push('Tes partitions importées (trop volumineuses) n\'ont pas été restaurées.'); continue; }
    try { data[k] = SCHEMA[k](j.data[k]); } catch (e) { return { error: `Sauvegarde invalide (${k.slice(3)} : ${e.message}) : rien n'a été modifié.` }; }
  }
  return Object.keys(data).length ? { data, warnings } : { error: 'Cette sauvegarde ne contient aucune donnée reconnue.' };
}

/* ---------- carte de partage (image PNG, aucune donnée personnelle) ---------- */
export const CARD = { w: 1080, h: 1350 };
const PAL = { bg: '#0b0e22', card: '#151a3a', line: '#262c5a', fg: '#eef1ff', mut: '#97a0cf', acc: '#38bdf8', acc2: '#818cf8' };
const MAX_CHORDS = 14;
const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;
// Données affichées (textes, tronquages) ; pure.
export function cardModel(sm) {
  const cal = sm.calendar || [];
  let streak = 0, i = cal.length - 1;
  if (i >= 0 && !(cal[i].min > 0)) i--; // aujourd'hui pas encore joué : la série d'hier compte
  for (; i >= 0 && cal[i].min > 0; i--) streak++;
  const chords = (sm.chords || []).slice(0, MAX_CHORDS), more = Math.max(0, (sm.chords || []).length - chords.length);
  return {
    title: "J'apprends le piano avec PianoFlow", brand: 'PianoFlow',
    level: `Niveau ${sm.level.level}`, xp: `${sm.level.xp} XP`, pct: sm.level.pct,
    streak, streakText: streak ? plural(streak, 'jour') + ' de suite' : 'Prêt à reprendre',
    lessons: `${sm.lessons.done} / ${sm.lessons.total}`, lessonsLabel: 'leçons réussies',
    chordsLabel: sm.chords?.length ? `Accords maîtrisés (${sm.chords.length})` : 'Accords : bientôt !',
    chords, more, reading: `Lecture : palier ${sm.reading.done}/${sm.reading.total}`, ear: `Oreille : palier ${sm.ear.done}/${sm.ear.total}`,
    days: cal.map(c => c.lvl), calLabel: '30 derniers jours', footer: 'Un peu chaque jour, à mon rythme.',
  };
}
// Mise en page pure : liste d'opérations de dessin, testable sans canvas.
export function cardLayout(m) {
  const { w, h } = CARD, ops = [], M = 80;
  const rect = (x, y, rw, rh, fill, r = 0, alpha = 1) => ops.push({ k: 'rect', x, y, w: rw, h: rh, fill, r, alpha });
  const text = (t, x, y, size, fill, o = {}) => ops.push({ k: 'text', t, x, y, size, fill, weight: o.weight || 400, align: o.align || 'left', maxW: o.maxW || w - 2 * M });
  rect(0, 0, w, h, PAL.bg);
  text(m.brand, M, 120, 44, PAL.acc, { weight: 800 });
  text(m.title, M, 190, 46, PAL.fg, { weight: 700 });
  rect(M, 240, w - 2 * M, 200, PAL.card, 28);
  text(m.level, M + 40, 320, 72, PAL.fg, { weight: 800, maxW: 560 }); text(m.xp, w - M - 40, 320, 40, PAL.mut, { align: 'right', maxW: 300 });
  rect(M + 40, 360, w - 2 * M - 80, 24, PAL.line, 12); if (m.pct > 0) rect(M + 40, 360, Math.max(24, (w - 2 * M - 80) * m.pct / 100), 24, PAL.acc, 12);
  const half = (w - 2 * M - 24) / 2;
  rect(M, 470, half, 200, PAL.card, 28); text(String(m.streak), M + 40, 580, 96, PAL.acc, { weight: 800, maxW: half - 80 }); text(m.streakText, M + 40, 636, 32, PAL.mut, { maxW: half - 80 });
  rect(M + half + 24, 470, half, 200, PAL.card, 28); text(m.lessons, M + half + 64, 580, 80, PAL.acc2, { weight: 800, maxW: half - 80 }); text(m.lessonsLabel, M + half + 64, 636, 32, PAL.mut, { maxW: half - 80 });
  // accords : pastilles sur 2 lignes maximum
  rect(M, 700, w - 2 * M, 250, PAL.card, 28); text(m.chordsLabel, M + 40, 756, 34, PAL.fg, { weight: 700 });
  let x = M + 40, y = 790, row = 0;
  for (const c of m.chords.concat(m.more ? ['+' + m.more] : [])) {
    const cw = 36 + 24 * c.length;
    if (x + cw > w - M - 40) { x = M + 40; y += 70; if (++row > 1) break; }
    rect(x, y, cw, 54, PAL.line, 27); text(c, x + cw / 2, y + 38, 30, PAL.fg, { weight: 700, align: 'center', maxW: cw - 12 }); x += cw + 12;
  }
  text(m.reading, M, 1010, 36, PAL.fg, { weight: 600 }); text(m.ear, M, 1062, 36, PAL.fg, { weight: 600 });
  text(m.calLabel, M, 1130, 30, PAL.mut);
  const g = 10, cs = (w - 2 * M - 29 * g) / 30; // 30 cases sur une ligne
  m.days.forEach((l, i) => rect(M + i * (cs + g), 1155, cs, cs, l ? PAL.acc : PAL.line, 6, l ? 0.3 + 0.175 * l : 1));
  text(m.footer, M, 1290, 30, PAL.mut);
  return ops;
}
function paint(ctx, ops) {
  for (const o of ops) {
    ctx.globalAlpha = o.alpha ?? 1; ctx.fillStyle = o.fill;
    if (o.k === 'rect') { ctx.beginPath(); (o.r && ctx.roundRect) ? ctx.roundRect(o.x, o.y, o.w, o.h, o.r) : ctx.rect(o.x, o.y, o.w, o.h); ctx.fill(); }
    else { ctx.font = `${o.weight} ${o.size}px system-ui,"Segoe UI",sans-serif`; ctx.textAlign = o.align; ctx.fillText(o.t, o.x, o.y, o.maxW); }
  }
  ctx.globalAlpha = 1;
}
export const renderCard = sm => {
  const c = document.createElement('canvas'); c.width = CARD.w; c.height = CARD.h;
  paint(c.getContext('2d'), cardLayout(cardModel(sm))); return c;
};
async function shareCard(sm) {
  const blob = await new Promise(r => renderCard(sm).toBlob(r, 'image/png'));
  if (!blob) return "Impossible de créer l'image.";
  const file = new File([blob], 'pianoflow-progression.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    try { await navigator.share({ files: [file], text: "J'apprends le piano avec PianoFlow" }); return "Merci d'avoir partagé !"; }
    catch (e) { if (e.name === 'AbortError') return ''; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return 'Image enregistrée : tu peux la partager où tu veux.';
}

/* ---------- UI ---------- */
const CSS = `.st{display:grid;gap:12px;max-width:640px;margin:0 auto;color:var(--fg)}
.st-card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px}
.st-card h3{margin:0 0 8px;font-size:1rem}
.st-bar{height:10px;background:var(--line);border-radius:6px;overflow:hidden}
.st-bar>i{display:block;height:100%;background:linear-gradient(90deg,var(--acc),var(--acc2))}
.st-mut{color:var(--mut);font-size:.85rem}
.st-msg{background:var(--card);border:1px solid var(--acc);border-radius:14px;padding:14px;font-weight:600}
.st-cal{display:grid;grid-template-columns:repeat(10,1fr);gap:4px}
.st-d{aspect-ratio:1;border-radius:6px;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:.7rem;color:var(--fg)}
.st-d[data-l="1"]{background:color-mix(in srgb,var(--acc) 25%,transparent)}
.st-d[data-l="2"]{background:color-mix(in srgb,var(--acc) 50%,transparent)}
.st-d[data-l="3"]{background:color-mix(in srgb,var(--acc) 75%,transparent)}
.st-d[data-l="4"]{background:var(--acc);color:var(--bg);font-weight:700}
.st-row{display:grid;grid-template-columns:1fr auto;gap:4px 10px;align-items:center;margin:6px 0}
.st-row .st-bar{grid-column:1/-1}
.st-chips{display:flex;flex-wrap:wrap;gap:6px}.st-chips span{border:1px solid var(--line);border-radius:999px;padding:3px 10px}
.st-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.st-act{display:flex;gap:8px;flex-wrap:wrap}
.st-note{min-height:1.2em}`;

export function mount(container, store) {
  if (!document.getElementById('st-style')) { const s = document.createElement('style'); s.id = 'st-style'; s.textContent = CSS; document.head.append(s); }
  const load = () => Object.fromEntries(KEYS.map(k => [k, store.get(k, null)]).filter(([, v]) => v != null));
  const render = (note = '') => {
    const d = load(), s = summarize(d), bar = (n, t) => `<div class="st-bar" role="progressbar" aria-valuenow="${n}" aria-valuemin="0" aria-valuemax="${t}"><i style="width:${t ? Math.round(100 * n / t) : 0}%"></i></div>`;
    container.innerHTML = `<div class="st">
<div class="st-msg" role="status">${s.messages.map(m => `<div>${esc(m)}</div>`).join('')}</div>
<section class="st-card"><h3>Niveau ${s.level.level}</h3>${bar(s.level.into, s.level.span)}<div class="st-mut">${s.level.xp} XP · encore ${s.level.span - s.level.into} XP pour le niveau ${s.level.level + 1}</div></section>
<section class="st-card"><h3>30 derniers jours</h3>
<div class="st-cal" role="list">${s.calendar.map(c => `<div class="st-d" role="listitem" data-l="${c.lvl}" title="${c.date} : ${c.min} min" aria-label="${c.date} : ${c.min ? c.min + ' minutes jouées' : 'pas de piano'}">${c.min || ''}</div>`).join('')}</div>
<div class="st-mut">Chiffre = minutes jouées ; plus la case est foncée, plus tu as joué.</div></section>
<div class="st-grid"><section class="st-card"><h3>Cette semaine</h3><b>${s.minutes.week} min</b></section><section class="st-card"><h3>Ce mois-ci</h3><b>${s.minutes.month} min</b></section></div>
<section class="st-card"><h3>Leçons réussies : ${s.lessons.done} / ${s.lessons.total}</h3>${bar(s.lessons.done, s.lessons.total)}${s.lessons.perLevel.map(l => `<div class="st-row"><span>${esc(l.title)}</span><span class="st-mut">${l.done}/${l.total}</span>${bar(l.done, l.total)}</div>`).join('')}</section>
<section class="st-card"><h3>Accords maîtrisés (${s.chords.length}/${CHORDS.length})</h3>${s.chords.length ? `<div class="st-chips">${s.chords.map(c => `<span>${esc(c)}</span>`).join('')}</div>` : '<div class="st-mut">Pas encore : ils apparaîtront ici au fil de tes révisions.</div>'}</section>
<div class="st-grid"><section class="st-card"><h3>Lecture</h3>Palier ${s.reading.done} / ${s.reading.total}</section><section class="st-card"><h3>Oreille</h3>Palier ${s.ear.done} / ${s.ear.total}</section></div>
<section class="st-card"><h3>Ce que tu sais jouer maintenant</h3>${s.known.length ? `<ul>${s.known.map(k => `<li>${esc(k)} ★★★</li>`).join('')}</ul>` : '<div class="st-mut">Obtiens ★★★ sur une leçon pour la voir apparaître ici.</div>'}</section>
<section class="st-card"><h3>Prochaine étape conseillée</h3>${esc(s.next)}</section>
<section class="st-card"><h3>Sauvegarde sans compte</h3><div class="st-act"><button class="ghost" id="st-exp">Exporter ma progression</button><button class="ghost" id="st-imp">Importer</button><button class="ghost" id="st-share">Partager ma progression</button><input type="file" id="st-file" accept="application/json,.json" hidden></div><div class="st-mut st-note" role="status">${esc(note)}</div></section></div>`;
    container.querySelector('#st-exp').onclick = () => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([exportData(load())], { type: 'application/json' }));
      a.download = `pianoflow-progression-${dkey(new Date())}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    container.querySelector('#st-share').onclick = async () => { const n = await shareCard(s); if (n) container.querySelector('.st-note').textContent = n; };
    const f = container.querySelector('#st-file');
    container.querySelector('#st-imp').onclick = () => f.click();
    f.onchange = async () => {
      const file = f.files[0]; f.value = ''; if (!file) return;
      if (file.size > MAX_IMPORT) return render("Fichier trop volumineux (maximum 1 Mo) : rien n'a été modifié.");
      const r = parseImport(await file.text());
      if (r.error) return render(r.error);
      if (!confirm('Remplacer ta progression actuelle par celle de ce fichier ?')) return render('Import annulé.');
      const failed = KEYS.filter(k => k in r.data && !store.set(k, r.data[k]));
      if (failed.length) return render(`Restauration partielle : stockage plein, ${failed.map(k => k.slice(3)).join(', ')} non restauré. Libère de la place puis réessaie.`);
      alert('Progression restaurée' + (r.warnings.length ? ' (' + r.warnings.join(' ') + ')' : '') + ' : l\'application va se recharger.');
      location.reload();
    };
  };
  render();
}
