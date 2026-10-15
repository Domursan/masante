/**
 * MA SANTÉ — Rapport complet pour le médecin (PDF)
 * Période au choix, sections à cocher : résumé d'urgence, traitements, observance,
 * signes vitaux (statistiques + graphiques + détail), schéma de correction, notes.
 */
Pages.rapport = {
  du: null,
  au: null,
  sections: { fiche: true, traitements: true, observance: true, signes: true, detail: false, schema: true, historique: true, notes: false },
  LIMITE_JOURS: 180,

  /* ---------- Calculs ---------- */
  /** Observance par médicament (prises prévues vs validées) entre deux dates incluses. */
  observance(du, au) {
    const fin = au < UI.today() ? au : UI.today();
    const M = Pages.medicaments;
    const parOrdo = S.data.ordonnances
      .filter(o => o.categorie !== 'reserve' && M.hasPoso(o))
      .filter(o => o.actif === 'oui' || S.data.prises.some(p => p.ordonnance_id === o.id && p.date >= du && p.date <= fin))
      .map(o => {
        let attendu = 0, pris = 0, saute = 0;
        const debut = o.date_ordonnance && o.date_ordonnance.slice(0, 10) > du ? o.date_ordonnance.slice(0, 10) : du;
        for (let d = debut; d <= fin; d = UI.addDays(d, 1)) {
          MOMENTS.forEach(([m]) => {
            if (!M.qty(o[m])) return;
            attendu++;
            const p = M.prise(o.id, d, m);
            if (p && p.statut === 'pris') pris++;
            else if (p && p.statut === 'saute') saute++;
          });
        }
        return { o, attendu, pris, saute, oubli: attendu - pris - saute, pct: attendu ? Math.round(pris / attendu * 100) : null };
      })
      .filter(x => x.attendu > 0);
    const reserve = S.data.ordonnances.filter(o => o.categorie === 'reserve' || !M.hasPoso(o)).map(o => {
      const doses = S.data.prises.filter(p => p.ordonnance_id === o.id && p.moment === 'reserve' && p.date >= du && p.date <= fin);
      const jours = new Set(doses.map(p => p.date)).size;
      return { o, doses: doses.length, jours };
    }).filter(x => x.doses > 0);
    const tA = parOrdo.reduce((a, x) => a + x.attendu, 0), tP = parOrdo.reduce((a, x) => a + x.pris, 0);
    return { parOrdo, reserve, total: tA ? Math.round(tP / tA * 100) : null, attendu: tA, pris: tP };
  },

  signes(du, au) {
    return S.data.signes.filter(s => s.date_heure.slice(0, 10) >= du && s.date_heure.slice(0, 10) <= au);
  },

  /* ---------- Page ---------- */
  render(el) {
    this.au = this.au || UI.today();
    this.du = this.du || UI.addDays(this.au, -29);
    const limite = UI.addDays(UI.today(), -this.LIMITE_JOURS);
    const obs = this.observance(this.du, this.au);
    const sv = this.signes(this.du, this.au);
    const nbJours = UI.daysBetween(this.du, this.au) + 1;
    const presets = [[7, '7 jours'], [30, '30 jours'], [90, '3 mois'], [180, '6 mois']];
    const SECTIONS = [
      ['fiche', "Résumé de la fiche d'urgence", 'allergies, pathologies, contacts'],
      ['traitements', 'Traitements en cours', 'ordonnances actives, posologie, validité, stock'],
      ['observance', 'Observance', 'prises validées / prévues par médicament, doses de réserve'],
      ['signes', 'Signes vitaux', 'statistiques et graphiques par signe'],
      ['detail', 'Détail des mesures', 'tableau de toutes les valeurs de la période'],
      ['schema', 'Schéma de correction', "paliers d'insuline et corrections indiquées"],
      ['historique', 'Historique médical', 'frise chronologique et liste des événements (toute la vie)'],
      ['notes', 'Notes épinglées', '']
    ];

    el.innerHTML = `
      <div class="page-head"><div><h1>Rapport pour le médecin</h1><p class="muted">Un PDF complet à imprimer ou à envoyer avant un rendez-vous.</p></div></div>
      <div class="settings-grid">
        <section class="card">
          <div class="card-head"><h2>${UI.icon('clock')} Période</h2></div>
          <div class="chips" style="margin-bottom:12px">${presets.map(([n, l]) => `<button class="chip ${this.au === UI.today() && nbJours === n ? 'active' : ''}" data-preset="${n}">${l}</button>`).join('')}</div>
          <div class="grid2">
            <label>Du<input type="date" id="r-du" value="${this.du}" min="${limite}" max="${this.au}"></label>
            <label>Au<input type="date" id="r-au" value="${this.au}" min="${this.du}" max="${UI.today()}"></label>
          </div>
          <p class="hint" style="margin-top:8px">L'observance est disponible sur les ${this.LIMITE_JOURS} derniers jours.</p>

          <h3 style="margin:18px 0 8px">Contenu du rapport</h3>
          <div class="stack" style="gap:10px">${SECTIONS.map(([k, l, d]) => `<label class="switch"><span>${l}${d ? `<small>${d}</small>` : ''}</span><input type="checkbox" data-sec="${k}" ${this.sections[k] ? 'checked' : ''}><span class="track"></span></label>`).join('')}</div>
          <div class="btn-row" style="margin-top:18px"><button class="btn primary" id="r-pdf">${UI.icon('download')}Générer le PDF</button></div>
        </section>

        <section class="card">
          <div class="card-head"><h2>${UI.icon('chart')} Aperçu de la période</h2><span class="muted small">${nbJours} jour${nbJours > 1 ? 's' : ''}</span></div>
          <div class="vitals" style="margin-bottom:14px">
            <div class="vital"><small>Observance globale</small><b>${obs.total == null ? '—' : obs.total + ' %'}</b><time>${obs.pris} / ${obs.attendu} prises</time></div>
            <div class="vital"><small>Mesures</small><b>${sv.length}</b><time>signes vitaux</time></div>
            <div class="vital"><small>Doses de réserve</small><b>${obs.reserve.reduce((a, x) => a + x.doses, 0)}</b><time>sur la période</time></div>
          </div>
          <div class="mini-list">${obs.parOrdo.length ? obs.parOrdo.map(x => `<div class="mini-item"><div class="lbl"><b>${UI.esc(x.o.medicament)}</b><span class="muted small">${x.pris} pris · ${x.saute} non pris · ${x.oubli} non renseigné${x.oubli > 1 ? 's' : ''}</span></div>${UI.badge(x.pct >= 90 ? 'ok' : x.pct >= 70 ? 'warn' : 'danger', x.pct + ' %')}</div>`).join('') : '<p class="muted">Aucune prise prévue sur la période.</p>'}</div>
        </section>
      </div>`;

    const go = () => this.render(el);
    UI.$$('[data-preset]', el).forEach(b => b.onclick = () => { this.au = UI.today(); this.du = UI.addDays(this.au, -(Number(b.dataset.preset) - 1)); go(); });
    UI.$('#r-du', el).onchange = e => { if (e.target.value) { this.du = e.target.value < limite ? limite : e.target.value; if (this.du > this.au) this.au = this.du; go(); } };
    UI.$('#r-au', el).onchange = e => { if (e.target.value) { this.au = e.target.value > UI.today() ? UI.today() : e.target.value; if (this.au < this.du) this.du = this.au; go(); } };
    UI.$$('[data-sec]', el).forEach(c => c.onchange = () => { this.sections[c.dataset.sec] = c.checked; });
    UI.$('#r-pdf', el).onclick = () => {
      if (!Object.values(this.sections).some(Boolean)) { UI.toast('Choisis au moins une section', 'warn'); return; }
      UI.loader(true);
      setTimeout(() => { try { this.pdf(); } catch (e) { console.error(e); UI.toast('Erreur lors de la création du PDF', 'error'); } finally { UI.loader(false); } }, 30);
    };
  },

  /* ---------- PDF ---------- */
  pdf() {
    const du = this.du, au = this.au, sec = this.sections;
    const u = S.viewing, f = S.data.fiche || {};
    const sections = [];
    const P = Pages.signes, U = Pages.urgence;

    if (sec.fiche) {
      const l = [
        ['Date de naissance', f.date_naissance ? `${UI.fmtD(f.date_naissance)} (${U.age(f.date_naissance)})` : ''],
        ['Groupe sanguin', f.groupe_sanguin], ['Poids / taille', [f.poids && f.poids + ' kg', f.taille && f.taille + ' cm'].filter(Boolean).join(' / ')],
        ['Allergies', f.allergies || 'Aucune connue'], ['Pathologies / antécédents', f.pathologies], ['Autres traitements', f.traitements_autres],
        ['Dispositifs médicaux', f.dispositifs], ['Médecin traitant', [f.medecin_nom, f.medecin_tel].filter(Boolean).join(' - ')],
        ...(f.contacts || []).map(c => ['Contact' + (c.lien ? ' (' + c.lien + ')' : ''), `${c.nom} - ${c.tel}`])
      ].filter(([, v]) => v);
      sections.push({ titre: 'Informations générales', headers: null, rows: l, colStyles: { 0: { fontStyle: 'bold', cellWidth: 48 } } });
    }

    if (sec.traitements) {
      const ordos = S.data.ordonnances.filter(o => o.actif === 'oui').sort((a, b) => a.medicament.localeCompare(b.medicament, 'fr'));
      sections.push({
        titre: 'Traitements en cours',
        headers: ['Médicament', 'Dosage', 'Catégorie', 'Posologie (M-Mi-S-N)', 'Ordonnance du', 'Validité', 'Stock'],
        rows: ordos.map(o => {
          const st = UI.statut(o), si = UI.stockInfo(o);
          return [o.medicament, o.dosage || '', CATEGORIES[o.categorie] || 'Constant', o.categorie === 'reserve' ? (o.dose_reserve ? 'si besoin, ' + o.dose_reserve + '/dose' : 'si besoin') : Pages.ordonnances.posologie(o),
            UI.fmtD(o.date_ordonnance), st.fin ? `${UI.fmtD(st.fin)} (${st.label})` : st.label, si ? si.label.replace('Stock : ', '') : '-'];
        })
      });
    }

    if (sec.observance) {
      const obs = this.observance(du, au);
      sections.push({
        titre: `Observance${obs.total != null ? ' - ' + obs.total + ' % des prises validées (' + obs.pris + '/' + obs.attendu + ')' : ''}`,
        headers: ['Médicament', 'Prévues', 'Prises', 'Non prises', 'Non renseignées', 'Observance'],
        rows: obs.parOrdo.map(x => [x.o.medicament + (x.o.dosage ? ' ' + x.o.dosage : ''), x.attendu, x.pris, x.saute, x.oubli, x.pct + ' %'])
      });
      if (obs.reserve.length) sections.push({
        titre: 'Médicaments de réserve (si besoin)',
        headers: ['Médicament', 'Doses prises', 'Jours concernés'],
        rows: obs.reserve.map(x => [x.o.medicament + (x.o.dosage ? ' ' + x.o.dosage : ''), x.doses, x.jours])
      });
    }

    const sv = this.signes(du, au);
    if (sec.signes || sec.detail) {
      const types = Object.keys(SIGNES).filter(k => sv.some(s => s.type === k));
      if (!types.length) sections.push({ titre: 'Signes vitaux', texte: 'Aucune mesure sur la période.' });
      types.forEach(k => {
        const l = P.tri(sv.filter(s => s.type === k));
        const st = P.stats(l), st2 = k === 'tension' ? P.stats(l, 'valeur2') : null;
        const fmt = c => st2 ? `${st[c]}/${st2[c]}` : st[c];
        const s = { titre: `${SIGNES[k].label} (${P.unite(k)}) - ${st.n} mesure${st.n > 1 ? 's' : ''} · moy. ${fmt('moy')} · min ${fmt('min')} · max ${fmt('max')}` };
        if (sec.signes) s.image = P.imagePdf(P.configType(k, l, true));
        if (sec.detail) {
          s.headers = k === 'tension' ? ['Date', 'Heure', 'Systolique', 'Diastolique', 'Note'] : ['Date', 'Heure', 'Valeur', 'Note'];
          s.rows = l.slice().reverse().map(m => k === 'tension'
            ? [UI.fmtD(m.date_heure), UI.fmtT(m.date_heure), m.valeur, m.valeur2, m.note || '']
            : [UI.fmtD(m.date_heure), UI.fmtT(m.date_heure), String(m.valeur).replace('.', ','), m.note || '']);
        }
        sections.push(s);
      });
    }

    if (sec.schema && S.data.schema.length) {
      const ug = P.unite('glycemie');
      const glys = sv.filter(s => s.type === 'glycemie');
      const corr = glys.map(g => P.correction(g.valeur)).filter(c => c && UI.num(c.unites) > 0);
      sections.push({
        titre: `Schéma de correction d'insuline${glys.length ? ` - ${corr.length} correction${corr.length > 1 ? 's' : ''} indiquée${corr.length > 1 ? 's' : ''} sur ${glys.length} glycémie${glys.length > 1 ? 's' : ''}` : ''}`,
        headers: [`Glycémie de (${ug})`, `jusqu'à (${ug}, exclu)`, 'Unités', 'Message'],
        rows: S.data.schema.slice().sort((a, b) => UI.num(a.glycemie_min || -1e9) - UI.num(b.glycemie_min || -1e9))
          .map(l => [l.glycemie_min || '-', l.glycemie_max || '-', l.unites || '0', l.message || ''])
      });
    }

    if (sec.historique && Pages.historique && S.data.historique.length) {
      const H = Pages.historique, liste = S.data.historique;
      const img = H.image(liste);
      sections.push({ titre: 'Historique médical', image: img && img.url, imageRatio: img && img.ratio });
      sections.push({ titre: 'Antécédents (* = important)', headers: ['Période', 'Type', 'Événement', 'Diagnostic', 'Traitements'], rows: H.lignesPdf(liste),
        colStyles: { 0: { cellWidth: 34 }, 1: { cellWidth: 26 } } });
    }

    if (sec.notes) {
      const notes = S.data.notes.filter(n => n.epinglee === 'oui');
      if (notes.length) notes.forEach(n => sections.push({ titre: 'Note : ' + (n.titre || 'Sans titre'), texte: n.contenu || '' }));
    }

    Export.pdf(`rapport_${Export.slug(UI.nomComplet(u))}_${du}_${au}.pdf`, `Rapport de suivi - ${UI.nomComplet(u)}`,
      `Période du ${UI.fmtD(du)} au ${UI.fmtD(au)} · généré le ${UI.fmtDT(UI.nowDT())}`, sections);
  }
};
