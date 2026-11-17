import assert from 'node:assert/strict';
import { buildSchedule, MESSAGES } from './notify.js';
assert.equal(MESSAGES.length, 8);
const now = new Date(2026, 10, 18, 19, 0); // mercredi 19:00 local
assert.deepEqual(buildSchedule({ days: [] }, now), []);
assert.deepEqual(buildSchedule(null, now), []);
const s = buildSchedule({ days: [3, 1, 1, 9], time: '07:05' }, now);
assert.equal(s.length, 2);
assert.deepEqual(s.map(x => x.weekday), [2, 4]); // lundi=2, mercredi=4 (Capacitor)
assert.ok(s.every(x => x.hour === 7 && x.minute === 5));
assert.equal(s[1].next.getDay(), 3); assert.equal(s[1].next.getDate(), 25); // mercredi 7:05 déjà passé => semaine suivante
assert.equal(s[0].next.getDate(), 23); assert.equal(s[0].next.getHours(), 7);
assert.equal(new Set(s.map(x => x.id)).size, 2);
assert.equal(buildSchedule({ days: [0, 1, 2, 3, 4, 5, 6] }, now).length, 7);
assert.equal(buildSchedule({ days: [3], time: '20:00' }, now)[0].next.getDate(), 18); // aujourd'hui 20h
assert.equal(buildSchedule({ days: [1], time: 'xx' }, now)[0].hour, 18);
console.log('test-notify OK');
