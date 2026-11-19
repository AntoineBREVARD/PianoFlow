// Bouton Retour (Android / navigateur) : ferme l'écran ouvert, remonte vers « Aujourd'hui », et ne quitte l'appli que depuis l'accueil.
// Principe : une entrée d'historique « sentinelle » est toujours devant nous ; chaque Retour la consomme puis on la remet si on a géré le Retour.
const $ = s => document.querySelector(s);
const shown = s => { const e = $(s); return !!e && !e.hidden; };

/** @returns {boolean} true si le Retour a été géré dans l'appli (donc on ne quitte pas). */
export function handleBack() {
  if (shown('#modal')) { $('#modal').hidden = true; return true; }
  if (shown('#prefs')) { $('#p_close')?.click(); return true; }
  if (shown('#composer')) { ($('#c_cancel') || $('#composer button.ghost'))?.click(); if (shown('#composer')) $('#composer').hidden = true; return true; }
  if (shown('#setup')) { $('#setupCancel')?.click(); return true; }
  if (shown('#result')) { $('#toMenu')?.click(); return true; }
  if (shown('#pause')) { $('#quit')?.click(); return true; }
  if (shown('#game')) { $('#pauseBtn')?.click(); return true; }
  const on = document.querySelector('#tabs button.on');
  if (on && on.dataset.tab !== 'today') { document.querySelector('#tabs button[data-tab="today"]')?.click(); return true; }
  return false;
}

export function initBack() {
  if (typeof history === 'undefined') return;
  const arm = () => history.pushState({ pf: 1 }, '');
  history.replaceState({ pf: 0 }, ''); arm();
  addEventListener('popstate', () => { if (handleBack()) arm(); else history.back(); });
}
