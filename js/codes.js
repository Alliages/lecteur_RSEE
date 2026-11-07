/* =====================================================================
   lecteur_RSEE — libellés des codes du RSEE
   Source : donnees/codes_RSEE.csv (à garder synchronisé : le test
   tests/test_lecture.py le vérifie).
   statut « déduit » : libellé déduit des noms de fiches d'un corpus de
   RSEE, pas d'une documentation officielle — à valider. Le code est
   toujours affiché à côté du libellé. Un code absent reste affiché brut.
   statut « documenté » : libellé repris d'une description du format.
   ===================================================================== */

"use strict";

const CODES_RSEE = {
  type_donnees: {
    "1": { libelle: "FDES", statut: "déduit" },
    "2": { libelle: "PEP", statut: "déduit" },
    "3": { libelle: "Donnée par défaut (DED)", statut: "déduit" },
    "5": { libelle: "Donnée conventionnelle", statut: "déduit" },
    "6": { libelle: "Lot ou sous-lot forfaitaire", statut: "déduit" },
    "7": { libelle: "Fiche configurée", statut: "déduit" },
    "10": { libelle: "Réemploi", statut: "déduit" },
  },
  unite_uf: {
    "1": { libelle: "m³", statut: "déduit" },
    "2": { libelle: "m²", statut: "déduit" },
    "3": { libelle: "kg", statut: "déduit" },
    "4": { libelle: "m³", statut: "déduit" },
    "5": { libelle: "m (linéaire)", statut: "déduit" },
    "7": { libelle: "kWh", statut: "déduit" },
    "11": { libelle: "m (linéaire)", statut: "déduit" },
    "13": { libelle: "unité", statut: "déduit" },
  },
  usage: {
    "1": { libelle: "Maison individuelle ou accolée", statut: "déduit" },
    "2": { libelle: "Logement collectif", statut: "déduit" },
    "3": { libelle: "Bureaux", statut: "déduit" },
  },
  type_travaux: {
    "1": { libelle: "Construction neuve", statut: "déduit" },
  },
  phase: {
    "1": { libelle: "Programmation", statut: "documenté" },
    "2": { libelle: "Conception", statut: "documenté" },
    "3": { libelle: "Réalisation", statut: "documenté" },
    "4": { libelle: "Exploitation", statut: "documenté" },
  },
  contributeur: {
    "composant": { libelle: "Composants", statut: "balise" },
    "energie": { libelle: "Énergie", statut: "balise" },
    "eau": { libelle: "Eau", statut: "balise" },
    "chantier": { libelle: "Chantier", statut: "balise" },
  },
};

// Libellé d'un code, ou null s'il n'est pas dans la table
function libelleCode(champ, code) {
  const table = CODES_RSEE[champ];
  return table && code !== null && code !== undefined && table[code] ? table[code].libelle : null;
}
