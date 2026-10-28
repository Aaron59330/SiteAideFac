'use strict';
/* ============================================================
   Tableur : souris, clavier, initialisation
   ============================================================ */

function ajusterLargeurAuto(c) {
  modifier((F) => {
    let max = 3;
    for (let r = 0; r < F.nbL; r++) {
      const cell = cellule(F, r, c);
      if (!cell || cell.v === '') continue;
      const t = afficher(cell, valCell(sh.ctx, F, r, c)).split('\n').reduce((a, b) => (b.length > a.length ? b : a), '');
      max = Math.max(max, t.length * ((cell.s.fs || 11) / 11) * (cell.s.b ? 1.1 : 1));
    }
    F.largeurs[c] = Math.max(40, Math.min(500, Math.round(max * 7.6 + 18)));
  });
}

function toucheGrille(e) {
  if (sh.ed) return;
  const k = e.key, ctrl = e.ctrlKey || e.metaKey, maj = e.shiftKey, alt = e.altKey;
  const F = feuille();
  if (alt && k === 'ArrowDown') { const A = actif(), td = sh.tds[A.r] && sh.tds[A.r][A.c]; if (td && validationDe(F, A.r, A.c)) { e.preventDefault(); ouvrirListeDeroulante(td); } return; }
  if (alt && k === '=') { e.preventDefault(); sommeAuto(); return; }
  if (ctrl) {
    const x = k.toLowerCase();
    const fleche = { arrowup: [-1, 0], arrowdown: [1, 0], arrowleft: [0, -1], arrowright: [0, 1] }[x];
    if (fleche) { e.preventDefault(); sautDonnees(fleche[0], fleche[1], maj); return; }
    switch (x) {
      case 'z': e.preventDefault(); if (maj) refaire(); else annuler(); break;
      case 'y': e.preventDefault(); refaire(); break;
      case 'b': e.preventDefault(); appliquerStyle(basculer('b')); break;
      case 'i': e.preventDefault(); appliquerStyle(basculer('i')); break;
      case 'u': e.preventDefault(); appliquerStyle(basculer('u')); break;
      case '5': e.preventDefault(); appliquerStyle(basculer('st')); break;
      case 'a': e.preventDefault(); selectionner(0, 0, F.nbL - 1, F.nbC - 1); break;
      case 'd': e.preventDefault(); remplirDirection('d'); break;
      case 'r': e.preventDefault(); remplirDirection('r'); break;
      case 'f': e.preventDefault(); ouvrirRecherche(false); break;
      case 'h': e.preventDefault(); ouvrirRecherche(true); break;
      case 'k': e.preventDefault(); modifierLien(); break;
      case 'l': if (maj) { e.preventDefault(); basculerFiltre(); } break;
      case 'p': e.preventDefault(); imprimerFeuille(); break;
      case 's': e.preventDefault(); toast('Enregistré automatiquement ✔'); break;
      case '1': e.preventDefault(); ouvrirFormatCellule(); break;
      case 'home': e.preventDefault(); selectionner(0, 0, 0, 0); defiler(); break;
      case 'end': { e.preventDefault(); const z = zoneUtilisee(F); selectionner(Math.max(0, z.r2), Math.max(0, z.c2), Math.max(0, z.r2), Math.max(0, z.c2)); defiler(); break; }
      case ' ': e.preventDefault(); selectionner(0, sh.sel.c1, F.nbL - 1, sh.sel.c2); break;
      case ';': e.preventDefault(); { const d = new Date(); const t = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; const A = actif(); modifier((G) => poser(G, A.r, A.c, maj ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : t)); } break;
      case 'enter': e.preventDefault(); editer(actif().r, actif().c); break;
      default:
    }
    return;
  }
  const mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[k];
  if (mv) { e.preventDefault(); deplacer(mv[0], mv[1], maj); return; }
  if (k === ' ' && maj) { e.preventDefault(); selectionner(sh.sel.r1, 0, sh.sel.r2, F.nbC - 1); return; }
  switch (k) {
    case 'Tab': e.preventDefault(); deplacer(0, maj ? -1 : 1, false); break;
    case 'Enter': e.preventDefault(); if (maj) deplacer(-1, 0, false); else if (rectBrut().r1 !== rectBrut().r2 || rectBrut().c1 !== rectBrut().c2) editer(actif().r, actif().c); else editer(actif().r, actif().c); break;
    case 'F2': e.preventDefault(); editer(actif().r, actif().c); break;
    case 'Delete': case 'Backspace': e.preventDefault(); effacerSelection(); break;
    case 'Home': e.preventDefault(); { const r = sh.sel.r1; selectionner(r, 0, r, 0); defiler(); } break;
    case 'End': e.preventDefault(); { const z = zoneUtilisee(F); selectionner(sh.sel.r1, Math.max(0, z.c2), sh.sel.r1, Math.max(0, z.c2)); defiler(); } break;
    case 'PageDown': e.preventDefault(); deplacer(15, 0, maj); break;
    case 'PageUp': e.preventDefault(); deplacer(-15, 0, maj); break;
    case 'Escape': if (sh.pinceau) { sh.pinceau = null; majRuban(); } sh.clip = null; document.querySelectorAll('#shGrid td.cp').forEach((x) => x.classList.remove('cp')); break;
    case 'F9': e.preventDefault(); renderGrille(); break;
    default:
      if (k.length === 1 && !alt) { e.preventDefault(); const A = actif(); editer(A.r, A.c, k); }
  }
}

