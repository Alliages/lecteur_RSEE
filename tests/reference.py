"""
lecteur_RSEE — valeurs de référence

Extraction indépendante (Python, bibliothèque standard) des valeurs que
l'interface doit afficher, pour comparaison avec js/lecture.js.
Écrit volontairement sans reprendre le code JS : deux lectures distinctes
du même fichier doivent donner le même résultat.

Usage : python tests/reference.py chemin/vers/fichier.xml
"""

import json
import sys
import xml.etree.ElementTree as ET


def nombre(el, chemin):
    """Nombre au bout du chemin, ou None si absent / vide / non numérique."""
    t = el.findtext(chemin) if el is not None else None
    if t is None or t.strip() == "":
        return None
    try:
        return float(t.strip().replace(",", "."))
    except ValueError:
        return None


def texte(el, chemin):
    """Texte au bout du chemin, blancs internes réduits à une espace, ou None."""
    t = el.findtext(chemin) if el is not None else None
    t = " ".join(t.split()) if t else ""
    return t or None


def compter(el, balise):
    return 0 if el is None else sum(1 for _ in el.iter(balise))


def feuilles(el):
    """Feuilles directes d'un élément -> {balise: nombre ou None}."""
    if el is None:
        return {}
    res = {}
    for c in el:
        if len(c) == 0:
            res[c.tag] = nombre(c, ".")
    return res


def indicateurs_reference(racine):
    """Indicateurs par index de bâtiment et de zone (RSEnv + RSET) et DH par groupe."""
    bat, zon = {}, {}
    for b in racine.findall("RSEnv/sortie_projet/batiment"):
        bat.setdefault(texte(b, "index"), {}).update(feuilles(b.find("indicateur_perf_env")))
        for z in b.findall("zone"):
            zon.setdefault(texte(z, "index"), {}).update(feuilles(z.find("indicateur_perf_env")))

    sortie = "RSET/Sortie_Projet/"
    for b in racine.findall(sortie + "Sortie_Batiment_B_Collection/Sortie_Batiment_B"):
        bat.setdefault(texte(b, "Index"), {}).update(bbio=nombre(b, "O_Bbio_pts_annuel"), bbio_max=nombre(b, "O_Bbio_Max"))
        for z in b.findall("Sortie_Zone_B_Collection/Sortie_Zone_B"):
            zon.setdefault(texte(z, "Index"), {}).update(bbio=nombre(z, "O_Bbio_pts_annuel"), bbio_max=nombre(z, "O_Bbio_Max"))
    champs_c = {"cep": "O_Cep_annuel", "cep_max": "O_Cep_Max", "cep_nr": "O_Cep_nr_annuel", "cep_nr_max": "O_Cep_nr_Max"}
    for b in racine.findall(sortie + "Sortie_Batiment_C_Collection/Sortie_Batiment_C"):
        bat.setdefault(texte(b, "Index"), {}).update({k: nombre(b, v) for k, v in champs_c.items()})
        for z in b.findall("Sortie_Zone_C_Collection/Sortie_Zone_C"):
            zon.setdefault(texte(z, "Index"), {}).update({k: nombre(z, v) for k, v in champs_c.items()})

    inconfort = {texte(g, "Index") for g in racine.findall(sortie + "Groupe_Inconf_Collection/Sortie_Groupe_D")}
    groupes = []
    for b in racine.findall(sortie + "Sortie_Batiment_D_Collection/Sortie_Batiment_D"):
        for z in b.findall("Sortie_Zone_D_Collection/Sortie_Zone_D"):
            for g in z.findall("Sortie_Groupe_D_Collection/Sortie_Groupe_D"):
                groupes.append({
                    "index": texte(g, "Index"), "batiment": texte(b, "Index"), "zone": texte(z, "Index"),
                    "dh": nombre(g, "O_NbDegresHeures"), "dh_max": nombre(g, "O_NbDegresHeures_max"),
                    "inconfort": texte(g, "Index") in inconfort,
                })
    return bat, zon, groupes


