# PianoFlow 🎹

Appli web (PWA) type Simply Piano — avec un **cours complet** (33 leçons, du premier Do aux morceaux à deux mains), un **plan d'apprentissage** selon ta fréquence (séance du jour, série, rappels .ics) et un **apprentissage guidé** de n'importe quel morceau (main droite → gauche → ensemble → tempo) : importe une partition MuseScore (`.mxl`, `.musicxml`, `.mid`), les notes tombent sur un clavier, et tu joues.

- **Modes** : pas à pas (attend la bonne note), rythme (suit le tempo), démo
- **Mains** : droite / gauche / les deux · vitesse réglable · noms de notes (Do Ré Mi)
- **Entrées** : clavier tactile multi-touch, micro (vrai piano, expérimental), piano USB-MIDI (Chrome Android)
- Hors ligne une fois installée ("Ajouter à l'écran d'accueil")

Lancer en local : `python3 -m http.server 8123` puis ouvrir http://localhost:8123.
Sur téléphone il faut du HTTPS (GitHub Pages, Netlify…) pour le micro et l'installation.

Limites connues : da capo/coda/segno non gérés ; les reprises simples, voltas et changements de tempo le sont.

## Sans MuseScore payant
MuseScore Studio (musescore.org) est gratuit et exporte en .mxl/.mid. Des fichiers MIDI/MusicXML gratuits : piano-midi.de, Mutopia, IMSLP, BitMidi.
On peut aussi écrire un morceau directement dans l'appli (« Écrire un morceau en texte »).

## Publication (GitHub Pages)
Réglages du dépôt → Pages → Source : **GitHub Actions**. Le workflow `.github/workflows/pages.yml` déploie à chaque push sur `main`.
