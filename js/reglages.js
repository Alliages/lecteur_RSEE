/* =====================================================================
   lecteur_RSEE — réglages
   Tous les paramètres modifiables de l'outil sont regroupés ici.
   Les couleurs sont dans css/style.css (variables en tête de fichier).
   ===================================================================== */

"use strict";

const REGLAGES = {
  // Version affichée (doit rester identique au fichier VERSION)
  version: "0.9.0",

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
