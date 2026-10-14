/**
 * MA SANTÉ — Sons générés dans le navigateur (Web Audio, aucun fichier)
 * Chaque thème de saison a sa propre petite mélodie de validation.
 */
const Sons = {
  enabled: true,
  ctx: null,

  MELODIES: {
    aucune:    { wave: 'sine',     notes: [660, 880],            dur: 0.12 },
    halloween: { wave: 'square',   notes: [392, 370, 311, 247],  dur: 0.14, vol: 0.07 },
    noel:      { wave: 'triangle', notes: [784, 988, 1175, 1568], dur: 0.11 },
    paques:    { wave: 'sine',     notes: [523, 659, 784, 1047], dur: 0.10 },
    printemps: { wave: 'sine',     notes: [587, 740, 880],       dur: 0.12 },
    ete:       { wave: 'triangle', notes: [659, 831, 988],       dur: 0.11 },
    automne:   { wave: 'triangle', notes: [440, 554, 659],       dur: 0.14 },
    hiver:     { wave: 'sine',     notes: [1047, 1319, 1568],    dur: 0.10 }
  },

  context() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },

  tone(ctx, freq, start, dur, wave = 'sine', vol = 0.12) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = wave;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(ctx.destination);
    o.start(start);
    o.stop(start + dur + 0.02);
  },

  play(kind = 'ok', force = false) {
    if (!this.enabled && !force) return;
    const ctx = this.context();
    if (!ctx) return;
    const t = ctx.currentTime + 0.01;
    if (kind === 'alerte') {
      for (let i = 0; i < 3; i++) {
        this.tone(ctx, 880, t + i * 0.32, 0.14, 'square', 0.08);
        this.tone(ctx, 660, t + i * 0.32 + 0.15, 0.14, 'square', 0.08);
      }
      return;
    }
    if (kind === 'clic') { this.tone(ctx, 520, t, 0.05, 'sine', 0.06); return; }
    const m = this.MELODIES[Saisons.current || 'aucune'] || this.MELODIES.aucune;
    m.notes.forEach((f, i) => this.tone(ctx, f, t + i * m.dur * 0.9, m.dur * 1.6, m.wave, m.vol || 0.12));
  }
};
