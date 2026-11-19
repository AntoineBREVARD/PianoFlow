import assert from 'node:assert/strict';
import { spell, posOf, preferFlats, chooseStaves, staffIndex, ledgerPositions, noteKind, geometry, prepare } from './score.js';

// altérations : sharps par défaut, bémols sur demande ; Do# et Réb sur la même hauteur mais pas la même ligne
assert.deepEqual(spell(60), { step: 28, acc: 0 });
assert.deepEqual(spell(61), { step: 28, acc: 1 });
assert.deepEqual(spell(61, true), { step: 29, acc: -1 });
assert.deepEqual(spell(70, true), { step: 34, acc: -1 }); // Sib4
assert.deepEqual(spell(71), { step: 34, acc: 0 });
// positions : Mi4 = 1re ligne Sol, Sol2 = 1re ligne Fa, Do4 = ligne supplémentaire des deux portées
assert.equal(posOf(64, 'G'), 0); assert.equal(posOf(77, 'G'), 8); assert.equal(posOf(60, 'G'), -2);
assert.equal(posOf(43, 'F'), 0); assert.equal(posOf(57, 'F'), 8); assert.equal(posOf(60, 'F'), 10);
assert.equal(posOf(79, 'G'), 9); assert.equal(posOf(81, 'G'), 10); // La5 : ligne supplémentaire
// lignes supplémentaires
assert.deepEqual(ledgerPositions(0), []); assert.deepEqual(ledgerPositions(-1), []); assert.deepEqual(ledgerPositions(-2), [-2]);
assert.deepEqual(ledgerPositions(-3), [-2]); assert.deepEqual(ledgerPositions(-4), [-2, -4]);
assert.deepEqual(ledgerPositions(9), []); assert.deepEqual(ledgerPositions(10), [10]); assert.deepEqual(ledgerPositions(13), [10, 12]);
// bémols vs dièses
assert.equal(preferFlats([{ m: 70 }, { m: 70 }, { m: 66 }]), true);
assert.equal(preferFlats([{ m: 66 }, { m: 61 }, { m: 70 }]), false);
assert.equal(preferFlats([{ m: 60 }]), false);
// choix des clés
assert.deepEqual(chooseStaves([{ m: 72, h: 'R' }, { m: 48, h: 'L' }]), ['G', 'F']);
assert.deepEqual(chooseStaves([{ m: 72, h: 'R' }, { m: 65, h: 'R' }]), ['G']);
assert.deepEqual(chooseStaves([{ m: 48, h: 'L' }, { m: 40, h: 'L' }]), ['F']);
assert.deepEqual(chooseStaves([{ m: 50, h: 'R' }]), ['F']); // main droite très grave : clé de Fa
assert.deepEqual(chooseStaves([]), ['G']);
assert.equal(staffIndex('L', ['G', 'F']), 1); assert.equal(staffIndex('R', ['G', 'F']), 0); assert.equal(staffIndex('L', ['F']), 0);
// figures
assert.deepEqual([4, 3, 2, 1.5, 1, 0.9, 0.75, 0.5, 0.25].map(d => { const k = noteKind(d); return k.base + (k.dot ? 'd' : ''); }), ['4', '2d', '2', '1d', '1', '1', '0.5d', '0.5', '0.25']);
assert.equal(noteKind(2).hollow, true); assert.equal(noteKind(1).hollow, false); assert.equal(noteKind(4).stem, false);
assert.equal(noteKind(0.5).flags, 1); assert.equal(noteKind(0.25).flags, 2); assert.equal(noteKind(1).flags, 0);
// géométrie : tout tient dans la zone, ligne de lecture ≈ 25 %, derrière la clé
for (const [W, H, n] of [[375, 652, 2], [375, 652, 1], [667, 285, 2], [1200, 700, 2]]) {
  const g = geometry(W, H, n);
  assert.equal(g.bot.length, n); assert.ok(g.lineX > g.clipX && g.lineX < W * 0.4, `lineX ${W}`);
  assert.ok(g.bot[0] - 4 * g.sp >= 0 && g.bot[n - 1] <= H, `portées dans la zone ${W}x${H}`);
}
// précalcul : accord = une seule hampe, commune
{
  const notes = [{ m: 60, s: 0, d: 1, h: 'R' }, { m: 64, s: 0, d: 1, h: 'R' }, { m: 67, s: 0, d: 1, h: 'R' }, { m: 48, s: 0, d: 4, h: 'L' }, { m: 62, s: 1, d: 0.5, h: 'R' }];
  const { stv, sc } = prepare(notes);
  assert.deepEqual(stv, ['G', 'F']);
  assert.equal(sc.slice(0, 3).filter(q => q.st).length, 1); assert.ok(sc[0].st && sc[0].up); // hampe vers le haut portée par la note grave
  assert.equal(sc[3].st, 1); assert.equal(sc[3].k.stem, false); assert.equal(sc[2].hi, sc[0].hi);
  assert.deepEqual(sc[0].led, [-2]); assert.equal(sc[4].pos, -1);
}
console.log('test-score OK');
