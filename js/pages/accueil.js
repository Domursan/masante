/**
 * MA SANTÉ — Accueil : résumé du jour
 */
Pages.accueil = {
  render(el) {
    const u = S.viewing;
    const h = new Date().getHours();
    const salut = h < 5 ? 'Bonne nuit' : h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
    const t = UI.today();
    const M = Pages.medicaments;
    const due = M.dueFor(t);
    const faits = due.filter(x => x.prise && x.prise.statut === 'pris').length;
    const restants = due.filter(x => !x.prise);
    const ordos = S.data.ordonnances.filter(o => o.actif === 'oui');
    const ren = ordos.map(o => ({ o, s: UI.statut(o) })).filter(x => x.s.k === 'bientot' || x.s.k === 'expiree').sort((a, b) => a.s.left - b.s.left);
    const stocks = ordos.map(o => ({ o, i: UI.stockInfo(o) })).filter(x => x.i && x.i.bas).sort((a, b) => a.i.stock - b.i.stock);
    const notes = S.data.notes.filter(n => n.epinglee === 'oui').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const last = Pages.signes.latest();
    const ordreMoment = { matin: 0, midi: 1, soir: 2, nuit: 3 };
    restants.sort((a, b) => ordreMoment[a.moment] - ordreMoment[b.moment]);

    el.innerHTML = `
      <div class="hero">
        ${UI.avatarHtml(u, 56)}
        <div><h1>${salut}${u.prenom ? ' ' + UI.esc(u.prenom) : ''} ${Saisons.emoji()}</h1>
        <p class="muted">${UI.esc(UI.fmtLong(t))}</p></div>
      </div>

      <div class="tiles">
        <a class="tile" href="#medicaments"><span class="ti">${UI.icon('pill')}</span><b>Médicaments</b><small>${due.length ? `${faits}/${due.length} prises` : 'Aucune prise prévue'}</small></a>
        <a class="tile" href="#signes"><span class="ti">${UI.icon('activity')}</span><b>Signes vitaux</b><small>${S.data.signes.length} mesure${S.data.signes.length > 1 ? 's' : ''}</small></a>
        <a class="tile" href="#ordonnances"><span class="ti">${UI.icon('file')}</span><b>Ordonnances</b><small>${ordos.length} active${ordos.length > 1 ? 's' : ''}${ren.length ? ` · ${ren.length} à renouveler` : ''}</small></a>
        <a class="tile" href="#notes"><span class="ti">${UI.icon('note')}</span><b>Notes</b><small>${S.data.notes.length} note${S.data.notes.length > 1 ? 's' : ''}</small></a>
        <a class="tile" href="#urgence"><span class="ti">${UI.icon('cross')}</span><b>Fiche d'urgence</b><small>${S.data.fiche && S.data.fiche._maj ? 'À jour du ' + UI.esc(UI.fmtD(S.data.fiche._maj)) : 'À remplir'}</small></a>
        <a class="tile" href="#rapport"><span class="ti">${UI.icon('report')}</span><b>Rapport médecin</b><small>PDF complet</small></a>
      </div>

      <div class="home-grid">
        <section class="card">
          <div class="card-head"><h2>${UI.icon('pill')} Aujourd'hui</h2><a href="#medicaments" class="btn sm">Tout voir</a></div>
          ${due.length ? `<div class="progress"><span style="width:${Math.round(faits / due.length * 100)}%"></span></div><p class="muted small" style="margin-top:6px">${faits} sur ${due.length} prises effectuées</p>` : ''}
          <div class="mini-list">
            ${restants.length ? restants.slice(0, 6).map(x => {
              const mm = MOMENTS.find(m => m[0] === x.moment);
              return `<div class="mini-item"><div class="lbl"><b>${UI.esc(x.o.medicament)}</b><span class="muted small">${mm[2]} ${mm[1]} · dose ${UI.esc(x.q)}</span></div>
                <button class="btn-check w" data-o="${x.o.id}" data-m="${x.moment}">${UI.icon('check')}<span>Pris</span></button></div>`;
            }).join('') + (restants.length > 6 ? `<p class="muted small">… et ${restants.length - 6} autre(s)</p>` : '')
            : `<p class="muted">${due.length ? '🎉 Tout est fait pour aujourd\'hui.' : 'Aucune prise prévue aujourd\'hui.'}</p>`}
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h2>${UI.icon('activity')} Dernières mesures</h2><a href="#signes" class="btn sm w">${UI.icon('plus')}Saisir</a></div>
          ${Object.keys(last).length ? `<div class="vitals">${Object.keys(SIGNES).filter(k => last[k]).map(k => {
            const s = last[k];
            return `<div class="vital" style="--c:${Pages.signes.couleur(k)}"><small>${SIGNES[k].label}</small><b>${UI.esc(Pages.signes.valeurTxt(s))}</b><span class="u">${UI.esc(Pages.signes.unite(k))}</span><time>${UI.esc(UI.fmtDT(s.date_heure))}</time></div>`;
          }).join('')}</div>` : '<p class="muted">Aucune mesure enregistrée.</p>'}
        </section>

        <section class="card">
          <div class="card-head"><h2>${UI.icon('alert')} À prévoir</h2></div>
          <div class="mini-list">
            ${ren.map(x => `<a class="mini-item" href="#ordonnances" style="color:inherit"><div class="lbl"><b>📄 ${UI.esc(x.o.medicament)}</b><span class="muted small">Ordonnance · fin ${UI.esc(UI.fmtD(x.s.fin))}</span></div>${UI.badge(x.s.cls, x.s.label)}</a>`).join('')}
            ${stocks.map(x => `<button type="button" class="mini-item badge-row" data-stock="${x.o.id}"><div class="lbl"><b>💊 ${UI.esc(x.o.medicament)}</b><span class="muted small">Stock bas${x.i.fin ? ' · épuisé vers le ' + UI.esc(UI.fmtD(x.i.fin)) : ''}</span></div>${UI.badge(x.i.cls, x.i.label)}</button>`).join('')}
            ${!ren.length && !stocks.length ? '<p class="muted">Rien à prévoir : ordonnances valides et stocks suffisants.</p>' : ''}
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h2>${UI.icon('pin')} Notes épinglées</h2><a href="#notes" class="btn sm">Toutes les notes</a></div>
          <div class="mini-list">${notes.length ? notes.slice(0, 4).map(n => `<a class="mini-item" href="#notes" style="color:inherit"><div class="lbl"><b>${UI.esc(n.titre || 'Sans titre')}</b><span class="muted small">${UI.esc((n.contenu || '').slice(0, 90))}</span></div></a>`).join('')
            : '<p class="muted">Épingle une note pour la retrouver ici.</p>'}</div>
        </section>
      </div>`;

    el.onclick = async e => {
      const sb = e.target.closest('[data-stock]');
      if (sb) return M.stockModal(S.data.ordonnances.find(o => o.id === sb.dataset.stock), () => { this.render(el); UI.fillAvatars(el); });
      const b = e.target.closest('.btn-check');
      if (!b) return;
      const rect = b.getBoundingClientRect();
      b.disabled = true;
      const r = await M.marquer(b.dataset.o, t, b.dataset.m, 'pris');
      if (r === 'pris') Saisons.burst(rect);
      this.render(el);
      UI.fillAvatars(el);
    };
  }
};