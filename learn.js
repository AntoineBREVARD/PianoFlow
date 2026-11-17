// Cours, plan d'apprentissage, séance du jour, parcours guidé d'un morceau.
import { LEVELS, ALL } from './curriculum.js';

const $ = s => document.querySelector(s);
let H = null, progress = {}, plan = null, days = {}, guidedP = {};
const dkey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const DOW = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const PRESETS = [
  { label: 'Tous les jours · 5 min', days: [0, 1, 2, 3, 4, 5, 6], minutes: 5 },
  { label: '3 fois par semaine · 15 min', days: [1, 3, 5], minutes: 15 },
  { label: '5 fois par semaine · 20 min', days: [1, 2, 3, 4, 5], minutes: 20 },
  { label: 'Week-end · 30 min', days: [6, 0], minutes: 30 },
];

export function init(host) {
  H = host;
  progress = H.store.get('sp.progress', {}); plan = H.store.get('sp.plan', null);
  days = H.store.get('sp.days', {}); guidedP = H.store.get('sp.guided', {});
  document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => tab(b.dataset.tab));
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
  tab(H.store.get('sp.tab', 'today'));
  if (!plan) planEditor(true);
}
export function refresh() { renderToday(); renderCourse(); }
export function onTime(secs) {
  if (!(secs > 0)) return;
  const d = (days[dkey()] ||= { sec: 0, done: [] }); d.sec += secs;
  H.store.set('sp.days', days);
}

/* ---------- helpers ---------- */
function tab(name) {
  H.store.set('sp.tab', name);
  for (const t of ['today', 'course', 'songs']) $('#tab-' + t).hidden = t !== name;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  refresh(); scrollTo(0, 0);
}
function modal(html) { $('#modalBody').innerHTML = html; $('#modal').hidden = false; return $('#modalBody'); }
function closeModal() { $('#modal').hidden = true; }
const stars = l => progress[l.id]?.stars || 0;
const done = l => stars(l) >= 1;
const unlocked = i => !plan || i <= (plan.start || 0) || !!progress[ALL[i].id] || (i > 0 && done(ALL[i - 1]));
const starStr = n => '★'.repeat(n) + '☆'.repeat(3 - n);
const scheduled = date => plan?.days.includes(date.getDay());
const validated = key => (days[key]?.sec || 0) >= plan.minutes * 60 * 0.7;
function streak() {
  if (!plan) return 0;
  let n = 0; const d = new Date(); d.setHours(12);
  if (validated(dkey(d))) n++;
  for (let i = 1; i < 400; i++) {
    d.setDate(d.getDate() - 1);
    if (validated(dkey(d))) n++;
    else if (scheduled(d)) break;
  }
  return n;
}
function weekDots() {
  const d = new Date(); d.setHours(12);
  const monday = new Date(d); monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  let html = '', goal = 0, ok = 0;
  for (let i = 0; i < 7; i++) {
    const x = new Date(monday); x.setDate(monday.getDate() + i);
    const sch = scheduled(x), v = validated(dkey(x)), today = dkey(x) === dkey();
    if (sch) goal++; if (sch && v) ok++;
    html += `<div class="dot ${sch ? 'sch' : ''} ${v ? 'ok' : ''} ${today ? 'today' : ''}"><span>${DOW[x.getDay()][0]}</span>${v ? '✓' : ''}</div>`;
  }
  return { html, goal, ok };
}

