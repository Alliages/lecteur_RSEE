/* =====================================================================
   lecteur_RSEE — définitions des indicateurs
   Liste des indicateurs affichés dans l'onglet « Indicateurs » : libellé,
   balise lue dans le RSEE, seuil associé, unité, nombre de décimales.
   Aucun recalcul réglementaire : la valeur et le seuil sont ceux du RSEE ;
   on se contente de les comparer (valeur ≤ seuil) et d'afficher l'écart.

   Les clés « valeur » et « seuil » désignent les champs du modèle construit
   par js/lecture.js :
     - champs RSEnv (indicateur_perf_env) : noms de balise d'origine ;
     - champs RSET : bbio, bbio_max, cep, cep_max, cep_nr, cep_nr_max ;
     - DH : liste groupes_dh (exigence vérifiée groupe par groupe).
   ===================================================================== */

"use strict";

const INDICATEURS = {
  // Exigences réglementaires (dans l'ordre d'affichage)
  exigences: [
    {
      cle: "ic_construction", libelle: "Ic construction", source: "RSEnv",
      valeur: "ic_construction", seuil: "ic_construction_max",
      unite: REGLAGES.unite_ic, decimales: 0,
      jalons: { 2025: "ic_construction_max_2025", 2028: "ic_construction_max_2028", 2031: "ic_construction_max_2031" },
      par_occupant: "ic_construction_occ",
    },
    {
      cle: "ic_energie", libelle: "Ic énergie", source: "RSEnv",
      valeur: "ic_energie", seuil: "ic_energie_max",
      unite: REGLAGES.unite_ic, decimales: 1,
      jalons: { 2025: "ic_energie_max_2025", 2028: "ic_energie_max_2028" },
      par_occupant: "ic_energie_occ",
    },
    { cle: "bbio", libelle: "Bbio", source: "RSET", valeur: "bbio", seuil: "bbio_max", unite: "points", decimales: 1 },
    { cle: "cep", libelle: "Cep", source: "RSET", valeur: "cep", seuil: "cep_max", unite: "kWhep/m²/an", decimales: 1 },
    { cle: "cep_nr", libelle: "Cep,nr", source: "RSET", valeur: "cep_nr", seuil: "cep_nr_max", unite: "kWhep/m²/an", decimales: 1 },
    { cle: "dh", libelle: "DH (degrés-heures)", libelle_court: "DH", source: "RSET", groupes: true, unite: "°C.h", decimales: 0 },
  ],

  // Indicateurs pédagogiques (sans seuil). Pour une zone, « zone » et « libelle_zone »
  // remplacent la clé et le libellé du bâtiment.
  pedagogiques: [
    { libelle: "Ic composants", valeur: "ic_composant", unite: REGLAGES.unite_ic, decimales: 0 },
    { libelle: "Ic énergie", valeur: "ic_energie", unite: REGLAGES.unite_ic, decimales: 1 },
    { libelle: "Ic eau", valeur: "ic_eau", unite: REGLAGES.unite_ic, decimales: 1 },
    { libelle: "Ic chantier", valeur: "ic_chantier", unite: REGLAGES.unite_ic, decimales: 1 },
    { libelle: "Ic bâtiment", libelle_zone: "Ic zone", valeur: "ic_batiment", zone: "ic_zone", unite: REGLAGES.unite_ic, decimales: 0,
      par_occupant: "ic_batiment_occ", par_occupant_zone: "ic_zone_occ" },
    { libelle: "Ic parcelle", valeur: "ic_parcelle", unite: REGLAGES.unite_ic, decimales: 1 },
    { libelle: "Ic projet", valeur: "ic_projet", unite: REGLAGES.unite_ic, decimales: 0, par_occupant: "ic_projet_occ" },
    { libelle: "Ic DED (données par défaut)", valeur: "ic_ded", unite: REGLAGES.unite_ic, decimales: 0 },
    { libelle: "UDD (part de données par défaut)", valeur: "udd", unite: "%", decimales: 0, pourcentage: true },
    { libelle: "StockC bâtiment", libelle_zone: "StockC zone", valeur: "stock_c_batiment", zone: "stock_c", unite: "kg C/m²", decimales: 1 },
    { libelle: "StockC parcelle", valeur: "stock_c_parcelle", unite: "kg C/m²", decimales: 1 },
  ],

  // Composition de l'Ic, lue de gauche à droite comme une somme : chaque total s'ajoute au
  // bloc suivant. « seuil » : l'indicateur porte une exigence.
  composition: [
    {
      cle: "construction", titre: "Relatifs à la construction",
      termes: [{ libelle: "Ic composants", valeur: "ic_composant" }, { libelle: "Ic chantier", valeur: "ic_chantier" }],
      total: { libelle: "Ic construction", valeur: "ic_construction", seuil: "ic_construction_max", occupant: "ic_construction_occ" },
    },
    {
      cle: "batiment", titre: "Relatifs au bâtiment",
      termes: [{ libelle: "Ic eau", valeur: "ic_eau" }, { libelle: "Ic énergie", valeur: "ic_energie", seuil: "ic_energie_max", occupant: "ic_energie_occ" }],
      total: { libelle: "Ic bâtiment", libelle_zone: "Ic zone", valeur: "ic_batiment", zone: "ic_zone", occupant: "ic_batiment_occ", occupant_zone: "ic_zone_occ" },
    },
    {
      cle: "projet", titre: "Relatifs au projet",
      termes: [{ libelle: "Ic parcelle", valeur: "ic_parcelle" }],
      total: { libelle: "Ic projet", valeur: "ic_projet", occupant: "ic_projet_occ" },
    },
  ],

  // Indicateurs hors de la somme (champs de « pedagogiques »)
  composition_autres: ["stock_c_batiment", "stock_c_parcelle", "ic_ded", "udd"],

  // Unité des valeurs par occupant
  unite_occupant: "kg éq. CO₂/occ.",
};

