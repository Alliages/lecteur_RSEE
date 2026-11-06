/* =====================================================================
   lecteur_RSEE — mise en forme des nombres
   Partagée par l'interface et les graphiques.
   ===================================================================== */

"use strict";

const Format = (() => {
  // Un formateur par jeu d'options : Intl.NumberFormat est coûteux à créer
  const formateurs = new Map();
  function formateur(options) {
    const cle = JSON.stringify(options);
    if (!formateurs.has(cle)) formateurs.set(cle, new Intl.NumberFormat(REGLAGES.langue, options));
    return formateurs.get(cle);
  }

  const nombre = (n, dec = 0) => formateur({ minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);

  const signe = (n, dec = 1) =>
    formateur({ minimumFractionDigits: dec, maximumFractionDigits: dec, signDisplay: "exceptZero" }).format(n);

  // Coefficients : jusqu'à 3 décimales, sans zéros inutiles (980 ; -0,181)
  const coefficient = (n) => formateur({ maximumFractionDigits: 3 }).format(n);

  return { nombre, signe, coefficient };
})();
