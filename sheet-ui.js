'use strict';
/* ============================================================
   Tableur : interface (grille, barre d'outils, graphiques, modèles)
   ============================================================ */

const PALETTE = ['#f0b27a', '#74c0fc', '#8ce99a', '#ffa8a8', '#d0bfff', '#ffe066', '#63e6be', '#faa2c1'];
const LARG_DEF = 96, LARG_ENT = 46;
const sh = { sel: { r1: 0, c1: 0, r2: 0, c2: 0 }, ed: null, tds: [], drag: null, clip: null, histo: { id: null, undo: [], redo: [] }, ctx: null, fp: [] };

const tableur = () => db.tableurs.find((t) => t.id === ui.tabId);
const feuille = () => { const t = tableur(); return t ? t.feuilles[Math.min(ui.feuille || 0, t.feuilles.length - 1)] : null; };
const nouvelleFeuille = (nom) => ({ id: uid(), nom, cells: {}, nbL: 30, nbC: 12, largeurs: {}, graphs: [] });
const rect = () => ({ r1: Math.min(sh.sel.r1, sh.sel.r2), r2: Math.max(sh.sel.r1, sh.sel.r2), c1: Math.min(sh.sel.c1, sh.sel.c2), c2: Math.max(sh.sel.c1, sh.sel.c2) });
const largeur = (F, c) => F.largeurs[c] || LARG_DEF;
const brut = (F, r, c) => (F.cells[adr(r, c)] ? F.cells[adr(r, c)].v : '');

/* ================= Modèles ================= */
function depuisLignes(rows) {
  const cells = {};
  rows.forEach((row, r) => row.forEach((v, c) => {
    if (v === '' || v == null) return;
    cells[adr(r, c)] = { v: String(v), s: r === 0 ? { b: true, bg: '#2a2a31' } : {} };
  }));
  return cells;
}
function styler(cells, a, s) { if (!cells[a]) cells[a] = { v: '', s: {} }; Object.assign(cells[a].s, s); }

const MODELES = [
  { id: 'vide', nom: 'Nouveau tableur', ic: '▦', titre: 'Tableur vide', desc: 'Une feuille blanche pour tout faire.', build: () => ({ cells: {} }) },
  {
    id: 'moyenne', nom: 'Calcul de moyenne', ic: '🧮', titre: 'Calcul de moyenne', desc: 'Notes × coefficients, moyenne pondérée et mention.',
    build() {
      const mats = db.matieres.slice(0, 12).map((m) => m.nom), n = mats.length;
      const rows = [['Matière', 'Note /20', 'Coefficient', 'Note × coef']];
      mats.forEach((nom, i) => rows.push([nom, '', '1', `=SI(B${i + 2}="";"";B${i + 2}*C${i + 2})`]));
      const fin = n + 1;
      rows.push([]);
      rows.push(['Moyenne générale', `=SIERREUR(SOMMEPROD(B2:B${fin};C2:C${fin})/SOMME.SI(B2:B${fin};">=0";C2:C${fin});"")`]);
      rows.push(['Mention', `=SI(B${n + 3}="";"";SI(B${n + 3}>=16;"Très bien";SI(B${n + 3}>=14;"Bien";SI(B${n + 3}>=12;"Assez bien";SI(B${n + 3}>=10;"Passable";"Insuffisant")))))`]);
      const cells = depuisLignes(rows);
      styler(cells, `A${n + 3}`, { b: true }); styler(cells, `B${n + 3}`, { b: true, fmt: 'n', dec: 2, bg: '#35301f' }); styler(cells, `A${n + 4}`, { b: true }); styler(cells, `B${n + 4}`, { b: true });
      for (let r = 2; r <= fin; r++) styler(cells, `D${r}`, { fmt: 'n', dec: 2 });
      return { cells, nbL: Math.max(30, n + 12), largeurs: { 0: 170, 1: 100, 2: 110, 3: 110 }, graphs: [{ id: uid(), type: 'bar', range: `A1:B${fin}`, titre: 'Notes par matière' }] };
    },
  },
  {
    id: 'suivi', nom: 'Suivi des notes', ic: '📈', titre: 'Suivi des notes', desc: 'Tes devoirs surveillés, moyennes et écart à ton objectif.',
    build() {
      const mats = db.matieres.slice(0, 12).map((m) => m.nom), n = mats.length;
      const rows = [['Matière', 'DS 1', 'DS 2', 'DS 3', 'Moyenne', 'Objectif', 'Écart']];
      mats.forEach((nom, i) => { const r = i + 2; rows.push([nom, '', '', '', `=SIERREUR(MOYENNE(B${r}:D${r});"")`, '14', `=SI(E${r}="";"";E${r}-F${r})`]); });
      rows.push([]);
      rows.push(['Moyenne générale', '', '', '', `=SIERREUR(MOYENNE(E2:E${n + 1});"")`]);
      const cells = depuisLignes(rows);
      for (let r = 2; r <= n + 1; r++) { styler(cells, `E${r}`, { fmt: 'n', dec: 2, b: true }); styler(cells, `G${r}`, { fmt: 'n', dec: 2 }); }
      styler(cells, `A${n + 3}`, { b: true }); styler(cells, `E${n + 3}`, { b: true, fmt: 'n', dec: 2, bg: '#35301f' });
      return { cells, nbL: Math.max(30, n + 12), largeurs: { 0: 170 } };
    },
  },
  {
    id: 'planning', nom: 'Planning de révisions', ic: '🗓️', titre: 'Planning de révisions', desc: 'Organise tes séances jour par jour avec le total d’heures.',
    build() {
      const mats = db.matieres.map((m) => m.nom), rows = [['Date', 'Matière', 'Sujet', 'Durée (h)', 'Fait ?']];
      const auj = new Date();
      for (let i = 0; i < 14; i++) {
        const d = new Date(auj); d.setDate(d.getDate() + i);
        rows.push([`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`, mats[i % mats.length] || '', '', '1', '']);
      }
      rows.push([]);
      rows.push(['', '', 'Total prévu (h)', '=SOMME(D2:D15)']);
      rows.push(['', '', 'Déjà fait (h)', '=SOMME.SI(E2:E15;"oui";D2:D15)']);
      rows.push(['', '', 'Avancement', '=SIERREUR(D18/D17;0)']);
      const cells = depuisLignes(rows);
      for (let r = 2; r <= 15; r++) styler(cells, `A${r}`, { fmt: 'date' });
      styler(cells, 'D19', { fmt: 'pct', b: true, bg: '#35301f' }); styler(cells, 'C17', { b: true }); styler(cells, 'C18', { b: true }); styler(cells, 'C19', { b: true });
      return { cells, nbL: 30, largeurs: { 0: 100, 1: 150, 2: 170, 3: 90 } };
    },
  },
  {
    id: 'budget', nom: 'Budget étudiant', ic: '💶', titre: 'Budget étudiant', desc: 'Dépenses, total et répartition par catégorie avec graphique.',
    build() {
      const rows = [['Date', 'Description', 'Catégorie', 'Montant (€)', '', 'Catégorie', 'Total'],
        ['01/09/2026', 'Courses', 'Courses', '42,5', '', 'Courses', '=SOMME.SI(C2:C30;F2;D2:D30)'],
        ['03/09/2026', 'Pass de transport', 'Transport', '30', '', 'Transport', '=SOMME.SI(C2:C30;F3;D2:D30)'],
        ['05/09/2026', 'Cinéma', 'Loisirs', '11', '', 'Loisirs', '=SOMME.SI(C2:C30;F4;D2:D30)'],
        ['', '', '', '', '', 'Logement', '=SOMME.SI(C2:C30;F5;D2:D30)'],
        ['', '', '', '', '', '', ''],
        ['', '', '', '', '', 'Total dépenses', '=SOMME(D2:D30)']];
      const cells = depuisLignes(rows);
      cells.F1.s.bg = '#2a2a31'; cells.G1.s.bg = '#2a2a31'; cells.F1.s.b = cells.G1.s.b = true;
      for (let r = 2; r <= 30; r++) styler(cells, `D${r}`, { fmt: 'eur' });
      for (let r = 2; r <= 5; r++) styler(cells, `G${r}`, { fmt: 'eur' });
      styler(cells, 'G7', { fmt: 'eur', b: true, bg: '#35301f' }); styler(cells, 'F7', { b: true });
      for (let r = 2; r <= 4; r++) styler(cells, `A${r}`, { fmt: 'date' });
      return { cells, nbL: 40, largeurs: { 0: 100, 1: 170, 2: 110, 3: 110, 4: 30, 5: 120, 6: 100 }, graphs: [{ id: uid(), type: 'pie', range: 'F1:G5', titre: 'Répartition des dépenses' }] };
    },
  },
];

