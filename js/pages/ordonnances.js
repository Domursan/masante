/**
 * MA SANTÉ — Ordonnances : tableau, ajout / modification, photo, archivage
 */
Pages.ordonnances = {
  filtre: 'actives',
  q: '',

  posologie(o) { return ['matin', 'midi', 'soir', 'nuit'].map(m => (o[m] && String(o[m]).trim()) || '0').join('-'); },

  validiteTxt(o) {
    if (o.type_validite === 'duree' && o.duree) return `${o.duree} ${o.duree_unite || 'mois'}`;
    if (o.date_fin) return 'jusqu\'au ' + UI.fmtD(o.date_fin);
    return '—';
  },

  render(el) {
    const q = this.q.toLowerCase();
    const list = S.data.ordonnances
      .filter(o => this.filtre === 'toutes' || (this.filtre === 'actives' ? o.actif === 'oui' : o.actif !== 'oui'))
      .filter(o => !q || [o.medicament, o.dosage, o.remarque].join(' ').toLowerCase().includes(q))
      .sort((a, b) => (a.medicament || '').localeCompare(b.medicament || '', 'fr'));
    const nb = k => S.data.ordonnances.filter(o => k === 'toutes' || (k === 'actives' ? o.actif === 'oui' : o.actif !== 'oui')).length;

    el.innerHTML = `
      <div class="page-head"><h1>Ordonnances</h1>
        <button class="btn primary w" id="ord-add">${UI.icon('plus')}Nouvelle ordonnance</button></div>
      <div class="toolbar">
        <div class="chips">${[['actives', 'Actives'], ['archivees', 'Archivées'], ['toutes', 'Toutes']].map(([k, l]) =>
          `<button class="chip ${this.filtre === k ? 'active' : ''}" data-f="${k}">${l} (${nb(k)})</button>`).join('')}</div>
        <label class="search"><span class="sr-only">Rechercher</span>${UI.icon('search')}<input type="search" id="ord-q" placeholder="Rechercher un médicament…" value="${UI.esc(this.q)}"></label>
      </div>
      <div class="card">${list.length ? `<div class="table-wrap"><table class="table resp table-ord">
        <thead><tr><th class="c-photo"></th><th>Médicament</th><th>Ordonnance</th><th class="c-poso">Posologie<small>M-Mi-S-N</small></th><th>Stock</th><th class="c-act"></th></tr></thead>
        <tbody>${list.map(o => {
          const st = UI.statut(o);
          const si = UI.stockInfo(o);
          return `<tr class="${o.actif === 'oui' ? '' : 'archived'}">
            <td data-label="Photo" class="c-photo">${o.photo ? `<img class="thumb" data-ref="${UI.esc(o.photo)}" data-zoom="${UI.esc(o.photo)}" alt="Photo de l'ordonnance" hidden>` : `<span class="thumb-empty">${UI.icon('file')}</span>`}</td>
            <td data-label="Médicament" class="cell-title"><div class="ord-med"><b>${UI.esc(o.medicament)}</b>${o.dosage ? ` <span class="ord-dose">${UI.esc(o.dosage)}</span>` : ''}
              <div class="ord-meta"><span class="badge p">${CATEGORIES[o.categorie] || 'Constant'}</span></div>
              ${o.remarque ? `<span class="muted small ord-rem">${UI.esc(o.remarque)}</span>` : ''}</div></td>
            <td data-label="Ordonnance"><div class="ord-val"><span class="small">Du ${UI.esc(UI.fmtD(o.date_ordonnance))}</span><span class="small muted">${UI.esc(this.validiteTxt(o))}</span>${UI.badge(st.cls, st.label + (st.fin && o.type_validite === 'duree' ? ' · ' + UI.fmtD(st.fin) : ''))}</div></td>
            <td data-label="Posologie" class="c-poso"><span class="mono">${UI.esc(this.posologie(o))}</span></td>
            <td data-label="Stock">${si ? `<button type="button" class="badge ${si.cls} badge-btn" data-stock="${o.id}">${UI.esc(si.label)}</button>` : '<span class="muted small">Non suivi</span>'}</td>
            <td class="actions c-act w" data-label=""><div class="ord-actions">
              <button class="icon-btn" data-edit="${o.id}" aria-label="Modifier" title="Modifier">${UI.icon('edit')}</button>
              <button class="icon-btn" data-stock="${o.id}" aria-label="Stock" title="Stock / nouvelle boîte">${UI.icon('box')}</button>
              <button class="icon-btn" data-arch="${o.id}" aria-label="${o.actif === 'oui' ? 'Archiver' : 'Réactiver'}" title="${o.actif === 'oui' ? 'Archiver' : 'Réactiver'}">${UI.icon(o.actif === 'oui' ? 'archive' : 'restore')}</button>
              <button class="icon-btn danger" data-del="${o.id}" aria-label="Supprimer" title="Supprimer">${UI.icon('trash')}</button>
            </div></td></tr>`;
        }).join('')}</tbody></table></div>`
        : UI.empty(this.q ? 'Aucun résultat.' : 'Aucune ordonnance ici.', !this.q && this.filtre !== 'archivees' ? `<button class="btn primary w" data-add>${UI.icon('plus')}Ajouter une ordonnance</button>` : '')}</div>`;

    UI.$$('img[data-ref]', el).forEach(img => Photos.fill(img, img.dataset.ref));
    UI.$$('[data-f]', el).forEach(b => b.onclick = () => { this.filtre = b.dataset.f; this.render(el); });
    const qi = UI.$('#ord-q', el);
    qi.oninput = () => { this.q = qi.value; const pos = qi.selectionStart; this.render(el); const n = UI.$('#ord-q', el); n.focus(); n.setSelectionRange(pos, pos); };
    UI.$('#ord-add', el).onclick = () => this.form(null, el);
    el.onclick = async e => {
      const t = e.target.closest('[data-edit],[data-arch],[data-del],[data-zoom],[data-add],[data-stock]');
      if (!t) return;
      if (t.dataset.add !== undefined) return this.form(null, el);
      if (t.dataset.zoom) return Photos.lightbox(t.dataset.zoom);
      if (t.dataset.stock) return Pages.medicaments.stockModal(S.data.ordonnances.find(o => o.id === t.dataset.stock), () => this.render(el));
      if (t.dataset.edit) return this.form(S.data.ordonnances.find(o => o.id === t.dataset.edit), el);
      if (t.dataset.arch) {
        const o = S.data.ordonnances.find(x => x.id === t.dataset.arch);
        const r = await App.write('saveOrdonnance', { id: o.id, medicament: o.medicament, actif: o.actif === 'oui' ? 'non' : 'oui' }).catch(() => null);
        if (r) { Store.upsert('ordonnances', r); UI.toast(r.actif === 'oui' ? 'Ordonnance réactivée' : 'Ordonnance archivée'); this.render(el); }
      }
      if (t.dataset.del) {
        const o = S.data.ordonnances.find(x => x.id === t.dataset.del);
        if (!(await UI.confirm(`Supprimer définitivement l'ordonnance « ${o.medicament} » ? Astuce : l'archivage la conserve dans l'historique.`, { danger: true, ok: 'Supprimer' }))) return;
        const r = await App.write('deleteOrdonnance', { id: o.id }).catch(() => null);
        if (r) { Store.remove('ordonnances', o.id); this.render(el); }
      }
    };
  },

  form(o, el) {
    const n = !o;
    o = o || { categorie: 'constant', type_validite: 'date', duree_unite: 'mois', date_ordonnance: UI.today() };
    const sel = (v, x) => v === x ? 'selected' : '';
    const m = UI.modal({
      title: n ? 'Nouvelle ordonnance' : 'Modifier l\'ordonnance',
      wide: true,
      body: `<form class="form" id="f-ord">
        <div class="grid2">
          <label>Médicament *<input name="medicament" required value="${UI.esc(o.medicament || '')}" placeholder="ex. Metformine"></label>
          <label>Dosage<input name="dosage" value="${UI.esc(o.dosage || '')}" placeholder="ex. 500 mg"></label>
          <label>Catégorie<select name="categorie">${Object.entries(CATEGORIES).map(([k, l]) => `<option value="${k}" ${sel(o.categorie, k)}>${l}</option>`).join('')}</select></label>
          <label>Date de l'ordonnance<input type="date" name="date_ordonnance" value="${UI.esc((o.date_ordonnance || '').slice(0, 10))}"></label>
        </div>
        <fieldset><legend>Validité de l'ordonnance</legend>
          <div class="seg" role="radiogroup">
            <label><input type="radio" name="type_validite" value="date" ${o.type_validite !== 'duree' ? 'checked' : ''}><span>Date de fin</span></label>
            <label><input type="radio" name="type_validite" value="duree" ${o.type_validite === 'duree' ? 'checked' : ''}><span>Durée</span></label>
          </div>
          <div data-v="date"><label>Valable jusqu'au<input type="date" name="date_fin" value="${UI.esc((o.date_fin || '').slice(0, 10))}"></label></div>
          <div data-v="duree" class="grid2">
            <label>Durée<input type="number" name="duree" min="1" step="1" value="${UI.esc(o.duree || '')}" placeholder="ex. 3"></label>
            <label>Unité<select name="duree_unite">${[['jours', 'jours'], ['semaines', 'semaines'], ['mois', 'mois'], ['annees', 'années']].map(([k, l]) => `<option value="${k}" ${sel(o.duree_unite || 'mois', k)}>${l}</option>`).join('')}</select></label>
          </div>
          <p class="hint" id="fin-calc"></p>
        </fieldset>
        <fieldset><legend>Posologie (matin - midi - soir - nuit)</legend>
          <div class="poso-grid">${MOMENTS.map(([k, l, e]) => `<label>${e} ${l}<input name="${k}" inputmode="decimal" value="${UI.esc(o[k] || '')}" placeholder="0"></label>`).join('')}</div>
          <p class="hint">Nombre de comprimés / doses par moment (ex. 1, 0.5, 2). Pour un médicament de réserve, la posologie est facultative.</p>
        </fieldset>
        <fieldset><legend>Stock</legend>
          <label class="switch"><span>Suivre le stock<small>Le stock diminue automatiquement à chaque prise validée</small></span><input type="checkbox" name="suivi_stock" ${o.stock !== '' && o.stock != null ? 'checked' : ''}><span class="track"></span></label>
          <div class="grid2" data-stock>
            <label>Quantité actuelle (comprimés, doses…)<input name="stock" inputmode="decimal" value="${UI.esc(String(o.stock ?? '').replace('.', ','))}" placeholder="ex. 30"></label>
            <label><span data-seuil-label>Alerte quand il reste</span><input name="stock_seuil" inputmode="numeric" value="${UI.esc(o.stock_seuil || '')}" placeholder="${UI.esc(S.params.stock_alerte_jours || '7')}"></label>
            <label data-dose-reserve>Quantité par dose (réserve)<input name="dose_reserve" inputmode="decimal" value="${UI.esc(o.dose_reserve || '')}" placeholder="1"></label>
          </div>
          <p class="hint" id="stock-calc"></p>
        </fieldset>
        <div><label>Photo de l'ordonnance</label><div id="pf-ord" style="margin-top:6px"></div></div>
        <label>Remarque<textarea name="remarque" rows="2" placeholder="ex. max 3 doses par jour, à prendre pendant le repas…">${UI.esc(o.remarque || '')}</textarea></label>
      </form>`,
      actions: [
        { label: 'Annuler', cls: 'ghost' },
        { label: n ? 'Ajouter' : 'Enregistrer', cls: 'primary', onClick: async () => {
          const f = UI.$('#f-ord', m.body);
          if (!f.reportValidity()) return false;
          const d = UI.formData(f);
          if (d.type_validite === 'duree') { d.date_fin = ''; if (!d.date_ordonnance && d.duree) { UI.toast('La date de l\'ordonnance est nécessaire pour calculer la fin', 'warn'); return false; } }
          else { d.duree = ''; }
          MOMENTS.forEach(([k]) => { d[k] = (d[k] || '').replace(',', '.'); });
          if (d.suivi_stock !== 'oui') { d.stock = ''; }
          else if (d.stock === '') { UI.toast('Indique la quantité actuelle du stock', 'warn'); return false; }
          d.stock = (d.stock || '').replace(',', '.');
          d.dose_reserve = (d.dose_reserve || '').replace(',', '.');
          delete d.suivi_stock;
          d.photo = await photo.value();
          if (o.id) d.id = o.id;
          const r = await App.write('saveOrdonnance', d);
          Store.upsert('ordonnances', r);
          UI.toast(n ? 'Ordonnance ajoutée' : 'Ordonnance mise à jour');
          Sons.play('ok');
          this.render(el);
        } }
      ]
    });
    const f = UI.$('#f-ord', m.body);
    const photo = Photos.field(UI.$('#pf-ord', m.body), o.photo || '', { nom: 'ordonnance_' + (o.medicament || 'nouvelle') });
    const maj = () => {
      const d = UI.formData(f);
      UI.$('[data-v=date]', f).hidden = d.type_validite === 'duree';
      UI.$('[data-v=duree]', f).hidden = d.type_validite !== 'duree';
      const fin = UI.finValidite(d);
      const st = fin ? UI.statut(d) : null;
      const suivi = d.suivi_stock === 'oui';
      UI.$('[data-stock]', f).hidden = !suivi;
      const parJour = d.categorie !== 'reserve' && MOMENTS.some(([k]) => UI.qty(d[k]));
      UI.$('[data-seuil-label]', f).textContent = parJour ? 'Alerte quand il reste (jours)' : 'Alerte quand il reste (unités)';
      UI.$('[data-dose-reserve]', f).hidden = parJour;
      const si = suivi && d.stock !== '' ? UI.stockInfo(Object.assign({}, d, { stock: d.stock.replace(',', '.') })) : null;
      UI.$('#stock-calc', f).innerHTML = si ? `${UI.badge(si.cls, si.label)}${si.parJour && si.fin ? ` · épuisé vers le <b>${UI.esc(UI.fmtD(si.fin))}</b>` : ''}` : '';
      UI.$('#fin-calc', f).innerHTML = fin ? `Fin de validité : <b>${UI.esc(UI.fmtD(fin))}</b> ${UI.badge(st.cls, st.label)}` : 'Sans date de fin, aucune alerte de renouvellement ne sera envoyée.';
    };
    f.addEventListener('input', maj);
    f.addEventListener('change', maj);
    maj();
  }
};
