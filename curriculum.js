// Programme d'apprentissage : du « où est le Do ? » aux morceaux à deux mains.
// Notation : NOTE:durée^doigt  (voir songs.js). Main droite : 1 = pouce … 5 = auriculaire.
import { compose, DEMOS } from './songs.js';

const ODE_R = 'E4^3 E4^3 F4^4 G4^5 | G4^5 F4^4 E4^3 D4^2 | C4^1 C4^1 D4^2 E4^3 | E4:1.5^3 D4:.5^2 D4:2^2 | E4^3 E4^3 F4^4 G4^5 | G4^5 F4^4 E4^3 D4^2 | C4^1 C4^1 D4^2 E4^3 | D4:1.5^2 C4:.5^1 C4:2^1';
const ODE_L = 'C3+G3:4 | G2+D3:4 | C3+G3:4 | G2+D3:4 | C3+G3:4 | G2+D3:4 | C3+G3:4 | G2+D3:2 C3+G3:2';
const CLAIR_R = 'C4^1 C4^1 C4^1 D4^2 | E4:2^3 D4:2^2 | C4^1 E4^3 D4^2 D4^2 | C4:4^1';
const demo = t => DEMOS.find(d => d.title === t);
const L = (id, title, intro, rh, lh, bpm, extra = {}) => ({ id, title, intro, song: { ...compose(title, bpm, rh, lh), id: 'lesson-' + id }, ...extra });
const fromDemo = (id, title, intro, demoTitle, extra = {}) => ({ id, title, intro, song: { ...demo(demoTitle), id: 'lesson-' + id }, ...extra });

