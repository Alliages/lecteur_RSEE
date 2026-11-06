/* =====================================================================
   lecteur_RSEE — réglages des graphiques
   Palette « charte HUB » et paramètres de l'onglet Graphiques, repris du
   dashboard OPEE (graphiques 2 à 8). Le reste de l'interface garde sa
   propre palette (css/style.css).
   ===================================================================== */

"use strict";

const REGLAGES_GRAPHIQUES = {
  // Texte commun
  police: "Aptos, Arial, sans-serif",
  couleur_texte: "#283246",
  couleur_grille: "#E6E6EA",
  separateurs: ", ", // virgule décimale, espace insécable pour les milliers
  unite_ic: "kgCO₂e/m² sur 50 ans",
  unite_stock: "kg C/m² SDP",

  // Sous-lots les plus impactants : nombre affiché par défaut et bornes
  top_n_defaut: 10,
  top_n_min: 3,
  top_n_max: 40,
  // Reste d'un lot (lot − sous-lots) ignoré en dessous de cette valeur : arrondis des logiciels (kgCO₂e/m²)
  reste_lot_minimal: 0.5,
  // Écart relatif entre somme des lots et Ic composants au-delà duquel on prévient
  ecart_lots_alerte: 0.005,
  // Part minimale d'un segment pour y écrire son pourcentage (%)
  part_minimale_etiquette: 3,

  // Contributeurs, de bas en haut de la pile ; « bulle » : couleur de la part en % ;
  // « construction » : compté dans l'Ic construction, donc comparé à son seuil
  contributeurs: [
    { cle: "composant", champ: "ic_composant", legende: "Composants", couleur: "#283246", texte: "#FFFFFF", bulle: "#283246", construction: true },
    { cle: "chantier", champ: "ic_chantier", legende: "Chantier", couleur: "#9CAEC5", texte: "#000000", bulle: "#55739B", construction: true },
    { cle: "energie", champ: "ic_energie", legende: "Énergie", couleur: "#FFDD7B", texte: "#000000", bulle: "#FFC000" },
    { cle: "eau", champ: "ic_eau", legende: "Eau (sans seuil)", couleur: "#00B0F0", texte: "#000000", bulle: null },
  ],

  // Phases du cycle de vie comptées dans l'Ic ; Bexp (énergie exportée) n'y entre pas
  phases_ic: ["A1-A3", "A4-A5", "B", "C", "D"],

  // Trait du seuil Ic construction sur le graphique des contributeurs
  couleur_seuil: "#FF554B",

  // Avertissements de la Synthèse : marge sous le seuil, en %
  marge_alerte: 10,
  marge_alerte_forte: 5,

  // Lots RE2020 : libellé court et couleur
  lots: {
    1: { nom: "VRD", couleur: "#AAAAB2" },
    2: { nom: "Fondations", couleur: "#55739B" },
    3: { nom: "Superstructure", couleur: "#CCD3E3" },
    4: { nom: "Couverture", couleur: "#A51C00" },
    5: { nom: "Cloisonnement", couleur: "#FF5830" },
    6: { nom: "Façades", couleur: "#FF9994" },
    7: { nom: "Revêtements intérieurs", couleur: "#FFCCC0" },
    8: { nom: "CVC", couleur: "#304641" },
    9: { nom: "Installations sanitaires", couleur: "#476961" },
    10: { nom: "Courant fort", couleur: "#9DBCB5" },
    11: { nom: "Courant faible", couleur: "#BED3CF" },
    12: { nom: "Appareils élévateurs", couleur: "#CCD5D2" },
    13: { nom: "Photovoltaïque", couleur: "#D9E9E3" },
  },

  // Libellés longs des lots (graphique de la nature des fiches)
  lots_longs: {
    1: "Lot 1 – VRD, aménagements extérieurs",
    2: "Lot 2 – Fondations, infrastructure",
    3: "Lot 3 – Superstructure, maçonnerie",
    4: "Lot 4 – Couverture, étanchéité, charpente",
    5: "Lot 5 – Cloisonnement, plafonds suspendus",
    6: "Lot 6 – Façades, menuiseries extérieures",
    7: "Lot 7 – Revêtements, peintures",
    8: "Lot 8 – Équipements de génie climatique (CVC)",
    9: "Lot 9 – Installations sanitaires",
    10: "Lot 10 – Réseaux d'énergie (courants forts)",
    11: "Lot 11 – Réseaux de communication (courants faibles)",
    12: "Lot 12 – Appareils élévateurs",
    13: "Lot 13 – Production locale d'énergie",
  },

  // Macro-lots (le lot 1 VRD reste hors des pourcentages)
  macro_lots: [
    { nom: "Gros œuvre", lots: [2, 3], texte_lots: "lots 2 et 3", couleur: "#50608C" },
    { nom: "Second œuvre", lots: [4, 5, 6, 7], texte_lots: "lots 4 à 7", couleur: "#A50900" },
    { nom: "Lots techniques", lots: [8, 9, 10, 11, 12, 13], texte_lots: "lots 8 à 13", couleur: "#304641" },
  ],

  // Types de fiches, de bas en haut de la pile.
  // Les PEP extrapolées du dashboard OPEE ne sont pas identifiables dans un RSEE.
  types_fiches: [
    { cle: "fdes", libelle: "FDES", couleur: "#5F8C82", texte: "#FFFFFF" },
    { cle: "configuree", libelle: "Fiches configurées", couleur: "#55739B", hachure: "#5F8C82", texte: "#FFFFFF" },
    { cle: "pep", libelle: "PEP", couleur: "#55739B", texte: "#FFFFFF" },
    { cle: "ded", libelle: "DED", couleur: "#FA9600", texte: "#FFFFFF" },
    { cle: "autres", libelle: "Autres", couleur: "#AAAAB2", texte: "#333333" },
  ],

  // Natures de fiches, de gauche à droite. Le RSEE ne dit pas si une fiche est
  // individuelle ou collective : les natures du dashboard sont regroupées.
  // camp : « specifique » (FDES / PEP), « ded », « forfaitaire » ou « autres ».
  natures: [
    { cle: "fdes", libelle: "FDES", couleur: "#5F8C82", texte: "#FFFFFF", camp: "specifique" },
    { cle: "fdes_configuree", libelle: "FDES configurée", couleur: "#A0C8B9", hachure: "#5F8C82", texte: "#1F1F1F", camp: "specifique" },
    { cle: "fiche_configuree", libelle: "Fiche configurée", couleur: "#55739B", hachure: "#5F8C82", texte: "#FFFFFF", camp: "specifique" },
    { cle: "pep", libelle: "PEP", couleur: "#55739B", texte: "#FFFFFF", camp: "specifique" },
    { cle: "ded", libelle: "DED", couleur: "#FA9600", texte: "#FFFFFF", camp: "ded" },
    { cle: "forfaitaire", libelle: "Forfaitaire", couleur: "#FFAA96", texte: "#1F1F1F", camp: "forfaitaire" },
    { cle: "autres", libelle: "Autres (surtout réemploi)", couleur: "#AAAAB2", texte: "#1F1F1F", camp: "autres" },
  ],

  // Dernier lot où une fiche configurée compte comme FDES (au-delà : équipement)
  dernier_lot_fdes_configuree: 7,

  // Écarts aux seuils : ordre d'affichage et couleur (cle = INDICATEURS.exigences)
  ecarts: [
    { cle: "bbio", libelle: "Bbio", couleur: "#FF554B" },
    { cle: "cep", libelle: "Cep", couleur: "#FFAA96" },
    { cle: "cep_nr", libelle: "Cep,nr", couleur: "#5F8C82" },
    { cle: "dh", libelle: "DH", couleur: "#A0C8B9" },
    { cle: "ic_construction", libelle: "Ic construction", couleur: "#283246" },
    { cle: "ic_energie", libelle: "Ic énergie", couleur: "#55739B" },
  ],

  // StockC : repères du label bâtiment biosourcé
  stock_c: {
    couleur: "#5F8C82",
    couleur_repere: "#304641",
    reperes: [
      { valeur: 15, libelle: "Label biosourcé niveau 1 (15)" },
      { valeur: 25, libelle: "Label biosourcé niveau 2 (25)" },
      { valeur: 45, libelle: "Label biosourcé niveau 3 (45)" },
    ],
  },
};