def statuts_reference(ind, groupes):
    """Verdict attendu pour les 6 exigences : 'conforme', 'depasse' ou 'absent'."""
    def st(v, s):
        if v is None or s is None:
            return "absent"
        return "conforme" if v <= s else "depasse"
    res = [st(ind.get(v), ind.get(s)) for v, s in (
        ("ic_construction", "ic_construction_max"), ("ic_energie", "ic_energie_max"),
        ("bbio", "bbio_max"), ("cep", "cep_max"), ("cep_nr", "cep_nr_max"))]
    dh = [st(g["dh"], g["dh_max"]) for g in groupes]
    res.append("depasse" if "depasse" in dh else ("conforme" if "conforme" in dh else "absent"))
    return res


def lignes_reference(zone):
    """Lignes (composants et services) d'une zone ou d'une parcelle, retrouvées par
    remontée des ancêtres de chaque <donnees_composant> / <donnees_service>
    (méthode distincte du parcours descendant de js/lecture.js).
    Renvoie une liste triée de tuples comparables."""
    if zone is None:  # parcelle sans bloc <contributeur> (rsee.xml)
        return []
    parents = {c: p for p in zone.iter() for c in p}
    res = []
    for d in zone.iter():
        if d.tag not in ("donnees_composant", "donnees_service"):
            continue
        lot = sous_lot = sous_contrib = contrib = None
        e = parents.get(d)
        while e is not None:
            if e.tag == "lot" and lot is None:
                lot = e.get("ref")
            elif e.tag == "sous_lot" and sous_lot is None:
                sous_lot = e.get("ref")
            elif e.tag == "sous_contributeur" and sous_contrib is None:
                sous_contrib = e.get("ref")
            elif parents.get(e) is not None and parents[e].tag == "contributeur":
                contrib = e.tag
            e = parents.get(e)
        q = nombre(d, "quantite")
        res.append((contrib or "", lot or "", sous_lot or "", sous_contrib or "",
                    texte(d, "id_fiche") or "", texte(d, "type_donnees") or "", texte(d, "unite_uf") or "",
                    round(q, 9) if q is not None else None))
    return sorted(res, key=lambda t: tuple("" if x is None else str(x) for x in t))


def impacts_lots_reference(el):
    """{ref lot: {ic, sous_lots: {ref: ic}}} pour le contributeur composants."""
    res = {}
    if el is None:
        return res
    for lot in el.findall("contributeur/composant/lot"):
        res[lot.get("ref")] = {
            "ic": nombre(lot, "ic"),
            "ic_ded": nombre(lot, "ic_ded"),
            "sous_lots": {sl.get("ref"): {"ic": nombre(sl, "ic")} for sl in lot.findall("sous_lot")},
        }
    return res


def informations_reference(racine):
    """Informations générales attendues (onglet Informations)."""
    g = racine.find("Datas_Comp/donnees_generales")
    op = g.find("operation")
    acteurs = []
    for balise, role in (("maitre_ouvrage", "Maître d'ouvrage"), ("maitre_oeuvre", "Maître d'œuvre"), ("BET", "Bureau d'études")):
        for a in g.findall(balise):
            acteurs.append({"role": role, "nom": texte(a, "nom"), "siret": texte(a, "SIRET")})
    return {
        "operation": {
            "num_permis": texte(op, "num_permis"),
            "date_depot_pc": texte(op, "date_depot_PC"),
            "avancement": texte(op, "avancement"),
        },
        "localisation": {
            "cadastre": texte(op, "cadastre/reference_cadastrale"),
            "zone_climatique": texte(op, "zone_climatique"),
            "departement": texte(racine, "RSET/Sortie_Projet/Departement"),
            "zone_sismique": texte(op, "zone_sismique"),
        },
        "acteurs": acteurs,
    }


