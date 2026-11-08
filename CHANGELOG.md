# CHANGELOG — lecteur_RSEE

## 0.9.7 — 2026-11-08

- Altitude lue dans le RSET (`Entree_Projet/Simu/Altitude`), source retenue par l'observatoire
  OPEE ; celle des données administratives (Datas_Comp) n'est qu'un repli. Sur 19 RSEE, les deux
  concordent sauf pour les deux RSEE de Sète (« Plus de 800 m » dans Datas_Comp) : une note
  signale alors l'écart. Le lien vers l'outil Seuils reçoit aussi l'altitude du RSET.
- Zone sismique : note « souvent laissée à sa valeur par défaut (1, très faible) par les
  logiciels, à vérifier » (Très faible relevé à Nice, en Haute-Savoie, dans le Puy-de-Dôme…).
- Tests : altitude et notes de localisation ; un RSEE de Sète ajouté aux RSEE de test.
- README : parties utilisateurs et détails techniques séparées, captures (RSEE anonymisé), schéma des
  indicateurs, organigramme des fichiers.

## 0.9.6 — 2026-11-07

- Dates au format long (« 9 novembre 2023 », « 1er janvier 2022 »), dans les Informations et
  la Synthèse.
- Localisation : département avec son nom (`donnees/zones_departements.txt`, repris du dépôt
  zones-climatiques-re2020), altitude en classe (le champ est un code, il était affiché en
  mètres), libellés de la zone sismique, de la nature géotechnique du sol et de la pollution du
  sol. Stade d'avancement : codes 1 et 2 libellés. Libellés marqués « à valider ».
- Zones de logement : traversante ou non (RSET), sur la fiche, la tuile, l'arborescence et le
  tableau des zones.
- Exigences à risque : contour épais de la couleur du niveau, cerné de noir ; marge
  confortable : contour fin.
- Composants : identifiants INIES en lien vers base-inies.fr (fiche, et fiche mère des fiches
  configurées).

## 0.9.4 — 2026-11-07

- Logements : nombre total par bâtiment (somme des zones d'usage 1 ou 2) dans la Synthèse et
  les Informations. Il remplace les occupants pour le logement ; les occupants restent pour les
  autres usages, et le champ logements n'est plus affiché sur une zone tertiaire, où il n'a pas de sens.
- Informations du bâtiment : type de construction (`type_travaux`, code 1 « Construction
  neuve »), nombres de niveaux en sous-sol et en surface, nombre d'ascenseurs (RSET).
- Indicateurs : section « Heures d'inconfort », par groupe (t° opérative au-dessus de la
  t° d'inconfort, +1°, +2°).
- Couleur par famille d'indicateurs (bioclimatique, énergie, carbone, confort d'été) : cartes
  d'exigence, écarts, risques, calcul des seuils, Composition de l'Ic, avec légende. Les
  niveaux de risque gardent leurs couleurs ; les graphiques du HUB ne changent pas.
- Tests : logements, occupants, ascenseurs, heures d'inconfort et familles.

## 0.9.3 — 2026-11-06

Corrections de l'audit du dépôt.

- Sécurité : politique CSP dans `index.html` (aucune connexion possible, scripts et images
  locaux). `.gitignore` : dossier `RSEE/` et `*.pdf`.
- Impact d'un lot ou d'un sous-lot : une seule règle (`CalculsGraphiques.impactLot`), `<ic>`
  puis somme des phases s'il vaut 0, pour le tableau, les graphiques et le lien Seuils. Les
  sous-lots 9.1 et 8.7 de 3 RSEE de test, qui ont un Ic sans phases, ne sont plus à 0.
- Arborescence : un nom long passe à la ligne au lieu de recouvrir le détail.
- Lien OpenStreetMap : note à l'écran et `noreferrer` ; README précisé sur les deux liens externes.
- Code : `js/format.js` pour les nombres, utilitaire de tableau, table unique des coefficients
  dans `js/reglages_seuils.js`, unités et constantes regroupées dans les fichiers de réglages,
  dimensions et couleurs des graphiques dans `js/reglages_graphiques.js`.