export const LEVELS = [
  { title: 'Niveau 1 · Premiers pas', lessons: [
    L('1-1', 'Trouve le Do', "Le Do se trouve juste à gauche d'un groupe de deux touches noires. Joue-le avec le pouce (1) de la main droite. Les notes tombent : joue la touche quand elle arrive en bas — le morceau t'attend.", 'C4:1^1 C4^1 C4^1 C4^1 | C4:2^1 C4:2^1', null, 70),
    L('1-2', 'Do – Ré – Mi', "Trois doigts, trois notes : pouce (1) sur Do, index (2) sur Ré, majeur (3) sur Mi. Garde la main détendue, doigts arrondis.", 'C4^1 D4^2 E4^3 | E4^3 D4^2 C4^1 | C4^1 D4^2 E4^3 D4^2 | C4:2^1', null, 70),
    L('1-3', 'Les cinq doigts', "Un doigt par touche : Do Ré Mi Fa Sol, du pouce à l'auriculaire. C'est la « position de base » de la main droite.", 'C4^1 D4^2 E4^3 F4^4 G4^5 | G4^5 F4^4 E4^3 D4^2 C4:2^1', null, 70),
    L('1-4', 'Main gauche', "Même chose à la main gauche, une octave plus bas — mais à l'envers : l'auriculaire (5) joue le Do grave, le pouce (1) le Sol.", null, 'C3^5 D3^4 E3^3 F3^2 G3^1 | G3^1 F3^2 E3^3 D3^4 C3:2^5', 70),
    L('1-5', 'Au clair de la lune', "Ta première vraie mélodie, à la main droite.", CLAIR_R, null, 80),
    L('1-6', 'Les deux mains', "Les deux mains jouent ensemble : Do avec Do, Sol avec Sol. Regarde les deux couleurs : orange = main gauche, bleu = main droite.", 'C4:2^1 G4:2^5 | E4:4^3', 'C3:2^5 G3:2^1 | C3:4^5', 70),
  ] },
  { title: 'Niveau 2 · Le rythme', lessons: [
    L('2-1', 'Noires et blanches', "Une barre courte dure 1 temps (noire), une barre longue 2 temps (blanche). Maintenant le morceau ne t'attend plus : joue en rythme !", 'C4^1 C4^1 D4:2^2 | E4^3 E4^3 F4:2^4 | G4:4^5', null, 70, { mode: 'rhythm', speed: 0.8 }),
    L('2-2', 'Les croches', "Les barres très courtes sont des croches : deux croches = 1 temps. Joue-les régulièrement, deux fois plus vite que les noires.", 'C4:.5^1 D4:.5^2 E4:.5^3 F4:.5^4 G4^5 G4^5 | G4:.5^5 F4:.5^4 E4:.5^3 D4:.5^2 C4:2^1', null, 70, { mode: 'rhythm', speed: 0.8 }),
    L('2-3', 'Les silences', "Les espaces vides sont des silences : on ne joue pas, mais on compte quand même !", 'C4^1 R:1 E4^3 R:1 | G4^5 R:1 E4^3 R:1 | C4:4^1', null, 70, { mode: 'rhythm', speed: 0.8 }),
    L('2-4', 'Ode à la joie · main droite', "Un classique de Beethoven. Concentre-toi sur la main droite.", ODE_R, null, 90),
    L('2-5', 'Ode à la joie · main gauche', "Maintenant la main gauche seule : des notes doubles (quinte Do-Sol).", null, ODE_L, 90),
    fromDemo('2-6', 'Ode à la joie · deux mains', "On assemble les deux mains. Prends ton temps, le morceau t'attend.", 'Ode à la joie'),
  ] },
  { title: 'Niveau 3 · Mains ensemble', lessons: [
    L('3-1', "L'accord de Do", "Un accord = plusieurs notes en même temps : Do Mi Sol, avec les doigts 5-3-1 à la main gauche.", 'E4:2^3 G4:2^5 | E4:4^3', 'C3+E3+G3:4^5+3+1 | C3+E3+G3:4^5+3+1', 70),
    L('3-2', 'Au clair de la lune · deux mains', "La mélodie à droite, un accompagnement à gauche.", CLAIR_R, 'C3+G3:4 | C3+G3:4 | G2+D3:4 | C3+G3:4', 80),
    fromDemo('3-3', 'Joyeux anniversaire', "Une mesure à trois temps : compte « 1-2-3 ».", 'Joyeux anniversaire'),
    fromDemo('3-4', 'Frère Jacques', "Les phrases se répètent deux fois : repère-les.", 'Frère Jacques'),
  ] },
  { title: 'Niveau 4 · Aller plus loin', lessons: [
    L('4-1', 'Gamme de Do majeur', "Une gamme monte sur huit notes. Après le Mi, le pouce passe SOUS la main pour jouer le Fa : doigtés 1-2-3 puis 1-2-3-4-5.", 'C4^1 D4^2 E4^3 F4^1 G4^2 A4^3 B4^4 C5:2^5', null, 70),
    L('4-2', 'Les touches noires', "Les touches noires sont les dièses (♯) : Do♯ est juste à droite de Do. Ici : tous les demi-tons.", 'C4 C#4 D4 D#4 E4 F4 F#4 G4:2', null, 70),
    L('4-3', 'Accords Do – Fa – Sol', "Les trois accords les plus utilisés de la chanson. Change de position en bougeant toute la main.", 'C4:2 C4:2 | C4:2 B3:2 | C4:4', 'C3+E3+G3:2 F3+A3+C4:2 | G2+B2+D3:2 C3+E3+G3:2 | C3+E3+G3:4', 70),
    fromDemo('4-4', 'Jingle Bells (refrain)', "Un morceau festif avec accompagnement.", 'Jingle Bells (refrain)'),
    fromDemo('4-5', 'Für Elise (début)', "Le défi du niveau : notes rapides et dièse. Vas-y lentement, la vitesse viendra.", 'Für Elise (début)', { speed: 0.7 }),
  ] },
];
export const ALL = LEVELS.flatMap((lv, li) => lv.lessons.map(l => ({ ...l, level: li })));
