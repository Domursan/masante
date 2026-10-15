/**
 * MA SANTÉ — Utilitaires d'interface (dates, icônes, modales, toasts…)
 */
const UI = (() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Dates (format interne : yyyy-MM-dd / yyyy-MM-ddTHH:mm) ---------- */
  const pad = n => String(n).padStart(2, '0');
  const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const isoDT = d => `${isoDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const today = () => isoDate(new Date());
  const nowDT = () => isoDT(new Date());
  const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const parse = s => {
    if (!s) return null;
    const [d, t = '00:00'] = String(s).split('T');
    const [y, m, j] = d.split('-').map(Number);
    const [h, mi] = t.split(':').map(Number);
    if (!y || !m || !j) return null;
    return new Date(y, m - 1, j, h || 0, mi || 0);
  };
  const fmtD = s => { const d = parse(s); return d ? d.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'; };
  const fmtT = s => { const d = parse(s); return d ? d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' }) : ''; };
  const fmtDT = s => s ? `${fmtD(s)} ${fmtT(s)}` : '—';
  const fmtLong = s => { const d = parse(s); return d ? d.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' }) : ''; };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return isoDate(d); };
  const daysBetween = (a, b) => Math.round((parse(b.slice(0, 10)) - parse(a.slice(0, 10))) / 864e5);
  const num = v => Number(String(v ?? '').replace(',', '.'));

  /* ---------- Ordonnances : validité ---------- */
  function finValidite(o) {
    if (o.type_validite === 'duree') {
      if (!o.date_ordonnance || !o.duree) return '';
      const d = parse(o.date_ordonnance.slice(0, 10));
      const n = Number(o.duree) || 0;
      if (o.duree_unite === 'jours') d.setDate(d.getDate() + n);
      else if (o.duree_unite === 'semaines') d.setDate(d.getDate() + 7 * n);
      else if (o.duree_unite === 'annees') d.setFullYear(d.getFullYear() + n);
      else d.setMonth(d.getMonth() + n);
      return isoDate(d);
    }
    return (o.date_fin || '').slice(0, 10);
  }
  function statut(o) {
    const fin = finValidite(o);
    if (!fin) return { k: 'na', label: 'Sans échéance', cls: '', left: Infinity, fin: '' };
    const left = daysBetween(today(), fin);
    const seuil = Number((typeof S !== 'undefined' && S.params.notif_jours) || 15);
    if (left < 0) return { k: 'expiree', label: 'Expirée', cls: 'danger', left, fin };
    if (left <= seuil) return { k: 'bientot', label: left === 0 ? "Expire aujourd'hui" : `Expire dans ${left} j`, cls: 'warn', left, fin };
    return { k: 'valide', label: 'Valide', cls: 'ok', left, fin };
  }
  /* ---------- Stock ---------- */
  function qty(v) {
    v = String(v ?? '').trim().replace(',', '.');
    if (!v) return 0;
    const frac = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };
    if (frac[v] != null) return frac[v];
    const m = v.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (m) return Number(m[1]) / Number(m[2]);
    const n = Number(v);
    return isFinite(n) && n > 0 ? n : 0;
  }
  /** null si le stock n'est pas suivi. */
  function stockInfo(o) {
    if (o.stock === '' || o.stock == null) return null;
    const s = Number(o.stock);
    const parJourQte = ['matin', 'midi', 'soir', 'nuit'].reduce((a, m) => a + qty(o[m]), 0);
    const parJour = o.categorie !== 'reserve' && parJourQte > 0;
    const defJours = Number((typeof S !== 'undefined' && S.params.stock_alerte_jours) || 7);
    const seuil = o.stock_seuil !== '' && o.stock_seuil != null ? Number(o.stock_seuil) : (parJour ? defJours : 2 * (qty(o.dose_reserve) || 1));
    const jours = parJour ? Math.floor(s / parJourQte) : null;
    const bas = parJour ? jours <= seuil : s <= seuil;
    const fmt = n => (Math.round(n * 100) / 100).toString().replace('.', ',');
    const label = s <= 0 ? 'Stock épuisé' : `Stock : ${fmt(s)}${parJour ? ` · ≈ ${jours} j` : ''}`;
    const fin = parJour ? isoDate(new Date(Date.now() + jours * 864e5)) : '';
    return { stock: s, jours, parJour, seuil, bas, vide: s <= 0, label, fin, cls: s <= 0 ? 'danger' : bas ? 'warn' : 'ok', parJourQte };
  }
  const stockBadge = o => { const i = stockInfo(o); return i ? badge(i.cls, i.label) : ''; };

  const badgeIcon = { ok: 'check', warn: 'alert', danger: 'x', '': 'clock' };
  const badge = (cls, label) => `<span class="badge ${cls}">${icon(badgeIcon[cls] || 'clock')}${esc(label)}</span>`;

  /* ---------- Icônes (SVG en ligne) ---------- */
  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
    pill: '<rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="m8.5 8.5 7 7"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
    note: '<path d="M4 4h16v11l-5 5H4z"/><path d="M15 20v-5h5M8 9h8M8 13h4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v12h14V8M10 12h4"/>',
    restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    pin: '<path d="M12 17v5M8 3h8l-1 6 3 3v2H6v-2l3-3z"/>',
    sound: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
    alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    heart: '<path d="M12 20s-7.5-4.6-9.3-9.2C1.5 7.4 3.7 4 7.2 4c2 0 3.6 1.1 4.8 2.8C13.2 5.1 14.8 4 16.8 4c3.5 0 5.7 3.4 4.5 6.8C19.5 15.4 12 20 12 20z"/>',
    cross: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
    report: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 17v-3M12 17v-6M16 17v-4"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    timeline: '<path d="M3 12h18"/><circle cx="7" cy="12" r="2"/><circle cx="17" cy="12" r="2"/><path d="M12 5v4M12 15v4M10 5h4M10 19h4"/>',
    minus: '<path d="M5 12h14"/>',
    grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-2 0-1.4-1-1.6-1-3 0-1 .8-2 2-2h2a4 4 0 0 0 4-4c0-3.9-4-7-9-7z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'
  };
  const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  /* ---------- Toasts ---------- */
  function toast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `${icon(type === 'error' ? 'x' : type === 'warn' ? 'alert' : 'check')}<span>${esc(msg)}</span>`;
    $('#toasts').appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, type === 'error' ? 5000 : 3000);
  }

  /* ---------- Chargement ---------- */
  let loadCount = 0, loadTimer = null;
  function loader(on) {
    loadCount = Math.max(0, loadCount + (on ? 1 : -1));
    clearTimeout(loadTimer);
    if (loadCount > 0) loadTimer = setTimeout(() => $('#loader').classList.remove('hidden'), 250);
    else $('#loader').classList.add('hidden');
  }

  /* ---------- Modales ---------- */
  function modal({ title, body, actions = [], wide = false, cls = '', onClose }) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''} ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head"><h2>${title}</h2><button class="icon-btn" data-close aria-label="Fermer">${icon('x')}</button></div>
      <div class="modal-body"></div><div class="modal-foot"></div></div>`;
    const b = $('.modal-body', wrap);
    if (typeof body === 'string') b.innerHTML = body; else if (body) b.appendChild(body);
    const foot = $('.modal-foot', wrap);
    const onKey = e => { if (e.key === 'Escape') close(); };
    const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); document.body.classList.toggle('modal-open', !!$('.modal-wrap')); onClose && onClose(); };
    const api = { el: wrap, body: b, close };
    actions.forEach(a => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn ' + (a.cls || '');
      btn.innerHTML = a.label;
      btn.onclick = async () => {
        if (!a.onClick) return close();
        btn.disabled = true;
        try { const r = await a.onClick(api); if (r !== false) close(); }
        catch (e) { /* déjà signalé */ }
        finally { btn.disabled = false; }
      };
      foot.appendChild(btn);
    });
    if (!actions.length) foot.remove();
    wrap.addEventListener('mousedown', e => { if (e.target === wrap) close(); });
    $$('[data-close]', wrap).forEach(x => x.onclick = close);
    document.addEventListener('keydown', onKey);
    $('#modal-root').appendChild(wrap);
    document.body.classList.add('modal-open');
    if (matchMedia('(pointer: fine)').matches) setTimeout(() => { const f = $('input:not([type=hidden]):not([type=radio]):not([type=checkbox]),select,textarea', b); f && f.focus(); }, 60);
    return api;
  }

  function confirm(message, { titre = 'Confirmer', ok = 'Confirmer', danger = false } = {}) {
    return new Promise(resolve => {
      let done = false;
      modal({
        title: esc(titre), body: `<p>${esc(message)}</p>`,
        actions: [
          { label: 'Annuler', cls: 'ghost' },
          { label: esc(ok), cls: danger ? 'danger' : 'primary', onClick: () => { done = true; resolve(true); } }
        ],
        onClose: () => { if (!done) resolve(false); }
      });
    });
  }

  function formData(form) {
    const o = {};
    new FormData(form).forEach((v, k) => { o[k] = typeof v === 'string' ? v.trim() : v; });
    $$('input[type=checkbox][name]', form).forEach(c => { o[c.name] = c.checked ? 'oui' : 'non'; });
    return o;
  }

  const empty = (texte, action = '') => `<div class="empty">${icon('heart', 'big')}<p>${esc(texte)}</p>${action}</div>`;

  function avatarHtml(u, size = 36) {
    const ini = ((u.prenom || '')[0] || (u.identifiant || '?')[0] || '?') + ((u.nom || '')[0] || '');
    return `<span class="av" style="--s:${size}px" data-photo="${esc(u.photo || '')}"><span>${esc(ini.toUpperCase())}</span></span>`;
  }
  function fillAvatars(root = document) {
    $$('.av[data-photo]', root).forEach(a => {
      const ref = a.dataset.photo;
      if (!ref) return;
      Photos.src(ref).then(src => { if (src) a.innerHTML = `<img src="${esc(src)}" alt="">`; }).catch(() => {});
    });
  }
  const nomComplet = u => [u.prenom, u.nom].filter(Boolean).join(' ') || u.identifiant;

  return {
    $, $$, esc, pad, isoDate, isoDT, today, nowDT, nowTime, parse, fmtD, fmtT, fmtDT, fmtLong, addDays, daysBetween, num,
    finValidite, statut, badge, qty, stockInfo, stockBadge, icon, toast, loader, modal, confirm, formData, empty, avatarHtml, fillAvatars, nomComplet
  };
})();

const Pages = {};
