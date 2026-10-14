/**
 * MA SANTÉ — Notes libres
 */
Pages.notes = {
  q: '',

  render(el) {
    const q = this.q.toLowerCase();
    const list = S.data.notes
      .filter(n => !q || [n.titre, n.contenu].join(' ').toLowerCase().includes(q))
      .sort((a, b) => (b.epinglee === 'oui') - (a.epinglee === 'oui') || (b.date || '').localeCompare(a.date || ''));

    el.innerHTML = `
      <div class="page-head"><h1>Notes</h1><button class="btn primary w" id="note-add">${UI.icon('plus')}Nouvelle note</button></div>
      <div class="toolbar"><label class="search"><span class="sr-only">Rechercher</span>${UI.icon('search')}<input type="search" id="note-q" placeholder="Rechercher dans les notes…" value="${UI.esc(this.q)}"></label>
        <span class="muted small">${list.length} note${list.length > 1 ? 's' : ''}</span></div>
      ${list.length ? `<div class="notes-grid">${list.map(n => `
        <button class="card note-card ${n.epinglee === 'oui' ? 'pinned' : ''}" data-id="${n.id}">
          <h3><span>${UI.esc(n.titre || 'Sans titre')}</span>${n.epinglee === 'oui' ? `<span class="badge p">${UI.icon('pin')}Épinglée</span>` : ''}</h3>
          <time>${UI.esc(UI.fmtDT(n.date))}</time>
          <div class="content">${UI.esc(n.contenu || '')}</div>
        </button>`).join('')}</div>`
      : `<div class="card">${UI.empty(this.q ? 'Aucun résultat.' : 'Aucune note pour le moment.', this.q ? '' : `<button class="btn primary w" data-add>${UI.icon('plus')}Écrire une note</button>`)}</div>`}`;

    const qi = UI.$('#note-q', el);
    qi.oninput = () => { this.q = qi.value; const p = qi.selectionStart; this.render(el); const n = UI.$('#note-q', el); n.focus(); n.setSelectionRange(p, p); };
    UI.$('#note-add', el).onclick = () => this.form(null, el);
    el.onclick = e => {
      if (e.target.closest('[data-add]')) return this.form(null, el);
      const c = e.target.closest('.note-card');
      if (c) this.form(S.data.notes.find(n => n.id === c.dataset.id), el);
    };
  },

  form(n, el) {
    const nouveau = !n;
    n = n || { epinglee: 'non' };
    const actions = [{ label: 'Fermer', cls: 'ghost' }];
    if (!S.ro) {
      if (!nouveau) actions.push({ label: UI.icon('trash') + 'Supprimer', cls: 'ghost', onClick: async () => {
        if (!(await UI.confirm('Supprimer cette note ?', { danger: true, ok: 'Supprimer' }))) return false;
        await App.write('deleteNote', { id: n.id });
        Store.remove('notes', n.id);
        this.render(el);
      } });
      actions.push({ label: 'Enregistrer', cls: 'primary', onClick: async m => {
        const d = UI.formData(UI.$('form', m.body));
        if (!d.titre && !d.contenu) { UI.toast('La note est vide', 'warn'); return false; }
        if (n.id) d.id = n.id;
        const r = await App.write('saveNote', d);
        Store.upsert('notes', r);
        this.render(el);
      } });
    }
    UI.modal({
      title: nouveau ? 'Nouvelle note' : 'Note',
      wide: true,
      body: `<form class="form">
        <label>Titre<input name="titre" value="${UI.esc(n.titre || '')}" placeholder="ex. Questions pour le prochain rendez-vous" ${S.ro ? 'readonly' : ''}></label>
        <label>Contenu<textarea name="contenu" rows="10" ${S.ro ? 'readonly' : ''}>${UI.esc(n.contenu || '')}</textarea></label>
        <label class="switch"><span>Épingler sur l'accueil</span><input type="checkbox" name="epinglee" ${n.epinglee === 'oui' ? 'checked' : ''} ${S.ro ? 'disabled' : ''}><span class="track"></span></label>
        ${n.date ? `<p class="hint">Créée le ${UI.esc(UI.fmtDT(n.date))}</p>` : ''}
      </form>`,
      actions
    });
  }
};
