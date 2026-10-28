'use strict';
/* ============================================================
   Tableur : édition, opérations sur les cellules, presse-papiers
   ============================================================ */

/* ================= Éditeur de cellule ================= */
const OPS_FORMULE = /[=(;,+\-*/^&<>:]$/;

function fermerAuto() {
  sh.auto = null;
  const a = document.getElementById('shAuto'); if (a) a.remove();
  const h = document.getElementById('shHint'); if (h) h.remove();
}
function placerPopup(el, td) {
  const b = td.getBoundingClientRect();
  el.style.left = Math.min(b.left, window.innerWidth - 320) + 'px';
  el.style.top = (b.bottom + 4) + 'px';
}
function contexteFonction(avant) {
  const pile = [];
  let q = false;
  for (let i = 0; i < avant.length; i++) {
    const ch = avant[i];
    if (ch === '"') q = !q;
    if (q) continue;
    if (ch === '(') { const m = /([A-Za-zÀ-ÿ_][\wÀ-ÿ.]*)$/.exec(avant.slice(0, i)); pile.push({ nom: m ? m[1] : null, arg: 0 }); }
    else if (ch === ')') pile.pop();
    else if ((ch === ';' || ch === ',') && pile.length) pile[pile.length - 1].arg++;
  }
  for (let i = pile.length - 1; i >= 0; i--) if (pile[i].nom) return pile[i];
  return null;
}
function majAuto() {
  const ed = sh.ed;
  if (!ed) return;
  const ta = ed.ta, v = ta.value, pos = ta.selectionStart, avant = v.slice(0, pos);
  const T = tableur();
  let items = [];
  if (v[0] === '=' && (avant.match(/"/g) || []).length % 2 === 0) {
    const m = /([A-Za-zÀ-ÿ_][\wÀ-ÿ.]*)$/.exec(avant);
    if (m && !/^[A-Za-z]{1,3}\d+$/.test(m[1]) && (m.index === 0 || !/[\w.]/.test(avant[m.index - 1] || ''))) {
      const pref = m[1].toUpperCase();
      items = FONC_LISTE.filter((f) => f.fr.startsWith(pref) || f.en.startsWith(pref)).slice(0, 8).map((f) => ({ nom: f.fr, meta: f.syntaxe, fn: true, debut: m.index, len: m[1].length }));
      items = items.concat(Object.keys((T && T.noms) || {}).filter((n) => n.startsWith(pref)).slice(0, 3).map((n) => ({ nom: n, meta: 'Nom défini', fn: false, debut: m.index, len: m[1].length })));
    }
  }
  let pop = document.getElementById('shAuto');
  if (!items.length) { sh.auto = null; if (pop) pop.remove(); }
  else {
    if (!sh.auto) sh.auto = { i: 0 };
    sh.auto.items = items; sh.auto.i = Math.min(sh.auto.i, items.length - 1);
    if (!pop) { pop = document.createElement('div'); pop.id = 'shAuto'; pop.className = 'shauto'; document.body.appendChild(pop); }
    pop.innerHTML = items.map((x, i) => `<div class="ai${i === sh.auto.i ? ' on' : ''}" data-ai="${i}"><b>${esc(x.nom)}</b><small>${esc(x.meta)}</small></div>`).join('');
    placerPopup(pop, ta.parentElement);
  }
  // aide à la syntaxe
  let hint = document.getElementById('shHint');
  const ctx = v[0] === '=' ? contexteFonction(avant) : null;
  const meta = ctx && (FONC_PAR_FR[EN2FR[ctx.nom.toUpperCase()] || ctx.nom.toUpperCase()]);
  if (meta && !items.length) {
    const m = /^([^(]+)\((.*)\)$/.exec(meta.syntaxe), params = m ? m[2].split(';') : [];
    const html = esc(m ? m[1] : meta.fr) + '(' + params.map((p, i) => (i === Math.min(ctx.arg, params.length - 1) ? `<b>${esc(p)}</b>` : esc(p))).join(';') + ')';
    if (!hint) { hint = document.createElement('div'); hint.id = 'shHint'; hint.className = 'shhint'; document.body.appendChild(hint); }
    hint.innerHTML = html + `<br><small>${esc(meta.desc)}</small>`;
    placerPopup(hint, ta.parentElement);
  } else if (hint) hint.remove();
}
function accepterAuto(i) {
  const ed = sh.ed, a = sh.auto;
  if (!ed || !a) return;
  const it = a.items[i ?? a.i], ta = ed.ta;
  const insere = it.nom + (it.fn ? '(' : '');
  ta.setRangeText(insere, it.debut, it.debut + it.len, 'end');
  fermerAuto();
  ta.focus();
  ta.dispatchEvent(new Event('input'));
}

function colorerRefs() {
  sh.rf.forEach((td) => td.classList.remove('rf0', 'rf1', 'rf2', 'rf3', 'rf4', 'rf5', 'pt'));
  sh.rf = [];
  const ed = sh.ed;
  if (!ed || ed.ta.value[0] !== '=') return;
  const F = feuille();
  referencesDe(ed.ta.value).forEach((R, i) => {
    let n = 0;
    for (let r = R.r1; r <= R.r2 && n < 2500; r++) for (let c = R.c1; c <= R.c2; c++, n++) {
      const td = sh.tds[r] && sh.tds[r][c];
      if (td && !(r === ed.r && c === ed.c)) { td.classList.add('rf' + (i % 6)); sh.rf.push(td); }
    }
  });
  void F;
}

function redimEditeur() {
  const ed = sh.ed;
  if (!ed) return;
  const td = ed.ta.parentElement, lignes = ed.ta.value.split('\n'), longest = Math.max(...lignes.map((s) => s.length));
  ed.ta.style.width = Math.max(td.offsetWidth, Math.min(640, longest * 8.6 + 28)) + 'px';
  ed.ta.style.height = Math.max(td.offsetHeight, lignes.length * 19 + 8) + 'px';
}

function basculerAbsolu(ta) {
  const v = ta.value, pos = ta.selectionStart;
  const re = /\$?[A-Za-z]{1,3}\$?\d+/g;
  let m;
  while ((m = re.exec(v))) {
    if (m.index <= pos && pos <= m.index + m[0].length) {
      const d = decomposer(m[0]);
      const suiv = !d.ac && !d.ar ? { ac: '$', ar: '$' } : d.ac && d.ar ? { ac: '', ar: '$' } : !d.ac && d.ar ? { ac: '$', ar: '' } : { ac: '', ar: '' };
      const nv = composer({ ...d, ...suiv });
      ta.setRangeText(nv, m.index, m.index + m[0].length, 'end');
      ta.dispatchEvent(new Event('input'));
      return;
    }
  }
}

function pointer(ta, dr, dc) {
  const ed = sh.ed, F = feuille();
  if (!sh.pt) sh.pt = { r: ed.r, c: ed.c, debut: ta.selectionStart, len: 0 };
  const p = sh.pt;
  p.r = Math.max(0, Math.min(F.nbL - 1, p.r + dr)); p.c = Math.max(0, Math.min(F.nbC - 1, p.c + dc));
  const t = adr(p.r, p.c);
  ta.setRangeText(t, p.debut, p.debut + p.len, 'end');
  p.len = t.length;
  $('#shFormule').value = ta.value;
  colorerRefs();
  const td = sh.tds[p.r] && sh.tds[p.r][p.c];
  if (td) { td.classList.add('pt'); sh.rf.push(td); td.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
}

function editer(r, c, init) {
  finirEdition(true);
  const F = feuille(), m = fusionDe(F, r, c);
  if (m) { r = m.r1; c = m.c1; }
  const td = sh.tds[r] && sh.tds[r][c];
  if (!td) return;
  const S0 = rect();
  if (!(r >= S0.r1 && r <= S0.r2 && c >= S0.c1 && c <= S0.c2 && (S0.r1 !== S0.r2 || S0.c1 !== S0.c2))) selectionner(r, c, r, c);
  td.classList.add('edit');
  td.querySelectorAll('.fh,.dvb,.flb').forEach((x) => x.remove());
  td.textContent = '';
  const ta = document.createElement('textarea');
  ta.className = 'ced'; ta.rows = 1; ta.wrap = 'off'; ta.spellcheck = false;
  ta.value = init !== undefined ? init : brut(F, r, c);
  td.appendChild(ta);
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
  sh.ed = { r, c, ta }; sh.pt = null;
  $('#shFormule').value = ta.value;
  redimEditeur(); colorerRefs(); majAuto();

  ta.addEventListener('input', () => { sh.pt = null; $('#shFormule').value = ta.value; redimEditeur(); colorerRefs(); majAuto(); });
  ta.addEventListener('keydown', (e) => {
    e.stopPropagation();
    const k = e.key;
    if (sh.auto && sh.auto.items && sh.auto.items.length) {
      if (k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); sh.auto.i = (sh.auto.i + (k === 'ArrowDown' ? 1 : -1) + sh.auto.items.length) % sh.auto.items.length; majAuto(); return; }
      if (k === 'Tab' || (k === 'Enter' && !e.altKey)) { e.preventDefault(); accepterAuto(); return; }
      if (k === 'Escape') { e.preventDefault(); fermerAuto(); return; }
    }
    if (k === 'F4') { e.preventDefault(); basculerAbsolu(ta); return; }
    if (k === 'Enter') {
      e.preventDefault();
      if (e.altKey) { ta.setRangeText('\n', ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); }
      else if (e.ctrlKey || e.metaKey) finirEdition(true, 0, 0, true);
      else finirEdition(true, e.shiftKey ? -1 : 1, 0);
      return;
    }
    if (k === 'Tab') { e.preventDefault(); finirEdition(true, 0, e.shiftKey ? -1 : 1); return; }
    if (k === 'Escape') { e.preventDefault(); finirEdition(false); return; }
    const fleche = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[k];
    if (fleche && ta.value[0] === '=' && !e.shiftKey && !e.altKey) {
      const avant = ta.value.slice(0, ta.selectionStart);
      if (sh.pt || (ta.selectionStart === ta.selectionEnd && OPS_FORMULE.test(avant) && (avant.match(/"/g) || []).length % 2 === 0)) { e.preventDefault(); pointer(ta, fleche[0], fleche[1]); return; }
    }
    if (!['Shift', 'Control', 'Alt', 'Meta'].includes(k)) sh.pt = null;
  });
  ta.addEventListener('blur', () => { setTimeout(() => { if (sh.ed && sh.ed.ta === ta && document.activeElement !== ta && !document.activeElement.closest('#shAuto')) finirEdition(true); }, 0); });
}

function completerParentheses(v) {
  if (v[0] !== '=' || (v.match(/"/g) || []).length % 2) return v;
  const o = (v.match(/\(/g) || []).length, c = (v.match(/\)/g) || []).length;
  return o > c ? v + ')'.repeat(o - c) : v;
}

function finirEdition(valider, dr = 0, dc = 0, remplirSel = false) {
  const ed = sh.ed;
  if (!ed) return;
  sh.ed = null;
  fermerAuto();
  const F = feuille();
  const valeur = completerParentheses(ed.ta.value);
  let ok = valider;
  const R = remplirSel ? rect() : null;
  let refus = false;
  if (ok && (remplirSel || valeur !== brut(F, ed.r, ed.c))) {
    const err = verifierValidation(F, ed.r, ed.c, valeur);
    if (err) {
      const v = validationDe(F, ed.r, ed.c);
      if (v.alerte === 'info') toast('ℹ️ ' + err);
      else if (v.alerte === 'avertir') ok = confirm(err + '\n\nConserver quand même cette valeur ?');
      else { alert(err); ok = false; refus = true; }
    }
    if (ok) {
      pousser(F);
      if (R) { for (let r = R.r1; r <= R.r2; r++) for (let c = R.c1; c <= R.c2; c++) poser(F, r, c, valeur[0] === '=' ? decalerRelatives(valeur, r - ed.r, c - ed.c) : valeur); }
      else poser(F, ed.r, ed.c, valeur);
      sauver();
    }
  }
  renderGrille();
  if (refus) { selectionner(ed.r, ed.c, ed.r, ed.c); editer(ed.r, ed.c, valeur); return; }
  const r = Math.max(0, Math.min(F.nbL - 1, ed.r + dr)), c = Math.max(0, Math.min(F.nbC - 1, ed.c + dc));
  if (R) selectionner(R.r1, R.c1, R.r2, R.c2); else selectionner(r, c, r, c);
  defiler();
  const g = $('#shGrid');
  if (g) g.focus({ preventScroll: true });
}

/* ================= Styles ================= */
function appliquerStyle(patch) {
  const R = rect();
  modifier((F) => {
    const A = actif(), premier = cellule(F, A.r, A.c);
    for (let r = R.r1; r <= R.r2; r++) for (let c = R.c1; c <= R.c2; c++) {
      const cell = assurer(F, r, c);
      const p = typeof patch === 'function' ? patch(cell.s, premier ? premier.s : {}, r, c) : patch;
      Object.assign(cell.s, p);
      Object.keys(cell.s).forEach((k) => { if (cell.s[k] === undefined || cell.s[k] === false || cell.s[k] === '' || cell.s[k] === null) delete cell.s[k]; });
      nettoyer(F, adr(r, c));
    }
  });
}
const basculer = (cle) => (s, premier) => ({ [cle]: !premier[cle] });

function appliquerBordures(type, couleur) {
  const R = rect(), col = couleur || '#9aa0aa';
  modifier((F) => {
    for (let r = R.r1; r <= R.r2; r++) for (let c = R.c1; c <= R.c2; c++) {
      const cell = assurer(F, r, c), bd = { ...(cell.s.bd || {}) };
      const bords = { t: r === R.r1, b: r === R.r2, l: c === R.c1, r: c === R.c2 };
      if (type === 'aucune') { delete cell.s.bd; nettoyer(F, adr(r, c)); continue; }
      if (type === 'tous') Object.assign(bd, { t: col, r: col, b: col, l: col });
      else if (type === 'ext') { for (const k of ['t', 'b', 'l', 'r']) if (bords[k]) bd[k] = col; }
      else if (type === 'haut' && bords.t) bd.t = col;
      else if (type === 'bas' && bords.b) bd.b = col;
      else if (type === 'gauche' && bords.l) bd.l = col;
      else if (type === 'droite' && bords.r) bd.r = col;
      cell.s.bd = bd;
    }
  });
}

function effacer(mode) {
  const R = rect();
  modifier((F) => {
    for (let r = R.r1; r <= R.r2; r++) for (let c = R.c1; c <= R.c2; c++) {
      const cell = cellule(F, r, c);
      if (!cell) continue;
      if (mode === 'tout' || mode === 'contenu') cell.v = '';
      if (mode === 'tout' || mode === 'formats') cell.s = {};
      if (mode === 'tout' || mode === 'notes') { delete cell.n; delete cell.l; }
      nettoyer(F, adr(r, c));
    }
  });
}
const effacerSelection = () => effacer('contenu');

function fusionner() {
  const R = rect();
  if (R.r1 === R.r2 && R.c1 === R.c2) { toast('Sélectionne plusieurs cellules à fusionner.'); return; }
  modifier((F) => {
    F.merges = F.merges.filter((m) => m.r2 < R.r1 || m.r1 > R.r2 || m.c2 < R.c1 || m.c1 > R.c2);
    for (let r = R.r1; r <= R.r2; r++) for (let c = R.c1; c <= R.c2; c++) if (r !== R.r1 || c !== R.c1) { const cell = cellule(F, r, c); if (cell) { cell.v = ''; nettoyer(F, adr(r, c)); } }
    F.merges.push({ r1: R.r1, c1: R.c1, r2: R.r2, c2: R.c2 });
  });
  selectionner(R.r1, R.c1, R.r1, R.c1);
}
function defusionner() {
  const R = rect();
  modifier((F) => { F.merges = F.merges.filter((m) => m.r2 < R.r1 || m.r1 > R.r2 || m.c2 < R.c1 || m.c1 > R.c2); });
}

function deplacer(dr, dc, etendre) {
  const F = feuille();
  const R = rect();
  const base = etendre ? { r: sh.sel.r2, c: sh.sel.c2 } : { r: dr > 0 ? R.r2 : R.r1, c: dc > 0 ? R.c2 : R.c1 };
  if (!etendre) { const A = actif(); if (dr === 0) base.r = A.r; if (dc === 0) base.c = A.c; }
  let r = base.r + dr, c = base.c + dc;
  while (r >= 0 && r < F.nbL && sh.masqL.has(r)) r += dr || 1;
  while (c >= 0 && c < F.nbC && sh.masqC.has(c)) c += dc || 1;
  r = Math.max(0, Math.min(F.nbL - 1, r)); c = Math.max(0, Math.min(F.nbC - 1, c));
  const m = fusionDe(F, r, c);
  if (etendre) selectionner(sh.sel.r1, sh.sel.c1, r, c);
  else if (m) selectionner(m.r1, m.c1, m.r1, m.c1); else selectionner(r, c, r, c);
  defiler();
}

function nonVide(F, r, c) { const v = valCell(sh.ctx, F, r, c); return v !== null && v !== ''; }
function sautDonnees(dr, dc, etendre) {
  const F = feuille();
  let r = etendre ? sh.sel.r2 : sh.sel.r1, c = etendre ? sh.sel.c2 : sh.sel.c1;
  const dans = (a, b) => a >= 0 && b >= 0 && a < F.nbL && b < F.nbC;
  if (dans(r + dr, c + dc) && nonVide(F, r, c) && nonVide(F, r + dr, c + dc)) { while (dans(r + dr, c + dc) && nonVide(F, r + dr, c + dc)) { r += dr; c += dc; } }
  else { r += dr; c += dc; while (dans(r, c) && !nonVide(F, r, c) && dans(r + dr, c + dc)) { r += dr; c += dc; } }
  r = Math.max(0, Math.min(F.nbL - 1, r)); c = Math.max(0, Math.min(F.nbC - 1, c));
  if (etendre) selectionner(sh.sel.r1, sh.sel.c1, r, c); else selectionner(r, c, r, c);
  defiler();
}

/* ================= Insertion / suppression de lignes et colonnes ================= */
const ajusterIndex = (i, idx, delta) => (delta > 0 ? (i >= idx ? i + 1 : i) : i === idx ? null : i > idx ? i - 1 : i);
function deplacerAxe(F, axe, idx, delta) {
  const T = tableur();
  const nouv = {};
  for (const [a, cell] of Object.entries(F.cells)) {
    const p = parseAdr(a);
    let k = axe === 'r' ? p.r : p.c;
    if (delta < 0 && k === idx) continue;
    if (delta > 0 ? k >= idx : k > idx) k += delta;
    cell.v = decalerAxe(cell.v, axe, idx, delta);
    nouv[axe === 'r' ? adr(k, p.c) : adr(p.r, k)] = cell;
  }
  F.cells = nouv;
  const plage = (s) => { const r = decalerAxe('=' + s, axe, idx, delta); return /#REF/.test(r) ? null : r.slice(1); };
  F.graphs = F.graphs.filter((g) => { const n = plage(g.range); if (n) g.range = n; return !!n; });
  F.cf = F.cf.filter((g) => { const n = plage(g.range); if (n) g.range = n; return !!n; });
  F.valids = F.valids.filter((g) => { const n = plage(g.range); if (n) g.range = n; return !!n; });
  const k1 = axe === 'r' ? 'r1' : 'c1', k2 = axe === 'r' ? 'r2' : 'c2';
  F.merges = F.merges.map((m) => { const res = ajusterAxe(m[k1], m[k2], idx, delta); if (!res) return null; return { ...m, [k1]: res[0], [k2]: res[1] }; }).filter((m) => m && (m.r1 !== m.r2 || m.c1 !== m.c2));
  const mapObj = (o) => { const out = {}; for (const [k, w] of Object.entries(o)) { const i = ajusterIndex(+k, idx, delta); if (i !== null) out[i] = w; } return out; };
  if (axe === 'c') F.largeurs = mapObj(F.largeurs); else F.hauteurs = mapObj(F.hauteurs);
  const liste = axe === 'r' ? 'l' : 'c';
  F.cache[liste] = (F.cache[liste] || []).map((i) => ajusterIndex(i, idx, delta)).filter((i) => i !== null);
  if (F.filtre) {
    if (axe === 'r') { const r = ajusterIndex(F.filtre.r, idx, delta); if (r === null) F.filtre = null; else { F.filtre.r = r; if (F.filtre.r2 != null) F.filtre.r2 = Math.max(r, ajusterIndex(F.filtre.r2, idx, delta) ?? F.filtre.r2 - 1); } }
    else { const res = ajusterAxe(F.filtre.c1, F.filtre.c2, idx, delta); if (!res) F.filtre = null; else { F.filtre.c1 = res[0]; F.filtre.c2 = res[1]; F.filtre.crit = {}; } }
  }
  if (T && T.noms) for (const [n, d] of Object.entries(T.noms)) {
    if (d.f !== F.id) continue;
    const res = ajusterAxe(d[k1], d[k2], idx, delta);
    if (!res) delete T.noms[n]; else { d[k1] = res[0]; d[k2] = res[1]; }
  }
}
function insererAxe(axe, n) {
  const R = rect(), idx = axe === 'r' ? R.r1 : R.c1, nb = n || (axe === 'r' ? R.r2 - R.r1 + 1 : R.c2 - R.c1 + 1);
  modifier((F) => {
    for (let i = 0; i < nb; i++) {
      if (axe === 'r' ? F.nbL >= MAXL : F.nbC >= MAXC) break;
      deplacerAxe(F, axe, idx, 1);
      if (axe === 'r') F.nbL++; else F.nbC++;
    }
  });
}
function supprimerAxe(axe) {
  const R = rect(), debut = axe === 'r' ? R.r1 : R.c1, fin = axe === 'r' ? R.r2 : R.c2;
  modifier((F) => {
    for (let i = fin; i >= debut; i--) {
      if (axe === 'r' ? F.nbL <= 5 : F.nbC <= 3) break;
      deplacerAxe(F, axe, i, -1);
      if (axe === 'r') F.nbL--; else F.nbC--;
    }
  });
  const F = feuille(), r = Math.min(sh.sel.r1, F.nbL - 1), c = Math.min(sh.sel.c1, F.nbC - 1);
  selectionner(r, c, r, c);
}
function masquerAxe(axe) {
  const R = rect();
  modifier((F) => {
    const liste = axe === 'r' ? F.cache.l : F.cache.c, a = axe === 'r' ? R.r1 : R.c1, b = axe === 'r' ? R.r2 : R.c2;
    for (let i = a; i <= b; i++) if (!liste.includes(i)) liste.push(i);
  });
}
function afficherTout() { modifier((F) => { F.cache = { l: [], c: [] }; }); }

function zoneUtilisee(F) {
  let r2 = -1, c2 = -1;
  for (const [a, cell] of Object.entries(F.cells)) { if (cell.v === '' && !Object.keys(cell.s).length) continue; if (cell.v === '') continue; const p = parseAdr(a); r2 = Math.max(r2, p.r); c2 = Math.max(c2, p.c); }
  const ext = sh.ctx && sh.ctx.ext[F.id];
  if (ext) { r2 = Math.max(r2, ext.r - 1); c2 = Math.max(c2, ext.c - 1); }
  return { r1: 0, c1: 0, r2, c2 };
}

/* ================= Tri ================= */
function trierPlage(R, niveaux, entete) {
  modifier((F) => {
    const debut = R.r1 + (entete ? 1 : 0), ctx = nouveauCtx(tableur());
    const lignes = [];
    for (let r = debut; r <= R.r2; r++) {
      const cells = {};
      for (let c = R.c1; c <= R.c2; c++) { const cell = F.cells[adr(r, c)]; if (cell) cells[c] = cell; }
      lignes.push({ r, cells, cles: niveaux.map((n) => valCell(ctx, F, r, n.col)) });
    }
    lignes.sort((a, b) => {
      for (let i = 0; i < niveaux.length; i++) {
        const x = a.cles[i], y = b.cles[i];
        if (x === null && y === null) continue;
        if (x === null) return 1;
        if (y === null) return -1;
        const d = cmp(x, y);
        if (d) return niveaux[i].desc ? -d : d;
      }
      return a.r - b.r;
    });
    for (let r = debut; r <= R.r2; r++) for (let c = R.c1; c <= R.c2; c++) delete F.cells[adr(r, c)];
    lignes.forEach((l, i) => {
      const r = debut + i;
      for (const [c, cell] of Object.entries(l.cells)) F.cells[adr(r, +c)] = { ...cell, v: decalerRelatives(cell.v, r - l.r, 0), s: { ...cell.s } };
    });
  });
}
function trier(sens) {
  const F = feuille();
  let R = rect(), entete = false, col = sh.sel.c1;
  if (R.r1 === R.r2 && R.c1 === R.c2) {
    const z = zoneUtilisee(F);
    if (z.r2 < 1) return;
    R = { r1: 0, r2: z.r2, c1: 0, c2: z.c2 };
    entete = typeof valCell(sh.ctx, F, 0, col) === 'string';
  } else col = R.c1;
  trierPlage(R, [{ col, desc: sens === 'desc' }], entete);
}

/* ================= Recopie ================= */
const LISTES = [JOURS_FR.slice(1).concat(JOURS_FR[0]), MOIS_FR];
function remplir(src, cible) {
  const dR = cible.r > src.r2 ? cible.r - src.r2 : cible.r < src.r1 ? cible.r - src.r1 : 0;
  const dC = cible.c > src.c2 ? cible.c - src.c2 : cible.c < src.c1 ? cible.c - src.c1 : 0;
  if (!dR && !dC) return;
  const vertical = Math.abs(dR) >= Math.abs(dC), n = Math.abs(vertical ? dR : dC), sens = (vertical ? dR : dC) > 0 ? 1 : -1;
  modifier((F) => {
    const h = src.r2 - src.r1 + 1, w = src.c2 - src.c1 + 1, fils = vertical ? w : h;
    for (let l = 0; l < fils; l++) {
      const fil = [];
      for (let i = 0; i < (vertical ? h : w); i++) fil.push(vertical ? { r: src.r1 + i, c: src.c1 + l } : { r: src.r1 + l, c: src.c1 + i });
      const vals = fil.map((p) => cellule(F, p.r, p.c));
      const nums = vals.map((x) => (x && x.v[0] !== '=' ? constante(x.v) : undefined));
      const serie = sens > 0 && nums.every((x) => typeof x === 'number') && (fil.length >= 2 || (vals[0] && (vals[0].s.fmt === 'date' || vals[0].s.fmt === 'datel')));
      const pas = serie ? (fil.length >= 2 ? (nums[nums.length - 1] - nums[0]) / (nums.length - 1) : 1) : 0;
      const liste = sens > 0 && fil.length === 1 && vals[0] && LISTES.find((L) => L.includes(String(vals[0].v).toLowerCase()));
      const suffixe = sens > 0 && fil.length === 1 && vals[0] && vals[0].v[0] !== '=' && /^(.*?)(\d+)$/.exec(vals[0].v);
      for (let k = 1; k <= n; k++) {
        const srcP = fil[((k - 1) % fil.length + fil.length) % fil.length];
        const dest = vertical ? { r: sens > 0 ? src.r2 + k : src.r1 - k, c: srcP.c } : { r: srcP.r, c: sens > 0 ? src.c2 + k : src.c1 - k };
        if (dest.r < 0 || dest.c < 0 || dest.r >= MAXL || dest.c >= MAXC) continue;
        const source = cellule(F, srcP.r, srcP.c);
        if (!source) { const ex = cellule(F, dest.r, dest.c); if (ex) { ex.v = ''; nettoyer(F, adr(dest.r, dest.c)); } continue; }
        let v;
        if (serie) v = String(parseFloat((nums[nums.length - 1] + pas * k).toPrecision(12))).replace('.', ',');
        else if (liste) { const i = liste.indexOf(String(vals[0].v).toLowerCase()); const nx = liste[(i + k) % liste.length]; v = /^[A-ZÉÈ]/.test(vals[0].v) ? nx[0].toUpperCase() + nx.slice(1) : nx; }
        else if (suffixe) v = suffixe[1] + (+suffixe[2] + k);
        else v = decalerRelatives(source.v, dest.r - srcP.r, dest.c - srcP.c);
        if (dest.r >= F.nbL) F.nbL = Math.min(MAXL, dest.r + 1);
        if (dest.c >= F.nbC) F.nbC = Math.min(MAXC, dest.c + 1);
        F.cells[adr(dest.r, dest.c)] = { ...source, v, s: { ...source.s } };
      }
    }
  });
  const R = rect();
  selectionner(vertical && sens < 0 ? R.r1 - n : R.r1, R.c1, R.r2 + (vertical && sens > 0 ? n : 0), R.c2 + (!vertical && sens > 0 ? n : 0));
}
function remplirDirection(dir) {
  const R = rect();
  if (dir === 'd' && R.r1 === R.r2) return;
  if (dir === 'r' && R.c1 === R.c2) return;
  modifier((F) => {
    for (let r = R.r1; r <= R.r2; r++) for (let c = R.c1; c <= R.c2; c++) {
      if (dir === 'd' ? r === R.r1 : c === R.c1) continue;
      const sr = dir === 'd' ? R.r1 : r, sc = dir === 'r' ? R.c1 : c, src = cellule(F, sr, sc);
      if (!src) { const ex = cellule(F, r, c); if (ex) { ex.v = ''; nettoyer(F, adr(r, c)); } continue; }
      F.cells[adr(r, c)] = { ...src, v: decalerRelatives(src.v, r - sr, c - sc), s: { ...src.s } };
    }
  });
}

/* ================= Presse-papiers ================= */
function copier(e, couper) {
  if (sh.ed) return;
  if (e) e.preventDefault();
  const F = feuille(), R = rect(), lignes = [], cells = [];
  for (let r = R.r1; r <= R.r2; r++) {
    const l = [], cl = [];
    for (let c = R.c1; c <= R.c2; c++) {
      const cell = cellule(F, r, c);
      l.push(afficher(cell, valCell(sh.ctx, F, r, c)));
      cl.push(cell ? JSON.parse(JSON.stringify(cell)) : null);
    }
    lignes.push(l.join('\t')); cells.push(cl);
  }
  const tsv = lignes.join('\n');
  if (e && e.clipboardData) e.clipboardData.setData('text/plain', tsv);
  else if (navigator.clipboard) navigator.clipboard.writeText(tsv).catch(() => {});
  sh.clip = { r1: R.r1, c1: R.c1, r2: R.r2, c2: R.c2, cells, tsv, couper, fid: F.id };
  document.querySelectorAll('#shGrid td.cp').forEach((x) => x.classList.remove('cp'));
  for (let r = R.r1; r <= R.r2; r++) for (let c = R.c1; c <= R.c2; c++) { const td = sh.tds[r] && sh.tds[r][c]; if (td) td.classList.add('cp'); }
  toast(couper ? 'Coupé : choisis la destination puis Ctrl+V' : 'Copié');
}

function coller(e, mode = 'tout') {
  if (sh.ed) return;
  if (e) e.preventDefault();
  const texteCb = e && e.clipboardData ? e.clipboardData.getData('text/plain') : '';
  const R = rect(), c0 = sh.clip;
  modifier((F) => {
    const poseCell = (r, c, v, s, extra) => {
      if (r >= MAXL || c >= MAXC) return;
      if (r >= F.nbL) F.nbL = r + 1;
      if (c >= F.nbC) F.nbC = c + 1;
      if (v === '' && !s && !extra) { poser(F, r, c, ''); return; }
      const ex = cellule(F, r, c);
      F.cells[adr(r, c)] = { ...(extra || {}), v, s: s ? { ...s } : ex ? ex.s : {} };
      nettoyer(F, adr(r, c));
    };
    if (c0 && (texteCb === c0.tsv || !texteCb)) {
      if (c0.couper) { c0.cells.forEach((row, i) => row.forEach((_, j) => delete F.cells[adr(c0.r1 + i, c0.c1 + j)])); sh.clip = null; }
      const h = c0.cells.length, w = c0.cells[0].length;
      const trans = mode === 'transposer';
      for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) {
        const cell = c0.cells[i][j];
        const r = R.r1 + (trans ? j : i), c = R.c1 + (trans ? i : j);
        if (!cell) { if (mode === 'tout' || mode === 'transposer') poseCell(r, c, '', null); continue; }
        const dr = r - (c0.r1 + i), dc = c - (c0.c1 + j);
        if (mode === 'formats') { const ex = cellule(F, r, c); poseCell(r, c, ex ? ex.v : '', cell.s, ex ? { n: ex.n, l: ex.l } : null); }
        else if (mode === 'valeurs') {
          const val = c0.fid === feuille().id ? valCell(sh.ctx, F, c0.r1 + i, c0.c1 + j) : null;
          const ex = cellule(F, r, c);
          poseCell(r, c, val === null ? (cell.v[0] === '=' ? '' : cell.v) : typeof val === 'number' ? String(val).replace('.', ',') : texte(val), ex ? ex.s : null);
        } else if (mode === 'formules') { const ex = cellule(F, r, c); poseCell(r, c, decalerRelatives(cell.v, dr, dc), ex ? ex.s : null); }
        else poseCell(r, c, decalerRelatives(cell.v, dr, dc), cell.s, { n: cell.n, l: cell.l });
      }
    } else if (texteCb) {
      texteCb.replace(/\r/g, '').replace(/\n$/, '').split('\n').forEach((ligne, i) => ligne.split('\t').forEach((v, j) => {
        const fa = v && v[0] !== '=' ? formatAuto(v) : null;
        poseCell(R.r1 + i, R.c1 + j, v, fa ? { ...(cellule(F, R.r1 + i, R.c1 + j) || { s: {} }).s, ...fa } : null);
      }));
    }
  });
  document.querySelectorAll('#shGrid td.cp').forEach((x) => x.classList.remove('cp'));
}
function collerSpecial(mode) {
  if (sh.clip) { coller(null, mode); return; }
  if (navigator.clipboard && navigator.clipboard.readText) navigator.clipboard.readText().then((t) => { if (t) coller({ preventDefault() {}, clipboardData: { getData: () => t } }, 'tout'); }).catch(() => toast('Copie d’abord des cellules (Ctrl+C).'));
  else toast('Copie d’abord des cellules (Ctrl+C).');
}

/* ================= Navigation par la zone de nom ================= */
function allerA(texteNom) {
  const F = feuille(), T = tableur(), t = texteNom.trim();
  if (!t) return;
  const R = parsePlage(t);
  if (R) { selectionner(Math.min(R.r1, F.nbL - 1), Math.min(R.c1, F.nbC - 1), Math.min(R.r2, F.nbL - 1), Math.min(R.c2, F.nbC - 1)); defiler(); return; }
  const cle = t.toUpperCase();
  if (T.noms && T.noms[cle]) {
    const d = T.noms[cle], idx = T.feuilles.findIndex((x) => x.id === d.f);
    if (idx >= 0 && idx !== (ui.feuille || 0)) { ui.feuille = idx; renderGrille(); }
    selectionner(d.r1, d.c1, d.r2, d.c2); defiler();
    return;
  }
  if (!/^[A-Za-zÀ-ÿ_][\wÀ-ÿ.]*$/.test(t) || /^[A-Za-z]{1,3}\d+$/.test(t)) { toast('Nom invalide.'); majSelection(null); return; }
  const Rs = rect();
  T.noms = T.noms || {};
  T.noms[cle] = { f: F.id, r1: Rs.r1, c1: Rs.c1, r2: Rs.r2, c2: Rs.c2 };
  sauver();
  toast(`Nom « ${cle} » défini pour ${textePlage(Rs)}`);
}
