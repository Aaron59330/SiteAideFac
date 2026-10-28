'use strict';
/* ============================================================
   Tableur : modèles, liste des tableurs et squelette de la vue
   ============================================================ */

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

MODELES.push(
  {
    id: 'facture', nom: 'Facture', ic: '🧾', titre: 'Facture', desc: 'Désignations, quantités, TVA et total TTC calculés.',
    build() {
      const rows = [['FACTURE'], [], ['Client :', ''], ['Date :', '=AUJOURDHUI()'], [],
        ['Désignation', 'Quantité', 'Prix unitaire', 'Total HT']];
      for (let i = 0; i < 6; i++) rows.push(['', '', '', `=SI(B${7 + i}="";"";B${7 + i}*C${7 + i})`]);
      rows.push([]);
      rows.push(['', '', 'Total HT', '=SOMME(D7:D12)']);
      rows.push(['', '', 'TVA', '', '']);
      rows.push(['', '', 'Total TTC', '=D14+D15']);
      const cells = depuisLignes(rows);
      cells.A1.s = { b: true, fs: 20, al: 'center' };
      for (let c = 0; c < 4; c++) styler(cells, adr(5, c), { b: true, bg: '#2a2a31' });
      styler(cells, 'B4', { fmt: 'date', al: 'left' });
      styler(cells, 'A3', { b: true }); styler(cells, 'A4', { b: true });
      cells.C15 = { v: '20 %', s: { fmt: 'pct', dec: 0 } }; cells.D15 = { v: '=D14*C15', s: {} };
      for (let r = 7; r <= 12; r++) { styler(cells, `C${r}`, { fmt: 'eur' }); styler(cells, `D${r}`, { fmt: 'eur' }); }
      for (const r of [14, 15, 16]) { styler(cells, `D${r}`, { fmt: 'eur', b: r === 16 }); styler(cells, `C${r}`, { b: true, al: 'right' }); }
      styler(cells, 'D16', { bg: '#35301f' });
      return { cells, nbL: 30, largeurs: { 0: 240, 1: 100, 2: 120, 3: 120 }, merges: [{ r1: 0, c1: 0, r2: 0, c2: 3 }] };
    },
  },
  {
    id: 'edt', nom: 'Emploi du temps', ic: '🕗', titre: 'Emploi du temps', desc: 'Ta semaine de cours, créneau par créneau, avec des couleurs.',
    build() {
      const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'], rows = [['Heure', ...jours]];
      for (let h = 8; h <= 17; h++) rows.push([`${String(h).padStart(2, '0')}:00`, '', '', '', '', '']);
      const cells = depuisLignes(rows);
      for (let c = 0; c <= 5; c++) styler(cells, adr(0, c), { al: 'center' });
      for (let r = 1; r <= 10; r++) { styler(cells, `A${r + 1}`, { b: true, al: 'center', bg: '#1d1d24', fmt: 'heure', code: undefined }); cells[`A${r + 1}`].v = `${String(7 + r).padStart(2, '0')}:00`; cells[`A${r + 1}`].s.fmt = 'code'; cells[`A${r + 1}`].s.code = 'hh:mm'; }
      const mats = db.matieres.slice(0, 5);
      const couleurs = ['#2b3a67', '#1f4d3a', '#5a3a1f', '#4a2a5e', '#5e2a35'];
      [[1, 1, 0], [2, 1, 0], [1, 3, 1], [2, 3, 1], [3, 2, 2], [4, 2, 2], [6, 1, 3], [7, 1, 3], [4, 4, 4], [5, 4, 4], [8, 5, 0], [9, 5, 0]].forEach(([r, c, i]) => {
        if (mats[i]) { cells[adr(r, c)] = { v: mats[i].nom, s: { bg: couleurs[i % 5], al: 'center' } }; }
      });
      return { cells, nbL: 20, nbC: 8, largeurs: { 0: 80, 1: 130, 2: 130, 3: 130, 4: 130, 5: 130 }, gel: { r: 1, c: 1 } };
    },
  },
  {
    id: 'habitudes', nom: 'Suivi d’habitudes', ic: '✅', titre: 'Suivi d’habitudes', desc: 'Cases à cocher, totaux et barres de progression automatiques.',
    build() {
      const jours = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
      const rows = [['Habitude', ...jours, 'Total', 'Objectif']];
      ['Réviser 1 h', 'Sport', 'Dormir 8 h', 'Lire 20 min', 'Boire de l’eau'].forEach((h, i) => { const r = i + 2; rows.push([h, '', '', '', '', '', '', '', `=NB.SI(B${r}:H${r};VRAI)`, '5']); });
      const cells = depuisLignes(rows);
      for (let r = 2; r <= 6; r++) for (let c = 1; c <= 7; c++) cells[adr(r - 1, c)] = { v: 'FAUX', s: { al: 'center' } };
      for (let c = 1; c <= 9; c++) styler(cells, adr(0, c), { al: 'center' });
      return {
        cells, nbL: 20, largeurs: { 0: 160, 8: 70, 9: 80 },
        valids: [{ id: uid(), range: 'B2:H6', type: 'case', op: 'entre', a: '', b: '', source: '', message: '', alerte: 'stop' }],
        cf: [{ id: uid(), range: 'I2:I6', type: 'barres', couleurs: ['#4ade80'] }],
      };
    },
  },
);

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
  return `<div class="head"><div><h2>Tableurs</h2><p class="sub">Un vrai tableur : formules, mise en forme, tableaux croisés, graphiques, import/export Excel.</p></div>
    <div class="actions"><label class="btn">⬆ Importer Excel / CSV<input type="file" id="tbImport" accept=".xlsx,.csv,.txt,.tsv" hidden></label><button class="btn primary" data-tb="new:vide">＋ Nouveau tableur</button></div></div>
    ${liste.length ? `<h3 class="group-title">Mes tableurs</h3><div class="cours-list">${liste.map((t) => `<div class="cours" data-tb="open:${t.id}" style="--mc:#f0b27a">
      <h3>▦ ${esc(t.nom)}</h3><small>${t.feuilles.length} feuille(s) · ${new Date(t.date).toLocaleDateString('fr-FR')}</small></div>`).join('')}</div>` : ''}
    <h3 class="group-title">Partir d’un modèle</h3>
    <div class="cours-list">${MODELES.map((m) => `<div class="cours" data-tb="new:${m.id}" style="--mc:#74c0fc"><h3>${m.ic} ${esc(m.titre)}</h3><small>${esc(m.desc)}</small></div>`).join('')}</div>`;
}


