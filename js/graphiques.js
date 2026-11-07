/* =====================================================================
   lecteur_RSEE — calculs des graphiques (fonctions sans interface)
   Prépare les valeurs à tracer à partir du modèle de js/lecture.js.
   Aucun recalcul réglementaire : on additionne, on compte et on compare
   des valeurs lues dans le RSEE.

   Impact d'un lot ou d'un sous-lot : balise <ic>, ou somme des phases de
   <indicateur_co2_dynamique> quand elle vaut 0 (tous les lots d'un bâtiment,
   dans une partie des RSEE). Bexp (énergie exportée) n'entre pas dans l'Ic.
   ===================================================================== */

"use strict";

const CalculsGraphiques = (() => {
  const R = REGLAGES_GRAPHIQUES;

  // Somme des phases comptées dans l'Ic ; null si aucune phase n'est renseignée
  function sommePhases(phases) {
    const valeurs = R.phases_ic.map((p) => phases?.[p]).filter((v) => v !== null && v !== undefined);
    return valeurs.length ? valeurs.reduce((s, v) => s + v, 0) : null;
  }

  // Impact d'un lot ou d'un sous-lot : seule règle de l'outil. <ic> prime, car certains
  // sous-lots ont un <ic> sans aucune phase (9.1, 8.7). null si rien n'est renseigné.
  function impactLot(lot) {
    return lot?.ic || (sommePhases(lot?.phases) ?? lot?.ic ?? null);
  }

  /* ---------- Contributeurs ---------- */

  // Valeurs arrondies à l'unité, total = somme des arrondis (méthode du dashboard OPEE).
  // Parts sur composants + chantier + énergie : l'eau n'a pas de part.
  // saisie : Ic énergie entré à la main quand le RSEE ne le donne pas.
  function contributeurs(ind, saisie) {
    const lu = ind.ic_energie ?? null;
    const valeurs = {};
    const absents = [];
    for (const c of R.contributeurs) {
      let v = ind[c.champ] ?? null;
      if (c.cle === "energie" && v === null) v = saisie ?? null;
      if (v === null) absents.push(c.cle);
      valeurs[c.cle] = v === null ? 0 : Math.round(v);
    }
    const base = valeurs.composant + valeurs.chantier + valeurs.energie;
    const parts = {};
    for (const cle of ["composant", "chantier", "energie"]) parts[cle] = base > 0 ? valeurs[cle] / base : null;
    return {
      valeurs,
      parts,
      absents,
      total: Object.values(valeurs).reduce((s, v) => s + v, 0),
      construction: valeurs.composant + valeurs.chantier,
      seuil_construction: ind.ic_construction_max ?? null,
      energie_absente: lu === null,
      energie_saisie: lu === null && saisie !== null && saisie !== undefined,
    };
  }

  /* ---------- Lots ---------- */

  // Impact de chaque lot { ref: valeur }, parts des macro-lots et écart à l'Ic composants
  function lots(impacts, icComposant) {
    const valeurs = {};
    for (const [ref, lot] of Object.entries(impacts || {})) {
      if (!(ref in R.lots)) continue; // hors nomenclature : signalé par le contrôle du fichier
      valeurs[ref] = impactLot(lot) ?? 0;
    }
    const somme = Object.values(valeurs).reduce((s, v) => s + v, 0);
    const sommeGroupe = (refs) => refs.reduce((s, r) => s + (valeurs[r] || 0), 0);
    const horsVRD = sommeGroupe(R.macro_lots.flatMap((m) => m.lots));
    const macro_lots = R.macro_lots.map((m) => ({
      nom: m.nom,
      lots: m.lots,
      couleur: m.couleur,
      valeur: sommeGroupe(m.lots),
      part: horsVRD > 0 ? sommeGroupe(m.lots) / horsVRD : null,
    }));
    const ecart = icComposant ? (somme - icComposant) / icComposant : null;
    return { valeurs, somme, macro_lots, ecart };
  }

  // Sous-lots classés par impact, avec le reste de chaque lot non détaillé en sous-lots
  // (forfaits saisis directement au niveau du lot, par exemple)
  function topSousLots(impacts, n) {
    const lignes = [];
    for (const [ref, lot] of Object.entries(impacts || {})) {
      const valeurLot = impactLot(lot) ?? 0;
      let detaille = 0;
      for (const [refSous, sous] of Object.entries(lot.sous_lots || {})) {
        const valeur = impactLot(sous) ?? 0;
        detaille += valeur;
        lignes.push({ lot: ref, sous_lot: refSous, valeur, non_detaille: false });
      }
      const reste = valeurLot - detaille;
      if (reste > R.reste_lot_minimal) lignes.push({ lot: ref, sous_lot: null, valeur: reste, non_detaille: true });
    }
    lignes.sort((a, b) => b.valeur - a.valeur);
    return { lignes: lignes.slice(0, n), nb_total: lignes.length };
  }

  /* ---------- Fiches ---------- */

  // Forfaitaire : codes 5 et 6, et lots ou sous-lots forfaitaires codés 3 par certains logiciels
  function estForfaitaire(l) {
    const t = l.type_donnees;
    return t === "5" || t === "6" || (t === "3" && /forfaitaire/i.test(l.nom || ""));
  }

  // Nature d'une fiche (clé de REGLAGES_GRAPHIQUES.natures)
  function natureFiche(l) {
    if (estForfaitaire(l)) return "forfaitaire";
    switch (l.type_donnees) {
      case "1": return "fdes";
      case "2": return "pep";
      case "3": return "ded";
      case "7": return Number(l.lot) <= R.dernier_lot_fdes_configuree ? "fdes_configuree" : "fiche_configuree";
    }
    return "autres";
  }

  // Type d'une fiche pour le comptage (clé de REGLAGES_GRAPHIQUES.types_fiches).
  // Le forfaitaire rejoint « Autres », comme le conventionnel du dashboard OPEE.
  function typeFiche(l) {
    const nature = natureFiche(l);
    if (nature === "fdes_configuree" || nature === "fiche_configuree") return "configuree";
    return nature === "forfaitaire" ? "autres" : nature;
  }

  // Nombre de fiches de chaque type
  function compterTypes(lignes) {
    const compte = Object.fromEntries(R.types_fiches.map((t) => [t.cle, 0]));
    for (const l of lignes) compte[typeFiche(l)] += 1;
    return { compte, total: lignes.length };
  }

  // Par lot : fiches de chaque nature, parts en %, nombre moyen de fiches par entité
  // ayant au moins une fiche dans ce lot. Les fiches sans lot sont comptées à part.
  function naturesParLot(entites) {
    const parLot = {};
    let sans_lot = 0;
    for (const e of entites) {
      for (const l of e.lignes) {
        if (l.lot === null || !(l.lot in R.lots)) {
          sans_lot += 1;
          continue;
        }
        const lot = (parLot[l.lot] ??= { compte: {}, total: 0, entites: new Set() });
        const nature = natureFiche(l);
        lot.compte[nature] = (lot.compte[nature] || 0) + 1;
        lot.total += 1;
        lot.entites.add(e.cle);
      }
    }
    const lignes = Object.keys(parLot).sort((a, b) => Number(a) - Number(b)).map((ref) => {
      const lot = parLot[ref];
      const parts = {};
      for (const n of R.natures) parts[n.cle] = ((lot.compte[n.cle] || 0) / lot.total) * 100;
      return { lot: ref, compte: lot.compte, parts, total: lot.total, moyenne: lot.total / lot.entites.size };
    });
    return { lignes, sans_lot };
  }

  // Part des FDES / PEP face aux DED et au forfaitaire, par macro-lot.
  // Les « Autres » sont hors calcul et le lot 1 n'est pas compté.
  function fichesMacroLots(entites) {
    const campDe = Object.fromEntries(R.natures.map((n) => [n.cle, n.camp]));
    return R.macro_lots.map((m) => {
      const n = { specifique: 0, ded: 0, forfaitaire: 0, autres: 0 };
      const avecFiches = new Set();
      for (const e of entites) {
        for (const l of e.lignes) {
          if (!m.lots.includes(Number(l.lot))) continue;
          n[campDe[natureFiche(l)]] += 1;
          avecFiches.add(e.cle);
        }
      }
      const base = n.specifique + n.ded + n.forfaitaire;
      const part = (v) => (base > 0 ? v / base : null);
      return {
        macro: m,
        fiches: base,
        nb_entites: avecFiches.size,
        part_specifique: part(n.specifique),
        part_ded: part(n.ded),
        part_forfaitaire: part(n.forfaitaire),
        part_defaut: part(n.ded + n.forfaitaire),
      };
    });
  }

  /* ---------- Écarts aux seuils ---------- */

  // Écart (valeur − seuil) / seuil en %, positif au-dessus du seuil.
  // Seuils lus dans le RSEE ; DH : groupe le plus défavorable.
  function ecartsSeuils(ind) {
    return R.ecarts.map((e) => {
      const def = INDICATEURS.exigences.find((x) => x.cle === e.cle);
      const ev = EvaluationIndicateurs.evaluer(def, ind);
      const calculable = ev.valeur !== null && ev.seuil !== null && ev.seuil !== 0;
      return {
        cle: e.cle, libelle: e.libelle, couleur: e.couleur, famille: def.famille, unite: def.unite, decimales: def.decimales,
        valeur: ev.valeur, seuil: ev.seuil, statut: ev.statut,
        ecart: calculable ? ((ev.valeur - ev.seuil) / ev.seuil) * 100 : null,
      };
    });
  }

  // Niveau d'avertissement d'un écart : marge restante sous le seuil.
  // « depasse » suit le verdict réglementaire (valeur > seuil).
  function niveauMarge(e) {
    if (e.ecart === null) return "absent";
    if (e.statut === "depasse") return "depasse";
    const marge = -e.ecart;
    if (marge < R.marge_alerte_forte) return "forte";
    if (marge < R.marge_alerte) return "alerte";
    return "conforme";
  }

  /* ---------- StockC ---------- */

  // StockC d'un bâtiment (stock_c_batiment) ou d'une zone (stock_c)
  const stockC = (ind) => ind.stock_c_batiment ?? ind.stock_c ?? null;

  return {
    sommePhases, impactLot, contributeurs, lots, topSousLots, estForfaitaire, natureFiche, typeFiche,
    compterTypes, naturesParLot, fichesMacroLots, ecartsSeuils, niveauMarge, stockC,
  };
})();
