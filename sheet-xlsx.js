'use strict';
/* ============================================================
   Tableur : import / export Excel (.xlsx) — ZIP + OOXML sans dépendance
   ============================================================ */

/* ---------- ZIP ---------- */
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const enc = new TextEncoder(), dec = new TextDecoder();

function zipper(fichiers) {
  const parts = [], central = [];
  let offset = 0;
  const now = new Date(), dt = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff, dd = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;
  for (const [nom, contenu] of Object.entries(fichiers)) {
    const n = enc.encode(nom), data = typeof contenu === 'string' ? enc.encode(contenu) : contenu, crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, dt, true); h.setUint16(12, dd, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, n.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), n, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, dt, true); c.setUint16(14, dd, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, n.length, true); c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), n);
    offset += 30 + n.length + data.length;
  }
  const taille = central.reduce((s, x) => s + x.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, Object.keys(fichiers).length, true); e.setUint16(10, Object.keys(fichiers).length, true); e.setUint32(12, taille, true); e.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

async function inflater(u8) {
  if (typeof DecompressionStream === 'undefined') throw new Error('Ce navigateur ne sait pas décompresser les fichiers Excel (DecompressionStream manquant).');
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([u8]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function dezipper(buffer) {
  const u8 = new Uint8Array(buffer), dv = new DataView(buffer), fichiers = {};
  let e = u8.length - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('Ce fichier n’est pas un classeur Excel valide.');
  const nb = dv.getUint16(e + 10, true);
  let p = dv.getUint32(e + 16, true);
  for (let i = 0; i < nb; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const methode = dv.getUint16(p + 10, true), tc = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const nom = dec.decode(u8.subarray(p + 46, p + 46 + nl));
    const ln = dv.getUint16(off + 26, true), lx = dv.getUint16(off + 28, true), debut = off + 30 + ln + lx;
    const brut = u8.subarray(debut, debut + tc);
    if (/\.(xml|rels)$/i.test(nom)) fichiers[nom] = dec.decode(methode === 0 ? brut : await inflater(brut));
    p += 46 + nl + xl + cl;
  }
  return fichiers;
}

/* ---------- Outils XML ---------- */
const xe = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const argb = (hex) => 'FF' + hex.replace('#', '').toUpperCase().padStart(6, '0').slice(-6);
const luminance = (hex) => { const [r, g, b] = hexRgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
const parseXml = (t) => new DOMParser().parseFromString(t, 'application/xml');
const tags = (node, nom) => [...node.getElementsByTagNameNS('*', nom)];
const enfant = (node, nom) => [...node.children].find((x) => x.localName === nom);

/* ---------- Export ---------- */
function codeExcel(s) {
  switch (s.fmt) {
    case 'n': return CODES.n(s.dec ?? 2);
    case 'pct': return CODES.pct(s.dec ?? 0);
    case 'eur': return CODES.eur(s.dec ?? 2);
    case 'date': return 'dd/mm/yyyy';
    case 'datel': return 'dddd d mmmm yyyy';
    case 'heure': return 'hh:mm:ss';
    case 'sci': return '0.00E+00';
    case 'txt': return '@';
    case 'code': return s.code || 'General';
    default: return s.dec != null ? CODES.n(s.dec) : null;
  }
}

async function exporterXlsx() {
  finirEdition(true);
  const T = tableur();
  const ctx = nouveauCtx(T);
  evaluerTout(ctx);
  const polices = [], remplis = [], bords = [], formats = [], xfs = [];
  const index = (liste, xml) => { let i = liste.indexOf(xml); if (i < 0) { i = liste.length; liste.push(xml); } return i; };
  index(polices, '<font><sz val="11"/><name val="Calibri"/></font>');
  index(remplis, '<fill><patternFill patternType="none"/></fill>'); index(remplis, '<fill><patternFill patternType="gray125"/></fill>');
  index(bords, '<border><left/><right/><top/><bottom/><diagonal/></border>');
  xfs.push('<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>');
  const cacheXf = new Map();
  function xf(s) {
    const cle = JSON.stringify(s);
    if (cacheXf.has(cle)) return cacheXf.get(cle);
    const sombre = s.bg && luminance(s.bg) < 0.5;
    const couleur = s.c || (sombre ? '#ffffff' : null);
    const police = `<font>${s.b ? '<b/>' : ''}${s.i ? '<i/>' : ''}${s.u ? '<u/>' : ''}${s.st ? '<strike/>' : ''}<sz val="${s.fs || 11}"/>${couleur ? `<color rgb="${argb(couleur)}"/>` : ''}<name val="${xe((Object.entries(POLICES).find(([, v]) => v === s.ff) || ['Calibri'])[0])}"/></font>`;
    const rempli = s.bg ? `<fill><patternFill patternType="solid"><fgColor rgb="${argb(s.bg)}"/><bgColor indexed="64"/></patternFill></fill>` : null;
    const cote = (k, n) => (s.bd && s.bd[k] ? `<${n} style="thin"><color rgb="${argb(s.bd[k])}"/></${n}>` : `<${n}/>`);
    const bord = s.bd ? `<border>${cote('l', 'left')}${cote('r', 'right')}${cote('t', 'top')}${cote('b', 'bottom')}<diagonal/></border>` : null;
    const code = codeExcel(s);
    let nf = 0;
    if (code && code !== 'General') nf = 164 + index(formats, code);
    const al = s.al || s.va || s.wrap || s.ind ? `<alignment${s.al ? ` horizontal="${s.al}"` : ''}${s.va ? ` vertical="${s.va === 'middle' ? 'center' : s.va}"` : ''}${s.wrap ? ' wrapText="1"' : ''}${s.ind ? ` indent="${s.ind}"` : ''}/>` : '';
    const x = `<xf numFmtId="${nf}" fontId="${index(polices, police)}" fillId="${rempli ? index(remplis, rempli) : 0}" borderId="${bord ? index(bords, bord) : 0}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1"${al ? ' applyAlignment="1">' + al + '</xf>' : '/>'}`;
    const i = xfs.length;
    xfs.push(x);
    cacheXf.set(cle, i);
    return i;
  }

  const feuilles = T.feuilles.map((F, idx) => {
    completerFeuille(F);
    const z = zoneUtilisee(F);
    const lignes = {};
    for (const [a, cell] of Object.entries(F.cells)) {
      const p = parseAdr(a);
      (lignes[p.r] = lignes[p.r] || []).push({ c: p.c, cell });
    }
    // valeurs issues d'un étalement (SEQUENCE, FILTRE…) : cellules de valeurs à l'intérieur d'une formule matricielle
    for (const [k, v] of ctx.spill) { const [fid, rc] = k.split(':'); if (fid !== F.id) continue; const [r, c] = rc.split(',').map(Number); (lignes[r] = lignes[r] || []).push({ c, cell: { v: texte(v), s: {} }, spill: v }); }
    let xml = '';
    const rangs = Object.keys(lignes).map(Number).sort((a, b) => a - b);
    for (const r of rangs) {
      const hh = F.hauteurs[r];
      xml += `<row r="${r + 1}"${hh ? ` ht="${(hh * 0.75).toFixed(2)}" customHeight="1"` : ''}${F.cache.l.includes(r) ? ' hidden="1"' : ''}>`;
      lignes[r].sort((a, b) => a.c - b.c).forEach(({ c, cell, spill }) => {
        const val = spill !== undefined ? spill : valCell(ctx, F, r, c);
        const s = xf(cell.s || {});
        const ref = adr(r, c);
        const v = cell.v;
        if (spill !== undefined) {
          if (estErr(spill)) xml += `<c r="${ref}" s="${s}" t="e"><v>${xe(spill.err)}</v></c>`;
          else if (typeof spill === 'number') xml += `<c r="${ref}" s="${s}"><v>${spill}</v></c>`;
          else if (typeof spill === 'boolean') xml += `<c r="${ref}" s="${s}" t="b"><v>${spill ? 1 : 0}</v></c>`;
          else xml += `<c r="${ref}" s="${s}" t="str"><v>${xe(texte(spill))}</v></c>`;
        } else if (v[0] === '=') {
          const ancre = ctx.anchors.get(F.id + ':' + r + ',' + c);
          const f = (ancre ? `<f t="array" ref="${textePlage({ r1: r, c1: c, r2: r + ancre.h - 1, c2: c + ancre.w - 1 })}">` : '<f>') + xe(traduireFormule(v, 'xl').slice(1)) + '</f>';
          if (estErr(val)) xml += `<c r="${ref}" s="${s}" t="e">${f}<v>${xe(val.err)}</v></c>`;
          else if (typeof val === 'number') xml += `<c r="${ref}" s="${s}">${f}<v>${val}</v></c>`;
          else if (typeof val === 'boolean') xml += `<c r="${ref}" s="${s}" t="b">${f}<v>${val ? 1 : 0}</v></c>`;
          else xml += `<c r="${ref}" s="${s}" t="str">${f}<v>${xe(texte(val))}</v></c>`;
        } else if (cell.l && v !== '') xml += `<c r="${ref}" s="${s}" t="str"><f>HYPERLINK("${xe(cell.l)}","${xe(v)}")</f><v>${xe(v)}</v></c>`;
        else if (v === '') xml += `<c r="${ref}" s="${s}"/>`;
        else if (typeof val === 'number') xml += `<c r="${ref}" s="${s}"><v>${val}</v></c>`;
        else if (typeof val === 'boolean') xml += `<c r="${ref}" s="${s}" t="b"><v>${val ? 1 : 0}</v></c>`;
        else xml += `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xe(v)}</t></is></c>`;
      });
      xml += '</row>';
    }
    const cols = Object.entries(F.largeurs).map(([c, w]) => `<col min="${+c + 1}" max="${+c + 1}" width="${(w / 7).toFixed(2)}" customWidth="1"${F.cache.c.includes(+c) ? ' hidden="1"' : ''}/>`).join('');
    const pane = F.gel.r || F.gel.c ? `<pane${F.gel.c ? ` xSplit="${F.gel.c}"` : ''}${F.gel.r ? ` ySplit="${F.gel.r}"` : ''} topLeftCell="${adr(F.gel.r, F.gel.c)}" activePane="${F.gel.r && F.gel.c ? 'bottomRight' : F.gel.r ? 'bottomLeft' : 'topRight'}" state="frozen"/>` : '';
    const valids = F.valids.map((v) => {
      const typ = { liste: 'list', entier: 'whole', decimal: 'decimal', date: 'date', longueur: 'textLength', perso: 'custom', case: 'list' }[v.type];
      const op = { entre: 'between', horsde: 'notBetween', egal: 'equal', diff: 'notEqual', sup: 'greaterThan', supeg: 'greaterThanOrEqual', inf: 'lessThan', infeg: 'lessThanOrEqual' }[v.op] || 'between';
      let f1 = '', f2 = '';
      if (v.type === 'liste') f1 = /^[A-Za-z$]+\$?\d+/.test(v.source.trim()) ? xe(v.source.trim()) : `"${xe(v.source.replace(/;/g, ','))}"`;
      else if (v.type === 'case') f1 = '"TRUE,FALSE"';
      else if (v.type === 'perso') f1 = xe(traduireFormule('=' + v.a.replace(/^=/, ''), 'xl').slice(1));
      else { f1 = xe(String(constante(v.a) ?? 0)); f2 = xe(String(constante(v.b) ?? 0)); }
      return `<dataValidation type="${typ}"${typ !== 'list' && typ !== 'custom' ? ` operator="${op}"` : ''} allowBlank="1" showErrorMessage="1" ${v.message ? `error="${xe(v.message)}" ` : ''}sqref="${v.range}"><formula1>${f1}</formula1>${f2 && ['between', 'notBetween'].includes(op) ? `<formula2>${f2}</formula2>` : ''}</dataValidation>`;
    }).join('');
    const fusions = F.merges.map((m) => `<mergeCell ref="${textePlage(m)}"/>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr>${F.couleur ? `<tabColor rgb="${argb(F.couleur)}"/>` : ''}</sheetPr><dimension ref="A1:${adr(Math.max(0, z.r2), Math.max(0, z.c2))}"/><sheetViews><sheetView workbookViewId="0"${idx === 0 ? ' tabSelected="1"' : ''}${F.quad ? '' : ' showGridLines="0"'} zoomScale="${F.zoom}">${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols ? `<cols>${cols}</cols>` : ''}<sheetData>${xml}</sheetData>${fusions ? `<mergeCells count="${F.merges.length}">${fusions}</mergeCells>` : ''}${valids ? `<dataValidations count="${F.valids.length}">${valids}</dataValidations>` : ''}<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/><pageSetup orientation="${F.impr.orient === 'paysage' ? 'landscape' : 'portrait'}"/></worksheet>`;
  });

  const noms = Object.entries(T.noms || {}).map(([n, d]) => { const f = T.feuilles.find((x) => x.id === d.f); return f ? `<definedName name="${xe(n)}">'${xe(f.nom.replace(/'/g, "''"))}'!$${colNom(d.c1)}$${d.r1 + 1}${d.r1 === d.r2 && d.c1 === d.c2 ? '' : `:$${colNom(d.c2)}$${d.r2 + 1}`}</definedName>` : ''; }).join('');
  const fichiers = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${feuilles.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${T.feuilles.map((f, i) => `<sheet name="${xe(f.nom.replace(/[\\/?*[\]:]/g, '_').slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${noms ? `<definedNames>${noms}</definedNames>` : ''}<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${feuilles.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${feuilles.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${formats.length ? `<numFmts count="${formats.length}">${formats.map((c, i) => `<numFmt numFmtId="${164 + i}" formatCode="${xe(c)}"/>`).join('')}</numFmts>` : ''}<fonts count="${polices.length}">${polices.join('')}</fonts><fills count="${remplis.length}">${remplis.join('')}</fills><borders count="${bords.length}">${bords.join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
  };
  feuilles.forEach((x, i) => { fichiers[`xl/worksheets/sheet${i + 1}.xml`] = x; });
  const blob = zipper(fichiers);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (T.nom.replace(/[^\p{L}\p{N}]+/gu, '_') || 'tableur') + '.xlsx';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Fichier Excel téléchargé (formules, formats, fusions, volets, listes…). Les graphiques ne sont pas inclus.');
}

/* ---------- Import ---------- */
const FORMATS_PREDEFINIS = { 1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 9: '0%', 10: '0.00%', 11: '0.00E+00', 14: 'dd/mm/yyyy', 15: 'd-mmm-yy', 16: 'd-mmm', 17: 'mmm-yy', 18: 'h:mm AM/PM', 19: 'h:mm:ss AM/PM', 20: 'hh:mm', 21: 'hh:mm:ss', 22: 'dd/mm/yyyy hh:mm', 37: '#,##0 ;(#,##0)', 38: '#,##0 ;[Red](#,##0)', 39: '#,##0.00;(#,##0.00)', 40: '#,##0.00;[Red](#,##0.00)', 49: '@' };
function ficheFormat(code) {
  if (!code || code === 'General') return {};
  if (code === '@') return { fmt: 'txt' };
  if (code === 'dd/mm/yyyy' || code === 'dd/mm/yy' || code === 'mm-dd-yy') return { fmt: 'date' };
  if (code === 'hh:mm:ss') return { fmt: 'heure' };
  if (code === '0%') return { fmt: 'pct', dec: 0 };
  if (code === '0.00%') return { fmt: 'pct', dec: 2 };
  if (code === '0.00E+00') return { fmt: 'sci' };
  if (code === '0') return { fmt: 'n', dec: 0 };
  if (code === '#,##0') return { fmt: 'n', dec: 0 };
  if (code === '0.00' || code === '#,##0.00') return { fmt: 'n', dec: 2 };
  return { fmt: 'code', code };
}
const couleurXml = (el) => { if (!el) return null; const rgb = el.getAttribute('rgb'); return rgb && rgb.length === 8 ? '#' + rgb.slice(2).toLowerCase() : null; };

async function importerXlsx(fichier) {
  try {
    const f = await dezipper(await fichier.arrayBuffer());
    const wb = parseXml(f['xl/workbook.xml'] || ''), rels = parseXml(f['xl/_rels/workbook.xml.rels'] || '');
    const cibles = Object.fromEntries(tags(rels, 'Relationship').map((r) => [r.getAttribute('Id'), r.getAttribute('Target')]));
    const partages = f['xl/sharedStrings.xml'] ? tags(parseXml(f['xl/sharedStrings.xml']), 'si').map((si) => tags(si, 't').filter((t) => !t.parentElement || t.parentElement.localName !== 'rPh').map((t) => t.textContent).join('')) : [];
    // styles
    const stylesXml = f['xl/styles.xml'] ? parseXml(f['xl/styles.xml']) : null;
    const xfsSt = [];
    if (stylesXml) {
      const codes = {};
      tags(stylesXml, 'numFmt').forEach((n) => { codes[n.getAttribute('numFmtId')] = n.getAttribute('formatCode'); });
      const polices = tags(enfant(stylesXml.documentElement, 'fonts') || stylesXml.documentElement, 'font');
      const remplis = tags(enfant(stylesXml.documentElement, 'fills') || stylesXml.documentElement, 'fill');
      const bords = tags(enfant(stylesXml.documentElement, 'borders') || stylesXml.documentElement, 'border');
      const cx = enfant(stylesXml.documentElement, 'cellXfs');
      [...(cx ? cx.children : [])].forEach((x) => {
        const s = {};
        const id = x.getAttribute('numFmtId'), code = codes[id] || FORMATS_PREDEFINIS[id];
        Object.assign(s, ficheFormat(code));
        const p = polices[+x.getAttribute('fontId')];
        if (p) {
          if (enfant(p, 'b')) s.b = true; if (enfant(p, 'i')) s.i = true; if (enfant(p, 'u')) s.u = true; if (enfant(p, 'strike')) s.st = true;
          const sz = enfant(p, 'sz'); if (sz && +sz.getAttribute('val') !== 11) s.fs = Math.round(+sz.getAttribute('val'));
          const c = couleurXml(enfant(p, 'color')); if (c && c !== '#000000') s.c = c;
          const nom = enfant(p, 'name'); if (nom && POLICES[nom.getAttribute('val')]) s.ff = POLICES[nom.getAttribute('val')];
        }
        const r = remplis[+x.getAttribute('fillId')];
        const pf = r && enfant(r, 'patternFill');
        if (pf && pf.getAttribute('patternType') === 'solid') { const c = couleurXml(enfant(pf, 'fgColor')); if (c && c !== '#ffffff') { s.bg = c; if (!s.c && luminance(c) > 0.55) s.c = '#111111'; } }
        const b = bords[+x.getAttribute('borderId')];
        if (b) { const bd = {}; for (const [k, n] of [['l', 'left'], ['r', 'right'], ['t', 'top'], ['b', 'bottom']]) { const e = enfant(b, n); if (e && e.getAttribute('style')) bd[k] = couleurXml(enfant(e, 'color')) || '#9aa0aa'; } if (Object.keys(bd).length) s.bd = bd; }
        const al = enfant(x, 'alignment');
        if (al) { const h = al.getAttribute('horizontal'); if (['left', 'center', 'right'].includes(h)) s.al = h; const v = al.getAttribute('vertical'); if (v) s.va = v === 'center' ? 'middle' : v; if (al.getAttribute('wrapText') === '1') s.wrap = true; if (+al.getAttribute('indent')) s.ind = +al.getAttribute('indent'); }
        xfsSt.push(s);
      });
    }
    const T = { id: uid(), nom: fichier.name.replace(/\.xlsx$/i, ''), date: Date.now(), feuilles: [], noms: {} };
    const feuillesXml = tags(wb, 'sheet');
    for (const sh_ of feuillesXml) {
      const rid = sh_.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || sh_.getAttribute('r:id');
      let cible = cibles[rid] || '';
      cible = cible.replace(/^\//, '');
      const chemin = cible.startsWith('xl/') ? cible : 'xl/' + cible;
      const xml = f[chemin];
      if (!xml) continue;
      const doc = parseXml(xml);
      const F = nouvelleFeuille(sh_.getAttribute('name') || 'Feuille ' + (T.feuilles.length + 1));
      let maxR = 0, maxC = 0;
      const partagees = {}, matrices = [];
      tags(doc, 'c').forEach((c) => {
        const ref = parseAdr(c.getAttribute('r') || '');
        if (!ref || ref.r >= MAXL || ref.c >= MAXC) return;
        const t = c.getAttribute('t'), vEl = enfant(c, 'v'), fEl = enfant(c, 'f'), isEl = enfant(c, 'is');
        let v = '';
        if (fEl) {
          let ft = fEl.textContent;
          const si = fEl.getAttribute('si');
          if (fEl.getAttribute('t') === 'array' && fEl.getAttribute('ref')) matrices.push({ P: parsePlage(fEl.getAttribute('ref')), r: ref.r, c: ref.c });
          if (fEl.getAttribute('t') === 'shared') { if (ft) partagees[si] = { ft, r: ref.r, c: ref.c }; else if (partagees[si]) { const m = partagees[si]; ft = decalerRelatives('=' + m.ft, ref.r - m.r, ref.c - m.c).slice(1); } }
          if (ft) v = '=' + traduireFormule('=' + ft, 'fr').slice(1);
        }
        if (!v) {
          const brutV = vEl ? vEl.textContent : '';
          if (t === 's') v = partages[+brutV] ?? '';
          else if (t === 'inlineStr') v = isEl ? tags(isEl, 't').map((x) => x.textContent).join('') : '';
          else if (t === 'str') v = brutV;
          else if (t === 'b') v = brutV === '1' ? 'VRAI' : 'FAUX';
          else if (t === 'e') v = '';
          else if (brutV !== '') v = String(parseFloat(brutV)).replace('.', ',');
        }
        const s = JSON.parse(JSON.stringify(xfsSt[+(c.getAttribute('s') || 0)] || {}));
        if (v === '' && !Object.keys(s).length) return;
        F.cells[adr(ref.r, ref.c)] = { v: String(v), s };
        if (v !== '') { maxR = Math.max(maxR, ref.r); maxC = Math.max(maxC, ref.c); }
      });
      matrices.forEach(({ P, r, c }) => { if (P) for (let i = P.r1; i <= P.r2; i++) for (let j = P.c1; j <= P.c2; j++) if (i !== r || j !== c) delete F.cells[adr(i, j)]; });
      F.nbL = Math.max(30, Math.min(MAXL, maxR + 6)); F.nbC = Math.max(12, Math.min(MAXC, maxC + 3));
      tags(doc, 'col').forEach((c) => { const w = parseFloat(c.getAttribute('width')); for (let k = +c.getAttribute('min'); k <= Math.min(+c.getAttribute('max'), MAXC); k++) { if (w) F.largeurs[k - 1] = Math.round(w * 7); if (c.getAttribute('hidden') === '1') F.cache.c.push(k - 1); } });
      tags(doc, 'row').forEach((r) => { const ht = parseFloat(r.getAttribute('ht')); const n = +r.getAttribute('r') - 1; if (ht && r.getAttribute('customHeight') === '1') F.hauteurs[n] = Math.round(ht / 0.75); if (r.getAttribute('hidden') === '1') F.cache.l.push(n); });
      tags(doc, 'mergeCell').forEach((m) => { const P = parsePlage(m.getAttribute('ref')); if (P && P.r2 < MAXL && P.c2 < MAXC) F.merges.push(P); });
      const pane = tags(doc, 'pane')[0];
      if (pane && pane.getAttribute('state') === 'frozen') F.gel = { r: +(pane.getAttribute('ySplit') || 0), c: +(pane.getAttribute('xSplit') || 0) };
      const sv = tags(doc, 'sheetView')[0];
      if (sv) { if (sv.getAttribute('showGridLines') === '0') F.quad = false; if (+sv.getAttribute('zoomScale')) F.zoom = Math.max(50, Math.min(200, Math.round(+sv.getAttribute('zoomScale') / 10) * 10)); }
      tags(doc, 'dataValidation').forEach((d) => {
        const type = d.getAttribute('type'), f1 = (enfant(d, 'formula1') || {}).textContent || '', f2 = (enfant(d, 'formula2') || {}).textContent || '';
        const opMap = { between: 'entre', notBetween: 'horsde', equal: 'egal', notEqual: 'diff', greaterThan: 'sup', greaterThanOrEqual: 'supeg', lessThan: 'inf', lessThanOrEqual: 'infeg' };
        const t = { list: 'liste', whole: 'entier', decimal: 'decimal', date: 'date', textLength: 'longueur', custom: 'perso' }[type];
        if (!t) return;
        const sq = (d.getAttribute('sqref') || '').split(' ')[0];
        if (!parsePlage(sq)) return;
        F.valids.push({ id: uid(), range: sq, type: t, op: opMap[d.getAttribute('operator')] || 'entre', a: t === 'perso' ? traduireFormule('=' + f1, 'fr').slice(1) : f1, b: f2, source: /^"/.test(f1) ? f1.replace(/^"|"$/g, '').replace(/,/g, ';') : f1, message: d.getAttribute('error') || '', alerte: 'stop' });
      });
      T.feuilles.push(F);
    }
    if (!T.feuilles.length) throw new Error('Aucune feuille lisible dans ce fichier.');
    tags(wb, 'definedName').forEach((n) => {
      const m = /^'?([^'!]+)'?!\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?$/.exec(n.textContent.trim());
      const nf = m && T.feuilles.find((x) => x.nom === m[1].replace(/''/g, "'"));
      if (nf && !/^_xlnm/.test(n.getAttribute('name'))) { const P = parsePlage(m[2] + m[3] + (m[4] ? ':' + m[4] + m[5] : '')); if (P) T.noms[n.getAttribute('name').toUpperCase()] = { f: nf.id, ...P }; }
    });
    db.tableurs.push(T);
    journaliser('Excel importé : ' + T.nom, T.feuilles.length + ' feuille(s)');
    sauver();
    sh.sel = { r1: 0, c1: 0, r2: 0, c2: 0 }; sh.histo = { id: null, undo: [], redo: [] };
    aller('sheet', { tabId: T.id, feuille: 0 });
    toast(`Importé : ${T.feuilles.length} feuille(s)`);
  } catch (e) {
    alert('Import impossible : ' + e.message);
  }
}

document.addEventListener('change', (e) => {
  if (e.target.id !== 'tbImport') return;
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  if (/\.xlsx$/i.test(f.name)) importerXlsx(f);
  else {
    const rd = new FileReader();
    rd.onload = () => {
      const lignes = parserCsv(String(rd.result));
      const G = nouvelleFeuille((f.name.replace(/\.\w+$/, '') || 'Import').slice(0, 30));
      lignes.slice(0, MAXL).forEach((l, r) => l.slice(0, MAXC).forEach((v, c) => { if (v !== '') { const s = {}; const fa = v[0] !== '=' ? formatAuto(v) : null; if (fa) Object.assign(s, fa); G.cells[adr(r, c)] = { v, s }; } }));
      G.nbL = Math.max(30, Math.min(MAXL, lignes.length + 5)); G.nbC = Math.max(12, Math.min(MAXC, Math.max(...lignes.map((l) => l.length)) + 1));
      const T = { id: uid(), nom: G.nom, date: Date.now(), feuilles: [G], noms: {} };
      db.tableurs.push(T); sauver();
      aller('sheet', { tabId: T.id, feuille: 0 });
    };
    rd.readAsText(f);
  }
});
