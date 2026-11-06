/* =====================================================================
   lecteur_RSEE — onglet Graphiques du HUB
   Cartes, légendes et tracé des graphiques définis dans js/graphiques_traces.js.
   ===================================================================== */

"use strict";

const OngletGraphiques = (() => {
  const {
    el, creer, creerTableau,
  } = Commun;

  // Réglages saisis dans l'onglet, remis à zéro à chaque nouveau fichier
  const etatGraphiquesParDefaut = () => ({ top_n: REGLAGES_GRAPHIQUES.top_n_defaut, energie: {} });
  let etatGraphiques = etatGraphiquesParDefaut();

  // Plotly (1 Mo) n'est chargé qu'à la première ouverture de l'onglet
  let chargement = null;
  function chargerPlotly() {
    chargement ??= new Promise((reussi, echoue) => {
      const script = document.createElement("script");
      script.src = REGLAGES_GRAPHIQUES.script_plotly;
      script.onload = reussi;
      script.onerror = echoue;
      document.head.append(script);
    });
    return chargement;
  }

  // Augmente à chaque changement de vue : un chargement terminé trop tard ne trace rien
  let vueCourante = 0;

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
      case "projet": return Etat.modele.batiments.map(entiteBatiment);
      case "batiment": return [entiteBatiment(noeud)];
      case "zone": return [entite("z" + noeud.index, noeud, noeud.lignes)];
    }
    return [];
  }

  // Libère la mémoire des graphiques affichés avant de changer de vue
  function libererGraphiques() {
    vueCourante += 1;
    if (typeof Plotly === "undefined") return;
    for (const g of el.detail.querySelectorAll(".graphique.avec-trace")) Plotly.purge(g);
  }

  // Tableau des données d'un graphique, replié sous celui-ci (lecture sans la couleur)
  function tableauDonnees(tableau) {
    const details = creer("details", "donnees-graphique");
    details.append(creer("summary", null, "Voir les données"));
    const { enveloppe, tbody } = creerTableau("tableau", tableau.colonnes.map((c, i) => (i ? [c, "nombre"] : c)));
    for (const ligne of tableau.lignes) {
      const tr = creer("tr");
      ligne.forEach((v, i) => tr.append(creer(i ? "td" : "th", i ? "nombre" : null, v)));
      tbody.append(tr);
    }
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

  async function afficherGraphiques(noeud) {
    if (noeud.type === "parcelle") {
      el.detail.replaceChildren(creer("p", "note note-encadree", "Pas de graphique pour la parcelle : sélectionnez un bâtiment ou le projet."));
      return;
    }
    if (typeof Plotly === "undefined") {
      const vue = vueCourante;
      el.detail.replaceChildren(creer("p", "note", "Chargement des graphiques…"));
      try {
        await chargerPlotly();
      } catch (e) {
        chargement = null; // nouvel essai à la prochaine ouverture
        if (vue === vueCourante) {
          el.detail.replaceChildren(creer("p", "note note-encadree", `La bibliothèque de graphiques n'a pas pu être chargée (${REGLAGES_GRAPHIQUES.script_plotly}).`));
        }
        return;
      }
      if (vue !== vueCourante) return;
    }
    const contexte = { etat: etatGraphiques, type: noeud.type };
    const cartes = TracesGraphiques.liste(entitesDuNoeud(noeud), contexte).map(carteGraphique);
    el.detail.replaceChildren(...cartes.map((c) => c.carte));
    // Tracé une fois les cartes dans la page : Plotly a besoin de leur largeur
    for (const c of cartes) c.dessiner();
  }

  return {
    afficher: afficherGraphiques,
    liberer: libererGraphiques,
    reinitialiser: () => { etatGraphiques = etatGraphiquesParDefaut(); },
  };
})();
