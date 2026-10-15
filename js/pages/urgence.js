/**
 * MA SANTÉ — Fiche d'urgence
 * Informations vitales à montrer aux secours : affichage plein écran, QR code, PDF,
 * et copie optionnelle sur l'appareil pour un accès SANS connexion (écran de connexion).
 */
const GROUPES_SANGUINS = ['', 'A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−', 'Inconnu'];

Pages.urgence = {
  edition: false,
  CLE_LOCALE: 'ms_urgence',

  /* ---------- Données ---------- */
  fiche() { return S.data.fiche || {}; },

  traitements() {
    return S.data.ordonnances.filter(o => o.actif === 'oui').map(o => ({
      medicament: o.medicament, dosage: o.dosage || '', categorie: o.categorie || 'constant',
      poso: Pages.ordonnances.posologie(o)
    })).sort((a, b) => a.medicament.localeCompare(b.medicament, 'fr'));
  },

  age(dn) {
    const d = UI.parse(dn);
    if (!d) return '';
    const n = new Date();
    let a = n.getFullYear() - d.getFullYear();
    if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) a--;
    return a >= 0 ? `${a} ans` : '';
  },

  /** Événements de l'historique marqués « importants » (les plus récents d'abord). */
  antecedents() {
    if (!Pages.historique || !S.data.historique) return [];
    const H = Pages.historique;
    return S.data.historique.filter(h => h.important === 'oui')
      .sort((a, b) => b.date_debut.localeCompare(a.date_debut))
      .map(h => ({ titre: h.titre, type: H.type(h).label, e: H.type(h).e, periode: H.periode(h), diagnostic: h.diagnostic || '' }));
  },

  snapshot() {
    return { user: { id: S.viewing.id, prenom: S.viewing.prenom, nom: S.viewing.nom, identifiant: S.viewing.identifiant }, fiche: this.fiche(), traitements: this.traitements(), antecedents: this.antecedents(), maj: UI.nowDT() };
  },

  /* ---------- Copie locale (accès hors connexion) ---------- */
  locales() {
    try { return JSON.parse(localStorage.getItem(this.CLE_LOCALE)) || {}; } catch (e) { return {}; }
  },
  setLocales(o) {
    try { if (Object.keys(o).length) localStorage.setItem(this.CLE_LOCALE, JSON.stringify(o)); else localStorage.removeItem(this.CLE_LOCALE); } catch (e) { /* ignoré */ }
    App.majBoutonUrgence();
  },
  estLocale() { return !!this.locales()[S.me.id]; },
  syncLocal() {
    if (!S.me || S.ro) return;
    const l = this.locales();
    if (l[S.me.id]) { l[S.me.id] = this.snapshot(); this.setLocales(l); }
  },

  /* ---------- Texte (QR code) ---------- */
  texte(snap) {
    const f = snap.fiche, u = snap.user;
    const l = [`FICHE D'URGENCE - ${[u.prenom, u.nom].filter(Boolean).join(' ')}`];
    if (f.date_naissance) l.push(`Né(e) le ${UI.fmtD(f.date_naissance)} (${this.age(f.date_naissance)})`);
    if (f.groupe_sanguin) l.push(`Groupe sanguin : ${f.groupe_sanguin}`);
    if (f.allergies) l.push(`ALLERGIES : ${f.allergies}`);
    if (f.pathologies) l.push(`Pathologies : ${f.pathologies}`);
    if ((snap.antecedents || []).length) l.push('Antécédents : ' + snap.antecedents.map(a => `${a.titre} (${a.periode})`).join(' ; '));
    if (snap.traitements.length) l.push('Traitements : ' + snap.traitements.map(t => `${t.medicament} ${t.dosage} (${t.categorie === 'reserve' ? 'si besoin' : t.poso})`).join(' ; '));
    if (f.traitements_autres) l.push(`Autres : ${f.traitements_autres}`);
    if (f.dispositifs) l.push(`Dispositifs : ${f.dispositifs}`);
    (f.contacts || []).filter(c => c.nom || c.tel).forEach(c => l.push(`Contact : ${c.nom}${c.lien ? ' (' + c.lien + ')' : ''} ${c.tel}`));
    if (f.medecin_nom || f.medecin_tel) l.push(`Médecin : ${f.medecin_nom || ''} ${f.medecin_tel || ''}`);
    if (f.directives) l.push(`Directives : ${f.directives}`);
    return l.join('\n').slice(0, 1500);
  },

  qrSvg(txt) {
    if (typeof qrcode === 'undefined') return '<p class="muted">Le générateur de QR code n\'a pas pu être chargé.</p>';
    let t = txt;
    if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
    else t = txt.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x00-\x7F]/g, '');
    const qr = qrcode(0, 'L');
    qr.addData(t, 'Byte');
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  },

  /* ---------- Affichage plein écran (utilisable sans connexion) ---------- */
  plein(snap) {
    const f = snap.fiche, u = snap.user;
    const tel = t => t ? `<a class="u-tel" href="tel:${UI.esc(String(t).replace(/[^\d+]/g, ''))}">📞 ${UI.esc(t)}</a>` : '';
    const bloc = (titre, contenu, cls = '') => contenu ? `<section class="u-bloc ${cls}"><h3>${titre}</h3>${contenu}</section>` : '';
    const ov = document.createElement('div');
    ov.className = 'urgence-plein';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-label', "Fiche d'urgence");
    ov.innerHTML = `
      <header><span>🚑 URGENCE MÉDICALE</span><button class="u-close" aria-label="Fermer">${UI.icon('x')}</button></header>
      <div class="u-body">
        <h1>${UI.esc([u.prenom, u.nom].filter(Boolean).join(' ') || u.identifiant)}</h1>
        <p class="u-id">${f.date_naissance ? `Né(e) le <b>${UI.esc(UI.fmtD(f.date_naissance))}</b> · ${UI.esc(this.age(f.date_naissance))}` : ''}
          ${f.groupe_sanguin ? `<span class="u-groupe">🩸 ${UI.esc(f.groupe_sanguin)}</span>` : ''}
          ${f.poids ? ` · ${UI.esc(f.poids)} kg` : ''}${f.taille ? ` · ${UI.esc(f.taille)} cm` : ''}</p>
        ${bloc('⚠️ Allergies', f.allergies ? `<p>${UI.esc(f.allergies)}</p>` : '<p>Aucune allergie connue</p>', 'u-alerte')}
        ${bloc('Pathologies / antécédents', f.pathologies || (snap.antecedents || []).length
          ? `${f.pathologies ? `<p>${UI.esc(f.pathologies)}</p>` : ''}${(snap.antecedents || []).length ? `<ul>${snap.antecedents.map(a => `<li>${a.e} <b>${UI.esc(a.titre)}</b> — ${UI.esc(a.periode)}${a.diagnostic ? `<br><small>${UI.esc(a.diagnostic)}</small>` : ''}</li>`).join('')}</ul>` : ''}` : '')}
        ${bloc('Traitements en cours', snap.traitements.length || f.traitements_autres
          ? `<ul>${snap.traitements.map(t => `<li><b>${UI.esc(t.medicament)}</b> ${UI.esc(t.dosage)} — ${t.categorie === 'reserve' ? 'si besoin' : UI.esc(t.poso)}</li>`).join('')}</ul>${f.traitements_autres ? `<p>${UI.esc(f.traitements_autres)}</p>` : ''}` : '')}
        ${bloc('Dispositifs médicaux', f.dispositifs ? `<p>${UI.esc(f.dispositifs)}</p>` : '')}
        ${bloc('Personnes à contacter', (f.contacts || []).filter(c => c.nom || c.tel).map(c => `<p><b>${UI.esc(c.nom)}</b>${c.lien ? ` (${UI.esc(c.lien)})` : ''}<br>${tel(c.tel)}</p>`).join(''))}
        ${bloc('Médecin traitant', f.medecin_nom || f.medecin_tel ? `<p><b>${UI.esc(f.medecin_nom || '')}</b><br>${tel(f.medecin_tel)}</p>` : '')}
        ${bloc('Assurance maladie', f.assurance ? `<p>${UI.esc(f.assurance)}</p>` : '')}
        ${bloc('Directives / souhaits', f.directives ? `<p>${UI.esc(f.directives)}</p>` : '')}
        ${bloc('Informations complémentaires', f.notes ? `<p>${UI.esc(f.notes)}</p>` : '')}
        <p class="u-maj">Mise à jour : ${UI.esc(UI.fmtDT(f._maj || snap.maj))}</p>
      </div>`;
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    ov.querySelector('.u-close').onclick = close;
    document.addEventListener('keydown', onKey);
    document.body.appendChild(ov);
    if (ov.requestFullscreen && matchMedia('(pointer: coarse)').matches) ov.requestFullscreen().catch(() => {});
  },

  /** Depuis l'écran de connexion : choix de la personne si plusieurs copies locales. */
  ouvrirHorsConnexion() {
    const l = Object.values(this.locales());
    if (!l.length) return;
    if (l.length === 1) return this.plein(l[0]);
    UI.modal({
      title: "🚑 Fiche d'urgence",
      body: `<div class="mini-list">${l.map((s, i) => `<button class="mini-item badge-row" data-i="${i}"><div class="lbl"><b>${UI.esc([s.user.prenom, s.user.nom].filter(Boolean).join(' ') || s.user.identifiant)}</b></div>${UI.icon('right')}</button>`).join('')}</div>`
    }).body.addEventListener('click', e => {
      const b = e.target.closest('[data-i]');
      if (b) { b.closest('.modal-wrap').remove(); document.body.classList.remove('modal-open'); this.plein(l[Number(b.dataset.i)]); }
    });
  },

  /* ---------- Page ---------- */
  render(el) {
    const f = this.fiche();
    const snap = this.snapshot();
    const vide = !Object.keys(f).filter(k => k !== '_maj' && f[k] && (!Array.isArray(f[k]) || f[k].some(c => c.nom || c.tel))).length;
    if (this.edition && !S.ro) return this.formulaire(el);

    el.innerHTML = `
      <div class="page-head"><div><h1>Fiche d'urgence</h1><p class="muted">À montrer aux secours ou au personnel soignant.</p></div>
        <div class="btn-row">
          <button class="btn w" id="u-edit">${UI.icon('edit')}Modifier</button>
          <button class="btn danger" id="u-plein">🚑 Afficher pour les secours</button>
        </div></div>
      ${vide ? `<div class="card">${UI.empty("La fiche est vide. Renseigne au moins tes allergies, tes pathologies et une personne à contacter.", '<button class="btn primary w" id="u-edit2">' + UI.icon('edit') + 'Remplir la fiche</button>')}</div>` : ''}
      <div class="settings-grid">
        <section class="card">
          <div class="card-head"><h2>${UI.icon('heart')} Résumé</h2>${f._maj ? `<span class="muted small">Mise à jour : ${UI.esc(UI.fmtDT(f._maj))}</span>` : ''}</div>
          <div class="mini-list">
            ${[['Date de naissance', f.date_naissance ? `${UI.fmtD(f.date_naissance)} (${this.age(f.date_naissance)})` : ''], ['Groupe sanguin', f.groupe_sanguin], ['Poids / taille', [f.poids && f.poids + ' kg', f.taille && f.taille + ' cm'].filter(Boolean).join(' · ')],
              ['⚠️ Allergies', f.allergies], ['Pathologies', f.pathologies], ['Dispositifs', f.dispositifs], ['Médecin traitant', [f.medecin_nom, f.medecin_tel].filter(Boolean).join(' · ')], ['Assurance', f.assurance], ['Directives', f.directives]]
              .filter(([, v]) => v).map(([k, v]) => `<div class="mini-item"><div class="lbl"><span class="muted small">${k}</span><b style="white-space:pre-wrap">${UI.esc(v)}</b></div></div>`).join('')}
            ${(f.contacts || []).filter(c => c.nom || c.tel).map(c => `<div class="mini-item"><div class="lbl"><span class="muted small">Contact${c.lien ? ' · ' + UI.esc(c.lien) : ''}</span><b>${UI.esc(c.nom)}</b></div><a class="btn sm" href="tel:${UI.esc(String(c.tel || '').replace(/[^\d+]/g, ''))}">📞 ${UI.esc(c.tel)}</a></div>`).join('')}
          </div>
          ${snap.antecedents.length ? `<h3 style="margin:16px 0 8px">Antécédents importants <span class="muted small">(repris de l'historique médical, marqués ⭐)</span></h3>
          <div class="mini-list">${snap.antecedents.map(a => `<a class="mini-item" href="#historique" style="color:inherit"><div class="lbl"><b>${a.e} ${UI.esc(a.titre)}</b><span class="muted small">${UI.esc(a.periode)}${a.diagnostic ? ' · ' + UI.esc(a.diagnostic) : ''}</span></div></a>`).join('')}</div>` : ''}
          <h3 style="margin:16px 0 8px">Traitements en cours <span class="muted small">(repris automatiquement des ordonnances actives)</span></h3>
          <div class="mini-list">${snap.traitements.length ? snap.traitements.map(t => `<div class="mini-item"><div class="lbl"><b>${UI.esc(t.medicament)}</b><span class="muted small">${UI.esc(t.dosage)}</span></div><span class="mono">${t.categorie === 'reserve' ? 'si besoin' : UI.esc(t.poso)}</span></div>`).join('') : '<p class="muted">Aucun traitement actif.</p>'}</div>
        </section>

        <div class="stack">
          <section class="card">
            <div class="card-head"><h2>${UI.icon('image')} QR code</h2><button class="btn sm" id="u-qr-dl">${UI.icon('download')}Télécharger</button></div>
            <p class="hint">Contient le résumé en texte (aucun lien, aucune connexion nécessaire). Idéal en fond d'écran verrouillé ou imprimé dans le portefeuille.</p>
            <div class="qr-box" id="u-qr">${this.qrSvg(this.texte(snap))}</div>
          </section>
          <section class="card">
            <div class="card-head"><h2>${UI.icon('download')} Exporter</h2></div>
            <div class="btn-row"><button class="btn" id="u-pdf">${UI.icon('file')}Télécharger le PDF</button></div>
          </section>
          ${S.ro ? '' : `<section class="card">
            <div class="card-head"><h2>${UI.icon('shield')} Accès sans connexion</h2></div>
            <label class="switch"><span>Garder une copie sur cet appareil<small>Un bouton « 🚑 Fiche d'urgence » apparaît sur l'écran de connexion, consultable sans mot de passe. Mise à jour automatique à chaque connexion. Active-le seulement sur ton propre téléphone.</small></span><input type="checkbox" id="u-local" ${this.estLocale() ? 'checked' : ''}><span class="track"></span></label>
          </section>`}
        </div>
      </div>`;

    const edit = () => { this.edition = true; this.render(el); };
    UI.$('#u-edit', el).onclick = edit;
    if (UI.$('#u-edit2', el)) UI.$('#u-edit2', el).onclick = edit;
    UI.$('#u-plein', el).onclick = () => this.plein(snap);
    UI.$('#u-pdf', el).onclick = () => this.pdf(snap);
    UI.$('#u-qr-dl', el).onclick = () => {
      const svg = UI.$('#u-qr svg', el);
      if (!svg) return;
      Export.download(new Blob([svg.outerHTML], { type: 'image/svg+xml' }), `fiche-urgence_${Export.slug(UI.nomComplet(S.viewing))}.svg`);
    };
    const loc = UI.$('#u-local', el);
    if (loc) loc.onchange = () => {
      const l = this.locales();
      if (loc.checked) { l[S.me.id] = this.snapshot(); UI.toast("Copie enregistrée sur cet appareil"); }
      else { delete l[S.me.id]; UI.toast('Copie supprimée de cet appareil'); }
      this.setLocales(l);
    };
  },

  formulaire(el) {
    const f = this.fiche();
    const contacts = (f.contacts || []).concat([{}, {}, {}]).slice(0, 3);
    const ta = (name, label, ph) => `<label>${label}<textarea name="${name}" rows="2" placeholder="${ph}">${UI.esc(f[name] || '')}</textarea></label>`;
    el.innerHTML = `
      <div class="page-head"><h1>Modifier la fiche d'urgence</h1></div>
      <form class="card form" id="f-urgence">
        <div class="grid2">
          <label>Date de naissance<input type="date" name="date_naissance" value="${UI.esc(f.date_naissance || '')}"></label>
          <label>Groupe sanguin<select name="groupe_sanguin">${GROUPES_SANGUINS.map(g => `<option value="${g}" ${f.groupe_sanguin === g ? 'selected' : ''}>${g || '—'}</option>`).join('')}</select></label>
          <label>Poids (kg)<input name="poids" inputmode="decimal" value="${UI.esc(f.poids || '')}"></label>
          <label>Taille (cm)<input name="taille" inputmode="numeric" value="${UI.esc(f.taille || '')}"></label>
        </div>
        ${ta('allergies', '⚠️ Allergies (médicaments, aliments, autres)', 'ex. Pénicilline, arachides… ou « aucune connue »')}
        ${ta('pathologies', 'Pathologies / antécédents importants', 'ex. Diabète de type 1, asthme…')}
        ${ta('traitements_autres', 'Autres traitements (hors ordonnances de l\'app)', 'ex. contraception, compléments…')}
        ${ta('dispositifs', 'Dispositifs médicaux', 'ex. pompe à insuline, capteur de glycémie, pacemaker…')}
        <fieldset><legend>Personnes à contacter</legend>
          ${contacts.map((c, i) => `<div class="grid3">
            <label>Nom<input name="c_nom_${i}" value="${UI.esc(c.nom || '')}"></label>
            <label>Lien<input name="c_lien_${i}" value="${UI.esc(c.lien || '')}" placeholder="ex. conjoint, mère…"></label>
            <label>Téléphone<input type="tel" name="c_tel_${i}" value="${UI.esc(c.tel || '')}"></label></div>`).join('')}
        </fieldset>
        <div class="grid2">
          <label>Médecin traitant<input name="medecin_nom" value="${UI.esc(f.medecin_nom || '')}" placeholder="Dr …"></label>
          <label>Téléphone du médecin<input type="tel" name="medecin_tel" value="${UI.esc(f.medecin_tel || '')}"></label>
        </div>
        <label>Assurance maladie<input name="assurance" value="${UI.esc(f.assurance || '')}" placeholder="ex. nom de la caisse"></label>
        ${ta('directives', 'Directives anticipées / souhaits', 'ex. directives déposées chez…, personne de confiance…')}
        ${ta('notes', 'Informations complémentaires', '')}
        <div class="btn-row"><button type="button" class="btn ghost" id="u-annuler">Annuler</button><button class="btn primary" type="submit">${UI.icon('check')}Enregistrer</button></div>
      </form>`;
    UI.$('#u-annuler', el).onclick = () => { this.edition = false; this.render(el); };
    UI.$('#f-urgence', el).onsubmit = async e => {
      e.preventDefault();
      const d = UI.formData(e.target);
      const donnees = { contacts: [] };
      Object.keys(d).forEach(k => { if (!k.startsWith('c_')) donnees[k] = d[k]; });
      for (let i = 0; i < 3; i++) {
        const c = { nom: d['c_nom_' + i] || '', lien: d['c_lien_' + i] || '', tel: d['c_tel_' + i] || '' };
        if (c.nom || c.tel) donnees.contacts.push(c);
      }
      try {
        S.data.fiche = await App.write('saveFiche', { donnees });
        this.syncLocal();
        this.edition = false;
        UI.toast("Fiche d'urgence enregistrée");
        Sons.play('ok');
        this.render(el);
      } catch (err) { /* déjà signalé */ }
    };
  },

  pdf(snap) {
    const f = snap.fiche;
    const lignes = [
      ['Nom', [snap.user.prenom, snap.user.nom].filter(Boolean).join(' ')],
      ['Date de naissance', f.date_naissance ? `${UI.fmtD(f.date_naissance)} (${this.age(f.date_naissance)})` : ''],
      ['Groupe sanguin', f.groupe_sanguin], ['Poids / taille', [f.poids && f.poids + ' kg', f.taille && f.taille + ' cm'].filter(Boolean).join(' / ')],
      ['ALLERGIES', f.allergies || 'Aucune connue'], ['Pathologies', f.pathologies], ['Autres traitements', f.traitements_autres],
      ['Dispositifs', f.dispositifs], ...(f.contacts || []).map(c => ['Contact' + (c.lien ? ' (' + c.lien + ')' : ''), `${c.nom} - ${c.tel}`]),
      ['Médecin traitant', [f.medecin_nom, f.medecin_tel].filter(Boolean).join(' - ')], ['Assurance', f.assurance], ['Directives', f.directives], ['Informations', f.notes]
    ].filter(([, v]) => v);
    Export.pdf(`fiche-urgence_${Export.slug(UI.nomComplet(snap.user))}.pdf`, "Fiche d'urgence médicale", `Mise à jour : ${UI.fmtDT(f._maj || snap.maj)}`, [
      { titre: 'Informations vitales', headers: ['', ''], rows: lignes },
      { titre: 'Traitements en cours', headers: ['Médicament', 'Dosage', 'Posologie (M-Mi-S-N)'], rows: snap.traitements.map(t => [t.medicament, t.dosage, t.categorie === 'reserve' ? 'si besoin' : t.poso]) },
      ...((snap.antecedents || []).length ? [{ titre: 'Antécédents importants', headers: ['Période', 'Événement', 'Diagnostic'], rows: snap.antecedents.map(a => [a.periode, a.titre, a.diagnostic]) }] : []),
      { titre: 'QR code', qr: this.texte(snap) }
    ]);
  }
};