/* ---------- séance du jour ---------- */
function session() {
  const units = Math.max(1, Math.round(plan.minutes / 5));
  const next = ALL.findIndex(l => !done(l));
  const reviews = ALL.filter(done).sort((a, b) => stars(a) - stars(b) || progress[a.id].last - progress[b.id].last);
  const items = [];
  if (units >= 3 && reviews.length) items.push({ l: reviews[0], tag: 'Révision' });
  if (next >= 0) for (let i = next; i < ALL.length && items.length < units; i++) items.push({ l: ALL[i], tag: 'Nouveau' });
  for (const l of reviews) if (items.length < units && !items.some(x => x.l === l)) items.push({ l, tag: 'Révision' });
  return items;
}
function renderToday() {
  const el = $('#tab-today'); if (!plan) { el.innerHTML = ''; return; }
  const key = dkey(), rec = days[key] || { sec: 0, done: [] }, sch = scheduled(new Date());
  const target = plan.minutes * 60, pct = Math.min(100, rec.sec / target * 100);
  const wk = weekDots(), sn = streak();
  const items = session();
  const doneToday = new Set(rec.done);
  el.innerHTML = `
    <section class="card">
      <div class="streak"><div class="big-n">🔥 ${sn}</div><div>${sn > 1 ? 'jours de suite' : sn === 1 ? 'jour validé' : 'Commence ta série aujourd\'hui !'}<br><small>Cette semaine : ${wk.ok}/${wk.goal} séances</small></div></div>
      <div class="dots">${wk.html}</div>
    </section>
    <section class="card">
      <h2>${sch ? 'Séance du jour' : 'Jour de repos'} <small class="mut">· ${plan.minutes} min</small></h2>
      ${sch ? '' : '<p class="hint" style="margin-top:0">Ce n\'est pas un jour d\'entraînement prévu — mais tu peux t\'entraîner quand même.</p>'}
      <div class="progress"><div style="width:${pct}%"></div></div>
      <small class="mut">${Math.floor(rec.sec / 60)} / ${plan.minutes} min jouées aujourd'hui${validated(key) ? ' · ✓ séance validée' : ''}</small>
      <ul id="sess"></ul>
      ${items.length ? '' : '<p>🎉 Tu as terminé tout le programme ! Choisis un morceau dans l\'onglet « Morceaux ».</p>'}
    </section>
    <button id="editPlan" class="ghost">⚙️ Modifier mon plan</button>`;
  const ul = el.querySelector('#sess');
  items.forEach(({ l, tag }) => {
    const li = document.createElement('li'); const i = ALL.indexOf(l), ok = unlocked(i) || items.some(x => ALL.indexOf(x.l) === i - 1);
    li.innerHTML = `<div class="info"><b></b><small>${tag} · ${doneToday.has(l.id) ? '✓ fait aujourd\'hui' : starStr(stars(l))}</small></div>`;
    li.querySelector('b').textContent = l.title;
    const b = document.createElement('button'); b.textContent = doneToday.has(l.id) ? 'Rejouer' : 'Jouer'; b.className = doneToday.has(l.id) ? 'ghost' : 'primary';
    b.onclick = () => startLesson(l, ok);
    li.append(b); ul.append(li);
  });
  el.querySelector('#editPlan').onclick = () => planEditor(false);
}

/* ---------- cours ---------- */
function renderCourse() {
  const el = $('#tab-course'); el.innerHTML = '';
  const total = ALL.length, fin = ALL.filter(done).length;
  const head = document.createElement('section'); head.className = 'card';
  head.innerHTML = `<h2>Apprendre le piano</h2><p class="hint" style="margin-top:0">Un programme progressif : débute avec une seule note et finis par des morceaux à deux mains. Il faut au moins ★ pour débloquer la suite.</p><div class="progress"><div style="width:${fin / total * 100}%"></div></div><small class="mut">${fin}/${total} leçons réussies</small>`;
  el.append(head);
  LEVELS.forEach((lv, li) => {
    const sec = document.createElement('section'); sec.className = 'card'; sec.innerHTML = `<h2>${lv.title}</h2><ul></ul>`;
    const ul = sec.querySelector('ul');
    ALL.filter(l => l.level === li).forEach(l => {
      const i = ALL.indexOf(l), open = unlocked(i), li2 = document.createElement('li');
      li2.innerHTML = `<div class="info"><b></b><small>${open ? starStr(stars(l)) : '🔒 Verrouillée'}</small></div>`;
      li2.querySelector('b').textContent = l.title;
      const b = document.createElement('button'); b.textContent = open ? (done(l) ? 'Rejouer' : 'Jouer') : '🔒'; b.className = open ? 'primary' : 'ghost'; b.disabled = !open;
      b.onclick = () => startLesson(l, true);
      li2.append(b); ul.append(li2);
    });
    el.append(sec);
  });
}

