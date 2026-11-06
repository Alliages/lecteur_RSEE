# ROADMAP — lecteur_RSEE

Seule liste de suivi du projet. Cocher au fil des versions et reporter dans CHANGELOG.md.

## Principe
- Lecture seule d'un RSEE RE2020 (XML), sans recalcul réglementaire.
- Une seule page HTML + JS, hébergée sur GitHub Pages.
- Traitement 100 % local dans le navigateur : le fichier ne quitte pas le poste.
- Dépendances minimales (une bibliothèque de graphiques au plus, à valider).
- Aucun RSEE dans le dépôt (même anonymisé) : fichiers de test gardés en local.

## À décider
- [x] Palette de couleurs : charte HUB dans les graphiques (`js/reglages_graphiques.js`), Velvet Orchid pour le reste de l'interface
- [x] Bibliothèque de graphiques : Plotly.js « basic » 2.35.2, copié dans `js/` (sans CDN)
- [ ] Versions de RSEE à prendre en charge
- [ ] RSEE de test (anonymisés, hors dépôt) pour comparer aux valeurs de référence

## À vérifier
- [ ] Codes de fiches : Forfaitaire = types 5 et 6, plus les types 3 dont le nom contient « forfaitaire » (retirés des DED). Règle appliquée dans les graphiques, à confirmer
- [ ] Code des PEP extrapolées : non identifiable dans les RSEE de test (les codes 4, 8 et 9 n'y apparaissent pas ; `id_fiche_mere` seulement sur les fiches configurées). En attendant, elles comptent comme PEP
- [ ] Liste des indicateurs ACV `donnees/indicateurs_acv_RSEE.csv` : libellés déduits (références 1 à 24 et 101 à 136), à confirmer avec une source officielle ; contrôler les sommes 120 + 121 = 122 et 123 + 124 = 125, justes sur 4 bâtiments sur 8 seulement
- [ ] Combinaisons de versions : `2025_1` et `2025_2` (2022.D1 / 2022.E2.1.0 / 2022.C2) absentes de la page du ministère ; date de diffusion de RSEnv 2022.C1.0.0 (28/02/2021) à confirmer, coquille probable
- [ ] Code d'altitude du RSEE (0 = moins de 400 m, 1 = 400 à 800 m, 2 = plus de 800 m) : déduit, le code 2 n'apparaît pas dans les RSEE de test
- [ ] Lien vers l'outil Seuils : 10 bâtiments de test sur 16 retrouvent exactement les seuils du RSEE. Écarts à comprendre : `2022_4` (Sref de 681,6 m² au RSEnv, 1 435 m² au RSET), `rsee.xml` BAT C (Ic construction 687,6 contre 654,6), un RSEE de test (Bbio 59,7 contre 58,3), bâtiments à plusieurs zones (écart inférieur à 1 %)
- [ ] Calcul des seuils : un RSEE de test (RSET 2021.E1.0.0) s'écarte de 0,4 % de la formule, signalé à l'écran
- [ ] Phase du projet : le code 5 apparaît dans 7 RSEE de test sur 14 mais pas dans la liste des phases (1 à 4), il reste affiché « code 5 »
- [ ] Repères du label biosourcé (15, 25, 45 kg C/m²) : vérifier s'ils dépendent de l'usage
- [ ] Écart entre somme des phases et Ic composants dans 3 RSEE de test sur 14 (de 0,8 à 1,5 %) : origine trouvée, un sous-lot par fichier (9.1 ou 8.7) a un Ic sans aucune phase. Reste à décider si ces sous-lots s'ajoutent au total de leur lot

## À corriger
- [x] Onglets à vue large (Indicateurs, Composants, Graphiques) : à 1360 px, les cartes de l'arborescence débordent sur le détail et masquent le début des tableaux (présent depuis au moins la 0.8.12)

## 0.8.x — socle (outil non fonctionnel)
- [x] Structure : index.html, VERSION, README.md, CHANGELOG.md, ROADMAP.md
- [x] .gitignore excluant les RSEE (*.xml, *.zip)
- [x] Import du fichier XML (sélection + glisser-déposer) et lecture locale
- [x] Contrôle du format et message d'erreur clair si le fichier n'est pas un RSEE
- [x] Arborescence projet / bâtiment / zone (et parcelle), zones reliées à leur bâtiment par un trait, bâtiment et zones encadrés

## 0.9 — outil fonctionnel
### Informations
- [x] Projet : opération, n° PC, dates, avancement
- [x] Localisation : adresse, cadastre, zone climatique, altitude, zone sismique, sol
- [x] Acteurs : MOA, MOE, BET énergie et environnement, bureau de contrôle
- [x] Bâtiment / zone : usage, Sref, occupants, logements, niveaux, emprise, parkings
- [x] Coefficients de modulation et détail du calcul des seuils

### Indicateurs
- [x] Indicateurs réglementaires avec seuil et écart : Ic construction, Ic énergie, Bbio, Cep, Cep,nr, DH
- [x] Indicateurs pédagogiques : Ic composants, énergie, eau, chantier, bâtiment ; StockC ; UDD ; Ic ded
- [x] Synthèse visuelle conforme / non conforme, écarts et risques (marge < 10 %, < 5 %)
- [x] Calcul des seuils en tête de page et lien vers l'outil Seuils RE2020
- [x] Composition de l'Ic présentée comme une somme

### Composants
- [x] Tableau de tous les composants : nom, quantité, unité, contributeur, lot / sous-lot, fiche (type, id, nom), DVE
- [x] Tri par nom, fiche, quantité, position
- [x] Filtres : bâtiment / zone / parcelle, contributeur, lot, type de donnée
- [x] Unité : kg éq. CO₂/m²
- [x] Impacts par lot : somme des phases quand tous les lots valent 0 dans le RSEE

### Graphiques
Modèles : graphiques 2 à 8 du dashboard OPEE (Gx ci-dessous), transposés à un seul bâtiment.
Onglet « Graphiques du HUB » : une barre pour un bâtiment ou une zone, une barre par bâtiment pour le projet, pas de graphique pour la parcelle.
Ordre : contributeurs, lots, écarts aux seuils, sous-lots, types de fiches, nature des fiches, StockC.
Écartés à la demande : secteurs par contributeur, répartition par étape du cycle de vie.
- [x] Onglet Synthèse : graphique horizontal d'écart aux seuils en tête, avec logos (marge < 10 %, gros avertissement si marge < 5 %, non conforme au-dessus du seuil)
- [x] Sous-lots les plus impactants (top N réglable, bâtiment ou zone) : le RSEE ne donne pas d'impact par fiche
- [x] Répartition par contributeur : composants, chantier, énergie, eau, parts en % de composants + chantier + énergie, trait du seuil Ic construction, composants et chantier encadrés dans la légende ; champ de saisie si Ic énergie absent (G2)
- [x] Ic composant par lot (13 lots empilés, somme des phases) et part des macro-lots gros œuvre / second œuvre / lots techniques (G3)
- [x] Nombre de fiches par type : FDES, fiches configurées, PEP, DED, autres (G5)
- [x] Nature des fiches par lot en % (FDES, FDES configurée, fiche configurée, PEP, DED, forfaitaire, autres) et part FDES / PEP face à DED + forfaitaire par macro-lot (G6)
- [x] Écart aux 6 seuils réglementaires en % : Bbio, Cep, Cep,nr, DH, Ic construction, Ic énergie (G7, lien avec la synthèse conforme / non conforme)
- [x] StockC face aux niveaux du label bâtiment biosourcé (15, 25, 45 kg C/m²) (G8)
- [x] Logo du HUB en haut à droite de chaque graphique, titres et « Voir les données » en noir, tableau de données en jaune HUB

## Plus tard (idées)
- [ ] Histogramme multi-indicateurs : en attente de la validation de `donnees/indicateurs_acv_RSEE.csv`
- [ ] Impact Ic par composant et tri par impact : recalcul de la pondération dynamique à partir des valeurs par module (point délicat ; Vizcab ne le fait pas pour énergie, chantier, eau ni fiches configurées)
- [ ] Fiches les plus impactantes et distinction individuelle / collective : base INIES embarquée
- [ ] Vérification de cohérence du RSEE (règles de base DHUP)
- [ ] Contrôle des combinaisons de versions Datas_Comp / RSET / RSEnv selon la date de dépôt du PC (tableaux de la page du ministère)
- [ ] Export CSV du tableau des composants
- [ ] Impression / PDF via feuille de style d'impression
- [ ] Comparaison de deux RSEE (variantes) ; avec plusieurs RSEE, graphiques statistiques du dashboard OPEE (G4 médiane par matériau de structure, quartiles de G5)


## Références
- Vizcab — Lecture seule de RSEE RE2020 : https://vizcab.zendesk.com/hc/fr/articles/7437720347281--RE2020-Lecture-seule-de-RSEE-RE2020
  (arborescence projet/bâtiment/zone/parcelle ; onglets Informations, Indicateurs, Composants, Fiches impactantes)
- Izuba Pleiades — Energie-carbone / Résultats : https://docs.izuba.fr/v4/fr/index.php/Energie-carbone_/_R%C3%A9sultats?toc-id=505
  (tableau par contributeur, détail par étape / lot / usage, histogramme et secteurs, indicateurs de performance)
- Dashboard OPEE — graphiques 2 à 8 du notebook marimo `OPEE_by_GM.py` v0.99j (dépôt Alliages/opee-python, Plotly)
  (palette charte HUB, formes et calculs de chaque graphique)
