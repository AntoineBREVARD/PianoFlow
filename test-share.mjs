import assert from 'node:assert/strict';
import { shareBlob } from './share.js';
const blob = new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'audio/webm' });
const calls = [];
globalThis.Capacitor = { isNativePlatform: () => true, Plugins: {
  Filesystem: { writeFile: async o => { calls.push(['write', o]); return { uri: 'file:///cache/' + o.path }; } },
  Share: { share: async o => { calls.push(['share', o]); } } } };
assert.equal(await shareBlob(blob, 'a.webm', { title: 'T' }), 'shared');
assert.equal(calls[0][1].data, 'AQID+g==', 'base64 du fichier');
assert.equal(calls[0][1].directory, 'CACHE');
assert.deepEqual(calls[1][1].files, ['file:///cache/a.webm']);
globalThis.Capacitor.Plugins.Share.share = async () => { throw new Error('Share canceled'); };
assert.equal(await shareBlob(blob, 'a.webm'), 'cancel', 'annulation utilisateur = pas une erreur');
console.log('share OK');
