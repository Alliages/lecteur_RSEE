/* =====================================================================
   lecteur_RSEE — onglet Indicateurs
   Exigences, composition de l'Ic, calcul des seuils, risques,
   consommation d'énergie finale par poste.
   ===================================================================== */

"use strict";

const OngletIndicateurs = (() => {
  const {
    ESP, UNITE_IC, LIBELLES_STATUT, SYMBOLES_STATUT, el, formatNombre, formatSigne, pluriel, creer,
    creerTableau, niveauxMarge, logoNiveau, legendeMarges, legendeFamilles, section,
  } = Commun;

  const NOTE_COMPOSITION = `Valeurs en ${UNITE_IC}, lues dans le RSEE. Chaque total s'ajoute au bloc suivant : Ic construction + Ic eau + Ic énergie = Ic bâtiment, puis + Ic parcelle = Ic projet.`;

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
    const echelle = Math.max(valeur, seuil) * REGLAGES.echelle_jauge;
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
    carte.dataset.famille = ev.def.famille;
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
      boite.dataset.famille = EvaluationIndicateurs.familleDe(cle);
      boite.append(creer("span", "seuil-ic", `seuil ${formatNombre(seuil, 1)}`));
    }
    return boite;
  }

  // Sommes qui ne tombent pas juste (arrondis exclus), pour le signaler sous le schéma
  function ecartsComposition(ind, estZone) {
    const ecarts = [];
    const tolerance = REGLAGES.tolerance_somme;
    let cumul = 0;
    for (const groupe of INDICATEURS.composition) {
      const cle = cleIc(groupe.total, estZone);
      if (!(cle in ind) || ind[cle] === null) continue;
      cumul += groupe.termes.reduce((s, t) => s + (ind[t.valeur] ?? 0), 0);
      if (Math.abs(cumul - ind[cle]) > Math.max(tolerance.absolue, Math.abs(ind[cle]) * tolerance.relative)) {
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
    ligne.dataset.famille = EvaluationIndicateurs.familleDe(eq.cle);
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
      ligne.dataset.famille = EvaluationIndicateurs.familleDe("dh");
      const formule = creer("div", "formule");
      formule.append(termeCalcul(dh.map((v) => formatNombre(v)).join(" / "), "°C.h", "resultat-calcul"), creer("span", "note", "par groupe, lu dans le RSEE"));
      ligne.append(creer("span", "nom-calcul", "DH max"), formule);
      details.append(ligne);
    }
    const lien = creer("a", "lien-outil", "Recalculer dans l'outil Seuils RE2020 ↗");
    lien.href = CalculSeuils.lienOutil(zone, batiment, Etat.modele.informations);
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

  /* ---------- Consommation d'énergie finale ---------- */

  // Une ligne : postes + … = Cef, puis le mobilier (hors Cef) pour information.
  // Renvoie null si le RSET ne donne ni postes ni total.
  function ligneCef(ind, titre) {
    const postes = ind.cef_postes || {};
    const cef = ind.cef ?? null;
    const valeurs = REGLAGES.postes_cef.map((p) => postes[p.cle] ?? null);
    if (cef === null && valeurs.every((v) => v === null)) return null;
    const ligne = creer("div", "ligne-calcul ligne-cef");
    ligne.dataset.famille = EvaluationIndicateurs.familleDe("cep");
    ligne.append(creer("span", "nom-calcul", titre));
    const formule = creer("div", "formule");
    const signe = (texte) => creer("span", "signe-calcul", texte);
    REGLAGES.postes_cef.forEach((p, i) => {
      if (i > 0) formule.append(signe("+"));
      formule.append(termeCalcul(valeurs[i] === null ? "–" : formatNombre(valeurs[i], 1), p.libelle));
    });
    formule.append(signe("="), termeCalcul(cef === null ? "–" : formatNombre(cef, 1), "Cef " + REGLAGES.unite_cef, "resultat-calcul"));
    const info = REGLAGES.poste_cef_information;
    const mobilier = postes[info.cle] ?? null;
    if (mobilier !== null) {
      formule.append(termeCalcul(formatNombre(mobilier, 1), info.libelle + " (hors Cef, pour information)", "terme-information"));
    }
    ligne.append(formule);
    const somme = valeurs.reduce((s, v) => s + (v || 0), 0);
    if (cef !== null && Math.abs(somme - cef) > REGLAGES.tolerance_cef) {
      ligne.append(creer("p", "ecart-calcul",
        `La somme des postes donne ${formatNombre(somme, 1)}, soit ${formatSigne(somme - cef, 1)}${ESP}${REGLAGES.unite_cef} par rapport au Cef du RSET.`));
    }
    return ligne;
  }

  // Section Cef d'un ou plusieurs nœuds : entrees [{ indicateurs, titre }] ; absente sans données
  function sectionCef(entrees) {
    const lignes = entrees.map((e) => ligneCef(e.indicateurs, e.titre)).filter(Boolean);
    if (lignes.length === 0) return [];
    const bloc = creer("div", "carte carte-calcul carte-cef");
    bloc.append(...lignes, creer("p", "note",
      `Consommations d'énergie finale par poste, en ${REGLAGES.unite_cef}, lues dans le RSET ; leur somme est le Cef. ` +
      "Le mobilier (usages mobiliers) est hors du périmètre réglementaire : il est donné pour information et n'entre pas dans le Cef."));
    return [section("Consommation d'énergie finale", bloc)];
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
      li.dataset.famille = e.famille;
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

  function grilleExigences(evaluations, mode) {
    const g = creer("div", "exigences");
    for (const ev of evaluations) g.append(carteExigence(ev, mode));
    return g;
  }

  // Heures d'inconfort de chaque groupe, lues dans le RSET (mêmes colonnes que la fiche PDF).
  // groupes : groupes_dh du nœud ; nomGroupe : libellé de la ligne
  function tableauInconfort(groupes, nomGroupe) {
    const colonne = (titre) => [titre, null, EvaluationIndicateurs.familleDe("dh")];
    const { enveloppe, tbody } = creerTableau("tableau tableau-inconfort", [
      colonne("Groupe"),
      colonne("DH (°C.h)"),
      colonne("Nb d'heures pour lesquelles la t° opérative est sup. à la t° d'inconfort"),
      colonne("Nb d'heures pour lesquelles la t° opérative est sup. à la t° d'inconfort +1°"),
      colonne("Nb d'heures pour lesquelles la t° opérative est sup. à la t° d'inconfort +2°"),
    ]);
    const cellule = (n, dec = 0) => creer("td", "nombre", n === null || n === undefined ? "–" : formatNombre(n, dec));
    for (const g of groupes) {
      const tr = creer("tr");
      tr.append(creer("th", null, nomGroupe(g)), cellule(g.dh, 1), cellule(g.nb_h_inconf), cellule(g.nb_h_inconf_1), cellule(g.nb_h_inconf_2));
      tbody.append(tr);
    }
    return enveloppe;
  }

  // Section des heures d'inconfort, absente si le nœud n'a aucun groupe
  function sectionInconfort(noeud) {
    const groupes = noeud.indicateurs.groupes_dh || [];
    if (groupes.length === 0) return [];
    // Bâtiment à plusieurs zones : la zone précède le groupe, comme dans la fiche PDF
    const zones = noeud.type === "batiment" && noeud.zones.length > 1 ? noeud.zones : [];
    const nomGroupe = (g) => [zones.find((z) => z.index === g.zone)?.nom, g.nom].filter(Boolean).join(" / ");
    return [section("Heures d'inconfort", tableauInconfort(groupes, nomGroupe))];
  }

  // Tableau des écarts du projet : une ligne par bâtiment, une colonne par exigence
  function tableauProjet() {
    const niveaux = niveauxMarge("reglementaire");
    const { enveloppe, tbody } = creerTableau("synthese", [
      "Bâtiment", ...REGLAGES_GRAPHIQUES.ecarts.map((e) => [e.libelle, null, EvaluationIndicateurs.familleDe(e.cle)]),
    ]);
    for (const b of Etat.modele.batiments) {
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
    return enveloppe;
  }

  function afficherIndicateurs(noeud, parent) {
    const blocs = [];
    const avecPlusieursZones = (batiments) => batiments.some((b) => b.zones.length > 1);
    switch (noeud.type) {
      case "projet": {
        const batiments = Etat.modele.batiments;
        const toutes = batiments.flatMap((b) => EvaluationIndicateurs.evaluerTout(b.indicateurs));
        const nbBat = batiments.length;
        const nonConformes = batiments.filter((b) =>
          EvaluationIndicateurs.evaluerTout(b.indicateurs).some((e) => e.statut === "depasse")
        );
        const liste = risques(batiments);
        const bandeau = bandeauVerdict(toutes, Etat.modele.projet.nom, "reglementaire");
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
          section("Écarts aux seuils", legendeFamilles(), legendeMarges(niveauxMarge("reglementaire")), tableauProjet(),
            creer("p", "note", "Écart = (valeur − seuil) / seuil ; valeur / seuil en dessous. DH : groupe le plus proche de son seuil. Détail en sélectionnant un bâtiment. Unités : Ic en " + UNITE_IC + ", Bbio en points, Cep et Cep,nr en kWhep/m²/an, DH en °C.h.")),
          section("Risques", listeRisques(liste, nbBat > 1, "reglementaire")),
          ...sectionCef(batiments.map((b) => ({ indicateurs: b.indicateurs, titre: b.nom }))),
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
          section("Exigences réglementaires", legendeFamilles(), grilleExigences(evaluations, "reglementaire")),
          ...sectionCef([{ indicateurs: noeud.indicateurs, titre: noeud.nom },
            ...(noeud.zones.length > 1 ? noeud.zones.map((z) => ({ indicateurs: z.indicateurs, titre: z.nom })) : [])]),
          ...sectionInconfort(noeud),
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
          section("Valeurs de la zone", legendeFamilles(), grilleExigences(evaluations, "information")),
          ...sectionCef([{ indicateurs: noeud.indicateurs, titre: noeud.nom }]),
          ...sectionInconfort(noeud),
          section("Composition de l'Ic", composition(noeud.indicateurs, true), creer("p", "note", NOTE_COMPOSITION))
        );
        break;
      }
      case "parcelle": {
        const grille = creer("div", "pedagogiques");
        const defIc = INDICATEURS.pedagogiques.find((d) => d.valeur === "ic_parcelle");
        const defStock = INDICATEURS.pedagogiques.find((d) => d.valeur === "stock_c_parcelle");
        for (const b of Etat.modele.batiments) {
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

  return { afficher: afficherIndicateurs };
})();
