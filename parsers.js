// Lecture de partitions : MIDI (.mid), MusicXML (.musicxml/.xml) et MusicXML compressé (.mxl)
// Résultat : { title, bpm, notes: [[midi, debutEnTemps, dureeEnTemps, 'R'|'L'], ...] }
// "temps" = noire (quarter note).

export async function parseFile(file) {
  const name = file.name.toLowerCase();
  const buf = await file.arrayBuffer();
  let song;
  if (/\.(mid|midi)$/.test(name)) song = parseMidi(buf);
  else if (name.endsWith('.mxl')) song = parseXml(await readMxl(buf));
  else song = parseXml(new TextDecoder().decode(buf));
  if (!song.title) song.title = file.name.replace(/\.[^.]+$/, '');
  return finalize(song);
}

export function finalize(song) {
  let raw = song.raw;
  if (!raw.length) throw new Error('Aucune note trouvée dans ce fichier.');
  raw.sort((a, b) => a.s - b.s || a.m - b.m);
  const t0 = raw[0].s;
  const notes = raw.map(n => [n.m, round(n.s - t0), Math.max(0.1, round(n.d)), n.h, ...(n.f ? [n.f] : [])]);
  const tempos = (song.tempos || []).map(([b, v]) => [round(Math.max(0, b - t0)), Math.round(v)]);
  const out = { title: song.title, bpm: Math.round(tempos[0]?.[1] || song.bpm || 100), notes };
  if (tempos.length > 1) out.tempos = tempos;
  return out;
}
const round = x => Math.round(x * 1000) / 1000;

/* ------------------------------ MIDI ------------------------------ */
export function parseMidi(buf) {
  const v = new DataView(buf);
  let p = 0;
  const str = n => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(v.getUint8(p++)); return s; };
  if (str(4) !== 'MThd') throw new Error('Fichier MIDI invalide.');
  p += 4;
  p += 2; // format
  const nt = v.getUint16(p); p += 2;
  const div = v.getUint16(p); p += 2;
  if (div & 0x8000) throw new Error('MIDI SMPTE non supporté.');
  let bpm = null, title = ''; const tempos = [];
  const tracks = [];
  for (let ti = 0; ti < nt && p < buf.byteLength; ti++) {
    const id = str(4); const len = v.getUint32(p); p += 4;
    const end = p + len;
    if (id !== 'MTrk') { p = end; continue; }
    let tick = 0, run = 0;
    const on = new Map(), notes = [];
    const vlq = () => { let x = 0, b; do { b = v.getUint8(p++); x = (x << 7) | (b & 0x7f); } while (b & 0x80); return x; };
    while (p < end) {
      tick += vlq();
      let st = v.getUint8(p);
      if (st < 0x80) st = run; else { p++; if (st < 0xf0) run = st; }
      if (st === 0xff) {
        const type = v.getUint8(p++); const l = vlq();
        if (type === 0x51) { const b = 60000000 / ((v.getUint8(p) << 16) | (v.getUint8(p + 1) << 8) | v.getUint8(p + 2)); if (bpm == null) bpm = b; tempos.push([tick / div, b]); }
        if (type === 0x03 && !title) { let s = ''; for (let i = 0; i < l; i++) s += String.fromCharCode(v.getUint8(p + i)); title = s.trim(); }
        p += l;
      } else if (st === 0xf0 || st === 0xf7) { p += vlq(); }
      else {
        const hi = st & 0xf0, ch = st & 0x0f;
        const a = v.getUint8(p++); const b = hi === 0xc0 || hi === 0xd0 ? 0 : v.getUint8(p++);
        if (ch === 9) continue; // percussions
        if (hi === 0x90 && b > 0) { if (!on.has(ch * 128 + a)) on.set(ch * 128 + a, tick); }
        else if (hi === 0x80 || (hi === 0x90 && b === 0)) {
          const k = ch * 128 + a;
          if (on.has(k)) { notes.push({ m: a, s: on.get(k) / div, d: (tick - on.get(k)) / div }); on.delete(k); }
        }
      }
    }
    p = end;
    if (notes.length) tracks.push(notes);
  }
  if (!tracks.length) throw new Error('Aucune note dans ce MIDI.');
  const raw = [];
  if (tracks.length >= 2) {
    const avg = tracks.map(t => t.reduce((s, n) => s + n.m, 0) / t.length);
    const mean = avg.reduce((a, b) => a + b, 0) / avg.length;
    tracks.forEach((t, i) => t.forEach(n => raw.push({ ...n, h: avg[i] >= mean ? 'R' : 'L' })));
  } else tracks[0].forEach(n => raw.push({ ...n, h: n.m >= 60 ? 'R' : 'L' }));
  // MIDI joué à la main : regroupe les accords « roulés » (notes à moins de 0.08 temps)
  raw.sort((a, b) => a.s - b.s);
  let cs = -9;
  for (const n of raw) { if (n.s - cs < 0.08) n.s = cs; else cs = n.s; }
  // tempos dédoublonnés (un par piste)
  const tm = [...new Map(tempos.sort((a, b) => a[0] - b[0]).map(x => [Math.round(x[0] * 100), x])).values()];
  return { title, bpm, tempos: tm, raw };
}

