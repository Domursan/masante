/**
 * MA SANTÉ — Administration : comptes, consultation des données, paramètres
 */
Pages.admin = {
  render(el) {
    if (S.me.role !== 'admin') { location.hash = '#accueil'; return; }
    const p = S.params;
    el.innerHTML = `
      <div class="page-head"><h1>Administration</h1><button class="btn primary" id="u-add">${UI.icon('plus')}Nouveau compte</button></div>
      <div class="settings-grid">
        <section class="card">
          <div class="card-head"><h2>${UI.icon('users')} Comptes</h2><span class="muted small">${S.users.length} compte${S.users.length > 1 ? 's' : ''}</span></div>
          ${S.users.map(u => `<div class="user-row">
            ${UI.avatarHtml(u, 44)}
            <div class="info"><b>${UI.esc(UI.nomComplet(u))}${u.id === S.me.id ? ' (moi)' : ''}</b>
              <span class="muted small">${UI.esc(u.identifiant)}${u.email ? ' · ' + UI.esc(u.email) : ' · pas d\'email'}</span><br>
              ${UI.badge(u.role === 'admin' ? 'p' : '', u.role === 'admin' ? 'Admin' : 'Utilisateur')} ${u.actif === 'oui' ? UI.badge('ok', 'Actif') : UI.badge('danger', 'Désactivé')}</div>
            <div class="btn-row">
              ${u.id !== S.me.id ? `<button class="btn sm" data-view="${u.id}">${UI.icon('eye')}Voir ses données</button>` : ''}
              <button class="icon-btn" data-edit="${u.id}" aria-label="Modifier">${UI.icon('edit')}</button>
              <button class="icon-btn" data-reset="${u.id}" aria-label="Réinitialiser le mot de passe" title="Réinitialiser le mot de passe">${UI.icon('key')}</button>
            </div></div>`).join('')}
        </section>

        <section class="card">
          <div class="card-head"><h2>${UI.icon('settings')} Paramètres du site</h2></div>
          <form class="form" id="f-params">
            <label>Nom du site<input name="nom_site" value="${UI.esc(p.nom_site || 'Ma Santé')}"></label>
            <label>Lien du logo<input type="url" name="logo_url" value="${UI.esc(p.logo_url || '')}" placeholder="https://… (vide = logo par défaut)"></label>
            <label>Lien du favicon<input type="url" name="favicon_url" value="${UI.esc(p.favicon_url || '')}" placeholder="https://… (vide = même que le logo)"></label>
            <div class="grid2">
              <label>Alerte de renouvellement (jours avant la fin)<input type="number" name="notif_jours" min="1" max="120" value="${UI.esc(p.notif_jours || '15')}"></label>
              <label>Alerte de stock bas par défaut (jours restants)<input type="number" name="stock_alerte_jours" min="1" max="60" value="${UI.esc(p.stock_alerte_jours || '7')}"></label>
              <label>Unité de glycémie<select name="unite_glycemie">
                <option value="mmol/L" ${p.unite_glycemie !== 'mg/dL' ? 'selected' : ''}>mmol/L</option>
                <option value="mg/dL" ${p.unite_glycemie === 'mg/dL' ? 'selected' : ''}>mg/dL</option></select></label>
            </div>
            <label class="switch"><span>Copie des emails de renouvellement à l'admin</span><input type="checkbox" name="notif_copie_admin" ${p.notif_copie_admin === 'oui' ? 'checked' : ''}><span class="track"></span></label>
            <div class="btn-row">
              <button class="btn primary" type="submit">${UI.icon('check')}Enregistrer</button>
              <button class="btn" type="button" id="test-mail">${UI.icon('mail')}Envoyer un email de test</button>
            </div>
            <p class="hint">Les emails (renouvellement d'ordonnance et stock bas) partent chaque matin vers 8h, à l'adresse renseignée dans chaque compte.</p>
          </form>
        </section>

        <section class="card">
          <div class="card-head"><h2>🎨 Emojis des thèmes de saison</h2></div>
          <p class="hint">Colle ou tape les emojis de chaque saison (séparés ou non par des espaces, 40 max). Laisse vide pour utiliser ceux par défaut. Les changements s'appliquent à tous les comptes.</p>
          <form id="f-emojis">
            ${Object.entries(Saisons.LISTE).map(([k, s]) => `<div class="emoji-row">
              <b>${UI.esc(s.nom)}</b>
              <input name="emojis_${k}" value="${UI.esc(p['emojis_' + k] || '')}" placeholder="${UI.esc(s.e.join(' '))}" aria-label="Emojis ${UI.esc(s.nom)}">
              <button type="button" class="btn sm" data-essai="${k}" title="Aperçu sur le site">${UI.icon('eye')}Essayer</button>
              <div class="preview" data-prev="${k}">${UI.esc((Saisons.parse(p['emojis_' + k]).length ? Saisons.parse(p['emojis_' + k]) : s.e).join(' '))}</div>
            </div>`).join('')}
            <div class="btn-row" style="margin-top:12px">
              <button class="btn primary" type="submit">${UI.icon('check')}Enregistrer les emojis</button>
              <button class="btn ghost" type="button" id="emojis-defaut">Tout remettre par défaut</button>
            </div>
          </form>
        </section>
      </div>`;

    UI.$('#u-add', el).onclick = () => this.formUser(null, el);
    el.onclick = async e => {
      const b = e.target.closest('[data-view],[data-edit],[data-reset]');
      if (!b) return;
      if (b.dataset.view) { await App.viewAs(b.dataset.view); location.hash = '#accueil'; return; }
      if (b.dataset.edit) return this.formUser(S.users.find(u => u.id === b.dataset.edit), el);
      if (b.dataset.reset) return this.resetPw(S.users.find(u => u.id === b.dataset.reset));
    };

    UI.$('#f-params', el).onsubmit = async e => {
      e.preventDefault();
      const d = UI.formData(e.target);
      try {
        S.params = await App.write('adminSaveParams', d, { self: true });
        App.branding();
        UI.toast('Paramètres enregistrés');
      } catch (err) { /* déjà signalé */ }
    };
    const fe = UI.$('#f-emojis', el);
    const majPrev = inp => {
      const k = inp.name.replace('emojis_', '');
      const l = Saisons.parse(inp.value);
      UI.$(`[data-prev=${k}]`, fe).textContent = (l.length ? l : Saisons.LISTE[k].e).join(' ');
    };
    fe.addEventListener('input', e => { if (e.target.name) majPrev(e.target); });
    UI.$$('[data-essai]', fe).forEach(b => b.onclick = () => {
      const k = b.dataset.essai;
      const backup = S.params['emojis_' + k];
      S.params['emojis_' + k] = UI.$(`[name=emojis_${k}]`, fe).value;
      Saisons.apply(k, { qte: Math.max(20, Number(S.me.saison_qte) || 0), vitesse: Number(S.me.saison_vitesse) || 4 });
      S.params['emojis_' + k] = backup;
      this.apercu = true;
      UI.toast(`Aperçu ${Saisons.LISTE[k].nom} — ton thème revient en quittant la page`);
    });
    UI.$('#emojis-defaut', el).onclick = () => { UI.$$('input', fe).forEach(i => { i.value = ''; majPrev(i); }); };
    fe.onsubmit = async e => {
      e.preventDefault();
      const d = {};
      UI.$$('input', fe).forEach(i => { d[i.name] = Saisons.parse(i.value).join(' '); });
      try {
        S.params = await App.write('adminSaveParams', d, { self: true });
        Themes.apply(S.me);
        UI.toast('Emojis enregistrés');
      } catch (err) { /* déjà signalé */ }
    };
    UI.$('#test-mail', el).onclick = async () => {
      try {
        const r = await App.write('adminTestEmail', {}, { self: true });
        UI.toast(`Email de test envoyé à ${S.me.email} (quota restant aujourd'hui : ${r.quota})`);
      } catch (err) { /* déjà signalé */ }
    };
  },

  destroy() {
    if (this.apercu) { this.apercu = false; Themes._saisonCle = null; Themes.apply(S.me); }
  },

  async refresh(el) {
    S.users = await API.call('adminUsers');
    App.header();
    Router.render();
  },

  formUser(u, el) {
    const n = !u;
    u = u || { role: 'utilisateur', actif: 'oui' };
    UI.modal({
      title: n ? 'Nouveau compte' : 'Modifier le compte',
      body: `<form class="form">
        <label>Identifiant de connexion *<input name="identifiant" required value="${UI.esc(u.identifiant || '')}" autocapitalize="none"></label>
        <div class="grid2">
          <label>Prénom<input name="prenom" value="${UI.esc(u.prenom || '')}"></label>
          <label>Nom<input name="nom" value="${UI.esc(u.nom || '')}"></label>
        </div>
        <label>Email<input type="email" name="email" value="${UI.esc(u.email || '')}"></label>
        <div class="grid2">
          <label>Rôle<select name="role"><option value="utilisateur" ${u.role !== 'admin' ? 'selected' : ''}>Utilisateur</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrateur</option></select></label>
          <label>Statut<select name="actif"><option value="oui" ${u.actif === 'oui' ? 'selected' : ''}>Actif</option><option value="non" ${u.actif !== 'oui' ? 'selected' : ''}>Désactivé</option></select></label>
        </div>
        ${n ? '<label>Mot de passe initial * (8 caractères min.)<input type="text" name="motdepasse" minlength="8" required autocomplete="off"></label><p class="hint">Communique-le à la personne : elle pourra le changer dans « Mon compte ».</p>' : ''}
      </form>`,
      actions: [
        { label: 'Annuler', cls: 'ghost' },
        { label: n ? 'Créer le compte' : 'Enregistrer', cls: 'primary', onClick: async m => {
          const f = UI.$('form', m.body);
          if (!f.reportValidity()) return false;
          const d = UI.formData(f);
          if (u.id) d.id = u.id;
          await App.write('adminSaveUser', d, { self: true });
          UI.toast(n ? 'Compte créé' : 'Compte mis à jour');
          await this.refresh(el);
        } }
      ]
    });
  },

  resetPw(u) {
    UI.modal({
      title: 'Nouveau mot de passe',
      body: `<form class="form"><p>Définir un nouveau mot de passe pour <b>${UI.esc(UI.nomComplet(u))}</b>.</p>
        <label>Nouveau mot de passe (8 caractères min.)<input type="text" name="motdepasse" minlength="8" required autocomplete="off"></label></form>`,
      actions: [
        { label: 'Annuler', cls: 'ghost' },
        { label: 'Enregistrer', cls: 'primary', onClick: async m => {
          const f = UI.$('form', m.body);
          if (!f.reportValidity()) return false;
          await App.write('adminResetPassword', { id: u.id, motdepasse: UI.formData(f).motdepasse }, { self: true });
          UI.toast('Mot de passe réinitialisé');
        } }
      ]
    });
  }
};