function creerTableur(id) {
  const m = MODELES.find((x) => x.id === id) || MODELES[0];
  const f = Object.assign(nouvelleFeuille('Feuille 1'), m.build());
  f.graphs = (f.graphs || []).map((g) => ({ ...g, id: uid() }));
  const t = { id: uid(), nom: m.nom, date: Date.now(), feuilles: [f] };
  db.tableurs.push(t);
  journaliser('Tableur créé : ' + t.nom);
  sauver();
  sh.sel = { r1: 0, c1: 0, r2: 0, c2: 0 };
  aller('sheet', { tabId: t.id, feuille: 0 });
}

/* ================= Vues ================= */
function vueTableurs() {
  const liste = [...db.tableurs].sort((a, b) => b.date - a.date);
  return `<div class="head"><div><h2>Tableurs</h2><p class="sub">Un petit Excel intégré : formules, mise en forme, graphiques, import/export CSV.</p></div>
    <div class="actions"><button class="btn primary" data-tb="new:vide">＋ Nouveau tableur</button></div></div>
    ${liste.length ? `<h3 class="group-title">Mes tableurs</h3><div class="cours-list">${liste.map((t) => `<div class="cours" data-tb="open:${t.id}" style="--mc:#f0b27a">
      <h3>▦ ${esc(t.nom)}</h3><small>${t.feuilles.length} feuille(s) · ${new Date(t.date).toLocaleDateString('fr-FR')}</small></div>`).join('')}</div>` : ''}
    <h3 class="group-title">Partir d’un modèle</h3>
    <div class="cours-list">${MODELES.map((m) => `<div class="cours" data-tb="new:${m.id}" style="--mc:#74c0fc"><h3>${m.ic} ${esc(m.titre)}</h3><small>${esc(m.desc)}</small></div>`).join('')}</div>`;
}

const FONCTIONS = [
  ['SOMME', 'Additionne'], ['MOYENNE', 'Moyenne'], ['MIN', 'Plus petite valeur'], ['MAX', 'Plus grande valeur'], ['NB', 'Compte les nombres'],
  ['SI', 'Condition : SI(test;oui;non)'], ['SOMME.SI', 'Somme selon un critère'], ['NB.SI', 'Compte selon un critère'], ['MOYENNE.SI', 'Moyenne selon un critère'],
  ['SOMMEPROD', 'Notes × coefficients'], ['ARRONDI', 'Arrondit'], ['MEDIANE', 'Médiane'], ['ECARTYPE', 'Écart-type'], ['RANG', 'Classement'],
  ['RECHERCHEV', 'Recherche dans un tableau'], ['SIERREUR', 'Remplace une erreur'], ['ET', 'Toutes vraies'], ['OU', 'Une vraie'], ['CONCATENER', 'Assemble du texte'],
  ['AUJOURDHUI', 'Date du jour'], ['ALEA.ENTRE.BORNES', 'Nombre au hasard'],
];

function vueTableur() {
  const t = tableur();
  if (!t) { ui.view = 'tableurs'; return vueTableurs(); }
  const btn = (act, txt, tip) => `<button class="tbtn" data-sh="${act}" title="${tip || ''}">${txt}</button>`;
  return `<div class="head"><div><p class="sub" style="margin:0 0 4px"><a href="#" data-tb="retour">← Mes tableurs</a></p>
      <h2><input id="shNom" class="titre-in" value="${esc(t.nom)}" aria-label="Nom du tableur"></h2></div>
    <div class="actions"><button class="btn" data-sh="csvOut">⬇ Export CSV</button><label class="btn">⬆ Import CSV<input id="shCsv" type="file" accept=".csv,.txt,.tsv" hidden></label>
      <button class="btn" data-sh="imprimer">🖨️ Imprimer</button><button class="btn ghost danger" data-sh="supprTab">🗑️</button></div></div>
  <div class="sheet">
    <div class="shbar">
      ${btn('undo', '↶', 'Annuler (Ctrl+Z)')}${btn('redo', '↷', 'Rétablir (Ctrl+Y)')}<i class="sep"></i>
      ${btn('b', '<b>G</b>', 'Gras (Ctrl+B)')}${btn('i', '<i>I</i>', 'Italique (Ctrl+I)')}${btn('u', '<u>S</u>', 'Souligné (Ctrl+U)')}
      <label class="tbtn clr" title="Couleur du texte">A<input type="color" id="shColor" value="#f3f3f4"></label>
      <label class="tbtn clr" title="Couleur de fond">▧<input type="color" id="shBg" value="#2a2a31"></label>${btn('nobg', '∅', 'Retirer les couleurs')}<i class="sep"></i>
      ${btn('al:left', '⇤', 'Aligner à gauche')}${btn('al:center', '↔', 'Centrer')}${btn('al:right', '⇥', 'Aligner à droite')}<i class="sep"></i>
      <select id="shFmt" title="Format"><option value="">Auto</option><option value="n">Nombre</option><option value="pct">Pourcentage</option><option value="eur">Euro</option><option value="date">Date</option></select>
      ${btn('dec-', '.0←', 'Moins de décimales')}${btn('dec+', '.00→', 'Plus de décimales')}<i class="sep"></i>
      <details class="more"><summary class="tbtn">ƒx Fonctions</summary><div class="menu fnmenu">${FONCTIONS.map(([n, d]) => `<button data-sh="fn:${n}"><b>${n}</b> <small>${esc(d)}</small></button>`).join('')}</div></details>
      ${btn('somme', 'Σ', 'Somme automatique')}<i class="sep"></i>
      ${btn('insL', '＋ Ligne', 'Insérer une ligne au-dessus')}${btn('insC', '＋ Col.', 'Insérer une colonne à gauche')}${btn('delL', '− Ligne', 'Supprimer la ligne')}${btn('delC', '− Col.', 'Supprimer la colonne')}<i class="sep"></i>
      ${btn('tri:asc', 'A→Z', 'Trier croissant')}${btn('tri:desc', 'Z→A', 'Trier décroissant')}
      <details class="more"><summary class="tbtn">📊 Graphique</summary><div class="menu"><button data-sh="graph:bar">Barres</button><button data-sh="graph:line">Courbe</button><button data-sh="graph:pie">Camembert</button></div></details>
    </div>
    <div class="shformula"><span id="shAddr">A1</span><i>ƒx</i><input id="shFormule" autocomplete="off" placeholder="Valeur ou formule, ex : =SOMME(B2:B10)"></div>
    <div class="shgrid" id="shGrid" tabindex="0"></div>
    <div id="shGraphs" class="shgraphs"></div>
    <div class="shtabs" id="shTabs"></div>
    <p class="muted">Astuce : sépare les arguments avec « ; » — ex. <code>=SI(B2&gt;=10;"Reçu";"À revoir")</code>. Glisse le petit carré d’une cellule pour recopier. Clique une cellule pendant que tu écris une formule pour insérer sa référence.</p>
  </div>`;
}