- `js/interface.js` découpé : `js/interface_commun.js` et un fichier `js/onglet_*.js` par onglet.
- Plotly chargé à la première ouverture de l'onglet Graphiques, logo du HUB réduit à sa taille
  d'affichage.
- Graphiques libérés quand l'ouverture d'un fichier échoue ; `doc` inutilisé retiré de la lecture.
- Tests : `tests/requirements.txt`, attente sans `eval` (compatible CSP), connexion bloquée,
  arborescence dans sa colonne, règle d'impact, ouverture de fichier sans course.
- Schéma des indicateurs déplacé dans `docs/`.
- Informations : libellé de la phase du projet (Programmation, Conception, Réalisation, Exploitation).

## 0.9.1 — 2026-11-06

- En-tête : un clic sur le logo ou sur « lecteur.RSEE » ne fait plus rien (il rechargeait la
  page et fermait le RSEE ouvert).
- Graphiques du HUB : logo agrandi (86 px de haut) et placé devant le graphique.
- Test : aucun lien dans l'en-tête.

## 0.9.0 — 2026-11-06

- Composants : quand tous les lots valent 0 dans le RSEE (6 RSEE de test sur 14), l'Ic par lot
  et sous-lot est la somme des phases du cycle de vie, comme dans les graphiques, avec une
  note qui le signale. Ic DED affiché ; UDD et StockC restent non renseignés car ils valent
  aussi 0. Sans phases, l'impact par lot reste « non renseigné ».
- Graphiques du HUB : logo du HUB en haut à droite de chaque graphique (`images/HUB-BC_logo.png`).
- Graphiques du HUB : titres et « Voir les données » en noir, en-tête du tableau de données
  en jaune `#FFC000`.
- Pied de page : lien vers le HUB Bas Carbone.
- ROADMAP : fonctions livrées cochées ; impact par composant, filtre individuelle / collective
  et histogramme multi-indicateurs reportés ; une seule unité, kg éq. CO₂/m².
- Tests : Ic des lots à 0 comparé à la référence Python, tri, cas sans phases, logo sur chaque
  graphique, couleurs du HUB, lien du pied de page.

## 0.8.12 — 2026-11-05

- Arborescence : un trait relie chaque bâtiment à ses zones et un cadre regroupe le bâtiment
  et ses zones. Retrait, couleur du trait et fond du cadre en tête de `css/style.css`.
- Tests : cadre par bâtiment, zones dans le cadre de leur bâtiment, trait arrêté à la
  dernière zone.

## 0.8.11 — 2026-11-05

- Indicateurs : calcul des 6 seuils affiché en tête de page (moyen, coefficients de modulation
  du RSEE, seuil), pour le projet, les bâtiments et les zones.
- Indicateurs : lien vers l'outil Seuils RE2020, prérempli avec les données techniques du
  RSEE, sans nom ni adresse.
- Indicateurs, projet : tableau des écarts en % coloré par niveau de risque.
- Indicateurs : bloc Risques classé du plus au moins risqué, avertissement dans le bandeau,
  cartes et jauges colorées selon la marge.
- Indicateurs : composition de l'Ic présentée comme une somme (construction + bâtiment +
  projet, autres indicateurs à part), à la place de la grille d'indicateurs.
- Synthèse : orange pour une marge inférieure à 5 %.
- Onglet « Graphiques du HUB » en jaune quand il est sélectionné.

## 0.8.9 — 2026-11-05

- Contributeurs : légende HTML où un cadre regroupe composants, chantier et le trait du
  seuil, pour préciser que l'Ic construction porte sur ces deux postes seulement.
- Onglets : survol aux couleurs de l'application (corail, bleu acier, raisin, orchidée) ;
  le jaune `#FFC000` reste réservé à « Graphiques du HUB ».