function initTableur() {
  const grid = $('#shGrid');
  sh.ed = null; sh.pt = null; fermerAuto();
  renderRuban();
  renderGrille();
  grid.focus({ preventScroll: true });
  majRuban();

  grid.addEventListener('mousedown', (e) => {
    const F = feuille(), t = e.target;
    if (e.button === 2) {
      const td = t.closest('td');
      if (td && !td.classList.contains('sel')) { finirEdition(true); selectionner(+td.dataset.r, +td.dataset.c, +td.dataset.r, +td.dataset.c); }
      return;
    }
    const rs = t.closest('[data-rs]');
    if (rs) { e.preventDefault(); sh.drag = { type: 'rc', c: +rs.dataset.rs, x0: e.clientX, w0: F.largeurs[+rs.dataset.rs] || LARG_DEF }; return; }
    const rsr = t.closest('[data-rsr]');
    if (rsr) { e.preventDefault(); sh.drag = { type: 'rr', r: +rsr.dataset.rsr, y0: e.clientY, h0: F.hauteurs[+rsr.dataset.rsr] || HAUT_DEF }; return; }
    if (t.closest('[data-fh]')) { e.preventDefault(); sh.drag = { type: 'fill', src: rect(), cible: null }; return; }
    if (t.closest('.flb, .dvb')) { e.preventDefault(); return; }
    const ch = t.closest('[data-ch]');
    if (ch) { finirEdition(true); const c = +ch.dataset.ch; const c0 = e.shiftKey ? sh.sel.c1 : c; selectionner(0, c0, F.nbL - 1, c); sh.drag = { type: 'col', c0 }; grid.focus(); return; }
    const rh = t.closest('[data-rh]');
    if (rh) { finirEdition(true); const r = +rh.dataset.rh; const r0 = e.shiftKey ? sh.sel.r1 : r; selectionner(r0, 0, r, F.nbC - 1); sh.drag = { type: 'row', r0 }; grid.focus(); return; }
    if (t.closest('[data-all]')) { finirEdition(true); selectionner(0, 0, F.nbL - 1, F.nbC - 1); return; }
    const td = t.closest('td');
    if (!td) return;
    const r = +td.dataset.r, c = +td.dataset.c;
    if (sh.ed) {
      const ta = sh.ed.ta;
      if (td.contains(ta)) return;
      const avant = ta.value.slice(0, ta.selectionStart);
      if (ta.value[0] === '=' && (!avant || OPS_FORMULE.test(avant) || sh.pt)) {
        e.preventDefault();
        sh.pt = null;
        ta.setRangeText(adr(r, c), ta.selectionStart, ta.selectionEnd, 'end');
        ta.dispatchEvent(new Event('input'));
        return;
      }
      finirEdition(true);
    }
    if (!e.shiftKey && t.closest('[data-chk], a[data-lien]')) { selectionner(r, c, r, c); return; }
    e.preventDefault();
    if (e.shiftKey) selectionner(sh.sel.r1, sh.sel.c1, r, c); else selectionner(r, c, r, c);
    sh.drag = { type: 'sel' };
    grid.focus({ preventScroll: true });
  });

  grid.addEventListener('mouseover', (e) => {
    const d = sh.drag;
    if (!d) return;
    const td = e.target.closest('td'), F = feuille();
    if (d.type === 'sel' && td) selectionner(sh.sel.r1, sh.sel.c1, +td.dataset.r, +td.dataset.c);
    else if (d.type === 'col') { const ch = e.target.closest('[data-ch]'); if (ch) selectionner(0, d.c0, F.nbL - 1, +ch.dataset.ch); }
    else if (d.type === 'row') { const rh = e.target.closest('[data-rh]'); if (rh) selectionner(d.r0, 0, +rh.dataset.rh, F.nbC - 1); }
    else if (d.type === 'fill' && td) {
      d.cible = { r: +td.dataset.r, c: +td.dataset.c };
      sh.fp.forEach((x) => x.classList.remove('fp')); sh.fp = [];
      const s = d.src;
      const dR = d.cible.r > s.r2 ? d.cible.r - s.r2 : d.cible.r < s.r1 ? d.cible.r - s.r1 : 0, dC = d.cible.c > s.c2 ? d.cible.c - s.c2 : d.cible.c < s.c1 ? d.cible.c - s.c1 : 0;
      const vert = Math.abs(dR) >= Math.abs(dC);
      const zone = vert ? { r1: dR > 0 ? s.r2 + 1 : d.cible.r, r2: dR > 0 ? d.cible.r : s.r1 - 1, c1: s.c1, c2: s.c2 } : { c1: dC > 0 ? s.c2 + 1 : d.cible.c, c2: dC > 0 ? d.cible.c : s.c1 - 1, r1: s.r1, r2: s.r2 };
      for (let r = zone.r1; r <= zone.r2; r++) for (let c = zone.c1; c <= zone.c2; c++) { const x = sh.tds[r] && sh.tds[r][c]; if (x) { x.classList.add('fp'); sh.fp.push(x); } }
    }
  });

  grid.addEventListener('dblclick', (e) => {
    const rs = e.target.closest('[data-rs]');
    if (rs) { ajusterLargeurAuto(+rs.dataset.rs); return; }
    const rsr = e.target.closest('[data-rsr]');
    if (rsr) { modifier((F) => { delete F.hauteurs[+rsr.dataset.rsr]; }); return; }
    const td = e.target.closest('td');
    if (td && !sh.ed && !e.target.closest('.flb, .dvb, [data-chk]')) editer(+td.dataset.r, +td.dataset.c);
  });

  grid.addEventListener('click', (e) => {
    const lien = e.target.closest('a[data-lien]');
    if (lien && !(e.ctrlKey || e.metaKey)) { e.preventDefault(); toast('Ctrl + clic pour ouvrir le lien'); return; }
    const chk = e.target.closest('[data-chk]');
    if (chk && !e.shiftKey) {
      const td = chk.closest('td'), r = +td.dataset.r, c = +td.dataset.c, F = feuille(), val = valCell(sh.ctx, F, r, c);
      modifier((G) => poser(G, r, c, val === true ? 'FAUX' : 'VRAI'));
      return;
    }
    const fl = e.target.closest('[data-fl]');
    if (fl) { e.stopPropagation(); ouvrirFiltre(+fl.dataset.fl, fl.closest('td')); return; }
    const dv = e.target.closest('[data-dv]');
    if (dv) { e.stopPropagation(); ouvrirListeDeroulante(dv.closest('td')); }
  });

  grid.addEventListener('contextmenu', (e) => {
    if (!e.target.closest('td, th')) return;
    e.preventDefault();
    if (sh.ed) finirEdition(true);
    menuContextuel(e);
  });

  grid.addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    definirZoom(feuille().zoom + (e.deltaY < 0 ? 10 : -10));
  }, { passive: false });

  grid.addEventListener('keydown', toucheGrille);
  grid.addEventListener('copy', (e) => copier(e, false));
  grid.addEventListener('cut', (e) => copier(e, true));
  grid.addEventListener('paste', (e) => coller(e, 'tout'));

  const bar = $('#shFormule');
  bar.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = completerParentheses(bar.value), A = actif(), F = feuille();
      const err = verifierValidation(F, A.r, A.c, v);
      if (err) { alert(err); return; }
      if (sh.ed) { sh.ed.ta.value = v; finirEdition(true, 1, 0); return; }
      modifier((G) => poser(G, A.r, A.c, v));
      selectionner(Math.min(A.r + 1, F.nbL - 1), A.c, Math.min(A.r + 1, F.nbL - 1), A.c);
      grid.focus({ preventScroll: true });
    } else if (e.key === 'Escape') { bar.value = brut(feuille(), actif().r, actif().c); grid.focus({ preventScroll: true }); }
  });
  bar.addEventListener('focus', () => { if (sh.ed) return; });

  const box = $('#shAddr');
  box.addEventListener('focus', () => box.select());
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); const v = box.value; box.blur(); allerA(v); grid.focus({ preventScroll: true }); }
    else if (e.key === 'Escape') { box.blur(); majSelection(null); grid.focus({ preventScroll: true }); }
  });
  box.addEventListener('blur', () => majSelection(null));
}