/* ================= Historique ================= */
const instantane = (F) => JSON.stringify({ cells: F.cells, nbL: F.nbL, nbC: F.nbC, largeurs: F.largeurs, graphs: F.graphs });
function pousser(F) {
  if (sh.histo.id !== F.id) sh.histo = { id: F.id, undo: [], redo: [] };
  sh.histo.undo.push(instantane(F));
  if (sh.histo.undo.length > 80) sh.histo.undo.shift();
  sh.histo.redo = [];
}
function modifier(fn) {
  finirEdition(true);
  const F = feuille();
  pousser(F);
  fn(F);
  sauver();
  renderGrille();
}
function annuler() {
  const F = feuille();
  if (sh.histo.id !== F.id || !sh.histo.undo.length) return;
  sh.histo.redo.push(instantane(F));
  Object.assign(F, JSON.parse(sh.histo.undo.pop()));
  sauver(); renderGrille();
}
function refaire() {
  const F = feuille();
  if (sh.histo.id !== F.id || !sh.histo.redo.length) return;
  sh.histo.undo.push(instantane(F));
  Object.assign(F, JSON.parse(sh.histo.redo.pop()));
  sauver(); renderGrille();
}

/* ================= Rendu de la grille ================= */
function afficher(cell, val) {
  if (estErr(val)) return val.err;
  if (val === null) return '';
  if (typeof val === 'boolean') return val ? 'VRAI' : 'FAUX';
  if (typeof val !== 'number') return String(val);
  const s = cell ? cell.s : {}, raw = cell ? cell.v.trim() : '';
  if (raw[0] !== '=' && !s.fmt && (/%$/.test(raw) || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw))) return raw;
  const nf = (x, d) => x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  switch (s.fmt) {
    case 'n': return nf(val, s.dec ?? 2);
    case 'pct': return nf(val * 100, s.dec ?? 0) + ' %';
    case 'eur': return nf(val, s.dec ?? 2) + ' €';
    case 'date': return fmtSerie(val);
    default: return s.dec != null ? nf(val, s.dec) : fmtNombre(val);
  }
}

function styleCss(cell, val) {
  const s = cell ? cell.s : {};
  const al = s.al || (typeof val === 'number' ? 'right' : typeof val === 'boolean' || estErr(val) ? 'center' : 'left');
  return `text-align:${al};${s.b ? 'font-weight:700;' : ''}${s.i ? 'font-style:italic;' : ''}${s.u ? 'text-decoration:underline;' : ''}${s.c ? `color:${s.c};` : ''}${s.bg ? `background:${s.bg};` : ''}`;
}

function renderGrille() {
  const F = feuille(), T = tableur();
  if (!F) return;
  const grid = $('#shGrid');
  const sx = grid.scrollLeft, sy = grid.scrollTop;
  sh.ctx = nouveauCtx(T);
  let h = `<table class="sh"><colgroup><col style="width:${LARG_ENT}px">`;
  for (let c = 0; c < F.nbC; c++) h += `<col data-col="${c}" style="width:${largeur(F, c)}px">`;
  h += '</colgroup><thead><tr><th class="corner" data-all="1"></th>';
  for (let c = 0; c < F.nbC; c++) h += `<th class="ch" data-ch="${c}">${colNom(c)}<i class="rs" data-rs="${c}"></i></th>`;
  h += '</tr></thead><tbody>';
  for (let r = 0; r < F.nbL; r++) {
    h += `<tr><th class="rh" data-rh="${r}">${r + 1}</th>`;
    for (let c = 0; c < F.nbC; c++) {
      const cell = F.cells[adr(r, c)], val = valCell(sh.ctx, F, r, c);
      const err = estErr(val);
      h += `<td data-r="${r}" data-c="${c}" class="${err ? 'er' : ''}" style="${styleCss(cell, val)}">${esc(afficher(cell, val))}</td>`;
    }
    h += '</tr>';
  }
  grid.innerHTML = h + '</tbody></table>';
  grid.scrollLeft = sx; grid.scrollTop = sy;
  sh.tds = [];
  grid.querySelectorAll('tbody tr').forEach((tr, r) => { sh.tds[r] = [...tr.querySelectorAll('td')]; });
  sh.fp = [];
  const s = sh.sel;
  s.r1 = Math.min(s.r1, F.nbL - 1); s.r2 = Math.min(s.r2, F.nbL - 1); s.c1 = Math.min(s.c1, F.nbC - 1); s.c2 = Math.min(s.c2, F.nbC - 1);
  majSelection(null);
  renderGraphs();
  renderOnglets();
}

function majSelection(ancien) {
  const F = feuille();
  if (!F) return;
  const bascule = (rc, on) => {
    for (let r = rc.r1; r <= rc.r2; r++) for (let c = rc.c1; c <= rc.c2; c++) {
      const td = sh.tds[r] && sh.tds[r][c];
      if (!td) continue;
      td.classList.toggle('sel', on);
      if (!on) { td.classList.remove('act'); const fh = td.querySelector('.fh'); if (fh) fh.remove(); }
    }
  };
  if (ancien) bascule(ancien, false);
  else document.querySelectorAll('#shGrid td.sel').forEach((td) => { td.classList.remove('sel', 'act'); const fh = td.querySelector('.fh'); if (fh) fh.remove(); });
  const n = rect();
  bascule(n, true);
  const a = sh.tds[sh.sel.r1] && sh.tds[sh.sel.r1][sh.sel.c1];
  if (a) a.classList.add('act');
  const coin = sh.tds[n.r2] && sh.tds[n.r2][n.c2];
  if (coin && !sh.ed && !coin.querySelector('.fh')) { const fh = document.createElement('i'); fh.className = 'fh'; fh.dataset.fh = '1'; coin.appendChild(fh); }
  $('#shAddr').textContent = adr(sh.sel.r1, sh.sel.c1) + (n.r1 !== n.r2 || n.c1 !== n.c2 ? ':' + adr(n.r2, n.c2) : '');
  if (!sh.ed && document.activeElement !== $('#shFormule')) $('#shFormule').value = brut(F, sh.sel.r1, sh.sel.c1);
  const cell = F.cells[adr(sh.sel.r1, sh.sel.c1)];
  $('#shFmt').value = (cell && cell.s.fmt) || '';
}

function selectionner(r1, c1, r2, c2) {
  const ancien = rect();
  sh.sel = { r1, c1, r2, c2 };
  majSelection(ancien);
}
function defiler() { const td = sh.tds[sh.sel.r2] && sh.tds[sh.sel.r2][sh.sel.c2]; if (td) td.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }

/* ================= Édition ================= */
function editer(r, c, init) {
  finirEdition(true);
  const F = feuille(), td = sh.tds[r] && sh.tds[r][c];
  if (!td) return;
  selectionner(r, c, r, c);
  td.classList.add('edit');
  td.textContent = '';
  const inp = document.createElement('input');
  inp.value = init !== undefined ? init : brut(F, r, c);
  td.appendChild(inp);
  inp.focus();
  inp.setSelectionRange(inp.value.length, inp.value.length);
  sh.ed = { r, c, inp };
  $('#shFormule').value = inp.value;
  inp.addEventListener('input', () => { $('#shFormule').value = inp.value; });
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); finirEdition(true, e.shiftKey ? -1 : 1, 0); }
    else if (e.key === 'Tab') { e.preventDefault(); finirEdition(true, 0, e.shiftKey ? -1 : 1); }
    else if (e.key === 'Escape') { e.preventDefault(); finirEdition(false); }
    e.stopPropagation();
  });
  inp.addEventListener('blur', () => { if (sh.ed && sh.ed.inp === inp) finirEdition(true); });
}

function poser(F, r, c, valeur) {
  const a = adr(r, c);
  let cell = F.cells[a];
  if (valeur === '' && !cell) return;
  if (!cell) cell = F.cells[a] = { v: '', s: {} };
  cell.v = valeur;
  if (valeur && valeur[0] !== '=' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(valeur.trim()) && !cell.s.fmt) cell.s.fmt = 'date';
  if (cell.v === '' && !Object.keys(cell.s).length) delete F.cells[a];
}

function finirEdition(valider, dr = 0, dc = 0) {
  const ed = sh.ed;
  if (!ed) return;
  sh.ed = null;
  const valeur = ed.inp.value;
  const F = feuille();
  if (valider && valeur !== brut(F, ed.r, ed.c)) {
    pousser(F);
    poser(F, ed.r, ed.c, valeur);
    sauver();
  }
  renderGrille();
  const r = Math.max(0, Math.min(F.nbL - 1, ed.r + dr)), c = Math.max(0, Math.min(F.nbC - 1, ed.c + dc));
  selectionner(r, c, r, c);
  $('#shGrid').focus({ preventScroll: true });
}

/* ================= Opérations ================= */
function appliquerStyle(patch) {
  const R = rect();
  modifier((F) => {
    const premier = F.cells[adr(sh.sel.r1, sh.sel.c1)];
    for (let r = R.r1; r <= R.r2; r++) for (let c = R.c1; c <= R.c2; c++) {
      const a = adr(r, c);
      if (!F.cells[a]) F.cells[a] = { v: '', s: {} };
      const p = typeof patch === 'function' ? patch(F.cells[a].s, premier ? premier.s : {}) : patch;
      Object.assign(F.cells[a].s, p);
      Object.keys(F.cells[a].s).forEach((k) => { if (F.cells[a].s[k] === undefined || F.cells[a].s[k] === false || F.cells[a].s[k] === '') delete F.cells[a].s[k]; });
      if (F.cells[a].v === '' && !Object.keys(F.cells[a].s).length) delete F.cells[a];
    }
  });
}
const basculer = (cle) => (s, premier) => ({ [cle]: !premier[cle] });

function effacerSelection() {
  const R = rect();
  modifier((F) => { for (let r = R.r1; r <= R.r2; r++) for (let c = R.c1; c <= R.c2; c++) poser(F, r, c, ''); });
}

function deplacer(dr, dc, etendre) {
  const F = feuille();
  const base = etendre ? { r: sh.sel.r2, c: sh.sel.c2 } : { r: sh.sel.r1, c: sh.sel.c1 };
  const r = Math.max(0, Math.min(F.nbL - 1, base.r + dr)), c = Math.max(0, Math.min(F.nbC - 1, base.c + dc));
  if (etendre) selectionner(sh.sel.r1, sh.sel.c1, r, c); else selectionner(r, c, r, c);
  defiler();
}