def reference(chemin_fichier, nomenclature=None):
    """Renvoie le dictionnaire des valeurs attendues pour un RSEE."""
    racine = ET.parse(chemin_fichier).getroot()
    generales = racine.find("Datas_Comp/donnees_generales")
    rsenv = racine.find("RSEnv")
    entree = rsenv.find("entree_projet")

    # Noms RSET des bâtiments et des zones
    noms_bat, noms_zone = {}, {}
    for b in racine.findall("RSET/Entree_Projet/Batiment_Collection/Batiment"):
        noms_bat[texte(b, "Index")] = texte(b, "Name")
        for z in b.findall("Zone_Collection/Zone"):
            noms_zone[texte(z, "Index")] = texte(z, "Name")

    logiciels = []
    for l in generales.findall("logiciel"):
        s = " ".join(x for x in (texte(l, "nom"), texte(l, "version")) if x)
        if s and s not in logiciels:
            logiciels.append(s)

    projet = {
        "nom": texte(generales, "operation/nom") or texte(racine, "RSET/Entree_Projet/Name"),
        "num_permis": texte(generales, "operation/num_permis"),
        "commune": texte(generales, "operation/adresse/city"),
        "date_etude": texte(entree, "date_etude"),
        "logiciels": logiciels,
        "version_rsenv": rsenv.get("version"),
        "phase": rsenv.get("phase"),
        "version_rset": texte(racine, "RSET/Entree_Projet/Version"),
    }

    batiments, refs_inconnues = [], set()
    for b in entree.findall("batiment"):
        zones = []
        for z in b.findall("zone"):
            idx = texte(z, "index")
            contrib = z.find("contributeur")
            zones.append({
                "index": idx,
                "nom": noms_zone.get(idx) or "Zone " + idx,
                "sref": nombre(z, "sref"),
                "n_occ": nombre(z, "n_occ"),
                "nb_logement": nombre(z, "nb_logement"),
                "nb_composants": compter(contrib, "donnees_composant"),
                "nb_services": compter(contrib, "donnees_service"),
            })
            if nomenclature is not None:
                for l in z.iter("lot"):
                    if l.get("ref") not in nomenclature["lots"]:
                        refs_inconnues.add("lot " + str(l.get("ref")))
                for s in z.iter("sous_lot"):
                    if s.get("ref") not in nomenclature["sous_lots"]:
                        refs_inconnues.add("sous-lot " + str(s.get("ref")))
        idx = texte(b, "index")
        batiments.append({
            "index": idx,
            "nom": texte(b, "nom") or noms_bat.get(idx) or "Bâtiment " + idx,
            "sref": nombre(b, "sref"),
            "nb_composants": sum(z["nb_composants"] for z in zones),
            "nb_services": sum(z["nb_services"] for z in zones),
            "zones": zones,
        })

    # Lignes de composants et services, par zone (comparées en multiensemble)
    lignes = {}
    for b in entree.findall("batiment"):
        for z in b.findall("zone"):
            lignes[texte(z, "index")] = lignes_reference(z.find("contributeur"))
    lignes_parcelles = [lignes_reference(p.find("contributeur")) for p in entree.findall("parcelle")]

    # Données administratives (Datas_Comp) et impacts par lot (sortie RSEnv)
    admin_bat = {texte(b, "Index"): b for b in racine.findall("Datas_Comp/batiment_collection/batiment")}
    sortie_bat = {texte(b, "index"): b for b in racine.findall("RSEnv/sortie_projet/batiment")}
    sortie_zone = {texte(z, "index"): z for b in sortie_bat.values() for z in b.findall("zone")}
    for b in batiments:
        a = admin_bat.get(b["index"])
        b["informations"] = {
            "usage_principal": texte(a, "usage_principal"),
            "n_occ": nombre(a, "n_occ"),
            "nb_niv_surface": nombre(a, "nb_niv_surface"),
            "parking_ext": nombre(a, "nb_place_parking_ext"),
        }
        b["impacts_lots"] = impacts_lots_reference(sortie_bat.get(b["index"]))
        for z in b["zones"]:
            z["impacts_lots"] = impacts_lots_reference(sortie_zone.get(z["index"]))
            perf = sortie_zone[z["index"]].find("indicateur_perf_env") if z["index"] in sortie_zone else None
            z["coefficients"] = {
                "ic_construction": feuilles(perf.find("coef_mod_icconstruction")) if perf is not None else {},
                "ic_energie": feuilles(perf.find("coef_mod_icenergie")) if perf is not None else {},
            }

    # Indicateurs : valeurs lues (comparées au modèle JS) et verdicts attendus
    ind_bat, ind_zone, groupes = indicateurs_reference(racine)
    statuts = {}
    for b in batiments:
        g_bat = [g for g in groupes if g["batiment"] == b["index"]]
        b["indicateurs"] = dict(ind_bat.get(b["index"], {}), groupes_dh=g_bat)
        statuts[b["index"]] = statuts_reference(b["indicateurs"], g_bat)
        for z in b["zones"]:
            g_zone = [g for g in groupes if g["zone"] == z["index"]]
            z["indicateurs"] = dict(ind_zone.get(z["index"], {}), groupes_dh=g_zone)

    parcelles = [{
        "surface_parcelle": nombre(p, "surface_parcelle"),
        "surface_veg": nombre(p, "surface_veg"),
        "nb_services": compter(p.find("contributeur"), "donnees_service"),
    } for p in entree.findall("parcelle")]

    return {
        "projet": projet,
        "batiments": batiments,
        "parcelles": parcelles,
        "refs_inconnues": sorted(refs_inconnues),
        "statuts": statuts,
        "informations": informations_reference(racine),
        "lignes": lignes,
        "lignes_parcelles": lignes_parcelles,
    }


