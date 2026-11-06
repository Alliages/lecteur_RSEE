/* =====================================================================
   lecteur_RSEE — onglet Synthèse
   Carte du nœud, écarts aux seuils et contrôle du fichier.
   ===================================================================== */

"use strict";

const OngletSynthese = (() => {
  const {
    ICONES, FONDS_TUILES, ESP, el, formatSigne, creer, pastilleIcone, pastilles, decrire,
    niveauxMarge, logoNiveau, legendeMarges,
  } = Commun;

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
    const sources = noeud.type === "projet" ? Etat.modele.batiments : [noeud];
    const groupes = sources.map((s) => ({ nom: s.nom, ecarts: CalculsGraphiques.ecartsSeuils(s.indicateurs) }));
    const valeurs = groupes.flatMap((g) => g.ecarts).map((e) => e.ecart).filter((v) => v !== null);
    if (valeurs.length === 0) return null;
    // Échelle commune à toutes les lignes, symétrique autour du seuil
    const borne = Math.max(2 * REGLAGES_GRAPHIQUES.marge_alerte, ...valeurs.map(Math.abs)) * REGLAGES.echelle_ecarts;
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
    if (Etat.modele.alertes.length === 0) {
      carte.append(creer("p", "ok", "Structure conforme : aucune alerte."));
    } else {
      const ul = creer("ul", "liste-alertes");
      for (const a of Etat.modele.alertes) ul.append(creer("li", null, a));
      carte.append(ul);
    }
    return carte;
  }

  return { afficher: afficherDetail };
})();
