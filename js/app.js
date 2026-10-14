/**
 * MA SANTÉ — Orchestration : état, connexion, chargement, écriture
 */
var S = {
  me: null,         // utilisateur connecté
  viewing: null,    // utilisateur dont on affiche les données (admin : un autre compte possible)
  ro: false,        // lecture seule (admin qui consulte un autre compte)
  params: {},
  users: [],
  data: { ordonnances: [], prises: [], signes: [], schema: [], notes: [] }
};

var Store = {
  upsert(coll, obj) {
    const a = S.data[coll];
    const i = a.findIndex(x => x.id === obj.id);
    if (i >= 0) a[i] = obj; else a.push(obj);
  },
  remove(coll, id) {
    S.data[coll] = S.data[coll].filter(x => x.id !== id);
  }
};

var App = {
  /** Démarrage protégé : un fichier manquant ou en erreur ne doit jamais bloquer l'écran de connexion. */
  async init() {
    try { await App.demarrer(); }
    catch (e) {
      console.error('[Ma Santé] Erreur au démarrage :', e);
      try { App.showLogin('Erreur au chargement du site : ' + e.message); } catch (e2) { /* ignoré */ }
    }
  },

  async demarrer() {
    App.verifierModules();
    Themes.applyStored();
    App.branding();
    App.bindLogin();
    if (typeof Pin !== 'undefined') { Pin.bind(); Pin.surveiller(); }
    App.majBoutonUrgence();
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    if (!API.configured()) {
      App.showLogin("L'adresse de l'API n'est pas encore renseignée dans js/config.js.");
      return;
    }
    API.call('config').then(c => { Object.assign(S.params, c); App.branding(); if (!S.me) Themes.apply(Themes.current); }).catch(() => {});
    if (API.token) {
      UI.loader(true);
      try { await App.load(); App.show(); return; }
      catch (e) { API.setToken(null); }
      finally { UI.loader(false); }
    }
    if (typeof Pin === 'undefined' || !Pin.afficher()) App.showLogin();
  },

  async load(asUser) {
    const r = await API.call('bootstrap', { asUser: asUser || (S.viewing && S.viewing.id) || '' });
    S.me = r.me;
    S.viewing = r.user;
    S.ro = r.user.id !== r.me.id;
    S.params = r.params || {};
    S.users = r.users || [];
    S.data = { ordonnances: r.ordonnances || [], prises: r.prises || [], signes: r.signes || [], schema: r.schema || [], notes: r.notes || [] };
    Themes.apply(S.me);
    App.branding();
    App.header();
    if (Pages.urgence) Pages.urgence.syncLocal();
  },

  show() {
    UI.$('#login').classList.add('hidden');
    if (typeof Pin !== 'undefined') Pin.masquer();
    UI.$('#app').classList.remove('hidden');
    Router.build();
    Router.render();
  },

  showLogin(msg = '') {
    UI.$('#app').classList.add('hidden');
    if (typeof Pin !== 'undefined') Pin.masquer();
    UI.$('#login').classList.remove('hidden');
    UI.$('#login-error').textContent = msg;
    const bp = UI.$('#btn-pin-login');
    if (bp) bp.classList.toggle('hidden', typeof Pin === 'undefined' || !Pin.appareils().length);
    App.majBoutonUrgence();
  },

  /** Bouton « Fiche d'urgence » de l'écran de connexion (copie locale présente ?). */
  majBoutonUrgence() {
    const b = UI.$('#btn-urgence-login');
    if (b) b.classList.toggle('hidden', !(Pages.urgence && Object.keys(Pages.urgence.locales()).length));
  },

  /** Signale dans la console les fichiers js/ non chargés (mauvais dossier, oubli d'upload…). */
  verifierModules() {
    const manquants = Router.ROUTES.filter(r => !Pages[r.id]).map(r => `js/pages/${r.id}.js`);
    if (typeof Pin === 'undefined') manquants.push('js/pin.js');
    if (manquants.length) console.warn('[Ma Santé] Fichiers non chargés (vérifie leur emplacement) : ' + manquants.join(', '));
  },

  bindLogin() {
    const bp = UI.$('#btn-pin-login'), bu = UI.$('#btn-urgence-login');
    if (bp) bp.onclick = () => typeof Pin !== 'undefined' && Pin.afficher();
    if (bu) bu.onclick = () => Pages.urgence && Pages.urgence.ouvrirHorsConnexion();
    UI.$('#login-form').onsubmit = async e => {
      e.preventDefault();
      const f = e.target, btn = UI.$('button[type=submit]', f);
      const d = UI.formData(f);
      UI.$('#login-error').textContent = '';
      btn.disabled = true;
      UI.loader(true);
      try {
        const r = await API.call('login', { identifiant: d.identifiant, motdepasse: d.motdepasse });
        API.setToken(r.token, d.rester === 'oui' && !(typeof Pin !== 'undefined' && Pin.pour(r.user.id)));
        S.viewing = null;
        await App.load();
        f.reset();
        App.show();
        App.proposerPin();
        if (S.me.role === 'admin' && S.me.identifiant === 'admin' && !S.me.email) {
          UI.toast('Pense à renseigner ton email et à changer le mot de passe initial.', 'warn');
        }
      } catch (err) {
        UI.$('#login-error').textContent = err.message;
      } finally {
        btn.disabled = false;
        UI.loader(false);
      }
    };
  },

  async logout() {
    if (!(await UI.confirm('Se déconnecter de cet appareil ?', { titre: 'Déconnexion', ok: 'Se déconnecter' }))) return;
    try { await API.call('logout'); } catch (e) { /* ignoré */ }
    App.reset();
  },

  sessionExpired() {
    const uid = S.me && typeof Pin !== 'undefined' && Pin.pour(S.me.id) ? S.me.id : null;
    UI.toast('Session expirée, reconnecte-toi.', 'warn');
    App.reset(!!uid);
    if (uid) Pin.afficher(uid);
  },

  /** Sur téléphone, propose une fois d'activer le code PIN après une connexion par mot de passe. */
  proposerPin() {
    if (typeof Pin === 'undefined' || Pin.pour(S.me.id) || !matchMedia('(pointer: coarse)').matches) return;
    const cle = 'ms_pin_propose_' + S.me.id;
    try { if (localStorage.getItem(cle)) return; localStorage.setItem(cle, '1'); } catch (e) { return; }
    UI.modal({
      title: '🔢 Connexion rapide',
      body: '<p>Veux-tu activer un <b>code PIN</b> sur ce téléphone ? Tu n\'auras plus à taper ton mot de passe : un code à 4–6 chiffres suffira.</p><p class="hint">Modifiable à tout moment dans Mon compte.</p>',
      actions: [{ label: 'Plus tard', cls: 'ghost' }, { label: 'Activer', cls: 'primary', onClick: () => { setTimeout(() => Pin.activer(), 50); } }]
    });
  },

  reset(verrou = false) {
    API.setToken(null);
    S.me = null; S.viewing = null; S.ro = false; S.users = [];
    S.data = { ordonnances: [], prises: [], signes: [], schema: [], notes: [] };
    Photos.cache = {};
    if (verrou) { UI.$('#app').classList.add('hidden'); return; }
    location.hash = '';
    App.showLogin();
  },

  header() {
    const av = UI.$('#top-avatar');
    av.innerHTML = UI.avatarHtml(S.me, 36);
    UI.fillAvatars(av);

    const wrap = UI.$('#view-as-wrap'), sel = UI.$('#view-as');
    if (S.me.role === 'admin' && S.users.length > 1) {
      wrap.classList.remove('hidden');
      sel.innerHTML = S.users.filter(u => u.actif === 'oui' || u.id === S.viewing.id).map(u =>
        `<option value="${u.id}" ${u.id === S.viewing.id ? 'selected' : ''}>${UI.esc(u.id === S.me.id ? 'Mes données' : UI.nomComplet(u))}</option>`
      ).join('');
      sel.onchange = () => App.viewAs(sel.value);
    } else {
      wrap.classList.add('hidden');
    }

    const ban = UI.$('#ro-banner');
    document.body.classList.toggle('ro', S.ro);
    if (S.ro) {
      ban.classList.remove('hidden');
      ban.innerHTML = `${UI.icon('eye')}<span>Consultation des données de <b>${UI.esc(UI.nomComplet(S.viewing))}</b> (lecture seule)</span><button class="btn sm" id="ro-back">Revenir à mes données</button>`;
      UI.$('#ro-back').onclick = () => App.viewAs(S.me.id);
    } else {
      ban.classList.add('hidden');
    }
  },

  async viewAs(id) {
    UI.loader(true);
    try {
      S.viewing = { id };
      Photos.cache = Object.fromEntries(Object.entries(Photos.cache).filter(([k]) => !k.startsWith('drive:')));
      await App.load(id);
      Router.build();
      Router.render();
    } catch (e) {
      UI.toast(e.message, 'error');
    } finally {
      UI.loader(false);
    }
  },

  /** Écriture : bloquée en lecture seule (sauf actions sur son propre compte : opts.self). */
  async write(action, data, opts = {}) {
    if (S.ro && !opts.self) {
      UI.toast('Mode consultation : modification impossible.', 'warn');
      throw new Error('RO');
    }
    UI.loader(true);
    try { return await API.call(action, data); }
    catch (e) { UI.toast(e.message, 'error'); throw e; }
    finally { UI.loader(false); }
  },

  branding() {
    const nom = S.params.nom_site || APP_CONFIG.NOM;
    const logo = S.params.logo_url || APP_CONFIG.LOGO_URL;
    const fav = S.params.favicon_url || APP_CONFIG.FAVICON_URL || logo;
    UI.$$('.site-nom').forEach(e => { e.textContent = nom; });
    if (!S.me) document.title = nom;
    UI.$$('.brand-logo').forEach(e => {
      e.innerHTML = logo ? `<img src="${UI.esc(logo)}" alt="">` : `<span class="logo-mark">${UI.icon('heart')}</span>`;
    });
    if (fav) UI.$('#favicon').href = fav;
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());