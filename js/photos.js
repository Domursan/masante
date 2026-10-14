/**
 * MA SANTÉ — Photos : compression, upload (Drive privé) ou lien, affichage, agrandissement
 * Référence : "drive:<id>" (fichier Drive privé, lu via l'API) ou "https://…" (lien externe).
 */
const Photos = {
  cache: {},

  async src(ref) {
    if (!ref) return '';
    if (/^(https?:|data:)/i.test(ref)) return ref;
    if (ref.startsWith('drive:')) {
      if (!this.cache[ref]) {
        this.cache[ref] = API.call('photo', { ref }).then(r => r.dataUrl).catch(e => { delete this.cache[ref]; throw e; });
      }
      return this.cache[ref];
    }
    return '';
  },

  async fill(img, ref) {
    try { const s = await this.src(ref); if (s) { img.src = s; img.hidden = false; } } catch (e) { img.alt = 'Image indisponible'; }
  },

  compress(file, max = 1600, q = 0.82) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) return reject(new Error('Choisis une image'));
      const r = new FileReader();
      r.onerror = () => reject(new Error('Lecture impossible'));
      r.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Image illisible'));
        img.onload = () => {
          const k = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * k);
          c.height = Math.round(img.height * k);
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', q));
        };
        img.src = r.result;
      };
      r.readAsDataURL(file);
    });
  },

  /**
   * Champ photo : importer (galerie / appareil photo), utiliser un lien, retirer.
   * Retourne { value: async () => ref }  (upload effectué au moment de l'enregistrement).
   */
  field(container, ref = '', { nom = 'photo', rond = false, self = false } = {}) {
    let current = ref || '';
    let pending = null; // dataUrl à téléverser
    container.innerHTML = `
      <div class="photo-field ${rond ? 'rond' : ''}">
        <div class="pf-preview"><img alt="" hidden><span class="pf-empty">${UI.icon('image')}<small>Aucune image</small></span></div>
        <div class="pf-side">
          <div class="pf-actions">
            <label class="btn sm">${UI.icon('camera')}Importer<input type="file" accept="image/*" hidden></label>
            <button type="button" class="btn sm" data-pf="lien">${UI.icon('link')}Lien</button>
            <button type="button" class="btn sm ghost" data-pf="retirer">${UI.icon('trash')}Retirer</button>
          </div>
          <input type="url" class="pf-url hidden" placeholder="https://…">
        </div>
      </div>`;
    const img = UI.$('img', container), emptyEl = UI.$('.pf-empty', container), url = UI.$('.pf-url', container);
    const show = src => { if (src) { img.src = src; img.hidden = false; emptyEl.hidden = true; } else { img.hidden = true; img.removeAttribute('src'); emptyEl.hidden = false; } };
    if (current) { emptyEl.hidden = true; this.src(current).then(show).catch(() => show('')); }
    if (/^https?:/i.test(current)) { url.value = current; }

    UI.$('input[type=file]', container).onchange = async e => {
      const f = e.target.files[0];
      if (!f) return;
      try { pending = await this.compress(f); show(pending); url.classList.add('hidden'); url.value = ''; }
      catch (err) { UI.toast(err.message, 'error'); }
    };
    UI.$('[data-pf=lien]', container).onclick = () => { url.classList.toggle('hidden'); url.focus(); };
    url.oninput = () => { pending = null; show(/^https?:\/\//i.test(url.value) ? url.value : ''); };
    UI.$('[data-pf=retirer]', container).onclick = () => { pending = null; current = ''; url.value = ''; show(''); };

    return {
      value: async () => {
        if (pending) {
          const r = await App.write('uploadPhoto', { dataUrl: pending, nom }, { self });
          this.cache[r.photo] = Promise.resolve(pending);
          current = r.photo; pending = null;
          return current;
        }
        if (url.value && /^https?:\/\//i.test(url.value)) return url.value.trim();
        if (!img.hidden && current) return current;
        return '';
      }
    };
  },

  async lightbox(ref) {
    const m = UI.modal({ title: 'Image', body: '<div class="lightbox"><div class="spinner"></div></div>', wide: true, cls: 'lb' });
    try {
      const s = await this.src(ref);
      UI.$('.lightbox', m.body).innerHTML = `<img src="${UI.esc(s)}" alt="">`;
    } catch (e) {
      UI.$('.lightbox', m.body).innerHTML = '<p class="muted">Image indisponible.</p>';
    }
  }
};
