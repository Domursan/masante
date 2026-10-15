/**
 * MA SANTÉ — Mon compte : identité, photo, mot de passe, apparence
 * (toujours le compte connecté, même quand l'admin consulte un autre compte)
 */
Pages.compte = {
  render(el) {
    const u = S.me;
    const p = Themes.prefs(u);
    const sc = UI.semainierCfg();
    const radio = (name, val, label, cur) => `<label><input type="radio" name="${name}" value="${val}" ${cur === val ? 'checked' : ''}><span>${label}</span></label>`;

    el.innerHTML = `
      <div class="page-head"><h1>Mon compte</h1>
        <div class="btn-row">${u.role === 'admin' ? `<a class="btn" href="#admin">${UI.icon('shield')}Administration</a>` : ''}
        <button class="btn" id="btn-logout">${UI.icon('logout')}Déconnexion</button></div></div>
      <div class="settings-grid">
        <div class="stack">
          <section class="card">
            <div class="card-head"><h2>${UI.icon('user')} Profil</h2><span class="badge p">${u.role === 'admin' ? 'Administrateur' : 'Utilisateur'} · ${UI.esc(u.identifiant)}</span></div>
            <form class="form" id="f-profil">
              <div id="pf-profil"></div>
              <div class="grid2">
                <label>Prénom<input name="prenom" value="${UI.esc(u.prenom || '')}" autocomplete="given-name"></label>
                <label>Nom<input name="nom" value="${UI.esc(u.nom || '')}" autocomplete="family-name"></label>
              </div>
              <label>Email (pour les rappels de renouvellement)<input type="email" name="email" value="${UI.esc(u.email || '')}" autocomplete="email"></label>
              <div class="btn-row"><button class="btn primary" type="submit">${UI.icon('check')}Enregistrer le profil</button></div>
            </form>
          </section>
          <section class="card">
            <div class="card-head"><h2>${UI.icon('key')} Mot de passe</h2></div>
            <form class="form" id="f-mdp">
              <input type="text" name="username" value="${UI.esc(u.identifiant)}" autocomplete="username" hidden>
              <label>Mot de passe actuel<input type="password" name="ancien" autocomplete="current-password" required></label>
              <div class="grid2">
                <label>Nouveau mot de passe<input type="password" name="nouveau" autocomplete="new-password" minlength="8" required></label>
                <label>Confirmation<input type="password" name="confirmation" autocomplete="new-password" minlength="8" required></label>
              </div>
              <p class="hint">8 caractères minimum.</p>
              <div class="btn-row"><button class="btn primary" type="submit">Changer le mot de passe</button></div>
            </form>
          </section>
          <section class="card">
            <div class="card-head"><h2>${UI.icon('lock')} Code PIN</h2>${Pin.actif() ? UI.badge('ok', 'Actif sur cet appareil') : UI.badge('', 'Inactif sur cet appareil')}</div>
            <p class="hint">Un code à 4–6 chiffres remplace le mot de passe, uniquement sur cet appareil. Après 5 codes faux, il est désactivé.</p>
            <div class="btn-row" style="margin:12px 0">
              ${Pin.actif()
                ? `<button class="btn" id="pin-change">${UI.icon('key')}Changer le code</button><button class="btn ghost" id="pin-off">Désactiver</button><button class="btn" id="pin-lock">${UI.icon('lock')}Verrouiller maintenant</button>`
                : `<button class="btn primary" id="pin-on">${UI.icon('lock')}Activer le code PIN</button>`}
            </div>
            ${Pin.actif() ? `<label>Verrouillage automatique quand l'app est en arrière-plan<select id="pin-delai">
              ${[[0, 'Immédiatement'], [1, 'Après 1 minute'], [5, 'Après 5 minutes'], [15, 'Après 15 minutes'], [60, 'Après 1 heure'], [-1, 'Jamais']].map(([v, l]) => `<option value="${v}" ${Pin.delai() === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select></label>` : ''}
            <h3 style="margin:16px 0 8px">Appareils avec un code PIN</h3>
            <div id="pin-devices"><p class="muted small">Chargement…</p></div>
          </section>
          <section class="card">
            <div class="card-head"><h2>${UI.icon('grid')} Semainier</h2></div>
            <form class="form" id="f-semainier">
              <label class="switch"><span>Je prépare un semainier<small>Les alertes de stock des traitements quotidiens vérifient s'il y aura assez de médicaments pour le prochain semainier</small></span><input type="checkbox" name="semainier_actif" ${sc.actif ? 'checked' : ''}><span class="track"></span></label>
              <div class="grid2">
                <label>Jour de préparation<select name="semainier_jour">${[1, 2, 3, 4, 5, 6, 0].map(j => `<option value="${j}" ${sc.jour === j ? 'selected' : ''}>${UI.JOURS_SEMAINE[j][0].toUpperCase() + UI.JOURS_SEMAINE[j].slice(1)}</option>`).join('')}</select></label>
                <label>Nombre de jours<input type="number" name="semainier_duree" min="1" max="31" step="1" value="${sc.duree}"></label>
              </div>
              <label>Prévenir combien de jours avant<input type="number" name="semainier_alerte" min="0" max="6" step="1" value="${sc.alerte}"></label>
              <p class="hint">Exemple : préparation le jeudi, alerte 3 jours avant → avertissement dès le lundi (accueil + email du matin) s'il manque des médicaments.</p>
              <div class="btn-row"><button class="btn primary" type="submit">${UI.icon('check')}Enregistrer</button></div>
            </form>
          </section>
        </div>

        <section class="card">
          <div class="card-head"><h2>${UI.icon('palette')} Apparence</h2><span class="muted small">Enregistré automatiquement</span></div>
          <form id="f-theme">
            <div class="pref-row"><b>Couleur</b><div class="swatches">${Object.entries(Themes.COULEURS).map(([k, l]) =>
              `<label class="swatch sw-${k}"><input type="radio" name="couleur" value="${k}" ${p.couleur === k ? 'checked' : ''}><span></span>${l}</label>`).join('')}</div></div>
            <div class="pref-row"><b>Mode</b><div class="seg">${radio('mode', 'auto', 'Auto (appareil)', p.mode)}${radio('mode', 'clair', '☀️ Clair', p.mode)}${radio('mode', 'sombre', '🌙 Sombre', p.mode)}</div></div>
            <div class="pref-row"><label class="switch"><span>Mode daltonien<small>Couleurs adaptées (bleu/orange) et formes différentes dans les graphiques</small></span><input type="checkbox" name="daltonien" ${p.daltonien === 'oui' ? 'checked' : ''}><span class="track"></span></label></div>
            <div class="pref-row"><b>Thème de saison</b><select name="saison">
              <option value="auto" ${p.saison === 'auto' ? 'selected' : ''}>Automatique selon la date (actuellement : ${UI.esc(Saisons.LISTE[Saisons.detect()].nom)} ${Saisons.liste(Saisons.detect())[0]})</option>
              <option value="aucune" ${p.saison === 'aucune' ? 'selected' : ''}>Aucun</option>
              ${Object.entries(Saisons.LISTE).map(([k, s]) => `<option value="${k}" ${p.saison === k ? 'selected' : ''}>${Saisons.liste(k)[0]} ${s.nom}</option>`).join('')}
            </select>
              <div class="range-row"><span>Quantité</span><input type="range" name="saison_qte" min="0" max="60" step="1" value="${UI.esc(p.saison_qte)}" aria-label="Quantité d'emojis"><output>${UI.esc(p.saison_qte)}</output></div>
              <div class="range-row"><span>Vitesse</span><input type="range" name="saison_vitesse" min="0" max="10" step="1" value="${UI.esc(p.saison_vitesse)}" aria-label="Vitesse des emojis"><output>${UI.esc(p.saison_vitesse)}</output></div>
              <p class="hint">Les emojis se baladent sur tout le site (0 = aucun / immobiles). Ils ajoutent des emojis et des sons, sans changer les couleurs.</p></div>
            <div class="pref-row"><label class="switch"><span>Sons<small>Mélodie de validation et alerte insuline</small></span><input type="checkbox" name="son" ${p.son !== 'non' ? 'checked' : ''}><span class="track"></span></label>
              <div class="btn-row"><button type="button" class="btn sm" id="test-son">${UI.icon('sound')}Tester le son</button><button type="button" class="btn sm" id="test-alerte">${UI.icon('alert')}Tester l'alerte</button></div></div>
          </form>
        </section>
      </div>`;

    UI.$('#btn-logout', el).onclick = () => App.logout();

    const rerender = () => this.render(el);
    const on = UI.$('#pin-on', el), change = UI.$('#pin-change', el), off = UI.$('#pin-off', el), lock = UI.$('#pin-lock', el), delai = UI.$('#pin-delai', el);
    if (on) on.onclick = () => Pin.activer(rerender);
    if (change) change.onclick = () => Pin.activer(rerender);
    if (off) off.onclick = () => Pin.desactiver(rerender);
    if (lock) lock.onclick = () => Pin.verrouiller();
    if (delai) delai.onchange = () => { Pin.setDelai(Number(delai.value)); UI.toast('Réglage enregistré pour cet appareil'); };
    API.call('pinList').then(list => {
      const box = UI.$('#pin-devices', el);
      if (!box) return;
      const ici = Pin.pour(S.me.id);
      box.innerHTML = list.length ? list.map(d => `<div class="device-row">${UI.icon('lock')}<div class="info"><b>${UI.esc(d.nom)}${ici && ici.device_id === d.id ? ' (cet appareil)' : ''}</b><span class="muted small">Activé le ${UI.esc(UI.fmtD(d.cree_le))} · dernière utilisation ${UI.esc(UI.fmtDT(d.dernier_usage))}</span></div>
        <button class="icon-btn danger" data-revoke="${d.id}" aria-label="Retirer">${UI.icon('trash')}</button></div>`).join('') : '<p class="muted small">Aucun appareil.</p>';
      box.onclick = async e => {
        const b = e.target.closest('[data-revoke]');
        if (!b) return;
        if (!(await UI.confirm('Retirer le code PIN de cet appareil ?', { danger: true, ok: 'Retirer' }))) return;
        try {
          await App.write('pinRevoke', { id: b.dataset.revoke }, { self: true });
          if (ici && ici.device_id === b.dataset.revoke) Pin.retirer(S.me.id);
          rerender();
        } catch (err) { /* déjà signalé */ }
      };
    }).catch(() => { const box = UI.$('#pin-devices', el); if (box) box.innerHTML = '<p class="muted small">Liste indisponible.</p>'; });

    UI.$('#f-semainier', el).onsubmit = async e => {
      e.preventDefault();
      const d = UI.formData(e.target);
      try {
        const r = await App.write('saveSemainier', d, { self: true });
        if (!S.ro) Object.assign(S.params, r);
        UI.toast('Réglages du semainier enregistrés');
      } catch (err) { /* déjà signalé */ }
    };

    const photo = Photos.field(UI.$('#pf-profil', el), u.photo || '', { nom: 'profil', rond: true, self: true });
    UI.$('#f-profil', el).onsubmit = async e => {
      e.preventDefault();
      const d = UI.formData(e.target);
      try {
        d.photo = await photo.value();
        const r = await App.write('updateProfil', d, { self: true });
        Object.assign(S.me, r);
        if (S.viewing.id === S.me.id) Object.assign(S.viewing, r);
        S.users = S.users.map(x => x.id === r.id ? r : x);
        App.header();
        UI.toast('Profil enregistré');
      } catch (err) { /* déjà signalé */ }
    };

    UI.$('#f-mdp', el).onsubmit = async e => {
      e.preventDefault();
      const d = UI.formData(e.target);
      if (d.nouveau !== d.confirmation) { UI.toast('Les deux mots de passe ne correspondent pas', 'warn'); return; }
      try {
        await App.write('changePassword', { ancien: d.ancien, nouveau: d.nouveau }, { self: true });
        e.target.reset();
        UI.toast('Mot de passe modifié');
      } catch (err) { /* déjà signalé */ }
    };

    const ft = UI.$('#f-theme', el);
    let timer = null;
    const lire = () => {
      const d = UI.formData(ft);
      return { couleur: d.couleur, mode: d.mode, daltonien: d.daltonien, saison: d.saison, son: d.son, saison_qte: d.saison_qte, saison_vitesse: d.saison_vitesse };
    };
    const appliquer = (sauver) => {
      const prefs = lire();
      UI.$$('.range-row', ft).forEach(r => { UI.$('output', r).textContent = UI.$('input', r).value; });
      Object.assign(S.me, prefs);
      Themes.apply(S.me);
      if (!sauver) return;
      clearTimeout(timer);
      timer = setTimeout(() => { App.write('updateProfil', prefs, { self: true }).catch(() => {}); }, 600);
    };
    ft.addEventListener('input', e => { if (e.target.type === 'range') appliquer(false); });
    ft.addEventListener('change', () => appliquer(true));
    UI.$('#test-son', el).onclick = e => { Sons.play('ok', true); Saisons.burst(e.currentTarget.getBoundingClientRect()); };
    UI.$('#test-alerte', el).onclick = () => Sons.play('alerte', true);
  }
};