## 0.8.8 — 2026-11-05

Synthèse et réorganisation des graphiques.

- Synthèse : graphique horizontal d'écart aux 6 seuils en tête, pour le projet (par
  bâtiment), le bâtiment et la zone. Logos aux couleurs de l'application : avertissement si
  la marge sous le seuil est inférieure à 10 %, gros avertissement sous 5 %, non conforme
  au-dessus du seuil. Seuils de marge dans `js/reglages_graphiques.js`.
- Onglet renommé « Graphiques du HUB », survol `#FFC000`.
- Contributeurs : trait du seuil Ic construction, lu dans le RSEE.
- Écarts aux seuils en 3e position.
- Retirés : secteurs par contributeur, répartition par étape du cycle de vie, et la lecture
  des phases par contributeur qui ne servait qu'à eux.
- Tests : niveaux d'avertissement (limites 10 % et 5 %), Synthèse par vue, ordre des
  graphiques, seuil Ic construction, nom et survol de l'onglet.

## 0.8.6 — 2026-11-05

Onglet Graphiques (prévu en 0.9, avancé à la demande).

- 9 graphiques repris du dashboard OPEE et transposés à un bâtiment : contributeurs,
  secteurs, lots et macro-lots, sous-lots les plus impactants (top N réglable), étapes du
  cycle de vie, types de fiches, nature des fiches par lot avec cartes de macro-lots,
  écarts aux 6 seuils, StockC face au label biosourcé.
- Vues : une barre pour un bâtiment ou une zone, une barre par bâtiment pour le projet
  (7 graphiques, un point par bâtiment pour les écarts), rien pour la parcelle.
- Lecture des phases du cycle de vie par contributeur, lot et sous-lot. Impact d'un lot =
  somme de ses phases, car `<ic>` vaut 0 dans une partie des RSEE ; Bexp n'est pas compté.
- Ic énergie absent du RSEE : champ de saisie, valeur signalée et non enregistrée.
- Chaque graphique a son tableau de données repliable ; légendes sous le tracé sur téléphone.
- Plotly.js « basic » 2.35.2 copié dans `js/` (seule dépendance, sans CDN) ; charte HUB
  dans `js/reglages_graphiques.js`.
- Liste des indicateurs ACV `donnees/indicateurs_acv_RSEE.csv` : libellés déduits, à valider.
- Tests : référence Python des graphiques (contributeurs, lots, macro-lots, étapes, natures,
  StockC), cohérence écart / verdict, top N, saisie de l'Ic énergie, captures.

## 0.8.4 — 2026-11-05

Onglets Informations et Composants.

- Onglet Informations :
  - projet : opération (PC, dates, avancement), localisation (adresse, cadastre, zone
    climatique, département, zone sismique, altitude, sol), acteurs (MOA, MOE, BET),
    logiciels et versions des blocs ;
  - bâtiment : usage, type de travaux, Sref, SHAB, SU, occupants, niveaux, parkings,
    emprise, période de référence, durée du chantier, GPS, tableau des zones ;
  - zone : usage, surfaces, occupants, logements, coefficients de modulation des seuils
    Ic (Mi, Mc, max moyen) et seuil lu dans le RSEE ;
  - parcelle : surfaces.
