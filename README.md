# lecteur_RSEE

Lecture seule d'un RSEE RE2020 (fichier XML) dans le navigateur.

- Aucun recalcul réglementaire : l'outil affiche les valeurs contenues dans le RSEE.
- Traitement 100 % local : le fichier ne quitte pas le poste, rien n'est envoyé.
- Une page HTML et quelques scripts, hébergée sur GitHub Pages ; seule dépendance : Plotly.js (licence MIT), copié dans `js/`.

Outil en ligne : https://alliages.github.io/lecteur_RSEE/

État : version 0.9.x, outil fonctionnel (onglets Synthèse, Informations, Indicateurs, Composants, Graphiques) (voir [ROADMAP.md](ROADMAP.md)).

## Utilisation

Ouvrir la page, puis cliquer sur « Ouvrir un RSEE » ou glisser le fichier `.xml` sur la page.
La page fonctionne aussi ouverte en local (double-clic sur `index.html`).

## Structure

```
index.html                 page unique
css/style.css              style (palette et réglages graphiques en tête)
js/reglages.js             réglages et messages
js/nomenclatures.js        lots et sous-lots RE2020 (issu du CSV ci-dessous)
js/indicateurs.js          définitions des indicateurs, verdicts (valeur ≤ seuil)
js/codes.js                libellés des codes du RSEE (issu du CSV)
js/composants.js           regroupement, filtres et tri des composants
js/plotly-basic.min.js     bibliothèque de graphiques (Plotly.js basic 2.35.2)
js/reglages_graphiques.js  charte HUB et paramètres des graphiques
js/graphiques.js           calculs des graphiques, sans interface
js/graphiques_traces.js    tracé des graphiques
js/reglages_seuils.js      réglages du lien vers l'outil Seuils RE2020
js/seuils.js               calcul des seuils et lien vers l'outil, sans interface
js/lecture.js              lecture et contrôle du RSEE, sans interface
js/interface.js            import, arborescence, détail
images/                    logo et icône d'onglet (SVG)
donnees/                   nomenclature des lots et sous-lots, codes du RSEE, indicateurs ACV (CSV)
tests/                     référence Python et tests dans le navigateur
```

## Tests

Les RSEE de test ne sont jamais versionnés : les placer dans `tests/rsee/` (ignoré par git).
Les captures produites dans `tests/captures/` sont aussi ignorées.

Préparation (une fois), dans PowerShell à la racine du dépôt :

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install playwright
python -m playwright install chromium
```

Lancement :

```powershell
.\.venv\Scripts\Activate.ps1
python tests\test_lecture.py
```

Le test compare, pour chaque RSEE, le modèle lu par `js/lecture.js` dans le navigateur
aux valeurs extraites indépendamment par `tests/reference.py`, vérifie l'affichage,
les messages d'erreur et la cohérence `VERSION` / `js/reglages.js` / nomenclature CSV.

## Licence

GPL-3.0 — voir [LICENSE](LICENSE).
