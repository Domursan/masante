/**
 * MA SANTÉ — Navigation (routage par #hash)
 */
const Router = {
  ROUTES: [
    { id: 'accueil', label: 'Accueil', icon: 'home', bottom: true },
    { id: 'medicaments', label: 'Médicaments', court: 'Médocs', icon: 'pill', bottom: true },
    { id: 'signes', label: 'Signes vitaux', court: 'Signes', icon: 'activity', bottom: true },
    { id: 'ordonnances', label: 'Ordonnances', court: 'Ordos', icon: 'file', bottom: true },
    { id: 'historique', label: 'Historique médical', court: 'Historique', icon: 'timeline' },
    { id: 'vaccins', label: 'Vaccins', icon: 'syringe' },
    { id: 'notes', label: 'Notes', icon: 'note', bottom: true },
    { id: 'urgence', label: "Fiche d'urgence", icon: 'cross' },
    { id: 'rapport', label: 'Rapport médecin', icon: 'report' },
    { id: 'compte', label: 'Mon compte', icon: 'user' },
    { id: 'admin', label: 'Administration', icon: 'shield', admin: true }
  ],
  prev: null,

  visible() {
    return this.ROUTES.filter(r => Pages[r.id] && (!r.admin || (S.me && S.me.role === 'admin')));
  },

  build() {
    const routes = this.visible();
    UI.$('#sidebar').innerHTML = routes.map(r =>
      `<a href="#${r.id}" data-r="${r.id}">${UI.icon(r.icon)}<span>${r.label}</span></a>`
    ).join('') + `<div class="side-foot"><button class="side-link" id="side-logout">${UI.icon('logout')}<span>Déconnexion</span></button></div>`;
    UI.$('#bottomnav').innerHTML = routes.filter(r => r.bottom).map(r =>
      `<a href="#${r.id}" data-r="${r.id}">${UI.icon(r.icon)}<span>${r.court || r.label}</span></a>`
    ).join('') + `<button type="button" id="nav-plus" aria-label="Plus de pages">${UI.icon('grid')}<span>Plus</span></button>`;
    UI.$('#side-logout').onclick = () => App.logout();
    UI.$('#nav-plus').onclick = () => this.menuPlus();
  },

  /** Téléphone : menu des pages qui ne tiennent pas dans la barre du bas. */
  menuPlus() {
    const cur = this.current();
    const autres = this.visible().filter(r => !r.bottom);
    const m = UI.modal({
      title: 'Menu',
      body: `<div class="plus-grid">${autres.map(r =>
        `<a href="#${r.id}" class="plus-item ${r.id === cur ? 'active' : ''}">${UI.icon(r.icon)}<span>${r.label}</span></a>`).join('')}
        <button type="button" class="plus-item" data-logout>${UI.icon('logout')}<span>Déconnexion</span></button></div>`
    });
    m.body.addEventListener('click', e => {
      if (e.target.closest('a')) m.close();
      if (e.target.closest('[data-logout]')) { m.close(); App.logout(); }
    });
  },

  current() {
    const id = location.hash.slice(1).split('/')[0] || 'accueil';
    const r = this.visible().find(x => x.id === id);
    return r ? r.id : 'accueil';
  },

  render() {
    if (!S.me) return;
    const id = this.current();
    if (this.prev && Pages[this.prev] && Pages[this.prev].destroy) Pages[this.prev].destroy();
    UI.$$('[data-r]').forEach(a => a.classList.toggle('active', a.dataset.r === id));
    const plus = UI.$('#nav-plus');
    if (plus) plus.classList.toggle('active', !(this.ROUTES.find(r => r.id === id) || {}).bottom);
    const el = UI.$('#page');
    el.innerHTML = '';
    el.className = 'page page-' + id;
    if (this.prev !== id) window.scrollTo(0, 0);
    this.prev = id;
    try { Pages[id].render(el); } catch (e) { console.error(e); el.innerHTML = UI.empty('Erreur d\'affichage : ' + e.message); }
    UI.fillAvatars(el);
    const r = this.ROUTES.find(x => x.id === id);
    document.title = `${r ? r.label + ' · ' : ''}${S.params.nom_site || APP_CONFIG.NOM}`;
  }
};

window.addEventListener('hashchange', () => Router.render());
