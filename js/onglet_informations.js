/* =====================================================================
   lecteur_RSEE — onglet Informations
   Opération, localisation, acteurs, bâtiments, zones et parcelles.
   ===================================================================== */

"use strict";

const OngletInformations = (() => {
  const {
    ESP, UNITE_IC, el, formatNombre, formatCoefficient, creer, creerTableau, section, valeurCodee,
  } = Commun;

  // Liste « libellé : valeur » ; une valeur peut être un texte ou un élément.
  // Les lignes sans valeur sont affichées « non renseigné ».
  function listeInfos(paires) {
    const dl = creer("dl", "infos");
    for (const [libelle, valeur] of paires) {
      dl.append(creer("dt", null, libelle));
      const dd = creer("dd");
      if (valeur instanceof Node) dd.append(valeur);
      else if (valeur === null || valeur === undefined || valeur === "") {
        dd.className = "absent";
        dd.textContent = "non renseigné";
      } else dd.textContent = valeur;
      dl.append(dd);
    }
    return dl;
  }

  function carteInfos(titre, paires, ...suite) {
    const carte = creer("article", "carte carte-infos");
    carte.append(creer("h3", null, titre), listeInfos(paires), ...suite);
    return carte;
  }

  const date = (t) => {
    // Dates ISO « AAAA-MM-JJ » affichées « JJ/MM/AAAA » ; autres formats laissés tels quels
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t || "");
    return m ? `${m[3]}/${m[2]}/${m[1]}` : t || null;
  };
  const nombreOuNull = (n, unite, dec = 0) => (n === null || n === undefined ? null : `${formatNombre(n, dec)}${unite ? ESP + unite : ""}`);

  const formatCoef = (n) => (n === null || n === undefined ? null : formatCoefficient(n));

  // Coefficients de modulation d'une zone et seuil résultant lu dans le RSEE
  function carteCoefficients(zone) {
    const carte = creer("article", "carte carte-infos");
    carte.append(creer("h3", null, "Modulation des seuils Ic"));
    const grille = creer("div", "colonnes-infos");
    for (const [cle, titre, seuil] of [
      ["ic_construction", "Ic construction", "ic_construction_max"],
      ["ic_energie", "Ic énergie", "ic_energie_max"],
    ]) {
      const coefs = zone.coefficients[cle] || {};
      const connues = REGLAGES_SEUILS.ordre_coefficients[cle];
      const paires = connues
        .filter((balise) => balise in coefs)
        .map((balise) => [REGLAGES_SEUILS.libelles_coefficients[balise], formatCoef(coefs[balise])]);
      // Balises inconnues de la table : affichées sous leur nom d'origine
      for (const balise of Object.keys(coefs)) {
        if (!connues.includes(balise)) paires.push([balise, formatCoef(coefs[balise])]);
      }
      paires.push(["Seuil (RSEE)", nombreOuNull(zone.indicateurs[seuil], UNITE_IC, 1)]);
      const bloc = creer("div");
      bloc.append(creer("h4", "sous-titre-infos", titre), listeInfos(paires));
      grille.append(bloc);
    }
    carte.append(grille, creer("p", "note", "Valeurs lues dans le RSEE, sans recalcul du seuil."));
    return carte;
  }

  // Tableau des zones d'un bâtiment (usage, surfaces)
  function tableauZones(batiment) {
    const { enveloppe, tbody } = creerTableau("tableau", ["Zone", "Usage", "Sref", "SHAB", "Occupants"]);
    for (const z of batiment.zones) {
      const tr = creer("tr");
      tr.append(creer("th", null, z.nom));
      const usage = creer("td");
      const v = valeurCodee("usage", z.usage);
      if (v) usage.append(v);
      tr.append(
        usage,
        creer("td", "nombre", nombreOuNull(z.sref, "m²", 1) || "–"),
        creer("td", "nombre", nombreOuNull(z.informations.shab, "m²", 1) || "–"),
        creer("td", "nombre", nombreOuNull(z.n_occ, "") || "–")
      );
      tbody.append(tr);
    }
    return enveloppe;
  }

  function afficherInformations(noeud, parent) {
    const blocs = [];
    switch (noeud.type) {
      case "projet": {
        const inf = Etat.modele.informations;
        const op = inf.operation;
        const loc = inf.localisation;
        blocs.push(
          carteInfos("Opération", [
            ["Nom", op.nom],
            ["Description", op.description && op.description !== op.nom ? op.description : null],
            ["N° de permis de construire", op.num_permis],
            ["Dépôt du PC", date(op.date_depot_pc)],
            ["Obtention du PC", date(op.date_obtention_pc)],
            ["Livraison prévue", date(op.date_livraison)],
            ["Avancement", valeurCodee("avancement", op.avancement)],
            ["Phase (RSEnv)", valeurCodee("phase", Etat.modele.projet.phase)],
            ["Date d'étude (RSEnv)", date(Etat.modele.projet.date_etude)],
          ]),
          carteInfos("Localisation", [
            ["Adresse", loc.adresse],
            ["Référence cadastrale", loc.cadastre],
            ["Zone climatique", loc.zone_climatique],
            ["Département (RSET)", loc.departement],
            ["Zone sismique", loc.zone_sismique],
            ["Altitude déclarée", nombreOuNull(loc.altitude, "m")],
            ["Étude géotechnique", valeurCodee("geotech", loc.geotech)],
            ["Pollution du sol", valeurCodee("sol_pollution", loc.sol_pollution)],
          ])
        );
        // Acteurs : une carte par acteur dans une grille
        const acteurs = creer("div", "grille-acteurs");
        for (const a of inf.acteurs) {
          const titre = a.role + (a.ref && a.role === "Bureau d'études" ? ` (réf. ${a.ref})` : "");
          const carte = creer("div", "acteur");
          carte.append(creer("p", "role", titre), creer("p", "nom-acteur", a.nom || "non renseigné"));
          if (a.adresse) carte.append(creer("p", "detail-acteur", a.adresse));
          if (a.siret) carte.append(creer("p", "detail-acteur", "SIRET " + a.siret));
          acteurs.append(carte);
        }
        const carteActeurs = creer("article", "carte carte-infos");
        carteActeurs.append(creer("h3", null, "Acteurs"), inf.acteurs.length ? acteurs : creer("p", "note", "Aucun acteur renseigné."));
        blocs.push(carteActeurs);

        const logiciels = inf.logiciels.map((l, i) => [
          inf.logiciels.length > 1 ? `Logiciel ${i + 1}` : "Logiciel",
          [l.nom, l.version].filter(Boolean).join(" ") + (l.editeur ? ` — ${l.editeur}` : "") + (l.date_etude ? ` — étude du ${date(l.date_etude)}` : ""),
        ]);
        const p = Etat.modele.projet;
        blocs.push(carteInfos("Logiciels et versions du fichier", [
          ...logiciels,
          ["Version Datas_Comp", p.version_datas_comp],
          ["Version RSET", p.version_rset],
          ["Version RSEnv", p.version_rsenv],
          ["Fichier", Etat.modele.fichier],
        ]));
        break;
      }
      case "batiment": {
        const inf = noeud.informations;
        const gps = inf.latitude !== null && inf.longitude !== null && inf.latitude !== undefined
          ? (() => {
              // Lien vers OpenStreetMap (ouvert seulement si l'utilisateur clique)
              const a = creer("a", null, `${formatNombre(inf.latitude, 5)} ; ${formatNombre(inf.longitude, 5)}`);
              a.href = `https://www.openstreetmap.org/?mlat=${inf.latitude}&mlon=${inf.longitude}#map=17/${inf.latitude}/${inf.longitude}`;
              a.target = "_blank";
              a.rel = "noopener noreferrer";
              return a;
            })()
          : null;
        blocs.push(
          carteInfos(noeud.nom, [
            ["Usage principal", valeurCodee("usage", inf.usage_principal)],
            ["Type de travaux", valeurCodee("type_travaux", inf.type_travaux)],
            ["Sref", nombreOuNull(noeud.sref, "m²", 1)],
            ["SHAB", nombreOuNull(inf.shab, "m²", 1)],
            ["Surface utile (SU)", inf.su ? nombreOuNull(inf.su, "m²", 1) : null],
            ["Occupants", nombreOuNull(inf.n_occ, "")],
            ["Niveaux en sous-sol", nombreOuNull(inf.nb_niv_ssol, "")],
            ["Niveaux hors sol", nombreOuNull(inf.nb_niv_surface, "")],
            ["Places de parking (infra / supra / ext.)",
              [inf.parking_infra, inf.parking_supra, inf.parking_ext].some((v) => v !== null && v !== undefined)
                ? [inf.parking_infra, inf.parking_supra, inf.parking_ext].map((v) => (v === null || v === undefined ? "–" : formatNombre(v))).join(" / ")
                : null],
            ["Emprise au sol (RSEnv)", noeud.emprise_au_sol ? nombreOuNull(noeud.emprise_au_sol, "m²", 1) : null],
            ["Période de référence", nombreOuNull(noeud.periode_reference, "ans")],
            ["Durée du chantier", nombreOuNull(noeud.duree_chantier, "mois")],
            ["Coordonnées GPS", gps],
          ], ...(gps ? [creer("p", "note", "Le lien des coordonnées GPS ouvre OpenStreetMap, un site externe, en lui transmettant ces coordonnées.")] : [])),
          section("Zones du bâtiment", tableauZones(noeud))
        );
        break;
      }
      case "zone": {
        blocs.push(
          carteInfos(noeud.nom, [
            ["Bâtiment", parent ? parent.nom : null],
            ["Usage", valeurCodee("usage", noeud.usage)],
            ["Sref", nombreOuNull(noeud.sref, "m²", 1)],
            ["SHAB", nombreOuNull(noeud.informations.shab, "m²", 1)],
            ["Occupants", nombreOuNull(noeud.n_occ, "")],
            ["Logements", nombreOuNull(noeud.nb_logement, "")],
          ]),
          carteCoefficients(noeud)
        );
        break;
      }
      case "parcelle":
        blocs.push(carteInfos(noeud.nom, [
          ["Surface de la parcelle", nombreOuNull(noeud.surface_parcelle, "m²", 1)],
          ["Surface végétalisée", nombreOuNull(noeud.surface_veg, "m²", 1)],
          ["Surface arrosée", nombreOuNull(noeud.surface_arrosee, "m²", 1)],
          ["Surface imperméabilisée", nombreOuNull(noeud.surface_imper, "m²", 1)],
          ["Données de service", formatNombre(noeud.nb_services)],
        ]));
        break;
    }
    el.detail.replaceChildren(...blocs);
  }

  return { afficher: afficherInformations };
})();
