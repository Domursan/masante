/**
 * MA SANTÉ — Appels à l'API Apps Script
 * POST en text/plain : évite la requête CORS "preflight" non gérée par Apps Script.
 */
const API = {
  token: null,

  init() {
    try { this.token = localStorage.getItem('ms_token') || sessionStorage.getItem('ms_token'); } catch (e) { this.token = null; }
  },

  configured() {
    return /^https:\/\/script\.google(usercontent)?\.com\//.test(APP_CONFIG.API_URL);
  },

  setToken(t, persist = true) {
    this.token = t;
    try {
      localStorage.removeItem('ms_token');
      sessionStorage.removeItem('ms_token');
      if (t) (persist ? localStorage : sessionStorage).setItem('ms_token', t);
    } catch (e) { /* stockage indisponible : session en mémoire uniquement */ }
  },

  async call(action, data = {}) {
    let res;
    try {
      res = await fetch(APP_CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, data, token: this.token })
      });
    } catch (e) {
      throw new Error('Connexion impossible. Vérifie ta connexion internet.');
    }
    let j;
    try { j = await res.json(); } catch (e) { throw new Error('Réponse invalide du serveur (vérifie le déploiement Apps Script).'); }
    if (!j.ok) {
      if (j.error === 'AUTH') {
        if (typeof App !== 'undefined' && action !== 'bootstrap') App.sessionExpired();
        throw new Error('Session expirée, reconnecte-toi.');
      }
      throw new Error(j.error || 'Erreur inconnue');
    }
    return j.data;
  }
};
API.init();