/* ---- Événements globaux (enregistrés une seule fois) ---- */
document.addEventListener('mousemove', (e) => {
  const d = sh.drag;
  if (!d || (d.type !== 'rc' && d.type !== 'rr')) return;
  const F = feuille(), z = zf(F);
  if (d.type === 'rc') {
    const w = Math.max(30, Math.min(600, d.w0 + (e.clientX - d.x0) / z));
    d.w = w;
    const col = document.querySelector(`#shGrid col[data-col="${d.c}"]`);
    if (col) col.style.width = Math.round(w * z) + 'px';
  } else {
    const h = Math.max(14, Math.min(400, d.h0 + (e.clientY - d.y0) / z));
    d.h = h;
    const tr = document.querySelector(`#shGrid tr[data-r="${d.r}"]`);
    if (tr) tr.style.height = Math.round(h * z) + 'px';
  }
});
document.addEventListener('mouseup', () => {
  const d = sh.drag;
  if (!d) return;
  sh.drag = null;
  if (ui.view !== 'sheet') return;
  if (d.type === 'rc' && d.w) modifier((F) => { F.largeurs[d.c] = Math.round(d.w); });
  else if (d.type === 'rr' && d.h) modifier((F) => { F.hauteurs[d.r] = Math.round(d.h); });
  else if (d.type === 'fill') {
    sh.fp.forEach((x) => x.classList.remove('fp')); sh.fp = [];
    if (d.cible) remplir(d.src, d.cible);
  } else if (d.type === 'sel' && sh.pinceau) appliquerPinceau();
});

/* Raccourcis annuler / rétablir même quand le focus est sur le ruban */
document.addEventListener('keydown', (e) => {
  if (ui.view !== 'sheet' || sh.ed || !(e.ctrlKey || e.metaKey)) return;
  const t = e.target;
  if (t.closest && (t.closest('#shGrid') || t.closest('#shDlg'))) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
  const k = e.key.toLowerCase();
  if (k === 'z') { e.preventDefault(); if (e.shiftKey) refaire(); else annuler(); }
  else if (k === 'y') { e.preventDefault(); refaire(); }
});