/* ------------------------------ MusicXML ------------------------------ */
const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function parseXml(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Fichier MusicXML invalide.');
  if (doc.documentElement.nodeName === 'score-timewise') throw new Error('MusicXML « timewise » non supporté.');
  const title = (doc.querySelector('work-title') || doc.querySelector('movement-title'))?.textContent.trim() || '';
  const raw = [], tempos = [];
  [...doc.querySelectorAll('part')].forEach((part, pi) => {
    // 1) lecture de chaque mesure (temps relatifs au début de la mesure)
    let div = 1, ending = null;
    const meas = [];
    for (const me of part.children) {
      if (me.nodeName !== 'measure') continue;
      const M = { notes: [], tempos: [], len: 0, fwd: false, bwd: false, times: 1, ending: null };
      let t = 0, last = 0;
      for (const el of me.children) {
        const q = s => el.querySelector(s);
        const dur = () => (+q('duration')?.textContent || 0) / div;
        switch (el.nodeName) {
          case 'attributes': { const d = q('divisions'); if (d) div = +d.textContent || 1; break; }
          case 'direction': { const s = q('sound[tempo]'); if (s) M.tempos.push([t, +s.getAttribute('tempo')]); break; }
          case 'sound': if (el.getAttribute('tempo')) M.tempos.push([t, +el.getAttribute('tempo')]); break;
          case 'barline': {
            const r = q('repeat'); if (r) { if (r.getAttribute('direction') === 'forward') M.fwd = true; else { M.bwd = true; M.times = +r.getAttribute('times') || 1; } }
            const en = q('ending');
            if (en) {
              const type = en.getAttribute('type');
              if (type === 'start') ending = { nums: en.getAttribute('number').split(/[,\s]+/).map(Number), open: true };
              else if (ending) ending.close = true;
            }
            break;
          }
          case 'backup': t -= dur(); break;
          case 'forward': t += dur(); break;
          case 'note': {
            if (q('grace')) break;
            const chord = !!q('chord'), d = dur(), start = chord ? last : t, p = q('pitch');
            if (p && !q('rest')) {
              const m = (+p.querySelector('octave').textContent + 1) * 12 + STEP[p.querySelector('step').textContent] + (+p.querySelector('alter')?.textContent || 0);
              M.notes.push({ m, s: start, d, staff: +q('staff')?.textContent || 1, ts: !!q('tie[type="start"]'), te: !!q('tie[type="stop"]') });
            }
            if (!chord) { last = t; t += d; }
            break;
          }
        }
        M.len = Math.max(M.len, t);
      }
      // volta : le début de la mesure peut aussi porter <ending> (barline left) — détecté ci-dessus
      M.ending = ending ? ending.nums : null;
      if (ending?.close) ending = null;
      meas.push(M);
    }
    // 2) dépliage des reprises
    const order = []; const done = new Map();
    let i = 0, start = 0, pass = 1, guard = 0;
    while (i < meas.length && guard++ < 5000) {
      const m = meas[i];
      if (m.fwd && start !== i) { start = i; pass = 1; }
      if (m.ending && !m.ending.includes(pass)) { i++; continue; }
      order.push(i);
      if (m.bwd && (done.get(i) || 0) < m.times) { done.set(i, (done.get(i) || 0) + 1); pass++; i = start; continue; }
      if (m.bwd) { start = i + 1; pass = 1; }
      i++;
    }
    // 3) mise à plat dans le temps + liaisons
    let off = 0; const open = new Map();
    for (const idx of order) {
      const M = meas[idx];
      if (pi === 0) M.tempos.forEach(([r, b]) => tempos.push([off + r, b]));
      for (const n of M.notes) {
        const key = n.m + '/' + n.staff, s = off + n.s;
        if (n.te && open.has(key)) {
          const o = open.get(key); o.d = s + n.d - o.s;
          if (!n.ts) open.delete(key);
        } else {
          const o = { m: n.m, s, d: n.d, staff: n.staff }; raw.push(o);
          if (n.ts) open.set(key, o);
        }
      }
      off += M.len;
    }
  });
  const staves = raw.some(n => n.staff >= 2);
  raw.forEach(n => { n.h = staves ? (n.staff >= 2 ? 'L' : 'R') : (n.m >= 60 ? 'R' : 'L'); });
  const tm = [...new Map(tempos.sort((a, b) => a[0] - b[0]).map(x => [Math.round(x[0] * 100), x])).values()];
  return { title, bpm: tm[0]?.[1] ?? null, tempos: tm, raw };
}

/* ------------------------------ .mxl (zip) ------------------------------ */
async function readMxl(buf) {
  const v = new DataView(buf), u8 = new Uint8Array(buf), dec = new TextDecoder();
  let e = buf.byteLength - 22;
  while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('Archive .mxl invalide.');
  const n = v.getUint16(e + 10, true);
  let p = v.getUint32(e + 16, true);
  const files = {};
  for (let i = 0; i < n; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true);
    const nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true);
    const off = v.getUint32(p + 42, true);
    files[dec.decode(u8.subarray(p + 46, p + 46 + nl))] = { method, csize, off };
    p += 46 + nl + xl + cl;
  }
  const read = async name => {
    const f = files[name]; const lh = f.off;
    const start = lh + 30 + v.getUint16(lh + 26, true) + v.getUint16(lh + 28, true);
    const data = u8.subarray(start, start + f.csize);
    if (f.method === 0) return dec.decode(data);
    const s = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return dec.decode(await new Response(s).arrayBuffer());
  };
  let root = null;
  if (files['META-INF/container.xml']) {
    const c = new DOMParser().parseFromString(await read('META-INF/container.xml'), 'application/xml');
    root = c.querySelector('rootfile')?.getAttribute('full-path');
  }
  if (!root || !files[root]) root = Object.keys(files).find(k => /\.(xml|musicxml)$/i.test(k) && !k.startsWith('META-INF'));
  if (!root) throw new Error('Aucune partition dans le .mxl.');
  return read(root);
}
