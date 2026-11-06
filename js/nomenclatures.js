/* =====================================================================
   lecteur_RSEE — nomenclatures RE2020
   Lots et sous-lots du contributeur « composants », repérés dans le RSEE
   par l'attribut ref (<lot ref="2">, <sous_lot ref="2.1">).
   Source : donnees/nomenclature_lots_sous_lots_RE2020.csv
   (à garder synchronisé : le test tests/test_lecture.py le vérifie).
   ===================================================================== */

"use strict";

const NOMENCLATURE_LOTS = {
  "1": {
    nom: "VRD (voirie et réseaux divers)",
    nom_court: "VRD",
    macro_lot: "VRD",
    sous_lots: {
      "1.1": "Réseaux (extérieurs, mise en œuvre, raccordement)",
      "1.2": "Stockage",
      "1.3": "Aires de stationnement extérieures",
    },
  },
  "2": {
    nom: "Fondations et infrastructure",
    nom_court: "Fondations",
    macro_lot: "Gros œuvre",
    sous_lots: {
      "2.1": "Fondations",
      "2.2": "Murs et structures enterrées (escalier de cave, parking…)",
      "2.3": "Parcs de stationnement en superstructure (hors garages des maisons individuelles ou accolées)",
    },
  },
  "3": {
    nom: "Superstructure – Maçonnerie",
    nom_court: "Superstructure",
    macro_lot: "Gros œuvre",
    sous_lots: {
      "3.1": "Éléments horizontaux – planchers, dalles, balcons",
      "3.2": "Éléments horizontaux – poutres",
      "3.3": "Éléments verticaux – façades",
      "3.4": "Éléments verticaux – refends",
      "3.5": "Éléments verticaux – poteaux",
      "3.6": "Escaliers et rampes",
      "3.7": "Éléments d'isolation",
      "3.8": "Maçonneries diverses",
    },
  },
  "4": {
    nom: "Couverture – Étanchéité – Charpente – Zinguerie",
    nom_court: "Couverture",
    macro_lot: "Second œuvre",
    sous_lots: {
      "4.1": "Toitures terrasses",
      "4.2": "Toitures en pente",
      "4.3": "Éléments techniques de toiture",
    },
  },
  "5": {
    nom: "Cloisonnement – Doublage – Plafonds suspendus – Menuiseries intérieures",
    nom_court: "Cloisonnement",
    macro_lot: "Second œuvre",
    sous_lots: {
      "5.1": "Cloisons et portes intérieures",
      "5.2": "Doublages muraux, matériaux de protection, isolants et membranes",
      "5.3": "Plafonds suspendus",
      "5.4": "Planchers surélevés",
      "5.5": "Menuiseries, métalleries et quincailleries",
    },
  },
  "6": {
    nom: "Façades et menuiseries extérieures",
    nom_court: "Façades",
    macro_lot: "Second œuvre",
    sous_lots: {
      "6.1": "Revêtement, isolation et doublage extérieur",
      "6.2": "Portes, fenêtres, fermetures, protections solaires",
      "6.3": "Habillages et ossatures",
    },
  },
  "7": {
    nom: "Revêtements des sols, murs et plafonds – Chape – Peintures – Produits de décoration",
    nom_court: "Revêtements intérieurs",
    macro_lot: "Second œuvre",
    sous_lots: {
      "7.1": "Revêtements des sols",
      "7.2": "Revêtements des murs et plafonds",
      "7.3": "Éléments de décoration et revêtements des menuiseries",
    },
  },
  "8": {
    nom: "CVC (chauffage – ventilation – refroidissement – eau chaude sanitaire)",
    nom_court: "CVC",
    macro_lot: "Lots techniques",
    sous_lots: {
      "8.1": "Équipements de production (chaud / froid), hors cogénération",
      "8.2": "Systèmes de cogénération",
      "8.3": "Systèmes d'émission",
      "8.4": "Traitement de l'air et éléments de désenfumage",
      "8.5": "Réseaux et conduits",
      "8.6": "Stockage de combustibles",
      "8.7": "Fluides frigorigènes",
    },
  },
  "9": {
    nom: "Installations sanitaires",
    nom_court: "Installations sanitaires",
    macro_lot: "Lots techniques",
    sous_lots: {
      "9.1": "Éléments sanitaires et robinetterie",
      "9.2": "Canalisations, réseaux et systèmes de traitement",
    },
  },
  "10": {
    nom: "Réseaux d'énergie (courant fort)",
    nom_court: "Courant fort",
    macro_lot: "Lots techniques",
    sous_lots: {
      "10.1": "Réseaux électriques",
      "10.2": "Ensemble de dispositifs pour la sécurité",
      "10.3": "Éclairage intérieur",
      "10.4": "Éclairage extérieur sur le bâtiment",
      "10.5": "Systèmes d’automatisation et de contrôle",
      "10.6": "Tableaux et appareillages",
    },
  },
  "11": {
    nom: "Réseaux de communication (courant faible)",
    nom_court: "Courant faible",
    macro_lot: "Lots techniques",
    sous_lots: {
      "11.1": "Réseaux électriques et de communications",
      "11.2": "Systèmes de sécurité (personnes et bien)",
      "11.3": "Installations techniques et appareillages",
    },
  },
  "12": {
    nom: "Appareils élévateurs et autres équipements de transport intérieur",
    nom_court: "Appareils élévateurs",
    macro_lot: "Lots techniques",
    sous_lots: {
      "12.1": "Ascenseurs, monte-charges, escaliers mécaniques, trottoirs roulants et nacelles de nettoyage",
    },
  },
  "13": {
    nom: "Équipement de production locale d'électricité",
    nom_court: "Photovoltaique",
    macro_lot: "Lots techniques",
    sous_lots: {
      "13.1": "Installation associée au bâtiment, dédiée à la production d’électricité",
    },
  },
};
