/* =====================================================================
   lecteur_RSEE — interface : éléments communs aux onglets
   Icônes, mise en forme, description des nœuds, légendes et sections.
   Les textes issus du fichier sont toujours insérés avec textContent
   (jamais en HTML) : un RSEE ne peut pas injecter de code dans la page.
   ===================================================================== */

"use strict";

// Modèle du RSEE ouvert (null tant qu'aucun fichier n'est lu)
const Etat = { modele: null };

const Commun = (() => {
  /* ---------- Icônes (SVG constants, trait = currentColor) ---------- */
  const trace = (d) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

  const ICONES = {
    projet: trace('<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
    batiment: trace('<path d="M4 21V5l8-3v19M12 8l8 3v10M3 21h18M7.5 8h1M7.5 12h1M7.5 16h1M15.5 13h1M15.5 17h1"/>'),
    zone: trace('<path d="M12 3 2 8l10 5 10-5z"/><path d="m2 13 10 5 10-5"/>'),
    parcelle: trace('<path d="M4 20c0-8 6-14 16-16-1 10-7 16-16 16z"/><path d="M4 20 13 11"/>'),
    surface: trace('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9h3M4 14h3M9 4v3M14 4v3"/>'),
    personnes: trace('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6 6 0 0 1 3.5 5.5"/>'),
    logement: trace('<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>'),
    composants: trace('<path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="m3 7 9 5 9-5M12 12v10"/>'),
    services: trace('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
    calendrier: trace('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
    horloge: trace('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    logiciel: trace('<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>'),
    etiquette: trace('<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>'),
    fichier: trace('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>'),
    coche: trace('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
    alerte: trace('<path d="M12 3.5 2.5 20.5h19z"/><path d="M12 10v5M12 18v.01"/>'),
    croix: trace('<path d="m6 6 12 12M18 6 6 18"/>'),
    tiret: trace('<path d="M6 12h12"/>'),
  };

  // Couleur de pastille par type de nœud et pour les tuiles (cycle)
  const FOND_NOEUD = { projet: "fond-corail", batiment: "fond-raisin", zone: "fond-acier", parcelle: "fond-or" };
  const FONDS_TUILES = ["fond-or", "fond-corail", "fond-acier", "fond-raisin", "fond-orchidee"];

  // Espace insécable entre nombre et unité (pas de retour à la ligne entre les deux)
  const ESP = "\u00a0";

  const UNITE_IC = REGLAGES.unite_ic;
  const LIBELLES_STATUT = REGLAGES.libelles_statut;
  const SYMBOLES_STATUT = REGLAGES.symboles_statut;


  /* ---------- Éléments de la page ---------- */
  const el = {
    version: document.getElementById("version"),
    zoneDepot: document.getElementById("zone-depot"),
    texteDepot: document.getElementById("texte-depot"),
    boutonOuvrir: document.getElementById("bouton-ouvrir"),
    selecteur: document.getElementById("selecteur"),
    infoFichier: document.getElementById("info-fichier"),
    message: document.getElementById("message"),
    arbre: document.getElementById("arbre"),
    detail: document.getElementById("detail"),
    titreDetail: document.getElementById("titre-detail"),
    onglets: document.querySelectorAll(".onglet[data-onglet]"),
  };

  /* ---------- Mise en forme ---------- */
  const { nombre: formatNombre, signe: formatSigne, coefficient: formatCoefficient } = Format;

  const formatTaille = (octets) =>
    octets < 1024 * 1024 ? formatNombre(octets / 1024) + " ko" : formatNombre(octets / 1024 / 1024, 1) + " Mo";

  const pluriel = (n, mot) => `${formatNombre(n)} ${mot}${n > 1 ? "s" : ""}`;

  // Valeur numérique avec unité, ou null si absente
  const avecUnite = (n, unite, dec = 0) => (n === null || n === undefined ? null : `${formatNombre(n, dec)} ${unite}`.trim());

  // Création d'un élément avec classe et texte (texte toujours via textContent)
  function creer(balise, classe, texteContenu) {
    const e = document.createElement(balise);
    if (classe) e.className = classe;
    if (texteContenu !== undefined && texteContenu !== null) e.textContent = texteContenu;
    return e;
  }

  // Tableau dans son cadre défilant. colonnes : titre, ou [titre, classe de l'en-tête]
  function creerTableau(classe, colonnes) {
    const table = creer("table", classe);
    const tete = creer("tr");
    for (const colonne of colonnes) {
      const [titre, classeTitre] = [].concat(colonne);
      tete.append(creer("th", classeTitre, titre));
    }
    const thead = creer("thead");
    thead.append(tete);
    const tbody = creer("tbody");
    table.append(thead, tbody);
    const enveloppe = creer("div", "defilement");
    enveloppe.append(table);
    return { enveloppe, table, tbody };
  }

  function pastilleIcone(type) {
    const p = creer("span", "pastille-icone " + FOND_NOEUD[type]);
    p.innerHTML = ICONES[type]; // SVG constant, jamais issu du fichier
    return p;
  }

  function pastilles(textes) {
    const conteneur = creer("span", "pastilles");
    for (const t of textes.filter(Boolean)) conteneur.append(creer("span", "badge", t));
    return conteneur;
  }

  /* ---------- Description des nœuds (titres, badges, tuiles) ---------- */

  // Renvoie { titre, sous_titre, badges, tuiles: [[icone, libellé, valeur]] }
  function decrire(noeud, parent) {
    const S = REGLAGES.decimales_surface;
    switch (noeud.type) {
      case "projet": {
        const p = Etat.modele.projet;
        const nbZones = Etat.modele.batiments.reduce((s, b) => s + b.zones.length, 0);
        const nbComp = Etat.modele.batiments.reduce((s, b) => s + b.nb_composants, 0);
        const nbAlertes = Etat.modele.alertes.length;
        return {
          titre: p.nom,
          sous_titre: [p.commune, p.num_permis && "PC " + p.num_permis].filter(Boolean).join(" · "),
          badges: [
            pluriel(Etat.modele.batiments.length, "bâtiment"),
            pluriel(nbZones, "zone"),
            p.phase && "Phase " + p.phase,
            nbAlertes ? pluriel(nbAlertes, "alerte") : null,
          ],
          tuiles: [
            ["logiciel", "Logiciel", p.logiciels.join(" / ") || null],
            ["calendrier", "Date d'étude", p.date_etude],
            ["etiquette", "Version RSEnv", p.version_rsenv],
            ["etiquette", "Version RSET", p.version_rset],
            ["composants", "Composants (somme des zones)", formatNombre(nbComp)],
            ["fichier", "Fichier", Etat.modele.fichier],
          ],
        };
      }
      case "batiment":
        return {
          titre: noeud.nom,
          sous_titre: "Bâtiment " + noeud.index,
          badges: [pluriel(noeud.zones.length, "zone"), pluriel(noeud.nb_composants, "composant")],
          tuiles: [
            ["surface", "Sref", avecUnite(noeud.sref, "m²", S)],
            ["surface", "Emprise au sol", avecUnite(noeud.emprise_au_sol, "m²", S)],
            ["horloge", "Période de référence", avecUnite(noeud.periode_reference, "ans")],
            ["calendrier", "Durée du chantier", avecUnite(noeud.duree_chantier, "mois")],
            ["composants", "Composants (somme des zones)", formatNombre(noeud.nb_composants)],
            ["services", "Données de service", formatNombre(noeud.nb_services)],
          ],
        };
      case "zone":
        return {
          titre: noeud.nom,
          sous_titre: "Zone " + noeud.index + (parent ? " · " + parent.nom : ""),
          badges: [avecUnite(noeud.sref, "m²", S), pluriel(noeud.nb_composants, "composant")],
          tuiles: [
            ["surface", "Sref", avecUnite(noeud.sref, "m²", S)],
            ["personnes", "Occupants", avecUnite(noeud.n_occ, "")],
            ["logement", "Logements", avecUnite(noeud.nb_logement, "")],
            ["etiquette", "Usage (code RSEE)", noeud.usage],
            ["composants", "Composants", formatNombre(noeud.nb_composants)],
            ["services", "Données de service", formatNombre(noeud.nb_services)],
          ],
        };
      case "parcelle":
        return {
          titre: noeud.nom,
          sous_titre: "Aménagements de la parcelle",
          badges: [avecUnite(noeud.surface_parcelle, "m²", S)],
          tuiles: [
            ["surface", "Surface de la parcelle", avecUnite(noeud.surface_parcelle, "m²", S)],
            ["parcelle", "Surface végétalisée", avecUnite(noeud.surface_veg, "m²", S)],
            ["surface", "Surface arrosée", avecUnite(noeud.surface_arrosee, "m²", S)],
            ["surface", "Surface imperméabilisée", avecUnite(noeud.surface_imper, "m²", S)],
            ["services", "Données de service", formatNombre(noeud.nb_services)],
          ],
        };
    }
    return null;
  }

  // Logo et libellé de chaque niveau d'avertissement (voir CalculsGraphiques.niveauMarge)
  function niveauxMarge(mode) {
    const G = REGLAGES_GRAPHIQUES;
    return {
      conforme: { icone: "coche", libelle: LIBELLES_STATUT[mode].conforme },
      alerte: { icone: "alerte", libelle: `Marge < ${G.marge_alerte}${ESP}%` },
      forte: { icone: "alerte", libelle: `Marge < ${G.marge_alerte_forte}${ESP}%` },
      depasse: { icone: "croix", libelle: LIBELLES_STATUT[mode].depasse },
      absent: { icone: "tiret", libelle: LIBELLES_STATUT[mode].absent },
    };
  }

  function logoNiveau(niveau, def) {
    const logo = creer("span", "logo-marge logo-" + niveau);
    logo.innerHTML = ICONES[def.icone]; // SVG constant, jamais issu du fichier
    return logo;
  }

  function legendeMarges(niveaux) {
    const legende = creer("div", "legende-marges");
    for (const n of ["conforme", "alerte", "forte", "depasse"]) {
      const item = creer("span", "item-marge");
      item.append(logoNiveau(n, niveaux[n]), creer("span", null, niveaux[n].libelle));
      legende.append(item);
    }
    return legende;
  }

  function section(titre, ...contenu) {
    const s = creer("section", "bloc-indicateurs");
    s.append(creer("h3", "titre-bloc", titre), ...contenu);
    return s;
  }

  /* ---------- Valeurs codées ---------- */

  // Libellé d'un code suivi du code en petit ; « code N » seul si le libellé est inconnu.
  // Les libellés « déduits » portent une infobulle rappelant qu'ils sont à valider.
  function valeurCodee(champ, code) {
    if (code === null || code === undefined) return null;
    const span = creer("span", "valeur-codee");
    const libelle = libelleCode(champ, code);
    if (libelle) {
      span.append(document.createTextNode(libelle + " "));
      const statut = CODES_RSEE[champ][code].statut;
      if (statut === "déduit") span.title = "Libellé déduit des fiches, à valider";
    }
    span.append(creer("span", "code", "code " + code));
    return span;
  }

  return {
    ICONES, FONDS_TUILES, ESP, UNITE_IC, LIBELLES_STATUT, SYMBOLES_STATUT, el, formatNombre, formatSigne, formatCoefficient, formatTaille, pluriel, avecUnite, creer, creerTableau, pastilleIcone, pastilles, decrire, niveauxMarge, logoNiveau, legendeMarges, section, valeurCodee,
  };
})();
