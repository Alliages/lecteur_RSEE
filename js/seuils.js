/* =====================================================================
   lecteur_RSEE — calcul des seuils et lien vers l'outil Seuils RE2020
   Met en forme la modulation lue dans le RSEE. Le seuil affiché reste
   celui du RSEE : le calcul sert à l'expliquer et à contrôler l'écart.
   ===================================================================== */

"use strict";

const CalculSeuils = (() => {
  const R = REGLAGES_SEUILS;

  // Formule : moyen × (1 + termes du produit) + termes ajoutés. [balise, libellé]
  const FORMULES = {
    ic_construction: {
      libelle: "Ic construction max", unite: "kg éq. CO₂/m²",
      produit: [["micombles", "Mi combles"], ["misurf", "Mi surf"], ["misurf_moy", "Mi surf moy"], ["misurf_tot", "Mi surf tot"]],
      ajout: [["migeo", "Mi géo"], ["miinfra", "Mi infra"], ["mivrd", "Mi VRD"], ["mipv", "Mi PV"], ["mided", "Mi DED"]],
    },
    ic_energie: {
      libelle: "Ic énergie max", unite: "kg éq. CO₂/m²",
      produit: [["mcgeo", "Mc géo"], ["mccombles", "Mc combles"], ["mcsurf_moy", "Mc surf moy"], ["mcsurf_tot", "Mc surf tot"], ["mccat", "Mc cat"]],
      ajout: [],
    },
    bbio: {
      libelle: "Bbio max", unite: "points",
      produit: [["O_Mbgeo", "Mb géo"], ["O_Mbcombles", "Mb combles"], ["O_Mbsurf_moy", "Mb surf moy"], ["O_Mbsurf_tot", "Mb surf tot"], ["O_Mbbruit", "Mb bruit"]],
      ajout: [],
    },
    cep: {
      libelle: "Cep max", unite: "kWhep/m²/an",
      produit: [["O_Mcgeo", "Mc géo"], ["O_Mccombles", "Mc combles"], ["O_Mcsurf_moy", "Mc surf moy"], ["O_Mcsurf_tot", "Mc surf tot"], ["O_Mccat", "Mc cat"]],
      ajout: [],
    },
  };
  FORMULES.cep_nr = { ...FORMULES.cep, libelle: "Cep,nr max" };

  // Termes non nuls d'une liste de coefficients
  const termes = (coefs, liste) => liste
    .filter(([balise]) => coefs[balise])
    .map(([balise, libelle]) => ({ libelle, valeur: coefs[balise] }));
  const somme = (liste) => liste.reduce((s, t) => s + t.valeur, 0);

  // Équation d'un seuil. Sans valeur moyenne dans le RSEE (Bbio, Cep, Cep,nr),
  // elle est déduite du seuil et arrondie à l'unité.
  function equation(cle, coefs, seuil, moyenLu) {
    const f = FORMULES[cle];
    const produit = termes(coefs, f.produit);
    const ajout = termes(coefs, f.ajout);
    const deduit = moyenLu === null || moyenLu === undefined;
    const facteur = 1 + somme(produit);
    const sansSeuil = seuil === null || seuil === undefined;
    const moyen = deduit ? (sansSeuil || facteur <= 0 ? null : Math.round((seuil - somme(ajout)) / facteur)) : moyenLu;
    const calcule = moyen === null ? null : moyen * facteur + somme(ajout);
    const ecart = calcule === null || !seuil ? null : (calcule - seuil) / seuil;
    return {
      cle, libelle: f.libelle, unite: f.unite, moyen, deduit, produit, ajout, calcule, seuil: seuil ?? null, ecart,
      concordant: deduit || ecart === null || Math.abs(ecart) <= R.tolerance_calcul,
    };
  }

  // Une équation par jeu distinct de coefficients (les groupes d'une zone sont souvent identiques)
  function distinctes(groupes, cle, champ) {
    const vues = new Map();
    for (const g of groupes) {
      const e = equation(cle, g, g[champ] ?? null);
      vues.set(JSON.stringify([e.moyen, e.produit, e.seuil]), e);
    }
    return Array.from(vues.values());
  }

  // Équations des cinq seuils modulés d'une zone
  function equations(zone) {
    const ind = zone.indicateurs || {};
    const coefs = zone.coefficients || {};
    const mod = zone.modulation || { bbio: [], cep: [] };
    const rset = (cle, liste, champ, seuilZone) =>
      (liste.length ? distinctes(liste, cle, champ) : [equation(cle, {}, seuilZone ?? null)]);
    return [
      equation("ic_construction", coefs.ic_construction || {}, ind.ic_construction_max ?? null, coefs.ic_construction?.ic_construction_maxmoyen),
      equation("ic_energie", coefs.ic_energie || {}, ind.ic_energie_max ?? null, coefs.ic_energie?.ic_energie_maxmoyen),
      ...rset("bbio", mod.bbio, "O_Bbio_Max", ind.bbio_max),
      ...rset("cep", mod.cep, "O_Cep_Max", ind.cep_max),
      ...rset("cep_nr", mod.cep, "O_Cep_nr_Max", ind.cep_nr_max),
    ];
  }

  // Seuils DH distincts des groupes d'une zone
  function seuilsDH(zone) {
    const liste = (zone.indicateurs?.groupes_dh || []).map((g) => g.dh_max).filter((v) => v !== null && v !== undefined);
    return Array.from(new Set(liste));
  }

  // Impact d'un lot, pour le lien (somme des phases quand le champ ic vaut 0)
  function impactLot(source, ref) {
    const lot = source.impacts_lots?.[ref];
    if (!lot) return null;
    return lot.ic || CalculsGraphiques.sommePhases(lot.phases) || null;
  }

  // Période de dépôt du PC au sens de l'outil
  function periode(datePC) {
    const annee = Number(String(datePC || "").slice(0, 4));
    if (!annee) return null;
    const trouve = R.periodes_pc.find(([debut]) => annee >= debut);
    return trouve ? trouve[1] : R.periodes_pc[R.periodes_pc.length - 1][1];
  }

  // Paramètres du lien : données techniques seulement, sans nom ni adresse. Les valeurs
  // inconnues sont omises : l'outil prend alors sa valeur par défaut.
  // L'outil calcule un bâtiment d'un seul usage : si toutes les zones ont le même usage, le lien
  // porte sur le bâtiment entier, sinon sur la zone. La Sref est celle du RSET (celle du RSEnv
  // en diffère parfois).
  function parametresLien(zone, batiment, informations) {
    const loc = informations?.localisation || {};
    const datePC = informations?.operation?.date_depot_pc || "";
    const p = zone.parametres_seuils || {};
    const pc = periode(datePC);
    const zones = batiment?.zones || [zone];
    const entier = zones.every((z) => z.usage === zone.usage);
    const source = entier && batiment ? batiment : zone;
    const logements = (entier ? zones : [zone]).reduce((s, z) => s + (z.nb_logement || 0), 0);
    const sref = source.informations?.sref ?? source.sref;
    // Le bruit se lit à la modulation : l'exposition par baie surestime celle du groupe
    const bruitModule = (zone.modulation?.bbio || []).some((g) => g.O_Mbbruit);
    const oui = (v) => (v === null || v === undefined ? null : Number(v));
    const brut = {
      usage: libelleCode("usage", zone.usage) ? zone.usage : null,
      dep: R.departements[String(loc.departement ?? "").replace(/^0+/, "")] ?? null,
      alt: R.altitudes[loc.altitude] ?? null,
      sref: sref >= 1 ? sref : null,
      nl: logements >= 1 ? logements : null,
      combles: p.s_combles > 0 ? p.s_combles : null,
      pc,
      juillet: pc === "2025 à 2027" ? Number(datePC >= R.date_decret_2026) : null,
      cat: [1, 2, 3].includes(p.categorie) ? p.categorie : null,
      bruit: bruitModule && [1, 2, 3].includes(p.bruit) ? "BR" + p.bruit : null,
      clim: oui(p.climatise),
      rcu: oui(p.reseau_chaleur),
      lot1: impactLot(source, "1"),
      lot2: impactLot(source, "2"),
      // Le lot 13 du RSEE ne se confond pas avec le photovoltaïque : on repart de Mi PV
      lot13: zone.coefficients?.ic_construction?.mipv > 0 ? zone.coefficients.ic_construction.mipv + R.franchise_lot13 : null,
      ded: source.indicateurs?.ic_ded ?? null,
    };
    const parametres = { v: R.version_outil };
    for (const [cle, valeur] of Object.entries(brut)) {
      if (valeur === null || valeur === undefined) continue;
      parametres[cle] = typeof valeur === "number" ? Math.round(Math.max(valeur, 0) * 1000) / 1000 : valeur;
    }
    return parametres;
  }

  function lienOutil(zone, batiment, informations) {
    const requete = Object.entries(parametresLien(zone, batiment, informations))
      .map(([cle, valeur]) => `${cle}=${encodeURIComponent(valeur)}`).join("&");
    return `${R.url_outil}?${requete}`;
  }

  return { FORMULES, equation, equations, seuilsDH, periode, parametresLien, lienOutil };
})();
