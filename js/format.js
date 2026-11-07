/* =====================================================================
   lecteur_RSEE — mise en forme des nombres et des dates
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

  // Date ISO « AAAA-MM-JJ » au format long : « 9 novembre 2023 », « 1er janvier 2022 ».
  // Texte d'un autre format renvoyé tel quel ; null si vide.
  const formateurDate = new Intl.DateTimeFormat(REGLAGES.langue, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  function date(texte) {
    if (!texte) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(texte);
    if (!m) return texte;
    return formateurDate.format(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))).replace(/^1 /, "1er ");
  }

  return { nombre, signe, coefficient, date };
})();
