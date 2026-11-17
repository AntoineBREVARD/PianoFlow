import assert from 'node:assert/strict';
import { parseMidi, finalize, readMxl, MXL_MAX } from './parsers.js';

const mid = (tempoBytes, notes = true) => {
  const ev = [];
  if (tempoBytes) ev.push(0x00, 0xff, 0x51, 0x03, ...tempoBytes);
  if (notes) ev.push(0x00, 0x90, 60, 100, 0x60, 0x80, 60, 0);
  ev.push(0x00, 0xff, 0x2f, 0x00);
  const h = [0x4d,0x54,0x68,0x64,0,0,0,6,0,0,0,1,0,96];
  const t = [0x4d,0x54,0x72,0x6b,0,0,0,ev.length,...ev];
  return new Uint8Array([...h, ...t]).buffer;
};
// tempo 0 : ignoré, bpm 100 par défaut, fini
let s = finalize(parseMidi(mid([0, 0, 0])));
assert.equal(s.bpm, 100); assert.ok(Number.isFinite(s.bpm));
// tempo énorme (1 µs/noire) : borné à 400
s = finalize(parseMidi(mid([0, 0, 1])));
assert.equal(s.bpm, 400);
// tempo minuscule : borné à 20
s = finalize(parseMidi(mid([0xff, 0xff, 0xff])));
assert.equal(s.bpm, 20);
// tempo normal 120
assert.equal(finalize(parseMidi(mid([0x07, 0xa1, 0x20]))).bpm, 120);
// sans notes
assert.throws(() => parseMidi(mid(null, false)), /Aucune note/);
assert.throws(() => finalize({ raw: [] }), /Aucune note/);

// zip bombe simulée : entrée deflate annonçant 1 Mo mais produisant >20 Mo, puis taille annoncée > plafond
import zlib from 'node:zlib';
const zip = (usize, data, name = 'a.xml') => {
  const nm = Buffer.from(name), lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(nm.length, 26);
  const cd = Buffer.alloc(46); cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(8, 10); cd.writeUInt32LE(data.length, 20); cd.writeUInt32LE(usize, 24); cd.writeUInt16LE(nm.length, 28); cd.writeUInt32LE(0, 42);
  const body = Buffer.concat([lh, nm, data]), cdir = Buffer.concat([cd, nm]);
  const e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(1, 10); e.writeUInt32LE(cdir.length, 12); e.writeUInt32LE(body.length, 16);
  const b = Buffer.concat([body, cdir, e]); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
};
const big = zlib.deflateRawSync(Buffer.alloc(MXL_MAX + 5e6));
await assert.rejects(readMxl(zip(MXL_MAX + 5e6, big)), /trop volumineuse/);
await assert.rejects(readMxl(zip(1000, big)), /excessive/);
assert.equal(await readMxl(zip(5, zlib.deflateRawSync(Buffer.from('<a/>x')))), '<a/>x');
console.log('test-parsers OK');
