import assert from 'node:assert/strict';
// faux DOM minimal : éléments { hidden, click }
const els = {}, clicks = [];
const mk = (id, hidden = true) => (els[id] = { hidden, dataset: {}, click() { clicks.push(id); } });
globalThis.document = { querySelector: s => els[s] || null };
const reset = () => { for (const k of Object.keys(els)) delete els[k]; clicks.length = 0; };
const { handleBack } = await import('./back.js');

reset(); mk('#prefs', false); mk('#p_close');
assert.equal(handleBack(), true); assert.deepEqual(clicks, ['#p_close'], 'Réglages ouverts : Retour les ferme');

reset(); mk('#game', false); mk('#pauseBtn');
assert.equal(handleBack(), true); assert.deepEqual(clicks, ['#pauseBtn'], 'en jeu : Retour met en pause');

reset(); mk('#game', false); mk('#pause', false); mk('#quit');
assert.equal(handleBack(), true); assert.deepEqual(clicks, ['#quit'], 'en pause : Retour quitte vers le menu');

reset(); mk('#result', false); mk('#toMenu');
assert.equal(handleBack(), true); assert.deepEqual(clicks, ['#toMenu']);

reset(); const on = mk('#tabs button.on'); on.dataset.tab = 'songs'; mk('#tabs button[data-tab="today"]');
assert.equal(handleBack(), true); assert.deepEqual(clicks, ['#tabs button[data-tab="today"]'], 'autre onglet : retour à Aujourd\'hui');

reset(); const t = mk('#tabs button.on'); t.dataset.tab = 'today';
assert.equal(handleBack(), false, "accueil sans rien d'ouvert : l'appli peut se fermer");
console.log('back OK');
