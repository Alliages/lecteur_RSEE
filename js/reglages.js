/* =====================================================================
   lecteur_RSEE — réglages
   Paramètres généraux de l'outil. Les autres réglages sont dans
   js/reglages_graphiques.js (graphiques) et js/reglages_seuils.js (seuils) ;
   les couleurs de l'interface dans css/style.css (variables en tête de fichier).
   ===================================================================== */

"use strict";

const REGLAGES = {
  // Version affichée (doit rester identique au fichier VERSION)
  version: "0.9.7",

  // Extensions acceptées à l'import
  extensions_acceptees: [".xml"],

  // Taille au-delà de laquelle on prévient que la lecture peut être lente (octets)
  taille_alerte: 30 * 1024 * 1024,

  // Encodage utilisé si le prologue XML n'en déclare pas
  encodage_defaut: "utf-8",

  // Blocs attendus sous la racine <projet> d'un RSEE
  racine_attendue: "projet",
  blocs: {
    administratif: "Datas_Comp", // informations générales et acteurs
    energie: "RSET",             // résultats thermiques (Bbio, Cep, DH)
    environnement: "RSEnv",      // ACV : composants et indicateurs carbone
  },

  // Format des nombres affichés
  langue: "fr-FR",
  decimales_surface: 1,

  // Codes d'usage d'une zone de logement (individuel ou collectif) : seules ces zones ont un
  // nombre de logements significatif (le champ vaut 0, 1 ou plus sur des bureaux)
  usages_logement: ["1", "2"],

  // Fiche d'un produit sur la base INIES (identifiant ajouté à la fin), ouverte dans un nouvel onglet
  url_inies: "https://www.base-inies.fr/consultation/infos-produit/",

  // Unité des Ic dans les onglets (celle des graphiques est dans js/reglages_graphiques.js)
  unite_ic: "kg éq. CO₂/m²",

  // Titre du panneau de droite selon l'onglet actif
  titres_onglets: {
    synthese: "Synthèse", informations: "Informations", indicateurs: "Indicateurs", composants: "Composants",
    graphiques: "Graphiques du HUB",
  },

  // Libellés des statuts : verdict réglementaire (bâtiment, groupe DH)
  // ou simple comparaison au seuil (zone, donnée pour information)
  libelles_statut: {
    reglementaire: { conforme: "Conforme", depasse: "Non conforme", absent: "Non renseigné" },
    information: { conforme: "Sous le seuil", depasse: "Au-dessus du seuil", absent: "Non renseigné" },
  },
  symboles_statut: { conforme: "✓", depasse: "✕", absent: "–" },

  // Somme de l'Ic signalée si l'écart dépasse la plus grande de ces tolérances (arrondis exclus)
  tolerance_somme: { absolue: 0.5, relative: 0.002 },

  // Place laissée au-delà de la plus grande valeur : barres d'écart et jauges
  echelle_ecarts: 1.05,
  echelle_jauge: 1.15,

  // Libellés des messages d'erreur à l'import
  messages: {
    extension: "Le fichier doit être un RSEE au format XML (.xml).",
    zip: "Ce fichier est une archive compressée : décompressez-la puis ouvrez le fichier .xml qu'elle contient.",
    xml_invalide: "Ce fichier n'est pas un XML valide : il est peut-être tronqué ou corrompu.",
    racine: "Ce fichier XML n'est pas un RSEE : la racine <projet> est absente.",
    rset_seul: "Ce fichier ne contient pas de partie environnementale (RSEnv) : c'est probablement un RSET, pas un RSEE.",
    rsenv_absent: "Partie environnementale (RSEnv) absente : ce fichier n'est pas un RSEE complet.",
    lecture: "Le fichier n'a pas pu être lu.",
  },
};