- Onglet Composants :
  - impacts par lot et sous-lot (Ic, part de l'Ic composants, Ic DED, UDD, StockC),
    triés par impact, avec somme de contrôle ; « non renseigné » si tous les lots valent 0 ;
  - tableau des composants et services : position, fiche (nom, identifiants, commentaire,
    paramètres du configurateur), type de donnée, quantité, unité, DVE ;
  - recherche, filtres (contributeur, lot, type de donnée), tri par colonne ;
  - vue bâtiment : lignes des zones regroupées (même fiche répartie au prorata de la Sref),
    quantités additionnées ; vue projet : tous les bâtiments et la parcelle.
- Table des codes `donnees/codes_RSEE.csv` (+ `js/codes.js`) : libellés **déduits** des
  noms de fiches, à valider ; le code est toujours affiché à côté du libellé.
- Lecture : blancs internes des textes réduits à une espace (noms sur plusieurs lignes).
- Vue large pour l'onglet Composants ; une colonne sur téléphone.
- Tests : référence indépendante des lignes (remontée des ancêtres), regroupement
  (quantités conservées, jamais deux lignes d'une même zone), impacts par lot,
  informations, filtres, tri, table des codes ; captures des 4 onglets.

## 0.8.2 — 2026-11-04

Onglet Indicateurs (prévu en 0.9, avancé à la demande).

- Onglets fonctionnels : « Synthèse » (ex-« Arborescence ») et « Indicateurs ».
- Lecture des indicateurs : RSEnv (`indicateur_perf_env` du bâtiment et de la zone),
  RSET (Bbio, Cep, Cep,nr par bâtiment et zone ; DH par groupe ; groupes en inconfort).
  Rattachement par index (les bâtiments de sortie ne sont pas toujours dans l'ordre).
- Exigences réglementaires avec seuil, écart et verdict : Ic construction, Ic énergie,
  Bbio, Cep, Cep,nr, DH (par groupe). Aucun recalcul : valeur et seuil lus dans le RSEE.
- Seuils Ic à venir (2025, 2028, 2031) affichés quand le RSEE les fournit.
- Indicateurs pédagogiques : Ic composants, énergie, eau, chantier, bâtiment (ou zone),
  parcelle, projet, Ic DED, UDD, StockC ; valeurs par occupant quand elles existent.
- Vue projet : bandeau de verdict et tableau des exigences par bâtiment ; vue zone :
  valeurs pour information ; vue parcelle : Ic et StockC parcelle par bâtiment.
- Verdicts lisibles sans la couleur (symbole et texte), jauges valeur / seuil.
- Velvet Orchid plus présent : onglet actif, titres, bandeaux, tableau, sélection.
- Définitions des indicateurs regroupées dans `js/indicateurs.js`.
- Tests : référence Python des indicateurs et des verdicts, contrôle de l'onglet
  Indicateurs, captures par RSEE.

## 0.8.1 — 2026-11-04

- Logo « atome de carbone » : fichier XML autocollant, hexagone aux sommets dorés autour
  d'un bâtiment (Velvet Orchid et Bright Gold) ; texte « RSEE » en tracés (Inter Black, OFL).
- Icône d'onglet (`images/favicon.svg`) : version courte du logo, sans bandeau.
- Le logo remplace le croissant provisoire de l'en-tête.
- Test : chargement du logo et de l'icône d'onglet.

## 0.8.0 — 2026-11-04

Socle de l'outil (non fonctionnel pour l'analyse : arborescence seulement).

- Page unique `index.html`, style rétro (palette du projet, contours épais, ombres pleines).
- Import du RSEE par sélection ou glisser-déposer, lecture locale dans le navigateur.
- Décodage selon l'encodage déclaré dans le prologue XML.
- Contrôle du format avec messages clairs : fichier non XML, XML non RSEE, RSET sans
  partie environnementale, archive zip, mauvaise extension.
- Arborescence projet / bâtiments / zones / parcelle ; détail du nœud sélectionné
  (Sref, occupants, logements, nombre de composants et de services, versions, logiciel).
- Noms des zones repris du RSET, reliés par index.
- Contrôle de cohérence : zones absentes du RSET, lots et sous-lots hors nomenclature.
- Nomenclature des lots et sous-lots RE2020 (`donnees/` et `js/nomenclatures.js`).
- Tests : référence Python indépendante comparée à la lecture JS dans le navigateur
  (6 RSEE, 4 logiciels, RSEnv 2022.C1 à 2024.C1), captures bureau et téléphone.
- RSEE et captures exclus du dépôt (`.gitignore`).
