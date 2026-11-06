/* =====================================================================
   lecteur_RSEE — tableau des composants (fonctions sans interface)
   Regroupement, filtres et tri des lignes lues par js/lecture.js.

   Regroupement : dans un bâtiment à plusieurs zones, les logiciels
   répartissent chaque fiche entre les zones au prorata de leur Sref.
   Pour la vue bâtiment, les lignes identiques (même position, même fiche,
   même unité, même DVE) sont fusionnées et leurs quantités additionnées.
   Aucun impact n'est calculé : le RSEE ne donne pas d'impact par composant.
   ===================================================================== */

"use strict";

const Composants = (() => {
  // Ordre d'affichage des contributeurs
  const ORDRE_CONTRIBUTEURS = ["composant", "energie", "eau", "chantier"];

  // Champs qui identifient une même ligne d'une zone à l'autre
  const CLES_REGROUPEMENT = [
    "batiment", "contributeur", "lot", "sous_lot", "sous_contributeur",
    "id_base", "id_fiche", "id_produit", "nom", "type_donnees", "unite_uf", "dve",
  ];

  // Somme en ignorant les valeurs absentes (null si toutes absentes)
  function somme(a, b) {
    if (a === null || a === undefined) return b ?? null;
    if (b === null || b === undefined) return a;
    return a + b;
  }

  // Fusionne les lignes identiques de zones différentes ; garde la première comme modèle.
  // Une même fiche peut figurer plusieurs fois dans une zone (usages distincts) :
  // la n-ième occurrence d'une zone est appariée à la n-ième des autres zones,
  // pour ne jamais additionner deux lignes d'une même zone.
  function regrouper(lignes) {
    const groupes = new Map();
    const occurrences = new Map(); // (zone, clé) -> nombre de fois déjà vue
    for (const l of lignes) {
      const base = CLES_REGROUPEMENT.map((c) => l[c] ?? "").join("␟");
      const cleZone = (l.zone ?? "") + "␞" + base;
      const rangDansZone = occurrences.get(cleZone) || 0;
      occurrences.set(cleZone, rangDansZone + 1);
      const cle = base + "␞" + rangDansZone;
      const g = groupes.get(cle);
      if (g) {
        g.quantite = somme(g.quantite, l.quantite);
        g.nb_lignes += 1;
        if (l.zone !== null) g.zones.add(l.zone);
        if (!g.commentaire && l.commentaire) g.commentaire = l.commentaire;
      } else {
        groupes.set(cle, Object.assign({}, l, {
          nb_lignes: 1,
          zones: new Set(l.zone !== null ? [l.zone] : []),
        }));
      }
    }
    return Array.from(groupes.values());
  }

  // Clé de tri « position » : contributeur, lot, sous-lot, sous-contributeur, ordre du RSEE
  function numero(ref) {
    if (ref === null || ref === undefined) return [-1];
    return String(ref).split(".").map((x) => Number(x) || 0);
  }
  function comparerNumeros(a, b) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const d = (a[i] ?? -1) - (b[i] ?? -1);
      if (d) return d;
    }
    return 0;
  }
  // Rang du bâtiment ; lignes de la parcelle (sans bâtiment) en dernier
  const rangBatiment = (l) => (l.batiment === null || l.batiment === undefined ? Number.MAX_SAFE_INTEGER : Number(l.batiment) || 0);
  function comparerPosition(a, b) {
    return (
      rangBatiment(a) - rangBatiment(b) ||
      ORDRE_CONTRIBUTEURS.indexOf(a.contributeur) - ORDRE_CONTRIBUTEURS.indexOf(b.contributeur) ||
      comparerNumeros(numero(a.lot), numero(b.lot)) ||
      comparerNumeros(numero(a.sous_lot), numero(b.sous_lot)) ||
      comparerNumeros(numero(a.sous_contributeur), numero(b.sous_contributeur)) ||
      a.rang - b.rang
    );
  }

  // Comparateurs par colonne ; les valeurs absentes vont en fin de liste
  const COMPARATEURS = {
    position: comparerPosition,
    nom: (a, b) => (a.nom || "").localeCompare(b.nom || "", "fr", { sensitivity: "base" }),
    type: (a, b) => (Number(a.type_donnees) || 0) - (Number(b.type_donnees) || 0),
    quantite: (a, b) => (a.quantite ?? -Infinity) - (b.quantite ?? -Infinity),
    dve: (a, b) => (a.dve ?? -Infinity) - (b.dve ?? -Infinity),
  };

  // Tri stable ; sens = 1 (croissant) ou -1 (décroissant). Égalités départagées par la position.
  function trier(lignes, cle, sens) {
    const cmp = COMPARATEURS[cle] || comparerPosition;
    return lignes.slice().sort((a, b) => sens * cmp(a, b) || comparerPosition(a, b));
  }

  // Filtres : texte (nom, identifiants, commentaire), contributeur, lot, type de donnée
  function filtrer(lignes, f) {
    const recherche = (f.recherche || "").trim().toLowerCase();
    return lignes.filter((l) => {
      if (f.contributeur && l.contributeur !== f.contributeur) return false;
      if (f.lot && l.lot !== f.lot) return false;
      if (f.type && l.type_donnees !== f.type) return false;
      if (recherche) {
        const texte = [l.nom, l.id_fiche, l.id_produit, l.commentaire].filter(Boolean).join(" ").toLowerCase();
        if (!texte.includes(recherche)) return false;
      }
      return true;
    });
  }

  // Valeurs distinctes d'un champ (pour remplir les listes de filtres), triées
  function valeursDistinctes(lignes, champ) {
    const valeurs = Array.from(new Set(lignes.map((l) => l[champ]).filter((v) => v !== null && v !== undefined)));
    return valeurs.sort((a, b) => comparerNumeros(numero(a), numero(b)) || String(a).localeCompare(String(b)));
  }

  return { ORDRE_CONTRIBUTEURS, regrouper, trier, filtrer, valeursDistinctes, comparerPosition };
})();
