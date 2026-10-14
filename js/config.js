/**
 * MA SANTÉ — Configuration
 * Seule chose à modifier après le déploiement Apps Script : API_URL.
 * Le nom du site, le logo et le favicon se règlent ensuite dans
 * Administration > Paramètres (stockés dans le Sheet).
 */
const APP_CONFIG = {
  // URL du déploiement "Application Web" Apps Script (se termine par /exec)
  API_URL: 'https://script.google.com/macros/s/AKfycbwPp1qZVyJDoyfALL4WseL-AxTGMy4DAJe4iImSkxwoqE8yjC5_u3z5e8QsG2Z4kvT7lA/exec',

  // Valeurs par défaut (remplacées par l'onglet Parametres du Sheet)
  NOM: 'Ma Santé',
  LOGO_URL: '',
  FAVICON_URL: '',

  // Zones de référence affichées en fond des graphiques [min, max].
  // Valeurs générales adultes, à adapter avec ton médecin. null = pas de zone.
  REFERENCES: {
    glycemie: null,
    tension: [90, 140],
    fc: [60, 100],
    fr: [12, 20],
    saturation: [95, 100],
    douleur: null
  }
};
