/* =====================================================================
   lecteur_RSEE — lecture d'un RSEE
   Fonctions sans interface : décodage du fichier, contrôle du format,
   construction du modèle (projet / bâtiments / zones / parcelles),
   rattachement des indicateurs (RSEnv : Ic ; RSET : Bbio, Cep, DH),
   informations administratives (Datas_Comp), composants et services,
   impacts par lot et sous-lot.
   Aucun recalcul réglementaire : on ne fait que lire les valeurs du RSEE.

   Organisation d'un RSEE (racine <projet>) :
     Datas_Comp  données administratives (opération, acteurs, logiciel)
     RSET        thermique ; noms des bâtiments et des zones
     RSEnv       ACV : entree_projet (composants, services, parcelle)
                       sortie_projet (indicateurs)
   Bâtiments et zones sont reliés entre blocs par leur index.
   Un RSET seul (sans RSEnv) est aussi lu : bâtiments et zones viennent
   alors de RSET/Entree_Projet, sans données environnementales.
   Les index de zone sont uniques pour tout le projet (1..n).
   ===================================================================== */

"use strict";

const LectureRSEE = (() => {
  /* ---------- Outils de navigation XML (enfants directs uniquement) ---------- */

  // Premier enfant direct portant ce nom de balise
  function enfant(el, nom) {
    if (!el) return null;
    for (const c of el.children) if (c.tagName === nom) return c;
    return null;
  }

  // Tous les enfants directs portant ce nom de balise
  function enfants(el, nom) {
    if (!el) return [];
    return Array.from(el.children).filter((c) => c.tagName === nom);
  }

  // Suit un chemin "a/b/c" d'enfants directs ; renvoie l'élément ou null
  function suivre(el, chemin) {
    let courant = el;
    for (const nom of chemin.split("/")) {
      courant = enfant(courant, nom);
      if (!courant) return null;
    }
    return courant;
  }

  // Texte nettoyé au bout d'un chemin, ou null si absent / vide.
  // Les blancs internes (retours à la ligne, indentation) sont réduits à une espace.
  function texte(el, chemin) {
    const cible = chemin ? suivre(el, chemin) : el;
    if (!cible) return null;
    const t = cible.textContent.replace(/\s+/g, " ").trim();
    return t === "" ? null : t;
  }

  // Nombre au bout d'un chemin (accepte "3.94E+0002"), ou null
  function nombre(el, chemin) {
    const t = texte(el, chemin);
    if (t === null) return null;
    const n = Number(t.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }

  // Toutes les feuilles directes d'un élément, converties en nombres :
  // { balise: nombre | null }. Les sous-blocs (coefficients…) sont ignorés.
  function feuillesNumeriques(el) {
    const resultat = {};
    if (!el) return resultat;
    for (const c of el.children) {
      if (c.children.length === 0) resultat[c.tagName] = nombre(c, "");
    }
    return resultat;
  }

  // Nombre d'éléments d'un nom donné sous un élément (toutes profondeurs)
  function compter(el, nom) {
    return el ? el.getElementsByTagName(nom).length : 0;
  }

  /* ---------- Décodage du fichier ---------- */

  // Décode les octets selon l'encodage déclaré dans le prologue XML
  // (utf-8 le plus souvent ; iso-8859-1 / windows-1252 possibles).
  function decoder(octets) {
    const debut = new TextDecoder("ascii").decode(octets.slice(0, 200));
    const declare = /encoding\s*=\s*["']([A-Za-z0-9._-]+)["']/i.exec(debut);
    let encodage = declare ? declare[1].toLowerCase() : REGLAGES.encodage_defaut;
    try {
      return new TextDecoder(encodage).decode(octets);
    } catch (e) {
      // Encodage inconnu du navigateur : repli sur l'encodage par défaut
      return new TextDecoder(REGLAGES.encodage_defaut).decode(octets);
    }
  }

  // Reconnaît une archive zip à sa signature "PK\x03\x04"
  function estZip(octets) {
    const o = new Uint8Array(octets.slice(0, 4));
    return o[0] === 0x50 && o[1] === 0x4b && o[2] === 0x03 && o[3] === 0x04;
  }

  /* ---------- Contrôle du format ---------- */

  // Renvoie { doc } si le texte est un RSEE exploitable, { doc, rset_seul: true } pour un RSET
  // seul (sans RSEnv) qui décrit au moins ses bâtiments, sinon { erreur }
  function controler(texteXml) {
    const M = REGLAGES.messages;
    const doc = new DOMParser().parseFromString(texteXml, "application/xml");
    if (doc.getElementsByTagName("parsererror").length > 0) return { erreur: M.xml_invalide };

    const racine = doc.documentElement;
    if (!racine || racine.tagName !== REGLAGES.racine_attendue) return { erreur: M.racine };

    const B = REGLAGES.blocs;
    if (!enfant(racine, B.environnement)) {
      if (enfants(suivre(racine, B.energie + "/Entree_Projet/Batiment_Collection"), "Batiment").length) {
        return { doc, rset_seul: true };
      }
      return { erreur: enfant(racine, B.energie) ? M.rset_seul : M.rsenv_absent };
    }
    if (!suivre(racine, B.environnement + "/entree_projet")) return { erreur: M.rsenv_absent };
    return { doc };
  }

  /* ---------- Construction du modèle ---------- */

  // Noms des bâtiments et des zones tirés du RSET, indexés par index,
  // et caractère traversant des zones (Is_Traversant : 1 ou 0)
  function nomsRSET(racine) {
    const noms = { batiments: {}, zones: {}, traversants: {} };
    const collection = suivre(racine, REGLAGES.blocs.energie + "/Entree_Projet/Batiment_Collection");
    for (const b of enfants(collection, "Batiment")) {
      noms.batiments[texte(b, "Index")] = texte(b, "Name");
      for (const z of enfants(enfant(b, "Zone_Collection"), "Zone")) {
        noms.zones[texte(z, "Index")] = texte(z, "Name");
        noms.traversants[texte(z, "Index")] = nombre(z, "Is_Traversant");
      }
    }
    return noms;
  }

  /* ---------- Indicateurs ---------- */

  // Valeurs par phase du cycle de vie (indicateur CO₂ à pondération dynamique) :
  // { "A1-A3": n, "A4-A5": n, B: n, C: n, D: n, Bexp: n }
  function phasesCO2(el) {
    const phases = {};
    for (const v of enfants(enfant(el, "indicateur_co2_dynamique"), "valeur_phase_acv")) {
      phases[v.getAttribute("ref")] = nombre(v, "");
    }
    return phases;
  }

  // Impacts par lot et sous-lot du contributeur « composants » (sortie RSEnv) :
  // { ref_lot: { ic, ic_ded, stock_c, udd, phases, sous_lots: { ref: {…} } } }
  function impactsLots(el) {
    const lots = {};
    for (const lot of enfants(suivre(el, "contributeur/composant"), "lot")) {
      const sousLots = {};
      for (const sl of enfants(lot, "sous_lot")) {
        sousLots[sl.getAttribute("ref")] = Object.assign(feuillesNumeriques(sl), { phases: phasesCO2(sl) });
      }
      lots[lot.getAttribute("ref")] = Object.assign(feuillesNumeriques(lot), { phases: phasesCO2(lot), sous_lots: sousLots });
    }
    return lots;
  }

  // Indicateurs environnementaux (RSEnv/sortie_projet), indexés par index
  // de bâtiment et de zone. Les bâtiments n'y sont pas toujours dans l'ordre.
  // Pour les zones : coefficients de modulation des seuils en plus.
  function indicateursRSEnv(racine) {
    const res = { batiments: {}, zones: {}, coefficients: {}, lots_batiments: {}, lots_zones: {} };
    const sortie = suivre(racine, REGLAGES.blocs.environnement + "/sortie_projet");
    for (const b of enfants(sortie, "batiment")) {
      const ib = texte(b, "index");
      res.batiments[ib] = feuillesNumeriques(enfant(b, "indicateur_perf_env"));
      res.lots_batiments[ib] = impactsLots(b);
      for (const z of enfants(b, "zone")) {
        const iz = texte(z, "index");
        const perf = enfant(z, "indicateur_perf_env");
        res.zones[iz] = feuillesNumeriques(perf);
        res.lots_zones[iz] = impactsLots(z);
        res.coefficients[iz] = {
          ic_construction: feuillesNumeriques(enfant(perf, "coef_mod_icconstruction")),
          ic_energie: feuillesNumeriques(enfant(perf, "coef_mod_icenergie")),
        };
      }
    }
    return res;
  }

  // Groupes décrits dans les entrées du RSET : { index de groupe: { zone, batiment } }
  function groupesEntreeRSET(racine) {
    const res = {};
    const collection = suivre(racine, REGLAGES.blocs.energie + "/Entree_Projet/Batiment_Collection");
    for (const b of enfants(collection, "Batiment")) {
      for (const z of enfants(enfant(b, "Zone_Collection"), "Zone")) {
        for (const g of enfants(enfant(z, "Groupe_Collection"), "Groupe")) {
          res[texte(g, "Index")] = { zone: texte(z, "Index"), batiment: texte(b, "Index") };
        }
      }
    }
    return res;
  }

  // Un enregistrement DH d'un groupe (sortie D), rattaché à une zone et un bâtiment
  function lireGroupeDH(g, batiment, zone, inconfort) {
    const index = texte(g, "Index");
    return {
      index,
      nom: texte(g, "Name") || "Groupe " + index,
      batiment,
      zone,
      sref: nombre(g, "O_SREF"),
      dh: nombre(g, "O_NbDegresHeures"),
      dh_max: nombre(g, "O_NbDegresHeures_max"),
      inconfort: inconfort.has(index),
      // Heures où la température opérative dépasse la température d'inconfort (+0, +1, +2 °C)
      nb_h_inconf: nombre(g, "O_Nb_h_inconf"),
      nb_h_inconf_1: nombre(g, "O_Nb_h_inconf_1"),
      nb_h_inconf_2: nombre(g, "O_Nb_h_inconf_2"),
    };
  }

  // Résultats thermiques du RSET : Bbio (sorties B), Cep et Cep,nr (sorties C)
  // par bâtiment et par zone ; DH par groupe (sorties D).
  // alertes : rattachements de groupes à leur zone incertains ou impossibles.
  function indicateursRSET(racine) {
    const res = { batiments: {}, zones: {}, groupes: [], modulations: {}, alertes: [] };
    const sortie = suivre(racine, REGLAGES.blocs.energie + "/Sortie_Projet");
    const ajouter = (cible, index, valeurs) => {
      cible[index] = Object.assign(cible[index] || {}, valeurs);
    };

    // Champs lus pour chaque type de sortie (balise RSET -> champ du modèle)
    const CHAMPS_B = { bbio: "O_Bbio_pts_annuel", bbio_max: "O_Bbio_Max" };
    const CHAMPS_C = {
      cep: "O_Cep_annuel", cep_max: "O_Cep_Max",
      cep_nr: "O_Cep_nr_annuel", cep_nr_max: "O_Cep_nr_Max",
      cep_occ: "O_Cep_annuel_occ",
      cef: "O_Cef_annuel",
    };
    // Postes de consommation d'énergie finale (sorties C), mobilier compris : { cle: nombre | null }
    const postesCef = (el) => {
      const v = {};
      for (const p of [...REGLAGES.postes_cef, REGLAGES.poste_cef_information]) v[p.cle] = nombre(el, `O_Cef_imp_${p.cle}_annuel`);
      return v;
    };
    const lireChamps = (el, champs) => {
      const v = {};
      for (const [cle, balise] of Object.entries(champs)) v[cle] = nombre(el, balise);
      return v;
    };

    for (const [lettre, champs] of [["B", CHAMPS_B], ["C", CHAMPS_C]]) {
      const batiments = enfants(enfant(sortie, `Sortie_Batiment_${lettre}_Collection`), `Sortie_Batiment_${lettre}`);
      for (const b of batiments) {
        ajouter(res.batiments, texte(b, "Index"), lireChamps(b, champs));
        if (lettre === "C") ajouter(res.batiments, texte(b, "Index"), { cef_postes: postesCef(b) });
        const zones = enfants(enfant(b, `Sortie_Zone_${lettre}_Collection`), `Sortie_Zone_${lettre}`);
        for (const z of zones) {
          const iz = texte(z, "Index");
          ajouter(res.zones, iz, lireChamps(z, champs));
          if (lettre === "C") ajouter(res.zones, iz, { cef_postes: postesCef(z) });
          // Coefficients de modulation et seuils de chaque groupe (O_Mb…, O_Mc…, O_…_Max)
          const modulation = (res.modulations[iz] = res.modulations[iz] || { bbio: [], cep: [] });
          for (const g of enfants(enfant(z, `Sortie_Groupe_${lettre}_Collection`), `Sortie_Groupe_${lettre}`)) {
            modulation[lettre === "B" ? "bbio" : "cep"].push(feuillesNumeriques(g));
          }
        }
      }
    }

    // Groupes listés en inconfort d'été par le RSET (liste à plat, sans la zone)
    const groupesInconfort = enfants(enfant(sortie, "Groupe_Inconf_Collection"), "Sortie_Groupe_D");
    const inconfort = new Set(groupesInconfort.map((g) => texte(g, "Index")));
    const entree = groupesEntreeRSET(racine);

    // DH : un enregistrement par groupe, rattaché à la zone et au bâtiment qui le contiennent
    // dans les sorties D. Un rattachement qui contredit les entrées du RSET est signalé.
    for (const b of enfants(enfant(sortie, "Sortie_Batiment_D_Collection"), "Sortie_Batiment_D")) {
      for (const z of enfants(enfant(b, "Sortie_Zone_D_Collection"), "Sortie_Zone_D")) {
        for (const g of enfants(enfant(z, "Sortie_Groupe_D_Collection"), "Sortie_Groupe_D")) {
          const groupe = lireGroupeDH(g, texte(b, "Index"), texte(z, "Index"), inconfort);
          const attendu = entree[groupe.index];
          if (attendu && attendu.zone !== groupe.zone) {
            res.alertes.push(
              `Groupe ${groupe.index} (${groupe.nom}) : placé dans la zone ${groupe.zone} par les sorties du RSET, ` +
              `mais dans la zone ${attendu.zone} par ses entrées. Rattachement à la zone ${groupe.zone} à vérifier.`
            );
          }
          res.groupes.push(groupe);
        }
      }
    }

    // Groupes en inconfort absents des sorties par zone : rattachés par les entrées du RSET
    const lus = new Set(res.groupes.map((g) => g.index));
    for (const g of groupesInconfort) {
      const index = texte(g, "Index");
      if (lus.has(index)) continue;
      lus.add(index);
      const attendu = entree[index];
      const groupe = lireGroupeDH(g, attendu ? attendu.batiment : null, attendu ? attendu.zone : null, inconfort);
      res.alertes.push(
        attendu
          ? `Groupe ${index} (${groupe.nom}) : absent des sorties par zone du RSET, rattaché à la zone ${attendu.zone} d'après ses entrées. À vérifier.`
          : `Groupe ${index} (${groupe.nom}) : DH lus, mais le groupe n'a pu être rattaché à aucune zone.`
      );
      res.groupes.push(groupe);
    }
    return res;
  }

  /* ---------- RSET seul : bâtiments et zones tirés du RSET ---------- */

  // Une zone décrite dans les entrées du RSET, au format des zones RSEnv
  // (sans composants ni services). Sref et usage : Datas_Comp, sinon RSET.
  function lireZoneRSET(z, admin) {
    const index = texte(z, "Index");
    const info = admin.zones[index] || {};
    const usage = info.usage || texte(z, "Usage");
    const traversant = nombre(z, "Is_Traversant");
    return {
      type: "zone",
      index,
      nom: texte(z, "Name") || "Zone " + index,
      sref: info.sref ?? null,
      usage,
      logement: REGLAGES.usages_logement.includes(usage),
      traversant: traversant === null ? null : traversant === 1,
      n_occ: nombre(z, "Nocc"),
      nb_logement: nombre(z, "NB_logement"),
      nb_composants: 0,
      nb_services: 0,
      refs_lots: [],
      refs_sous_lots: [],
      lignes: [],
      origine: "RSET",
    };
  }

  // Un bâtiment décrit dans les entrées du RSET, avec ses zones
  function lireBatimentRSET(b, admin) {
    const index = texte(b, "Index");
    const zones = enfants(enfant(b, "Zone_Collection"), "Zone").map((z) => lireZoneRSET(z, admin));
    const zonesLogement = zones.filter((z) => z.logement);
    return {
      type: "batiment",
      index,
      nom: texte(b, "Name") || "Bâtiment " + index,
      sref: (admin.batiments[index] || {}).sref ?? null,
      emprise_au_sol: null,
      periode_reference: null,
      duree_chantier: null,
      nb_composants: 0,
      nb_services: 0,
      nb_logement: zonesLogement.length ? zonesLogement.reduce((s, z) => s + (z.nb_logement || 0), 0) : null,
      zones,
      origine: "RSET",
    };
  }

  // Données d'entrée du RSET utiles au lien vers l'outil Seuils, par index de zone
  function parametresSeuils(racine) {
    const res = {};
    const collection = suivre(racine, REGLAGES.blocs.energie + "/Entree_Projet/Batiment_Collection");
    for (const b of enfants(collection, "Batiment")) {
      for (const z of enfants(enfant(b, "Zone_Collection"), "Zone")) {
        const groupes = enfants(enfant(z, "Groupe_Collection"), "Groupe");
        const valeurs = (balise) => groupes.map((g) => nombre(g, balise)).filter((v) => v !== null);
        const bruit = Array.from(z.getElementsByTagName("Exp_BR")).map((e) => Number(e.textContent)).filter(Number.isFinite);
        res[texte(z, "Index")] = {
          categorie: valeurs("Categorie_CE")[0] ?? null,
          climatise: valeurs("Is_Climatise").length ? valeurs("Is_Climatise").some((v) => v === 1) : null,
          reseau_chaleur: valeurs("Is_Reseau_Ch").length ? valeurs("Is_Reseau_Ch").some((v) => v === 1) : null,
          s_combles: valeurs("S_combles").reduce((s, v) => s + v, 0),
          bruit: bruit.length ? Math.max(...bruit) : null,
        };
      }
    }
    return res;
  }

  // Nombre d'ascenseurs décrits dans le RSET, par index de bâtiment
  function ascenseursRSET(racine) {
    const res = {};
    const collection = suivre(racine, REGLAGES.blocs.energie + "/Entree_Projet/Batiment_Collection");
    for (const b of enfants(collection, "Batiment")) {
      res[texte(b, "Index")] = enfants(enfant(b, "Ascenseur_Collection"), "Ascenseur").length;
    }
    return res;
  }

  // Rassemble, pour un bâtiment ou une zone, les indicateurs RSEnv et RSET
  function indicateursDe(rsenv, rset, groupes) {
    return Object.assign({}, rsenv || {}, rset || {}, { groupes_dh: groupes });
  }

  /* ---------- Informations administratives (Datas_Comp) ---------- */

  // Adresse : libellé complet si présent, sinon reconstituée
  function lireAdresse(el) {
    if (!el) return null;
    const libelle = texte(el, "label");
    if (libelle) return libelle;
    const rue = texte(el, "name") || [texte(el, "housenumber"), texte(el, "street")].filter(Boolean).join(" ");
    const ville = [texte(el, "postcode"), texte(el, "city")].filter(Boolean).join(" ");
    return [rue, ville].filter(Boolean).join(", ") || null;
  }

  // Un acteur (maître d'ouvrage, maître d'œuvre, bureau d'études).
  // Le téléphone n'est pas repris : inutile à la lecture de l'étude.
  function lireActeur(el, role) {
    return {
      role,
      ref: el.getAttribute("ref"),
      nom: texte(el, "nom"),
      adresse: lireAdresse(enfant(el, "adresse")),
      siret: texte(el, "SIRET"),
      type: texte(el, "type"),
    };
  }

  // Opération, localisation, acteurs et logiciels (onglet Informations)
  function lireInformations(racine) {
    const generales = suivre(racine, REGLAGES.blocs.administratif + "/donnees_generales");
    const op = enfant(generales, "operation");
    const sortieRSET = suivre(racine, REGLAGES.blocs.energie + "/Sortie_Projet");
    // Altitude : classe du RSET (source retenue par l'observatoire OPEE) ;
    // celle de Datas_Comp n'est qu'un repli et peut être mal saisie
    const altitudeRSET = nombre(suivre(racine, REGLAGES.blocs.energie + "/Entree_Projet/Simu"), "Altitude");
    const altitudeDC = nombre(op, "altitude");
    return {
      operation: {
        nom: texte(op, "nom"),
        description: texte(op, "description"),
        num_permis: texte(op, "num_permis"),
        date_depot_pc: texte(op, "date_depot_PC"),
        date_obtention_pc: texte(op, "date_obtention_PC"),
        date_livraison: texte(op, "date_livraison"),
        avancement: texte(op, "avancement"),
      },
      localisation: {
        adresse: lireAdresse(enfant(op, "adresse")),
        cadastre: texte(op, "cadastre/reference_cadastrale"),
        zone_climatique: texte(op, "zone_climatique"),
        departement: texte(sortieRSET, "Departement"),
        zone_sismique: texte(op, "zone_sismique"),
        altitude: altitudeRSET ?? altitudeDC,
        altitude_datas_comp: altitudeDC,
        geotech: texte(op, "geotech"),
        sol_pollution: texte(op, "sol_pollution"),
      },
      acteurs: [
        ...enfants(generales, "maitre_ouvrage").map((a) => lireActeur(a, "Maître d'ouvrage")),
        ...enfants(generales, "maitre_oeuvre").map((a) => lireActeur(a, "Maître d'œuvre")),
        ...enfants(generales, "BET").map((a) => lireActeur(a, "Bureau d'études")),
      ],
      logiciels: enfants(generales, "logiciel").map((l) => ({
        nom: texte(l, "nom"),
        editeur: texte(l, "editeur"),
        version: texte(l, "version"),
        date_etude: texte(l, "date_etude"),
      })),
    };
  }

  // Données administratives des bâtiments et des zones, indexées par Index
  function informationsBatiments(racine) {
    const res = { batiments: {}, zones: {} };
    const collection = suivre(racine, REGLAGES.blocs.administratif + "/batiment_collection");
    for (const b of enfants(collection, "batiment")) {
      res.batiments[texte(b, "Index")] = {
        usage_principal: texte(b, "usage_principal"),
        type_travaux: texte(b, "type_travaux"),
        n_occ: nombre(b, "n_occ"),
        sref: nombre(b, "O_SREF"),
        shab: nombre(b, "O_SHAB"),
        su: nombre(b, "O_SU"),
        nb_niv_ssol: nombre(b, "nb_niv_ssol"),
        nb_niv_surface: nombre(b, "nb_niv_surface"),
        parking_infra: nombre(b, "nb_place_parking_infra"),
        parking_supra: nombre(b, "nb_place_parking_supra"),
        parking_ext: nombre(b, "nb_place_parking_ext"),
        latitude: nombre(b, "gps/latitude"),
        longitude: nombre(b, "gps/longitude"),
      };
      for (const z of enfants(enfant(b, "zone_collection"), "zone")) {
        res.zones[texte(z, "Index")] = {
          usage: texte(z, "Usage"),
          sref: nombre(z, "O_SREF"),
          shab: nombre(z, "O_SHAB"),
          su: nombre(z, "O_SU"),
        };
      }
    }
    return res;
  }

  /* ---------- Composants et services (RSEnv/entree_projet) ---------- */

  // Une ligne de donnée environnementale (composant ou service)
  function lireLigne(d, position, origine, rang) {
    const config = enfant(d, "donnees_configurateur");
    return Object.assign({}, origine, position, {
      rang, // ordre d'apparition dans le RSEE
      nom: texte(d, "nom"),
      id_fiche: texte(d, "id_fiche"),
      id_produit: texte(d, "id_produit"),
      id_base: texte(d, "id_base"),
      id_fiche_mere: texte(d, "id_fiche_mere"),
      type_donnees: texte(d, "type_donnees"),
      unite_uf: texte(d, "unite_uf"),
      quantite: nombre(d, "quantite"),
      dve: nombre(d, "dve"),
      commentaire: texte(d, "commentaire"),
      parametres: enfants(config, "parametre").map((p) => ({
        nom: texte(p, "nom"), valeur: texte(p, "valeur"), unite: texte(p, "unite"),
      })),
    });
  }

  // Toutes les lignes d'un bloc <contributeur> (zone ou parcelle).
  // Composants : lot / sous-lot ; services : sous-contributeur (ou directs, parcelle).
  function lireLignes(contributeurs, origine) {
    const lignes = [];
    const ajouter = (d, position) => lignes.push(lireLigne(d, position, origine, lignes.length));
    for (const contrib of contributeurs ? contributeurs.children : []) {
      const nom = contrib.tagName; // composant, energie, eau, chantier
      const vide = { contributeur: nom, lot: null, sous_lot: null, sous_contributeur: null };
      if (nom === "composant") {
        for (const d of enfants(contrib, "donnees_composant")) ajouter(d, vide);
        for (const lot of enfants(contrib, "lot")) {
          const refLot = lot.getAttribute("ref");
          for (const d of enfants(lot, "donnees_composant")) ajouter(d, { ...vide, lot: refLot });
          for (const sl of enfants(lot, "sous_lot")) {
            for (const d of enfants(sl, "donnees_composant")) ajouter(d, { ...vide, lot: refLot, sous_lot: sl.getAttribute("ref") });
          }
        }
      } else {
        for (const d of enfants(contrib, "donnees_service")) ajouter(d, vide);
        for (const sc of enfants(contrib, "sous_contributeur")) {
          for (const d of enfants(sc, "donnees_service")) ajouter(d, { ...vide, sous_contributeur: sc.getAttribute("ref") });
        }
      }
    }
    return lignes;
  }

  // Informations générales du projet (nœud racine de l'arborescence)
  function lireProjet(racine, nomFichier) {
    const B = REGLAGES.blocs;
    const generales = suivre(racine, B.administratif + "/donnees_generales");
    const rsenv = enfant(racine, B.environnement);
    const logiciels = enfants(generales, "logiciel")
      .map((l) => [texte(l, "nom"), texte(l, "version")].filter(Boolean).join(" "))
      .filter(Boolean);
    return {
      nom:
        texte(generales, "operation/nom") ||
        texte(racine, B.energie + "/Entree_Projet/Name") ||
        nomFichier,
      num_permis: texte(generales, "operation/num_permis"),
      commune: texte(generales, "operation/adresse/city"),
      date_etude: texte(rsenv, "entree_projet/date_etude"),
      logiciels: Array.from(new Set(logiciels)),
      // null pour un RSET seul
      version_rsenv: rsenv ? rsenv.getAttribute("version") : null,
      phase: rsenv ? rsenv.getAttribute("phase") : null,
      version_datas_comp: enfant(racine, B.administratif)?.getAttribute("version") || null,
      version_rset: texte(racine, B.energie + "/Entree_Projet/Version"),
    };
  }

  // Une zone de l'entrée RSEnv
  function lireZone(z, noms, indexBatiment) {
    const index = texte(z, "index");
    return {
      type: "zone",
      index,
      nom: noms.zones[index] || "Zone " + index,
      sref: nombre(z, "sref"),
      usage: texte(z, "usage"), // code (libellé : js/codes.js)
      logement: REGLAGES.usages_logement.includes(texte(z, "usage")),
      // Zone traversante (RSET) : true, false, ou null si l'information manque
      traversant: noms.traversants[index] === undefined || noms.traversants[index] === null ? null : noms.traversants[index] === 1,
      n_occ: nombre(z, "n_occ"),
      nb_logement: nombre(z, "nb_logement"),
      nb_composants: compter(enfant(z, "contributeur"), "donnees_composant"),
      nb_services: compter(enfant(z, "contributeur"), "donnees_service"),
      refs_lots: Array.from(z.getElementsByTagName("lot")).map((l) => l.getAttribute("ref")),
      refs_sous_lots: Array.from(z.getElementsByTagName("sous_lot")).map((l) => l.getAttribute("ref")),
      lignes: lireLignes(enfant(z, "contributeur"), { batiment: indexBatiment, zone: index, parcelle: null }),
    };
  }

  // Un bâtiment de l'entrée RSEnv, avec ses zones
  function lireBatiment(b, noms) {
    const index = texte(b, "index");
    const zones = enfants(b, "zone").map((z) => lireZone(z, noms, index));
    const zonesLogement = zones.filter((z) => z.logement);
    return {
      type: "batiment",
      index,
      nom: texte(b, "nom") || noms.batiments[index] || "Bâtiment " + index,
      sref: nombre(b, "sref"),
      emprise_au_sol: nombre(b, "emprise_au_sol"),
      periode_reference: nombre(b, "periode_reference"),
      duree_chantier: nombre(b, "duree_chantier"),
      nb_composants: zones.reduce((s, z) => s + z.nb_composants, 0),
      nb_services: zones.reduce((s, z) => s + z.nb_services, 0),
      // Total des zones de logement ; null pour un bâtiment sans logement
      nb_logement: zonesLogement.length ? zonesLogement.reduce((s, z) => s + (z.nb_logement || 0), 0) : null,
      zones,
    };
  }

  // Une parcelle de l'entrée RSEnv
  function lireParcelle(p, rang) {
    const index = String(rang + 1);
    return {
      type: "parcelle",
      index,
      nom: "Parcelle" + (rang > 0 ? " " + (rang + 1) : ""),
      surface_parcelle: nombre(p, "surface_parcelle"),
      surface_arrosee: nombre(p, "surface_arrosee"),
      surface_veg: nombre(p, "surface_veg"),
      surface_imper: nombre(p, "surface_imper"),
      nb_services: compter(enfant(p, "contributeur"), "donnees_service"),
      lignes: lireLignes(enfant(p, "contributeur"), { batiment: null, zone: null, parcelle: index }),
    };
  }

  // Alertes de cohérence (n'empêchent pas la lecture)
  function controlerCoherence(modele, noms) {
    const alertes = [];
    const lotsInconnus = new Set();
    for (const b of modele.batiments) {
      for (const z of b.zones) {
        if (!(z.index in noms.zones)) alertes.push(`Zone ${z.index} absente du RSET (nom par défaut).`);
        for (const r of z.refs_lots) if (!(r in NOMENCLATURE_LOTS)) lotsInconnus.add("lot " + r);
        for (const r of z.refs_sous_lots) {
          const lot = NOMENCLATURE_LOTS[r.split(".")[0]];
          if (!lot || !(r in lot.sous_lots)) lotsInconnus.add("sous-lot " + r);
        }
      }
    }
    if (lotsInconnus.size) {
      alertes.push("Références hors nomenclature RE2020 : " + Array.from(lotsInconnus).join(", ") + ".");
    }
    if (modele.batiments.length === 0) alertes.push("Aucun bâtiment dans la partie environnementale.");
    return alertes;
  }

  // Point d'entrée : texte XML -> { modele } ou { erreur }.
  // Un RSET seul (sans RSEnv) donne le même modèle, bâtiments et zones tirés du RSET,
  // sans composants, services, parcelles ni indicateurs environnementaux (modele.rset_seul).
  function analyser(texteXml, nomFichier) {
    const controle = controler(texteXml);
    if (controle.erreur) return controle;

    const racine = controle.doc.documentElement;
    const rsetSeul = Boolean(controle.rset_seul);
    const entree = suivre(racine, REGLAGES.blocs.environnement + "/entree_projet");
    const noms = nomsRSET(racine);
    const admin = informationsBatiments(racine);
    const batimentsRSET = enfants(suivre(racine, REGLAGES.blocs.energie + "/Entree_Projet/Batiment_Collection"), "Batiment");

    const modele = {
      fichier: nomFichier,
      rset_seul: rsetSeul,
      // Nature du fichier lu : RSEE (RSET + RSEnv), RSET seul ou RSEnv seul
      type_fichier: rsetSeul ? "RSET" : enfant(racine, REGLAGES.blocs.energie) ? "RSEE" : "RSEnv",
      projet: lireProjet(racine, nomFichier),
      informations: lireInformations(racine),
      batiments: rsetSeul
        ? batimentsRSET.map((b) => lireBatimentRSET(b, admin))
        : enfants(entree, "batiment").map((b) => lireBatiment(b, noms)),
      parcelles: enfants(entree, "parcelle").map(lireParcelle),
    };

    // Indicateurs, impacts par lot et données administratives,
    // rattachés aux bâtiments et aux zones par leur index
    const envi = indicateursRSEnv(racine);
    const thermique = indicateursRSET(racine);
    const entreesSeuils = parametresSeuils(racine);
    const ascenseurs = ascenseursRSET(racine);
    const alertesIndicateurs = [];
    for (const b of modele.batiments) {
      b.informations = admin.batiments[b.index] || {};
      b.nb_ascenseurs = ascenseurs[b.index] ?? null;
      b.impacts_lots = envi.lots_batiments[b.index] || {};
      b.indicateurs = indicateursDe(
        envi.batiments[b.index],
        thermique.batiments[b.index],
        thermique.groupes.filter((g) => g.batiment === b.index)
      );
      if (!rsetSeul && !(b.index in envi.batiments)) alertesIndicateurs.push(`Bâtiment ${b.index} : indicateurs environnementaux absents.`);
      if (!(b.index in thermique.batiments)) alertesIndicateurs.push(`Bâtiment ${b.index} : résultats Bbio / Cep absents du RSET.`);
      for (const z of b.zones) {
        z.informations = admin.zones[z.index] || {};
        z.coefficients = envi.coefficients[z.index] || { ic_construction: {}, ic_energie: {} };
        z.modulation = thermique.modulations[z.index] || { bbio: [], cep: [] };
        z.parametres_seuils = entreesSeuils[z.index] || {};
        z.impacts_lots = envi.lots_zones[z.index] || {};
        z.indicateurs = indicateursDe(
          envi.zones[z.index],
          thermique.zones[z.index],
          thermique.groupes.filter((g) => g.zone === z.index)
        );
      }
    }

    // Groupes DH qu'aucune zone affichée ne reçoit (zone absente du modèle)
    const zonesLues = new Set(modele.batiments.flatMap((b) => b.zones.map((z) => z.index)));
    for (const g of thermique.groupes) {
      if (g.zone !== null && !zonesLues.has(g.zone)) {
        alertesIndicateurs.push(`Groupe ${g.index} (${g.nom}) : rattaché à la zone ${g.zone}, absente du fichier ; ses DH ne sont pas affichés.`);
      }
    }

    // RSET seul : la lecture est partielle, et le rattachement des groupes aux zones vient du seul RSET
    const alertesRSET = [];
    if (rsetSeul) {
      alertesRSET.push(
        "RSET seul (pas de partie environnementale RSEnv) : bâtiments et zones lus dans le RSET ; " +
        "Ic, composants, services et parcelle absents."
      );
      if (thermique.groupes.length) {
        const nomZone = (iz) => (iz in noms.zones ? `zone ${iz} (${noms.zones[iz]})` : `zone ${iz}`);
        alertesRSET.push(
          "Groupes DH rattachés aux zones d'après la structure du RSET, à vérifier : " +
          thermique.groupes.map((g) => `groupe ${g.index} (${g.nom}) → ${g.zone === null ? "aucune zone" : nomZone(g.zone)}`).join(" ; ") + "."
        );
      }
    }

    modele.alertes = alertesRSET.concat(controlerCoherence(modele, noms), thermique.alertes, alertesIndicateurs);
    return { modele };
  }

  return { decoder, estZip, controler, analyser };
})();
