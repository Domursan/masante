/**
 * MA SANTÉ — Connexion rapide par code PIN (par appareil)
 * L'appareil garde, pour chaque compte ayant activé le PIN : l'identifiant de l'appareil,
 * un secret aléatoire et la longueur du code (jamais le code lui-même).
 * Avec un PIN, la session n'est pas conservée à la fermeture et l'app se verrouille
 * après une période d'inactivité (réglable).
 */
const Pin = {
  CLE: 'ms_appareils',
  CLE_DELAI: 'ms_verrou_min',
  choisi: null,
  saisie: '',
  cacheLe: 0,

  /* ---------- Stockage local ---------- */
  appareils() { try { return JSON.parse(localStorage.getItem(this.CLE)) || []; } catch (e) { return []; } },
  setAppareils(l) { try { if (l.length) localStorage.setItem(this.CLE, JSON.stringify(l)); else localStorage.removeItem(this.CLE); } catch (e) { /* ignoré */ } },
  pour(userId) { return this.appareils().find(a => a.user_id === userId); },
  retirer(userId) { this.setAppareils(this.appareils().filter(a => a.user_id !== userId)); },
  delai() { try { const v = localStorage.getItem(this.CLE_DELAI); return v === null ? 5 : Number(v); } catch (e) { return 5; } },
  setDelai(m) { try { localStorage.setItem(this.CLE_DELAI, String(m)); } catch (e) { /* ignoré */ } },
  actif() { return !!(S.me && this.pour(S.me.id)); },

  nomAppareil() {
    const ua = navigator.userAgent;
    const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'PC Windows' : 'Appareil';
    const nav = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
    return [os, nav].filter(Boolean).join(' · ');
  },

  /* ---------- Activation / désactivation ---------- */
  activer(apres) {
    let premier = null;
    const m = UI.modal({
      title: 'Code PIN sur cet appareil',
      body: `<form class="form" autocomplete="off">
        <p class="muted">Choisis un code de 4 à 6 chiffres. Il ne fonctionnera que sur cet appareil.</p>
        <label>Code PIN<input type="password" name="pin" inputmode="numeric" pattern="\\d{4,6}" minlength="4" maxlength="6" required autocomplete="new-password"></label>
        <label>Confirmation<input type="password" name="pin2" inputmode="numeric" pattern="\\d{4,6}" minlength="4" maxlength="6" required autocomplete="new-password"></label>
        <label>Nom de l'appareil<input name="nom" value="${UI.esc(this.nomAppareil())}"></label>
      </form>`,
      actions: [
        { label: 'Annuler', cls: 'ghost' },
        { label: 'Activer', cls: 'primary', onClick: async () => {
          const f = UI.$('form', m.body);
          const d = UI.formData(f);
          if (!/^\d{4,6}$/.test(d.pin)) { UI.toast('Le code doit contenir 4 à 6 chiffres', 'warn'); return false; }
          if (d.pin !== d.pin2) { UI.toast('Les deux codes ne correspondent pas', 'warn'); return false; }
          if (/^(\d)\1+$/.test(d.pin) || '0123456789'.includes(d.pin) || '9876543210'.includes(d.pin)) { UI.toast('Code trop simple (évite 0000, 1234…)', 'warn'); return false; }
          const ancien = this.pour(S.me.id);
          const r = await App.write('pinSetup', { pin: d.pin, nom: d.nom, ancien_id: ancien ? ancien.device_id : '' }, { self: true });
          const l = this.appareils().filter(a => a.user_id !== S.me.id);
          l.push({ device_id: r.device_id, secret: r.secret, user_id: S.me.id, prenom: S.me.prenom, nom: S.me.nom, identifiant: S.me.identifiant, len: d.pin.length });
          this.setAppareils(l);
          premier = true;
          API.setToken(API.token, false); // avec un PIN, la session ne survit pas à la fermeture
          UI.toast('Code PIN activé sur cet appareil');
          apres && apres();
        } }
      ]
    });
    return premier;
  },

  async desactiver(apres) {
    const a = this.pour(S.me.id);
    if (!a) return;
    if (!(await UI.confirm('Désactiver le code PIN sur cet appareil ? Le mot de passe sera de nouveau demandé.', { ok: 'Désactiver', danger: true }))) return;
    try { await App.write('pinRevoke', { id: a.device_id }, { self: true }); } catch (e) { /* on retire quand même localement */ }
    this.retirer(S.me.id);
    UI.toast('Code PIN désactivé');
    apres && apres();
  },

  /* ---------- Écran PIN ---------- */
  afficher(userId, msg = '') {
    const l = this.appareils();
    if (!l.length) return false;
    this.choisi = userId ? l.find(a => a.user_id === userId) : (l.length === 1 ? l[0] : null);
    this.saisie = '';
    UI.$('#app').classList.add('hidden');
    UI.$('#login').classList.add('hidden');
    UI.$('#pin-screen').classList.remove('hidden');
    this.dessiner(msg);
    return true;
  },

  masquer() { UI.$('#pin-screen').classList.add('hidden'); },

  dessiner(msg = '') {
    const box = UI.$('#pin-box');
    const l = this.appareils();
    const urg = Pages.urgence ? Object.keys(Pages.urgence.locales()).length : 0;
    const piedPage = `<div class="pin-links">
      <button class="btn ghost sm" data-pin="mdp">Utiliser le mot de passe</button>
      ${this.choisi && l.length > 1 ? '<button class="btn ghost sm" data-pin="profils">Changer de profil</button>' : ''}
      ${urg ? '<button class="btn danger sm" data-pin="urgence">🚑 Fiche d\'urgence</button>' : ''}
    </div>`;

    if (!this.choisi) {
      box.innerHTML = `<h2>Qui es-tu ?</h2>
        <div class="profils">${l.map(a => `<button class="profil" data-uid="${a.user_id}">${UI.avatarHtml(a, 72)}<b>${UI.esc(a.prenom || a.identifiant)}</b></button>`).join('')}</div>${piedPage}`;
    } else {
      const a = this.choisi, len = a.len || 4;
      box.innerHTML = `${UI.avatarHtml(a, 72)}
        <h2>Bonjour ${UI.esc(a.prenom || a.identifiant)}</h2>
        <p class="muted">Entre ton code PIN</p>
        <div class="pin-dots" aria-live="polite" aria-label="${this.saisie.length} chiffre(s) saisi(s)">${Array.from({ length: len }, (_, i) => `<span class="${i < this.saisie.length ? 'on' : ''}"></span>`).join('')}</div>
        <p class="form-error pin-err" role="alert">${UI.esc(msg)}</p>
        <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join('')}
          <button data-k="del" aria-label="Effacer">${UI.icon('left')}</button><button data-k="0">0</button><button data-k="ok" aria-label="Valider">${UI.icon('check')}</button></div>
        ${piedPage}`;
    }
  },

  async touche(k) {
    if (!this.choisi || this.envoi) return;
    const len = this.choisi.len || 4;
    if (k === 'del') this.saisie = this.saisie.slice(0, -1);
    else if (k === 'ok') { if (this.saisie.length >= 4) return this.valider(); }
    else if (this.saisie.length < 6) this.saisie += k;
    this.dessiner();
    if (this.saisie.length === len) this.valider();
  },

  async valider() {
    const a = this.choisi, pin = this.saisie;
    this.envoi = true;
    UI.loader(true);
    try {
      const r = await API.call('pinLogin', { device_id: a.device_id, secret: a.secret, pin });
      API.setToken(r.token, false);
      S.viewing = null;
      await App.load();
      // garde le prénom/nom à jour pour l'écran de profils
      this.setAppareils(this.appareils().map(x => x.user_id === S.me.id ? Object.assign(x, { prenom: S.me.prenom, nom: S.me.nom }) : x));
      this.masquer();
      App.show();
    } catch (e) {
      this.saisie = '';
      if (e.message === 'PIN_DEVICE' || e.message === 'PIN_BLOQUE') {
        this.retirer(a.user_id);
        this.masquer();
        App.showLogin(e.message === 'PIN_BLOQUE' ? 'Trop de codes incorrects : le code PIN a été désactivé. Connecte-toi avec ton mot de passe.' : 'Le code PIN de cet appareil n\'est plus valide. Connecte-toi avec ton mot de passe.');
      } else {
        this.dessiner(e.message);
        const d = UI.$('.pin-dots');
        if (d) { d.classList.add('shake'); setTimeout(() => d.classList.remove('shake'), 500); }
        if (navigator.vibrate) navigator.vibrate(120);
      }
    } finally {
      this.envoi = false;
      UI.loader(false);
    }
  },

  bind() {
    const scr = UI.$('#pin-screen');
    scr.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.k) return this.touche(b.dataset.k);
      if (b.dataset.uid) { this.choisi = this.appareils().find(a => a.user_id === b.dataset.uid); this.saisie = ''; return this.dessiner(); }
      if (b.dataset.pin === 'mdp') { this.masquer(); return App.showLogin(); }
      if (b.dataset.pin === 'profils') { this.choisi = null; return this.dessiner(); }
      if (b.dataset.pin === 'urgence') return Pages.urgence && Pages.urgence.ouvrirHorsConnexion();
    });
    document.addEventListener('keydown', e => {
      if (scr.classList.contains('hidden') || UI.$('.modal-wrap') || UI.$('.urgence-plein')) return;
      if (/^\d$/.test(e.key)) this.touche(e.key);
      else if (e.key === 'Backspace') this.touche('del');
      else if (e.key === 'Enter') this.touche('ok');
    });
  },

  /* ---------- Verrouillage automatique ---------- */
  verrouiller() {
    if (!this.actif()) return;
    const uid = S.me.id;
    API.call('logout').catch(() => {});
    App.reset(true);
    this.afficher(uid);
  },

  surveiller() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.cacheLe = Date.now(); return; }
      const d = this.delai();
      if (this.actif() && d >= 0 && this.cacheLe && Date.now() - this.cacheLe >= d * 60000) this.verrouiller();
    });
  }
};