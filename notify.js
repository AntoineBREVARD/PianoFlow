// Rappels quotidiens : notifications locales Capacitor (APK) ; navigateur => .ics (géré par learn.js)
export const MESSAGES = [
  'Ton piano t\'attend : quelques minutes suffisent 🎹',
  'Une petite séance ? Même 5 minutes comptent.',
  'Prêt·e pour ta séance du jour ? Tes doigts vont te remercier.',
  'Un peu de musique pour bien finir la journée ?',
  'Chaque séance te rapproche de ton prochain morceau.',
  'Ton rythme, ton choix : ouvre PianoFlow quand tu veux.',
  'Petit moment piano ? Tu progresses plus que tu ne le crois.',
  'Une mélodie t\'attend, à ton rythme.'
];
const BASE_ID = 9100; // ids fixes 9101..9107 (un par jour de la semaine)

/** Fonction pure. weekday suit Capacitor : 1=dimanche..7=samedi ; next = prochaine occurrence (heure locale). */
export function buildSchedule(plan, now = new Date()) {
  const days = [...new Set((plan?.days || []).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
  const m = /^(\d{1,2}):(\d{2})$/.exec(plan?.time || '18:00');
  const hour = m ? Math.min(23, +m[1]) : 18, minute = m ? Math.min(59, +m[2]) : 0;
  return days.map((d, i) => {
    const next = new Date(now); next.setHours(hour, minute, 0, 0);
    next.setDate(next.getDate() + ((d - now.getDay() + 7) % 7));
    if (next <= now) next.setDate(next.getDate() + 7);
    return { id: BASE_ID + d + 1, weekday: d + 1, hour, minute, title: 'PianoFlow 🎹', body: MESSAGES[i % MESSAGES.length], next };
  });
}

const plugin = () => (globalThis.Capacitor?.isNativePlatform?.() ? globalThis.Capacitor.Plugins?.LocalNotifications : null);
const allIds = () => [1, 2, 3, 4, 5, 6, 7].map(i => ({ id: BASE_ID + i }));

/** @returns {{ok:boolean, native:boolean, reason?:string, message:string}} */
export async function schedule(plan) {
  const LN = plugin();
  if (!LN) return { ok: false, native: false, reason: 'web', message: 'Les rappels automatiques sont disponibles dans l\'appli Android. Ici, ajoute-les à ton agenda (.ics).' };
  let perm = await LN.checkPermissions();
  if (perm.display !== 'granted') perm = await LN.requestPermissions();
  if (perm.display !== 'granted') return { ok: false, native: true, reason: 'denied', message: 'Notifications refusées : autorise-les dans Réglages Android > Applications > PianoFlow > Notifications.' };
  await LN.cancel({ notifications: allIds() });
  const list = buildSchedule(plan);
  if (!list.length) return { ok: true, native: true, message: 'Aucun jour choisi : pas de rappel.' };
  await LN.schedule({ notifications: list.map(n => ({ id: n.id, title: n.title, body: n.body, schedule: { on: { weekday: n.weekday, hour: n.hour, minute: n.minute }, allowWhileIdle: false } })) });
  return { ok: true, native: true, message: 'Rappels activés ✓' };
}

export async function cancelAll() {
  const LN = plugin();
  if (LN) await LN.cancel({ notifications: allIds() });
  return !!LN;
}
