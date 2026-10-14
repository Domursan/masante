/**
 * MA SANTÉ — Thèmes : couleur × mode × daltonien × saison × son
 */
const Themes = {
  COULEURS: { rouge: 'Rouge', bleu: 'Bleu', vert: 'Vert', magenta: 'Magenta' },
  MODES: { auto: 'Auto', clair: 'Clair', sombre: 'Sombre' },
  DEFAUT: { couleur: 'bleu', mode: 'auto', daltonien: 'non', saison: 'auto', son: 'oui', saison_qte: '12', saison_vitesse: '4' },
  current: null,

  prefs(u) {
    const p = Object.assign({}, this.DEFAUT);
    if (u) Object.keys(this.DEFAUT).forEach(k => { if (u[k] !== undefined && u[k] !== null && u[k] !== '') p[k] = String(u[k]); });
    return p;
  },

  apply(src) {
    const p = this.prefs(src);
    this.current = p;
    const h = document.documentElement;
    h.dataset.couleur = this.COULEURS[p.couleur] ? p.couleur : 'bleu';
    h.dataset.mode = p.mode === 'auto'
      ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'sombre' : 'clair')
      : (p.mode === 'sombre' ? 'sombre' : 'clair');
    h.dataset.daltonien = p.daltonien === 'oui' ? 'oui' : 'non';
    Sons.enabled = p.son !== 'non';
    // On ne relance l'animation des emojis que si un réglage de saison a changé
    const params = (typeof S !== 'undefined' && S.params) || {};
    const cle = [p.saison, p.saison_qte, p.saison_vitesse].concat(Object.keys(Saisons.LISTE).map(k => params['emojis_' + k] || '')).join('|');
    if (cle !== this._saisonCle) {
      this._saisonCle = cle;
      Saisons.apply(p.saison, { qte: p.saison_qte, vitesse: p.saison_vitesse });
    }
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.content = getComputedStyle(h).getPropertyValue('--surface').trim() || '#ffffff';
    try { localStorage.setItem('ms_theme', JSON.stringify(p)); } catch (e) { /* ignoré */ }
  },

  applyStored() {
    let p = null;
    try { p = JSON.parse(localStorage.getItem('ms_theme')); } catch (e) { p = null; }
    this.apply(p);
  }
};

try {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (Themes.current && Themes.current.mode === 'auto') {
      Themes.apply(Themes.current);
      if (typeof S !== 'undefined' && S.me) Router.render();
    }
  });
} catch (e) { /* anciens navigateurs */ }