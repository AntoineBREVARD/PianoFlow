# Feuille de route PianoFlow

## Fait
- Cours de 10 niveaux / 89 leçons, test de placement
- Notes qui tombent (pas à pas, rythme, démo), mains séparées, vitesse réglable
- Import MusicXML / MIDI, morceaux écrits en texte, apprentissage guidé d'un morceau
- Lecture de notes sur portée (8 paliers), accords en lettres (22), oreille (5 paliers)
- Séance du jour, série, rappels `.ics`, révision espacée (Leitner)
- XP, niveaux, badges, écran de progression
- Entrées clavier tactile, micro (monophonique), USB-MIDI (PWA)
- Hors ligne (PWA) et APK Android construit par GitHub Actions
- Réglages : entrée, noms de notes, décalage, recalibrage du micro
- Programme personnalisé pour apprendre un morceau avant une date (niveau mesuré, blocs de travail, adaptation au retard/à l'avance)
- Enregistrement de la partie, partage natif Android (enregistrement + carte de progression), accompagnement basse/percussions, son de piano synthétisé
- Rappels natifs Android (notifications locales)
- Refonte graphique (design system, icônes SVG, écran de jeu animé, mouvement réduit respecté)
- APK de test signé avec une clé de debug fixe : mise à jour par-dessus l'ancienne version, empreinte vérifiée par le workflow
- Testé sur un vrai téléphone (Galaxy S21 Ultra, Android 15) : 60 images/s, micro avec son joué par un PC, notifications, partage

## À faire
- [ ] Détection micro **polyphonique** (accords)
- [ ] Vrai son de piano par échantillons (sampling)
- [ ] Publication Play Store : AAB **release signé**
- [ ] Hébergement web gratuit (ex. Cloudflare Pages) pour installer la PWA en HTTPS et activer Web MIDI
- [ ] Tester le micro avec un vrai piano (les tests ont utilisé un son synthétique joué par un PC)
- [ ] Vérifier à l'oreille les mélodies de certains morceaux
- [ ] da capo / coda / segno
