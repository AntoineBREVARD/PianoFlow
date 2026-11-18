// Déclare la clé de debug fixe dans android/app/build.gradle (généré par `cap add android`).
import fs from 'node:fs';
const f = process.argv[2] || 'android/app/build.gradle';
let s = fs.readFileSync(f, 'utf8');
if (s.includes('signing/debug.keystore')) { console.log('déjà patché'); process.exit(0); }
const block = `android {
    signingConfigs {
        debug {
            storeFile file("$rootDir/../signing/debug.keystore")
            storePassword "android"
            keyAlias "androiddebugkey"
            keyPassword "android"
        }
    }`;
if (!/^android \{/m.test(s)) { console.error('bloc "android {" introuvable dans ' + f); process.exit(1); }
s = s.replace(/^android \{/m, block);
fs.writeFileSync(f, s);
console.log('build.gradle patché');
