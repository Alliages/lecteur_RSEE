"""
lecteur_RSEE — tests

Ouvre index.html dans un navigateur sans fenêtre (Playwright) et vérifie :
  1. la version de js/reglages.js = fichier VERSION ;
  2. js/nomenclatures.js et js/codes.js = leurs CSV dans donnees/ ;
  3. pour chaque RSEE du dossier : le modèle JS = la référence Python
     (indicateurs, verdicts, informations, lignes de composants et services,
     regroupement par bâtiment, impacts par lot, filtres et tri),
     puis l'affichage des 5 onglets avec captures ;
  4. les messages d'erreur (fichier non XML, XML non RSEE, RSET seul, zip,
     mauvaise extension).

Les RSEE de test ne sont jamais versionnés (voir .gitignore).
Usage : python tests/test_lecture.py [dossier_rsee]   (défaut : tests/rsee)
"""

import base64
import csv
import io
import re
import sys
import tempfile
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from urllib.parse import unquote

from playwright.sync_api import sync_playwright

from reference import graphiques_reference, reference

# --- Réglages des tests ---
RACINE = Path(__file__).resolve().parent.parent
DOSSIER_RSEE = Path(sys.argv[1]) if len(sys.argv) > 1 else RACINE / "tests" / "rsee"
DOSSIER_CAPTURES = RACINE / "tests" / "captures"
FICHIER_CSV = RACINE / "donnees" / "nomenclature_lots_sous_lots_RE2020.csv"
FICHIER_CODES = RACINE / "donnees" / "codes_RSEE.csv"
TOLERANCE = 1e-9
LARGEUR_ECRAN = 1360

erreurs = []
nb_controles = 0
nb_lots_nuls = 0  # bâtiments de test dont tous les lots valent 0


def verifier(condition, message):
    """Enregistre un échec sans interrompre la suite des tests."""
    global nb_controles
    nb_controles += 1
    if not condition:
        erreurs.append(message)
        print("  ÉCHEC :", message)


def egal(a, b):
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return abs(a - b) <= TOLERANCE * max(1, abs(b))
    return a == b


def comparer(js, ref, chemin=""):
    """Compare récursivement les clés de la référence au modèle JS."""
    if isinstance(ref, dict):
        for cle, valeur in ref.items():
            verifier(isinstance(js, dict) and cle in js, f"{chemin}.{cle} absent du modèle JS")
            if isinstance(js, dict) and cle in js:
                comparer(js[cle], valeur, f"{chemin}.{cle}")
    elif isinstance(ref, list) and ref and isinstance(ref[0], dict):
        verifier(len(js) == len(ref), f"{chemin} : {len(js)} éléments au lieu de {len(ref)}")
        for i, (a, b) in enumerate(zip(js, ref)):
            comparer(a, b, f"{chemin}[{i}]")
    else:
        verifier(egal(js, ref), f"{chemin} : JS={js!r} référence={ref!r}")