function startLesson(l, ok) {
  if (!ok) { modal('<h2>Leçon verrouillée</h2><p>Réussis d\'abord la leçon précédente (au moins ★).</p><div class="actions"><button class="primary" id="mOk">OK</button></div>'); $('#mOk').onclick = closeModal; return; }
  const b = modal(`<h2></h2><p></p><p class="hint">Mode : ${l.mode === 'rhythm' ? 'rythme — joue en suivant le tempo' : 'pas à pas — le morceau t\'attend'}. Les chiffres sur les notes sont les doigts à utiliser (1 = pouce).</p>
    <div class="actions"><button class="ghost" id="mNo">Annuler</button><button class="primary" id="mGo">Commencer</button></div>`);
  b.querySelector('h2').textContent = l.title; b.querySelector('p').textContent = l.intro;
  $('#mNo').onclick = closeModal;
  $('#mGo').onclick = () => { closeModal(); H.begin(l.song, { mode: l.mode || 'wait', hands: 'both', speed: l.speed || 1, label: l.title, onDone: s => lessonDone(l, s) }); };
}
function lessonDone(l, s) {
  const p = (progress[l.id] ||= { stars: 0, plays: 0 });
  p.stars = Math.max(p.stars, s.stars); p.plays++; p.last = Date.now();
  const d = (days[dkey()] ||= { sec: 0, done: [] }); if (s.stars >= 1 && !d.done.includes(l.id)) d.done.push(l.id);
  H.store.set('sp.progress', progress); H.store.set('sp.days', days);
  const i = ALL.indexOf(l), nx = ALL[i + 1];
  if (s.stars >= 1 && nx) return { label: 'Leçon suivante : ' + nx.title, run: () => startLesson(nx, true) };
  if (s.stars < 1) return { hint: 'Il faut au moins ★ pour passer à la suite : réessaie !' };
}

/* ---------- plan ---------- */
function planEditor(first) {
  const p = plan || { days: [1, 3, 5], minutes: 10, start: 0, time: '18:00' };
  const b = modal(`<h2>${first ? '👋 Bienvenue ! Crée ton plan' : 'Mon plan d\'apprentissage'}</h2>
    ${first ? `<label>Ton niveau<select id="p_level"><option value="0">Débutant complet — je pars de zéro</option>${LEVELS.slice(1).map((lv, i) => `<option value="${LEVELS.slice(0, i + 1).reduce((n, x) => n + x.lessons.length, 0)}">J'ai des bases — ${lv.title}</option>`).join('')}</select></label>` : ''}
    <p class="hint" style="margin-top:0">Choisis ta fréquence : l'appli prépare chaque séance pour toi.</p>
    <div class="chips">${PRESETS.map((x, i) => `<button class="chip" data-i="${i}">${x.label}</button>`).join('')}</div>
    <div class="dayrow">${ORDER.map(d => `<label class="day"><input type="checkbox" value="${d}" ${p.days.includes(d) ? 'checked' : ''}><span>${DOW[d]}</span></label>`).join('')}</div>
    <label>Durée d'une séance<select id="p_min">${[5, 10, 15, 20, 30, 45, 60].map(m => `<option ${m === p.minutes ? 'selected' : ''} value="${m}">${m} minutes</option>`).join('')}</select></label>
    <label>Heure du rappel<input id="p_time" type="time" value="${p.time || '18:00'}"></label>
    <div class="actions" style="justify-content:space-between"><button class="ghost" id="p_ics">📅 Rappels dans mon agenda</button><button class="primary" id="p_save">Enregistrer</button></div>`);
  b.querySelectorAll('.chip').forEach(c => c.onclick = () => {
    const x = PRESETS[+c.dataset.i];
    b.querySelectorAll('.day input').forEach(i => { i.checked = x.days.includes(+i.value); }); $('#p_min').value = x.minutes;
  });
  const read = () => ({ days: [...b.querySelectorAll('.day input:checked')].map(i => +i.value), minutes: +$('#p_min').value, time: $('#p_time').value || '18:00' });
  $('#p_save').onclick = () => {
    const r = read(); if (!r.days.length) { alert('Choisis au moins un jour.'); return; }
    plan = { ...p, ...r, start: first ? +($('#p_level')?.value || 0) : (p.start || 0) };
    H.store.set('sp.plan', plan); closeModal(); refresh();
  };
  $('#p_ics').onclick = () => { const r = read(); if (!r.days.length) { alert('Choisis au moins un jour.'); return; } downloadIcs(r); };
}
function downloadIcs({ days: ds, minutes, time }) {
  const code = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'], [hh, mm] = time.split(':');
  const d = new Date(); while (!ds.includes(d.getDay())) d.setDate(d.getDate() + 1);
  const stamp = new Date().toISOString().replace(/[-:]|\.\d+/g, '');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PianoFlow//FR', 'BEGIN:VEVENT', `UID:pianoflow-${Date.now()}@local`, `DTSTAMP:${stamp}`,
    `DTSTART:${dkey(d).replace(/-/g, '')}T${hh}${mm}00`, `DURATION:PT${minutes}M`, `RRULE:FREQ=WEEKLY;BYDAY=${ds.map(x => code[x]).join(',')}`,
    'SUMMARY:🎹 Séance de piano', 'DESCRIPTION:Ouvre PianoFlow et fais ta séance du jour.', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Séance de piano', 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = 'pianoflow-rappels.ics';
  document.body.append(a); a.click(); a.remove();
}