/* ---------- Évaluation (comparaisons seulement, sans recalcul) ---------- */

const EvaluationIndicateurs = (() => {
  // "conforme" si valeur ≤ seuil, "depasse" sinon, "absent" si l'un manque
  function statut(valeur, seuil) {
    if (valeur === null || valeur === undefined || seuil === null || seuil === undefined) return "absent";
    return valeur <= seuil ? "conforme" : "depasse";
  }

  // Écart signé valeur − seuil et écart relatif (null si non calculable)
  function ecart(valeur, seuil) {
    if (valeur === null || valeur === undefined || seuil === null || seuil === undefined) {
      return { absolu: null, relatif: null };
    }
    return { absolu: valeur - seuil, relatif: seuil !== 0 ? (valeur - seuil) / seuil : null };
  }

  // Évalue une exigence sur un objet d'indicateurs (bâtiment ou zone)
  function evaluer(def, ind) {
    if (def.groupes) {
      const groupes = (ind.groupes_dh || []).map((g) => ({
        ...g,
        statut: statut(g.dh, g.dh_max),
        ecart: ecart(g.dh, g.dh_max),
      }));
      // Statut global : dépassé si un groupe dépasse, absent si aucun groupe renseigné
      let global = "absent";
      if (groupes.some((g) => g.statut === "depasse")) global = "depasse";
      else if (groupes.some((g) => g.statut === "conforme")) global = "conforme";
      // Groupe le plus proche (ou le plus au-delà) de son seuil, pour les synthèses
      const pire = groupes
        .filter((g) => g.statut !== "absent")
        .sort((a, b) => b.dh / b.dh_max - a.dh / a.dh_max)[0] || null;
      return { def, statut: global, groupes, valeur: pire ? pire.dh : null, seuil: pire ? pire.dh_max : null };
    }
    const valeur = ind[def.valeur] ?? null;
    const seuil = ind[def.seuil] ?? null;
    const jalons = Object.entries(def.jalons || {})
      .map(([annee, cle]) => ({ annee, seuil: ind[cle] ?? null }))
      .filter((j) => j.seuil !== null);
    return {
      def,
      valeur,
      seuil,
      statut: statut(valeur, seuil),
      ecart: ecart(valeur, seuil),
      jalons,
      par_occupant: def.par_occupant ? ind[def.par_occupant] ?? null : null,
    };
  }

  function evaluerTout(ind) {
    return INDICATEURS.exigences.map((def) => evaluer(def, ind || {}));
  }

  return { statut, ecart, evaluer, evaluerTout };
})();
