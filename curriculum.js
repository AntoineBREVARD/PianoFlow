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
    L('1-0', 'Repère-toi sur le clavier', "Pas besoin de savoir lire une partition ! Les notes tombent vers le clavier : tu joues la touche qui s'allume quand la note arrive en bas. Pour te repérer, regarde les touches noires : par groupes de 2 et de 3. Le Do est juste à gauche d'un groupe de 2, le Fa juste à gauche d'un groupe de 3.", 'C4:2^1 F4:2^4 | C4:2^1 F4:2^4', null, 60),
    L('1-1', 'Trouve le Do', "Le Do se trouve juste à gauche d'un groupe de deux touches noires. Joue-le avec le pouce (1) de la main droite. Les notes tombent : joue la touche quand elle arrive en bas — le morceau t'attend.", 'C4:1^1 C4^1 C4^1 C4^1 | C4:2^1 C4:2^1', null, 70),
    L('1-2', 'Do – Ré – Mi', "Trois doigts, trois notes : pouce (1) sur Do, index (2) sur Ré, majeur (3) sur Mi. Garde la main détendue, doigts arrondis.", 'C4^1 D4^2 E4^3 | E4^3 D4^2 C4^1 | C4^1 D4^2 E4^3 D4^2 | C4:2^1', null, 70),
    L('1-3', 'Les cinq doigts', "Un doigt par touche : Do Ré Mi Fa Sol, du pouce à l'auriculaire. C'est la « position de base » de la main droite.", 'C4^1 D4^2 E4^3 F4^4 G4^5 | G4^5 F4^4 E4^3 D4^2 C4:2^1', null, 70),
    L('1-4', 'Main gauche', "Même chose à la main gauche, une octave plus bas — mais à l'envers : l'auriculaire (5) joue le Do grave, le pouce (1) le Sol.", null, 'C3^5 D3^4 E3^3 F3^2 G3^1 | G3^1 F3^2 E3^3 D3^4 C3:2^5', 70),
    L('1-5', 'Au clair de la lune', "Ta première vraie mélodie, à la main droite.", CLAIR_R, null, 80),
    L('1-6', 'Les deux mains', "Les deux mains jouent ensemble : Do avec Do, Sol avec Sol. Regarde les deux couleurs : orange = main gauche, bleu = main droite.", 'C4:2^1 G4:2^5 | E4:4^3', 'C3:2^5 G3:2^1 | C3:4^5', 70),
  ] },
  { title: 'Niveau 2 · Le rythme', lessons: [
    L('2-0', 'Legato et staccato', "Legato : les notes se lient, chaque touche reste enfoncée jusqu'à la suivante. Staccato : des notes courtes et détachées, le doigt rebondit. Garde le poignet souple.", 'C4^1 D4^2 E4^3 D4^2 C4:2^1 | C4:.5^1 R:.5 E4:.5^3 R:.5 G4:.5^5 R:.5 E4:.5^3 R:.5 C4:2^1', null, 70),
    L('2-1', 'Noires et blanches', "Une barre courte dure 1 temps (noire), une barre longue 2 temps (blanche). Maintenant le morceau ne t'attend plus : joue en rythme !", 'C4^1 C4^1 D4:2^2 | E4^3 E4^3 F4:2^4 | G4:4^5', null, 70, { mode: 'rhythm', speed: 0.8 }),
    L('2-2', 'Les croches', "Les barres très courtes sont des croches : deux croches = 1 temps. Joue-les régulièrement, deux fois plus vite que les noires.", 'C4:.5^1 D4:.5^2 E4:.5^3 F4:.5^4 G4^5 G4^5 | G4:.5^5 F4:.5^4 E4:.5^3 D4:.5^2 C4:2^1', null, 70, { mode: 'rhythm', speed: 0.8 }),
    L('2-3', 'Les silences', "Les espaces vides sont des silences : on ne joue pas, mais on compte quand même !", 'C4^1 R:1 E4^3 R:1 | G4^5 R:1 E4^3 R:1 | C4:4^1', null, 70, { mode: 'rhythm', speed: 0.8 }),
    L('2-4', 'Ode à la joie · main droite', "Un classique de Beethoven. Concentre-toi sur la main droite.", ODE_R, null, 90),
    L('2-5', 'Ode à la joie · main gauche', "Maintenant la main gauche seule : des notes doubles (quinte Do-Sol).", null, ODE_L, 90),
    fromDemo('2-6', 'Ode à la joie · deux mains', "On assemble les deux mains. Prends ton temps, le morceau t'attend.", 'Ode à la joie'),
  ] },
  { title: 'Niveau 3 · Mains ensemble', lessons: [
    L('3-1', "L'accord de Do", "Un accord = plusieurs notes en même temps : Do Mi Sol, avec les doigts 5-3-1 à la main gauche.", 'E4:2^3 G4:2^5 | E4:4^3', 'C3+E3+G3:4^5+3+1 | C3+E3+G3:4^5+3+1', 70),
    L('3-2', 'Au clair de la lune · deux mains', "La mélodie à droite, un accompagnement à gauche.", CLAIR_R, 'C3+G3:4 | C3+G3:4 | G2+B2+D3:4 | C3+G3:4', 80),
    L('3-2b', 'Piano et forte', "Joue la phrase deux fois : d'abord doucement (piano), puis plus fort (forte). Sur l'écran tactile le volume ne change pas, mais avec un piano USB-MIDI la force de ta frappe se ressent : apprends à doser ton toucher.", 'C4^1 D4^2 E4^3 C4^1 | C4^1 D4^2 E4^3 C4^1 | E4^3 F4^4 G4:2^5 | C4^1 D4^2 E4^3 C4^1 | C4^1 D4^2 E4^3 C4^1 | E4^3 F4^4 G4:2^5', null, 80),
    fromDemo('3-3', 'Joyeux anniversaire', "Une mesure à trois temps : compte « 1-2-3 ».", 'Joyeux anniversaire'),
    fromDemo('3-4', 'Frère Jacques', "Les phrases se répètent deux fois : repère-les.", 'Frère Jacques'),
  ] },
  { title: 'Niveau 4 · Aller plus loin', lessons: [
    L('4-1', 'Gamme de Do majeur', "Une gamme monte sur huit notes. Après le Mi, le pouce passe SOUS la main pour jouer le Fa : doigtés 1-2-3 puis 1-2-3-4-5.", 'C4^1 D4^2 E4^3 F4^1 G4^2 A4^3 B4^4 C5:2^5', null, 70),
    L('4-1b', 'Gamme de Do, main gauche', "Même gamme à la main gauche : après le Fa, le 3e doigt passe par-dessus le pouce.", null, 'C3^5 D3^4 E3^3 F3^2 G3^1 A3^3 B3^2 C4:2^1', 70),
    L('4-1c', 'Descente : le pouce passe sous la main', "On redescend la gamme : le pouce glisse sous la main sans que le poignet tourne.", 'C5^5 B4^4 A4^3 G4^2 F4^1 E4^3 D4^2 C4:2^1', null, 70),
    L('4-1d', 'Arpège de Do', "Les notes de l'accord jouées l'une après l'autre : le poignet roule doucement, sans à-coup.", 'C4^1 E4^2 G4^3 C5^5 | G4^3 E4^2 C4:2^1', null, 70),
    L('4-2', 'Les touches noires', "Les touches noires sont les dièses (♯) : Do♯ est juste à droite de Do. Ici : tous les demi-tons.", 'C4^1 C#4^3 D4^1 D#4^3 E4^1 F4^1 F#4^3 G4:2^1', null, 70),
    L('4-3', 'Accords Do – Fa – Sol', "Les trois accords les plus utilisés de la chanson. Change de position en bougeant toute la main.", 'C4:2^1 C4:2^1 | B3:2^1 C4:2^1 | C4:4^1', 'C3+E3+G3:2^5+3+1 F3+A3+C4:2^5+3+1 | G2+B2+D3:2^5+3+1 C3+E3+G3:2^5+3+1 | C3+E3+G3:4^5+3+1', 70),
    fromDemo('4-4', 'Jingle Bells (refrain)', "Un morceau festif avec accompagnement.", 'Jingle Bells (refrain)'),
    fromDemo('4-5', 'Für Elise (début)', "Le défi du niveau : notes rapides et dièse. Vas-y lentement, la vitesse viendra.", 'Für Elise (début)', { speed: 0.7 }),
  ] },
  { title: 'Niveau 5 · Premiers classiques', lessons: [
    L('5-1', 'Gamme de Sol majeur', "Même gamme, mais un Fa♯ (touche noire) apparaît avant le Sol final : c'est ce qui donne la couleur de Sol majeur.", 'G4^1 A4^2 B4^3 C5^1 D5^2 E5^3 F#5^4 G5:2^5', null, 70),
    L('5-2', 'Gamme de La mineur', "Pas de touche noire, mais une couleur plus triste : on commence sur La, une tierce plus bas.", 'A3^1 B3^2 C4^3 D4^1 E4^2 F4^3 G4^4 A4:2^5', null, 70),
    L('5-3', "Basse d'Alberti", "La main gauche joue l'accord en arpège : bas – haut – milieu – haut. Un accompagnement classique de Mozart.", 'E4:2^3 G4:2^5 | E4:2^3 D4:2^2 | C4:4^1', 'C3^5 G3^1 E3^3 G3^1 | C3^5 G3^1 E3^3 G3^1 | C3^5 G3^1 E3^3 G3^1', 70),
    fromDemo('5-4', 'Menuet en Sol (Petzold)', "Une danse à trois temps (longtemps attribuée à Bach). Le Fa♯ de la gamme de Sol revient ici.", 'Menuet en Sol (Petzold)', { speed: 0.8 }),
    L('5-5', 'Canon de Pachelbel (début)', "Une basse qui descend, une mélodie qui l'accompagne : la progression d'accords la plus célèbre du monde.", 'F#5:2^5 E5:2^4 | D5:2^3 C#5:2^2 | B4:2^3 A4:2^2 | B4:2^3 C#5:2^4', 'D3:2^5 A2:2^5 | B2:2^4 F#2:2^5 | G2:2^5 D2:2^5 | G2:2^5 A2:2^5', 60, { speed: 0.8 }),
    L('5-6', 'Pédale de sustain', "Talon du pied au sol, appuie sur la pédale de droite juste après chaque accord et relâche-la quand l'accord change. Sans pédale ? Joue simplement les notes.", 'E4:4^3 | F4:4^4 | D4:4^2 | C4:4^1', 'C3+G3:4^5+1 | F3+C4:4^5+1 | G2+D3:4^5+1 | C3+G3:4^5+1', 60),
  ] },
  { title: 'Niveau 6 · Lire la musique', lessons: [
    L('6-1', 'La portée et la clé de Sol', "La clé de Sol note les sons aigus (main droite). Les 5 lignes de la portée, de bas en haut, sont : Mi – Sol – Si – Ré – Fa. Joue-les une à une, puis redescends.", 'E4^1 G4^2 B4^3 D5^4 F5:2^5 | F5^5 D5^4 B4^3 G4^2 E4:2^1', null, 60),
    L('6-2', 'La clé de Fa', "La clé de Fa note les sons graves (main gauche). Ses 5 lignes, de bas en haut : Sol – Si – Ré – Fa – La. Le Do du milieu (Do 4) est la note qui relie les deux clés.", null, 'G2^5 B2^4 D3^3 F3^2 A3:2^1 | A3^1 F3^2 D3^3 B2^4 G2:2^5', 60),
    L('6-3', 'Les intervalles', "Un intervalle compte l'écart entre deux notes : seconde (Do–Ré), tierce (Do–Mi), quinte (Do–Sol), octave (Do–Do). Reconnaître la distance aide à lire plus vite.", 'C4^1 D4^2 C4^1 E4^3 | C4^1 G4^5 C4^1 C5:2^5', null, 70),
    L('6-4', 'Dièses et bémols', "Le dièse (♯) monte d'un demi-ton, le bémol (♭) descend d'un demi-ton : ce sont les touches noires. Ici, La – Si♭ – Si – Do en demi-tons.", 'A4^1 Bb4^2 B4^1 C5^2 | B4^1 Bb4^2 A4:2^1', null, 70),
  ] },
  { title: 'Niveau 7 · Rythmes et mesures', lessons: [
    L('7-1', 'La mesure à 3/4', "Trois temps par mesure : fort-faible-faible, comme une valse. Compte « 1-2-3, 1-2-3 ».", 'E4^3 G4^5 G4^5 | E4^3 G4^5 G4^5 | A4:2^5 G4^3 | F4^4 E4^3 D4^2 | C4:3^1', 'C3+G3:3 | C3+G3:3 | F3+C4:3 | G2+D3:3 | C3+G3:3', 80),
    L('7-2', 'La mesure à 2/4', "Deux temps par mesure : le rythme d'une marche, « 1-2, 1-2 ». Garde un tempo bien régulier.", 'C4^1 C4^1 | E4^3 E4^3 | G4:2^5 | E4^3 C4^1 | D4^2 D4^2 | C4:2^1', 'C3+G3:2 | C3+G3:2 | C3+G3:2 | C3+G3:2 | G2+D3:2 | C3+G3:2', 90),
    L('7-3', 'La mesure à 6/8', "Six croches par mesure, regroupées par trois : on compte deux grands temps, « UN-deux-trois, DEUX-deux-trois ». Un balancement de berceuse ou de barcarolle.", 'C4:.5^1 E4:.5^3 G4:.5^5 C5:1.5^5 | C5:.5^5 G4:.5^4 E4:.5^3 C4:1.5^1 | D4:.5^2 F4:.5^4 G4:.5^5 E4:1.5^3 | D4:.5^2 E4:.5^3 D4:.5^2 C4:1.5^1', 'C3:1.5^5 G3:1.5^1 | C3:1.5^5 G3:1.5^1 | G2:1.5^5 D3:1.5^1 | C3:1.5^5 G3:1.5^1', 90),
    L('7-4', 'La syncope', "Une syncope : une note longue commence sur un temps faible et déborde sur le temps fort suivant. Le rythme « boite » — compte bien tous les temps dans ta tête.", 'C4^1 E4:2^3 G4^5 | C5^5 G4:2^3 E4^2 | D4^2 F4:2^4 G4^5 | E4:.5^3 D4:.5^2 C4:3^1', null, 80, { mode: 'rhythm', speed: 0.8 }),
    fromDemo('7-5', 'Valse des doigts (3/4)', "Un morceau à 3 temps, mains ensemble : mélodie à droite, accompagnement « basse-accord-accord » à gauche.", 'Valse des doigts (3/4)'),
  ] },
  { title: 'Niveau 8 · Harmonie et tonalités', lessons: [
    L('8-1', 'Accords mineurs : Am, Dm, Em', "Un accord mineur sonne plus triste que le majeur. La mineur : La-Do-Mi, Ré mineur : Ré-Fa-La, Mi mineur : Mi-Sol-Si. La main gauche garde les doigts 5-3-1.", 'E4:2^3 C4:2^1 | D4:2^2 F4:2^4 | G4:2^5 E4:2^3 | C4:4^1', 'A2+C3+E3:4^5+3+1 | D3+F3+A3:4^5+3+1 | E3+G3+B3:4^5+3+1 | A2+C3+E3:4^5+3+1', 70),
    fromDemo('8-2', 'Ode à la joie en Sol majeur', "La même mélodie transposée : on joue le Fa♯ en Sol majeur. Mêmes doigtés qu'en Do, mais la tonalité change la couleur.", 'Ode à la joie en Sol majeur', { speed: 0.9 }),
    L('8-3', 'Gamme de Fa majeur', "Fa majeur a un Si♭ (touche noire). Doigté de la main droite : 1-2-3-4 puis 1-2-3-4, le pouce passe sous la main après le 4e doigt.", 'F4^1 G4^2 A4^3 Bb4^4 C5^1 D5^2 E5^3 F5:2^4', null, 70),
    L('8-4', 'Accords Fa – Si♭ – Do', "Les trois accords principaux de Fa majeur (I-IV-V). Fa : Fa-La-Do, Si♭ : Si♭-Ré-Fa, Do : Do-Mi-Sol.", 'A4:2^3 F4:2^1 | D5:2^5 Bb4:2^3 | G4:2^2 E4:2^1 | F4:4^1', 'F2+A2+C3:4^5+3+1 | Bb2+D3+F3:4^5+3+1 | C3+E3+G3:4^5+3+1 | F2+A2+C3:4^5+3+1', 70),
  ] },
  { title: 'Niveau 9 · Technique avancée', lessons: [
    L('9-1', 'Gamme de Do sur 2 octaves', "Le pouce passe sous la main deux fois : 1-2-3, 1-2-3-4, 1-2-3, 1-2-3-4-5. Garde la main souple et le tempo régulier, à la montée comme à la descente.", 'C4^1 D4^2 E4^3 F4^1 G4^2 A4^3 B4^4 C5^1 D5^2 E5^3 F5^1 G5^2 A5^3 B5^4 C6:2^5 | B5^4 A5^3 G5^2 F5^1 E5^3 D5^2 C5^1 B4^4 A4^3 G4^2 F4^1 E4^3 D4^2 C4:2^1', null, 60),
    L('9-2', 'Arpèges de Do sur 2 octaves', "L'arpège déroule l'accord Do-Mi-Sol sur deux octaves : doigtés 1-2-3, 1-2-3, puis 5 sur le dernier Do. Le poignet suit le mouvement sans crispation.", 'C4^1 E4^2 G4^3 C5^1 E5^2 G5^3 C6:2^5 | G5^3 E5^2 C5^1 G4^3 E4^2 C4:2^1', null, 60),
    L('9-3', 'Arpège de La mineur, main gauche', "Doigtés main gauche : 5-3-2-1. Fais rouler le poignet vers le haut, puis vers le bas.", null, 'A2^5 C3^3 E3^2 A3^1 E3^2 C3^3 A2:2^5', 60),
    L('9-4', 'Croisement des mains', "La main gauche passe PAR-DESSUS la main droite pour jouer les notes aiguës. Garde le coude souple et lève bien le bras, sans te contorsionner.", 'C4^1 R:1 D4^2 R:1 E4^3 R:1 F4^4 R:1', 'R:1 G4^2 R:1 A4^2 R:1 B4^2 R:1 C5:1^2', 60),
  ] },
  { title: 'Niveau 10 · Répertoire intermédiaire', lessons: [
    fromDemo('10-1', 'Frère Jacques en canon', "Un canon : la main gauche reprend la mélodie deux mesures plus tard, une octave plus bas. Les deux mains jouent la même tune décalée.", 'Frère Jacques en canon', { speed: 0.8 }),
    fromDemo('10-2', 'Douce nuit', "Une berceuse à 3 temps. Joue legato et laisse chanter la mélodie.", 'Douce nuit', { speed: 0.8 }),
    fromDemo('10-3', 'Korobeiniki (air de Tetris)', "Un air traditionnel russe en La mineur. Les doubles croches demandent des doigts bien articulés.", 'Korobeiniki (air de Tetris)', { speed: 0.8 }),
    L('10-4', 'Étude en arpèges', "La main gauche déroule des arpèges (basse d'Alberti élargie) pendant que la droite chante la mélodie. Garde la gauche légère et régulière.", 'G4:2^5 E4:2^3 | D4:2^2 B3:2^1 | C4:4^1', 'C3^5 E3^3 G3^1 E3^3 | G2^5 B2^3 D3^1 B2^3 | C3^5 E3^3 G3^1 E3^3', 70, { speed: 0.9 }),
  ] },
];
export const ALL = LEVELS.flatMap((lv, li) => lv.lessons.map(l => ({ ...l, level: li })));