/* ---------- parcours guidé d'un morceau quelconque ---------- */
function stagesFor(song) {
  const end = Math.max(...song.notes.map(n => n[1] + n[2]));
  const S = end <= 24 ? 1 : Math.ceil(end / 16), st = [];
  const hasIn = (h, a, b) => song.notes.some(n => n[3] === h && n[1] >= a - 1e-6 && n[1] < b - 1e-6);
  for (let k = 0; k < S; k++) {
    const from = k * end / S, to = k === S - 1 ? end + 1 : (k + 1) * end / S, sec = S > 1 ? `Partie ${k + 1}/${S} · ` : '';
    const R = hasIn('R', from, to), Lh = hasIn('L', from, to);
    if (R) st.push({ label: sec + 'Main droite', hands: 'R', mode: 'wait', from, to });
    if (Lh) st.push({ label: sec + 'Main gauche', hands: 'L', mode: 'wait', from, to });
    if (R && Lh) st.push({ label: sec + 'Les deux mains', hands: 'both', mode: 'wait', from, to });
  }
  st.push({ label: 'Morceau entier · rythme lent', hands: 'both', mode: 'rhythm', speed: 0.7 });
  st.push({ label: 'Morceau entier · tempo normal', hands: 'both', mode: 'rhythm', speed: 1 });
  return st;
}
export function guided(song) {
  const st = stagesFor(song), idx = Math.min(guidedP[song.id] || 0, st.length);
  const finished = idx >= st.length;
  const b = modal(`<h2>🎓 Apprendre pas à pas</h2><p></p>
    <ol class="stages">${st.map((s, i) => `<li class="${i < idx ? 'ok' : i === idx ? 'cur' : ''}">${s.label}</li>`).join('')}</ol>
    <div class="actions"><button class="ghost" id="g_reset">Recommencer</button><button class="ghost" id="g_no">Fermer</button><button class="primary" id="g_go">${finished ? 'Rejouer le morceau' : idx ? 'Continuer' : 'Commencer'}</button></div>`);
  b.querySelector('p').textContent = `« ${song.title} » : on le découpe en étapes, comme un prof. Réussis chaque étape (au moins ★) pour passer à la suivante.`;
  $('#g_no').onclick = closeModal;
  $('#g_reset').onclick = () => { guidedP[song.id] = 0; H.store.set('sp.guided', guidedP); guided(song); };
  $('#g_go').onclick = () => { closeModal(); runStage(song, st, finished ? st.length - 1 : idx); };
}
function runStage(song, st, i) {
  const s = st[i];
  H.begin(song, {
    mode: s.mode, hands: s.hands, speed: s.speed || 1, from: s.from, to: s.to, label: `${song.title} — ${s.label}`,
    onDone: r => {
      if (r.stars < 1) return { hint: 'Il faut au moins ★ pour passer à l\'étape suivante : réessaie !' };
      if ((guidedP[song.id] || 0) <= i) { guidedP[song.id] = i + 1; H.store.set('sp.guided', guidedP); }
      const nx = st[i + 1];
      return nx ? { label: 'Étape suivante : ' + nx.label, run: () => runStage(song, st, i + 1) } : { hint: '🎉 Morceau appris !' };
    },
  });
}
