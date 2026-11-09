/* =====================================================================
   lecteur_RSEE — interface
   Import du fichier (sélection, glisser-déposer), arborescence projet /
   bâtiments / zones / parcelles et navigation entre les onglets, dont
   chacun a son fichier js/onglet_*.js.
   ===================================================================== */

"use strict";

(() => {
  const {
    ICONES, el, formatNombre, formatTaille, creer, pastilleIcone, pastilles, decrire,
  } = Commun;

  // Sélection courante : onglet actif, nœud et parent affichés
  let ongletActif = "synthese";
  let noeudCourant = null;
  let parentCourant = null;

  // Texte d'information affiché tant qu'aucun fichier n'est lu
  const INFO_INITIALE = el.infoFichier.textContent.trim();
  const TITRE_ARBRE = el.titreArbre.textContent.trim();

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

    for (const b of Etat.modele.batiments) {
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
    for (const p of Etat.modele.parcelles) {
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
    el.titreDetail.textContent = REGLAGES.titres_onglets[ongletActif];
    OngletGraphiques.liberer();
    if (!Etat.modele || !noeudCourant) return afficherVide();
    // Composants, Graphiques : colonne d'arborescence plus étroite pour laisser la place au contenu
    el.detail.closest(".colonnes").classList.toggle("vue-large", ongletActif !== "synthese" && ongletActif !== "informations");
    const vues = {
      synthese: OngletSynthese.afficher,
      informations: OngletInformations.afficher,
      indicateurs: OngletIndicateurs.afficher,
      composants: OngletComposants.afficher,
      graphiques: OngletGraphiques.afficher,
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

    Etat.modele = resultat.modele;
    OngletComposants.reinitialiser(); // nouveaux filtres pour un nouveau fichier
    OngletGraphiques.reinitialiser();
    const duree = Math.round(performance.now() - debut);
    el.infoFichier.replaceChildren(
      document.createTextNode(`${Etat.modele.type_fichier} · ${formatTaille(fichier.size)} · lu en ${formatNombre(duree)} ms, localement.`)
    );
    el.titreArbre.textContent = `${TITRE_ARBRE} du ${Etat.modele.type_fichier}`;
    if (fichier.size > REGLAGES.taille_alerte) {
      el.infoFichier.append(document.createTextNode(" Fichier volumineux : l'affichage peut être lent."));
    }
    construireArbre();

    function echec(texteErreur) {
      OngletGraphiques.liberer();
      Etat.modele = null;
      el.infoFichier.textContent = INFO_INITIALE;
      el.titreArbre.textContent = TITRE_ARBRE;
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