function vueTableur() {
  const t = tableur();
  if (!t) { ui.view = 'tableurs'; return vueTableurs(); }
  return `<div class="head"><div><p class="sub" style="margin:0 0 4px"><a href="#" data-tb="retour">← Mes tableurs</a></p>
      <h2><input id="shNom" class="titre-in" value="${esc(t.nom)}" aria-label="Nom du tableur"></h2></div>
    <div class="actions">
      <details class="more"><summary class="btn">⬆ Importer</summary><div class="menu"><button data-sh="importXlsx">Fichier Excel (.xlsx)</button><button data-sh="importCsv">Fichier CSV / texte</button></div></details>
      <details class="more"><summary class="btn">⬇ Exporter</summary><div class="menu"><button data-sh="exportXlsx">Excel (.xlsx)</button><button data-sh="exportCsv">CSV (feuille active)</button></div></details>
      <button class="btn" data-sh="imprimer">🖨️ Imprimer</button><button class="btn ghost danger" data-sh="supprTab" title="Supprimer ce tableur">🗑️</button></div></div>
  <div class="sheet">
    <div class="rtabs" id="shRTabs"></div>
    <div class="ribbon" id="shRibbon"></div>
    <div class="shformula"><input id="shAddr" class="addr" value="A1" aria-label="Zone de nom" autocomplete="off"><i>ƒx</i><input id="shFormule" autocomplete="off" placeholder="Valeur ou formule, ex : =SOMME(B2:B10)"></div>
    <div class="shgrid" id="shGrid" tabindex="0"></div>
    <div id="shGraphs" class="shgraphs"></div>
    <div class="shstatbar"><div id="shStat" class="shstat"></div><div class="zoomc"><button class="tbtn" data-sh="zoom-" title="Zoom arrière">−</button><input type="range" id="shZoom" min="50" max="200" step="10" value="100" aria-label="Zoom"><button class="tbtn" data-sh="zoom+" title="Zoom avant">＋</button><span id="shZoomV">100 %</span></div></div>
    <div class="shtabs" id="shTabs"></div>
    <input type="file" id="shCsv" accept=".csv,.txt,.tsv" hidden><input type="file" id="shXlsx" accept=".xlsx" hidden>
  </div>
  <div id="shPrintBox" class="printbox"></div>`;
}

function renderOnglets() {
  const T = tableur(), i0 = Math.min(ui.feuille || 0, T.feuilles.length - 1);
  $('#shTabs').innerHTML = T.feuilles.map((f, i) => `<button class="shtab ${i === i0 ? 'on' : ''}" data-sh="onglet:${i}" ${f.couleur ? `style="border-bottom:3px solid ${f.couleur}"` : ''}>${esc(f.nom)}</button>`).join('') +
    `<button class="shtab" data-sh="ajoutFeuille" title="Nouvelle feuille">＋</button><span class="spacer"></span>
    <details class="more up"><summary class="shtab">Feuille ▾</summary><div class="menu">
      <button data-sh="renFeuille">✏️ Renommer</button><button data-sh="dupFeuille">⎘ Dupliquer</button>
      <button data-sh="gaucheFeuille">◀ Déplacer à gauche</button><button data-sh="droiteFeuille">▶ Déplacer à droite</button>
      <button data-sh="couleurFeuille">🎨 Couleur de l’onglet</button>${T.feuilles.length > 1 ? '<button data-sh="supprFeuille" class="danger">🗑️ Supprimer</button>' : ''}</div></details>
    <button class="shtab" data-sh="plusL">＋ 30 lignes</button><button class="shtab" data-sh="plusC">＋ 5 colonnes</button>`;
}