function deplacerAxe(F, axe, idx, delta) {
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
  F.graphs.forEach((g) => { g.range = decalerAxe('=' + g.range, axe, idx, delta).slice(1); });
  if (axe === 'c') {
    const l = {};
    for (const [k, w] of Object.entries(F.largeurs)) { let c = +k; if (delta < 0 && c === idx) continue; if (delta > 0 ? c >= idx : c > idx) c += delta; l[c] = w; }
    F.largeurs = l;
  }
}
function insererAxe(axe) {
  const R = rect(), idx = axe === 'r' ? R.r1 : R.c1;
  modifier((F) => {
    if (axe === 'r' ? F.nbL >= MAXL : F.nbC >= MAXC) return;
    deplacerAxe(F, axe, idx, 1);
    if (axe === 'r') F.nbL++; else F.nbC++;
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
  const F = feuille();
  selectionner(Math.min(sh.sel.r1, F.nbL - 1), Math.min(sh.sel.c1, F.nbC - 1), Math.min(sh.sel.r1, F.nbL - 1), Math.min(sh.sel.c1, F.nbC - 1));
}

function zoneUtilisee(F) {
  let r2 = -1, c2 = -1;
  for (const [a, cell] of Object.entries(F.cells)) { if (cell.v === '') continue; const p = parseAdr(a); r2 = Math.max(r2, p.r); c2 = Math.max(c2, p.c); }
  return { r1: 0, c1: 0, r2, c2 };
}

function trier(sens) {
  const F = feuille();
  let R = rect();
  const unique = R.r1 === R.r2 && R.c1 === R.c2;
  let entete = false;
  if (unique) {
    const z = zoneUtilisee(F);
    if (z.r2 < 1) return;
    R = { r1: 0, r2: z.r2, c1: 0, c2: z.c2, cle: sh.sel.c1 };
    entete = confirm('Trier toute la feuille selon la colonne ' + colNom(sh.sel.c1) + '.\nLa première ligne est-elle un en-tête (à ne pas trier) ?');
  } else R.cle = R.c1;
  modifier((G) => {
    const debut = R.r1 + (entete ? 1 : 0);
    const lignes = [];
    for (let r = debut; r <= R.r2; r++) {
      const cells = {};
      for (let c = R.c1; c <= R.c2; c++) { const cell = G.cells[adr(r, c)]; if (cell) cells[c] = cell; }
      lignes.push({ r, cells, cle: valCell(nouveauCtx(tableur()), G, r, R.cle) });
    }
    lignes.sort((a, b) => {
      if (a.cle === null && b.cle === null) return 0;
      if (a.cle === null) return 1;
      if (b.cle === null) return -1;
      return sens === 'asc' ? cmp(a.cle, b.cle) : cmp(b.cle, a.cle);
    });
    for (let r = debut; r <= R.r2; r++) for (let c = R.c1; c <= R.c2; c++) delete G.cells[adr(r, c)];
    lignes.forEach((l, i) => {
      const r = debut + i;
      for (const [c, cell] of Object.entries(l.cells)) G.cells[adr(r, +c)] = { v: decalerRelatives(cell.v, r - l.r, 0), s: { ...cell.s } };
    });
  });
}

function sommeAuto() {
  const F = feuille(), R = rect();
  const estNombre = (r, c) => typeof valCell(nouveauCtx(tableur()), F, r, c) === 'number';
  let cible, plage;
  if (R.r1 !== R.r2 && R.c1 === R.c2) { cible = { r: R.r2 + 1, c: R.c1 }; plage = `${adr(R.r1, R.c1)}:${adr(R.r2, R.c2)}`; }
  else if (R.r1 === R.r2 && R.c1 !== R.c2) { cible = { r: R.r1, c: R.c2 + 1 }; plage = `${adr(R.r1, R.c1)}:${adr(R.r2, R.c2)}`; }
  else {
    cible = { r: R.r1, c: R.c1 };
    let r = R.r1 - 1;
    while (r >= 0 && estNombre(r, R.c1)) r--;
    if (r < R.r1 - 1) plage = `${adr(r + 1, R.c1)}:${adr(R.r1 - 1, R.c1)}`;
    else { let c = R.c1 - 1; while (c >= 0 && estNombre(R.r1, c)) c--; if (c < R.c1 - 1) plage = `${adr(R.r1, c + 1)}:${adr(R.r1, R.c1 - 1)}`; }
  }
  if (!plage || cible.r >= F.nbL || cible.c >= F.nbC) { toast('Sélectionne des nombres (colonne ou ligne) puis clique sur Σ.'); return; }
  modifier((G) => poser(G, cible.r, cible.c, `=SOMME(${plage})`));
  selectionner(cible.r, cible.c, cible.r, cible.c);
}

function insererFonction(nom) {
  const texteFn = nom + '(';
  if (sh.ed) {
    const inp = sh.ed.inp;
    if (!inp.value.startsWith('=')) inp.value = '=' + inp.value;
    inp.setRangeText(texteFn, inp.selectionStart, inp.selectionEnd, 'end');
    inp.focus();
    $('#shFormule').value = inp.value;
  } else editer(sh.sel.r1, sh.sel.c1, '=' + texteFn);
}

/* ---- Recopie (poignée) ---- */
function remplir(src, cible) {
  const dR = cible.r > src.r2 ? cible.r - src.r2 : cible.r < src.r1 ? cible.r - src.r1 : 0;
  const dC = cible.c > src.c2 ? cible.c - src.c2 : cible.c < src.c1 ? cible.c - src.c1 : 0;
  if (!dR && !dC) return;
  const vertical = Math.abs(dR) >= Math.abs(dC), n = Math.abs(vertical ? dR : dC), sens = (vertical ? dR : dC) > 0 ? 1 : -1;
  modifier((F) => {
    const h = src.r2 - src.r1 + 1, w = src.c2 - src.c1 + 1;
    const lignes = vertical ? w : h;                    // nombre de « fils » à recopier
    for (let l = 0; l < lignes; l++) {
      const fil = [];
      for (let i = 0; i < (vertical ? h : w); i++) fil.push(vertical ? { r: src.r1 + i, c: src.c1 + l } : { r: src.r1 + l, c: src.c1 + i });
      const vals = fil.map((p) => F.cells[adr(p.r, p.c)]);
      const nums = vals.map((x) => (x && x.v[0] !== '=' ? constante(x.v) : undefined));
      const serie = sens > 0 && fil.length >= 2 && nums.every((x) => typeof x === 'number');
      const pas = serie ? (nums[nums.length - 1] - nums[0]) / (nums.length - 1) : 0;
      const suffixe = sens > 0 && fil.length === 1 && vals[0] && vals[0].v[0] !== '=' && /^(.*?)(\d+)$/.exec(vals[0].v);
      for (let k = 1; k <= n; k++) {
        const ordre = sens > 0 ? k : -k;
        const srcP = fil[((k - 1) % fil.length + fil.length) % fil.length], dest = vertical ? { r: sens > 0 ? src.r2 + k : src.r1 - k, c: srcP.c } : { r: srcP.r, c: sens > 0 ? src.c2 + k : src.c1 - k };
        if (dest.r < 0 || dest.c < 0 || dest.r >= MAXL || dest.c >= MAXC) continue;
        const source = F.cells[adr(srcP.r, srcP.c)];
        if (!source) { poser(F, dest.r, dest.c, ''); continue; }
        let v;
        if (serie) v = String(parseFloat((nums[nums.length - 1] + pas * k).toPrecision(12))).replace('.', ',');
        else if (suffixe) v = suffixe[1] + (+suffixe[2] + k);
        else v = decalerRelatives(source.v, dest.r - srcP.r, dest.c - srcP.c);
        void ordre;
        if (dest.r >= F.nbL) F.nbL = Math.min(MAXL, dest.r + 1);
        if (dest.c >= F.nbC) F.nbC = Math.min(MAXC, dest.c + 1);
        F.cells[adr(dest.r, dest.c)] = { v, s: { ...source.s } };
      }
    }
  });
  const R = rect();
  selectionner(Math.min(R.r1, vertical && sens < 0 ? R.r1 - n : R.r1), R.c1, R.r2 + (vertical && sens > 0 ? n : 0), R.c2 + (!vertical && sens > 0 ? n : 0));
}

/* ---- Presse-papiers ---- */
function copier(e, couper) {
  if (sh.ed) return;
  e.preventDefault();
  const F = feuille(), R = rect(), lignes = [], cells = [];
  for (let r = R.r1; r <= R.r2; r++) {
    const l = [], cl = [];
    for (let c = R.c1; c <= R.c2; c++) {
      const cell = F.cells[adr(r, c)];
      l.push(afficher(cell, valCell(sh.ctx, F, r, c)));
      cl.push(cell ? { v: cell.v, s: { ...cell.s } } : null);
    }
    lignes.push(l.join('\t')); cells.push(cl);
  }
  const tsv = lignes.join('\n');
  e.clipboardData.setData('text/plain', tsv);
  sh.clip = { r1: R.r1, c1: R.c1, cells, tsv, couper };
  if (couper) toast('Coupé : colle ailleurs avec Ctrl+V');
}
function coller(e) {
  if (sh.ed) return;
  e.preventDefault();
  const texteCb = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
  const R = rect(), c0 = sh.clip;
  modifier((F) => {
    const poseCell = (r, c, v, s) => {
      if (r >= MAXL || c >= MAXC) return;
      if (r >= F.nbL) F.nbL = r + 1;
      if (c >= F.nbC) F.nbC = c + 1;
      if (v === '' && !s) { poser(F, r, c, ''); return; }
      F.cells[adr(r, c)] = { v, s: s ? { ...s } : (F.cells[adr(r, c)] ? F.cells[adr(r, c)].s : {}) };
    };
    if (c0 && (texteCb === c0.tsv || !texteCb)) {
      if (c0.couper) {
        c0.cells.forEach((row, i) => row.forEach((_, j) => delete F.cells[adr(c0.r1 + i, c0.c1 + j)]));
        sh.clip = null;
      }
      c0.cells.forEach((row, i) => row.forEach((cell, j) => {
        const r = R.r1 + i, c = R.c1 + j;
        if (cell) poseCell(r, c, decalerRelatives(cell.v, R.r1 - c0.r1, R.c1 - c0.c1), cell.s); else poseCell(r, c, '', null);
      }));
    } else {
      texteCb.replace(/\r/g, '').replace(/\n$/, '').split('\n').forEach((ligne, i) => ligne.split('\t').forEach((v, j) => poseCell(R.r1 + i, R.c1 + j, v, null)));
    }
  });
}

/* ---- CSV ---- */
function exporterCsv() {
  const F = feuille(), z = zoneUtilisee(F), ctx = nouveauCtx(tableur());
  const lignes = [];
  for (let r = 0; r <= z.r2; r++) {
    const l = [];
    for (let c = 0; c <= z.c2; c++) {
      const cell = F.cells[adr(r, c)];
      let t = afficher(cell, valCell(ctx, F, r, c));
      if (/[;"\n]/.test(t)) t = '"' + t.replace(/"/g, '""') + '"';
      l.push(t);
    }
    lignes.push(l.join(';'));
  }
  telecharger('﻿' + lignes.join('\r\n'), (tableur().nom.replace(/[^\p{L}\p{N}]+/gu, '_') || 'tableur') + '.csv', 'text/csv;charset=utf-8');
}
function parserCsv(texteBrut) {
  const t = texteBrut.replace(/^﻿/, '');
  const premiere = t.split('\n')[0];
  const sep = [';', '\t', ','].map((s) => [s, premiere.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
  const lignes = [];
  let ligne = [], champ = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { champ += '"'; i++; } else q = false; } else champ += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { ligne.push(champ); champ = ''; }
    else if (ch === '\n') { ligne.push(champ.replace(/\r$/, '')); lignes.push(ligne); ligne = []; champ = ''; }
    else champ += ch;
  }
  if (champ !== '' || ligne.length) { ligne.push(champ.replace(/\r$/, '')); lignes.push(ligne); }
  return lignes;
}
function importerCsv(f) {
  const rd = new FileReader();
  rd.onload = () => {
    const lignes = parserCsv(String(rd.result));
    const T = tableur(), F = nouvelleFeuille((f.name.replace(/\.\w+$/, '') || 'Import').slice(0, 30));
    lignes.slice(0, MAXL).forEach((l, r) => l.slice(0, MAXC).forEach((v, c) => { if (v !== '') F.cells[adr(r, c)] = { v, s: {} }; }));
    F.nbL = Math.max(30, Math.min(MAXL, lignes.length + 5));
    F.nbC = Math.max(12, Math.min(MAXC, Math.max(...lignes.map((l) => l.length)) + 1));
    T.feuilles.push(F);
    journaliser('CSV importé : ' + F.nom, T.nom);
    sauver();
    ui.feuille = T.feuilles.length - 1;
    sh.sel = { r1: 0, c1: 0, r2: 0, c2: 0 };
    render();
    toast('Fichier importé dans une nouvelle feuille');
  };
  rd.readAsText(f);
}

/* ================= Graphiques ================= */
function donneesGraph(F, plage) {
  const m = /^([A-Za-z]+\d+):([A-Za-z]+\d+)$/.exec(plage);
  if (!m) return null;
  const a = parseAdr(m[1]), b = parseAdr(m[2]);
  const M = [];
  for (let r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r++) {
    const row = [];
    for (let c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c++) row.push(valCell(sh.ctx, F, r, c));
    M.push(row);
  }
  if (M.length < 2 || M[0].length < 1) return null;
  const entete = M[0].some((x) => typeof x === 'string') && M.length > 1;
  const corps = entete ? M.slice(1) : M;
  const etiq = M[0].length > 1 && corps.every((row) => typeof row[0] !== 'number');
  const debut = etiq ? 1 : 0;
  const series = [];
  for (let c = debut; c < M[0].length; c++) series.push({ nom: entete ? texte(M[0][c]) || 'Série ' + (c - debut + 1) : 'Série ' + (c - debut + 1), v: corps.map((row) => (typeof row[c] === 'number' ? row[c] : 0)) });
  if (!series.length) return null;
  return { labels: corps.map((row, i) => (etiq ? texte(row[0]) : String(i + 1))), series };
}

function svgGraph(g, d) {
  const W = 640, H = 300, mg = { l: 48, r: 16, t: 20, b: 46 };
  const lg = (x, y, i, nom) => `<g><rect x="${x}" y="${y - 9}" width="10" height="10" rx="2" fill="${PALETTE[i % PALETTE.length]}"/><text x="${x + 15}" y="${y}" fill="#aaa" font-size="11">${esc(nom)}</text></g>`;
  if (g.type === 'pie') {
    const vals = d.series[0].v.map((x) => Math.max(0, x)), tot = vals.reduce((s, x) => s + x, 0);
    if (!tot) return '<p class="muted">Pas de données positives à afficher.</p>';
    const cx = 150, cy = 150, R = 110;
    let ang = -Math.PI / 2, s = '';
    vals.forEach((v, i) => {
      if (!v) return;
      const a2 = ang + (v / tot) * 2 * Math.PI, large = a2 - ang > Math.PI ? 1 : 0;
      if (v === tot) s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${PALETTE[i % PALETTE.length]}"/>`;
      else s += `<path d="M${cx},${cy} L${cx + R * Math.cos(ang)},${cy + R * Math.sin(ang)} A${R},${R} 0 ${large} 1 ${cx + R * Math.cos(a2)},${cy + R * Math.sin(a2)} Z" fill="${PALETTE[i % PALETTE.length]}" stroke="#111113" stroke-width="2"/>`;
      ang = a2;
    });
    const leg = d.labels.map((l, i) => lg(320, 40 + i * 22, i, `${l} — ${Math.round(100 * vals[i] / tot)} %`)).join('');
    return `<svg viewBox="0 0 ${W} ${H}" role="img">${s}${leg}</svg>`;
  }
  const tous = d.series.flatMap((x) => x.v), mn = Math.min(0, ...tous), mx = Math.max(0, ...tous) || 1;
  const pas = (() => { const e = Math.pow(10, Math.floor(Math.log10(mx - mn))); const r = (mx - mn) / e; return (r <= 2 ? 0.5 : r <= 5 ? 1 : 2) * e; })();
  const top = Math.ceil(mx / pas) * pas, bas = Math.floor(mn / pas) * pas;
  const y = (v) => mg.t + (H - mg.t - mg.b) * (1 - (v - bas) / (top - bas));
  const n = d.labels.length, gw = (W - mg.l - mg.r) / n;
  let s = '';
  for (let v = bas; v <= top + 1e-9; v += pas) s += `<line x1="${mg.l}" x2="${W - mg.r}" y1="${y(v)}" y2="${y(v)}" stroke="#24242a"/><text x="${mg.l - 6}" y="${y(v) + 4}" fill="#8d8d96" font-size="10" text-anchor="end">${fmtNombre(parseFloat(v.toPrecision(6)))}</text>`;
  d.labels.forEach((l, i) => { s += `<text x="${mg.l + gw * (i + 0.5)}" y="${H - mg.b + 16}" fill="#8d8d96" font-size="10" text-anchor="middle">${esc(l.length > 12 ? l.slice(0, 11) + '…' : l)}</text>`; });
  if (g.type === 'bar') {
    const k = d.series.length, bw = Math.min(40, (gw * 0.8) / k);
    d.series.forEach((se, si) => se.v.forEach((v, i) => {
      const x = mg.l + gw * i + (gw - bw * k) / 2 + bw * si;
      s += `<rect x="${x}" y="${Math.min(y(v), y(0))}" width="${bw - 2}" height="${Math.abs(y(v) - y(0))}" rx="2" fill="${PALETTE[si % PALETTE.length]}"><title>${esc(d.labels[i])} : ${fmtNombre(v)}</title></rect>`;
    }));
  } else {
    d.series.forEach((se, si) => {
      const pts = se.v.map((v, i) => `${mg.l + gw * (i + 0.5)},${y(v)}`);
      s += `<polyline points="${pts.join(' ')}" fill="none" stroke="${PALETTE[si % PALETTE.length]}" stroke-width="2"/>`;
      se.v.forEach((v, i) => { s += `<circle cx="${mg.l + gw * (i + 0.5)}" cy="${y(v)}" r="3.5" fill="${PALETTE[si % PALETTE.length]}"><title>${esc(d.labels[i])} : ${fmtNombre(v)}</title></circle>`; });
    });
  }
  const leg = d.series.length > 1 ? d.series.map((x, i) => lg(mg.l + i * 120, H - 6, i, x.nom)).join('') : '';
  return `<svg viewBox="0 0 ${W} ${H}" role="img">${s}${leg}</svg>`;
}

function renderGraphs() {
  const F = feuille();
  $('#shGraphs').innerHTML = (F.graphs || []).map((g) => {
    const d = donneesGraph(F, g.range);
    return `<div class="card gcard"><div class="card-head"><h3>${esc(g.titre)} <small class="hint">${esc(g.range)}</small></h3>
      <span><button class="btn ghost" data-sh="graphTitre:${g.id}">✏️</button><button class="btn ghost danger" data-sh="graphSuppr:${g.id}">🗑️</button></span></div>
      ${d ? svgGraph(g, d) : '<p class="muted">Plage invalide : il faut au moins 2 lignes (avec un en-tête et des libellés en première colonne).</p>'}</div>`;
  }).join('');
}

function creerGraph(type) {
  const R = rect();
  if (R.r1 === R.r2) { toast('Sélectionne d’abord les cellules à représenter (avec l’en-tête et les libellés).'); return; }
  const plage = `${adr(R.r1, R.c1)}:${adr(R.r2, R.c2)}`;
  modifier((F) => F.graphs.push({ id: uid(), type, range: plage, titre: { bar: 'Histogramme', line: 'Courbe', pie: 'Camembert' }[type] }));
  $('#shGraphs').scrollIntoView({ block: 'nearest' });
}

/* ================= Onglets (feuilles) ================= */
function renderOnglets() {
  const T = tableur(), i0 = Math.min(ui.feuille || 0, T.feuilles.length - 1);
  $('#shTabs').innerHTML = T.feuilles.map((f, i) => `<button class="shtab ${i === i0 ? 'on' : ''}" data-sh="onglet:${i}">${esc(f.nom)}</button>`).join('') +
    `<button class="shtab" data-sh="ajoutFeuille" title="Nouvelle feuille">＋</button>
    <span class="spacer"></span>
    <button class="shtab" data-sh="renFeuille">✏️ Renommer</button><button class="shtab" data-sh="dupFeuille">⎘ Dupliquer</button>${T.feuilles.length > 1 ? '<button class="shtab" data-sh="supprFeuille">🗑️ Supprimer</button>' : ''}
    <button class="shtab" data-sh="plusL">＋ 30 lignes</button><button class="shtab" data-sh="plusC">＋ 5 colonnes</button>`;
}

/* ================= Événements ================= */
function initTableur() {
  const grid = $('#shGrid');
  sh.ed = null;
  renderGrille();
  grid.focus({ preventScroll: true });

  grid.addEventListener('mousedown', (e) => {
    const F = feuille();
    const rs = e.target.closest('[data-rs]');
    if (rs) { e.preventDefault(); sh.drag = { type: 'resize', c: +rs.dataset.rs, x0: e.clientX, w0: largeur(F, +rs.dataset.rs) }; return; }
    const fh = e.target.closest('[data-fh]');
    if (fh) { e.preventDefault(); sh.drag = { type: 'fill', src: rect(), cible: null }; return; }
    const ch = e.target.closest('[data-ch]');
    if (ch) { finirEdition(true); const c = +ch.dataset.ch; selectionner(0, e.shiftKey ? sh.sel.c1 : c, F.nbL - 1, c); sh.drag = { type: 'col', c0: e.shiftKey ? sh.sel.c1 : c }; grid.focus(); return; }
    const rh = e.target.closest('[data-rh]');
    if (rh) { finirEdition(true); const r = +rh.dataset.rh; selectionner(r, 0, r, F.nbC - 1); sh.drag = { type: 'row', r0: r }; grid.focus(); return; }
    if (e.target.closest('[data-all]')) { finirEdition(true); selectionner(0, 0, F.nbL - 1, F.nbC - 1); return; }
    const td = e.target.closest('td');
    if (!td) return;
    const r = +td.dataset.r, c = +td.dataset.c;
    if (sh.ed) {
      const inp = sh.ed.inp;
      const avant = inp.value.slice(0, inp.selectionStart);
      if (td.contains(inp)) return;
      if (inp.value[0] === '=' && (!avant || /[=(;,+\-*/^&<>:]$/.test(avant))) {
        e.preventDefault();
        inp.setRangeText(adr(r, c), inp.selectionStart, inp.selectionEnd, 'end');
        $('#shFormule').value = inp.value;
        return;
      }
      finirEdition(true);
    }
    e.preventDefault();
    if (e.shiftKey) selectionner(sh.sel.r1, sh.sel.c1, r, c); else selectionner(r, c, r, c);
    sh.drag = { type: 'sel' };
    grid.focus({ preventScroll: true });
  });

  grid.addEventListener('mouseover', (e) => {
    const d = sh.drag;
    if (!d) return;
    const td = e.target.closest('td');
    const F = feuille();
    if (d.type === 'sel' && td) selectionner(sh.sel.r1, sh.sel.c1, +td.dataset.r, +td.dataset.c);
    else if (d.type === 'col') { const ch = e.target.closest('[data-ch]'); if (ch) selectionner(0, d.c0, F.nbL - 1, +ch.dataset.ch); }
    else if (d.type === 'row') { const rh = e.target.closest('[data-rh]'); if (rh) selectionner(d.r0, 0, +rh.dataset.rh, F.nbC - 1); }
    else if (d.type === 'fill' && td) {
      d.cible = { r: +td.dataset.r, c: +td.dataset.c };
      sh.fp.forEach((x) => x.classList.remove('fp'));
      sh.fp = [];
      const s = d.src;
      const dR = d.cible.r > s.r2 ? d.cible.r - s.r2 : d.cible.r < s.r1 ? d.cible.r - s.r1 : 0, dC = d.cible.c > s.c2 ? d.cible.c - s.c2 : d.cible.c < s.c1 ? d.cible.c - s.c1 : 0;
      const vert = Math.abs(dR) >= Math.abs(dC);
      const zone = vert ? { r1: dR > 0 ? s.r2 + 1 : d.cible.r, r2: dR > 0 ? d.cible.r : s.r1 - 1, c1: s.c1, c2: s.c2 } : { c1: dC > 0 ? s.c2 + 1 : d.cible.c, c2: dC > 0 ? d.cible.c : s.c1 - 1, r1: s.r1, r2: s.r2 };
      for (let r = zone.r1; r <= zone.r2; r++) for (let c = zone.c1; c <= zone.c2; c++) { const x = sh.tds[r] && sh.tds[r][c]; if (x) { x.classList.add('fp'); sh.fp.push(x); } }
    }
  });

  grid.addEventListener('dblclick', (e) => {
    const td = e.target.closest('td');
    if (td && !sh.ed) editer(+td.dataset.r, +td.dataset.c);
  });

  grid.addEventListener('keydown', (e) => {
    if (sh.ed) return;
    const k = e.key, ctrl = e.ctrlKey || e.metaKey;
    if (ctrl) {
      const x = k.toLowerCase();
      if (x === 'z') { e.preventDefault(); if (e.shiftKey) refaire(); else annuler(); }
      else if (x === 'y') { e.preventDefault(); refaire(); }
      else if (x === 'b') { e.preventDefault(); appliquerStyle(basculer('b')); }
      else if (x === 'i') { e.preventDefault(); appliquerStyle(basculer('i')); }
      else if (x === 'u') { e.preventDefault(); appliquerStyle(basculer('u')); }
      else if (x === 'a') { e.preventDefault(); const F = feuille(); selectionner(0, 0, F.nbL - 1, F.nbC - 1); }
      return;
    }
    const mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[k];
    if (mv) { e.preventDefault(); deplacer(mv[0], mv[1], e.shiftKey); }
    else if (k === 'Tab') { e.preventDefault(); deplacer(0, e.shiftKey ? -1 : 1, false); }
    else if (k === 'Enter' || k === 'F2') { e.preventDefault(); editer(sh.sel.r1, sh.sel.c1); }
    else if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); effacerSelection(); }
    else if (k.length === 1 && !e.altKey) { e.preventDefault(); editer(sh.sel.r1, sh.sel.c1, k); }
  });
  grid.addEventListener('copy', (e) => copier(e, false));
  grid.addEventListener('cut', (e) => copier(e, true));
  grid.addEventListener('paste', coller);

  const bar = $('#shFormule');
  bar.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = bar.value, r = sh.sel.r1, c = sh.sel.c1;
      modifier((F) => poser(F, r, c, v));
      $('#shGrid').focus({ preventScroll: true });
    } else if (e.key === 'Escape') { bar.value = brut(feuille(), sh.sel.r1, sh.sel.c1); $('#shGrid').focus({ preventScroll: true }); }
  });
}

