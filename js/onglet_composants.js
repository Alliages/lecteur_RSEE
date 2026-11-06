/* =====================================================================
   lecteur_RSEE — onglet Composants
   Impacts par lot et tableau des composants et services.
   ===================================================================== */

"use strict";

const OngletComposants = (() => {
  const {
    ESP, UNITE_IC, el, formatNombre, pluriel, creer, creerTableau, section, valeurCodee,
  } = Commun;

  // Colonnes triables du tableau des composants
  const COLONNES_COMPOSANTS = [
    { cle: "position", titre: "Position" },
    { cle: "nom", titre: "Fiche" },
    { cle: "type", titre: "Type de donnée" },
    { cle: "quantite", titre: "Quantité", nombre: true },
    { cle: null, titre: "Unité" },
    { cle: "dve", titre: "DVE", nombre: true },
  ];

  // Filtres et tri du tableau, conservés d'un nœud à l'autre pour un même fichier
  const filtresParDefaut = () => ({ recherche: "", contributeur: "", lot: "", type: "", tri: "position", sens: 1 });
  let filtresComposants = filtresParDefaut();

  const nomContributeur = (c) => libelleCode("contributeur", c) || c;
  const nomLot = (ref) => (NOMENCLATURE_LOTS[ref] ? NOMENCLATURE_LOTS[ref].nom_court : "Lot " + ref);
  const nomSousLot = (ref) => {
    const lot = NOMENCLATURE_LOTS[String(ref).split(".")[0]];
    return lot && lot.sous_lots[ref] ? lot.sous_lots[ref] : "Sous-lot " + ref;
  };
  const nomBatiment = (index) => (Etat.modele.batiments.find((b) => b.index === index) || {}).nom || "Bâtiment " + index;

  const lignesBrutes = (lignes) => lignes.map((l) => ({ ...l, nb_lignes: 1 }));

  // Lignes à afficher selon le nœud : brutes (zone, parcelle), regroupées (bâtiment, projet)
  function lignesDuNoeud(noeud) {
    switch (noeud.type) {
      case "zone":
      case "parcelle":
        return lignesBrutes(noeud.lignes);
      case "batiment": return Composants.regrouper(noeud.zones.flatMap((z) => z.lignes));
      case "projet":
        return [
          ...Etat.modele.batiments.flatMap((b) => Composants.regrouper(b.zones.flatMap((z) => z.lignes))),
          ...Etat.modele.parcelles.flatMap((p) => lignesBrutes(p.lignes)),
        ];
    }
    return [];
  }

  // Texte de la colonne « Position »
  function cellulePosition(l) {
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
      tr.append(cellulePosition(l), celluleFiche(l));
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

  // Tableau des impacts par lot et sous-lot (valeurs du RSEE).
  // Impact de chaque ligne : même règle que les graphiques (CalculsGraphiques.impactLot).
  function blocImpactsLots(impacts, icComposant) {
    const refs = Object.keys(impacts);
    if (refs.length === 0) return creer("p", "note", "Aucun impact par lot dans le RSEE.");

    // Certains logiciels écrivent 0 pour tous les lots : on prend alors la somme des
    // phases ; sans phases non plus, l'impact par lot est affiché comme non renseigné.
    // UDD et StockC valent aussi 0 dans ces RSEE : ils restent non renseignés.
    const tousNuls = refs.every((r) => !impacts[r].ic) && icComposant > 0;
    const depuisPhases = tousNuls && refs.some((r) => CalculsGraphiques.sommePhases(impacts[r].phases) !== null);
    const nonRenseigne = tousNuls && !depuisPhases;
    const icLigne = CalculsGraphiques.impactLot;
    const bloc = creer("div");
    if (tousNuls) {
      bloc.append(creer("p", "note note-encadree",
        "Le logiciel a écrit un impact nul pour tous les lots alors que l'Ic composants vaut " +
        `${formatNombre(icComposant)}${ESP}${UNITE_IC} : ` +
        (depuisPhases
          ? "l'Ic affiché ici est la somme des phases du cycle de vie de chaque lot. UDD et StockC ne sont pas renseignés."
          : "l'impact par lot n'est pas renseigné dans ce RSEE.")));
    }

    const { enveloppe, table, tbody } = creerTableau("tableau tableau-lots", ["Lot / sous-lot", ["Ic", "nombre"],
      "Part de l'Ic composants", ["Ic DED", "nombre"], ["UDD", "nombre"], ["StockC", "nombre"]]);

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
        `Ic, Ic DED en ${UNITE_IC}, StockC en kg C/m², UDD en % — somme des lots : ${formatNombre(somme, 1)}` +
        `${ESP}${UNITE_IC} (Ic composants du RSEE : ${formatNombre(icComposant ?? 0, 1)}).`));
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

  return {
    afficher: afficherComposants,
    reinitialiser: () => { filtresComposants = filtresParDefaut(); },
  };
})();