def attendre(page, expression, delai_ms=20000):
    """Attend qu'une expression soit vraie. page.wait_for_function passe par eval, que la CSP de la page interdit."""
    for _ in range(delai_ms // 50):
        if page.evaluate(expression):
            return
        page.wait_for_timeout(50)
    raise TimeoutError(expression)


def ouvrir_rsee(page, fichier):
    """Ouvre un fichier et attend la nouvelle arborescence (l'ancienne reste affichée pendant la lecture)."""
    page.evaluate("document.querySelector('.noeud').dataset.ancien = '1'")
    page.set_input_files("#selecteur", str(fichier))
    attendre(page, "document.querySelector('.noeud') && !document.querySelector('.noeud[data-ancien]')")


def lire_ic_lots(page):
    """Lots affichés dans l'onglet Composants : [référence, Ic, Ic DED, UDD, StockC] en texte."""
    return page.evaluate("""() => [...document.querySelectorAll('.tableau-lots tr.ligne-lot')].map(tr => {
        const c = tr.querySelectorAll('td');
        return [tr.querySelector('.ref').textContent, c[0].textContent, c[2].textContent, c[3].textContent, c[4].textContent];
    })""")


def lire_nombre(texte_affiche):
    """Nombre affiché à la française (espaces fines, virgule)."""
    return float(re.sub(r"\s", "", texte_affiche).replace(",", "."))


def lire_nomenclature_csv():
    with open(FICHIER_CSV, encoding="utf-8-sig", newline="") as f:
        lignes = list(csv.DictReader(f, delimiter=";"))
    return {
        "lots": {l["lot_ref"]: l["lot_nom"] for l in lignes},
        "sous_lots": {l["sous_lot_id"]: l["sous_lot_nom"] for l in lignes},
    }


def lancer_navigateur(p):
    try:
        return p.chromium.launch()
    except Exception:
        return p.chromium.launch(channel="chrome")  # Chrome installé sur le poste


def main():
    global nb_lots_nuls
    rsee = sorted(DOSSIER_RSEE.glob("*.xml"))
    if not rsee:
        print(f"Aucun RSEE dans {DOSSIER_RSEE}")
        sys.exit(1)
    DOSSIER_CAPTURES.mkdir(parents=True, exist_ok=True)
    nomenclature = lire_nomenclature_csv()

    with sync_playwright() as p:
        navigateur = lancer_navigateur(p)
        page = navigateur.new_page(viewport={"width": LARGEUR_ECRAN, "height": 900})
        messages_console = []
        page.on("pageerror", lambda e: messages_console.append(str(e)))
        page.on("console", lambda m: "Content Security Policy" in m.text and messages_console.append(m.text))
        page.goto((RACINE / "index.html").as_uri())

        verifier(page.evaluate("typeof Plotly") == "undefined", "Plotly chargé avant l'ouverture des graphiques")

        print("1. Version")
        version_js = page.evaluate("REGLAGES.version")
        version_fichier = (RACINE / "VERSION").read_text(encoding="utf-8").strip()
        verifier(version_js == version_fichier, f"version JS {version_js} ≠ VERSION {version_fichier}")

        verifier(page.inner_text("[data-onglet=graphiques]") == "Graphiques du HUB", "nom de l'onglet Graphiques du HUB")
        page.hover("[data-onglet=graphiques]")
        fond = page.evaluate("getComputedStyle(document.querySelector('[data-onglet=graphiques]')).backgroundColor")
        verifier(fond == "rgb(255, 192, 0)", f"couleur de survol de l'onglet : {fond}")
        # Onglet HUB actif : jaune aussi, hors survol ; marge < 5 % : logo orange
        page.click("[data-onglet=graphiques]")
        page.mouse.move(2, 2)
        page.wait_for_timeout(250)
        fond = page.evaluate("getComputedStyle(document.querySelector('[data-onglet=graphiques]')).backgroundColor")
        verifier(fond == "rgb(255, 192, 0)", f"onglet HUB sélectionné : {fond}")
        page.click("[data-onglet=synthese]")
        page.wait_for_timeout(250)
        fond = page.evaluate("(() => { const l = document.createElement('span'); l.className = 'logo-marge logo-forte'; document.body.append(l); const c = getComputedStyle(l).backgroundColor; l.remove(); return c; })()")
        verifier(fond == "rgb(255, 140, 26)", f"logo de marge < 5 % : {fond}")
        # Survol des autres onglets : couleurs de l'application (la Synthèse est active au chargement)
        for onglet, attendu_s in (("informations", "rgb(132, 169, 192)"), ("indicateurs", "rgb(106, 102, 163)"), ("composants", "rgb(84, 46, 113)")):
            page.hover(f"[data-onglet={onglet}]")
            fond = page.evaluate("o => getComputedStyle(document.querySelector(`[data-onglet=${o}]`)).backgroundColor", onglet)
            verifier(fond == attendu_s, f"survol de l'onglet {onglet} : {fond}")

        print("1 bis. Logo et icône d'onglet")
        attendre(page, "document.querySelector('.logo-marque').complete")
        verifier(page.evaluate("document.querySelector('.logo-marque').naturalWidth") > 0, "logo non chargé")
        icone = page.get_attribute("link[rel=icon]", "href")
        verifier(icone is not None and (RACINE / icone).is_file(), "icône d'onglet introuvable")
        for svg in ("images/logo.svg", "images/favicon.svg"):
            try:
                ET.parse(RACINE / svg)
            except ET.ParseError as e:
                verifier(False, f"{svg} invalide : {e}")

        print("2. Nomenclature")
        nom_js = page.evaluate("""() => {
            const lots = {}, sous = {};
            for (const [r, l] of Object.entries(NOMENCLATURE_LOTS)) {
                lots[r] = l.nom; Object.assign(sous, l.sous_lots);
            }
            return { lots, sous_lots: sous };
        }""")
        verifier(nom_js == nomenclature, "js/nomenclatures.js diffère du CSV")

        print("2 bis. Table des codes")
        with open(FICHIER_CODES, encoding="utf-8-sig", newline="") as f:
            codes_csv = {}
            for l in csv.DictReader(f, delimiter=";"):
                codes_csv.setdefault(l["champ"], {})[l["code"]] = {"libelle": l["libelle"], "statut": l["statut"]}
        verifier(page.evaluate("CODES_RSEE") == codes_csv, "js/codes.js diffère de donnees/codes_RSEE.csv")
        with open(RACINE / "donnees" / "zones_departements.txt", encoding="utf-8") as f:
            departements = {l.split("|")[1]: l.split("|")[2] for l in f.read().strip().splitlines()[1:]}
        verifier(page.evaluate("DEPARTEMENTS") == departements, "js/departements.js diffère de donnees/zones_departements.txt")
        for iso, attendu_d in (("2022-01-01", "1er janvier 2022"), ("2023-11-09", "9 novembre 2023"), ("2024-08-31", "31 août 2024")):
            lu_d = page.evaluate("d => Format.date(d)", iso)
            verifier(lu_d == attendu_d, f"date {iso} : {lu_d}")

        print("3. RSEE")
        for chemin in rsee:
            print(" -", chemin.name)
            attendu = reference(chemin, nomenclature)
            octets = base64.b64encode(chemin.read_bytes()).decode("ascii")
            modele = page.evaluate("""([b64, nom]) => {
                const bin = atob(b64), o = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i);
                const r = LectureRSEE.analyser(LectureRSEE.decoder(o.buffer), nom);
                return r.erreur ? { erreur: r.erreur } : r.modele;
            }""", [octets, chemin.name])
            verifier("erreur" not in modele, f"{chemin.name} refusé : {modele.get('erreur')}")
            if "erreur" in modele:
                continue
            refs = attendu.pop("refs_inconnues")
            statuts_attendus = attendu.pop("statuts")
            lignes_attendues = attendu.pop("lignes")
            lignes_parcelles = attendu.pop("lignes_parcelles")
            comparer(modele, attendu, chemin.name)
            alerte_refs = [a for a in modele["alertes"] if "hors nomenclature" in a]
            verifier(bool(refs) == bool(alerte_refs), f"{chemin.name} : alerte nomenclature incohérente")

            # Verdicts des 6 exigences par bâtiment : JS (js/indicateurs.js) = référence Python
            for b in modele["batiments"]:
                statuts_js = page.evaluate(
                    "ind => EvaluationIndicateurs.evaluerTout(ind).map(e => e.statut)", b["indicateurs"])
                verifier(statuts_js == statuts_attendus[b["index"]],
                         f"{chemin.name} bâtiment {b['index']} : statuts JS={statuts_js} référence={statuts_attendus[b['index']]}")

            # Lignes de composants et services : JS (parcours descendant) = référence (ancêtres)
            def cle_ligne(l):
                q = l["quantite"]
                return (l["contributeur"] or "", l["lot"] or "", l["sous_lot"] or "", l["sous_contributeur"] or "",
                        l["id_fiche"] or "", l["type_donnees"] or "", l["unite_uf"] or "",
                        round(q, 9) if q is not None else None)
            tri = lambda t: tuple("" if x is None else str(x) for x in t)
            for b in modele["batiments"]:
                for z in b["zones"]:
                    js = sorted((cle_ligne(l) for l in z["lignes"]), key=tri)
                    verifier(js == lignes_attendues[z["index"]], f"{chemin.name} zone {z['index']} : lignes JS ≠ référence")
                    verifier(sum(1 for l in z["lignes"] if l["contributeur"] == "composant") == z["nb_composants"],
                             f"{chemin.name} zone {z['index']} : composants lus ≠ nombre de <donnees_composant>")
            for i, pa in enumerate(modele["parcelles"]):
                js = sorted((cle_ligne(l) for l in pa["lignes"]), key=tri)
                verifier(js == lignes_parcelles[i], f"{chemin.name} parcelle {i + 1} : lignes JS ≠ référence")

            # Regroupement par bâtiment : quantités totales conservées, jamais deux lignes d'une même zone
            for b in modele["batiments"]:
                bilan = page.evaluate("""lignes => {
                    const g = Composants.regrouper(lignes);
                    return {
                        n: g.length,
                        meme_zone: g.filter(x => x.nb_lignes !== x.zones.size).length,
                        total: g.reduce((s, x) => s + (x.quantite || 0), 0),
                    };
                }""", [l for z in b["zones"] for l in z["lignes"]])
                total_ref = sum(t[7] or 0 for z in b["zones"] for t in lignes_attendues[z["index"]])
                verifier(abs(bilan["total"] - total_ref) <= 1e-6 * max(1, total_ref),
                         f"{chemin.name} bâtiment {b['index']} : quantités regroupées {bilan['total']} ≠ {total_ref}")
                verifier(bilan["meme_zone"] == 0, f"{chemin.name} bâtiment {b['index']} : lignes d'une même zone fusionnées")
                max_zone = max(len(z["lignes"]) for z in b["zones"])
                verifier(max_zone <= bilan["n"] <= sum(len(z["lignes"]) for z in b["zones"]),
                         f"{chemin.name} bâtiment {b['index']} : nombre de lignes regroupées incohérent")
                b["_nb_regroupees"] = bilan["n"]

            # Filtres et tri : contrôles simples sur les lignes de la première zone
            z0 = modele["batiments"][0]["zones"][0]["lignes"]
            n_energie = page.evaluate("l => Composants.filtrer(l, {contributeur: 'energie'}).length", z0)
            verifier(n_energie == sum(1 for l in z0 if l["contributeur"] == "energie"), f"{chemin.name} : filtre contributeur")
            premiere = page.evaluate("l => Composants.trier(l, 'quantite', -1)[0].quantite", z0)
            verifier(premiere == max(l["quantite"] for l in z0 if l["quantite"] is not None), f"{chemin.name} : tri par quantité")

            # Affichage : import par le sélecteur de fichier, comme un utilisateur
            page.set_input_files("#selecteur", str(chemin))
            nb_attendu = 1 + len(attendu["batiments"]) + sum(len(b["zones"]) for b in attendu["batiments"]) + len(attendu["parcelles"])
            attendre(page, f"document.querySelectorAll('.noeud').length === {nb_attendu}")
            verifier(page.is_hidden("#message"), f"{chemin.name} : message d'erreur affiché")
            page.screenshot(path=str(DOSSIER_CAPTURES / (chemin.stem + ".png")), full_page=True)

            # Arborescence : un cadre par bâtiment, ses zones dedans, trait arrêté à la dernière zone
            zones_par_cadre = page.evaluate("""() => [...document.querySelectorAll('#arbre > .groupe-batiment')]
                .map((g) => g.querySelectorAll('.noeud[data-type=zone]').length)""")
            verifier(zones_par_cadre == [len(b["zones"]) for b in attendu["batiments"]], f"{chemin.name} : zones par cadre de bâtiment")
            traits = page.evaluate("""() => [...document.querySelectorAll('#arbre ul > li')].map((li) => [
                getComputedStyle(li, '::before').content !== 'none',
                getComputedStyle(li, '::after').content !== 'none',
                li.nextElementSibling !== null])""")
            verifier(all(avant and apres == suivante for avant, apres, suivante in traits), f"{chemin.name} : traits de l'arborescence")

            # Onglet Indicateurs : tableau du projet puis détail de chaque bâtiment
            page.click("[data-onglet=indicateurs]")
            nb_bat = len(attendu["batiments"])
            verifier(page.locator(".synthese tbody tr").count() == nb_bat, f"{chemin.name} : lignes du tableau de synthèse")
            # Écarts du projet : une cellule par exigence, niveaux de la Synthèse, risques classés
            niveaux_projet = page.evaluate("""bs => bs.flatMap(b => CalculsGraphiques.ecartsSeuils(b.indicateurs).map(CalculsGraphiques.niveauMarge))""", modele["batiments"])
            verifier(page.eval_on_selector_all(".cellule-ecart", "l => l.map(x => x.dataset.niveau)") == niveaux_projet,
                     f"{chemin.name} : niveaux du tableau des écarts")
            a_risque = [n for n in niveaux_projet if n in ("alerte", "forte", "depasse")]
            verifier(page.locator(".risque").count() == len(a_risque), f"{chemin.name} : nombre de risques")
            rangs = {"depasse": 0, "forte": 1, "alerte": 2}
            lus = [rangs[n] for n in page.eval_on_selector_all(".risque", "l => l.map(x => x.dataset.niveau)")]
            verifier(lus == sorted(lus), f"{chemin.name} : risques non classés {lus}")
            depasse_projet = "depasse" in niveaux_projet
            verifier(page.locator(".verdict-depasse").count() == (1 if depasse_projet else 0), f"{chemin.name} : bandeau du projet")
            if not depasse_projet:
                verifier(page.locator(".verdict-forte").count() == (1 if "forte" in niveaux_projet else 0), f"{chemin.name} : bandeau en avertissement")

            # Calcul des seuils : une entrée par zone, avant les écarts, formule recalculée ici
            zones = [z for b in modele["batiments"] for z in b["zones"]]
            verifier(page.locator(".calcul-zone").count() == len(zones), f"{chemin.name} : calcul des seuils par zone")
            titres = page.eval_on_selector_all(".titre-bloc", "l => l.map(x => x.textContent)")
            verifier(titres[:2] == ["Calcul des seuils", "Écarts aux seuils"], f"{chemin.name} : ordre des blocs {titres}")
            for z in zones:
                eq = page.evaluate("z => CalculSeuils.equations(z)", z)
                ci = z["coefficients"]["ic_construction"]
                ce = z["coefficients"]["ic_energie"]
                produit = sum(ci.get(k) or 0 for k in ("micombles", "misurf", "misurf_moy", "misurf_tot"))
                ajout = sum(ci.get(k) or 0 for k in ("migeo", "miinfra", "mivrd", "mipv", "mided"))
                attendu_ic = ci["ic_construction_maxmoyen"] * (1 + produit) + ajout
                attendu_en = ce["ic_energie_maxmoyen"] * (1 + sum(ce.get(k) or 0 for k in ("mcgeo", "mccombles", "mcsurf_moy", "mcsurf_tot", "mccat")))
                verifier(abs(eq[0]["calcule"] - attendu_ic) < 1e-6, f"{chemin.name} : calcul Ic construction {z['nom']}")
                verifier(abs(eq[1]["calcule"] - attendu_en) < 1e-6, f"{chemin.name} : calcul Ic énergie {z['nom']}")
                # Écart au seuil du RSEE : moins de 0,5 % sur tous les RSEE de test
                for e in eq[:2]:
                    verifier(abs(e["ecart"]) < 0.005, f"{chemin.name} : {e['cle']} s'écarte du RSEE ({e['ecart']})")
                # Bbio, Cep, Cep,nr : la valeur moyenne déduite retrouve le seuil à l'arrondi près
                for e in eq[2:]:
                    verifier(abs(e["calcule"] - e["seuil"]) <= 0.15, f"{chemin.name} : {e['cle']} {e['calcule']} / {e['seuil']}")
            # Bâtiment à plusieurs zones : seuil = moyenne pondérée par la Sref
            for b in modele["batiments"]:
                if len(b["zones"]) > 1:
                    s = sum(z["sref"] for z in b["zones"])
                    moyenne = sum(z["sref"] * z["indicateurs"]["ic_energie_max"] for z in b["zones"]) / s
                    verifier(abs(moyenne - b["indicateurs"]["ic_energie_max"]) < 0.01, f"{chemin.name} : seuil pondéré {b['nom']}")

            # Lien vers l'outil : aucun nom, valeurs dans les bornes
            liens = page.eval_on_selector_all(".lien-outil", "l => l.map(x => [x.href, x.target, x.rel])")
            verifier(len(liens) == len(zones), f"{chemin.name} : un lien par zone")
            for href, cible, rel in liens:
                verifier(href.startswith("https://seuils-re2020.streamlit.app/?v="), f"{chemin.name} : adresse du lien {href}")
                verifier(cible == "_blank" and "noopener" in rel, f"{chemin.name} : ouverture du lien")
                decode = unquote(href)
                for nom in [modele["projet"]["nom"]] + [b["nom"] for b in modele["batiments"]] + [modele["projet"].get("commune")]:
                    verifier(not nom or nom not in decode, f"{chemin.name} : nom transmis par le lien")
            for i, b in enumerate(modele["batiments"]):
                page.locator(".noeud[data-type=batiment]").nth(i).click()
                verifier(page.locator(".exigence").count() == 6, f"{chemin.name} bâtiment {b['index']} : 6 exigences attendues")
                # Une famille de couleur par exigence ; carte de la famille carbone en orange
                familles = page.eval_on_selector_all(".exigence", "l => l.map(x => x.dataset.famille)")
                verifier(familles == ["carbone", "carbone", "bioclimatique", "energie", "energie", "confort"], f"{chemin.name} : familles {familles}")
                fond_carte = page.evaluate("getComputedStyle(document.querySelector('.exigence')).backgroundColor")
                verifier(fond_carte == "rgb(255, 154, 87)", f"{chemin.name} : fond de la carte carbone {fond_carte}")
                # Contour : épais pour une exigence à risque, fin pour une marge confortable
                bords = page.eval_on_selector_all(".exigence", "l => l.map(x => [x.dataset.niveau, getComputedStyle(x).borderTopWidth])")
                verifier(all((w == "6px") == (n in ("alerte", "forte", "depasse")) for n, w in bords), f"{chemin.name} : contours {bords}")
                # Heures d'inconfort : une ligne par groupe, valeurs du RSET
                groupes_b = b["indicateurs"]["groupes_dh"]
                lignes_h = page.eval_on_selector_all(".tableau-inconfort tbody tr", "l => l.map(r => [...r.querySelectorAll('td')].map(c => c.textContent))")
                verifier(len(lignes_h) == len(groupes_b), f"{chemin.name} bâtiment {b['index']} : lignes d'heures d'inconfort")
                for g, cellules in zip(groupes_b, lignes_h):
                    for cle, texte_h in zip(("nb_h_inconf", "nb_h_inconf_1", "nb_h_inconf_2"), cellules[1:]):
                        verifier(lire_nombre(texte_h) == g[cle], f"{chemin.name} : {cle} du groupe {g['index']} = {texte_h}")
                # Composition : les sommes du schéma tombent juste
                ind = b["indicateurs"]
                verifier(page.locator(".bloc-ic").count() == 4, f"{chemin.name} bâtiment {b['index']} : blocs de la composition")
                verifier(page.locator(".plus-bloc").count() == 2, f"{chemin.name} bâtiment {b['index']} : signes + de la composition")
                for total, termes in (("ic_construction", ("ic_composant", "ic_chantier")),
                                      ("ic_batiment", ("ic_construction", "ic_eau", "ic_energie")),
                                      ("ic_projet", ("ic_batiment", "ic_parcelle"))):
                    somme = sum(ind[t] for t in termes)
                    verifier(abs(somme - ind[total]) <= max(0.5, abs(ind[total]) * 0.002), f"{chemin.name} bâtiment {b['index']} : somme {total}")
                    verifier(page.locator(f".total-ic[data-indicateur={total}]").count() >= 1,
                             f"{chemin.name} bâtiment {b['index']} : boîte {total}")
                verifier(page.locator(".composition + .note").count() == 0, f"{chemin.name} bâtiment {b['index']} : somme signalée fausse")
                verifier(page.locator(".boite-ic.avec-seuil").count() == 2, f"{chemin.name} bâtiment {b['index']} : deux indicateurs Ic avec seuil")
                attendu_depasse = "depasse" in statuts_attendus[b["index"]]
                verifier(page.locator(".verdict-depasse").count() == (1 if attendu_depasse else 0),
                         f"{chemin.name} bâtiment {b['index']} : bandeau de verdict incohérent")
                if i == 0:
                    page.screenshot(path=str(DOSSIER_CAPTURES / (chemin.stem + "_indicateurs.png")), full_page=True)

            # Zone : mêmes blocs, libellé Ic zone
            page.locator(".noeud[data-type=zone]").first.click()
            verifier(page.locator(".exigence").count() == 6, f"{chemin.name} : 6 valeurs pour la zone")
            verifier(page.locator(".total-ic[data-indicateur=ic_zone]").count() == 1, f"{chemin.name} : Ic zone dans la composition")

            # Onglet Informations : une vue sans erreur pour chaque type de nœud
            page.click("[data-onglet=informations]")
            # Bâtiment : logements pour le logement, occupants pour le reste, ascenseurs du RSET
            for i, b in enumerate(modele["batiments"]):
                page.locator(".noeud[data-type=batiment]").nth(i).click()
                infos = page.inner_text("#detail")
                tout_logement = all(z["logement"] for z in b["zones"])
                verifier(("Nombre de logements" in infos) == (b["nb_logement"] is not None), f"{chemin.name} bâtiment {b['index']} : ligne des logements")
                verifier(("Occupants" in infos) != tout_logement, f"{chemin.name} bâtiment {b['index']} : ligne des occupants")
                for libelle in ("Type de construction", "Construction neuve", "Nombre de niveaux en sous-sol", "Nombre de niveaux en surface"):
                    verifier(libelle in infos, f"{chemin.name} bâtiment {b['index']} : {libelle} absent")
                ascenseurs = page.evaluate("""() => {
                    const dt = [...document.querySelectorAll('#detail dt')].find((d) => d.textContent === "Nombre d'ascenseurs");
                    return dt ? dt.nextElementSibling.textContent : null; }""")
                verifier(ascenseurs is not None and lire_nombre(ascenseurs) == b["nb_ascenseurs"], f"{chemin.name} bâtiment {b['index']} : ascenseurs {ascenseurs}")
                # Zones de logement : traversante ou non, d'après le RSET
                for z in b["zones"]:
                    if z["logement"] and z["traversant"] is not None:
                        verifier("Traversante" in infos, f"{chemin.name} zone {z['index']} : colonne Traversante absente")
            # Projet : dates au format long, département avec son nom
            page.locator(".noeud[data-type=projet]").first.click()
            infos = page.inner_text("#detail")
            verifier(not re.search(r"\d{4}-\d{2}-\d{2}|\d{2}/\d{2}/\d{4}", infos), f"{chemin.name} : date au format court")
            code_dep = modele["informations"]["localisation"]["departement"]
            if code_dep:
                cle_dep = code_dep.zfill(2) if code_dep.isdigit() else code_dep
                verifier(f"{cle_dep} – {departements[cle_dep]}" in infos, f"{chemin.name} : département {code_dep}")
            # Localisation : note sur la zone sismique ; note d'altitude seulement si Datas_Comp contredit le RSET
            loc = attendu["informations"]["localisation"]
            if loc["zone_sismique"]:
                verifier("souvent laissée à sa valeur par défaut" in infos, f"{chemin.name} : note zone sismique absente")
            ecart_alt = loc["altitude_datas_comp"] is not None and loc["altitude"] != loc["altitude_datas_comp"]
            verifier(("probablement mal saisie" in infos) == ecart_alt, f"{chemin.name} : note d'altitude (écart {ecart_alt})")
            # Composants : identifiants INIES en lien vers base-inies.fr, nouvel onglet
            page.click("[data-onglet=composants]")
            liens_inies = page.eval_on_selector_all("a[href*='base-inies.fr']", "l => l.map(a => [a.href, a.target, a.rel])")
            verifier(len(liens_inies) > 0, f"{chemin.name} : aucun lien INIES")
            verifier(all(re.fullmatch(r"https://www\.base-inies\.fr/consultation/infos-produit/\d+", h) and t == "_blank" and "noopener" in r
                         for h, t, r in liens_inies), f"{chemin.name} : liens INIES mal formés")
            page.click("[data-onglet=informations]")
            for type_noeud in ("projet", "batiment", "zone", "parcelle"):
                noeuds = page.locator(f".noeud[data-type={type_noeud}]")
                if noeuds.count():
                    noeuds.first.click()
                    verifier(page.locator("#detail .infos").count() > 0, f"{chemin.name} : Informations vide ({type_noeud})")
                    for rel in page.eval_on_selector_all("a[href*='openstreetmap']", "l => l.map(a => a.rel)"):
                        verifier("noreferrer" in rel, f"{chemin.name} : lien OpenStreetMap sans noreferrer")
                        verifier("OpenStreetMap" in page.inner_text("#detail"), f"{chemin.name} : note OpenStreetMap absente")
            page.locator(".noeud[data-type=projet]").click()
            libelle_phase = {"1": "Programmation", "2": "Conception", "3": "Réalisation", "4": "Exploitation"}.get(modele["projet"]["phase"])
            attendu_phase = f"{libelle_phase} code {modele['projet']['phase']}" if libelle_phase else f"code {modele['projet']['phase']}"
            verifier(attendu_phase in page.inner_text("#detail").replace("\n", " "), f"{chemin.name} : phase du projet, attendu {attendu_phase}")
            page.screenshot(path=str(DOSSIER_CAPTURES / (chemin.stem + "_informations.png")), full_page=True)

            # Onglet Composants : nombre de lignes affichées et tableau des lots
            page.click("[data-onglet=composants]")
            for i, b in enumerate(modele["batiments"]):
                page.locator(".noeud[data-type=batiment]").nth(i).click()
                verifier(page.locator(".tableau-composants tbody tr").count() == b["_nb_regroupees"],
                         f"{chemin.name} bâtiment {b['index']} : lignes affichées ≠ lignes regroupées")
                nb_lots = len(b["impacts_lots"]) + sum(len(l["sous_lots"]) for l in b["impacts_lots"].values())
                verifier(page.locator(".tableau-lots tbody tr").count() == nb_lots,
                         f"{chemin.name} bâtiment {b['index']} : lignes du tableau des lots")
                # Lots à 0 dans le RSEE : Ic = somme des phases de la référence Python
                lots_nuls = not any(l["ic"] for l in b["impacts_lots"].values())
                verifier(("somme des phases" in page.inner_text("#detail")) == lots_nuls, f"{chemin.name} : note sur la somme des phases")
                if lots_nuls:
                    nb_lots_nuls += 1
                    phases_ref = graphiques_reference(chemin)[b["index"]]["lots"]
                    lignes_lots = lire_ic_lots(page)
                    for ref_lot, ic_lu, ded_lu, udd_lu, stock_lu in lignes_lots:
                        verifier(abs(lire_nombre(ic_lu) - phases_ref[ref_lot]) <= 0.051, f"{chemin.name} lot {ref_lot} : Ic ≠ somme des phases")
                        verifier(abs(lire_nombre(ded_lu) - b["impacts_lots"][ref_lot]["ic_ded"]) <= 0.051, f"{chemin.name} lot {ref_lot} : Ic DED")
                        verifier(udd_lu == "–" and stock_lu == "–", f"{chemin.name} lot {ref_lot} : UDD ou StockC affiché")
                    ic_lus = [lire_nombre(l[1]) for l in lignes_lots]
                    verifier(ic_lus == sorted(ic_lus, reverse=True), f"{chemin.name} : lots non triés par impact")
                if i == 0:
                    # L'arborescence reste dans sa colonne, même avec un nom long
                    bord_arbre, bord_detail = page.evaluate("""() => [
                        Math.max(...[...document.querySelectorAll('.noeud')].map(n => n.getBoundingClientRect().right)),
                        document.querySelector('#detail').getBoundingClientRect().left]""")
                    verifier(bord_arbre <= bord_detail, f"{chemin.name} : l'arborescence déborde sur le détail")
                    page.screenshot(path=str(DOSSIER_CAPTURES / (chemin.stem + "_composants.png")), full_page=True)
            z = modele["batiments"][0]["zones"][0]
            page.locator(".noeud[data-type=zone]").first.click()
            verifier(page.locator(".tableau-composants tbody tr").count() == len(z["lignes"]), f"{chemin.name} : lignes de la zone")
            # Filtre « Énergie » appliqué depuis l'interface
            page.select_option(".filtre select >> nth=0", "energie")
            verifier(page.locator(".tableau-composants tbody tr").count() == sum(1 for l in z["lignes"] if l["contributeur"] == "energie"),
                     f"{chemin.name} : filtre Énergie dans l'interface")
            page.select_option(".filtre select >> nth=0", "")

            # Graphiques : calculs JS = référence Python, puis tracé de chaque vue
            attendu_g = graphiques_reference(chemin)
            for b in modele["batiments"]:
                ref_g = attendu_g[b["index"]]
                calc = page.evaluate("""b => {
                    const lots = CalculsGraphiques.lots(b.impacts_lots, b.indicateurs.ic_composant);
                    const lignes = b.zones.flatMap(z => z.lignes).filter(l => l.contributeur === 'composant');
                    const natures = {};
                    for (const l of lignes) {
                        const n = CalculsGraphiques.natureFiche(l);
                        natures[n] = (natures[n] || 0) + 1;
                    }
                    return {
                        contributeurs: CalculsGraphiques.contributeurs(b.indicateurs),
                        lots,
                        ecarts: CalculsGraphiques.ecartsSeuils(b.indicateurs),
                        stock: CalculsGraphiques.stockC(b.indicateurs),
                        natures,
                        top: CalculsGraphiques.topSousLots(b.impacts_lots, 1000),
                    };
                }""", b)
                nom_b = f"{chemin.name} bâtiment {b['index']}"
                verifier(calc["contributeurs"]["valeurs"] == ref_g["valeurs"], f"{nom_b} : contributeurs")
                for r, v in ref_g["lots"].items():
                    verifier(abs(calc["lots"]["valeurs"][r] - v) < 1e-6, f"{nom_b} : lot {r}")
                parts_macro = [m["part"] for m in calc["lots"]["macro_lots"]]
                for part, cle in zip(parts_macro, ("gros", "second", "techniques")):
                    verifier(abs(part - ref_g["macro"][cle]) < 1e-9, f"{nom_b} : macro-lot {cle}")
                verifier(abs(sum(parts_macro) - 1) < 1e-9, f"{nom_b} : macro-lots ≠ 100 %")
                verifier(calc["contributeurs"]["seuil_construction"] == ref_g["seuil_construction"], f"{nom_b} : seuil Ic construction")
                verifier(calc["natures"] == ref_g["natures_lignes"], f"{nom_b} : natures {calc['natures']} ≠ {ref_g['natures_lignes']}")
                verifier(calc["stock"] == ref_g["stock_c"], f"{nom_b} : StockC")
                # Écart : même signe que le verdict de l'onglet Indicateurs
                for e in calc["ecarts"]:
                    if e["ecart"] is not None:
                        verifier((e["ecart"] > 0) == (e["statut"] == "depasse"), f"{nom_b} : écart {e['cle']} incohérent avec le verdict")
                # Sous-lots + reste non détaillé = somme des lots, aux restes ignorés près (moins de 0,5 par lot)
                somme_top = sum(l["valeur"] for l in calc["top"]["lignes"])
                verifier(somme_top >= calc["lots"]["somme"] - 13 * 0.5, f"{nom_b} : sous-lots + restes < somme des lots")

            page.click("[data-onglet=graphiques]")
            page.locator(".noeud[data-type=projet]").click()
            attendre(page, "typeof Plotly !== 'undefined' && document.querySelector('.carte-graphique')")
            nb_proj = 6 if len(modele["batiments"]) > 1 else 7  # un seul bâtiment : mêmes graphiques que sa vue
            verifier(page.locator(".carte-graphique").count() == nb_proj, f"{chemin.name} : graphiques du projet")
            attendre(page, "document.querySelectorAll('.graphique.avec-trace .main-svg').length > 0")
            page.screenshot(path=str(DOSSIER_CAPTURES / (chemin.stem + "_graphiques_projet.png")), full_page=True)
            for i, b in enumerate(modele["batiments"]):
                page.locator(".noeud[data-type=batiment]").nth(i).click()
                verifier(page.locator(".carte-graphique").count() == 7, f"{chemin.name} bâtiment {b['index']} : 7 graphiques attendus")
                verifier(page.locator(".graphique.avec-trace").count() >= 6, f"{chemin.name} bâtiment {b['index']} : graphiques tracés")
                ordre = page.eval_on_selector_all(".carte-graphique", "c => c.map(x => x.dataset.graphique)")
                verifier(ordre == ["contributeurs", "lots", "ecarts", "sous_lots", "types", "natures", "stock"],
                         f"{chemin.name} bâtiment {b['index']} : ordre des graphiques {ordre}")
                cadre = page.text_content("[data-graphique=contributeurs] .legende-cadre")
                verifier(all(t in cadre for t in ("composants + chantier", "Composants", "Chantier", "Seuil Ic construction")),
                         f"{chemin.name} bâtiment {b['index']} : cadre de la légende incomplet ({cadre})")
                hors_cadre = page.text_content("[data-graphique=contributeurs] .legende-contributeurs").replace(cadre, "")
                verifier("Énergie" in hors_cadre and "Eau" in hors_cadre, f"{chemin.name} bâtiment {b['index']} : énergie et eau hors du cadre")
                nb_traits = page.evaluate("""() => document.querySelector('[data-graphique=contributeurs] .graphique').layout.shapes
                    .filter(s => s.line && s.line.color === REGLAGES_GRAPHIQUES.couleur_seuil).length""")
                verifier(nb_traits == 1,
                         f"{chemin.name} bâtiment {b['index']} : trait du seuil Ic construction absent")
                verifier(page.locator(".carte-macro").count() == 3, f"{chemin.name} bâtiment {b['index']} : cartes des macro-lots")
                if i == 0:
                    page.screenshot(path=str(DOSSIER_CAPTURES / (chemin.stem + "_graphiques.png")), full_page=True)
            # Top N réglable
            page.locator(".noeud[data-type=batiment]").first.click()
            champ_n = page.locator("[data-graphique=sous_lots] input")
            champ_n.fill("3")
            champ_n.dispatch_event("change")
            verifier(page.locator("[data-graphique=sous_lots] tbody tr").count() == 3, f"{chemin.name} : top N")
            champ_n.fill("10")
            champ_n.dispatch_event("change")
            page.locator(".noeud[data-type=zone]").first.click()
            verifier(page.locator(".carte-graphique").count() == 7, f"{chemin.name} : graphiques de la zone")
            page.locator(".noeud[data-type=parcelle]").first.click()
            verifier(page.locator(".carte-graphique").count() == 0, f"{chemin.name} : pas de graphique pour la parcelle")
            page.click("[data-onglet=synthese]")

            # Synthèse : écart aux seuils en tête, 6 lignes par bâtiment, niveaux = calcul JS
            page.locator(".noeud[data-type=projet]").click()
            verifier(page.locator("#detail > .carte").first.get_attribute("class").find("carte-ecarts") >= 0,
                     f"{chemin.name} : écart aux seuils absent de la tête de la Synthèse")
            verifier(page.locator(".ligne-ecart").count() == 6 * len(modele["batiments"]), f"{chemin.name} : lignes d'écart du projet")
            niveaux_attendus = page.evaluate("""bs => bs.flatMap(b => CalculsGraphiques.ecartsSeuils(b.indicateurs).map(CalculsGraphiques.niveauMarge))""", modele["batiments"])
            niveaux_lus = page.eval_on_selector_all(".ligne-ecart", "l => l.map(x => x.dataset.niveau)")
            verifier(niveaux_lus == niveaux_attendus, f"{chemin.name} : niveaux d'avertissement affichés")
            page.locator(".noeud[data-type=zone]").first.click()
            verifier(page.locator(".ligne-ecart").count() == 6, f"{chemin.name} : lignes d'écart de la zone")
            page.locator(".noeud[data-type=parcelle]").first.click()
            verifier(page.locator(".ligne-ecart").count() == 0, f"{chemin.name} : pas d'écart pour la parcelle")
            page.locator(".noeud[data-type=projet]").click()
            page.screenshot(path=str(DOSSIER_CAPTURES / (chemin.stem + "_synthese.png")), full_page=True)

        print("3 bis. Avertissements : seuils de marge")
        cas_marge = [(-12, "conforme", "conforme"), (-10, "conforme", "conforme"), (-9.9, "conforme", "alerte"),
                     (-5, "conforme", "alerte"), (-4.9, "conforme", "forte"), (0, "conforme", "forte"),
                     (3, "depasse", "depasse"), (None, "absent", "absent")]
        for ecart, statut, attendu_n in cas_marge:
            lu = page.evaluate("e => CalculsGraphiques.niveauMarge(e)", {"ecart": ecart, "statut": statut})
            verifier(lu == attendu_n, f"niveauMarge({ecart}) = {lu}, attendu {attendu_n}")

        print("3 ter. Ic énergie absent : champ de saisie")
        with tempfile.TemporaryDirectory() as tmp:
            arbre = ET.parse(rsee[0])
            perf = arbre.getroot().find("RSEnv/sortie_projet/batiment/indicateur_perf_env")
            perf.remove(perf.find("ic_energie"))
            fichier = Path(tmp) / "sans_energie.xml"
            arbre.write(fichier, encoding="utf-8", xml_declaration=True)
            ouvrir_rsee(page, fichier)
            page.click("[data-onglet=graphiques]")
            page.locator(".noeud[data-type=batiment]").first.click()
            # Logo du HUB (fichier local) sur chaque graphique ; titres et données aux couleurs du HUB
            nb_cartes = page.locator(".carte-graphique").count()
            verifier(nb_cartes > 0 and page.locator(".carte-graphique > img.logo-hub").count() == nb_cartes, "logo du HUB absent d'un graphique")
            attendre(page, "[...document.querySelectorAll('.logo-hub')].every(i => i.complete)")
            verifier(page.evaluate("[...document.querySelectorAll('.logo-hub')].every(i => i.naturalWidth > 0 && i.clientHeight === 86 && getComputedStyle(i).zIndex === '5')"), "logo du HUB non chargé ou mauvaise taille")
            couleurs = page.evaluate("""() => {
                const style = (s) => getComputedStyle(document.querySelector(s));
                return [style('.carte-graphique > h3').color, style('.donnees-graphique summary').color,
                        style('.donnees-graphique thead th').backgroundColor, style('.donnees-graphique thead th').color];
            }""")
            verifier(couleurs == ["rgb(0, 0, 0)", "rgb(0, 0, 0)", "rgb(255, 192, 0)", "rgb(0, 0, 0)"], f"couleurs du HUB : {couleurs}")
            verifier(page.locator(".entete a").count() == 0, "logo ou titre cliquable dans l'en-tête")
            lien_hub = page.locator(".pied a", has_text="HUB Bas Carbone")
            verifier(lien_hub.get_attribute("href") == "https://www.ifpeb.fr/travaux/le-hub-des-prescripteurs-bas-carbone/", "lien du HUB dans le pied de page")
            champ = page.locator("[data-graphique=contributeurs] .parametre-graphique input")
            verifier(champ.count() == 1, "pas de champ de saisie quand l'Ic énergie manque")
            champ.fill("123")
            champ.dispatch_event("change")
            texte_carte = page.inner_text("[data-graphique=contributeurs]")
            verifier("saisi à la main" in texte_carte, "mention de la valeur saisie absente")
            verifier("123" in page.text_content("[data-graphique=contributeurs] table"), "valeur saisie absente du tableau")
            page.click("[data-onglet=synthese]")

        print("3 quater. Lots à 0 : somme des phases, ou non renseigné sans phases")
        for lot, attendu_i in [({"ic": 5, "phases": {"B": 1}}, 5), ({"ic": 0, "phases": {"B": 1}}, 1), ({"ic": 0, "phases": {}}, 0), (None, None)]:
            verifier(page.evaluate("l => CalculsGraphiques.impactLot(l)", lot) == attendu_i, f"impactLot({lot})")
        verifier(nb_lots_nuls > 0, "aucun RSEE de test avec tous les lots à 0")
        with tempfile.TemporaryDirectory() as tmp:
            arbre = ET.parse(rsee[0])
            for lot in arbre.getroot().findall("RSEnv/sortie_projet/batiment/contributeur/composant/lot"):
                for el in [lot, *lot.findall("sous_lot")]:
                    el.find("ic").text = "0"
                    el.remove(el.find("indicateur_co2_dynamique"))
            fichier = Path(tmp) / "sans_phases.xml"
            arbre.write(fichier, encoding="utf-8", xml_declaration=True)
            ouvrir_rsee(page, fichier)
            page.click("[data-onglet=composants]")
            page.locator(".noeud[data-type=batiment]").first.click()
            verifier("n'est pas renseigné" in page.inner_text("#detail"), "sans phases : mention « non renseigné » absente")
            verifier(all(l[1] == "–" and l[2] == "–" for l in lire_ic_lots(page)), "sans phases : une valeur est affichée")
            page.click("[data-onglet=synthese]")

        print("4. Messages d'erreur")
        msg = page.evaluate("REGLAGES.messages")
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            cas = {
                "pas_xml.xml": (b"ceci n'est pas du XML", msg["xml_invalide"]),
                "autre.xml": (b"<?xml version='1.0'?><racine/>", msg["racine"]),
                "rset_seul.xml": (b"<projet><Datas_Comp/><RSET/></projet>", msg["rset_seul"]),
                "notes.txt": (b"<projet><RSEnv><entree_projet/></RSEnv></projet>", msg["extension"]),
            }
            tampon = io.BytesIO()
            with zipfile.ZipFile(tampon, "w") as z:
                z.writestr("rsee.xml", "<projet/>")
            cas["archive.xml"] = (tampon.getvalue(), msg["zip"])  # zip renommé : détecté par signature
            cas["archive.zip"] = (tampon.getvalue(), msg["zip"])
            for nom, (contenu, attendu) in cas.items():
                (tmp / nom).write_bytes(contenu)
                page.set_input_files("#selecteur", str(tmp / nom))
                page.wait_for_selector("#message:not([hidden])")
                verifier(page.inner_text("#message") == attendu, f"{nom} : message inattendu")
                verifier(page.locator(".noeud").count() == 0, f"{nom} : arborescence non vidée")
                verifier("Lecture locale" in page.inner_text("#info-fichier"), f"{nom} : ancien fichier encore affiché")
            page.screenshot(path=str(DOSSIER_CAPTURES / "_erreur.png"))

        # Capture en largeur téléphone
        page.set_viewport_size({"width": 390, "height": 844})
        page.set_input_files("#selecteur", str(rsee[0]))
        page.wait_for_selector(".noeud")
        page.locator(".noeud[data-type=batiment]").first.click()
        page.screenshot(path=str(DOSSIER_CAPTURES / "_telephone.png"), full_page=True)
        largeur = page.evaluate("document.documentElement.scrollWidth")
        verifier(largeur <= 390, f"défilement horizontal en largeur téléphone ({largeur}px)")
        # Une seule colonne sur téléphone, quel que soit l'onglet (le détail occupe toute la largeur)
        for onglet in ("synthese", "informations", "indicateurs", "composants", "graphiques"):
            page.click(f"[data-onglet={onglet}]")
            largeur_detail = page.evaluate("document.getElementById('detail').getBoundingClientRect().width")
            verifier(largeur_detail >= 300, f"onglet {onglet} : panneau de détail trop étroit sur téléphone ({largeur_detail:.0f}px)")
        page.screenshot(path=str(DOSSIER_CAPTURES / "_telephone_graphiques_projet.png"), full_page=True)
        page.locator(".noeud[data-type=batiment]").first.click()
        page.screenshot(path=str(DOSSIER_CAPTURES / "_telephone_graphiques.png"), full_page=True)
        largeur = page.evaluate("document.documentElement.scrollWidth")
        verifier(largeur <= 390, f"défilement horizontal dans les graphiques sur téléphone ({largeur}px)")

        verifier(not messages_console, "erreurs JavaScript : " + " | ".join(messages_console))

        print("6. CSP : la page ne peut rien envoyer")
        directive = page.evaluate("""() => new Promise((fin) => {
            document.addEventListener('securitypolicyviolation', (e) => fin(e.effectiveDirective), { once: true });
            fetch('https://exemple.invalid/').catch(() => {});
        })""")
        verifier(directive == "connect-src", f"connexion non bloquée par la CSP ({directive})")
        navigateur.close()

    print()
    print(f"{nb_controles} contrôles :", "OK" if not erreurs else f"{len(erreurs)} échec(s)")
    sys.exit(1 if erreurs else 0)


if __name__ == "__main__":
    main()
