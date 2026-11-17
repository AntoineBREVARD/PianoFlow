# PianoFlow 🎹

Appli web (PWA) type Simply Piano : importe une partition MuseScore (`.mxl`, `.musicxml`, `.mid`), les notes tombent sur un clavier, et tu joues.

- **Modes** : pas à pas (attend la bonne note), rythme (suit le tempo), démo
- **Mains** : droite / gauche / les deux · vitesse réglable · noms de notes (Do Ré Mi)
- **Entrées** : clavier tactile multi-touch, micro (vrai piano, expérimental), piano USB-MIDI (Chrome Android)
- Hors ligne une fois installée ("Ajouter à l'écran d'accueil")

Lancer en local : `python3 -m http.server 8123` puis ouvrir http://localhost:8123.
Sur téléphone il faut du HTTPS (GitHub Pages, Netlify…) pour le micro et l'installation.

Limites connues : reprises/da capo non dépliés, changements de tempo ignorés (premier tempo uniquement).
