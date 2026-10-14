/**
 * MA SANTÉ — Thèmes de saison
 * Des emojis se baladent sur tout le site (quantité et vitesse réglables par chaque utilisateur).
 * Les emojis de chaque saison sont paramétrables par l'admin (onglet Parametres : emojis_<saison>).
 * Les thèmes de saison ne changent jamais les couleurs.
 */
const Saisons = {
  current: null,
  opts: { qte: 12, vitesse: 4 },
  items: [],
  raf: null,
  last: 0,

  LISTE: {
    halloween: { nom: 'Halloween', e: ['🎃', '👻', '🦇', '🕷️', '🍬', '🕸️'] },
    noel:      { nom: 'Noël',      e: ['🎄', '🎅', '🎁', '⭐', '❄️', '🔔'] },
    paques:    { nom: 'Pâques',    e: ['🐣', '🥚', '🐰', '🌷', '🍫', '🐥'] },
    printemps: { nom: 'Printemps', e: ['🌸', '🌷', '🐝', '🌱', '🦋', '🌼'] },
    ete:       { nom: 'Été',       e: ['☀️', '🌻', '🍉', '🏖️', '🍦', '🌴'] },
    automne:   { nom: 'Automne',   e: ['🍂', '🍁', '🍄', '🌰', '🍎', '🦔'] },
    hiver:     { nom: 'Hiver',     e: ['❄️', '⛄', '🧣', '☃️', '🌨️', '🧤'] }
  },

  /** Découpe une saisie libre ("🎃 👻🦇, 🍬") en emojis individuels. */
  parse(str) {
    str = String(str || '').trim();
    if (!str) return [];
    const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('fr', { granularity: 'grapheme' }) : null;
    const out = [];
    str.split(/[\s,;]+/).filter(Boolean).forEach(t => {
      if (seg) for (const s of seg.segment(t)) { if (s.segment.trim()) out.push(s.segment); }
      else out.push(t);
    });
    return out.slice(0, 40);
  },

  /** Emojis d'une saison : ceux de l'admin s'ils existent, sinon ceux par défaut. */
  liste(k) {
    const p = (typeof S !== 'undefined' && S.params) || {};
    const custom = this.parse(p['emojis_' + k]);
    return custom.length ? custom : this.LISTE[k].e;
  },

  paques(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mois = Math.floor((h + l - 7 * m + 114) / 31), jour = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, mois - 1, jour);
  },

  detect(d = new Date()) {
    const m = d.getMonth() + 1, j = d.getDate(), md = m * 100 + j;
    const p = this.paques(d.getFullYear());
    const diff = Math.round((new Date(d.getFullYear(), m - 1, j) - p) / 864e5);
    if (diff >= -7 && diff <= 1) return 'paques';
    if (md >= 1015 && md <= 1101) return 'halloween';
    if (md >= 1201 && md <= 1226) return 'noel';
    if (md >= 320 && md <= 620) return 'printemps';
    if (md >= 621 && md <= 922) return 'ete';
    if (md >= 923 && md <= 1220) return 'automne';
    return 'hiver';
  },

  apply(choix = 'auto', opts = {}) {
    const k = choix === 'aucune' ? null : (choix === 'auto' || !this.LISTE[choix] ? this.detect() : choix);
    this.current = k;
    const num = (v, def, min, max) => { const n = Number(v); return isFinite(n) && v !== '' && v != null ? Math.min(max, Math.max(min, n)) : def; };
    this.opts = { qte: num(opts.qte, 12, 0, 60), vitesse: num(opts.vitesse, 4, 0, 10) };
    UI.$$('.saison-emoji').forEach(s => { s.textContent = k ? this.liste(k)[0] : ''; });
    this.start();
  },

  emoji() {
    if (!this.current) return '';
    const l = this.liste(this.current);
    return l[Math.floor(Math.random() * l.length)];
  },

  /** Vitesse en pixels / seconde selon le réglage 0–10. */
  pxs() {
    const v = this.opts.vitesse;
    return v <= 0 ? 0 : 6 * Math.pow(v, 1.45);
  },

  start() {
    this.stop();
    const box = UI.$('#saison-deco');
    if (!box) return;
    box.innerHTML = '';
    this.items = [];
    if (!this.current || !this.opts.qte) return;

    const W = innerWidth, H = innerHeight;
    const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const l = this.liste(this.current);
    for (let i = 0; i < this.opts.qte; i++) {
      const el = document.createElement('span');
      el.textContent = l[i % l.length];
      const size = 18 + Math.random() * 18;
      el.style.fontSize = size + 'px';
      el.style.opacity = (0.45 + Math.random() * 0.4).toFixed(2);
      box.appendChild(el);
      const it = {
        el, size,
        x: Math.random() * (W - size), y: Math.random() * (H - size),
        a: Math.random() * Math.PI * 2,               // direction
        k: 0.6 + Math.random() * 0.8,                 // facteur de vitesse individuel
        rot: Math.random() * 360, vr: (Math.random() - 0.5) * 60,
        ph: Math.random() * Math.PI * 2                // phase d'oscillation
      };
      this.items.push(it);
      this.draw(it);
    }
    if (reduit || this.pxs() === 0) return; // immobiles
    this.last = performance.now();
    const loop = t => { this.tick(t); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  },

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
  },

  draw(it) {
    const wob = Math.sin(it.ph) * 6;
    it.el.style.transform = `translate3d(${it.x.toFixed(1)}px, ${(it.y + wob).toFixed(1)}px, 0) rotate(${it.rot.toFixed(0)}deg)`;
  },

  tick(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    const W = innerWidth, H = innerHeight, v = this.pxs();
    for (const it of this.items) {
      it.a += (Math.random() - 0.5) * 1.6 * dt;      // dérive douce de la trajectoire
      const sp = v * it.k;
      it.x += Math.cos(it.a) * sp * dt;
      it.y += Math.sin(it.a) * sp * dt;
      const maxX = W - it.size, maxY = H - it.size;
      if (it.x < 0) { it.x = 0; it.a = Math.PI - it.a; }
      else if (it.x > maxX) { it.x = maxX; it.a = Math.PI - it.a; }
      if (it.y < 0) { it.y = 0; it.a = -it.a; }
      else if (it.y > maxY) { it.y = maxY; it.a = -it.a; }
      it.rot += it.vr * dt * (v / 40);
      it.ph += dt * (1 + v / 40);
      this.draw(it);
    }
  },

  /** Petite pluie d'emojis à partir d'un rectangle (bouton validé). */
  burst(rect) {
    if (!this.current || !rect || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    for (let i = 0; i < 9; i++) {
      const s = document.createElement('span');
      s.className = 'burst';
      s.textContent = this.emoji();
      const a = (Math.PI * 2 * i) / 9 + Math.random() * 0.5;
      const r = 50 + Math.random() * 40;
      s.style.left = cx + 'px';
      s.style.top = cy + 'px';
      s.style.setProperty('--dx', Math.cos(a) * r + 'px');
      s.style.setProperty('--dy', Math.sin(a) * r - 30 + 'px');
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 1000);
    }
  }
};

// Pause quand l'onglet est caché, reprise au retour ; recadrage au redimensionnement
document.addEventListener('visibilitychange', () => {
  if (document.hidden) Saisons.stop();
  else if (Saisons.items.length && !Saisons.raf && Saisons.pxs() > 0 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    Saisons.last = performance.now();
    const loop = t => { Saisons.tick(t); Saisons.raf = requestAnimationFrame(loop); };
    Saisons.raf = requestAnimationFrame(loop);
  }
});
window.addEventListener('resize', () => {
  Saisons.items.forEach(it => {
    it.x = Math.min(it.x, innerWidth - it.size);
    it.y = Math.min(it.y, innerHeight - it.size);
    Saisons.draw(it);
  });
});