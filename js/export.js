/**
 * MA SANTÉ — Exports CSV (Excel) et PDF
 */
const Export = {
  slug(s) {
    return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  },

  download(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  },

  /** CSV séparé par ";" avec BOM UTF-8 : s'ouvre directement dans Excel (réglages suisses/français). */
  csv(filename, headers, rows) {
    const cell = v => { v = String(v ?? ''); return /[;"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const txt = '\ufeff' + [headers, ...rows].map(r => r.map(cell).join(';')).join('\r\n');
    this.download(new Blob([txt], { type: 'text/csv;charset=utf-8' }), filename);
  },

  /**
   * PDF A4. sections = [{ titre, image (dataURL du graphique, optionnel), headers, rows }]
   */
  pdf(filename, titre, sousTitre, sections) {
    if (!window.jspdf) { UI.toast('Module PDF non chargé', 'error'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 14;
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--p-print').trim() || '#2563eb';

    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(accent);
    doc.text(this.pdfSafe(S.params.nom_site || 'Ma Santé'), M, 18);
    doc.setFontSize(13); doc.setTextColor('#172033');
    doc.text(this.pdfSafe(titre), M, 26);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor('#5b6478');
    doc.text(this.pdfSafe(sousTitre), M, 32);
    let y = 40;

    sections.forEach((s, i) => {
      if (i > 0 && y > H - 60) { doc.addPage(); y = 18; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor('#172033');
      doc.text(this.pdfSafe(s.titre), M, y); y += 4;
      if (s.texte) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor('#172033');
        const lines = doc.splitTextToSize(this.pdfSafe(s.texte), W - 2 * M);
        lines.forEach(l => { if (y > H - 16) { doc.addPage(); y = 18; } doc.text(l, M, y + 4); y += 4.6; });
        y += 4;
      }
      if (s.qr && typeof qrcode !== 'undefined') {
        let t = s.qr;
        if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
        else t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x00-\x7F]/g, '');
        const qr = qrcode(0, 'L'); qr.addData(t, 'Byte'); qr.make();
        const n = qr.getModuleCount(), size = 55, c = size / n;
        if (y + size > H - 16) { doc.addPage(); y = 18; }
        doc.setFillColor('#000000');
        for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) doc.rect(M + k * c, y + 2 + r * c, c, c, 'F');
        y += size + 8;
      }
      if (s.image) {
        const ratio = s.imageRatio || 0.42;
        let iw = W - 2 * M, ih = iw * ratio;
        if (ih > H - 40) { ih = H - 40; iw = ih / ratio; }
        if (y + ih > H - 20) { doc.addPage(); y = 18; }
        doc.addImage(s.image, 'PNG', M, y, iw, ih); y += ih + 4;
      }
      if (s.rows && s.rows.length) {
        doc.autoTable({
          startY: y, head: s.headers && s.headers.some(Boolean) ? [s.headers.map(h => this.pdfSafe(h))] : [], body: s.rows.map(r => r.map(c => this.pdfSafe(c))),
          columnStyles: s.colStyles || {},
          margin: { left: M, right: M }, styles: { fontSize: 8.5, cellPadding: 1.8 },
          headStyles: { fillColor: accent, textColor: '#ffffff' }, alternateRowStyles: { fillColor: '#f4f6fb' }
        });
        y = doc.lastAutoTable.finalY + 10;
      } else { y += 8; }
    });

    const n = doc.getNumberOfPages();
    for (let p = 1; p <= n; p++) {
      doc.setPage(p); doc.setFontSize(8); doc.setTextColor('#9aa5b8');
      doc.text(`${p} / ${n}`, W - M, H - 8, { align: 'right' });
    }
    doc.save(filename);
  },

  /** Les polices PDF standard ne gèrent que le Latin-1 : on remplace le reste. */
  pdfSafe(s) {
    return String(s ?? '').replace(/[≥]/g, '>=').replace(/[≤]/g, '<=').replace(/[–—]/g, '-').replace(/[’]/g, "'").replace(/→/g, '->').replace(/⭐/g, '*')
      .replace(/[^\x00-\xFF]/g, '');
  }
};
