// Lance tous les test*.mjs du dossier (sauf ce fichier) en sous-processus ; code ≠ 0 si un seul échoue.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, basename } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const self = basename(fileURLToPath(import.meta.url));
const files = readdirSync(dir).filter(f => /^test.*\.mjs$/.test(f) && f !== self).sort();
const results = [];
for (const f of files) {
  console.log(`\n=== ${f} ===`);
  const t = Date.now();
  const r = spawnSync(process.execPath, [f], { cwd: dir, stdio: 'inherit' });
  results.push({ f, ok: r.status === 0, ms: Date.now() - t });
}
console.log('\n=== Récapitulatif ===');
for (const r of results) console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.f} (${r.ms} ms)`);
const ko = results.filter(r => !r.ok).length;
console.log(`${results.length - ko}/${results.length} fichiers de test réussis`);
process.exit(ko || !results.length ? 1 : 0);