def phases_ic(el):
    """Somme des phases comptées dans l'Ic (Bexp exclu) d'un élément de sortie."""
    bloc = el.find("indicateur_co2_dynamique") if el is not None else None
    if bloc is None:
        return None
    return sum(float(v.text) for v in bloc.findall("valeur_phase_acv") if v.get("ref") != "Bexp")


def nature_reference(type_donnees, nom, lot):
    """Nature d'une fiche, écrite à partir des règles (pas du code JS)."""
    if type_donnees in ("5", "6"):
        return "forfaitaire"
    if type_donnees == "3":
        return "forfaitaire" if "forfaitaire" in (nom or "").lower() else "ded"
    if type_donnees == "1":
        return "fdes"
    if type_donnees == "2":
        return "pep"
    if type_donnees == "7":
        return "fdes_configuree" if int(lot) <= 7 else "fiche_configuree"
    return "autres"


def graphiques_reference(chemin_fichier):
    """Valeurs attendues dans les graphiques, par index de bâtiment.

    Lots : <ic>, ou somme des phases s'il vaut 0 ; macro-lots hors lot 1.
    Fiches comptées ligne à ligne, sans regroupement.
    """
    racine = ET.parse(chemin_fichier).getroot()
    sortie = racine.find("RSEnv/sortie_projet")
    entree = racine.find("RSEnv/entree_projet")
    resultat = {}
    for b in sortie.findall("batiment"):
        index = texte(b, "index")
        perf = b.find("indicateur_perf_env")
        lots = {l.get("ref"): nombre(l, "ic") or phases_ic(l) for l in b.findall("contributeur/composant/lot")}
        groupes = {"gros": [2, 3], "second": [4, 5, 6, 7], "techniques": list(range(8, 14))}
        hors_vrd = sum(v for r, v in lots.items() if int(r) >= 2)
        macro = {k: sum(lots.get(str(r), 0) for r in refs) / hors_vrd for k, refs in groupes.items()}
        valeurs = {c: round(nombre(perf, "ic_" + c) or 0) for c in ("composant", "chantier", "energie", "eau")}
        resultat[index] = {
            "valeurs": valeurs, "lots": lots, "macro": macro,
            "seuil_construction": nombre(perf, "ic_construction_max"),
            "stock_c": nombre(perf, "stock_c_batiment"),
        }
    # Fiches d'entrée : nature de chaque ligne, par bâtiment (zones additionnées)
    for b in entree.findall("batiment"):
        natures = {}
        composants = b.findall("zone/contributeur/composant")
        for c in composants:
            for parent, lot in [(c, None)] + [(l, l.get("ref")) for l in c.findall("lot")] + \
                    [(s, l.get("ref")) for l in c.findall("lot") for s in l.findall("sous_lot")]:
                for d in parent.findall("donnees_composant"):
                    n = nature_reference(d.findtext("type_donnees"), d.findtext("nom"), lot or 0)
                    natures[n] = natures.get(n, 0) + 1
        resultat[texte(b, "index")]["natures_lignes"] = natures
        resultat[texte(b, "index")]["nb_zones"] = len(b.findall("zone"))
    return resultat


if __name__ == "__main__":
    print(json.dumps(reference(sys.argv[1]), ensure_ascii=False, indent=2))
