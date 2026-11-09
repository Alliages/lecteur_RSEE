/* =====================================================================
   lecteur_RSEE — tracé des graphiques (Plotly)
   Trace les graphiques 2 à 8 pour un seul bâtiment :
   une barre pour un bâtiment ou une zone, une barre par bâtiment pour le
   projet. Chaque fonction renvoie { traces, layout, tableau, notes } ou
   { message } si le graphique n'a pas de sens pour cette vue.

   Plotly interprète quelques balises dans ses textes : les noms venant du
   RSEE passent par propre() pour qu'un fichier ne puisse rien y injecter.
   ===================================================================== */

"use strict";

const TracesGraphiques = (() => {
  const R = REGLAGES_GRAPHIQUES;
  const C = CalculsGraphiques;
  const K = R.couleurs;
  const D = R.dimensions;
  const { nombre, signe } = Format;

  // Graphiques de lecture : ni barre d'outils ni zoom
  const CONFIG = { responsive: true, displayModeBar: false, scrollZoom: false, doubleClick: false };

  const LARGEUR_ETROITE = R.largeur_etroite;

  // Espace entre les libellés de l'axe vertical et les barres
  const ECART_LIBELLE = "\u00a0\u00a0";

  /* ---------- Outils ---------- */

  const pourcent = (p, dec = 0) => (p === null || p === undefined ? "–" : `${nombre(p * 100, dec)} %`);

  const propre = (s) => String(s ?? "").replace(/[<>&]/g, " ").replace(/\s+/g, " ").trim();
  const court = (s, n) => (s.length > n ? s.slice(0, Math.max(1, n - 1)) + "…" : s);

  // Mise en page commune, complétée par chaque graphique
  function miseEnPage(options) {
    return Object.assign({
      font: { family: R.police, size: 13, color: R.couleur_texte },
      paper_bgcolor: K.blanc,
      plot_bgcolor: K.blanc,
      separators: R.separateurs,
      dragmode: false,
      hoverlabel: { font: { family: R.police } },
    }, options);
  }

  const legendeBas = () => ({ orientation: "h", x: 0, y: -0.12, yanchor: "top", traceorder: "normal" });
  const legendeSelon = (largeur, cote) => (largeur < LARGEUR_ETROITE ? legendeBas() : cote);

  // Remplissage plein ou hachuré d'une barre
  const remplissage = (def) => ({
    color: def.couleur,
    line: { color: K.blanc, width: 1 },
    ...(def.hachure ? { pattern: { shape: "/", fgcolor: def.hachure, bgcolor: def.couleur, size: 7, solidity: 0.4 } } : {}),
  });

  // Écarte vers le haut des positions triées pour garder un intervalle minimal
  function ecarter(positions, intervalle) {
    const tries = positions.slice().sort((a, b) => a.y - b.y);
    tries.forEach((p, i) => {
      if (i > 0) p.y = Math.max(p.y, tries[i - 1].y + intervalle);
    });
    return tries;
  }

  /* ---------- Répartition par contributeur (G2) ---------- */

  function contributeurs(entites, contexte, largeur) {
    const donnees = entites.map((e) => C.contributeurs(e.indicateurs, contexte.etat.energie[e.cle]));
    const noms = entites.map((e) => propre(e.nom));
    const n = entites.length;
    const { hauteur, marges } = D.contributeurs;
    const yMax = 1.35 * Math.max(1, ...donnees.map((d) => Math.max(d.total, d.seuil_construction ?? 0)));
    const hauteurTrace = hauteur - marges.t - marges.b;
    const unPixel = yMax / hauteurTrace;
    const demiBarre = 0.225;

    const traces = R.contributeurs.map((c) => ({
      type: "bar", name: c.legende, x: entites.map((_, i) => i), y: donnees.map((d) => d.valeurs[c.cle]),
      width: 0.45, marker: { color: c.couleur }, customdata: noms,
      hovertemplate: `%{customdata}<br>${c.legende} : %{y:,.0f} ${R.unite_ic}<extra></extra>`,
    }));

    const annotations = [];
    const shapes = [];
    donnees.forEach((d, i) => {
      // Valeur au centre de chaque bloc
      let cumul = 0;
      const bulles = [];
      for (const c of R.contributeurs) {
        const v = d.valeurs[c.cle];
        const centre = cumul + v / 2;
        cumul += v;
        // Bloc trop fin : valeur au survol et dans le tableau (le chantier garde son fond)
        if (v !== 0 && (c.cle === "chantier" || Math.abs(v) / unPixel >= 14)) {
          annotations.push({
            x: i, y: centre, text: nombre(v), showarrow: false, font: { size: 14, color: c.texte },
            ...(c.cle === "chantier" ? { bgcolor: c.couleur } : {}),
          });
        }
        if (c.bulle && d.parts[c.cle] !== null) bulles.push({ y: centre, c, part: d.parts[c.cle] });
      }
      // Bulles de % à droite de la barre, écartées d'au moins 40 px
      for (const b of ecarter(bulles, 40 * unPixel)) {
        shapes.push({
          type: "circle", xref: "x", yref: "y", xsizemode: "pixel", ysizemode: "pixel",
          xanchor: i + demiBarre, yanchor: b.y, x0: 8, x1: 68, y0: -17, y1: 17,
          fillcolor: b.c.bulle, line: { color: K.contour_bulle, width: 1 },
        });
        annotations.push({
          x: i + demiBarre, y: b.y, xshift: 38, text: `<b>${pourcent(b.part)}</b>`, showarrow: false,
          font: { size: 15, color: K.blanc },
        });
      }
      // Total au-dessus de la barre (et du trait du seuil s'il passe juste au-dessus), nom sous la barre
      const seuil = d.seuil_construction;
      const seuilProche = seuil !== null && seuil >= d.total && seuil <= d.total + 30 * unPixel;
      annotations.push({
        x: i, y: seuilProche ? seuil : d.total, yanchor: "bottom", yshift: 4, showarrow: false,
        text: `<span style="font-size:10px;color:${K.gris_note}">${contexte.type === "zone" ? "Zone" : "Bâtiment"} : </span><b style="font-size:20px">${nombre(d.total)}</b>`,
      });
      annotations.push({
        x: i, y: 0, yanchor: "top", yshift: -10, showarrow: false, bgcolor: K.noir, borderpad: 5,
        text: `<b>${court(noms[i], Math.max(8, Math.floor(largeur / n / 10)))}</b>`, font: { size: 14, color: K.blanc },
      });
    });

    // Trait du seuil Ic construction, à comparer à composants + chantier
    donnees.forEach((d, i) => {
      if (d.seuil_construction === null) return;
      shapes.push({
        type: "line", x0: i - 0.29, x1: i + 0.29, y0: d.seuil_construction, y1: d.seuil_construction,
        line: { color: R.couleur_seuil, width: 3 },
      });
      annotations.push({
        x: i - 0.29, xanchor: "right", y: d.seuil_construction, showarrow: false, bgcolor: K.fond_etiquette,
        text: `<b>${nombre(d.seuil_construction)}</b>`, font: { size: 12, color: K.gris_fonce },
      });
    });

    // Repère « construction » à gauche de la première barre
    const xRepere = -0.33;
    shapes.push({
      type: "line", x0: xRepere, x1: xRepere, y0: 0, y1: donnees[0].construction,
      line: { color: K.gris_repere, width: 2 },
    });
    annotations.push({
      x: xRepere, y: donnees[0].construction / 2, xshift: -12, text: "construction", textangle: -90,
      showarrow: false, font: { size: 15, color: K.gris_fonce },
    });
    // Sol
    shapes.push({ type: "line", xref: "paper", x0: 0, x1: 1, y0: 0, y1: 0, line: { color: K.noir, width: 4 } });

    const notes = [
      "Valeurs arrondies à l'unité, total = somme des arrondis. Parts en % de composants + chantier + énergie (l'eau n'a pas de part). " +
      "Le seuil Ic construction, lu dans le RSEE, porte sur composants + chantier seulement : énergie et eau ne comptent pas.",
    ];
    entites.forEach((e, i) => {
      if (donnees[i].energie_saisie) notes.push(`${noms[i]} : Ic énergie saisi à la main, valeur hors RSEE, non enregistrée.`);
      else if (donnees[i].absents.length) {
        notes.push(`${noms[i]} : non renseigné dans le RSEE, compté 0 : ${donnees[i].absents.join(", ")}.`);
      }
    });

    return {
      traces,
      layout: miseEnPage({
        height: hauteur, margin: { ...marges }, barmode: "stack", annotations, shapes,
        xaxis: { range: n === 1 ? [-0.9, 1.3] : [-0.75, n - 1 + 0.95], showticklabels: false, showgrid: false, zeroline: false, fixedrange: true },
        yaxis: { title: { text: `<i>${R.unite_ic}</i>` }, range: [0, yMax], showgrid: false, zeroline: false, fixedrange: true },
        showlegend: false,
      }),
      // Légende HTML : Plotly ne sait pas encadrer une partie de ses entrées
      legende: {
        hors_cadre: R.contributeurs.filter((c) => !c.construction).reverse(),
        cadre: {
          titre: "Ic construction = composants + chantier",
          postes: R.contributeurs.filter((c) => c.construction).reverse(),
          seuil: donnees.some((d) => d.seuil_construction !== null) ? { libelle: "Seuil Ic construction", couleur: R.couleur_seuil } : null,
        },
      },
      tableau: {
        colonnes: ["", ...R.contributeurs.map((c) => c.legende), "Total", "Construction", "Seuil Ic construction", "Part composants", "Part chantier", "Part énergie"],
        lignes: donnees.map((d, i) => [
          noms[i], ...R.contributeurs.map((c) => nombre(d.valeurs[c.cle])), nombre(d.total), nombre(d.construction),
          d.seuil_construction === null ? "–" : nombre(d.seuil_construction),
          pourcent(d.parts.composant), pourcent(d.parts.chantier), pourcent(d.parts.energie),
        ]),
      },
      notes,
    };
  }

  /* ---------- Ic composant par lot (G3) ---------- */

  function lots(entites, contexte, largeur) {
    const donnees = entites.map((e) => C.lots(e.impacts_lots, e.indicateurs.ic_composant));
    const noms = entites.map((e) => propre(e.nom));
    const x = noms.map((nom, i) => `${court(nom, 26)}${"​".repeat(i)}`); // catégories distinctes même si noms identiques
    const refs = Object.keys(R.lots).filter((r) => donnees.some((d) => r in d.valeurs));

    const traces = refs.map((r) => ({
      type: "bar", name: `${r}. ${R.lots[r].nom}`, x, y: donnees.map((d) => d.valeurs[r] ?? 0),
      width: 0.5, marker: { color: R.lots[r].couleur, line: { color: K.blanc, width: 1 } }, customdata: noms,
      hovertemplate: `%{customdata}<br>${r}. ${R.lots[r].nom} : %{y:,.1f} ${R.unite_ic}<extra></extra>`,
    }));
    traces.push({
      type: "scatter", mode: "markers+text", name: "Ic composants (RSEE)", x,
      y: entites.map((e) => e.indicateurs.ic_composant ?? null),
      text: entites.map((e) => (e.indicateurs.ic_composant === null || e.indicateurs.ic_composant === undefined ? "" : nombre(e.indicateurs.ic_composant))),
      textposition: "top center", textfont: { size: 12, color: K.noir }, marker: { color: K.noir, size: 10 },
      customdata: noms, hovertemplate: `%{customdata}<br>Ic composants : %{y:,.0f} ${R.unite_ic}<extra></extra>`,
    });

    // Étiquettes de macro-lots au centre vertical de chaque groupe de segments
    const annotations = [];
    donnees.forEach((d, i) => {
      for (const m of d.macro_lots) {
        if (!m.part) continue;
        const dessous = Object.keys(d.valeurs).filter((r) => Number(r) < m.lots[0]).reduce((s, r) => s + d.valeurs[r], 0);
        annotations.push({
          x: x[i], y: dessous + m.valeur / 2, text: `<b>${pourcent(m.part)}</b>`, showarrow: false,
          font: { size: 13, color: K.blanc }, bgcolor: m.couleur, borderpad: 3,
        });
      }
    });

    const notes = ["Impact d'un lot : valeur du RSEE, ou somme de ses phases quand elle vaut 0. Étiquettes : gros œuvre (lots 2-3), second œuvre (lots 4-7), lots techniques (lots 8-13), en % hors lot 1."];
    donnees.forEach((d, i) => {
      if (d.ecart !== null && Math.abs(d.ecart) > R.ecart_lots_alerte) {
        notes.push(`${noms[i]} : la somme des lots (${nombre(d.somme)}) s'écarte de ${signe(d.ecart * 100)} % de l'Ic composants du RSEE (${nombre(entites[i].indicateurs.ic_composant)}).`);
      }
    });

    return {
      traces,
      layout: miseEnPage({
        height: largeur < LARGEUR_ETROITE ? D.lots.hauteur_etroite : D.lots.hauteur, margin: { ...D.lots.marges }, barmode: "stack", annotations,
        xaxis: { type: "category", fixedrange: true },
        yaxis: { title: { text: R.unite_ic }, rangemode: "tozero", gridcolor: R.couleur_grille, fixedrange: true },
        legend: legendeSelon(largeur, { title: { text: "Lot" }, traceorder: "reversed" }),
      }),
      tableau: {
        colonnes: ["Lot", ...noms],
        lignes: [
          ...refs.map((r) => [`${r}. ${R.lots[r].nom}`, ...donnees.map((d) => (r in d.valeurs ? nombre(d.valeurs[r], 1) : "–"))]),
          ...R.macro_lots.map((m, k) => [`${m.nom} (${m.texte_lots})`, ...donnees.map((d) => pourcent(d.macro_lots[k].part))]),
          ["Somme des lots", ...donnees.map((d) => nombre(d.somme, 1))],
        ],
      },
      notes,
    };
  }

  /* ---------- Sous-lots les plus impactants ---------- */

  function nomLigneSousLot(l) {
    if (l.non_detaille) return `Lot ${l.lot} ${R.lots[l.lot]?.nom ?? ""} — non détaillé`;
    const nom = NOMENCLATURE_LOTS[l.lot]?.sous_lots[l.sous_lot] ?? "";
    return `${l.sous_lot} ${nom}`.trim();
  }

  function sousLots(entites, contexte, largeur) {
    if (entites.length !== 1) return { message: "Sélectionnez un bâtiment ou une zone : le classement se lit bâtiment par bâtiment." };
    const e = entites[0];
    const { lignes, nb_total } = C.topSousLots(e.impacts_lots, contexte.etat.top_n);
    if (!lignes.length) return { message: "Aucun impact par sous-lot dans ce RSEE." };
    const ic = e.indicateurs.ic_composant;
    const noms = lignes.map(nomLigneSousLot);
    const limite = largeur < LARGEUR_ETROITE ? 22 : 48;
    const etiquettes = noms.map((nom, i) => `${court(nom, limite)}${"​".repeat(i)}`);
    return {
      traces: [{
        type: "bar", orientation: "h", y: etiquettes, x: lignes.map((l) => l.valeur),
        marker: { color: lignes.map((l) => R.lots[l.lot]?.couleur ?? K.lot_inconnu), line: { color: K.gris_fonce, width: 0.5 } },
        text: lignes.map((l) => `${nombre(l.valeur)}${ic ? ` · ${pourcent(l.valeur / ic)}` : ""}`),
        textposition: "outside", cliponaxis: false, customdata: noms,
        hovertemplate: `%{customdata}<br>%{x:,.1f} ${R.unite_ic}<extra></extra>`,
      }],
      layout: miseEnPage({
        height: D.sous_lots.base + D.sous_lots.ligne * lignes.length, margin: { ...D.sous_lots.marges },
        xaxis: { title: { text: R.unite_ic }, rangemode: "tozero", gridcolor: R.couleur_grille, fixedrange: true },
        yaxis: { type: "category", autorange: "reversed", automargin: true, ticksuffix: ECART_LIBELLE, fixedrange: true },
      }),
      tableau: {
        colonnes: ["Sous-lot", R.unite_ic, "Part de l'Ic composants"],
        lignes: lignes.map((l, i) => [noms[i], nombre(l.valeur, 1), ic ? pourcent(l.valeur / ic, 1) : "–"]),
      },
      notes: [
        `${lignes.length} postes affichés sur ${nb_total}. Le RSEE ne donne pas d'impact par fiche : le sous-lot est le niveau le plus fin. ` +
        "« Non détaillé » : part du lot absente de ses sous-lots. Couleur = lot.",
      ],
    };
  }

  /* ---------- Nombre de fiches par type (G5) ---------- */

  function typesFiches(entites, contexte, largeur) {
    const donnees = entites.map((e) => C.compterTypes(e.lignes));
    const noms = entites.map((e) => propre(e.nom));
    const x = noms.map((nom, i) => `${court(nom, 26)}${"​".repeat(i)}`);
    const presents = R.types_fiches.filter((t) => donnees.some((d) => d.compte[t.cle] > 0));
    if (!presents.length) return { message: "Aucune fiche de composant dans ce RSEE." };
    return {
      traces: presents.map((t) => ({
        type: "bar", name: t.libelle, x, y: donnees.map((d) => d.compte[t.cle]), width: 0.5,
        marker: remplissage(t), text: donnees.map((d) => (d.compte[t.cle] ? nombre(d.compte[t.cle]) : "")),
        textposition: "inside", insidetextanchor: "middle", textangle: 0, textfont: { color: t.texte, size: 13 },
        customdata: noms, hovertemplate: `%{customdata}<br>${t.libelle} : %{y:,.0f} fiches<extra></extra>`,
      })),
      layout: miseEnPage({
        height: D.types.hauteur, margin: { ...D.types.marges }, barmode: "stack",
        uniformtext: { mode: "hide", minsize: 10 },
        xaxis: { type: "category", fixedrange: true },
        yaxis: { title: { text: "Nombre de fiches" }, rangemode: "tozero", gridcolor: R.couleur_grille, fixedrange: true },
        legend: legendeSelon(largeur, { traceorder: "reversed" }),
        annotations: donnees.map((d, i) => ({
          x: x[i], y: d.total, yanchor: "bottom", yshift: 3, text: `<b>Σ ${nombre(d.total)}</b>`, showarrow: false,
        })),
      }),
      tableau: {
        colonnes: ["Type de fiche", ...noms],
        lignes: [
          ...R.types_fiches.map((t) => [t.libelle, ...donnees.map((d) => nombre(d.compte[t.cle]))]),
          ["Total", ...donnees.map((d) => nombre(d.total))],
        ],
      },
      notes: [
        "Composants seulement, lignes des zones regroupées comme dans l'onglet Composants. « Autres » : forfaitaire, conventionnel, réemploi. " +
        "Les PEP extrapolées ne sont pas identifiables dans le RSEE : elles comptent comme PEP.",
      ],
    };
  }

  /* ---------- Nature des fiches par lot (G6) ---------- */

  function naturesFiches(entites, contexte, largeur) {
    const { lignes, sans_lot } = C.naturesParLot(entites);
    if (!lignes.length) return { message: "Aucune fiche rattachée à un lot dans ce RSEE." };
    const etroit = largeur < LARGEUR_ETROITE;
    const y = lignes.map((l) => (etroit ? `${l.lot}. ${R.lots[l.lot].nom}` : R.lots_longs[l.lot]));
    const presentes = R.natures.filter((n) => lignes.some((l) => l.compte[n.cle]));
    const plusieurs = entites.length > 1;
    const decimales = plusieurs ? 1 : 0;

    const traces = presentes.map((n) => ({
      type: "bar", orientation: "h", name: n.libelle, y, x: lignes.map((l) => l.parts[n.cle]),
      marker: {
        ...remplissage(n),
        line: { color: K.trait_segment, width: 0.5 },
      },
      text: lignes.map((l) => (l.parts[n.cle] >= R.part_minimale_etiquette ? `${nombre(l.parts[n.cle])} %` : "")),
      textposition: "inside", insidetextanchor: "middle", textangle: 0, textfont: { size: 12, color: n.texte },
      customdata: lignes.map((l) => l.compte[n.cle] || 0),
      hovertemplate: `%{y}<br>${n.libelle} : %{x:.1f} % (%{customdata} fiches)<extra></extra>`,
    }));

    // Colonne à droite du tracé : nombre de fiches (moyenne par bâtiment pour un projet)
    const annotations = lignes.map((l, i) => ({
      x: 1.015, xref: "paper", xanchor: "left", y: y[i], text: nombre(l.moyenne, decimales),
      showarrow: false, font: { color: K.gris_fiches },
    }));
    annotations.push({
      x: 1.015, xref: "paper", xanchor: "left", y: 1, yref: "paper", yanchor: "bottom", showarrow: false,
      text: plusieurs ? "Fiches moy.<br>par bât." : "Fiches", font: { size: 11, color: K.gris_fiches },
    });

    const notes = [];
    if (sans_lot) notes.push(`${sans_lot} fiche(s) sans lot ne figurent pas dans ce graphique.`);
    notes.push("Forfaitaire : codes 5 et 6, et fiches codées 3 dont le nom contient « forfaitaire » (règle à vérifier, voir ROADMAP). Le RSEE ne distingue pas fiches individuelles et collectives.");

    const total = lignes.reduce((s, l) => s + l.total, 0);
    const nbEntites = entites.filter((e) => e.lignes.length).length;
    return {
      traces,
      layout: miseEnPage({
        height: Math.max(D.natures.minimum, D.natures.ligne * lignes.length + D.natures.base), margin: { ...D.natures.marges },
        barmode: "stack", bargap: 0.35, annotations, uniformtext: { mode: "hide", minsize: 9 },
        xaxis: { title: { text: "% du nombre de fiches" }, range: [0, 100], gridcolor: R.couleur_grille, fixedrange: true },
        yaxis: { type: "category", autorange: "reversed", automargin: true, ticksuffix: ECART_LIBELLE, fixedrange: true },
        legend: legendeBas(),
      }),
      cartes: C.fichesMacroLots(entites).map((m) => ({
        nom: m.macro.nom,
        couleur: m.macro.couleur,
        lots: m.macro.texte_lots,
        part_specifique: pourcent(m.part_specifique),
        part_defaut: "vs " + pourcent(m.part_defaut),
        detail: `DED ${pourcent(m.part_ded)} · forfaitaire ${pourcent(m.part_forfaitaire)}`,
        effectif: `${nombre(m.fiches)} fiches${plusieurs ? ` · ${m.nb_entites} bâtiments` : ""}`,
      })),
      tableau: {
        colonnes: ["Lot", ...presentes.map((n) => n.libelle), "Fiches"],
        lignes: lignes.map((l) => [R.lots_longs[l.lot], ...presentes.map((n) => nombre(l.compte[n.cle] || 0)), nombre(l.total)]),
      },
      notes: [`${nombre(total)} fiches${plusieurs ? `, ${nbEntites} bâtiments` : ""}.`, ...notes],
    };
  }

  /* ---------- Écarts aux seuils (G7) ---------- */

  function ecarts(entites, contexte) {
    const donnees = entites.map((e) => C.ecartsSeuils(e.indicateurs));
    const noms = entites.map((e) => propre(e.nom));
    const libelles = R.ecarts.map((e) => e.libelle);
    const seul = entites.length === 1;
    const tous = donnees.flat().map((d) => d.ecart).filter((v) => v !== null);
    if (!tous.length) return { message: "Aucun écart calculable : valeurs ou seuils absents du RSEE." };
    const borne = Math.max(10, ...tous.map(Math.abs)) * 1.3;
    const texteEcart = (d) => `${signe(d.ecart)} %`;
    const survol = (d) => `${d.libelle} : ${nombre(d.valeur, d.decimales)} pour un seuil de ${nombre(d.seuil, d.decimales)} ${d.unite}`;

    let traces;
    if (seul) {
      const mesures = donnees[0].filter((d) => d.ecart !== null);
      traces = [{
        type: "bar", orientation: "h", y: mesures.map((d) => d.libelle), x: mesures.map((d) => d.ecart),
        marker: { color: mesures.map((d) => d.couleur) },
        text: mesures.map((d) => `${d.statut === "depasse" ? "✕" : "✓"} ${texteEcart(d)}`),
        textposition: "outside", cliponaxis: false, customdata: mesures.map(survol),
        hovertemplate: "%{customdata}<br>Écart : %{x:.1f} %<extra></extra>",
      }];
    } else {
      // Projet : un point par bâtiment, couleur de l'indicateur
      traces = R.ecarts.map((e, k) => {
        const points = donnees.map((d, i) => ({ d: d[k], nom: noms[i] })).filter((p) => p.d.ecart !== null);
        return {
          type: "scatter", mode: "markers", name: e.libelle, y: points.map(() => e.libelle), x: points.map((p) => p.d.ecart),
          marker: { color: e.couleur, size: 13, line: { color: K.blanc, width: 1.5 } },
          customdata: points.map((p) => `${p.nom}<br>${survol(p.d)}`),
          hovertemplate: "%{customdata}<br>Écart : %{x:.1f} %<extra></extra>",
        };
      });
    }

    const absents = R.ecarts.filter((e, k) => donnees.every((d) => d[k].ecart === null)).map((e) => e.libelle);
    const notes = ["Écart = (valeur − seuil) / seuil. Négatif : sous le seuil. Positif : au-dessus, non conforme. Seuils lus dans le RSEE ; DH : groupe le plus défavorable."];
    if (contexte.type === "zone") notes.push("Les exigences Ic, Bbio et Cep s'appliquent au bâtiment : les valeurs de zone sont données pour information.");
    if (absents.length) notes.push(`Non calculable : ${absents.join(", ")}.`);

    return {
      traces,
      layout: miseEnPage({
        height: D.ecarts.hauteur, margin: { ...D.ecarts.marges }, showlegend: false,
        xaxis: { title: { text: "Écart au seuil (%)" }, range: [-borne, borne], gridcolor: R.couleur_grille, zeroline: false, ticksuffix: " %", fixedrange: true },
        yaxis: { type: "category", categoryorder: "array", categoryarray: libelles, autorange: "reversed", automargin: true, gridcolor: R.couleur_grille, fixedrange: true },
        shapes: [{ type: "line", yref: "paper", x0: 0, x1: 0, y0: 0, y1: 1, line: { color: K.gris_fonce, width: 1.5, dash: "dot" } }],
        annotations: [
          { x: 0, xshift: -8, xanchor: "right", y: 1, yref: "paper", yanchor: "bottom", text: "← sous le seuil", showarrow: false, font: { size: 12, color: K.gris_fonce } },
          { x: 0, xshift: 8, xanchor: "left", y: 1, yref: "paper", yanchor: "bottom", text: "au-dessus du seuil →", showarrow: false, font: { size: 12, color: K.gris_fonce } },
        ],
      }),
      tableau: {
        colonnes: ["Indicateur", ...noms],
        lignes: R.ecarts.map((e, k) => [e.libelle, ...donnees.map((d) => (d[k].ecart === null ? "–" : texteEcart(d[k])))]),
      },
      notes,
    };
  }

  /* ---------- StockC face au label biosourcé (G8) ---------- */

  function stockC(entites, contexte, largeur) {
    const S = R.stock_c;
    const noms = entites.map((e) => propre(e.nom));
    const valeurs = entites.map((e) => C.stockC(e.indicateurs));
    const presents = valeurs.map((v, i) => ({ v, nom: noms[i], i })).filter((p) => p.v !== null);
    if (!presents.length) return { message: "StockC absent de ce RSEE." };
    const dernier = S.reperes[S.reperes.length - 1].valeur;
    const xMax = Math.max(dernier * 1.15, ...presents.map((p) => p.v * 1.2));
    const y = presents.map((p) => `${court(p.nom, largeur < LARGEUR_ETROITE ? 14 : 30)}${"​".repeat(p.i)}`);

    // Libellés des repères en escalier au-dessus du tracé : ils ne se chevauchent jamais
    const annotations = S.reperes.map((r, k) => ({
      x: r.valeur, y: 1, yref: "paper", yanchor: "bottom", yshift: 4 + 18 * (S.reperes.length - 1 - k),
      xanchor: r.valeur / xMax < 0.6 ? "left" : "right", text: r.libelle, showarrow: false, font: { size: 11, color: S.couleur_repere },
    }));
    return {
      traces: [{
        type: "bar", orientation: "h", y, x: presents.map((p) => p.v), width: 0.5, marker: { color: S.couleur },
        text: presents.map((p) => `<b>${nombre(p.v, 1)}</b>`), textposition: "outside", cliponaxis: false,
        customdata: presents.map((p) => p.nom),
        hovertemplate: `%{customdata}<br>StockC : %{x:.1f} ${R.unite_stock}<extra></extra>`,
      }],
      layout: miseEnPage({
        height: D.stock.base + D.stock.ligne * presents.length, margin: { ...D.stock.marges }, showlegend: false, annotations,
        shapes: S.reperes.map((r) => ({
          type: "line", yref: "paper", x0: r.valeur, x1: r.valeur, y0: 0, y1: 1,
          line: { color: S.couleur_repere, width: 1.5, dash: "dot" },
        })),
        xaxis: { title: { text: `Stock carbone (${R.unite_stock})` }, range: [0, xMax], gridcolor: R.couleur_grille, fixedrange: true },
        yaxis: { type: "category", autorange: "reversed", automargin: true, ticksuffix: ECART_LIBELLE, fixedrange: true },
      }),
      tableau: {
        colonnes: ["", `StockC (${R.unite_stock})`],
        lignes: presents.map((p) => [p.nom, nombre(p.v, 1)]),
      },
      notes: ["Pointillés : seuils du label bâtiment biosourcé 2024, donnés comme repères. Ce graphique ne vaut pas attribution du label."],
    };
  }

  /* ---------- Liste des graphiques d'une vue ---------- */

  function liste(entites, contexte) {
    const etat = contexte.etat;
    const avec = (fonction) => (largeur) => fonction(entites, contexte, largeur);

    // Champ de saisie pour chaque entité dont le RSEE ne donne pas l'Ic énergie
    const saisiesEnergie = entites
      .filter((e) => (e.indicateurs.ic_energie ?? null) === null)
      .map((e) => ({
        libelle: `Ic énergie de ${propre(e.nom)} (absent du RSEE)`,
        valeur: etat.energie[e.cle],
        appliquer: (v) => {
          if (v === null) delete etat.energie[e.cle];
          else etat.energie[e.cle] = v;
        },
      }));

    const graphiques = [
      { id: "contributeurs", titre: "Répartition de l'impact carbone par contributeur", sous_titre: R.unite_ic, parametres: saisiesEnergie, construire: avec(contributeurs) },
      { id: "lots", titre: "Impact carbone des matériaux : Ic composants par lot", sous_titre: R.unite_ic, construire: avec(lots) },
      { id: "ecarts", titre: "Écart aux seuils réglementaires", sous_titre: "Bbio, Cep, Cep,nr, DH, Ic construction, Ic énergie", construire: avec(ecarts) },
      { id: "types", titre: "Nombre de fiches par type", construire: avec(typesFiches) },
      { id: "natures", titre: "Nature des fiches par lot", sous_titre: "% du nombre de fiches", construire: avec(naturesFiches) },
      { id: "stock", titre: "Stock de carbone face au label bâtiment biosourcé", construire: avec(stockC) },
    ];

    // Graphiques propres à un bâtiment ou une zone
    if (entites.length === 1) {
      graphiques.splice(3, 0, {
        id: "sous_lots", titre: "Sous-lots les plus impactants", sous_titre: R.unite_ic,
        parametres: [{
          libelle: "Nombre de postes affichés", valeur: etat.top_n, min: R.top_n_min, max: R.top_n_max, pas: 1,
          appliquer: (v) => {
            etat.top_n = Math.min(R.top_n_max, Math.max(R.top_n_min, Math.round(v ?? R.top_n_defaut)));
          },
        }],
        construire: avec(sousLots),
      });
    }
    return graphiques;
  }

  return { CONFIG, liste };
})();
