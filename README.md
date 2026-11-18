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

## Programme personnalisé
Dans « Mes morceaux », le bouton **🎯 Objectif** crée un programme pour apprendre un morceau avant une date limite (raccourcis 2 semaines / 1 mois / 3 mois, minutes par jour, jours de la semaine).
- **Analyse** du morceau (`songplan.js`) : découpe en phrases de 2 à 8 mesures, difficulté par phrase, temps de travail estimé, et verdict de faisabilité honnête (réaliste / serré / irréaliste, avec suggestions : plus de minutes, date plus tardive, ou ne garder que le début du morceau).
- **Calendrier** : chaque phrase est travaillée main par main, puis à deux mains, puis à 60 / 80 / 100 % du tempo, avec des révisions espacées et un passage complet la veille. Le temps prévu tient compte du niveau mesuré du joueur (`skill.js`, stocké dans `sp.skill`).
- **Adaptation** : après chaque tentative (et à chaque nouveau jour) le calendrier est recalculé depuis la progression réelle. En retard, la phrase non maîtrisée est rallongée au lieu de passer à la suite ; en avance, la date de fin estimée recule. Une étape est validée par 2 tentatives consécutives réussies.
- **Accueil** : carte « 🎯 Programme » (date limite, progression, statut, tâches du jour avec bouton « Jouer » qui lance la bonne phrase, les bonnes mains et la bonne vitesse). Bouton « 🧠 Mon niveau » dans la barre de statut.
- **Limites** : toutes les formules (difficulté, temps estimé, seuils de maîtrise, modèle de niveau) sont des **heuristiques non validées sur de vrais élèves** ; seule la cohérence interne est testée (`test-skill.mjs`, `test-songplan.mjs`, `test-goals.mjs`). Un seul programme actif par morceau ; données locales à l'appareil (pas de synchronisation, pas de classement entre joueurs).

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

## Clé de debug de l'APK
`signing/debug.keystore` est une clé de **debug** volontairement publique (mot de passe `android`) : elle sert à signer toujours pareil l'APK de test, pour que chaque nouvelle version s'installe par-dessus la précédente sans désinstaller. Pour le Play Store, il faudra une clé de publication privée, à garder hors du dépôt.
