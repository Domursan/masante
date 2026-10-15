/**
 * MA SANTÉ — Historique médical
 * Événements datés (début / fin ou ponctuels, précision jour / mois / année)
 * affichés en frise chronologique interactive ou en liste par année.
 */
const HISTO_TYPES = {
  maladie:         { label: 'Maladie / pathologie',     e: '🩺', c: '#D55E00' },
  hospitalisation: { label: 'Hospitalisation',          e: '🏥', c: '#CC3311' },
  operation:       { label: 'Opération / intervention', e: '⚕️', c: '#AA3377' },
  consultation:    { label: 'Consultation',             e: '👨‍⚕️', c: '#0072B2' },
  examen:          { label: 'Examen / analyse',         e: '🔬', c: '#3B8FC4' },
  traitement:      { label: 'Traitement',               e: '💊', c: '#009E73' },
  accident:        { label: 'Accident / blessure',      e: '🩹', c: '#E69F00' },
  vaccin:          { label: 'Vaccin',                   e: '💉', c: '#44AA99' },
  grossesse:       { label: 'Grossesse',                e: '🤰', c: '#CC79A7' },
  autre:           { label: 'Autre',                    e: '📌', c: '#7A7A7A' }
};
const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

Pages.historique = {
  vue: 'frise',
  zoom: null,          // pixels par année (null = tout voir)
  filtre: '',
  q: '',
  importants: false,
  el: null,

  /* ---------- Utilitaires de dates ---------- */
  type(h) { return HISTO_TYPES[h.type] || HISTO_TYPES.autre; },

  fmt(date, prec) {
    if (!date) return '';
    const [y, m] = date.split('-');
    if (prec === 'annee') return y;
    if (prec === 'mois') return `${MOIS_LONGS[Number(m) - 1]} ${y}`;
    return UI.fmtD(date);
  },

  ponctuel(h) { return h.en_cours !== 'oui' && !h.date_fin; },

  /** Fin effective : fin du mois / de l'année selon la précision, aujourd'hui si en cours. */
  fin(h) {
    if (h.en_cours === 'oui') return UI.today();
    if (!h.date_fin) return '';
    const [y, m] = h.date_fin.split('-').map(Number);
    if (h.precision_fin === 'annee') return `${y}-12-31`;
    if (h.precision_fin === 'mois') return UI.isoDate(new Date(y, m, 0));
    return h.date_fin;
  },

  periode(h) {
    const d = this.fmt(h.date_debut, h.precision_debut);
    if (h.en_cours === 'oui') return `Depuis ${d} (en cours)`;
    if (!h.date_fin) return d;
    return `${d} → ${this.fmt(h.date_fin, h.precision_fin)}`;
  },

  duree(h) {
    if (this.ponctuel(h)) return '';
    const a = UI.parse(h.date_debut), f = this.fin(h);
    if (!a || !f) return '';
    const b = UI.parse(UI.addDays(f, 1)); // fin incluse : « janvier → mars » = 3 mois
    let mois = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
    if (b.getDate() < a.getDate()) mois--;
    if (mois < 1) { const j = Math.round((b - a) / 864e5); return `${j} jour${j > 1 ? 's' : ''}`; }
    const an = Math.floor(mois / 12), r = mois % 12;
    return [an ? `${an} an${an > 1 ? 's' : ''}` : '', r ? `${r} mois` : ''].filter(Boolean).join(' ');
  },

  filtres() {
    const q = this.q.toLowerCase();
    return S.data.historique.filter(h =>
      (!this.filtre || (h.type || 'autre') === this.filtre) &&
      (!this.importants || h.important === 'oui') &&
      (!q || [h.titre, h.description, h.diagnostic, h.traitements, h.praticien, h.lieu, h.suivi].join(' ').toLowerCase().includes(q)));
  },

  /* ---------- Mise en page de la frise (partagée écran / PDF) ---------- */
  /**
   * Calcule la position de chaque événement et répartit les événements sur des lignes
   * pour qu'ils ne se chevauchent jamais (titre compris).
   * mesure(texte) -> largeur en px ; largeur = largeur totale disponible pour les années.
   */
  disposer(list, pxParAn, mesure, marge = 0) {
    const debuts = list.map(h => h.date_debut).sort();
    const fins = list.map(h => this.fin(h) || h.date_debut).sort();
    const y0 = Number(debuts[0].slice(0, 4));
    const y1 = Math.max(Number(fins[fins.length - 1].slice(0, 4)), new Date().getFullYear());
    const origine = new Date(y0, 0, 1), finAxe = new Date(y1 + 1, 0, 1);
    const ans = y1 - y0 + 1;
    const largeur = ans * pxParAn;
    const pxJour = largeur / ((finAxe - origine) / 864e5);
    const x = d => marge + ((UI.parse(d) - origine) / 864e5) * pxJour;

    const items = list.map(h => {
      const t = this.type(h);
      const label = `${t.e} ${h.titre}${h.important === 'oui' ? ' ⭐' : ''}`;
      const lw = mesure(label) + 14;
      const pt = this.ponctuel(h);
      const x1 = x(h.date_debut);
      const x2 = pt ? x1 : Math.max(x(this.fin(h)) + pxJour, x1 + 8);
      const dedans = !pt && (x2 - x1) >= lw;
      const debut = pt ? x1 - 9 : x1;
      const ext = dedans ? x2 : (pt ? x1 + 12 + lw : x2 + 6 + lw);
      return { h, t, label, x1, x2, pt, dedans, debut, ext };
    }).sort((a, b) => a.debut - b.debut || b.ext - a.ext);

    const lignes = [];
    items.forEach(it => {
      let l = lignes.findIndex(r => r + 8 <= it.debut);
      if (l < 0) { l = lignes.length; lignes.push(0); }
      lignes[l] = it.ext;
      it.ligne = l;
    });
    const maxExt = items.reduce((m, it) => Math.max(m, it.ext), 0);
    return { items, nbLignes: lignes.length, y0, y1, ans, largeur, total: Math.max(marge * 2 + largeur, maxExt + 20), x, pxParAn };
  },

  pasAnnees(pxParAn) { return pxParAn >= 45 ? 1 : pxParAn >= 22 ? 2 : pxParAn >= 9 ? 5 : 10; },

  /* ---------- Page ---------- */
  render(el) {
    this.el = el;
    const all = S.data.historique;
    const enCours = all.filter(h => h.en_cours === 'oui').length;
    el.innerHTML = `
      <div class="page-head">
        <div><h1>Historique médical</h1><p class="muted">${all.length} événement${all.length > 1 ? 's' : ''}${enCours ? ` · ${enCours} en cours` : ''}</p></div>
        <div class="btn-row">
          ${all.length ? `<button class="btn" id="h-pdf">${UI.icon('download')}PDF</button>` : ''}
          <button class="btn primary w" id="h-add">${UI.icon('plus')}Ajouter un événement</button>
        </div>
      </div>
      ${all.length ? `
        <div class="tabs" role="tablist">
          <button class="tab ${this.vue === 'frise' ? 'active' : ''}" data-vue="frise" role="tab">${UI.icon('timeline')}Frise chronologique</button>
          <button class="tab ${this.vue === 'liste' ? 'active' : ''}" data-vue="liste" role="tab">${UI.icon('list')}Liste</button>
        </div>
        <div class="toolbar">
          <div class="chips" id="h-chips"></div>
          <div class="btn-row">
            <label class="search"><span class="sr-only">Rechercher</span>${UI.icon('search')}<input type="search" id="h-q" placeholder="Rechercher…" value="${UI.esc(this.q)}"></label>
            <button class="chip ${this.importants ? 'active' : ''}" id="h-imp">⭐ Importants</button>
          </div>
        </div>` : ''}
      <div id="h-body"></div>`;

    UI.$('#h-add', el).onclick = () => this.form(null);
    if (!all.length) {
      UI.$('#h-body', el).innerHTML = `<div class="card">${UI.empty('Aucun événement pour le moment. Ajoute tes antécédents (maladies, opérations, hospitalisations, examens, vaccins…) pour construire ta frise chronologique.', `<button class="btn primary w" data-add>${UI.icon('plus')}Ajouter le premier événement</button>`)}</div>`;
      UI.$('[data-add]', el) && (UI.$('[data-add]', el).onclick = () => this.form(null));
      return;
    }
    UI.$('#h-pdf', el).onclick = () => this.pdf();
    UI.$$('[data-vue]', el).forEach(b => b.onclick = () => {
      this.vue = b.dataset.vue;
      UI.$$('[data-vue]', el).forEach(x => x.classList.toggle('active', x === b));
      this.corps();
    });
    UI.$('#h-q', el).oninput = e => { this.q = e.target.value; this.corps(); };
    UI.$('#h-imp', el).onclick = e => { this.importants = !this.importants; e.currentTarget.classList.toggle('active', this.importants); this.corps(); };
    this.corps();
  },

  /** Ne redessine que les filtres et le contenu (garde le focus de la recherche). */
  corps() {
    const el = this.el;
    if (!el || !el.isConnected) return;
    if (!S.data.historique.length || !UI.$('#h-body', el)) return this.render(el);
    const types = Object.keys(HISTO_TYPES).filter(k => S.data.historique.some(h => (h.type || 'autre') === k));
    if (this.filtre && !types.includes(this.filtre)) this.filtre = '';
    const chips = UI.$('#h-chips', el);
    chips.innerHTML = `<button class="chip ${!this.filtre ? 'active' : ''}" data-f="">Tous</button>` +
      types.map(k => `<button class="chip ${this.filtre === k ? 'active' : ''}" data-f="${k}">${HISTO_TYPES[k].e} ${HISTO_TYPES[k].label}</button>`).join('');
    chips.onclick = e => { const b = e.target.closest('[data-f]'); if (b) { this.filtre = b.dataset.f; this.corps(); } };

    const body = UI.$('#h-body', el);
    const list = this.filtres();
    if (!list.length) { body.innerHTML = `<div class="card">${UI.empty('Aucun événement ne correspond aux filtres.')}</div>`; return; }
    if (this.vue === 'frise') this.frise(body, list); else this.liste(body, list);
  },

  /* ---------- Vue frise ---------- */
  frise(box, list, garderCentre = null) {
    box.onclick = null; // retire le gestionnaire de la vue liste
    box.innerHTML = `<div class="card frise-card">
      <div class="frise-tools">
        <span class="muted small">Fais glisser pour te déplacer · clique sur un événement pour le détail</span>
        <div class="btn-row">
          <button class="icon-btn" data-z="out" aria-label="Dézoomer" title="Dézoomer">${UI.icon('minus')}</button>
          <button class="btn sm" data-z="fit">Tout voir</button>
          <button class="icon-btn" data-z="in" aria-label="Zoomer" title="Zoomer">${UI.icon('plus')}</button>
        </div>
      </div>
      <div class="frise-scroll" tabindex="0" aria-label="Frise chronologique"><div class="frise"></div></div>
      <div class="frise-legende">${Object.keys(HISTO_TYPES).filter(k => list.some(h => (h.type || 'autre') === k))
        .map(k => `<span><i style="--c:${HISTO_TYPES[k].c}"></i>${HISTO_TYPES[k].e} ${HISTO_TYPES[k].label}</span>`).join('')}
        <span><i class="ouvert-ex"></i>En cours</span></div>
    </div>`;

    const scroll = UI.$('.frise-scroll', box), fr = UI.$('.frise', box);
    const dispo = Math.max(280, scroll.clientWidth - 24);
    const debuts = list.map(h => h.date_debut).sort();
    const fins = list.map(h => this.fin(h) || h.date_debut).sort();
    const ans = Math.max(Number(fins[fins.length - 1].slice(0, 4)), new Date().getFullYear()) - Number(debuts[0].slice(0, 4)) + 1;

    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = `700 13px ${getComputedStyle(document.body).fontFamily}`;
    const mesure = t => ctx.measureText(t).width;

    // « Tout voir » : échelle ajustée pour que les titres de droite tiennent aussi dans la largeur
    let fit = Math.max(14, dispo / ans);
    for (let i = 0; i < 4; i++) {
      const T = this.disposer(list, fit, mesure, 12);
      const deborde = T.total - (dispo + 24);
      if (deborde <= 1 || fit <= 14) break;
      fit = Math.max(14, fit * (T.largeur - deborde) / T.largeur);
    }
    const pxParAn = this.zoom || fit;
    const L = this.disposer(list, pxParAn, mesure, 12);
    const LIGNE = 38, AXE = 34;
    const H = AXE + L.nbLignes * LIGNE + 30;
    fr.style.width = L.total + 'px';
    fr.style.height = H + 'px';

    // Axe des années (+ mois si zoom important)
    const pas = this.pasAnnees(pxParAn);
    let axe = '';
    for (let y = L.y0; y <= L.y1 + 1; y++) {
      const xi = L.x(`${y}-01-01`);
      if ((y - L.y0) % pas === 0 || y === L.y1 + 1) {
        axe += `<div class="fr-tick an" style="left:${xi}px"><span>${y <= L.y1 ? y : ''}</span></div>`;
      }
      if (pxParAn >= 300 && y <= L.y1) {
        for (let m = 1; m < 12; m++) {
          const xm = L.x(`${y}-${UI.pad(m + 1)}-01`);
          axe += `<div class="fr-tick mois" style="left:${xm}px">${pxParAn >= 620 ? `<span>${MOIS_COURTS[m]}</span>` : ''}</div>`;
        }
      }
    }
    const xAuj = L.x(UI.today());
    axe += `<div class="fr-auj" style="left:${xAuj}px"><span>Aujourd'hui</span></div>`;

    const items = L.items.map(it => {
      const h = it.h, top = AXE + it.ligne * LIGNE + 4;
      const ouvert = h.en_cours === 'oui';
      const cls = `fr-item ${it.pt ? 'pt' : 'barre'} ${it.dedans ? 'dedans' : ''} ${ouvert ? 'ouvert' : ''} ${h.important === 'oui' ? 'imp' : ''}`;
      const aria = `${it.t.label} : ${h.titre}, ${this.periode(h)}`;
      const lbl = `<span class="lbl">${UI.esc(it.label)}</span>`;
      return `<button class="${cls}" data-id="${h.id}" style="left:${it.pt ? it.x1 - 7 : it.x1}px;top:${top}px;--c:${it.t.c}" aria-label="${UI.esc(aria)}" title="${UI.esc(this.periode(h))}">
        ${it.pt ? `<span class="dot"></span>${lbl}` : `<span class="bar" style="width:${it.x2 - it.x1}px">${it.dedans ? lbl : ''}</span>${it.dedans ? '' : lbl}`}
      </button>`;
    }).join('');
    fr.innerHTML = axe + items;

    // Position initiale : garder le centre après un zoom, sinon montrer la fin (aujourd'hui)
    if (garderCentre != null) scroll.scrollLeft = garderCentre * scroll.scrollWidth - scroll.clientWidth / 2;
    else scroll.scrollLeft = Math.max(0, xAuj - scroll.clientWidth * 0.75);

    // Zoom
    UI.$$('[data-z]', box).forEach(b => b.onclick = () => {
      const centre = (scroll.scrollLeft + scroll.clientWidth / 2) / scroll.scrollWidth;
      if (b.dataset.z === 'fit') { this.zoom = null; return this.frise(box, list); }
      const f = b.dataset.z === 'in' ? 1.7 : 1 / 1.7;
      this.zoom = Math.min(4000, Math.max(fit, pxParAn * f));
      if (this.zoom <= fit + 0.5) this.zoom = null;
      this.frise(box, list, centre);
    });

    // Glisser à la souris (le doigt fait défiler nativement)
    let drag = null;
    scroll.onpointerdown = e => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      drag = { x: e.clientX, left: scroll.scrollLeft, bouge: false };
    };
    scroll.onpointermove = e => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > 4) { drag.bouge = true; scroll.classList.add('drag'); }
      if (drag.bouge) scroll.scrollLeft = drag.left - dx;
    };
    const fin = () => { setTimeout(() => { drag = null; }, 0); scroll.classList.remove('drag'); };
    scroll.onpointerup = fin;
    scroll.onpointerleave = fin;
    scroll.onclick = e => {
      if (drag && drag.bouge) return;
      const b = e.target.closest('[data-id]');
      if (b) this.detail(S.data.historique.find(h => h.id === b.dataset.id));
    };
  },

  /* ---------- Vue liste ---------- */
  liste(box, list) {
    const tri = list.slice().sort((a, b) => b.date_debut.localeCompare(a.date_debut) || a.titre.localeCompare(b.titre, 'fr'));
    const parAn = {};
    tri.forEach(h => { (parAn[h.date_debut.slice(0, 4)] = parAn[h.date_debut.slice(0, 4)] || []).push(h); });
    box.innerHTML = `<div class="histo-liste">${Object.keys(parAn).sort().reverse().map(y => `
      <h2 class="histo-annee">${y}</h2>
      ${parAn[y].map(h => {
        const t = this.type(h), d = this.duree(h);
        return `<button class="histo-item ${h.important === 'oui' ? 'imp' : ''}" data-id="${h.id}" style="--c:${t.c}">
          <span class="histo-dot" aria-hidden="true">${t.e}</span>
          <span class="histo-contenu">
            <span class="histo-titre"><b>${UI.esc(h.titre)}</b>${h.important === 'oui' ? ' ⭐' : ''} ${h.en_cours === 'oui' ? UI.badge('p', 'En cours') : ''}</span>
            <span class="muted small">${UI.esc(this.periode(h))}${d ? ' · ' + UI.esc(d) : ''} · ${t.label}</span>
            ${h.diagnostic ? `<span class="histo-ligne"><b>Diagnostic :</b> ${UI.esc(h.diagnostic)}</span>` : ''}
            ${h.traitements ? `<span class="histo-ligne"><b>Traitements :</b> ${UI.esc(h.traitements)}</span>` : ''}
          </span>
          ${UI.icon('right')}
        </button>`;
      }).join('')}`).join('')}
    </div>`;
    box.onclick = e => {
      const b = e.target.closest('[data-id]');
      if (b) this.detail(S.data.historique.find(h => h.id === b.dataset.id));
    };
  },

  /* ---------- Détail ---------- */
  detail(h) {
    if (!h) return;
    const t = this.type(h), d = this.duree(h);
    const champ = (l, v) => v ? `<div class="histo-champ"><span>${l}</span><p>${UI.esc(v)}</p></div>` : '';
    const actions = [{ label: 'Fermer', cls: 'ghost' }];
    if (!S.ro) {
      actions.push({ label: UI.icon('trash') + 'Supprimer', cls: 'ghost', onClick: async () => {
        if (!(await UI.confirm(`Supprimer « ${h.titre} » de l'historique ?`, { danger: true, ok: 'Supprimer' }))) return false;
        await App.write('deleteHistorique', { id: h.id });
        Store.remove('historique', h.id);
        if (Pages.urgence) Pages.urgence.syncLocal();
        UI.toast('Événement supprimé');
        this.render(this.el);
      } });
      actions.push({ label: UI.icon('edit') + 'Modifier', cls: 'primary', onClick: () => { setTimeout(() => this.form(h), 30); } });
    }
    const m = UI.modal({
      title: `${t.e} ${UI.esc(h.titre)}`,
      wide: true,
      body: `<div class="histo-entete" style="--c:${t.c}">
          <span class="badge histo-type">${t.label}</span>
          ${h.important === 'oui' ? '<span class="badge p">⭐ Important</span>' : ''}
          ${h.en_cours === 'oui' ? UI.badge('p', 'En cours') : ''}
          <p class="histo-periode">${UI.icon('clock')} ${UI.esc(this.periode(h))}${d ? ` · <b>${UI.esc(d)}</b>` : ''}</p>
        </div>
        ${champ('Diagnostic', h.diagnostic)}
        ${champ('Description', h.description)}
        ${champ('Traitements', h.traitements)}
        ${champ('Médecin / praticien', h.praticien)}
        ${champ('Établissement / lieu', h.lieu)}
        ${champ('Suivi / remarques', h.suivi)}
        ${h.photo ? `<div class="histo-champ"><span>Document</span><img class="thumb doc" data-zoom="${UI.esc(h.photo)}" alt="Document joint" hidden></div>` : ''}`,
      actions
    });
    const img = UI.$('img[data-zoom]', m.body);
    if (img) { Photos.fill(img, h.photo); img.onclick = () => Photos.lightbox(h.photo); }
  },

  /* ---------- Formulaire ---------- */
  champDate(nom, prec, val) {
    const [y = '', m = ''] = (val || '').split('-');
    return `<div class="date-prec" data-champ="${nom}">
      <select name="precision_${nom}" aria-label="Précision de la date">
        ${[['jour', 'Date précise'], ['mois', 'Mois et année'], ['annee', 'Année seulement']].map(([k, l]) => `<option value="${k}" ${prec === k ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
      <input type="date" data-p="jour" value="${UI.esc(val || '')}" aria-label="Date">
      <select data-p="mois" aria-label="Mois"><option value="">Mois…</option>${MOIS_LONGS.map((ml, i) => `<option value="${UI.pad(i + 1)}" ${m === UI.pad(i + 1) ? 'selected' : ''}>${ml}</option>`).join('')}</select>
      <input type="number" data-p="annee" min="1900" max="2100" step="1" inputmode="numeric" placeholder="Année" value="${UI.esc(y)}" aria-label="Année">
    </div>`;
  },

  /** Valeur ISO (yyyy-mm-dd) d'un champ date selon sa précision, '' si incomplet. */
  lireDate(f, nom) {
    const box = UI.$(`[data-champ=${nom}]`, f);
    const prec = UI.$(`[name=precision_${nom}]`, box).value;
    const j = UI.$('[data-p=jour]', box).value, m = UI.$('[data-p=mois]', box).value, y = UI.$('[data-p=annee]', box).value.trim();
    if (prec === 'jour') return /^\d{4}-\d{2}-\d{2}$/.test(j) ? j : '';
    if (!/^\d{4}$/.test(y)) return '';
    if (prec === 'mois') return m ? `${y}-${m}-01` : '';
    return `${y}-01-01`;
  },

  majChampDate(f, nom) {
    const box = UI.$(`[data-champ=${nom}]`, f);
    const prec = UI.$(`[name=precision_${nom}]`, box).value;
    UI.$('[data-p=jour]', box).hidden = prec !== 'jour';
    UI.$('[data-p=mois]', box).hidden = prec !== 'mois';
    UI.$('[data-p=annee]', box).hidden = prec === 'jour';
  },

  form(h) {
    const nouveau = !h;
    h = h || { type: 'maladie', precision_debut: 'jour', precision_fin: 'jour', en_cours: 'non', important: 'non' };
    const ta = (name, label, ph, rows = 2) => `<label>${label}<textarea name="${name}" rows="${rows}" placeholder="${ph}">${UI.esc(h[name] || '')}</textarea></label>`;
    const m = UI.modal({
      title: nouveau ? 'Nouvel événement' : "Modifier l'événement",
      wide: true,
      body: `<form class="form" id="f-histo" novalidate>
        <div class="grid2">
          <label>Type<select name="type">${Object.entries(HISTO_TYPES).map(([k, t]) => `<option value="${k}" ${(h.type || 'autre') === k ? 'selected' : ''}>${t.e} ${t.label}</option>`).join('')}</select></label>
          <label>Titre *<input name="titre" required value="${UI.esc(h.titre || '')}" placeholder="ex. Appendicite, fracture du poignet…"></label>
        </div>
        <fieldset><legend>Dates</legend>
          <div class="grid2">
            <div><span class="lbl-date">Début *</span>${this.champDate('debut', h.precision_debut || 'jour', h.date_debut)}</div>
            <div data-bloc-fin><span class="lbl-date">Fin</span>${this.champDate('fin', h.precision_fin || 'jour', h.date_fin)}</div>
          </div>
          <label class="switch"><span>Toujours en cours<small>Maladie chronique, traitement au long cours…</small></span><input type="checkbox" name="en_cours" ${h.en_cours === 'oui' ? 'checked' : ''}><span class="track"></span></label>
          <p class="hint" id="h-calc"></p>
        </fieldset>
        ${ta('diagnostic', 'Diagnostic', 'ex. Appendicite aiguë')}
        ${ta('description', 'Description', 'Ce qui s\'est passé, symptômes, circonstances…', 3)}
        ${ta('traitements', 'Traitements', 'ex. antibiotiques 7 jours, plâtre 6 semaines, kinésithérapie…')}
        <div class="grid2">
          <label>Médecin / praticien<input name="praticien" value="${UI.esc(h.praticien || '')}" placeholder="Dr …"></label>
          <label>Établissement / lieu<input name="lieu" value="${UI.esc(h.lieu || '')}" placeholder="ex. Hôpital de …"></label>
        </div>
        ${ta('suivi', 'Suivi / remarques', 'Séquelles, contrôles prévus, à surveiller…')}
        <label class="switch"><span>⭐ Événement important<small>Mis en avant dans la frise et repris dans la fiche d'urgence</small></span><input type="checkbox" name="important" ${h.important === 'oui' ? 'checked' : ''}><span class="track"></span></label>
        <div><label>Document (compte-rendu, radio, résultat…)</label><div id="pf-histo" style="margin-top:6px"></div></div>
      </form>`,
      actions: [
        { label: 'Annuler', cls: 'ghost' },
        { label: nouveau ? 'Ajouter' : 'Enregistrer', cls: 'primary', onClick: async () => {
          const f = UI.$('#f-histo', m.body);
          const d = UI.formData(f);
          d.date_debut = this.lireDate(f, 'debut');
          d.date_fin = d.en_cours === 'oui' ? '' : this.lireDate(f, 'fin');
          if (!d.titre) { UI.toast('Indique un titre', 'warn'); return false; }
          if (!d.date_debut) { UI.toast('Indique la date de début (au moins l\'année)', 'warn'); return false; }
          if (d.en_cours !== 'oui' && this.finIncomplete(f)) { UI.toast('Date de fin incomplète', 'warn'); return false; }
          if (d.date_fin && this.fin(d) < d.date_debut) { UI.toast('La fin doit être après le début', 'warn'); return false; }
          d.photo = await photo.value();
          if (h.id) d.id = h.id;
          const r = await App.write('saveHistorique', d);
          Store.upsert('historique', r);
          if (Pages.urgence) Pages.urgence.syncLocal();
          UI.toast(nouveau ? 'Événement ajouté' : 'Événement mis à jour');
          Sons.play('ok');
          this.render(this.el);
        } }
      ]
    });
    const f = UI.$('#f-histo', m.body);
    const photo = Photos.field(UI.$('#pf-histo', m.body), h.photo || '', { nom: 'historique_' + (h.titre || 'evenement') });

    const maj = () => {
      this.majChampDate(f, 'debut');
      this.majChampDate(f, 'fin');
      const enCours = f.en_cours.checked;
      UI.$('[data-bloc-fin]', f).classList.toggle('desactive', enCours);
      UI.$$('[data-bloc-fin] select, [data-bloc-fin] input', f).forEach(i => { i.disabled = enCours; });
      const deb = this.lireDate(f, 'debut'), fin = enCours ? '' : this.lireDate(f, 'fin');
      const tmp = { date_debut: deb, date_fin: fin, en_cours: enCours ? 'oui' : 'non', precision_debut: f.precision_debut.value, precision_fin: f.precision_fin.value };
      UI.$('#h-calc', f).innerHTML = !deb ? 'La date de début peut être précise, au mois ou seulement à l\'année.'
        : (!fin && !enCours) ? 'Sans date de fin : événement ponctuel (consultation, examen, vaccin…).'
        : (fin && this.fin(tmp) < deb) ? '<span class="form-error">La fin est avant le début.</span>'
        : `Durée : <b>${UI.esc(this.duree(tmp))}</b>`;
    };
    // Garde les 3 saisies cohérentes quand on change de précision
    ['debut', 'fin'].forEach(nom => {
      const box = UI.$(`[data-champ=${nom}]`, f);
      box.addEventListener('input', e => {
        if (e.target.dataset.p === 'jour' && e.target.value) {
          const [y, mm] = e.target.value.split('-');
          UI.$('[data-p=annee]', box).value = y;
          UI.$('[data-p=mois]', box).value = mm;
        } else if (e.target.dataset.p === 'mois' || e.target.dataset.p === 'annee') {
          const y = UI.$('[data-p=annee]', box).value, mm = UI.$('[data-p=mois]', box).value || '01';
          if (/^\d{4}$/.test(y)) UI.$('[data-p=jour]', box).value = `${y}-${mm}-01`;
        }
      });
    });
    f.addEventListener('input', maj);
    f.addEventListener('change', maj);
    maj();
  },

  /** Vrai si l'utilisateur a commencé une date de fin sans la compléter. */
  finIncomplete(f) {
    const box = UI.$('[data-champ=fin]', f);
    const touche = UI.$('[data-p=jour]', box).value || UI.$('[data-p=mois]', box).value || UI.$('[data-p=annee]', box).value;
    return !!touche && !this.lireDate(f, 'fin');
  },

  /* ---------- Image de la frise (PDF) ---------- */
  image(list) {
    if (!list.length) return null;
    const W = 1600, PAD = 24, AXE = 40, LIGNE = 32;
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    const police = '600 15px Helvetica, Arial, sans-serif';
    ctx.font = police;
    const ans0 = (() => {
      const deb = list.map(h => h.date_debut).sort()[0];
      const fin = list.map(h => this.fin(h) || h.date_debut).sort().pop();
      return Math.max(Number(fin.slice(0, 4)), new Date().getFullYear()) - Number(deb.slice(0, 4)) + 1;
    })();
    const L = this.disposer(list, (W - 2 * PAD) / ans0, t => ctx.measureText(t).width, PAD);
    const H = AXE + L.nbLignes * LIGNE + 16;
    c.width = Math.ceil(Math.max(W, L.total));
    c.height = H;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);

    // Axe
    const pas = this.pasAnnees(L.pxParAn);
    ctx.font = '700 14px Helvetica, Arial, sans-serif';
    ctx.textBaseline = 'middle';
    for (let y = L.y0; y <= L.y1 + 1; y++) {
      if ((y - L.y0) % pas && y !== L.y1 + 1) continue;
      const xi = L.x(`${y}-01-01`);
      ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(xi, 28); ctx.lineTo(xi, H); ctx.stroke();
      if (y <= L.y1) { ctx.fillStyle = '#4b5563'; ctx.fillText(String(y), xi + 4, 16); }
    }
    const xa = L.x(UI.today());
    ctx.strokeStyle = '#c81e1e'; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(xa, 28); ctx.lineTo(xa, H); ctx.stroke(); ctx.setLineDash([]);

    // Événements
    ctx.font = police;
    L.items.forEach(it => {
      const y = AXE + it.ligne * LIGNE + LIGNE / 2;
      const col = it.t.c;
      if (it.pt) {
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(it.x1, y, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111827'; ctx.fillText(it.label, it.x1 + 12, y);
      } else {
        const w = it.x2 - it.x1;
        ctx.fillStyle = col + '40';
        ctx.fillRect(it.x1, y - 12, w, 24);
        ctx.fillStyle = col;
        ctx.fillRect(it.x1, y - 12, 4, 24);
        if (it.h.en_cours === 'oui') {
          ctx.beginPath(); ctx.moveTo(it.x2, y - 12); ctx.lineTo(it.x2 + 10, y); ctx.lineTo(it.x2, y + 12); ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = '#111827';
        ctx.fillText(it.label, it.dedans ? it.x1 + 9 : it.x2 + (it.h.en_cours === 'oui' ? 14 : 6), y);
      }
    });
    return { url: c.toDataURL('image/png'), ratio: c.height / c.width };
  },

  /** Lignes du tableau PDF (ordre chronologique). */
  lignesPdf(list) {
    return list.slice().sort((a, b) => a.date_debut.localeCompare(b.date_debut)).map(h => {
      const d = this.duree(h);
      return [this.periode(h) + (d ? ` (${d})` : ''), this.type(h).label,
        (h.important === 'oui' ? '* ' : '') + h.titre + ([h.praticien, h.lieu].filter(Boolean).length ? '\n' + [h.praticien, h.lieu].filter(Boolean).join(' - ') : ''),
        h.diagnostic || '', h.traitements || ''];
    });
  },

  pdf() {
    const list = this.filtres();
    if (!list.length) { UI.toast('Rien à exporter', 'warn'); return; }
    UI.loader(true);
    setTimeout(() => {
      try {
        const img = this.image(list);
        const nom = UI.nomComplet(S.viewing);
        Export.pdf(`historique-medical_${Export.slug(nom)}_${UI.today()}.pdf`, 'Historique médical',
          `${nom} · ${list.length} événement${list.length > 1 ? 's' : ''}${this.filtre || this.q || this.importants ? ' (filtrés)' : ''} · exporté le ${UI.fmtDT(UI.nowDT())}`, [
            { titre: 'Frise chronologique', image: img && img.url, imageRatio: img && img.ratio },
            { titre: 'Détail des événements (* = important)', headers: ['Période', 'Type', 'Événement', 'Diagnostic', 'Traitements'], rows: this.lignesPdf(list),
              colStyles: { 0: { cellWidth: 34 }, 1: { cellWidth: 26 } } }
          ]);
      } catch (e) { console.error(e); UI.toast('Erreur lors de la création du PDF', 'error'); }
      finally { UI.loader(false); }
    }, 30);
  }
};
