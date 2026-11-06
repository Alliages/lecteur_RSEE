/* =====================================================================
   lecteur_RSEE — interface
   Import du fichier (sélection, glisser-déposer), affichage de
   l'arborescence projet / bâtiments / zones / parcelles et du détail
   du nœud sélectionné.
   Les textes issus du fichier sont toujours insérés avec textContent
   (jamais en HTML) : un RSEE ne peut pas injecter de code dans la page.
   ===================================================================== */

"use strict";

(() => {
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

  // Titre du panneau de droite selon l'onglet actif
  const TITRES_ONGLETS = {
    synthese: "Synthèse", informations: "Informations", indicateurs: "Indicateurs", composants: "Composants",
    graphiques: "Graphiques du HUB",
  };

  // Modèle du RSEE ouvert (null tant qu'aucun fichier n'est lu)
  let modeleCourant = null;

  // Sélection courante : onglet actif, nœud et parent affichés
  let ongletActif = "synthese";
  let noeudCourant = null;
  let parentCourant = null;

  // Texte d'information affiché tant qu'aucun fichier n'est lu
  const INFO_INITIALE = el.infoFichier.textContent.trim();

  /* ---------- Mise en forme ---------- */
  const formatNombre = (n, dec = 0) =>
    new Intl.NumberFormat(REGLAGES.langue, { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);

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
        const p = modeleCourant.projet;
        const nbZones = modeleCourant.batiments.reduce((s, b) => s + b.zones.length, 0);
        const nbComp = modeleCourant.batiments.reduce((s, b) => s + b.nb_composants, 0);
        const nbAlertes = modeleCourant.alertes.length;
        return {
          titre: p.nom,
          sous_titre: [p.commune, p.num_permis && "PC " + p.num_permis].filter(Boolean).join(" · "),
          badges: [
            pluriel(modeleCourant.batiments.length, "bâtiment"),
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
            ["fichier", "Fichier", modeleCourant.fichier],
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

  /* ---------- Arborescence ---------- */

  // Carte cliquable représentant un nœud
  function carteNoeud(noeud, parent, petit) {
    const d = decrire(noeud, parent);
    const bouton = creer("button", "noeud" + (petit ? " petit" : ""));
    bouton.type = "button";
    bouton.dataset.type = noeud.type; // repère du type de nœud (projet, batiment, zone, parcelle)
    bouton.append(pastilleIcone(noeud.type));
    const corps = creer("span");
    corps.append(creer("span", "titre", d.titre), creer("span", "sous-titre", d.sous_titre), pastilles(d.badges));
    bouton.append(corps);
    bouton.addEventListener("click", () => selectionner(noeud, parent, bouton));
    return bouton;
  }

  function construireArbre() {
    el.arbre.replaceChildren();
    const racine = { type: "projet" };

    const liProjet = creer("li");
    const boutonProjet = carteNoeud(racine, null, false);
    liProjet.append(boutonProjet);
    el.arbre.append(liProjet);

    for (const b of modeleCourant.batiments) {
      const li = creer("li", "groupe-batiment"); // cadre autour du bâtiment et de ses zones
      li.append(carteNoeud(b, null, false));
      if (b.zones.length) {
        const ul = creer("ul");
        for (const z of b.zones) {
          const liZone = creer("li");
          liZone.append(carteNoeud(z, b, true));
          ul.append(liZone);
        }
        li.append(ul);
      }
      el.arbre.append(li);
    }
    for (const p of modeleCourant.parcelles) {
      const li = creer("li");
      li.append(carteNoeud(p, null, false));
      el.arbre.append(li);
    }
    selectionner(racine, null, boutonProjet);
  }

  function selectionner(noeud, parent, bouton) {
    for (const b of el.arbre.querySelectorAll(".noeud")) b.removeAttribute("aria-current");
    bouton.setAttribute("aria-current", "true");
    noeudCourant = noeud;
    parentCourant = parent;
    afficherVue();
  }

  /* ---------- Onglets ---------- */

  // Affiche le panneau de droite selon l'onglet actif et le nœud sélectionné
  function afficherVue() {
    el.titreDetail.textContent = TITRES_ONGLETS[ongletActif];
    libererGraphiques();
    if (!modeleCourant || !noeudCourant) return afficherVide();
    // Composants, Graphiques : colonne d'arborescence plus étroite pour laisser la place au contenu
    el.detail.closest(".colonnes").classList.toggle("vue-large", ongletActif !== "synthese" && ongletActif !== "informations");
    const vues = {
      synthese: afficherDetail,
      informations: afficherInformations,
      indicateurs: afficherIndicateurs,
      composants: afficherComposants,
      graphiques: afficherGraphiques,
    };
    vues[ongletActif](noeudCourant, parentCourant);
  }

  function changerOnglet(nom) {
    ongletActif = nom;
    for (const o of el.onglets) {
      if (o.dataset.onglet === nom) o.setAttribute("aria-current", "page");
      else o.removeAttribute("aria-current");
    }
    afficherVue();
  }

  /* ---------- Panneau de détail ---------- */

  function afficherDetail(noeud, parent) {
    const d = decrire(noeud, parent);
    const carte = creer("article", "carte");

    const entete = creer("div", "entete-detail");
    entete.append(pastilleIcone(noeud.type), creer("h2", null, d.titre));
    if (d.sous_titre) entete.append(creer("p", "sous-titre", d.sous_titre));
    entete.append(pastilles(d.badges));
    carte.append(entete);

    const grille = creer("div", "tuiles");
    d.tuiles.forEach(([icone, libelle, valeur], i) => {
      const tuile = creer("div", "tuile");
      const carre = creer("span", "carre " + FONDS_TUILES[i % FONDS_TUILES.length]);
      carre.innerHTML = ICONES[icone];
      const texte = creer("span");
      texte.append(
        creer("span", "libelle", libelle),
        creer("span", "valeur" + (valeur ? "" : " absent"), valeur || "non renseigné")
      );
      tuile.append(carre, texte);
      grille.append(tuile);
    });
    carte.append(grille);

    const blocs = [carte];
    const ecarts = carteEcartsSeuils(noeud, parent);
    if (ecarts) blocs.unshift(ecarts);
    if (noeud.type === "projet") blocs.push(carteAlertes());
    el.detail.replaceChildren(...blocs);
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

  // Une ligne : barre partant du seuil (au centre), valeur, logo et niveau
  function ligneEcart(e, borne, niveaux) {
    const niveau = CalculsGraphiques.niveauMarge(e);
    const def = niveaux[niveau];
    const ligne = creer("div", "ligne-ecart niveau-" + niveau);
    ligne.dataset.niveau = niveau;

    const piste = creer("div", "piste-ecart");
    piste.setAttribute("aria-hidden", "true"); // les valeurs sont données en texte à côté
    const position = (pct) => (Math.abs(pct) / borne) * 50; // % de la largeur depuis le centre
    const G = REGLAGES_GRAPHIQUES;
    for (const [classe, marge] of [["bande-alerte", G.marge_alerte], ["bande-forte", G.marge_alerte_forte]]) {
      const bande = creer("span", classe);
      bande.style.left = 50 - position(marge) + "%";
      bande.style.width = position(marge) + "%";
      piste.append(bande);
    }
    if (e.ecart !== null) {
      const barre = creer("span", "barre-ecart");
      barre.style.width = position(e.ecart) + "%";
      barre.style.left = e.ecart < 0 ? 50 - position(e.ecart) + "%" : "50%";
      piste.append(barre);
    }
    piste.append(creer("span", "axe-seuil"));

    const etat = creer("span", "etat-ecart");
    etat.append(logoNiveau(niveau, def), creer("span", null, def.libelle));
    ligne.append(
      creer("span", "nom-ecart", e.libelle), piste,
      creer("span", "valeur-ecart", e.ecart === null ? "–" : `${formatSigne(e.ecart, 1)}${ESP}%`), etat
    );
    return ligne;
  }

  // Graphique horizontal d'écart aux seuils, en tête de la Synthèse.
  // Bâtiment ou zone : 6 lignes ; projet : 6 lignes par bâtiment. Rien pour la parcelle.
  function carteEcartsSeuils(noeud, parent) {
    if (noeud.type === "parcelle") return null;
    const sources = noeud.type === "projet" ? modeleCourant.batiments : [noeud];
    const groupes = sources.map((s) => ({ nom: s.nom, ecarts: CalculsGraphiques.ecartsSeuils(s.indicateurs) }));
    const valeurs = groupes.flatMap((g) => g.ecarts).map((e) => e.ecart).filter((v) => v !== null);
    if (valeurs.length === 0) return null;
    // Échelle commune à toutes les lignes, symétrique autour du seuil
    const borne = Math.max(2 * REGLAGES_GRAPHIQUES.marge_alerte, ...valeurs.map(Math.abs)) * 1.05;
    const niveaux = niveauxMarge(noeud.type === "zone" ? "information" : "reglementaire");

    const carte = creer("article", "carte carte-ecarts");
    carte.append(creer("h3", null, "Écart aux seuils réglementaires"), legendeMarges(niveaux));

    const reperes = creer("div", "reperes-ecart");
    reperes.setAttribute("aria-hidden", "true");
    reperes.append(creer("span", null, "← sous le seuil"), creer("span", null, "au-dessus →"));
    for (const g of groupes) {
      if (groupes.length > 1) carte.append(creer("h4", "sous-titre-infos", g.nom));
      carte.append(reperes.cloneNode(true));
      for (const e of g.ecarts) carte.append(ligneEcart(e, borne, niveaux));
    }
    const note = "Écart = (valeur − seuil) / seuil, seuils lus dans le RSEE. DH : groupe le plus défavorable.";
    carte.append(creer("p", "note", noeud.type === "zone"
      ? note + ` Valeurs de zone pour information : les exigences Ic, Bbio et Cep s'appliquent au bâtiment${parent ? " « " + parent.nom + " »" : ""}.`
      : note));
    return carte;
  }

  // Contrôles de cohérence relevés à la lecture
  function carteAlertes() {
    const carte = creer("article", "carte");
    carte.append(creer("h3", null, "Contrôle du fichier"));
    if (modeleCourant.alertes.length === 0) {
      carte.append(creer("p", "ok", "Structure conforme : aucune alerte."));
    } else {
      const ul = creer("ul", "liste-alertes");
      for (const a of modeleCourant.alertes) ul.append(creer("li", null, a));
      carte.append(ul);
    }
    return carte;
  }

  // État initial : aucun fichier ouvert (l'arborescence est vidée)
  function afficherVide() {
    el.arbre.replaceChildren();
    noeudCourant = null;
    parentCourant = null;
    const carte = creer("article", "carte vide");
    const p = creer("span", "pastille-icone fond-or");
    p.innerHTML = ICONES.fichier;
    carte.append(
      p,
      creer("h2", null, "Aucun RSEE ouvert"),
      creer("p", null, "Ouvrez ou glissez un fichier RSEE (.xml) pour afficher son arborescence.")
    );
    el.detail.replaceChildren(carte);
  }

  /* ---------- Onglet Indicateurs ---------- */

  // Libellés des statuts : verdict réglementaire (bâtiment, groupe DH)
  // ou simple comparaison au seuil (zone, donnée pour information)
  const LIBELLES_STATUT = {
    reglementaire: { conforme: "Conforme", depasse: "Non conforme", absent: "Non renseigné" },
    information: { conforme: "Sous le seuil", depasse: "Au-dessus du seuil", absent: "Non renseigné" },
  };
  const SYMBOLES_STATUT = { conforme: "✓", depasse: "✕", absent: "–" };

  // Espace insécable entre nombre et unité (pas de retour à la ligne entre les deux)
  const ESP = "\u00a0";

  const formatSigne = (n, dec) =>
    new Intl.NumberFormat(REGLAGES.langue, {
      minimumFractionDigits: dec, maximumFractionDigits: dec, signDisplay: "exceptZero",
    }).format(n);

  // Valeur d'indicateur formatée (avec unité), ou null si absente
  function valeurIndicateur(n, def) {
    if (n === null || n === undefined) return null;
    return def.pourcentage ? `${formatNombre(n * 100, def.decimales)}${ESP}%` : `${formatNombre(n, def.decimales)}${ESP}${def.unite}`;
  }

  function pastilleStatut(statut, mode) {
    const p = creer("span", "statut statut-" + statut);
    p.append(creer("span", "symbole", SYMBOLES_STATUT[statut]), document.createTextNode(LIBELLES_STATUT[mode][statut]));
    return p;
  }

  // Niveau de risque d'une exigence évaluée (mêmes règles que la Synthèse)
  function niveauExigence(ev) {
    const calculable = ev.valeur !== null && ev.seuil !== null && ev.seuil !== 0;
    return CalculsGraphiques.niveauMarge({
      ecart: calculable ? ((ev.valeur - ev.seuil) / ev.seuil) * 100 : null, statut: ev.statut,
    });
  }

  // Avertissement d'une marge faible (rien si la marge est suffisante ou le seuil dépassé)
  function badgeRisque(niveau, mode) {
    if (niveau !== "alerte" && niveau !== "forte") return null;
    const def = niveauxMarge(mode)[niveau];
    const badge = creer("p", "risque-exigence");
    badge.append(logoNiveau(niveau, def), creer("span", null, def.libelle));
    return badge;
  }

  // Jauge : barre de la valeur et repère du seuil (échelle commune aux deux)
  function jauge(valeur, seuil, niveau) {
    const j = creer("div", "jauge");
    j.setAttribute("aria-hidden", "true"); // les valeurs sont données en texte à côté
    if (valeur === null || seuil === null || seuil <= 0) return j;
    const echelle = Math.max(valeur, seuil) * 1.15;
    const barre = creer("div", "remplissage remplissage-" + niveau);
    barre.style.width = Math.max(0, (valeur / echelle) * 100) + "%";
    const repere = creer("div", "repere-seuil");
    repere.style.left = (seuil / echelle) * 100 + "%";
    j.append(barre, repere);
    return j;
  }

  // Texte d'écart : marge sous le seuil ou dépassement
  function texteEcart(ev) {
    const d = ev.def.decimales;
    if (ev.statut === "absent" || !ev.ecart || ev.ecart.absolu === null) return null;
    const pct = ev.ecart.relatif === null ? "" : ` (${formatSigne(ev.ecart.relatif * 100, 1)}${ESP}%)`;
    if (ev.statut === "depasse") return `Dépassement${ESP}: ${formatSigne(ev.ecart.absolu, d)}${ESP}${ev.def.unite}${pct}`;
    return `Marge${ESP}: ${formatNombre(-ev.ecart.absolu, d)}${ESP}${ev.def.unite} sous le seuil${pct}`;
  }

  // Carte d'une exigence réglementaire (Ic, Bbio, Cep, Cep,nr ou DH)
  function carteExigence(ev, mode) {
    const niveau = niveauExigence(ev);
    const carte = creer("article", "exigence niveau-" + niveau);
    carte.dataset.niveau = niveau;
    const tete = creer("div", "tete-exigence");
    const titre = creer("h4", null, ev.def.libelle);
    titre.append(creer("span", "source", ev.def.source));
    tete.append(titre);

    if (ev.def.groupes) {
      // DH : verdict par groupe (exigence réglementaire au niveau du groupe)
      tete.append(pastilleStatut(ev.statut, "reglementaire"));
      carte.append(tete);
      const risqueDH = badgeRisque(niveau, mode);
      if (risqueDH) carte.append(risqueDH);
      if (ev.groupes.length === 0) {
        carte.append(creer("p", "note", "Aucun groupe renseigné dans le RSET."));
        return carte;
      }
      const liste = creer("ul", "groupes-dh");
      for (const g of ev.groupes) {
        const li = creer("li");
        const ligne = creer("div", "ligne-groupe");
        ligne.append(
          creer("span", "nom-groupe", g.nom),
          creer("span", "valeur-groupe",
            `${g.dh === null ? "–" : formatNombre(g.dh)} / ${g.dh_max === null ? "–" : formatNombre(g.dh_max)}${ESP}${ev.def.unite}`),
          pastilleStatut(g.statut, "reglementaire")
        );
        li.append(ligne, jauge(g.dh, g.dh_max, niveauExigence({ valeur: g.dh, seuil: g.dh_max, statut: g.statut })));
        if (g.inconfort) li.append(creer("span", "badge badge-alerte", "Inconfort d'été signalé par le RSET"));
        liste.append(li);
      }
      carte.append(liste);
      return carte;
    }

    tete.append(pastilleStatut(ev.statut, mode));
    carte.append(tete);
    const risque = badgeRisque(niveau, mode);
    if (risque) carte.append(risque);

    const chiffres = creer("div", "chiffres");
    const valeur = creer("span", "valeur-exigence", ev.valeur === null ? "non renseigné" : formatNombre(ev.valeur, ev.def.decimales));
    chiffres.append(valeur, creer("span", "unite", ev.def.unite));
    carte.append(chiffres);
    carte.append(creer("p", "seuil-texte",
      "Seuil" + ESP + ": " + (ev.seuil === null ? "non renseigné" : `${formatNombre(ev.seuil, ev.def.decimales)}${ESP}${ev.def.unite}`)));
    carte.append(jauge(ev.valeur, ev.seuil, niveau));

    const ecartTexte = texteEcart(ev);
    if (ecartTexte) carte.append(creer("p", "ecart ecart-" + ev.statut, ecartTexte));
    if (ev.par_occupant !== null && ev.par_occupant !== undefined) {
      carte.append(creer("p", "note", `Par occupant${ESP}: ${formatNombre(ev.par_occupant)}${ESP}${INDICATEURS.unite_occupant}`));
    }
    if (ev.jalons && ev.jalons.length) {
      const texte = ev.jalons.map((j) => `${j.annee} : ${formatNombre(j.seuil, ev.def.decimales)}`).join(" · ");
      carte.append(creer("p", "note", "Seuils à venir — " + texte));
    }
    return carte;
  }

  // Bandeau de synthèse : nombre d'exigences respectées / non respectées
  function bandeauVerdict(evaluations, titre, mode) {
    const depassees = evaluations.filter((e) => e.statut === "depasse");
    const absentes = evaluations.filter((e) => e.statut === "absent");
    const bandeau = creer("div", "verdict verdict-" + (depassees.length ? "depasse" : "conforme"));
    const symbole = creer("span", "verdict-symbole", depassees.length ? "✕" : "✓");
    const corps = creer("div");
    corps.append(creer("p", "verdict-titre", titre));
    let message;
    if (depassees.length) {
      const mot = mode === "reglementaire" ? "non respectée" : "au-dessus du seuil";
      message = `${pluriel(depassees.length, "exigence")} ${mot}${depassees.length > 1 && mode === "reglementaire" ? "s" : ""} : ` +
        depassees.map((e) => e.def.libelle).join(", ");
    } else {
      message = mode === "reglementaire"
        ? `Toutes les exigences renseignées sont respectées (${evaluations.length - absentes.length} sur ${evaluations.length}).`
        : "Toutes les valeurs renseignées sont sous leur seuil.";
    }
    if (absentes.length) message += ` — non renseigné : ${absentes.map((e) => e.def.libelle).join(", ")}`;
    corps.append(creer("p", "verdict-message", message));
    bandeau.append(symbole, corps);
    return bandeau;
  }

  /* ---------- Composition de l'Ic ---------- */

  const UNITE_IC = "kg éq. CO₂/m²";

  // Clé et libellé d'un indicateur, selon qu'on regarde un bâtiment ou une zone
  const cleIc = (def, estZone) => (estZone && def.zone ? def.zone : def.valeur);
  const libelleIc = (def, estZone) => (estZone && def.libelle_zone ? def.libelle_zone : def.libelle);

  // Une boîte de la somme : libellé, valeur, valeur par occupant, seuil éventuel
  function boiteIc(def, ind, estZone, classe) {
    const cle = cleIc(def, estZone);
    const valeur = ind[cle] ?? null;
    const boite = creer("div", "boite-ic " + classe);
    boite.dataset.indicateur = cle;
    boite.append(
      creer("span", "libelle-ic", libelleIc(def, estZone)),
      creer("span", "valeur-ic", valeur === null ? "–" : formatNombre(valeur, 1))
    );
    const occupant = ind[(estZone && def.occupant_zone) || def.occupant];
    if (occupant !== null && occupant !== undefined) {
      boite.append(creer("span", "occupant-ic", `${formatNombre(occupant)}${ESP}${INDICATEURS.unite_occupant}`));
    }
    const seuil = def.seuil ? ind[def.seuil] ?? null : null;
    if (seuil !== null) {
      boite.classList.add("avec-seuil");
      boite.append(creer("span", "seuil-ic", `seuil ${formatNombre(seuil, 1)}`));
    }
    return boite;
  }

  // Sommes qui ne tombent pas juste (arrondis exclus), pour le signaler sous le schéma
  function ecartsComposition(ind, estZone) {
    const ecarts = [];
    let cumul = 0;
    for (const groupe of INDICATEURS.composition) {
      const cle = cleIc(groupe.total, estZone);
      if (!(cle in ind) || ind[cle] === null) continue;
      cumul += groupe.termes.reduce((s, t) => s + (ind[t.valeur] ?? 0), 0);
      if (Math.abs(cumul - ind[cle]) > Math.max(0.5, Math.abs(ind[cle]) * 0.002)) {
        ecarts.push(`${libelleIc(groupe.total, estZone)} (somme des termes : ${formatNombre(cumul, 1)})`);
      }
      cumul = ind[cle];
    }
    return ecarts;
  }

  // Somme de l'Ic par blocs : chaque total s'ajoute au bloc suivant ; autres indicateurs à part
  function composition(ind, estZone) {
    const schema = creer("div", "composition");
    for (const groupe of INDICATEURS.composition) {
      const termes = groupe.termes.filter((t) => t.valeur in ind);
      const avecTotal = cleIc(groupe.total, estZone) in ind;
      if (termes.length === 0 && !avecTotal) continue;
      if (schema.children.length) schema.append(creer("span", "plus-bloc", "+"));
      const bloc = creer("section", "bloc-ic bloc-" + groupe.cle);
      bloc.append(creer("h4", "titre-ic", groupe.titre));
      const pile = creer("div", "pile-ic");
      termes.forEach((t, i) => {
        if (i > 0) pile.append(creer("span", "signe-ic", "+"));
        pile.append(boiteIc(t, ind, estZone, "terme-ic"));
      });
      bloc.append(pile);
      if (avecTotal) bloc.append(creer("span", "signe-ic", "="), boiteIc(groupe.total, ind, estZone, "total-ic"));
      schema.append(bloc);
    }

    const autres = creer("section", "bloc-ic bloc-autres");
    autres.append(creer("h4", "titre-ic", "Autres indicateurs"));
    const liste = creer("div", "pile-ic");
    for (const champ of INDICATEURS.composition_autres) {
      const def = INDICATEURS.pedagogiques.find((d) => d.valeur === champ);
      const cle = cleIc(def, estZone);
      if (!(cle in ind)) continue;
      const boite = creer("div", "boite-ic terme-ic");
      boite.dataset.indicateur = cle;
      boite.append(
        creer("span", "libelle-ic", libelleIc(def, estZone)),
        creer("span", "valeur-ic valeur-autre", valeurIndicateur(ind[cle], def) || "–")
      );
      liste.append(boite);
    }
    autres.append(liste);
    schema.append(autres);

    const enveloppe = creer("div");
    enveloppe.append(schema);
    const ecarts = ecartsComposition(ind, estZone);
    if (ecarts.length) enveloppe.append(creer("p", "note", "Valeurs du RSEE dont la somme ne tombe pas juste : " + ecarts.join(", ") + "."));
    return enveloppe;
  }

  const NOTE_COMPOSITION = `Valeurs en ${UNITE_IC}, lues dans le RSEE. Chaque total s'ajoute au bloc suivant : Ic construction + Ic eau + Ic énergie = Ic bâtiment, puis + Ic parcelle = Ic projet.`;

  /* ---------- Calcul des seuils ---------- */

  function termeCalcul(valeur, libelle, classe) {
    const t = creer("span", "terme-calcul " + (classe || ""));
    t.append(creer("span", "valeur-terme", valeur), creer("span", "nom-terme", libelle));
    return t;
  }

  // Une ligne : moyen × (1 + coefficients) + termes ajoutés = seuil
  function ligneCalcul(eq) {
    const ligne = creer("div", "ligne-calcul");
    ligne.dataset.cle = eq.cle;
    ligne.append(creer("span", "nom-calcul", eq.libelle));
    const formule = creer("div", "formule");
    const signe = (texte) => creer("span", "signe-calcul", texte);
    if (eq.moyen === null) {
      formule.append(creer("span", "note", "lu dans le RSEE, sans détail"));
    } else {
      formule.append(termeCalcul(formatNombre(eq.moyen) + (eq.deduit ? "*" : ""), "moyen"));
      if (eq.produit.length) {
        formule.append(signe("× (1"));
        for (const t of eq.produit) formule.append(termeCalcul(formatSigne(t.valeur, 3), t.libelle));
        formule.append(signe(")"));
      }
      for (const t of eq.ajout) formule.append(termeCalcul(formatSigne(t.valeur, 1), t.libelle));
    }
    formule.append(signe("="), termeCalcul(eq.seuil === null ? "–" : formatNombre(eq.seuil, 1), eq.unite, "resultat-calcul"));
    ligne.append(formule);
    if (!eq.concordant) {
      ligne.append(creer("p", "ecart-calcul",
        `Le calcul donne ${formatNombre(eq.calcule, 1)}, soit ${formatSigne(eq.ecart * 100, 1)}${ESP}% par rapport au seuil du RSEE.`));
    }
    return ligne;
  }

  function calculZone(zone, batiment, titre, ouvert) {
    const details = creer("details", "calcul-zone");
    details.open = ouvert;
    const resume = creer("summary");
    resume.append(creer("span", "titre-calcul", titre));
    if (zone.sref !== null) resume.append(creer("span", "sref-calcul", `Sref ${formatNombre(zone.sref, 1)}${ESP}m²`));
    details.append(resume);
    for (const eq of CalculSeuils.equations(zone)) details.append(ligneCalcul(eq));
    const dh = CalculSeuils.seuilsDH(zone);
    if (dh.length) {
      const ligne = creer("div", "ligne-calcul");
      ligne.dataset.cle = "dh";
      const formule = creer("div", "formule");
      formule.append(termeCalcul(dh.map((v) => formatNombre(v)).join(" / "), "°C.h", "resultat-calcul"), creer("span", "note", "par groupe, lu dans le RSEE"));
      ligne.append(creer("span", "nom-calcul", "DH max"), formule);
      details.append(ligne);
    }
    const lien = creer("a", "lien-outil", "Recalculer dans l'outil Seuils RE2020 ↗");
    lien.href = CalculSeuils.lienOutil(zone, batiment, modeleCourant.informations);
    lien.target = "_blank";
    lien.rel = "noopener noreferrer";
    details.append(lien);
    return details;
  }

  // Calcul des seuils de chaque zone du nœud. entrees : [{ zone, batiment, titre }]
  function calculSeuils(entrees, replie, plusieursZones) {
    const bloc = creer("div", "carte carte-calcul");
    entrees.forEach((e, i) => bloc.append(calculZone(e.zone, e.batiment, e.titre, !replie || i === 0)));
    const notes = [
      "Coefficients lus dans le RSEE, coefficients nuls non affichés. Le seuil affiché est celui du RSEE.",
      "* Valeur moyenne absente du RSEE, déduite du seuil et de ses coefficients.",
    ];
    if (plusieursZones) notes.push("Bâtiment à plusieurs zones : ses seuils sont la moyenne des seuils des zones, pondérée par la Sref.");
    notes.push("Le lien ouvre un site externe non officiel en lui transmettant usage, département, altitude, surfaces et impacts, sans nom ni adresse. La hauteur sous plafond, l'agrément extérieur et l'inertie ne sont pas transmis : à vérifier dans l'outil. Il porte sur le bâtiment entier si ses zones ont le même usage, sinon sur la zone.");
    for (const n of notes) bloc.append(creer("p", "note", n));
    return bloc;
  }

  /* ---------- Risques ---------- */

  // Écarts à surveiller, du plus risqué au moins risqué. sources : [{ nom, indicateurs }]
  function risques(sources) {
    return sources
      .flatMap((s) => CalculsGraphiques.ecartsSeuils(s.indicateurs).map((e) => ({ ...e, source: s.nom, niveau: CalculsGraphiques.niveauMarge(e) })))
      .filter((e) => ["alerte", "forte", "depasse"].includes(e.niveau))
      .sort((a, b) => b.ecart - a.ecart);
  }

  function listeRisques(liste, avecSource, mode) {
    if (liste.length === 0) {
      return creer("p", "ok", `Aucune marge inférieure à ${REGLAGES_GRAPHIQUES.marge_alerte}${ESP}% : pas de risque relevé.`);
    }
    const niveaux = niveauxMarge(mode);
    const ul = creer("ul", "liste-risques");
    for (const e of liste) {
      const li = creer("li", "risque niveau-" + e.niveau);
      li.dataset.niveau = e.niveau;
      const nom = creer("span", "nom-risque", e.libelle);
      if (avecSource) nom.append(creer("span", "source-risque", e.source));
      const absolu = formatNombre(Math.abs(e.valeur - e.seuil), e.decimales);
      const texte = e.niveau === "depasse"
        ? `Dépassement de ${formatNombre(e.ecart, 1)}${ESP}%, soit ${absolu}${ESP}${e.unite} au-dessus du seuil`
        : `Marge de ${formatNombre(-e.ecart, 1)}${ESP}%, soit ${absolu}${ESP}${e.unite} sous le seuil`;
      li.append(logoNiveau(e.niveau, niveaux[e.niveau]), nom, creer("span", "texte-risque", texte));
      ul.append(li);
    }
    return ul;
  }

  // Ajoute les marges faibles au bandeau ; sans dépassement, il passe en avertissement
  function ajouterRisques(bandeau, liste) {
    const G = REGLAGES_GRAPHIQUES;
    const compte = (niveau) => liste.filter((e) => e.niveau === niveau).length;
    const forte = compte("forte");
    const alerte = compte("alerte");
    const textes = [
      forte ? `${pluriel(forte, "marge")} sous ${G.marge_alerte_forte}${ESP}%` : null,
      alerte ? `${pluriel(alerte, "marge")} entre ${G.marge_alerte_forte} et ${G.marge_alerte}${ESP}%` : null,
    ].filter(Boolean);
    if (textes.length === 0) return bandeau;
    bandeau.querySelector(".verdict-message").after(creer("p", "verdict-risque", "Risque : " + textes.join(", ") + "."));
    if (!bandeau.classList.contains("verdict-depasse")) {
      bandeau.classList.add(forte ? "verdict-forte" : "verdict-alerte");
      bandeau.querySelector(".verdict-symbole").textContent = "!";
    }
    return bandeau;
  }

  function section(titre, ...contenu) {
    const s = creer("section", "bloc-indicateurs");
    s.append(creer("h3", "titre-bloc", titre), ...contenu);
    return s;
  }

  function grilleExigences(evaluations, mode) {
    const g = creer("div", "exigences");
    for (const ev of evaluations) g.append(carteExigence(ev, mode));
    return g;
  }

  // Tableau des écarts du projet : une ligne par bâtiment, une colonne par exigence
  function tableauProjet() {
    const niveaux = niveauxMarge("reglementaire");
    const enveloppe = creer("div", "defilement");
    const table = creer("table", "synthese");
    const tete = creer("tr");
    tete.append(creer("th", null, "Bâtiment"));
    for (const e of REGLAGES_GRAPHIQUES.ecarts) tete.append(creer("th", null, e.libelle));
    const thead = creer("thead");
    thead.append(tete);
    const tbody = creer("tbody");
    for (const b of modeleCourant.batiments) {
      const tr = creer("tr");
      tr.append(creer("th", null, b.nom));
      for (const e of CalculsGraphiques.ecartsSeuils(b.indicateurs)) {
        const niveau = CalculsGraphiques.niveauMarge(e);
        const td = creer("td", "cellule-ecart niveau-" + niveau);
        td.dataset.niveau = niveau;
        // Écart sur la première ligne, valeur et seuil en dessous (colonnes étroites)
        const chiffres = creer("span", "chiffres-cellule");
        chiffres.append(
          creer("span", "valeur-cellule", e.ecart === null ? "–" : `${formatSigne(e.ecart, 1)}${ESP}%`),
          creer("span", "seuil-cellule", e.valeur === null || e.seuil === null ? "" :
            `${formatNombre(e.valeur, e.decimales)} / ${formatNombre(e.seuil, e.decimales)}`)
        );
        td.append(logoNiveau(niveau, niveaux[niveau]), chiffres);
        td.title = `${e.libelle} : ${niveaux[niveau].libelle}`;
        tr.append(td);
      }
      tbody.append(tr);
    }
    table.append(thead, tbody);
    enveloppe.append(table);
    return enveloppe;
  }

  function afficherIndicateurs(noeud, parent) {
    const blocs = [];
    const avecPlusieursZones = (batiments) => batiments.some((b) => b.zones.length > 1);
    switch (noeud.type) {
      case "projet": {
        const batiments = modeleCourant.batiments;
        const toutes = batiments.flatMap((b) => EvaluationIndicateurs.evaluerTout(b.indicateurs));
        const nbBat = batiments.length;
        const nonConformes = batiments.filter((b) =>
          EvaluationIndicateurs.evaluerTout(b.indicateurs).some((e) => e.statut === "depasse")
        );
        const liste = risques(batiments);
        const bandeau = bandeauVerdict(toutes, modeleCourant.projet.nom, "reglementaire");
        // Message propre au projet : nombre de bâtiments concernés
        bandeau.querySelector(".verdict-message").textContent = nonConformes.length
          ? `${pluriel(nonConformes.length, "bâtiment")} sur ${nbBat} avec au moins une exigence non respectée : ` +
            nonConformes.map((b) => b.nom).join(", ")
          : `${nbBat > 1 ? "Les " + nbBat + " bâtiments respectent" : "Le bâtiment respecte"} toutes les exigences renseignées.`;
        const entrees = batiments.flatMap((b) => b.zones.map((z) => ({ zone: z, batiment: b, titre: b.zones.length > 1 ? `${b.nom} — ${z.nom}` : b.nom })));
        const compositions = batiments.map((b, i) => {
          if (nbBat === 1) return composition(b.indicateurs, false);
          const details = creer("details", "composition-batiment");
          details.open = i === 0;
          details.append(creer("summary", null, b.nom), composition(b.indicateurs, false));
          return details;
        });
        blocs.push(
          ajouterRisques(bandeau, liste),
          section("Calcul des seuils", calculSeuils(entrees, entrees.length > 1, avecPlusieursZones(batiments))),
          section("Écarts aux seuils", legendeMarges(niveauxMarge("reglementaire")), tableauProjet(),
            creer("p", "note", "Écart = (valeur − seuil) / seuil ; valeur / seuil en dessous. DH : groupe le plus proche de son seuil. Détail en sélectionnant un bâtiment. Unités : Ic en kg éq. CO₂/m², Bbio en points, Cep et Cep,nr en kWhep/m²/an, DH en °C.h.")),
          section("Risques", listeRisques(liste, nbBat > 1, "reglementaire")),
          section("Composition de l'Ic", ...compositions, creer("p", "note", NOTE_COMPOSITION))
        );
        break;
      }
      case "batiment": {
        const evaluations = EvaluationIndicateurs.evaluerTout(noeud.indicateurs);
        const liste = risques([noeud]);
        const entrees = noeud.zones.map((z) => ({ zone: z, batiment: noeud, titre: z.nom }));
        blocs.push(
          ajouterRisques(bandeauVerdict(evaluations, noeud.nom, "reglementaire"), liste),
          section("Calcul des seuils", calculSeuils(entrees, false, noeud.zones.length > 1)),
          section("Risques", listeRisques(liste, false, "reglementaire")),
          section("Exigences réglementaires", grilleExigences(evaluations, "reglementaire")),
          section("Composition de l'Ic", composition(noeud.indicateurs, false), creer("p", "note", NOTE_COMPOSITION))
        );
        break;
      }
      case "zone": {
        const evaluations = EvaluationIndicateurs.evaluerTout(noeud.indicateurs);
        const liste = risques([noeud]);
        blocs.push(
          ajouterRisques(bandeauVerdict(evaluations, noeud.nom, "information"), liste),
          creer("p", "note note-encadree",
            "Les exigences Ic, Bbio et Cep s'appliquent au bâtiment" + (parent ? " « " + parent.nom + " »" : "") +
            " : les valeurs de zone sont données pour information. L'exigence DH s'applique à chaque groupe."),
          section("Calcul des seuils", calculSeuils([{ zone: noeud, batiment: parent, titre: noeud.nom }], false, false)),
          section("Risques", listeRisques(liste, false, "information")),
          section("Valeurs de la zone", grilleExigences(evaluations, "information")),
          section("Composition de l'Ic", composition(noeud.indicateurs, true), creer("p", "note", NOTE_COMPOSITION))
        );
        break;
      }
      case "parcelle": {
        const grille = creer("div", "pedagogiques");
        const defIc = INDICATEURS.pedagogiques.find((d) => d.valeur === "ic_parcelle");
        const defStock = INDICATEURS.pedagogiques.find((d) => d.valeur === "stock_c_parcelle");
        for (const b of modeleCourant.batiments) {
          for (const def of [defIc, defStock]) {
            const carte = creer("div", "indicateur");
            carte.append(creer("span", "libelle", `${def.libelle} — ${b.nom}`));
            const v = valeurIndicateur(b.indicateurs[def.valeur], def);
            carte.append(creer("span", "valeur" + (v ? "" : " absent"), v || "non renseigné"));
            grille.append(carte);
          }
        }
        blocs.push(
          creer("p", "note note-encadree", "Le RSEE rapporte l'impact de la parcelle dans les indicateurs de chaque bâtiment."),
          section("Parcelle", grille)
        );
        break;
      }
    }
    el.detail.replaceChildren(...blocs);
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

  /* ---------- Onglet Informations ---------- */

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

  // Carte titrée contenant une liste d'informations
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

  // Coefficients : jusqu'à 3 décimales, sans zéros inutiles (980 ; -0,181)
  const formatCoef = (n) => (n === null || n === undefined ? null
    : new Intl.NumberFormat(REGLAGES.langue, { maximumFractionDigits: 3 }).format(n));

  // Notation RE2020 des coefficients de modulation, d'après les balises du RSEE
  const COEFFICIENTS = {
    ic_construction: [
      ["migeo", "Mi géo"], ["micombles", "Mi combles"], ["misurf", "Mi surf"], ["misurf_moy", "Mi surf moy"],
      ["misurf_tot", "Mi surf tot"], ["miinfra", "Mi infra"],
      ["mivrd", "Mi VRD"], ["mided", "Mi DED"], ["mipv", "Mi PV"],
      ["ic_construction_maxmoyen", "Ic construction max moyen"],
    ],
    ic_energie: [
      ["mcgeo", "Mc géo"], ["mccombles", "Mc combles"], ["mcsurf_moy", "Mc surf moy"],
      ["mcsurf_tot", "Mc surf tot"], ["mccat", "Mc cat"], ["ic_energie_maxmoyen", "Ic énergie max moyen"],
    ],
  };

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
      const paires = COEFFICIENTS[cle]
        .filter(([balise]) => balise in coefs)
        .map(([balise, libelle]) => [libelle, formatCoef(coefs[balise])]);
      // Balises inconnues de la table : affichées sous leur nom d'origine
      for (const balise of Object.keys(coefs)) {
        if (!COEFFICIENTS[cle].some(([b]) => b === balise)) paires.push([balise, formatCoef(coefs[balise])]);
      }
      paires.push(["Seuil (RSEE)", nombreOuNull(zone.indicateurs[seuil], "kg éq. CO₂/m²", 1)]);
      const bloc = creer("div");
      bloc.append(creer("h4", "sous-titre-infos", titre), listeInfos(paires));
      grille.append(bloc);
    }
    carte.append(grille, creer("p", "note", "Valeurs lues dans le RSEE, sans recalcul du seuil."));
    return carte;
  }

  // Tableau des zones d'un bâtiment (usage, surfaces)
  function tableauZones(batiment) {
    const enveloppe = creer("div", "defilement");
    const table = creer("table", "tableau");
    const tete = creer("tr");
    for (const t of ["Zone", "Usage", "Sref", "SHAB", "Occupants"]) tete.append(creer("th", null, t));
    const thead = creer("thead");
    thead.append(tete);
    const tbody = creer("tbody");
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
    table.append(thead, tbody);
    enveloppe.append(table);
    return enveloppe;
  }

  function afficherInformations(noeud, parent) {
    const blocs = [];
    switch (noeud.type) {
      case "projet": {
        const inf = modeleCourant.informations;
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
            ["Phase (RSEnv)", valeurCodee("phase", modeleCourant.projet.phase)],
            ["Date d'étude (RSEnv)", date(modeleCourant.projet.date_etude)],
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
        const p = modeleCourant.projet;
        blocs.push(carteInfos("Logiciels et versions du fichier", [
          ...logiciels,
          ["Version Datas_Comp", p.version_datas_comp],
          ["Version RSET", p.version_rset],
          ["Version RSEnv", p.version_rsenv],
          ["Fichier", modeleCourant.fichier],
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
              a.rel = "noopener";
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
          ]),
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

  /* ---------- Onglet Composants ---------- */

  // Filtres et tri du tableau, conservés d'un nœud à l'autre pour un même fichier
  const filtresParDefaut = () => ({ recherche: "", contributeur: "", lot: "", type: "", tri: "position", sens: 1 });
  let filtresComposants = filtresParDefaut();

  // Colonnes triables du tableau des composants
  const COLONNES_COMPOSANTS = [
    { cle: "position", titre: "Position" },
    { cle: "nom", titre: "Fiche" },
    { cle: "type", titre: "Type de donnée" },
    { cle: "quantite", titre: "Quantité", nombre: true },
    { cle: null, titre: "Unité" },
    { cle: "dve", titre: "DVE", nombre: true },
  ];

  const nomContributeur = (c) => libelleCode("contributeur", c) || c;
  const nomLot = (ref) => (NOMENCLATURE_LOTS[ref] ? NOMENCLATURE_LOTS[ref].nom_court : "Lot " + ref);
  const nomSousLot = (ref) => {
    const lot = NOMENCLATURE_LOTS[String(ref).split(".")[0]];
    return lot && lot.sous_lots[ref] ? lot.sous_lots[ref] : "Sous-lot " + ref;
  };
  const nomBatiment = (index) => (modeleCourant.batiments.find((b) => b.index === index) || {}).nom || "Bâtiment " + index;

  // Lignes à afficher selon le nœud : brutes (zone, parcelle), regroupées (bâtiment, projet)
  function lignesDuNoeud(noeud) {
    switch (noeud.type) {
      case "zone": return noeud.lignes.map((l) => Object.assign({}, l, { nb_lignes: 1 }));
      case "parcelle": return noeud.lignes.map((l) => Object.assign({}, l, { nb_lignes: 1 }));
      case "batiment": return Composants.regrouper(noeud.zones.flatMap((z) => z.lignes));
      case "projet":
        return [
          ...modeleCourant.batiments.flatMap((b) => Composants.regrouper(b.zones.flatMap((z) => z.lignes))),
          ...modeleCourant.parcelles.flatMap((p) => p.lignes.map((l) => Object.assign({}, l, { nb_lignes: 1 }))),
        ];
    }
    return [];
  }

  // Texte de la colonne « Position »
  function celluleposition(l) {
    const td = creer("td", "position");
    if (l.contributeur === "composant") {
      if (l.sous_lot) {
        td.append(creer("span", "ref", l.sous_lot), document.createTextNode(" " + nomSousLot(l.sous_lot)));
      } else if (l.lot) {
        td.append(creer("span", "ref", l.lot), document.createTextNode(" " + nomLot(l.lot)));
      } else td.textContent = "Composants";
    } else {
      td.append(document.createTextNode(nomContributeur(l.contributeur)));
      if (l.sous_contributeur) td.append(creer("span", "detail", " · sous-contributeur " + l.sous_contributeur));
    }
    return td;
  }

  // Cellule « Fiche » : nom, identifiants, commentaire, paramètres du configurateur
  function celluleFiche(l) {
    const td = creer("td", "fiche");
    td.append(creer("span", "nom-fiche", l.nom || "(sans nom)"));
    const ids = [l.id_fiche && "fiche " + l.id_fiche, l.id_produit && l.id_produit !== l.id_fiche ? l.id_produit : null]
      .filter(Boolean).join(" · ");
    if (ids) td.append(creer("span", "detail", ids));
    if (l.commentaire) {
      // Les logiciels séparent les éléments du commentaire par « | »
      const texte = l.commentaire.split("|").map((x) => x.trim()).filter(Boolean).join(" · ");
      if (texte) td.append(creer("span", "commentaire", texte));
    }
    if (l.nb_lignes > 1) td.append(creer("span", "detail", `${l.nb_lignes} lignes du RSEE regroupées (une par zone)`));
    if (l.parametres && l.parametres.length) {
      const details = creer("details", "parametres");
      details.append(creer("summary", null, `${l.parametres.length} paramètres du configurateur`));
      const ul = creer("ul");
      for (const p of l.parametres) {
        ul.append(creer("li", null, `${p.nom} : ${p.valeur ?? "–"}${p.unite && p.unite !== "-" ? ESP + p.unite : ""}`));
      }
      details.append(ul);
      td.append(details);
    }
    return td;
  }

  // Corps du tableau (reconstruit à chaque changement de filtre ou de tri)
  function remplirComposants(tbody, compteur, toutes, avecBatiment) {
    const f = filtresComposants;
    const lignes = Composants.trier(Composants.filtrer(toutes, f), f.tri, f.sens);
    const fragment = document.createDocumentFragment();
    for (const l of lignes) {
      const tr = creer("tr");
      if (avecBatiment) tr.append(creer("td", null, l.batiment ? nomBatiment(l.batiment) : "Parcelle"));
      tr.append(celluleposition(l), celluleFiche(l));
      const type = creer("td");
      const v = valeurCodee("type_donnees", l.type_donnees);
      if (v) type.append(v);
      const unite = creer("td");
      const u = valeurCodee("unite_uf", l.unite_uf);
      if (u) unite.append(u);
      tr.append(
        type,
        creer("td", "nombre", l.quantite === null ? "–" : formatNombre(l.quantite, 2)),
        unite,
        creer("td", "nombre", l.dve === null ? "–" : `${formatNombre(l.dve)}${ESP}ans`)
      );
      fragment.append(tr);
    }
    tbody.replaceChildren(fragment);
    compteur.textContent = lignes.length === toutes.length
      ? `${pluriel(toutes.length, "ligne")}`
      : `${formatNombre(lignes.length)} sur ${pluriel(toutes.length, "ligne")}`;
  }

  // Liste déroulante de filtre
  function listeFiltre(libelle, cle, options) {
    const label = creer("label", "filtre");
    label.append(creer("span", null, libelle));
    const select = creer("select");
    const tous = creer("option", null, "Tous");
    tous.value = "";
    select.append(tous);
    for (const [valeur, texte] of options) {
      const o = creer("option", null, texte);
      o.value = valeur;
      select.append(o);
    }
    // Valeur conservée si elle existe dans ce nœud, sinon filtre levé
    select.value = options.some(([v]) => v === filtresComposants[cle]) ? filtresComposants[cle] : "";
    filtresComposants[cle] = select.value;
    label.append(select);
    return { label, select };
  }

  // Tableau des composants avec ses filtres
  function blocComposants(noeud) {
    const toutes = lignesDuNoeud(noeud);
    const avecBatiment = noeud.type === "projet";
    const bloc = creer("div");

    // Barre de filtres
    const barre = creer("div", "filtres");
    const recherche = creer("label", "filtre filtre-recherche");
    recherche.append(creer("span", null, "Rechercher"));
    const champ = creer("input");
    champ.type = "search";
    champ.placeholder = "nom, identifiant, commentaire…";
    champ.value = filtresComposants.recherche;
    recherche.append(champ);

    const contributeurs = Composants.ORDRE_CONTRIBUTEURS
      .filter((c) => toutes.some((l) => l.contributeur === c))
      .map((c) => [c, nomContributeur(c)]);
    const lots = Composants.valeursDistinctes(toutes, "lot").map((r) => [r, `${r} — ${nomLot(r)}`]);
    const types = Composants.valeursDistinctes(toutes, "type_donnees")
      .map((t) => [t, (libelleCode("type_donnees", t) || "Type") + ` (code ${t})`]);
    const fContrib = listeFiltre("Contributeur", "contributeur", contributeurs);
    const fLot = listeFiltre("Lot", "lot", lots);
    const fType = listeFiltre("Type de donnée", "type", types);
    const compteur = creer("span", "compteur");
    barre.append(recherche, fContrib.label, fLot.label, fType.label, compteur);

    // Tableau
    const enveloppe = creer("div", "defilement tableau-composants-cadre");
    const table = creer("table", "tableau tableau-composants");
    const thead = creer("thead");
    const tete = creer("tr");
    const colonnes = (avecBatiment ? [{ cle: null, titre: "Bâtiment" }] : []).concat(COLONNES_COMPOSANTS);
    const tbody = creer("tbody");
    const boutonsTri = [];
    for (const col of colonnes) {
      const th = creer("th", col.nombre ? "nombre" : null);
      if (col.cle) {
        // En-tête triable : un clic trie, un second clic inverse le sens
        const b = creer("button", "tri", col.titre);
        b.type = "button";
        b.dataset.cle = col.cle;
        b.addEventListener("click", () => {
          if (filtresComposants.tri === col.cle) filtresComposants.sens *= -1;
          else {
            filtresComposants.tri = col.cle;
            filtresComposants.sens = col.nombre ? -1 : 1; // nombres : plus grand d'abord
          }
          majTri();
          remplirComposants(tbody, compteur, toutes, avecBatiment);
        });
        boutonsTri.push([th, b]);
        th.append(b);
      } else th.textContent = col.titre;
      tete.append(th);
    }
    function majTri() {
      for (const [th, b] of boutonsTri) {
        const actif = b.dataset.cle === filtresComposants.tri;
        if (actif) th.setAttribute("aria-sort", filtresComposants.sens > 0 ? "ascending" : "descending");
        else th.removeAttribute("aria-sort");
      }
    }
    majTri();
    thead.append(tete);
    table.append(thead, tbody);
    enveloppe.append(table);

    // Événements des filtres (recherche différée pour rester fluide à la frappe)
    let attente = null;
    champ.addEventListener("input", () => {
      clearTimeout(attente);
      attente = setTimeout(() => {
        filtresComposants.recherche = champ.value;
        remplirComposants(tbody, compteur, toutes, avecBatiment);
      }, 150);
    });
    for (const [cle, f] of [["contributeur", fContrib], ["lot", fLot], ["type", fType]]) {
      f.select.addEventListener("change", () => {
        filtresComposants[cle] = f.select.value;
        remplirComposants(tbody, compteur, toutes, avecBatiment);
      });
    }

    remplirComposants(tbody, compteur, toutes, avecBatiment);
    bloc.append(barre, enveloppe);
    return bloc;
  }

  // Tableau des impacts par lot et sous-lot (valeurs du RSEE, kg éq. CO₂/m²).
  // Quand tous les lots valent 0, l'Ic de chaque ligne est la somme de ses phases,
  // comme dans les graphiques : voir CalculsGraphiques.sommePhases.
  function blocImpactsLots(impacts, icComposant) {
    const refs = Object.keys(impacts);
    if (refs.length === 0) return creer("p", "note", "Aucun impact par lot dans le RSEE.");

    // Certains logiciels écrivent 0 pour tous les lots : on prend alors la somme des
    // phases ; sans phases non plus, l'impact par lot est affiché comme non renseigné.
    // UDD et StockC valent aussi 0 dans ces RSEE : ils restent non renseignés.
    const tousNuls = refs.every((r) => !impacts[r].ic) && icComposant > 0;
    const depuisPhases = tousNuls && refs.some((r) => CalculsGraphiques.sommePhases(impacts[r].phases) !== null);
    const nonRenseigne = tousNuls && !depuisPhases;
    const icLigne = (v) => (depuisPhases ? CalculsGraphiques.sommePhases(v.phases) : v.ic);
    const bloc = creer("div");
    if (tousNuls) {
      bloc.append(creer("p", "note note-encadree",
        "Le logiciel a écrit un impact nul pour tous les lots alors que l'Ic composants vaut " +
        `${formatNombre(icComposant)}${ESP}kg éq. CO₂/m² : ` +
        (depuisPhases
          ? "l'Ic affiché ici est la somme des phases du cycle de vie de chaque lot. UDD et StockC ne sont pas renseignés."
          : "l'impact par lot n'est pas renseigné dans ce RSEE.")));
    }

    const enveloppe = creer("div", "defilement");
    const table = creer("table", "tableau tableau-lots");
    const tete = creer("tr");
    for (const [t, nombre] of [["Lot / sous-lot", false], ["Ic", true], ["Part de l'Ic composants", false],
      ["Ic DED", true], ["UDD", true], ["StockC", true]]) {
      tete.append(creer("th", nombre ? "nombre" : null, t));
    }
    const thead = creer("thead");
    thead.append(tete);
    const tbody = creer("tbody");

    const cellule = (v, dec, suffixe = "", masquer = nonRenseigne) => creer("td", "nombre", masquer || v === null || v === undefined ? "–" : formatNombre(v, dec) + suffixe);
    const barrePart = (ic) => {
      const td = creer("td", "part");
      if (nonRenseigne || !icComposant || ic === null || ic === undefined) return td;
      const part = ic / icComposant;
      const barre = creer("span", "barre-part");
      const plein = creer("span", "barre-plein");
      plein.style.width = Math.max(0, Math.min(1, part)) * 100 + "%";
      barre.append(plein);
      td.append(barre, creer("span", "valeur-part", formatNombre(part * 100, 1) + ESP + "%"));
      return td;
    };
    const ligne = (classe, libelle, ref, v) => {
      const tr = creer("tr", classe);
      const th = creer("th");
      th.append(creer("span", "ref", ref), document.createTextNode(" " + libelle));
      const ic = icLigne(v);
      tr.append(th, cellule(ic, 1), barrePart(ic), cellule(v.ic_ded, 1),
        cellule(v.udd === null || v.udd === undefined ? null : v.udd * 100, 0, ESP + "%", tousNuls),
        cellule(v.stock_c, 2, "", tousNuls));
      return tr;
    };

    // Lots par impact décroissant (ordre des références si impacts non renseignés)
    const ordre = refs.slice().sort((a, b) => (nonRenseigne ? Number(a) - Number(b) : (icLigne(impacts[b]) || 0) - (icLigne(impacts[a]) || 0)));
    let somme = 0;
    for (const r of ordre) {
      const lot = impacts[r];
      somme += icLigne(lot) || 0;
      tbody.append(ligne("ligne-lot", nomLot(r), r, lot));
      const sous = Object.keys(lot.sous_lots || {})
        .sort((a, b) => (nonRenseigne ? 0 : (icLigne(lot.sous_lots[b]) || 0) - (icLigne(lot.sous_lots[a]) || 0)));
      for (const s of sous) tbody.append(ligne("ligne-sous-lot", nomSousLot(s), s, lot.sous_lots[s]));
    }
    table.append(thead, tbody);
    enveloppe.append(table);

    // Affichage des sous-lots (case à cocher)
    const bascule = creer("label", "bascule");
    const caseSousLots = creer("input");
    caseSousLots.type = "checkbox";
    caseSousLots.checked = true;
    caseSousLots.addEventListener("change", () => table.classList.toggle("sans-sous-lots", !caseSousLots.checked));
    bascule.append(caseSousLots, document.createTextNode(" Détail par sous-lot"));

    bloc.append(bascule, enveloppe);
    if (!nonRenseigne) {
      bloc.append(creer("p", "note",
        `Ic, Ic DED en kg éq. CO₂/m², StockC en kg C/m², UDD en % — somme des lots : ${formatNombre(somme, 1)}` +
        `${ESP}kg éq. CO₂/m² (Ic composants du RSEE : ${formatNombre(icComposant ?? 0, 1)}).`));
    }
    return bloc;
  }

  function afficherComposants(noeud, parent) {
    const blocs = [];
    if (noeud.type === "batiment" || noeud.type === "zone") {
      blocs.push(section(
        "Impacts par lot" + (noeud.type === "zone" ? " (zone)" : ""),
        blocImpactsLots(noeud.impacts_lots, noeud.indicateurs.ic_composant)
      ));
    } else if (noeud.type === "projet") {
      blocs.push(creer("p", "note note-encadree",
        "Sélectionnez un bâtiment pour afficher les impacts par lot. Le RSEE ne donne pas d'impact par composant."));
    }
    const titre = { projet: "Composants et services du projet", batiment: "Composants et services du bâtiment",
      zone: "Composants et services de la zone", parcelle: "Services de la parcelle" }[noeud.type];
    const tableau = section(titre, blocComposants(noeud));
    if (noeud.type === "batiment" && noeud.zones.length > 1) {
      tableau.append(creer("p", "note",
        "Les logiciels répartissent chaque fiche entre les zones au prorata de leur Sref : " +
        "les lignes identiques des zones sont regroupées et leurs quantités additionnées."));
    }
    blocs.push(tableau);
    el.detail.replaceChildren(...blocs);
  }

  /* ---------- Onglet Graphiques ---------- */

  // Réglages saisis dans l'onglet, remis à zéro à chaque nouveau fichier
  const etatGraphiquesParDefaut = () => ({ top_n: REGLAGES_GRAPHIQUES.top_n_defaut, energie: {} });
  let etatGraphiques = etatGraphiquesParDefaut();

  // Objet tracé : une barre par entité (un bâtiment, une zone, ou chaque bâtiment du projet)
  function entite(cle, noeud, lignes) {
    return {
      cle, nom: noeud.nom, indicateurs: noeud.indicateurs, impacts_lots: noeud.impacts_lots,
      lignes: lignes.filter((l) => l.contributeur === "composant"),
    };
  }
  const entiteBatiment = (b) => entite("b" + b.index, b, Composants.regrouper(b.zones.flatMap((z) => z.lignes)));

  function entitesDuNoeud(noeud) {
    switch (noeud.type) {
      case "projet": return modeleCourant.batiments.map(entiteBatiment);
      case "batiment": return [entiteBatiment(noeud)];
      case "zone": return [entite("z" + noeud.index, noeud, noeud.lignes)];
    }
    return [];
  }

  // Libère la mémoire des graphiques affichés avant de changer de vue
  function libererGraphiques() {
    if (typeof Plotly === "undefined") return;
    for (const g of el.detail.querySelectorAll(".graphique.avec-trace")) Plotly.purge(g);
  }

  // Tableau des données d'un graphique, replié sous celui-ci (lecture sans la couleur)
  function tableauDonnees(tableau) {
    const details = creer("details", "donnees-graphique");
    details.append(creer("summary", null, "Voir les données"));
    const enveloppe = creer("div", "defilement");
    const table = creer("table", "tableau");
    const thead = creer("thead");
    const tete = creer("tr");
    tableau.colonnes.forEach((c, i) => tete.append(creer("th", i ? "nombre" : null, c)));
    thead.append(tete);
    const tbody = creer("tbody");
    for (const ligne of tableau.lignes) {
      const tr = creer("tr");
      ligne.forEach((v, i) => tr.append(creer(i ? "td" : "th", i ? "nombre" : null, v)));
      tbody.append(tr);
    }
    table.append(thead, tbody);
    enveloppe.append(table);
    details.append(enveloppe);
    return details;
  }

  // Légende du graphique des contributeurs : composants et chantier encadrés avec leur seuil
  function legendeContributeurs(legende) {
    const entree = (poste) => {
      const e = creer("span", "entree-legende");
      const pastille = creer("span", "pastille-legende");
      pastille.style.background = poste.couleur;
      e.append(pastille, creer("span", null, poste.legende));
      return e;
    };
    const bloc = creer("div", "legende-contributeurs");
    bloc.append(...legende.hors_cadre.map(entree));
    const cadre = creer("div", "legende-cadre");
    cadre.append(creer("span", "titre-cadre", legende.cadre.titre), ...legende.cadre.postes.map(entree));
    if (legende.cadre.seuil) {
      const seuil = creer("span", "entree-legende");
      const trait = creer("span", "trait-legende");
      trait.style.background = legende.cadre.seuil.couleur;
      seuil.append(trait, creer("span", null, legende.cadre.seuil.libelle));
      cadre.append(seuil);
    }
    bloc.append(cadre);
    return bloc;
  }

  // Cartes des macro-lots sous le graphique de la nature des fiches
  function cartesMacroLots(cartes) {
    const bloc = creer("div");
    bloc.append(creer("h4", "sous-titre-infos", "Part des FDES / PEP face aux DED et au forfaitaire, par macro-lot (en nombre de fiches)"));
    const grille = creer("div", "cartes-macro");
    for (const c of cartes) {
      const carte = creer("div", "carte-macro");
      carte.style.borderTopColor = c.couleur;
      const nom = creer("p", "macro-nom", c.nom);
      const part = creer("p", "macro-part", c.part_specifique);
      nom.style.color = c.couleur;
      part.style.color = c.couleur;
      carte.append(nom, creer("p", "macro-detail", c.lots), part, creer("p", "macro-detail", "FDES / PEP"),
        creer("p", "macro-versus", c.part_defaut), creer("p", "macro-detail", "DED + forfaitaire"),
        creer("p", "macro-detail", c.detail), creer("p", "macro-detail", c.effectif));
      grille.append(carte);
    }
    bloc.append(grille);
    return bloc;
  }

  // Champ numérique réglant un graphique (top N, Ic énergie saisi)
  function champParametre(p, redessiner) {
    const label = creer("label", "parametre-graphique");
    label.append(creer("span", null, p.libelle));
    const champ = creer("input");
    champ.type = "number";
    champ.step = p.pas ?? "any";
    if (p.min !== undefined) champ.min = p.min;
    if (p.max !== undefined) champ.max = p.max;
    champ.value = p.valeur ?? "";
    champ.addEventListener("change", () => {
      p.appliquer(champ.value === "" ? null : Number(champ.value));
      redessiner();
    });
    label.append(champ);
    return label;
  }

  // Carte d'un graphique ; le contenu est reconstruit quand un réglage change
  function carteGraphique(def) {
    const carte = creer("article", "carte carte-graphique");
    carte.dataset.graphique = def.id;
    const logo = creer("img", "logo-hub");
    logo.src = REGLAGES_GRAPHIQUES.logo_hub;
    logo.alt = "HUB Bas Carbone";
    carte.append(logo, creer("h3", null, def.titre));
    if (def.sous_titre) carte.append(creer("p", "note", def.sous_titre));
    const parametres = creer("div", "parametres-graphique");
    const legende = creer("div");
    const zone = creer("div", "graphique");
    const suite = creer("div");
    carte.append(parametres, legende, zone, suite);

    const dessiner = () => {
      const spec = def.construire(zone.clientWidth || el.detail.clientWidth);
      suite.replaceChildren();
      if (spec.message) {
        suite.append(creer("p", "note", spec.message));
        return;
      }
      zone.classList.add("avec-trace");
      Plotly.react(zone, spec.traces, spec.layout, TracesGraphiques.CONFIG);
      legende.replaceChildren(...(spec.legende ? [legendeContributeurs(spec.legende)] : []));
      if (spec.cartes) suite.append(cartesMacroLots(spec.cartes));
      for (const n of spec.notes || []) suite.append(creer("p", "note", n));
      if (spec.tableau) suite.append(tableauDonnees(spec.tableau));
    };
    parametres.replaceChildren(...(def.parametres || []).map((p) => champParametre(p, dessiner)));
    return { carte, dessiner };
  }

  function afficherGraphiques(noeud) {
    if (noeud.type === "parcelle") {
      el.detail.replaceChildren(creer("p", "note note-encadree", "Pas de graphique pour la parcelle : sélectionnez un bâtiment ou le projet."));
      return;
    }
    if (typeof Plotly === "undefined") {
      el.detail.replaceChildren(creer("p", "note note-encadree", "La bibliothèque de graphiques n'a pas pu être chargée (js/plotly-basic.min.js)."));
      return;
    }
    const contexte = { etat: etatGraphiques, type: noeud.type };
    const cartes = TracesGraphiques.liste(entitesDuNoeud(noeud), contexte).map(carteGraphique);
    el.detail.replaceChildren(...cartes.map((c) => c.carte));
    // Tracé une fois les cartes dans la page : Plotly a besoin de leur largeur
    for (const c of cartes) c.dessiner();
  }

  /* ---------- Import ---------- */

  function afficherErreur(texteErreur) {
    el.message.textContent = texteErreur;
    el.message.hidden = false;
  }

  async function ouvrir(fichier) {
    if (!fichier) return;
    const M = REGLAGES.messages;
    el.message.hidden = true;
    el.texteDepot.replaceChildren(creer("span", "nom-fichier", fichier.name));

    const debut = performance.now();
    let octets;
    try {
      octets = await fichier.arrayBuffer();
    } catch (e) {
      return echec(M.lecture);
    }
    if (LectureRSEE.estZip(octets)) return echec(M.zip);
    const extensionOk = REGLAGES.extensions_acceptees.some((x) => fichier.name.toLowerCase().endsWith(x));
    if (!extensionOk) return echec(M.extension);

    const resultat = LectureRSEE.analyser(LectureRSEE.decoder(octets), fichier.name);
    if (resultat.erreur) return echec(resultat.erreur);

    modeleCourant = resultat.modele;
    filtresComposants = filtresParDefaut(); // nouveaux filtres pour un nouveau fichier
    etatGraphiques = etatGraphiquesParDefaut();
    const duree = Math.round(performance.now() - debut);
    el.infoFichier.replaceChildren(
      document.createTextNode(`${formatTaille(fichier.size)} · lu en ${formatNombre(duree)} ms, localement.`)
    );
    if (fichier.size > REGLAGES.taille_alerte) {
      el.infoFichier.append(document.createTextNode(" Fichier volumineux : l'affichage peut être lent."));
    }
    construireArbre();

    function echec(texteErreur) {
      modeleCourant = null;
      el.infoFichier.textContent = INFO_INITIALE;
      afficherErreur(texteErreur);
      afficherVide();
    }
  }

  /* ---------- Événements ---------- */

  el.version.textContent = "v" + REGLAGES.version;
  for (const o of el.onglets) o.addEventListener("click", () => changerOnglet(o.dataset.onglet));
  el.boutonOuvrir.addEventListener("click", () => el.selecteur.click());
  el.selecteur.addEventListener("change", () => {
    ouvrir(el.selecteur.files[0]);
    el.selecteur.value = ""; // permet de rouvrir le même fichier
  });

  // Glisser-déposer : accepté sur toute la page, la zone de dépôt s'éclaire
  let compteurSurvol = 0;
  document.addEventListener("dragenter", (e) => {
    e.preventDefault();
    compteurSurvol++;
    el.zoneDepot.classList.add("survol");
  });
  document.addEventListener("dragleave", () => {
    compteurSurvol = Math.max(0, compteurSurvol - 1);
    if (compteurSurvol === 0) el.zoneDepot.classList.remove("survol");
  });
  document.addEventListener("dragover", (e) => e.preventDefault());
  document.addEventListener("drop", (e) => {
    e.preventDefault();
    compteurSurvol = 0;
    el.zoneDepot.classList.remove("survol");
    if (e.dataTransfer.files.length) ouvrir(e.dataTransfer.files[0]);
  });

  afficherVide();
})();
