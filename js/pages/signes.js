/**
 * MA SANTÉ — Signes vitaux : saisie, alertes insuline, graphiques, historique, exports, schéma de correction
 */
const SIGNES = {
  glycemie:   { label: 'Glycémie', icon: 'drop', min: 0, max: 40, step: 'décimal' },
  tension:    { label: 'Tension artérielle', unite: 'mmHg', double: true, min: 30, max: 280 },
  fc:         { label: 'Fréquence cardiaque', unite: 'bpm', min: 20, max: 250 },
  fr:         { label: 'Fréquence respiratoire', unite: '/min', min: 3, max: 70 },
  saturation: { label: 'Saturation', unite: '%', min: 50, max: 100 },
  douleur:    { label: 'Douleur', unite: '/10', min: 0, max: 10 }
};

const COULEURS_SIGNES = {
  normal:    { glycemie: '#e11d48', tension: '#2563eb', tension2: '#7fb0ff', fc: '#ea8a00', fr: '#0f9f6e', saturation: '#7c3aed', douleur: '#64748b' },
  daltonien: { glycemie: '#d55e00', tension: '#0072b2', tension2: '#56b4e9', fc: '#e69f00', fr: '#009e73', saturation: '#cc79a7', douleur: '#7a7a7a' }
};
const POINT_STYLES = { glycemie: 'circle', tension: 'rect', tension2: 'triangle', fc: 'rectRot', fr: 'star', saturation: 'crossRot', douleur: 'rectRounded' };

/** Zone de référence en fond de graphique. */
const bandePlugin = {
  id: 'bande',
  beforeDatasetsDraw(chart, args, o) {
    if (!o || o.min == null || o.max == null) return;
    const { ctx, chartArea: a, scales: { y } } = chart;
    if (!a || !y) return;
    const top = Math.max(y.getPixelForValue(o.max), a.top), bot = Math.min(y.getPixelForValue(o.min), a.bottom);
    if (bot <= top) return;
    ctx.save();
    ctx.fillStyle = o.color;
    ctx.fillRect(a.left, top, a.right - a.left, bot - top);
    ctx.restore();
  }
};

