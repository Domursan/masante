/**
 * MA SANTÉ — Médicaments du jour (générés depuis les ordonnances actives)
 * Catégories : constant (par moment), réserve (dose à la demande), autre.
 */
const MOMENTS = [
  ['matin', 'Matin', '🌅'],
  ['midi', 'Midi', '☀️'],
  ['soir', 'Soir', '🌆'],
  ['nuit', 'Nuit', '🌙']
];
const CATEGORIES = { constant: 'Constant', reserve: 'Réserve', autre: 'Autre' };

Pages.medicaments = {
  date: null,

  qty(v) { v = String(v ?? '').trim(); return v && v !== '0' ? v : ''; },
  hasPoso(o) { return MOMENTS.some(([m]) => this.qty(o[m])); },

  actives(date) {
    return S.data.ordonnances.filter(o => o.actif === 'oui' && (!o.date_ordonnance || o.date_ordonnance.slice(0, 10) <= date));
  },

  prise(oid, date, m) {
    return S.data.prises.find(p => p.ordonnance_id === oid && p.date === date && p.moment === m);
  },

  /** Prises prévues (hors réserve) pour une date. */
  dueFor(date) {
    const out = [];
    this.actives(date).filter(o => o.categorie !== 'reserve').forEach(o => {
      MOMENTS.forEach(([m]) => {
        const q = this.qty(o[m]);
        if (q) out.push({ o, moment: m, q, prise: this.prise(o.id, date, m) });
      });
    });
    return out;
  },

  /** Met à jour la prise et l'ordonnance renvoyée (stock recalculé côté serveur). */
  appliquer(r) {
    if (r.prise) Store.upsert('prises', r.prise);
    if (r.ordonnance) Store.upsert('ordonnances', r.ordonnance);
  },

  async marquer(oid, date, moment, statut) {
    const ex = this.prise(oid, date, moment);
    if (ex && ex.statut === statut) {
      const r = await App.write('deletePrise', { id: ex.id }).catch(() => null);
      if (!r) return false;
      Store.remove('prises', ex.id);
      this.appliquer(r);
      return 'annule';
    }
    const r = await App.write('savePrise', {
      id: ex ? ex.id : '', ordonnance_id: oid, date, moment, statut,
      heure: date === UI.today() ? UI.nowTime() : ''
    }).catch(() => null);
    if (!r) return false;
    this.appliquer(r);
    if (statut === 'pris') { Sons.play('ok'); this.alerteStock(oid); }
    return statut;
  },

  /** Prévient quand une prise fait passer le stock sous le seuil. */
  alerteStock(oid) {
    const o = S.data.ordonnances.find(x => x.id === oid);
    const i = o && UI.stockInfo(o);
    if (i && i.bas) UI.toast(`${o.medicament} : ${i.vide ? 'stock épuisé' : i.label.replace('Stock : ', 'il reste ')} — pense à racheter`, 'warn');
  },

  /** Modale : ajouter une boîte ou corriger le stock. */
  stockModal(o, apres) {
    const i = UI.stockInfo(o);
    UI.modal({
      title: 'Stock — ' + UI.esc(o.medicament),
      body: `<form class="form">
        <p>${i ? UI.badge(i.cls, i.label) + (i.parJour ? ` <span class="muted small">consommation : ${String(i.parJourQte).replace('.', ',')} / jour${i.fin ? ' · épuisé vers le ' + UI.esc(UI.fmtD(i.fin)) : ''}</span>` : '') : '<span class="muted">Le stock de ce médicament n\'est pas encore suivi.</span>'}</p>
        <label>Ajouter (ex. une nouvelle boîte)<input name="delta" inputmode="decimal" placeholder="ex. 30"></label>
        <div class="chips">${[10, 14, 20, 28, 30, 60, 90, 100].map(n => `<button type="button" class="chip" data-q="${n}">+${n}</button>`).join('')}</div>
        <label>…ou corriger le stock actuel à<input name="stock" inputmode="decimal" placeholder="${i ? String(i.stock).replace('.', ',') : 'ex. 24'}"></label>
      </form>`,
      actions: [
        { label: 'Annuler', cls: 'ghost' },
        { label: 'Enregistrer', cls: 'primary', onClick: async m => {
          const d = UI.formData(UI.$('form', m.body));
          if (!d.delta && !d.stock) { UI.toast('Indique une quantité', 'warn'); return false; }
          const r = await App.write('ajusterStock', { id: o.id, delta: d.delta.replace(',', '.'), stock: d.stock.replace(',', '.') });
          Store.upsert('ordonnances', r);
          UI.toast('Stock mis à jour');
          Sons.play('ok');
          apres && apres();
        } }
      ]
    }).body.addEventListener('click', e => {
      const c = e.target.closest('[data-q]');
      if (c) { const f = e.currentTarget.querySelector('[name=delta]'); f.value = String((UI.num(f.value) || 0) + Number(c.dataset.q)); }
    });
  },

  itemHtml(o, m, q, date) {
    const p = this.prise(o.id, date, m);
    const pris = p && p.statut === 'pris', saute = p && p.statut === 'saute';
    const st = UI.statut(o);
    return `<div class="med-item ${pris ? 'pris' : ''} ${saute ? 'saute' : ''}">
      <div class="med-info">
        <strong>${UI.esc(o.medicament)}</strong>
        <span class="muted">${UI.esc([o.dosage, 'dose : ' + q].filter(Boolean).join(' · '))}</span>
        ${saute ? UI.badge('warn', 'Non pris') : ''}
        ${st.k === 'expiree' ? UI.badge('danger', 'Ordonnance expirée') : ''}
        ${this.stockBtn(o)}
      </div>
      <div class="med-actions">
        <button class="btn-check ${pris ? 'on' : ''}" data-act="pris" data-o="${o.id}" data-m="${m}" aria-pressed="${pris}" title="${pris ? 'Annuler' : 'Marquer comme pris'}">
          ${UI.icon('check')}<span>${pris ? 'Pris' + (p.heure ? ' ' + UI.esc(p.heure) : '') : 'Pris'}</span>
        </button>
        <button class="btn-skip ${saute ? 'on' : ''}" data-act="saute" data-o="${o.id}" data-m="${m}" aria-pressed="${saute}" title="Non pris / sauté">${UI.icon('x')}</button>
      </div>
    </div>`;
  },

  stockBtn(o) {
    const i = UI.stockInfo(o);
    if (!i) return '';
    return `<button type="button" class="badge ${i.cls} badge-btn" data-act="stock" data-o="${o.id}" title="Gérer le stock">${UI.icon(i.cls === 'ok' ? 'check' : 'alert')}${UI.esc(i.label)}</button>`;
  },

  sectionMoments(titre, emoji, list, date) {
    const avec = list.filter(o => this.hasPoso(o));
    if (!avec.length) return '';
    const blocs = MOMENTS.map(([m, label, e]) => {
      const items = avec.filter(o => this.qty(o[m]));
      if (!items.length) return '';
      const faits = items.filter(o => { const p = this.prise(o.id, date, m); return p && p.statut === 'pris'; }).length;
      return `<div class="moment">
        <h3>${e} ${label} ${UI.badge(faits === items.length ? 'ok' : '', `${faits}/${items.length}`)}</h3>
        ${items.map(o => this.itemHtml(o, m, this.qty(o[m]), date)).join('')}
      </div>`;
    }).join('');
    return `<h2 class="section-title">${emoji} ${titre}</h2><div class="moments">${blocs}</div>`;
  },

  sectionReserve(titre, emoji, list, date) {
    if (!list.length) return '';
    const items = list.map(o => {
      const doses = S.data.prises.filter(p => p.ordonnance_id === o.id && p.date === date && p.moment === 'reserve')
        .sort((a, b) => (a.heure || '').localeCompare(b.heure || ''));
      return `<div class="med-item">
        <div class="med-info">
          <strong>${UI.esc(o.medicament)}</strong>
          <span class="muted">${UI.esc([o.dosage, o.dose_reserve ? 'dose : ' + o.dose_reserve : '', o.remarque].filter(Boolean).join(' · ')) || 'Si besoin'}</span>
          ${this.stockBtn(o)}
          <div class="doses">${doses.length ? doses.map(d =>
            `<span class="dose">${UI.icon('check')}${UI.esc(d.heure || '—')}<button class="w" data-act="deldose" data-id="${d.id}" aria-label="Supprimer cette dose">${UI.icon('x')}</button></span>`
          ).join('') : '<span class="muted small">Aucune dose ce jour</span>'}</div>
        </div>
        <div class="med-actions w"><button class="btn primary sm" data-act="dose" data-o="${o.id}">${UI.icon('plus')}Dose</button></div>
      </div>`;
    }).join('');
    return `<h2 class="section-title">${emoji} ${titre}</h2><div class="moment">${items}</div>`;
  },

  render(el) {
    const d = this.date = this.date || UI.today();
    const isToday = d === UI.today();
    const act = this.actives(d);
    const constant = act.filter(o => !o.categorie || o.categorie === 'constant');
    const reserve = act.filter(o => o.categorie === 'reserve');
    const autre = act.filter(o => o.categorie === 'autre');
    const due = this.dueFor(d);
    const done = due.filter(x => x.prise && x.prise.statut === 'pris').length;
    const pct = due.length ? Math.round((done / due.length) * 100) : 0;

    el.innerHTML = `
      <div class="page-head">
        <div><h1>Médicaments</h1><p class="muted">${UI.esc(UI.fmtLong(d))}${isToday ? " · aujourd'hui" : ''}</p></div>
        <div class="date-nav">
          <button class="icon-btn" data-d="-1" aria-label="Jour précédent">${UI.icon('left')}</button>
          <input type="date" id="med-date" value="${d}" aria-label="Date">
          <button class="icon-btn" data-d="1" aria-label="Jour suivant">${UI.icon('right')}</button>
          ${isToday ? '' : '<button class="btn sm" data-d="0">Aujourd\'hui</button>'}
        </div>
      </div>
      ${due.length ? `<div class="card"><div class="card-head" style="margin:0"><h3>${done === due.length ? '🎉 Toutes les prises sont faites' : `${done} prise${done > 1 ? 's' : ''} sur ${due.length}`}</h3><b>${pct} %</b></div>
        <div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div></div>` : ''}
      ${this.sectionMoments('Traitement constant', '💊', constant, d)}
      ${this.sectionMoments('Autre', '🧴', autre, d)}
      ${this.sectionReserve('Réserve (si besoin)', '🆘', reserve, d)}
      ${this.sectionReserve('Autre — sans horaire', '🧴', autre.filter(o => !this.hasPoso(o)), d)}
      ${!act.length ? `<div class="card">${UI.empty('Aucun médicament à afficher. Ajoute une ordonnance pour générer ta liste.', '<a class="btn primary w" href="#ordonnances">' + UI.icon('plus') + 'Ajouter une ordonnance</a>')}</div>` : ''}
    `;

    UI.$('#med-date', el).onchange = e => { if (e.target.value) { this.date = e.target.value; this.render(el); } };
    el.onclick = async e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.d !== undefined) {
        this.date = b.dataset.d === '0' ? UI.today() : UI.addDays(this.date, Number(b.dataset.d));
        return this.render(el);
      }
      const act2 = b.dataset.act;
      if (act2 === 'stock') {
        this.stockModal(S.data.ordonnances.find(o => o.id === b.dataset.o), () => this.render(el));
      } else if (act2 === 'pris' || act2 === 'saute') {
        const rect = b.getBoundingClientRect();
        b.disabled = true;
        const r = await this.marquer(b.dataset.o, this.date, b.dataset.m, act2);
        if (r === 'pris') Saisons.burst(rect);
        this.render(el);
      } else if (act2 === 'dose') {
        const rect = b.getBoundingClientRect();
        b.disabled = true;
        const r = await App.write('savePrise', { ordonnance_id: b.dataset.o, date: this.date, moment: 'reserve', statut: 'pris', heure: this.date === UI.today() ? UI.nowTime() : '12:00' }).catch(() => null);
        if (r) { this.appliquer(r); Sons.play('ok'); Saisons.burst(rect); UI.toast('Dose enregistrée'); this.alerteStock(b.dataset.o); }
        this.render(el);
      } else if (act2 === 'deldose') {
        if (!(await UI.confirm('Supprimer cette dose ?', { danger: true, ok: 'Supprimer' }))) return;
        const r = await App.write('deletePrise', { id: b.dataset.id }).catch(() => null);
        if (r) { Store.remove('prises', b.dataset.id); this.appliquer(r); }
        this.render(el);
      }
    };
  }
};