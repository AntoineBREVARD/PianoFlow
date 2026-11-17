# PianoFlow 🎹

Appli piano gratuite (PWA + APK Android) : apprends du premier Do jusqu'à tes morceaux préférés. **Aucune partition à lire** : les notes tombent vers un clavier, tu joues la touche qui s'allume.

## Fonctionnalités
- **Cours en 10 niveaux, 89 leçons** : repères sur le clavier, rythme, deux mains, lecture de la musique, harmonie, technique, premiers classiques. Test de placement au départ.
- **Notes qui tombent** : modes pas à pas (attend la bonne note), rythme (suit le tempo) et démo ; main droite / gauche / les deux, vitesse réglable.
- **Apprentissage de la lecture de notes** : exercices sur portée (clés de Sol et de Fa), 8 paliers.
- **Accords en lettres** (C, Am, G7, renversements…) : 22 accords, séries de 8 questions.
- **Oreille** : 5 paliers (haut/bas, intervalles, accords, mélodie, pulsation).
- **Séance du jour** adaptée à ta fréquence, série de jours, rappels `.ics`.
- **Révision espacée** (Leitner) pour les accords, la lecture et l'oreille.
- **XP, niveaux, badges** et écran « Ma progression ».
- **Entrées** : clavier tactile multi-touch, micro (vrai piano), piano USB-MIDI (Chrome Android, PWA).
- **Import MusicXML / MIDI** (`.mxl`, `.musicxml`, `.mid`) et morceaux écrits en texte ; apprentissage guidé d'un morceau (main droite → gauche → ensemble → tempo).
- **Hors ligne** une fois installée. Réglages : entrée micro/MIDI, noms de notes (Do Ré Mi / C D E), décalage, recalibrage du micro.

## Installer l'APK Android
GitHub → onglet **Actions** → workflow **« Build PianoFlow APK »** → dernier run réussi → artefact **`PianoFlow-apk`** (zip contenant `app-debug.apk`). Dézippe, copie sur le téléphone, autorise l'installation de sources inconnues. C'est un APK de debug (non signé pour le Play Store).

## Lancer en local
```
python3 -m http.server 8123
```
puis http://localhost:8123. Le micro et l'installation PWA sur téléphone demandent du HTTPS.

## Structure
| Fichier | Rôle |
|---|---|
| `index.html`, `style.css`, `app.js` | interface, lecteur de notes, entrées |
| `curriculum.js`, `songs.js`, `learn.js`, `placement.js` | cours, morceaux, séance du jour, test de placement |
| `reading.js`, `chords.js`, `ear.js`, `train.js` | lecture de notes, accords, oreille, onglet Entraîner |
| `stats.js` | progression, XP, niveaux |
| `mic.js`, `parsers.js` | détection micro ; import MusicXML/MIDI |
| `sw.js`, `manifest.json` | hors ligne / PWA |
| `.github/workflows/apk.yml`, `capacitor.config.json` | build APK (Capacitor) |
| `docs/` | fiche store, confidentialité, feuille de route |

## Tests
```
node test.mjs
node test-reading.mjs
node test-ear.mjs
node test-stats.mjs
```
(ou `for f in test*.mjs; do node $f; done`). Sans dépendance.

## Limites connues
- Le micro est **monophonique** : fiable pour une note à la fois, pas pour les accords.
- **USB-MIDI absent de l'APK** (WebView) : à utiliser via la PWA installée depuis Chrome.
- Les mélodies de certains morceaux sont à **vérifier à l'oreille**.
- da capo / coda / segno non gérés ; reprises simples, voltas et changements de tempo le sont.

## Où trouver des partitions gratuites
MuseScore Studio (musescore.org, gratuit) exporte en `.mxl`/`.mid`. Fichiers libres : piano-midi.de, Mutopia, IMSLP, BitMidi.

Voir aussi : [docs/STORE.md](docs/STORE.md) · [docs/PRIVACY.md](docs/PRIVACY.md) · [docs/ROADMAP.md](docs/ROADMAP.md)
