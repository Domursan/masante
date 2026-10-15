/**
 * MA SANTÉ — Suivi des vaccins
 * Carnet regroupé par vaccin (statut du rappel), chronologie des injections,
 * export PDF. Les injections apparaissent aussi dans la frise de l'historique médical.
 */
const VACCINS_COURANTS = [
  'Diphtérie-Tétanos (dT)', 'Diphtérie-Tétanos-Coqueluche (dTpa)', 'Poliomyélite', 'Grippe saisonnière', 'COVID-19',
  'Hépatite A', 'Hépatite B', 'Hépatite A+B', 'Rougeole-Oreillons-Rubéole (ROR)', 'Varicelle', 'Zona',
  'Encéphalite à tiques (FSME)', 'Méningocoques', 'Pneumocoques', 'Papillomavirus (HPV)', 'Haemophilus influenzae b (Hib)',
  'Rotavirus', 'Fièvre jaune', 'Typhoïde', 'Rage', 'Encéphalite japonaise', 'Choléra', 'BCG (tuberculose)', 'VRS (virus respiratoire syncytial)'
];
const DOSES_COURANTES = ['1re dose', '2e dose', '3e dose', '4e dose', 'Rappel', 'Dose unique'];

Pages.vaccins = {
  vue: 'carnet',
  q: '',
  el: null,

  /* ---------- Données ---------- */
  cle(nom) {
    return String(nom || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  },

  alerteJours() { return Number(S.params.vaccin_alerte_jours || 30); },

  /** Statut d'un rappel à partir de sa date. */
  statut(rappel) {
    if (!rappel) return { k: 'aucun', cls: '', label: 'Pas de rappel prévu', ordre: 3 };
    const reste = UI.daysBetween(UI.today(), rappel);
    if (reste < 0) return { k: 'retard', cls: 'danger', label: `Rappel en retard (${UI.fmtD(rappel)})`, court: 'En retard', ordre: 0, reste };
    if (reste <= this.alerteJours()) return { k: 'bientot', cls: 'warn', label: reste === 0 ? "Rappel aujourd'hui" : `Rappel dans ${reste} j`, court: 'Rappel bientôt', ordre: 1, reste };
    return { k: 'ok', cls: 'ok', label: `À jour · rappel le ${UI.fmtD(rappel)}`, court: 'À jour', ordre: 2, reste };
  },

  /** Vaccins regroupés : injections triées (récente d'abord) + statut du rappel de la dernière injection. */
  groupes() {
    const g = {};
    S.data.vaccins.forEach(v => {
      const k = this.cle(v.vaccin);
      (g[k] = g[k] || { cle: k, injections: [] }).injections.push(v);
    });
    return Object.values(g).map(x => {
      x.injections.sort((a, b) => b.date.localeCompare(a.date) || (b.cree_le || '').localeCompare(a.cree_le || ''));
      x.derniere = x.injections[0];
      x.nom = x.derniere.vaccin;
      x.maladies = (x.injections.find(v => v.maladies) || {}).maladies || '';
      x.statut = this.statut(x.derniere.rappel_date);
      return x;
    }).sort((a, b) => a.statut.ordre - b.statut.ordre || (a.statut.reste ?? 1e9) - (b.statut.reste ?? 1e9) || a.nom.localeCompare(b.nom, 'fr'));
  },

  /** Rappels à prévoir (en retard ou bientôt) — utilisé par l'accueil. */
  aPrevoir() {
    return this.groupes().filter(g => g.statut.k === 'retard' || g.statut.k === 'bientot');
  },

  /* ---------- Page ---------- */
  render(el) {
    this.el = el;
    const gs = this.groupes();
    const n = k => gs.filter(g => g.statut.k === k).length;
    el.innerHTML = `
      <div class="page-head">
        <div><h1>Vaccins</h1><p class="muted">${S.data.vaccins.length} injection${S.data.vaccins.length > 1 ? 's' : ''} · ${gs.length} vaccin${gs.length > 1 ? 's' : ''}</p></div>
        <div class="btn-row">
          ${gs.length ? `<button class="btn" id="v-pdf">${UI.icon('download')}PDF</button>` : ''}
          <button class="btn primary w" id="v-add">${UI.icon('plus')}Ajouter une vaccination</button>
        </div>
      </div>
      ${gs.length ? `
        <div class="vac-resume">
          <div class="vac-stat danger"><b>${n('retard')}</b><span>${UI.icon('x')} En retard</span></div>
          <div class="vac-stat warn"><b>${n('bientot')}</b><span>${UI.icon('alert')} Rappel bientôt</span></div>
          <div class="vac-stat ok"><b>${n('ok')}</b><span>${UI.icon('check')} À jour</span></div>
          <div class="vac-stat"><b>${n('aucun')}</b><span>${UI.icon('clock')} Sans rappel prévu</span></div>
        </div>
        <div class="tabs" role="tablist">
          <button class="tab ${this.vue === 'carnet' ? 'active' : ''}" data-vue="carnet" role="tab">${UI.icon('syringe')}Carnet</button>
          <button class="tab ${this.vue === 'chrono' ? 'active' : ''}" data-vue="chrono" role="tab">${UI.icon('list')}Chronologie</button>
        </div>
        <div class="toolbar"><label class="search"><span class="sr-only">Rechercher</span>${UI.icon('search')}<input type="search" id="v-q" placeholder="Rechercher un vaccin, une maladie, un lot…" value="${UI.esc(this.q)}"></label></div>` : ''}
      <div id="v-body"></div>`;

    UI.$('#v-add', el).onclick = () => this.form(null);
    if (!gs.length) {
      UI.$('#v-body', el).innerHTML = `<div class="card">${UI.empty('Aucune vaccination enregistrée. Reporte ton carnet de vaccination pour suivre tes rappels (avec un email avant chaque échéance).', `<button class="btn primary w" data-add>${UI.icon('plus')}Ajouter une vaccination</button>`)}</div>`;
      const b = UI.$('[data-add]', el); if (b) b.onclick = () => this.form(null);
      return;
    }
    UI.$('#v-pdf', el).onclick = () => this.pdf();
    UI.$$('[data-vue]', el).forEach(b => b.onclick = () => {
      this.vue = b.dataset.vue;
      UI.$$('[data-vue]', el).forEach(x => x.classList.toggle('active', x === b));
      this.corps();
    });
    UI.$('#v-q', el).oninput = e => { this.q = e.target.value; this.corps(); };
    this.corps();
  },

  corps() {
    const box = this.el && UI.$('#v-body', this.el);
    if (!box) return;
    const q = this.cle(this.q);
    const ok = v => !q || this.cle([v.vaccin, v.maladies, v.produit, v.lot, v.praticien, v.lieu, v.notes, v.dose].join(' ')).includes(q);
    if (this.vue === 'carnet') {
      const gs = this.groupes().filter(g => g.injections.some(ok));
      box.innerHTML = gs.length ? `<div class="vac-grid">${gs.map(g => this.carte(g)).join('')}</div>` : `<div class="card">${UI.empty('Aucun résultat.')}</div>`;
    } else {
      const list = S.data.vaccins.filter(ok).sort((a, b) => b.date.localeCompare(a.date));
      box.innerHTML = list.length ? `<div class="card"><div class="table-wrap"><table class="table resp">
        <thead><tr><th>Date</th><th>Vaccin</th><th>Dose</th><th>Produit / lot</th><th>Praticien / lieu</th><th>Rappel</th></tr></thead>
        <tbody>${list.map(v => `<tr class="row-click" data-id="${v.id}">
          <td data-label="Date"><b>${UI.esc(UI.fmtD(v.date))}</b></td>
          <td data-label="Vaccin" class="cell-title">💉 <b>${UI.esc(v.vaccin)}</b></td>
          <td data-label="Dose">${UI.esc(v.dose || '—')}</td>
          <td data-label="Produit / lot">${UI.esc([v.produit, v.lot && 'lot ' + v.lot].filter(Boolean).join(' · ') || '—')}</td>
          <td data-label="Praticien / lieu">${UI.esc([v.praticien, v.lieu].filter(Boolean).join(' · ') || '—')}</td>
          <td data-label="Rappel">${v.rappel_date ? UI.esc(UI.fmtD(v.rappel_date)) : '—'}</td></tr>`).join('')}</tbody></table></div></div>`
        : `<div class="card">${UI.empty('Aucun résultat.')}</div>`;
    }
    box.onclick = e => {
      const add = e.target.closest('[data-dose]');
      if (add) { e.stopPropagation(); return this.form(null, this.groupes().find(g => g.cle === add.dataset.dose)); }
      const r = e.target.closest('[data-id]');
      if (r) this.detail(S.data.vaccins.find(v => v.id === r.dataset.id));
    };
  },

  carte(g) {
    const st = g.statut;
    return `<section class="card vac-carte ${st.k}">
      <div class="vac-tete">
        <span class="vac-ico" aria-hidden="true">💉</span>
        <div class="vac-titre"><h3>${UI.esc(g.nom)}</h3>${g.maladies ? `<span class="muted small">Protège contre : ${UI.esc(g.maladies)}</span>` : ''}</div>
      </div>
      <div class="vac-etat">${UI.badge(st.cls, st.label)}</div>
      <ol class="vac-doses">${g.injections.map((v, i) => `<li><button type="button" class="vac-dose ${i === 0 ? 'derniere' : ''}" data-id="${v.id}">
        <span class="mono">${UI.esc(UI.fmtD(v.date))}</span>
        <span>${UI.esc(v.dose || 'Injection')}${v.produit ? ` · <span class="muted">${UI.esc(v.produit)}</span>` : ''}</span>
        ${v.photo ? UI.icon('image') : ''}
      </button></li>`).join('')}</ol>
      <div class="btn-row w"><button type="button" class="btn sm" data-dose="${UI.esc(g.cle)}">${UI.icon('plus')}Nouvelle dose</button></div>
    </section>`;
  },

  /* ---------- Détail ---------- */
  detail(v) {
    if (!v) return;
    const champ = (l, val) => val ? `<div class="histo-champ"><span>${l}</span><p>${UI.esc(val)}</p></div>` : '';
    const g = this.groupes().find(x => x.cle === this.cle(v.vaccin));
    const derniere = g && g.derniere.id === v.id;
    const st = this.statut(v.rappel_date);
    const actions = [{ label: 'Fermer', cls: 'ghost' }];
    if (!S.ro) {
      actions.push({ label: UI.icon('trash') + 'Supprimer', cls: 'ghost', onClick: async () => {
        if (!(await UI.confirm(`Supprimer l'injection « ${v.vaccin} » du ${UI.fmtD(v.date)} ?`, { danger: true, ok: 'Supprimer' }))) return false;
        await App.write('deleteVaccin', { id: v.id });
        Store.remove('vaccins', v.id);
        UI.toast('Injection supprimée');
        this.render(this.el);
      } });
      actions.push({ label: UI.icon('edit') + 'Modifier', cls: 'primary', onClick: () => { setTimeout(() => this.form(v), 30); } });
    }
    const m = UI.modal({
      title: `💉 ${UI.esc(v.vaccin)}`,
      wide: true,
      body: `<div class="histo-entete">
          <span class="badge p">${UI.esc(v.dose || 'Injection')}</span>
          ${v.rappel_date ? (derniere ? UI.badge(st.cls, st.label) : `<span class="badge">Rappel prévu le ${UI.esc(UI.fmtD(v.rappel_date))} (remplacé par une dose plus récente)</span>`) : ''}
          <p class="histo-periode">${UI.icon('clock')} Injection du <b>${UI.esc(UI.fmtD(v.date))}</b></p>
        </div>
        ${champ('Protège contre', v.maladies)}
        ${champ('Nom commercial', v.produit)}
        ${champ('Numéro de lot', v.lot)}
        ${champ('Praticien', v.praticien)}
        ${champ('Lieu', v.lieu)}
        ${champ('Remarques', v.notes)}
        ${v.photo ? `<div class="histo-champ"><span>Document</span><img class="thumb doc" data-zoom="${UI.esc(v.photo)}" alt="Certificat ou carnet" hidden></div>` : ''}`,
      actions
    });
    const img = UI.$('img[data-zoom]', m.body);
    if (img) { Photos.fill(img, v.photo); img.onclick = () => Photos.lightbox(v.photo); }
  },

  /* ---------- Formulaire ---------- */
  /** v = injection à modifier ; groupe = vaccin pour lequel on ajoute une dose. */
  form(v, groupe = null) {
    const nouveau = !v;
    const base = groupe ? groupe.derniere : null;
    v = v || {
      vaccin: base ? base.vaccin : '', maladies: base ? base.maladies : '', produit: base ? base.produit : '',
      praticien: base ? base.praticien : '', lieu: base ? base.lieu : '', date: UI.today(), dose: base ? 'Rappel' : ''
    };
    const noms = [...new Set(S.data.vaccins.map(x => x.vaccin).concat(VACCINS_COURANTS))];
    const m = UI.modal({
      title: nouveau ? (groupe ? 'Nouvelle dose' : 'Nouvelle vaccination') : "Modifier l'injection",
      wide: true,
      body: `<form class="form" id="f-vac" novalidate>
        <div class="grid2">
          <label>Vaccin *<input name="vaccin" list="dl-vaccins" required value="${UI.esc(v.vaccin || '')}" placeholder="Choisis ou tape un nom" autocomplete="off"></label>
          <label>Protège contre<input name="maladies" value="${UI.esc(v.maladies || '')}" placeholder="ex. tétanos, diphtérie, coqueluche"></label>
          <label>Date d'injection *<input type="date" name="date" required value="${UI.esc(v.date || '')}" max="${UI.today()}"></label>
          <label>Dose<input name="dose" list="dl-doses" value="${UI.esc(v.dose || '')}" placeholder="ex. 1re dose, rappel…" autocomplete="off"></label>
          <label>Nom commercial<input name="produit" value="${UI.esc(v.produit || '')}" placeholder="Nom sur le carnet"></label>
          <label>Numéro de lot<input name="lot" value="${UI.esc(v.lot || '')}"></label>
          <label>Praticien<input name="praticien" value="${UI.esc(v.praticien || '')}" placeholder="Dr …, pharmacie…"></label>
          <label>Lieu<input name="lieu" value="${UI.esc(v.lieu || '')}"></label>
        </div>
        <datalist id="dl-vaccins">${noms.map(x => `<option value="${UI.esc(x)}">`).join('')}</datalist>
        <datalist id="dl-doses">${DOSES_COURANTES.map(x => `<option value="${x}">`).join('')}</datalist>
        <fieldset><legend>Prochain rappel</legend>
          <label>Date du prochain rappel<input type="date" name="rappel_date" value="${UI.esc(v.rappel_date || '')}"></label>
          <div class="chips"><span class="muted small" style="align-self:center">Calculer depuis l'injection :</span>
            ${[[1, '+1 an'], [2, '+2 ans'], [5, '+5 ans'], [10, '+10 ans'], [20, '+20 ans']].map(([n, l]) => `<button type="button" class="chip" data-ans="${n}">${l}</button>`).join('')}
            <button type="button" class="chip" data-ans="0">Aucun rappel</button></div>
          <p class="hint" id="v-calc"></p>
          <p class="hint">Indique l'intervalle recommandé par ton médecin ou le plan de vaccination. Un email te préviendra ${this.alerteJours()} jours avant.</p>
        </fieldset>
        <label>Remarques<textarea name="notes" rows="2" placeholder="Réactions, contre-indications, voyage…">${UI.esc(v.notes || '')}</textarea></label>
        <div><label>Document (carnet, certificat…)</label><div id="pf-vac" style="margin-top:6px"></div></div>
      </form>`,
      actions: [
        { label: 'Annuler', cls: 'ghost' },
        { label: nouveau ? 'Ajouter' : 'Enregistrer', cls: 'primary', onClick: async () => {
          const f = UI.$('#f-vac', m.body);
          const d = UI.formData(f);
          if (!d.vaccin) { UI.toast('Indique le nom du vaccin', 'warn'); return false; }
          if (!d.date) { UI.toast("Indique la date d'injection", 'warn'); return false; }
          if (d.date > UI.today()) { UI.toast("La date d'injection ne peut pas être dans le futur", 'warn'); return false; }
          if (d.rappel_date && d.rappel_date <= d.date) { UI.toast("Le rappel doit être après l'injection", 'warn'); return false; }
          d.photo = await photo.value();
          if (v.id) d.id = v.id;
          const r = await App.write('saveVaccin', d);
          Store.upsert('vaccins', r);
          UI.toast(nouveau ? 'Vaccination ajoutée' : 'Injection mise à jour');
          Sons.play('ok');
          this.render(this.el);
        } }
      ]
    });
    const f = UI.$('#f-vac', m.body);
    const photo = Photos.field(UI.$('#pf-vac', m.body), v.photo || '', { nom: 'vaccin_' + (v.vaccin || 'nouveau') });
    const maj = () => {
      const r = f.rappel_date.value;
      const st = this.statut(r);
      UI.$('#v-calc', f).innerHTML = !r ? 'Aucun rappel prévu.'
        : (f.date.value && r <= f.date.value) ? '<span class="form-error">Le rappel doit être après l\'injection.</span>'
        : `Rappel le <b>${UI.esc(UI.fmtLong(r))} ${UI.esc(r.slice(0, 4))}</b> ${UI.badge(st.cls, st.court || st.label)}`;
    };
    UI.$$('[data-ans]', f).forEach(b => b.onclick = () => {
      const n = Number(b.dataset.ans);
      if (!n) { f.rappel_date.value = ''; return maj(); }
      if (!f.date.value) { UI.toast("Indique d'abord la date d'injection", 'warn'); return; }
      const d = UI.parse(f.date.value);
      d.setFullYear(d.getFullYear() + n);
      f.rappel_date.value = UI.isoDate(d);
      maj();
    });
    f.addEventListener('input', maj);
    f.addEventListener('change', maj);
    maj();
  },

  /* ---------- PDF ---------- */
  lignesPdf() {
    return this.groupes().map(g => [
      g.nom + (g.maladies ? `\n(${g.maladies})` : ''),
      g.injections.slice().reverse().map(v => `${UI.fmtD(v.date)} - ${v.dose || 'injection'}${v.produit ? ' (' + v.produit + ')' : ''}${v.lot ? ' lot ' + v.lot : ''}`).join('\n'),
      g.derniere.rappel_date ? UI.fmtD(g.derniere.rappel_date) : '-',
      g.statut.court || 'Pas de rappel prévu'
    ]);
  },

  pdf() {
    const nom = UI.nomComplet(S.viewing);
    Export.pdf(`carnet-vaccination_${Export.slug(nom)}_${UI.today()}.pdf`, 'Carnet de vaccination',
      `${nom} · ${S.data.vaccins.length} injection(s) · exporté le ${UI.fmtDT(UI.nowDT())}`, [{
        titre: 'Vaccinations', headers: ['Vaccin', 'Injections', 'Prochain rappel', 'Statut'], rows: this.lignesPdf(),
        colStyles: { 0: { cellWidth: 52 }, 2: { cellWidth: 26 }, 3: { cellWidth: 26 } }
      }]);
  }
};