/* Événements globaux (enregistrés une seule fois) */
document.addEventListener('mousemove', (e) => {
  const d = sh.drag;
  if (!d || d.type !== 'resize') return;
  const F = feuille(), w = Math.max(40, Math.min(500, d.w0 + e.clientX - d.x0));
  F.largeurs[d.c] = w;
  const col = document.querySelector(`#shGrid col[data-col="${d.c}"]`);
  if (col) col.style.width = w + 'px';
});
document.addEventListener('mouseup', () => {
  const d = sh.drag;
  if (!d) return;
  sh.drag = null;
  if (ui.view !== 'sheet') return;
  if (d.type === 'resize') sauver();
  if (d.type === 'fill') {
    sh.fp.forEach((x) => x.classList.remove('fp'));
    sh.fp = [];
    if (d.cible) remplir(d.src, d.cible);
  }
});

document.addEventListener('click', (e) => {
  const tb = e.target.closest('[data-tb]');
  if (tb && (ui.view === 'tableurs' || ui.view === 'sheet')) {
    e.preventDefault();
    const [act, arg] = tb.dataset.tb.split(':');
    if (act === 'new') creerTableur(arg);
    else if (act === 'open') { sh.sel = { r1: 0, c1: 0, r2: 0, c2: 0 }; aller('sheet', { tabId: arg, feuille: 0 }); }
    else if (act === 'retour') aller('tableurs');
    return;
  }
  const b = e.target.closest('[data-sh]');
  if (!b || ui.view !== 'sheet') return;
  const [act, arg] = b.dataset.sh.split(':');
  const T = tableur(), F = feuille();
  switch (act) {
    case 'undo': finirEdition(true); annuler(); break;
    case 'redo': refaire(); break;
    case 'b': case 'i': case 'u': appliquerStyle(basculer(act)); break;
    case 'al': appliquerStyle({ al: arg }); break;
    case 'nobg': appliquerStyle({ bg: '', c: '' }); break;
    case 'dec+': case 'dec-': appliquerStyle((s) => { const d = s.dec ?? (s.fmt === 'eur' || s.fmt === 'n' ? 2 : 0); return { fmt: s.fmt || 'n', dec: Math.max(0, Math.min(10, d + (act === 'dec+' ? 1 : -1))) }; }); break;
    case 'fn': insererFonction(arg); break;
    case 'somme': sommeAuto(); break;
    case 'insL': insererAxe('r'); break;
    case 'insC': insererAxe('c'); break;
    case 'delL': supprimerAxe('r'); break;
    case 'delC': supprimerAxe('c'); break;
    case 'tri': trier(arg); break;
    case 'graph': creerGraph(arg); break;
    case 'graphSuppr': modifier((G) => { G.graphs = G.graphs.filter((g) => g.id !== arg); }); break;
    case 'graphTitre': { const g = F.graphs.find((x) => x.id === arg); const t = (prompt('Titre du graphique ?', g.titre) || '').trim(); if (t) modifier(() => { g.titre = t; }); break; }
    case 'csvOut': exporterCsv(); break;
    case 'imprimer': window.print(); break;
    case 'supprTab': if (confirm(`Supprimer le tableur « ${T.nom} » ?`)) { db.tableurs = db.tableurs.filter((x) => x !== T); journaliser('Tableur supprimé : ' + T.nom); sauver(); aller('tableurs'); } break;
    case 'onglet': finirEdition(true); ui.feuille = +arg; sh.sel = { r1: 0, c1: 0, r2: 0, c2: 0 }; renderGrille(); break;
    case 'ajoutFeuille': { finirEdition(true); T.feuilles.push(nouvelleFeuille('Feuille ' + (T.feuilles.length + 1))); ui.feuille = T.feuilles.length - 1; sh.sel = { r1: 0, c1: 0, r2: 0, c2: 0 }; sauver(); renderGrille(); break; }
    case 'renFeuille': { const n = (prompt('Nom de la feuille ?', F.nom) || '').trim(); if (n) { F.nom = n; sauver(); renderOnglets(); } break; }
    case 'dupFeuille': { const cp = JSON.parse(JSON.stringify(F)); cp.id = uid(); cp.nom = F.nom + ' (copie)'; cp.graphs.forEach((g) => { g.id = uid(); }); T.feuilles.push(cp); ui.feuille = T.feuilles.length - 1; sauver(); renderGrille(); break; }
    case 'supprFeuille': if (confirm(`Supprimer la feuille « ${F.nom} » ?`)) { T.feuilles = T.feuilles.filter((x) => x !== F); ui.feuille = 0; sh.sel = { r1: 0, c1: 0, r2: 0, c2: 0 }; sauver(); renderGrille(); } break;
    case 'plusL': modifier((G) => { G.nbL = Math.min(MAXL, G.nbL + 30); }); break;
    case 'plusC': modifier((G) => { G.nbC = Math.min(MAXC, G.nbC + 5); }); break;
    default:
  }
  if (!['onglet', 'supprTab', 'imprimer', 'csvOut', 'fn', 'renFeuille'].includes(act) && !sh.ed) { const g = $('#shGrid'); if (g) g.focus({ preventScroll: true }); }
});

document.addEventListener('change', (e) => {
  if (ui.view !== 'sheet') return;
  if (e.target.id === 'shNom') { const T = tableur(); T.nom = e.target.value.trim() || T.nom; sauver(); }
  else if (e.target.id === 'shColor') appliquerStyle({ c: e.target.value });
  else if (e.target.id === 'shBg') appliquerStyle({ bg: e.target.value });
  else if (e.target.id === 'shFmt') appliquerStyle({ fmt: e.target.value, dec: undefined });
  else if (e.target.id === 'shCsv') { if (e.target.files[0]) importerCsv(e.target.files[0]); e.target.value = ''; }
});