Pages.signes = {
  tab: 'saisie',
  periode: 30,
  filtre: '',
  charts: [],

  /* ---------- Utilitaires ---------- */
  unite(k) { return k === 'glycemie' ? (S.params.unite_glycemie || 'mmol/L') : SIGNES[k].unite; },
  dal() { return document.documentElement.dataset.daltonien === 'oui'; },
  couleur(k) { return COULEURS_SIGNES[this.dal() ? 'daltonien' : 'normal'][k]; },
  valeurTxt(s) { return s.type === 'tension' ? `${s.valeur}/${s.valeur2 || '—'}` : String(s.valeur); },
  tri(list) { return list.slice().sort((a, b) => (a.date_heure || '').localeCompare(b.date_heure || '')); },

  latest() {
    const out = {};
    S.data.signes.forEach(s => { if (!out[s.type] || s.date_heure > out[s.type].date_heure) out[s.type] = s; });
    return out;
  },

  dansPeriode(list) {
    if (!this.periode) return list;
    const lim = UI.isoDT(new Date(Date.now() - this.periode * 864e5));
    return list.filter(s => s.date_heure >= lim);
  },

  periodeTxt() {
    return this.periode ? `${this.periode} derniers jours` : 'tout l\'historique';
  },

  /** Palier du schéma de correction correspondant à une glycémie. */
  correction(val) {
    const v = UI.num(val);
    if (val === '' || val == null || !isFinite(v)) return null;
    const r = S.data.schema.find(l => {
      const min = l.glycemie_min === '' ? -Infinity : UI.num(l.glycemie_min);
      const max = l.glycemie_max === '' ? Infinity : UI.num(l.glycemie_max);
      return v >= min && v < max;
    });
    if (!r) return null;
    if (!(UI.num(r.unites) > 0) && !String(r.message || '').trim()) return null;
    return r;
  },

  alerteHtml(val) {
    const r = this.correction(val);
    if (!r) return '';
    const u = UI.num(r.unites) > 0;
    return `<div class="alerte-insuline" role="alert">${UI.icon('alert')}<div>
      <div>Glycémie ${UI.esc(String(val).replace('.', ','))} ${UI.esc(this.unite('glycemie'))} — selon ton schéma de correction :</div>
      ${u ? `<b class="big">Insuline : ${UI.esc(r.unites)} unité${UI.num(r.unites) > 1 ? 's' : ''}</b>` : ''}
      ${r.message ? `<p>${UI.esc(r.message)}</p>` : ''}
    </div></div>`;
  },

  destroy() {
    this.charts.forEach(c => c.destroy());
    this.charts = [];
  },

  /* ---------- Rendu principal ---------- */
  render(el) {
    this.destroy();
    const tabs = [
      ['saisie', 'Saisie', 'plus'], ['graphiques', 'Graphiques', 'chart'],
      ['historique', 'Historique', 'list'], ['correction', 'Schéma de correction', 'drop']
    ];
    el.innerHTML = `
      <div class="page-head"><h1>Signes vitaux</h1></div>
      <div class="tabs" role="tablist">${tabs.map(([k, l, i]) =>
        `<button class="tab ${this.tab === k ? 'active' : ''}" data-tab="${k}" role="tab" aria-selected="${this.tab === k}">${UI.icon(i)}${l}</button>`).join('')}</div>
      <div id="sv-body"></div>`;
    UI.$$('[data-tab]', el).forEach(b => b.onclick = () => { this.tab = b.dataset.tab; this.render(el); });
    if (S.ro && this.tab === 'saisie') this.tab = 'graphiques', this.render(el);
    else this['tab_' + this.tab](UI.$('#sv-body', el));
  },

  /* ---------- Saisie ---------- */
  tab_saisie(box) {
    if (S.ro) { box.innerHTML = UI.empty('Saisie indisponible en mode consultation.'); return; }
    const champ = (k, inner) => `<div class="signe-input" style="--c:${this.couleur(k)}"><span class="si-label"><span class="dot" style="--c:${this.couleur(k)}"></span>${SIGNES[k].label}</span>${inner}</div>`;
    const simple = (k, ph) => champ(k, `<div class="si-row"><input name="${k}" inputmode="decimal" autocomplete="off" placeholder="${ph}" aria-label="${SIGNES[k].label}"><span class="unit">${UI.esc(this.unite(k))}</span></div>`);
    box.innerHTML = `
      <form class="card form" id="f-signes" novalidate>
        <div class="grid2">
          <label>Date et heure<input type="datetime-local" name="date_heure" value="${UI.nowDT()}" required></label>
          <label>Note (facultatif)<input name="note" placeholder="ex. à jeun, après le repas, après le sport…"></label>
        </div>
        <p class="hint">Remplis seulement les mesures que tu as prises.</p>
        <div class="signes-grid">
          ${simple('glycemie', 'ex. 6,4')}
          ${champ('tension', `<div class="si-row"><input name="tension" inputmode="numeric" placeholder="Sys." aria-label="Systolique"><span class="sep">/</span><input name="tension2" inputmode="numeric" placeholder="Dia." aria-label="Diastolique"><span class="unit">mmHg</span></div>`)}
          ${simple('fc', 'ex. 72')}
          ${simple('fr', 'ex. 16')}
          ${simple('saturation', 'ex. 98')}
          ${champ('douleur', `<div class="pain">${Array.from({ length: 11 }, (_, i) => `<label><input type="radio" name="douleur" value="${i}"><span>${i}</span></label>`).join('')}</div><div class="pain-legend"><span>Aucune</span><button type="button" class="btn ghost sm" id="pain-clear">Effacer</button><span>Maximale</span></div>`)}
        </div>
        <div id="alerte-zone"></div>
        <div class="btn-row"><button class="btn primary" type="submit">${UI.icon('check')}Enregistrer</button></div>
      </form>
      ${S.data.schema.length ? '' : `<p class="hint" style="margin-top:12px">${UI.icon('drop')} Aucun schéma de correction enregistré : les alertes insuline s'activeront dès que tu l'auras saisi (onglet « Schéma de correction »).</p>`}`;

    const f = UI.$('#f-signes', box), zone = UI.$('#alerte-zone', box);
    let alerteJouee = false;
    f.glycemie.oninput = () => {
      const html = this.alerteHtml(f.glycemie.value);
      zone.innerHTML = html;
      if (html && !alerteJouee) { Sons.play('alerte'); alerteJouee = true; }
      if (!html) alerteJouee = false;
    };
    UI.$('#pain-clear', box).onclick = () => UI.$$('input[name=douleur]', f).forEach(r => { r.checked = false; });

    f.onsubmit = async e => {
      e.preventDefault();
      const d = UI.formData(f);
      if (!d.date_heure) { UI.toast('Indique la date et l\'heure', 'warn'); return; }
      const items = [];
      const erreurs = [];
      const add = (type, v, v2) => {
        const n = UI.num(v);
        if (!isFinite(n) || n < SIGNES[type].min || n > SIGNES[type].max) { erreurs.push(SIGNES[type].label); return; }
        items.push({ type, valeur: String(v).replace(',', '.'), valeur2: v2 != null ? String(v2).replace(',', '.') : '', date_heure: d.date_heure, note: d.note || '' });
      };
      ['glycemie', 'fc', 'fr', 'saturation'].forEach(k => { if (d[k]) add(k, d[k]); });
      if (d.tension || d.tension2) {
        if (!d.tension || !d.tension2 || !isFinite(UI.num(d.tension2)) || UI.num(d.tension2) < 20 || UI.num(d.tension2) > 200) erreurs.push('Tension (systolique ET diastolique)');
        else add('tension', d.tension, d.tension2);
      }
      if (d.douleur !== undefined && d.douleur !== '') add('douleur', d.douleur);
      if (erreurs.length) { UI.toast('Valeur à vérifier : ' + erreurs.join(', '), 'warn'); return; }
      if (!items.length) { UI.toast('Aucune mesure saisie', 'warn'); return; }

      const btn = UI.$('button[type=submit]', f);
      btn.disabled = true;
      const r = await App.write('saveSignes', { items }).catch(() => null);
      btn.disabled = false;
      if (!r) return;
      r.forEach(s => Store.upsert('signes', s));
      const corr = d.glycemie ? this.correction(d.glycemie) : null;
      UI.toast(`${r.length} mesure${r.length > 1 ? 's' : ''} enregistrée${r.length > 1 ? 's' : ''}`);
      if (corr) {
        Sons.play('alerte');
        UI.modal({ title: '⚠️ Correction d\'insuline', body: this.alerteHtml(d.glycemie), actions: [{ label: 'J\'ai compris', cls: 'danger' }] });
      } else {
        Sons.play('ok');
        Saisons.burst(btn.getBoundingClientRect());
      }
      f.reset();
      f.date_heure.value = UI.nowDT();
      zone.innerHTML = '';
    };
  },

  /* ---------- Graphiques ---------- */
  cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); },

  datasets(type, list, { yAxisID = 'y', light = false } = {}) {
    const pts = (key) => this.tri(list).map(s => ({ x: UI.parse(s.date_heure), y: UI.num(s[key]) })).filter(p => isFinite(p.y));
    const ds = (label, data, c, ps) => ({
      label, data, yAxisID, borderColor: c, backgroundColor: c, pointBackgroundColor: c,
      pointStyle: this.dal() ? ps : 'circle', pointRadius: light ? 2.5 : 3.5, pointHoverRadius: 6, borderWidth: 2, tension: 0.25, spanGaps: true
    });
    if (type === 'tension') return [
      ds('Systolique', pts('valeur'), this.couleur('tension'), POINT_STYLES.tension),
      ds('Diastolique', pts('valeur2'), this.couleur('tension2'), POINT_STYLES.tension2)
    ];
    return [ds(SIGNES[type].label, pts('valeur'), this.couleur(type), POINT_STYLES[type])];
  },

  chartConfig(datasets, { band = null, y2 = false, light = false, yTitle = '' } = {}) {
    const txt = light ? '#334155' : this.cssVar('--muted');
    const grid = light ? '#e5e7eb' : this.cssVar('--border');
    const scales = {
      x: { type: 'time', time: { tooltipFormat: 'dd.MM.yyyy HH:mm', displayFormats: { minute: 'HH:mm', hour: 'HH:mm', day: 'dd.MM', week: 'dd.MM', month: 'MM.yyyy', quarter: 'MM.yyyy', year: 'yyyy' } }, ticks: { color: txt, maxRotation: 0, autoSkipPadding: 14 }, grid: { color: grid } },
      y: { ticks: { color: txt }, grid: { color: grid }, title: { display: !!yTitle, text: yTitle, color: txt } }
    };
    if (y2) scales.y2 = { position: 'right', ticks: { color: txt }, grid: { drawOnChartArea: false }, title: { display: true, text: 'Glycémie / douleur', color: txt } };
    return {
      type: 'line',
      data: { datasets },
      options: {
        responsive: !light, maintainAspectRatio: false, animation: light ? false : { duration: 300 },
        interaction: { mode: 'nearest', intersect: false },
        plugins: {
          legend: { display: datasets.length > 1, labels: { color: txt, usePointStyle: true, boxWidth: 8 } },
          bande: band ? { min: band[0], max: band[1], color: light || document.documentElement.dataset.mode !== 'sombre' ? 'rgba(22,163,74,.10)' : 'rgba(74,222,128,.10)' } : {},
          tooltip: { callbacks: { label: c => `${c.dataset.label} : ${String(c.parsed.y).replace('.', ',')}` } }
        },
        scales
      },
      plugins: [bandePlugin]
    };
  },

  configGlobal(list, light = false) {
    const sets = [];
    Object.keys(SIGNES).forEach(k => {
      const l = list.filter(s => s.type === k);
      if (l.length) sets.push(...this.datasets(k, l, { yAxisID: (k === 'glycemie' || k === 'douleur') ? 'y2' : 'y', light }));
    });
    return { sets, cfg: this.chartConfig(sets, { y2: sets.some(s => s.yAxisID === 'y2'), light, yTitle: 'mmHg · bpm · % · /min' }) };
  },

  configType(k, list, light = false) {
    return this.chartConfig(this.datasets(k, list, { light }), { band: (APP_CONFIG.REFERENCES || {})[k], light, yTitle: this.unite(k) });
  },

  /** Image PNG d'un graphique en thème clair (pour le PDF). */
  imagePdf(cfg) {
    const c = document.createElement('canvas');
    c.width = 1100; c.height = 460;
    c.style.cssText = 'position:fixed;left:-9999px;top:0;width:1100px;height:460px';
    document.body.appendChild(c);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    cfg.options.devicePixelRatio = 1;
    cfg.plugins.push({ id: 'fond', beforeDraw: ch => { const x = ch.ctx; x.save(); x.fillStyle = '#fff'; x.fillRect(0, 0, ch.width, ch.height); x.restore(); } });
    const ch = new Chart(c, cfg);
    const url = c.toDataURL('image/png');
    ch.destroy(); c.remove();
    return url;
  },

  stats(list, key = 'valeur') {
    const v = list.map(s => UI.num(s[key])).filter(isFinite);
    if (!v.length) return null;
    const r = x => (Math.round(x * 10) / 10).toString().replace('.', ',');
    return { moy: r(v.reduce((a, b) => a + b, 0) / v.length), min: r(Math.min(...v)), max: r(Math.max(...v)), n: v.length };
  },

  tab_graphiques(box) {
    if (typeof Chart === 'undefined') { box.innerHTML = UI.empty('La librairie de graphiques n\'a pas pu être chargée.'); return; }
    const all = this.dansPeriode(S.data.signes);
    const per = [[7, '7 j'], [30, '30 j'], [90, '3 mois'], [365, '1 an'], [0, 'Tout']];
    const types = Object.keys(SIGNES).filter(k => all.some(s => s.type === k));
    box.innerHTML = `
      <div class="toolbar">
        <div class="chips">${per.map(([v, l]) => `<button class="chip ${this.periode === v ? 'active' : ''}" data-p="${v}">${l}</button>`).join('')}</div>
        <div class="btn-row"><span class="muted small">Tout exporter :</span>
          <button class="btn sm" data-exp="csv" data-t="">${UI.icon('download')}CSV</button>
          <button class="btn sm" data-exp="pdf" data-t="">${UI.icon('download')}PDF</button></div>
      </div>
      ${all.length ? `
        <section class="card"><div class="card-head"><h2>${UI.icon('chart')} Vue d'ensemble</h2><span class="muted small">${UI.esc(this.periodeTxt())} · clique sur la légende pour masquer une courbe</span></div>
          <div class="chart-box big"><canvas id="ch-global" aria-label="Graphique de tous les signes vitaux" role="img"></canvas></div></section>
        <div class="charts-grid" style="margin-top:16px">${types.map(k => {
          const l = all.filter(s => s.type === k);
          const st = this.stats(l), st2 = k === 'tension' ? this.stats(l, 'valeur2') : null;
          const fmt = (a, b, f) => b ? `${a[f]}/${b[f]}` : a[f];
          return `<section class="card"><div class="card-head"><h3><span class="dot" style="--c:${this.couleur(k)}"></span>${SIGNES[k].label}</h3>
            <div class="btn-row"><button class="btn sm" data-exp="csv" data-t="${k}">${UI.icon('download')}CSV</button><button class="btn sm" data-exp="pdf" data-t="${k}">${UI.icon('download')}PDF</button></div></div>
            <div class="stats"><span class="badge p">Moy. ${fmt(st, st2, 'moy')}</span><span class="badge">Min ${fmt(st, st2, 'min')}</span><span class="badge">Max ${fmt(st, st2, 'max')}</span><span class="badge">${st.n} mesure${st.n > 1 ? 's' : ''}</span><span class="muted small">${UI.esc(this.unite(k))}</span></div>
            <div class="chart-box"><canvas id="ch-${k}" role="img" aria-label="Graphique ${SIGNES[k].label}"></canvas></div></section>`;
        }).join('')}</div>`
      : `<div class="card">${UI.empty('Aucune mesure sur cette période.')}</div>`}`;

    UI.$$('[data-p]', box).forEach(b => b.onclick = () => { this.periode = Number(b.dataset.p); this.destroy(); this.tab_graphiques(box); });
    UI.$$('[data-exp]', box).forEach(b => b.onclick = () => this.exporter(b.dataset.t, b.dataset.exp));
    if (!all.length) return;
    this.charts.push(new Chart(UI.$('#ch-global', box), this.configGlobal(all).cfg));
    types.forEach(k => this.charts.push(new Chart(UI.$('#ch-' + k, box), this.configType(k, all.filter(s => s.type === k)))));
  },

  /* ---------- Exports ---------- */
  exporter(type, fmt) {
    const all = this.tri(this.dansPeriode(S.data.signes)).reverse();
    const list = type ? all.filter(s => s.type === type) : all;
    if (!list.length) { UI.toast('Rien à exporter sur cette période', 'warn'); return; }
    const who = UI.nomComplet(S.viewing);
    const base = `ma-sante_${Export.slug(who)}_${type ? Export.slug(SIGNES[type].label) : 'signes-vitaux'}_${UI.today()}`;
    const ligne = s => {
      const d = UI.parse(s.date_heure);
      return [UI.fmtD(s.date_heure), UI.fmtT(s.date_heure), SIGNES[s.type].label, String(s.valeur).replace('.', ','), s.type === 'tension' ? String(s.valeur2 || '') : '', this.unite(s.type), s.note || '', d ? '' : ''].slice(0, 7);
    };

    if (fmt === 'csv') {
      if (type === 'tension') Export.csv(base + '.csv', ['Date', 'Heure', 'Systolique', 'Diastolique', 'Unité', 'Note'], list.map(s => [UI.fmtD(s.date_heure), UI.fmtT(s.date_heure), s.valeur, s.valeur2, 'mmHg', s.note || '']));
      else if (type) Export.csv(base + '.csv', ['Date', 'Heure', SIGNES[type].label, 'Unité', 'Note'], list.map(s => [UI.fmtD(s.date_heure), UI.fmtT(s.date_heure), String(s.valeur).replace('.', ','), this.unite(type), s.note || '']));
      else Export.csv(base + '.csv', ['Date', 'Heure', 'Type', 'Valeur', 'Valeur 2 (diastolique)', 'Unité', 'Note'], list.map(ligne));
      return;
    }

    const types = type ? [type] : Object.keys(SIGNES).filter(k => list.some(s => s.type === k));
    const sections = [];
    if (!type) sections.push({ titre: "Vue d'ensemble", image: this.imagePdf(this.configGlobal(list, true).cfg) });
    types.forEach(k => {
      const l = list.filter(s => s.type === k);
      const st = this.stats(l), st2 = k === 'tension' ? this.stats(l, 'valeur2') : null;
      sections.push({
        titre: `${SIGNES[k].label} (${this.unite(k)}) - moy. ${st2 ? st.moy + '/' + st2.moy : st.moy}, min ${st2 ? st.min + '/' + st2.min : st.min}, max ${st2 ? st.max + '/' + st2.max : st.max}`,
        image: this.imagePdf(this.configType(k, l, true)),
        headers: k === 'tension' ? ['Date', 'Heure', 'Systolique', 'Diastolique', 'Note'] : ['Date', 'Heure', 'Valeur', 'Note'],
        rows: l.map(s => k === 'tension'
          ? [UI.fmtD(s.date_heure), UI.fmtT(s.date_heure), s.valeur, s.valeur2, s.note || '']
          : [UI.fmtD(s.date_heure), UI.fmtT(s.date_heure), String(s.valeur).replace('.', ','), s.note || ''])
      });
    });
    Export.pdf(base + '.pdf', type ? SIGNES[type].label : 'Signes vitaux', `${who} · ${this.periodeTxt()} · exporté le ${UI.fmtDT(UI.nowDT())}`, sections);
  },

  /* ---------- Historique ---------- */
  tab_historique(box) {
    const list = this.tri(S.data.signes).reverse().filter(s => !this.filtre || s.type === this.filtre);
    box.innerHTML = `
      <div class="toolbar">
        <div class="chips"><button class="chip ${!this.filtre ? 'active' : ''}" data-f="">Tous</button>${Object.keys(SIGNES).map(k => `<button class="chip ${this.filtre === k ? 'active' : ''}" data-f="${k}">${SIGNES[k].label}</button>`).join('')}</div>
        <span class="muted small">${list.length} mesure${list.length > 1 ? 's' : ''}</span>
      </div>
      <div class="card">${list.length ? `<div class="table-wrap"><table class="table resp"><thead><tr><th>Date</th><th>Type</th><th>Valeur</th><th>Note</th><th></th></tr></thead><tbody>
        ${list.slice(0, 500).map(s => {
          const c = s.type === 'glycemie' ? this.correction(s.valeur) : null;
          return `<tr><td data-label="Date">${UI.esc(UI.fmtDT(s.date_heure))}</td>
            <td data-label="Type"><span class="dot" style="--c:${this.couleur(s.type)}"></span> ${SIGNES[s.type] ? SIGNES[s.type].label : UI.esc(s.type)}</td>
            <td data-label="Valeur"><span class="mono">${UI.esc(this.valeurTxt(s).replace('.', ','))}</span> <span class="muted small">${UI.esc(this.unite(s.type) || '')}</span>${c && UI.num(c.unites) > 0 ? ' ' + UI.badge('danger', `Correction ${c.unites} U`) : ''}</td>
            <td data-label="Note">${UI.esc(s.note || '—')}</td>
            <td class="actions w" data-label=""><button class="icon-btn" data-edit="${s.id}" aria-label="Modifier">${UI.icon('edit')}</button><button class="icon-btn danger" data-del="${s.id}" aria-label="Supprimer">${UI.icon('trash')}</button></td></tr>`;
        }).join('')}</tbody></table></div>${list.length > 500 ? '<p class="muted small">Affichage limité aux 500 dernières mesures — utilise l\'export pour tout récupérer.</p>' : ''}`
      : UI.empty('Aucune mesure enregistrée.')}</div>`;

    UI.$$('[data-f]', box).forEach(b => b.onclick = () => { this.filtre = b.dataset.f; this.tab_historique(box); });
    UI.$$('[data-del]', box).forEach(b => b.onclick = async () => {
      if (!(await UI.confirm('Supprimer cette mesure ?', { danger: true, ok: 'Supprimer' }))) return;
      const r = await App.write('deleteSigne', { id: b.dataset.del }).catch(() => null);
      if (r) { Store.remove('signes', b.dataset.del); this.tab_historique(box); }
    });
    UI.$$('[data-edit]', box).forEach(b => b.onclick = () => this.editer(S.data.signes.find(s => s.id === b.dataset.edit), () => this.tab_historique(box)));
  },

  editer(s, done) {
    if (!s) return;
    const t = SIGNES[s.type];
    UI.modal({
      title: 'Modifier — ' + UI.esc(t.label),
      body: `<form class="form" id="f-edit-signe">
        <label>Date et heure<input type="datetime-local" name="date_heure" value="${UI.esc(s.date_heure)}" required></label>
        ${s.type === 'tension'
          ? `<div class="grid2"><label>Systolique<input name="valeur" inputmode="numeric" value="${UI.esc(s.valeur)}" required></label><label>Diastolique<input name="valeur2" inputmode="numeric" value="${UI.esc(s.valeur2)}" required></label></div>`
          : `<label>Valeur (${UI.esc(this.unite(s.type))})<input name="valeur" inputmode="decimal" value="${UI.esc(String(s.valeur).replace('.', ','))}" required></label>`}
        <label>Note<input name="note" value="${UI.esc(s.note || '')}"></label></form>`,
      actions: [
        { label: 'Annuler', cls: 'ghost' },
        { label: 'Enregistrer', cls: 'primary', onClick: async m => {
          const f = UI.$('form', m.body);
          if (!f.reportValidity()) return false;
          const d = UI.formData(f);
          const v = UI.num(d.valeur);
          if (!isFinite(v) || v < t.min || v > t.max) { UI.toast('Valeur hors limites', 'warn'); return false; }
          const r = await App.write('saveSignes', { items: [Object.assign({ id: s.id, type: s.type, valeur2: '' }, d)] });
          Store.upsert('signes', r[0]);
          done && done();
        } }
      ]
    });
  },

  /* ---------- Schéma de correction ---------- */
  tab_correction(box) {
    const u = this.unite('glycemie');
    const lignes = S.data.schema.slice().sort((a, b) => UI.num(a.glycemie_min || -1e9) - UI.num(b.glycemie_min || -1e9));
    const row = (l = {}) => `<div class="schema-row">
      <input name="glycemie_min" inputmode="decimal" value="${UI.esc(String(l.glycemie_min || '').replace('.', ','))}" placeholder="De (≥)" aria-label="Glycémie à partir de">
      <input name="glycemie_max" inputmode="decimal" value="${UI.esc(String(l.glycemie_max || '').replace('.', ','))}" placeholder="Jusqu'à (<)" aria-label="Glycémie jusqu'à">
      <input name="unites" inputmode="decimal" value="${UI.esc(String(l.unites || '').replace('.', ','))}" placeholder="Unités" aria-label="Unités d'insuline">
      <input name="message" class="msg" value="${UI.esc(l.message || '')}" placeholder="Message (facultatif)" aria-label="Message">
      <button type="button" class="icon-btn danger w" data-rm aria-label="Supprimer ce palier">${UI.icon('trash')}</button>
    </div>`;
    box.innerHTML = `<div class="card">
      <div class="card-head"><h2>${UI.icon('drop')} Schéma de correction d'insuline</h2></div>
      <p class="hint">Saisis les paliers <b>exactement comme prescrits par ton médecin</b> (glycémie en ${UI.esc(u)}). Un palier s'applique de la valeur « De » incluse jusqu'à la valeur « Jusqu'à » exclue — laisse une case vide pour « sans limite ». Lors de la saisie d'une glycémie, le palier correspondant s'affiche en rouge. L'application ne calcule rien elle-même.</p>
      <div class="schema-head"><span>De (≥ ${UI.esc(u)})</span><span>Jusqu'à (&lt; ${UI.esc(u)})</span><span>Unités</span><span>Message</span><span></span></div>
      <div id="schema-rows">${lignes.length ? lignes.map(row).join('') : row()}</div>
      <div class="btn-row w" style="margin-top:14px">
        <button class="btn" id="schema-add">${UI.icon('plus')}Ajouter un palier</button>
        <button class="btn primary" id="schema-save">${UI.icon('check')}Enregistrer le schéma</button>
      </div>
      <div style="margin-top:16px"><label>Tester une valeur<input id="schema-test" inputmode="decimal" placeholder="ex. 13,2" style="max-width:220px"></label><div id="schema-test-out" style="margin-top:10px"></div></div>
    </div>`;
    if (S.ro) UI.$$('input', box).forEach(i => { if (i.id !== 'schema-test') i.disabled = true; });
    const rows = UI.$('#schema-rows', box);
    rows.onclick = e => { const b = e.target.closest('[data-rm]'); if (b) b.closest('.schema-row').remove(); };
    UI.$('#schema-add', box).onclick = () => rows.insertAdjacentHTML('beforeend', row());
    UI.$('#schema-test', box).oninput = e => {
      const html = this.alerteHtml(e.target.value);
      UI.$('#schema-test-out', box).innerHTML = html || (e.target.value ? '<p class="muted">Aucune correction pour cette valeur (avec le schéma enregistré).</p>' : '');
    };
    UI.$('#schema-save', box).onclick = async () => {
      const lst = [];
      let err = '';
      UI.$$('.schema-row', rows).forEach(r => {
        const g = n => UI.$(`[name=${n}]`, r).value.trim().replace(',', '.');
        const l = { glycemie_min: g('glycemie_min'), glycemie_max: g('glycemie_max'), unites: g('unites'), message: UI.$('[name=message]', r).value.trim() };
        if (!l.glycemie_min && !l.glycemie_max && !l.unites && !l.message) return;
        if ([l.glycemie_min, l.glycemie_max, l.unites].some(v => v !== '' && !isFinite(Number(v)))) err = 'Valeurs numériques invalides';
        else if (l.glycemie_min !== '' && l.glycemie_max !== '' && Number(l.glycemie_min) >= Number(l.glycemie_max)) err = '« De » doit être inférieur à « Jusqu\'à »';
        lst.push(l);
      });
      if (!err) {
        const s = lst.map(l => [l.glycemie_min === '' ? -Infinity : Number(l.glycemie_min), l.glycemie_max === '' ? Infinity : Number(l.glycemie_max)]).sort((a, b) => a[0] - b[0]);
        for (let i = 1; i < s.length; i++) if (s[i][0] < s[i - 1][1]) err = 'Deux paliers se chevauchent';
      }
      if (err) { UI.toast(err, 'warn'); return; }
      const r = await App.write('saveSchema', { lignes: lst }).catch(() => null);
      if (!r) return;
      S.data.schema = r;
      UI.toast('Schéma de correction enregistré');
      this.tab_correction(box);
    };
  }
};
