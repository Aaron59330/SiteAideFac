'use strict';
/* ============================================================
   Tableur : boîtes de dialogue et fonctions avancées
   ============================================================ */

function fermerDialogue() { const d = document.getElementById('shDlg'); if (d) d.remove(); }
function dialogue({ titre, corps, boutons = [], large = false, modal = true }) {
  fermerDialogue();
  const ov = document.createElement('div');
  ov.id = 'shDlg';
  ov.className = 'shdlg' + (modal ? '' : ' nomodal');
  ov.innerHTML = `<div class="shdlg-box${large ? ' large' : ''}" role="dialog" aria-label="${esc(titre)}"><div class="shdlg-h"><b>${esc(titre)}</b><button class="btn ghost" data-dx aria-label="Fermer">✕</button></div><div class="shdlg-b">${corps}</div><div class="shdlg-f"></div></div>`;
  const f = ov.querySelector('.shdlg-f');
  boutons.forEach((b) => {
    const el = document.createElement('button');
    el.className = 'btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : '');
    el.textContent = b.txt;
    el.addEventListener('click', () => { if (b.act && b.act(ov) === false) return; if (!b.garder) fermerDialogue(); });
    f.appendChild(el);
  });
  if (modal) ov.addEventListener('mousedown', (e) => { if (e.target === ov) fermerDialogue(); });
  ov.querySelector('[data-dx]').addEventListener('click', fermerDialogue);
  ov.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); fermerDialogue(); } });
  document.body.appendChild(ov);
  const premier = ov.querySelector('input:not([type=checkbox]):not([type=color]),select,textarea');
  if (premier) premier.focus();
  return ov;
}
const champ = (label, html, aide) => `<label class="dfield"><span>${label}</span>${html}${aide ? `<small class="hint">${aide}</small>` : ''}</label>`;
const optHtml = (liste, sel) => liste.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(sel) ? ' selected' : ''}>${esc(l)}</option>`).join('');
const val = (ov, id) => ov.querySelector('#' + id).value;
const coche = (ov, id) => ov.querySelector('#' + id).checked;

/* ================= Format de cellule ================= */
function ouvrirFormatCellule() {
  const F = feuille(), A = actif(), cell = cellule(F, A.r, A.c), s = cell ? cell.s : {};
  const v = valCell(sh.ctx, F, A.r, A.c);
  const ex = typeof v === 'number' ? v : 1234.5678;
  const ov = dialogue({
    titre: 'Format de cellule',
    corps: `${champ('Catégorie', `<select id="dfCat">${optHtml(FORMATS_NOMBRE, s.fmt || '')}</select>`)}
      <div id="dfDecW">${champ('Nombre de décimales', `<input id="dfDec" type="number" min="0" max="10" value="${s.dec ?? ''}" placeholder="auto">`)}</div>
      <div id="dfCodeW">${champ('Code de format', `<input id="dfCode" value="${esc(s.code || '')}" placeholder='ex : 0.00 "pts"  ou  dd/mm/yyyy  ou  # ##0 "€"'>`, 'Codes : 0 # (chiffres), , (milliers), . (décimale), % ; dates : dd mm yyyy dddd mmmm hh:mm ; texte entre guillemets')}
        <div class="dsug">${['0.00', '#,##0 "€"', '0.0%', 'dd/mm/yyyy', 'dddd d mmmm yyyy', 'hh:mm', '0.00E+00', '0 "pts"', '[Red]0;-0'].map((c) => `<button class="chip" data-sug="${esc(c)}">${esc(c)}</button>`).join('')}</div></div>
      <div class="dprev">Aperçu : <b id="dfPrev"></b></div>`,
    boutons: [{ txt: 'Annuler' }, { txt: 'Appliquer', primary: true, act: (o) => { const cat = val(o, 'dfCat'); appliquerStyle({ fmt: cat || undefined, dec: val(o, 'dfDec') === '' || !['n', 'pct', 'eur'].includes(cat) ? undefined : +val(o, 'dfDec'), code: cat === 'code' ? val(o, 'dfCode') : undefined }); } }],
  });
  const maj = () => {
    const cat = val(ov, 'dfCat');
    ov.querySelector('#dfDecW').style.display = ['n', 'pct', 'eur'].includes(cat) ? '' : 'none';
    ov.querySelector('#dfCodeW').style.display = cat === 'code' ? '' : 'none';
    const fake = { v: String(ex), s: { fmt: cat || undefined, dec: val(ov, 'dfDec') === '' ? undefined : +val(ov, 'dfDec'), code: val(ov, 'dfCode') } };
    ov.querySelector('#dfPrev').textContent = afficher(fake, ex) || '(vide)';
  };
  ov.addEventListener('input', maj); ov.addEventListener('change', maj);
  ov.addEventListener('click', (e) => { const b = e.target.closest('[data-sug]'); if (b) { ov.querySelector('#dfCode').value = b.dataset.sug; ov.querySelector('#dfCat').value = 'code'; maj(); } });
  maj();
}

/* ================= Mise en forme conditionnelle ================= */
const TYPES_CF = [['gt', 'Supérieur à'], ['ge', 'Supérieur ou égal à'], ['lt', 'Inférieur à'], ['le', 'Inférieur ou égal à'], ['eq', 'Égal à'], ['ne', 'Différent de'], ['entre', 'Entre'], ['contient', 'Le texte contient'], ['debute', 'Le texte commence par'], ['finit', 'Le texte finit par'], ['doublons', 'Valeurs en double'], ['uniques', 'Valeurs uniques'], ['top', 'N premières valeurs'], ['bottom', 'N dernières valeurs'], ['moy+', 'Supérieur à la moyenne'], ['moy-', 'Inférieur à la moyenne'], ['vide', 'Cellule vide'], ['nonvide', 'Cellule non vide'], ['erreur', 'Erreur'], ['formule', 'Formule personnalisée'], ['barres', 'Barres de données'], ['echelle', 'Nuance de couleurs'], ['icones', 'Jeu d’icônes']];
const NOMS_CF = Object.fromEntries(TYPES_CF);
function decrireRegle(r) {
  const a = r.a !== undefined && r.a !== '' ? ` « ${r.a} »` : '', b = r.type === 'entre' ? ` et « ${r.b} »` : '';
  return `${NOMS_CF[r.type] || r.type}${a}${b}`;
}
function ouvrirCF(prefill) {
  const F = feuille(), R = rect(), plage = textePlage(R);
  if (prefill === 'effacer') { modifier((G) => { G.cf = []; }); toast('Règles effacées'); return; }
  if (['barres', 'echelle', 'icones'].includes(prefill)) {
    modifier((G) => G.cf.push({ id: uid(), range: plage, type: prefill, couleurs: prefill === 'barres' ? ['#5b8def'] : ['#f87171', '#ffe066', '#4ade80'], a: 'fleches' }));
    toast('Mise en forme ajoutée sur ' + plage);
    return;
  }
  const type0 = prefill && prefill !== 'gerer' ? prefill : 'gt';
  const liste = F.cf.map((r) => `<div class="drule"><span><b>${esc(r.range)}</b> — ${esc(decrireRegle(r))}${r.st ? ` <i class="swatch" style="background:${esc(r.st.bg || '#444')};color:${esc(r.st.c || '#fff')}">Aa</i>` : ''}</span><button class="btn ghost danger" data-del="${r.id}">🗑️</button></div>`).join('') || '<p class="hint">Aucune règle pour cette feuille.</p>';
  const ov = dialogue({
    titre: 'Mise en forme conditionnelle', large: true,
    corps: `<div class="dcols"><div><h4>Règles de la feuille</h4>${liste}</div>
      <div><h4>Nouvelle règle</h4>
        ${champ('Type de règle', `<select id="cfType">${optHtml(TYPES_CF, type0)}</select>`)}
        ${champ('S’applique à', `<input id="cfPlage" value="${plage}">`)}
        <div id="cfValeurs" class="dgrid2">${champ('Valeur', '<input id="cfA">')}${champ('et (si « entre »)', '<input id="cfB">')}</div>
        <div id="cfStyle"><div class="dgrid3">${champ('Fond', '<input type="color" id="cfBg" value="#5e2a35">')}${champ('Texte', '<input type="color" id="cfC" value="#ffa8a8">')}${champ('Gras', '<input type="checkbox" id="cfGras">')}</div></div>
        <div id="cfEchelle" style="display:none"><div class="dgrid3">${champ('Min', '<input type="color" id="cfC1" value="#f87171">')}${champ('Milieu', '<input type="color" id="cfC2" value="#ffe066">')}${champ('Max', '<input type="color" id="cfC3" value="#4ade80">')}</div></div>
        <div id="cfIcones" style="display:none">${champ('Jeu d’icônes', `<select id="cfIco">${optHtml([['fleches', '▼ ▶ ▲'], ['feux', '🔴 🟡 🟢'], ['etoiles', '☆ ★ ★★']], 'fleches')}</select>`)}</div>
        <p class="hint" id="cfAide"></p></div></div>`,
    boutons: [{ txt: 'Fermer' }, {
      txt: 'Ajouter la règle', primary: true, act: (o) => {
        const type = val(o, 'cfType'), range = val(o, 'cfPlage').toUpperCase();
        if (!parsePlage(range)) { alert('Plage invalide (ex : B2:B20).'); return false; }
        const rule = { id: uid(), range, type, a: val(o, 'cfA'), b: val(o, 'cfB'), st: { bg: val(o, 'cfBg'), c: val(o, 'cfC'), b: coche(o, 'cfGras') } };
        if (type === 'echelle') rule.couleurs = [val(o, 'cfC1'), val(o, 'cfC2'), val(o, 'cfC3')];
        if (type === 'barres') rule.couleurs = [val(o, 'cfBg')];
        if (type === 'icones') rule.a = val(o, 'cfIco');
        modifier((G) => G.cf.push(rule));
        toast('Règle ajoutée');
      },
    }],
  });
  const maj = () => {
    const t = val(ov, 'cfType');
    const besoin = ['gt', 'ge', 'lt', 'le', 'eq', 'ne', 'entre', 'contient', 'debute', 'finit', 'top', 'bottom', 'formule'].includes(t);
    ov.querySelector('#cfValeurs').style.display = besoin ? '' : 'none';
    ov.querySelector('#cfB').closest('.dfield').style.display = t === 'entre' ? '' : 'none';
    ov.querySelector('#cfStyle').style.display = ['echelle', 'icones'].includes(t) ? 'none' : '';
    ov.querySelector('#cfEchelle').style.display = t === 'echelle' ? '' : 'none';
    ov.querySelector('#cfIcones').style.display = t === 'icones' ? '' : 'none';
    ov.querySelector('#cfAide').textContent = t === 'formule' ? 'Écris une formule relative à la première cellule de la plage, ex : =$B2>$C2 ou =ESTPAIR(LIGNE())' : t === 'barres' ? 'La couleur « Fond » sert de couleur de barre.' : '';
  };
  ov.addEventListener('change', maj); maj();
  ov.addEventListener('click', (e) => { const b = e.target.closest('[data-del]'); if (b) { modifier((G) => { G.cf = G.cf.filter((r) => r.id !== b.dataset.del); }); ouvrirCF('gerer'); } });
}

/* ================= Validation des données ================= */
const OPS_VALID = [['entre', 'Entre'], ['horsde', 'Pas entre'], ['egal', 'Égal à'], ['diff', 'Différent de'], ['sup', 'Supérieur à'], ['supeg', 'Supérieur ou égal à'], ['inf', 'Inférieur à'], ['infeg', 'Inférieur ou égal à']];
function ouvrirValidation(prefill) {
  const F = feuille(), R = rect(), plage = textePlage(R), ex = validationDe(F, R.r1, R.c1) || {};
  const ov = dialogue({
    titre: 'Validation des données',
    corps: `${champ('S’applique à', `<input id="dvPlage" value="${esc(ex.range || plage)}">`)}
      ${champ('Autoriser', `<select id="dvType">${optHtml([['liste', 'Liste de choix'], ['entier', 'Nombre entier'], ['decimal', 'Nombre décimal'], ['date', 'Date'], ['longueur', 'Longueur du texte'], ['case', 'Case à cocher'], ['perso', 'Formule personnalisée']], prefill || ex.type || 'liste')}</select>`)}
      <div id="dvOp">${champ('Opérateur', `<select id="dvOpSel">${optHtml(OPS_VALID, ex.op || 'entre')}</select>`)}<div class="dgrid2">${champ('Valeur / minimum', `<input id="dvA" value="${esc(ex.a || '')}">`)}${champ('Maximum', `<input id="dvB" value="${esc(ex.b || '')}">`)}</div></div>
      <div id="dvListe">${champ('Source', `<input id="dvSource" value="${esc(ex.source || '')}" placeholder="Oui;Non;Peut-être  ou  $A$1:$A$5">`, 'Valeurs séparées par « ; » ou plage de cellules')}</div>
      <div id="dvPerso">${champ('Formule', `<input id="dvF" value="${esc(ex.type === 'perso' ? ex.a : '')}" placeholder="=ESTNUM(A1)">`)}</div>
      ${champ('Message d’erreur', `<input id="dvMsg" value="${esc(ex.message || '')}" placeholder="Message affiché si la valeur est refusée">`)}
      <div class="dgrid2">${champ('En cas d’erreur', `<select id="dvAlerte">${optHtml([['stop', 'Arrêter (refuser)'], ['avertir', 'Avertir'], ['info', 'Informer']], ex.alerte || 'stop')}</select>`)}${champ('Ignorer si vide', `<input type="checkbox" id="dvVide" ${ex.ignoreVide === false ? '' : 'checked'}>`)}</div>`,
    boutons: [{ txt: 'Annuler' }, {
      txt: 'Supprimer la validation', danger: true, act: (o) => { const P = parsePlage(val(o, 'dvPlage')); if (P) modifier((G) => { G.valids = G.valids.filter((v) => { const Q = parsePlage(v.range); return !(Q && Q.r1 <= P.r2 && Q.r2 >= P.r1 && Q.c1 <= P.c2 && Q.c2 >= P.c1); }); }); },
    }, {
      txt: 'OK', primary: true, act: (o) => {
        const range = val(o, 'dvPlage').toUpperCase(), P = parsePlage(range), type = val(o, 'dvType');
        if (!P) { alert('Plage invalide.'); return false; }
        if (type === 'liste' && !val(o, 'dvSource').trim()) { alert('Indique la source de la liste.'); return false; }
        const rule = { id: uid(), range, type, op: val(o, 'dvOpSel'), a: type === 'perso' ? val(o, 'dvF') : val(o, 'dvA'), b: val(o, 'dvB'), source: val(o, 'dvSource'), message: val(o, 'dvMsg'), alerte: val(o, 'dvAlerte'), ignoreVide: coche(o, 'dvVide') };
        modifier((G) => {
          G.valids = G.valids.filter((v) => { const Q = parsePlage(v.range); return !(Q && Q.r1 <= P.r2 && Q.r2 >= P.r1 && Q.c1 <= P.c2 && Q.c2 >= P.c1); });
          G.valids.push(rule);
          if (type === 'case') for (let r = P.r1; r <= P.r2; r++) for (let c = P.c1; c <= P.c2; c++) { const cell = cellule(G, r, c); if (!cell || cell.v === '') poser(G, r, c, 'FAUX'); assurer(G, r, c).s.al = 'center'; }
        });
      },
    }],
  });
  const maj = () => {
    const t = val(ov, 'dvType');
    ov.querySelector('#dvOp').style.display = ['entier', 'decimal', 'date', 'longueur'].includes(t) ? '' : 'none';
    ov.querySelector('#dvListe').style.display = t === 'liste' ? '' : 'none';
    ov.querySelector('#dvPerso').style.display = t === 'perso' ? '' : 'none';
    ov.querySelector('#dvB').closest('.dfield').style.display = ['entre', 'horsde'].includes(val(ov, 'dvOpSel')) ? '' : 'none';
  };
  ov.addEventListener('change', maj); maj();
}

/* ================= Tableau croisé dynamique ================= */
function ouvrirTCD() {
  const F = feuille();
  let R = rect();
  if (R.r1 === R.r2 && R.c1 === R.c2) { const z = zoneUtilisee(F); if (z.r2 < 1) { toast('Écris d’abord des données (avec une ligne d’en-têtes).'); return; } R = { r1: 0, c1: 0, r2: z.r2, c2: z.c2 }; }
  const entetes = []; for (let c = R.c1; c <= R.c2; c++) entetes.push([c, texteAffiche(F, R.r1, c) || 'Colonne ' + colNom(c)]);
  const ov = dialogue({
    titre: 'Tableau croisé dynamique', large: true,
    corps: `${champ('Plage de données (1re ligne = en-têtes)', `<input id="tcSrc" value="${textePlage(R)}">`)}
      <div class="dgrid2">${champ('Lignes', '<select id="tcL"></select>')}${champ('Colonnes (facultatif)', '<select id="tcC"></select>')}</div>
      <div class="dgrid2">${champ('Valeurs', '<select id="tcV"></select>')}${champ('Calcul', `<select id="tcAgg">${optHtml([['SOMME', 'Somme'], ['NB', 'Nombre'], ['MOYENNE', 'Moyenne'], ['MIN', 'Minimum'], ['MAX', 'Maximum']], 'SOMME')}</select>`)}</div>
      <div class="dgrid2">${champ('Totaux', '<input type="checkbox" id="tcTot" checked>')}${champ('Ajouter un graphique', '<input type="checkbox" id="tcGr" checked>')}</div>
      <p class="hint">Le tableau est créé dans une nouvelle feuille avec des formules : il se met à jour si tes données changent (relance l’outil pour de nouvelles catégories).</p>`,
    boutons: [{ txt: 'Annuler' }, { txt: 'Créer', primary: true, act: (o) => { const r = creerTCD(o); if (r === false) return false; } }],
  });
  const rempl = () => {
    const P = parsePlage(val(ov, 'tcSrc')) || R;
    const opts = []; for (let c = P.c1; c <= P.c2; c++) opts.push([c, texteAffiche(F, P.r1, c) || 'Colonne ' + colNom(c)]);
    const garde = (id) => ov.querySelector('#' + id).value;
    const l = garde('tcL'), cc = garde('tcC'), v = garde('tcV');
    ov.querySelector('#tcL').innerHTML = optHtml(opts, l || opts[0][0]);
    ov.querySelector('#tcC').innerHTML = optHtml([['', '(aucune)'], ...opts], cc || '');
    ov.querySelector('#tcV').innerHTML = optHtml(opts, v || (opts[opts.length - 1] || opts[0])[0]);
  };
  rempl();
  ov.querySelector('#tcSrc').addEventListener('change', rempl);
  void entetes;
}

function creerTCD(o) {
  const T = tableur(), F = feuille(), P = parsePlage(val(o, 'tcSrc'));
  if (!P || P.r2 <= P.r1) { alert('Plage invalide : il faut une ligne d’en-têtes et des données.'); return false; }
  const cL = +val(o, 'tcL'), cC = val(o, 'tcC') === '' ? null : +val(o, 'tcC'), cV = +val(o, 'tcV'), agg = val(o, 'tcAgg'), tot = coche(o, 'tcTot'), gr = coche(o, 'tcGr');
  const unique = (col) => {
    const vus = new Map();
    for (let r = P.r1 + 1; r <= P.r2; r++) { const v = valCell(sh.ctx, F, r, col); if (v === null || v === '') continue; const k = texte(v).toLowerCase(); if (!vus.has(k)) vus.set(k, { v, t: texteAffiche(F, r, col) }); }
    return [...vus.values()].sort((a, b) => (typeof a.v === 'number' && typeof b.v === 'number' ? a.v - b.v : String(a.t).localeCompare(String(b.t), 'fr')));
  };
  const lignes = unique(cL), colonnes = cC === null ? [] : unique(cC);
  if (!lignes.length) { alert('Aucune donnée dans la colonne choisie pour les lignes.'); return false; }
  const rg = (col) => `'${F.nom.replace(/'/g, "''")}'!$${colNom(col)}$${P.r1 + 2}:$${colNom(col)}$${P.r2 + 1}`;
  const nomAgg = { SOMME: 'Somme', NB: 'Nombre', MOYENNE: 'Moyenne', MIN: 'Minimum', MAX: 'Maximum' }[agg];
  const formule = (critL, critC) => {
    const crit = [];
    if (critL) crit.push(rg(cL), critL);
    if (critC) crit.push(rg(cC), critC);
    if (agg === 'NB') return crit.length ? `NB.SI.ENS(${crit.join(';')})` : `NB(${rg(cV)})`;
    const nomF = { SOMME: 'SOMME.SI.ENS', MOYENNE: 'MOYENNE.SI.ENS', MIN: 'MIN.SI.ENS', MAX: 'MAX.SI.ENS' }[agg];
    if (!crit.length) return `${agg}(${rg(cV)})`;
    return agg === 'MOYENNE' ? `SIERREUR(${nomF}(${rg(cV)};${crit.join(';')});"")` : `${nomF}(${rg(cV)};${crit.join(';')})`;
  };
  const cells = {}, ent = { b: true, bg: '#2a2a31' };
  const nomV = texteAffiche(F, P.r1, cV), nomL = texteAffiche(F, P.r1, cL), nomC = cC === null ? '' : texteAffiche(F, P.r1, cC);
  const setC = (r, c, v, s) => { cells[adr(r, c)] = { v: String(v), s: s || {} }; };
  setC(0, 0, cC === null ? nomL : `${nomAgg} de ${nomV}`, ent);
  if (cC === null) setC(0, 1, `${nomAgg} de ${nomV}`, ent);
  else { colonnes.forEach((x, j) => setC(0, 1 + j, x.t, { ...ent, al: 'center' })); if (tot) setC(0, 1 + colonnes.length, 'Total général', { ...ent, al: 'center' }); }
  lignes.forEach((x, i) => {
    const r = i + 1;
    setC(r, 0, x.t, { b: true });
    if (cC === null) setC(r, 1, '=' + formule(`$A${r + 1}`, null), { fmt: agg === 'NB' ? undefined : undefined });
    else {
      colonnes.forEach((_, j) => setC(r, 1 + j, '=' + formule(`$A${r + 1}`, `${colNom(1 + j)}$1`)));
      if (tot) setC(r, 1 + colonnes.length, '=' + formule(`$A${r + 1}`, null), { b: true });
    }
  });
  const dernLigne = lignes.length;
  if (tot) {
    setC(dernLigne + 1, 0, 'Total général', { b: true, bg: '#35301f' });
    if (cC === null) setC(dernLigne + 1, 1, '=' + formule(null, null), { b: true, bg: '#35301f' });
    else {
      colonnes.forEach((_, j) => setC(dernLigne + 1, 1 + j, '=' + formule(null, `${colNom(1 + j)}$1`), { b: true, bg: '#35301f' }));
      setC(dernLigne + 1, 1 + colonnes.length, '=' + formule(null, null), { b: true, bg: '#35301f' });
    }
  }
  const nb = T.feuilles.filter((f) => /^TCD/.test(f.nom)).length + 1;
  const G = nouvelleFeuille('TCD ' + nb);
  G.cells = cells; G.nbL = Math.max(30, lignes.length + 8); G.nbC = Math.max(12, colonnes.length + 4);
  G.largeurs = { 0: 170 };
  const larg = cC === null ? 1 : colonnes.length;
  if (gr) G.graphs = [{ id: uid(), type: cC === null ? 'bar' : 'bar', range: `A1:${colNom(larg)}${lignes.length + 1}`, titre: `${nomAgg} de ${nomV} par ${nomL}`, legende: true }];
  T.feuilles.push(G);
  journaliser('Tableau croisé dynamique créé', G.nom);
  sauver();
  ui.feuille = T.feuilles.length - 1;
  sh.sel = { r1: 0, c1: 0, r2: 0, c2: 0 };
  sh.histo = { id: null, undo: [], redo: [] };
  renderGrille();
  toast('Tableau croisé dynamique créé dans « ' + G.nom + ' »');
}

/* ================= Rechercher / remplacer ================= */
sh.rech = { q: '', rep: '', casse: false, entier: false, valeurs: false, classeur: false };
function trouverTout(o) {
  const T = tableur(), res = [];
  const q = o.casse ? o.q : o.q.toLowerCase();
  if (!q) return res;
  const ctx = nouveauCtx(T);
  evaluerTout(ctx);
  const feuilles = o.classeur ? T.feuilles : [feuille()];
  for (const f of feuilles) {
    const cles = Object.keys(f.cells).map((a) => ({ a, ...parseAdr(a) })).sort((x, y) => x.r - y.r || x.c - y.c);
    for (const { a, r, c } of cles) {
      const cell = f.cells[a];
      let t = o.valeurs ? afficher(cell, valCell(ctx, f, r, c)) : cell.v;
      if (!t) continue;
      if (!o.casse) t = t.toLowerCase();
      if (o.entier ? t === q : t.includes(q)) res.push({ f, r, c });
    }
  }
  return res;
}
function ouvrirRecherche(avecRemplacer) {
  const st = sh.rech;
  const ov = dialogue({
    titre: avecRemplacer ? 'Rechercher et remplacer' : 'Rechercher', modal: false,
    corps: `${champ('Rechercher', `<input id="rcQ" value="${esc(st.q)}">`)}${champ('Remplacer par', `<input id="rcR" value="${esc(st.rep)}">`)}
      <div class="dchecks"><label><input type="checkbox" id="rcCasse" ${st.casse ? 'checked' : ''}> Respecter la casse</label><label><input type="checkbox" id="rcEntier" ${st.entier ? 'checked' : ''}> Cellule entière</label><label><input type="checkbox" id="rcVal" ${st.valeurs ? 'checked' : ''}> Dans les valeurs affichées</label><label><input type="checkbox" id="rcClas" ${st.classeur ? 'checked' : ''}> Tout le classeur</label></div>
      <div id="rcRes" class="drc"></div>`,
    boutons: [
      { txt: 'Tout rechercher', garder: true, act: (o) => { lire(o); const r = trouverTout(st); o.querySelector('#rcRes').innerHTML = r.length ? r.slice(0, 200).map((x, i) => `<button data-i="${i}">${esc(x.f.nom)}!${adr(x.r, x.c)} — ${esc(texteApercu(x))}</button>`).join('') : '<span class="hint">Aucun résultat</span>'; o._res = r; } },
      { txt: 'Suivant', garder: true, primary: true, act: (o) => { lire(o); suivant(o); } },
      { txt: 'Remplacer', garder: true, act: (o) => { lire(o); remplacerUn(o); } },
      { txt: 'Tout remplacer', garder: true, act: (o) => { lire(o); remplacerTout(o); } },
    ],
  });
  const lire = (o) => { st.q = val(o, 'rcQ'); st.rep = val(o, 'rcR'); st.casse = coche(o, 'rcCasse'); st.entier = coche(o, 'rcEntier'); st.valeurs = coche(o, 'rcVal'); st.classeur = coche(o, 'rcClas'); };
  const texteApercu = (x) => { const v = x.f.cells[adr(x.r, x.c)].v; return v.length > 40 ? v.slice(0, 40) + '…' : v; };
  const aller_ = (x) => {
    const T = tableur(), i = T.feuilles.indexOf(x.f);
    if (i !== (ui.feuille || 0)) { ui.feuille = i; renderGrille(); }
    selectionner(x.r, x.c, x.r, x.c); defiler();
  };
  const suivant = (o) => {
    const r = trouverTout(st);
    if (!r.length) { toast('Aucun résultat'); return null; }
    const T = tableur(), fi = ui.feuille || 0, A = actif();
    const pos = (x) => T.feuilles.indexOf(x.f) * 1e8 + x.r * 1e4 + x.c;
    const cur = fi * 1e8 + A.r * 1e4 + A.c;
    const x = r.find((y) => pos(y) > cur) || r[0];
    aller_(x);
    return x;
  };
  const remplacerUn = (o) => {
    const F = feuille(), A = actif(), cell = cellule(F, A.r, A.c);
    const rx = new RegExp(reEsc(st.q), st.casse ? 'g' : 'gi');
    if (cell && cell.v && (st.entier ? (st.casse ? cell.v === st.q : cell.v.toLowerCase() === st.q.toLowerCase()) : rx.test(cell.v))) {
      modifier((G) => { const c = cellule(G, A.r, A.c); c.v = st.entier ? st.rep : c.v.replace(new RegExp(reEsc(st.q), st.casse ? 'g' : 'gi'), () => st.rep); });
    }
    suivant(o);
  };
  const remplacerTout = (o) => {
    const r = trouverTout({ ...st, valeurs: false });
    if (!r.length) { toast('Aucun résultat'); return; }
    const rx = new RegExp(reEsc(st.q), st.casse ? 'g' : 'gi');
    pousser(feuille());
    r.forEach((x) => { const c = x.f.cells[adr(x.r, x.c)]; c.v = st.entier ? st.rep : c.v.replace(rx, () => st.rep); });
    sauver(); renderGrille();
    toast(`${r.length} remplacement(s)`);
  };
  ov.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b && ov._res) aller_(ov._res[+b.dataset.i]); });
  ov.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'rcQ') { e.preventDefault(); lire(ov); suivant(ov); } });
}

/* ================= Noms définis ================= */
function ouvrirNoms() {
  const T = tableur();
  T.noms = T.noms || {};
  const liste = Object.entries(T.noms).map(([n, d]) => { const f = T.feuilles.find((x) => x.id === d.f); return `<div class="drule"><span><b>${esc(n)}</b> → ${esc(f ? f.nom : '?')}!${textePlage(d)}</span><button class="btn ghost danger" data-del="${esc(n)}">🗑️</button></div>`; }).join('') || '<p class="hint">Aucun nom défini.</p>';
  const ov = dialogue({
    titre: 'Gestionnaire de noms',
    corps: `${liste}<hr>${champ('Nouveau nom', '<input id="nmN" placeholder="ex : Notes, Total">')}${champ('Fait référence à', `<input id="nmR" value="${textePlage(rect())}">`, 'Une plage de la feuille active, ex : B2:B10')}`,
    boutons: [{ txt: 'Fermer' }, {
      txt: 'Ajouter', primary: true, act: (o) => {
        const n = val(o, 'nmN').trim(), P = parsePlage(val(o, 'nmR'));
        if (!/^[A-Za-zÀ-ÿ_][\wÀ-ÿ.]*$/.test(n) || /^[A-Za-z]{1,3}\d+$/.test(n)) { alert('Nom invalide (lettres, chiffres, _ ou . ; ne ressemble pas à une adresse).'); return false; }
        if (!P) { alert('Plage invalide.'); return false; }
        T.noms[n.toUpperCase()] = { f: feuille().id, ...P };
        sauver(); toast(`Nom « ${n.toUpperCase()} » ajouté`);
        ouvrirNoms();
        return false;
      },
    }],
  });
  ov.addEventListener('click', (e) => { const b = e.target.closest('[data-del]'); if (b) { delete T.noms[b.dataset.del]; sauver(); ouvrirNoms(); } });
}

/* ================= Tri personnalisé ================= */
function ouvrirTriPerso() {
  const F = feuille();
  let R = rect();
  if (R.r1 === R.r2 && R.c1 === R.c2) { const z = zoneUtilisee(F); if (z.r2 < 1) return; R = { r1: 0, c1: 0, r2: z.r2, c2: z.c2 }; }
  const cols = []; for (let c = R.c1; c <= R.c2; c++) cols.push([c, `Colonne ${colNom(c)} — ${texteAffiche(F, R.r1, c).slice(0, 20)}`]);
  const niveau = (i) => `<div class="dgrid3 lvl">${champ(i === 0 ? 'Trier par' : 'Puis par', `<select id="tpC${i}">${i > 0 ? '<option value="">(aucun)</option>' : ''}${optHtml(cols, R.c1)}</select>`)}${champ('Ordre', `<select id="tpO${i}">${optHtml([['asc', 'A → Z / croissant'], ['desc', 'Z → A / décroissant']], 'asc')}</select>`)}</div>`;
  dialogue({
    titre: 'Tri personnalisé',
    corps: `<p class="hint">Plage : ${textePlage(R)}</p>${niveau(0)}${niveau(1)}${niveau(2)}${champ('Mes données ont des en-têtes', '<input type="checkbox" id="tpEnt" checked>')}`,
    boutons: [{ txt: 'Annuler' }, {
      txt: 'Trier', primary: true, act: (o) => {
        const niveaux = [0, 1, 2].filter((i) => val(o, 'tpC' + i) !== '').map((i) => ({ col: +val(o, 'tpC' + i), desc: val(o, 'tpO' + i) === 'desc' }));
        trierPlage(R, niveaux, coche(o, 'tpEnt'));
      },
    }],
  });
}

/* ================= Valeur cible ================= */
function ouvrirCible() {
  const A = actif();
  dialogue({
    titre: 'Valeur cible', modal: false,
    corps: `<p class="hint">Trouve la valeur d’une cellule (nombre) qui donne le résultat voulu dans une cellule contenant une formule.</p>
      ${champ('Cellule à définir (formule)', `<input id="vcC" value="${adr(A.r, A.c)}">`)}${champ('Valeur à atteindre', '<input id="vcV" value="10">')}${champ('En changeant la cellule', '<input id="vcX" placeholder="ex : B2">')}`,
    boutons: [{ txt: 'Annuler' }, { txt: 'Résoudre', primary: true, act: (o) => resoudreCible(val(o, 'vcC'), val(o, 'vcV'), val(o, 'vcX')) }],
  });
}
function resoudreCible(cAdr, objectif, xAdr) {
  const T = tableur(), F = feuille(), pc = parseAdr(cAdr), px = parseAdr(xAdr), but = constante(objectif);
  if (!pc || !px || typeof but !== 'number') { alert('Vérifie les adresses de cellules et la valeur cible.'); return false; }
  const ancien = cellule(F, px.r, px.c) ? cellule(F, px.r, px.c).v : '';
  const f = (x) => { poser(F, px.r, px.c, String(x)); const y = valCell(nouveauCtx(T), F, pc.r, pc.c); return typeof y === 'number' ? y - but : NaN; };
  let x0 = typeof constante(ancien) === 'number' ? constante(ancien) : 1, x1 = x0 + 1, y0 = f(x0), y1 = f(x1), trouve = null;
  if (Math.abs(y0) < 1e-10) trouve = x0;
  for (let i = 0; i < 100 && trouve === null; i++) {
    if (!isFinite(y0) || !isFinite(y1)) break;
    if (y1 === y0) { x1 += 1; y1 = f(x1); continue; }
    const x2 = x1 - y1 * (x1 - x0) / (y1 - y0);
    x0 = x1; y0 = y1; x1 = x2; y1 = f(x1);
    if (Math.abs(y1) < 1e-9) trouve = x1;
  }
  if (trouve === null) { poser(F, px.r, px.c, ancien); toast('Aucune solution trouvée.'); return false; }
  poser(F, px.r, px.c, ancien);
  modifier((G) => poser(G, px.r, px.c, String(parseFloat(trouve.toPrecision(12))).replace('.', ',')));
  toast(`Solution : ${cAdr.toUpperCase()} = ${fmtNombre(but)} pour ${xAdr.toUpperCase()} = ${fmtNombre(parseFloat(trouve.toPrecision(8)))}`);
}

/* ================= Insérer une fonction ================= */
function ouvrirInsererFonction() {
  const ov = dialogue({
    titre: 'Insérer une fonction', large: true,
    corps: `<div class="dgrid2">${champ('Rechercher', '<input id="ifQ" placeholder="ex : somme, moyenne, si…">')}${champ('Catégorie', `<select id="ifCat">${optHtml([['', 'Toutes'], ...CATEGORIES.map((c) => [c, c])], '')}</select>`)}</div>
      <div class="dcols"><div id="ifListe" class="ifliste"></div><div id="ifDesc" class="ifdesc"></div></div>`,
    boutons: [{ txt: 'Annuler' }, { txt: 'Insérer', primary: true, act: (o) => { const n = o._sel; if (n) insererFonction(n); else return false; } }],
  });
  const maj = () => {
    const q = val(ov, 'ifQ').toUpperCase(), cat = val(ov, 'ifCat');
    const l = FONC_LISTE.filter((f) => (!cat || f.cat === cat) && (!q || f.fr.includes(q) || f.en.includes(q) || f.desc.toUpperCase().includes(q)));
    ov.querySelector('#ifListe').innerHTML = l.map((f) => `<button data-f="${f.fr}" class="${ov._sel === f.fr ? 'on' : ''}"><b>${f.fr}</b><small>${esc(f.desc)}</small></button>`).join('') || '<p class="hint">Aucun résultat</p>';
  };
  ov.addEventListener('input', maj);
  ov.addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (!b) return; ov._sel = b.dataset.f; const f = FONC_PAR_FR[ov._sel]; ov.querySelector('#ifDesc').innerHTML = `<h4>${f.fr} <small class="hint">(${f.en} en anglais)</small></h4><code>${esc(f.syntaxe)}</code><p>${esc(f.desc)}</p><p class="hint">Catégorie : ${esc(f.cat)}</p>`; maj(); });
  ov.addEventListener('dblclick', (e) => { const b = e.target.closest('[data-f]'); if (b) { fermerDialogue(); insererFonction(b.dataset.f); } });
  maj();
}

/* ================= Mise en page ================= */
function ouvrirMiseEnPage() {
  const F = feuille(), im = F.impr;
  dialogue({
    titre: 'Mise en page',
    corps: `${champ('Orientation', `<select id="mpO">${optHtml([['portrait', 'Portrait'], ['paysage', 'Paysage']], im.orient)}</select>`)}${champ('Échelle (%)', `<input id="mpE" type="number" min="30" max="200" value="${im.echelle || 100}">`)}
      ${champ('Zone d’impression', `<input id="mpZ" value="${esc(im.zone || '')}" placeholder="ex : A1:F30 (vide = toute la feuille)">`)}
      <div class="dchecks"><label><input type="checkbox" id="mpQ" ${im.quad ? 'checked' : ''}> Imprimer le quadrillage</label><label><input type="checkbox" id="mpEnt" ${im.entetes ? 'checked' : ''}> Imprimer les en-têtes (A, B, 1, 2…)</label><label><input type="checkbox" id="mpG" ${im.graphs === false ? '' : 'checked'}> Imprimer les graphiques</label></div>`,
    boutons: [{ txt: 'Annuler' }, { txt: 'OK', act: (o) => majMiseEnPage(o) }, { txt: 'Imprimer', primary: true, act: (o) => { majMiseEnPage(o); imprimerFeuille(); } }],
  });
}
function majMiseEnPage(o) {
  const z = val(o, 'mpZ').trim().toUpperCase();
  modifier((G) => { G.impr = { orient: val(o, 'mpO'), echelle: Math.max(30, Math.min(200, +val(o, 'mpE') || 100)), zone: parsePlage(z) ? z : null, quad: coche(o, 'mpQ'), entetes: coche(o, 'mpEnt'), graphs: coche(o, 'mpG') }; });
}

function imprimerFeuille() {
  finirEdition(true);
  const F = feuille(), im = F.impr || {};
  let R = im.zone ? parsePlage(im.zone) : null;
  if (!R) { const z = zoneUtilisee(F); R = { r1: 0, c1: 0, r2: Math.max(0, z.r2), c2: Math.max(0, z.c2) }; }
  const ctx = sh.ctx;
  let h = `<table class="prt${im.quad ? ' grid' : ''}" style="zoom:${(im.echelle || 100) / 100}"><colgroup>${im.entetes ? '<col style="width:30px">' : ''}`;
  for (let c = R.c1; c <= R.c2; c++) if (!sh.masqC.has(c)) h += `<col style="width:${F.largeurs[c] || LARG_DEF}px">`;
  h += '</colgroup>';
  if (im.entetes) { h += '<thead><tr><th></th>'; for (let c = R.c1; c <= R.c2; c++) if (!sh.masqC.has(c)) h += `<th>${colNom(c)}</th>`; h += '</tr></thead>'; }
  h += '<tbody>';
  for (let r = R.r1; r <= R.r2; r++) {
    if (sh.masqL.has(r)) continue;
    h += `<tr style="height:${F.hauteurs[r] || HAUT_DEF}px">${im.entetes ? `<th>${r + 1}</th>` : ''}`;
    for (let c = R.c1; c <= R.c2; c++) {
      if (sh.masqC.has(c) || sh.couv.has(r + ',' + c)) continue;
      const cell = cellule(F, r, c), v = valCell(ctx, F, r, c), m = sh.fus.get(r + ',' + c);
      const css = styleCss(F, cell, v, sh.cf.length ? cfCell(ctx, F, sh.cf, r, c, v) : null).replace(/color:#f3f3f4;?/g, '');
      const span = m ? ` colspan="${m.c2 - m.c1 + 1}" rowspan="${m.r2 - m.r1 + 1}"` : '';
      let t = v !== null && typeof v === 'object' && v.spark ? '' : esc2(afficher(cell, v));
      const vd = validationDe(F, r, c);
      if (vd && vd.type === 'case') t = v === true ? '☑' : '☐';
      h += `<td${span} style="${css}">${t}</td>`;
    }
    h += '</tr>';
  }
  h += '</tbody></table>';
  const graphs = im.graphs === false ? '' : [...document.querySelectorAll('#shGraphs .gcard')].map((x) => `<div class="prg">${x.querySelector('svg') ? x.querySelector('svg').outerHTML : ''}</div>`).join('');
  const root = document.createElement('div');
  root.id = 'shPrintRoot';
  root.innerHTML = `<h2 class="prtitre">${esc(tableur().nom)} — ${esc(F.nom)}</h2>${h}${graphs}`;
  const style = document.createElement('style');
  style.id = 'shPrintStyle';
  style.textContent = `@page { size: A4 ${im.orient === 'paysage' ? 'landscape' : 'portrait'}; margin: 12mm; }`;
  document.body.append(root, style);
  document.body.classList.add('printing-sheet');
  const fin = () => { document.body.classList.remove('printing-sheet'); root.remove(); style.remove(); window.removeEventListener('afterprint', fin); };
  window.addEventListener('afterprint', fin);
  setTimeout(() => { window.print(); setTimeout(() => { if (document.getElementById('shPrintRoot')) fin(); }, 500); }, 50);
}

/* ================= Options de graphique ================= */
function ouvrirOptionsGraph(id) {
  const F = feuille(), g = F.graphs.find((x) => x.id === id);
  if (!g) return;
  dialogue({
    titre: 'Options du graphique',
    corps: `${champ('Type', `<select id="goT">${optHtml(Object.entries(TYPES_GRAPH), g.type)}</select>`)}${champ('Titre', `<input id="goTi" value="${esc(g.titre)}">`)}${champ('Données', `<input id="goR" value="${esc(g.range)}">`)}
      <div class="dgrid2">${champ('Titre axe X', `<input id="goX" value="${esc(g.axeX || '')}">`)}${champ('Titre axe Y', `<input id="goY" value="${esc(g.axeY || '')}">`)}</div>
      <div class="dchecks"><label><input type="checkbox" id="goL" ${g.legende === false ? '' : 'checked'}> Légende</label><label><input type="checkbox" id="goE" ${g.etiq ? 'checked' : ''}> Étiquettes de données</label><label><input type="checkbox" id="goTd" ${g.tend ? 'checked' : ''}> Courbe de tendance (courbes / nuage)</label></div>`,
    boutons: [{ txt: 'Annuler' }, { txt: 'Supprimer', danger: true, act: () => { modifier((G) => { G.graphs = G.graphs.filter((x) => x.id !== id); }); } }, {
      txt: 'OK', primary: true, act: (o) => {
        if (!parsePlage(val(o, 'goR'))) { alert('Plage invalide.'); return false; }
        modifier(() => { Object.assign(g, { type: val(o, 'goT'), titre: val(o, 'goTi'), range: val(o, 'goR').toUpperCase(), axeX: val(o, 'goX'), axeY: val(o, 'goY'), legende: coche(o, 'goL'), etiq: coche(o, 'goE'), tend: coche(o, 'goTd') }); });
      },
    }],
  });
}

/* ================= Liens et notes ================= */
function modifierLien() {
  const F = feuille(), A = actif(), cell = cellule(F, A.r, A.c);
  dialogue({
    titre: 'Lien hypertexte',
    corps: `${champ('Adresse', `<input id="lnU" value="${esc(cell && cell.l || '')}" placeholder="https://…">`)}${champ('Texte à afficher', `<input id="lnT" value="${esc(cell && cell.v[0] !== '=' ? cell.v : '')}" placeholder="(facultatif)">`)}`,
    boutons: [{ txt: 'Annuler' }, { txt: 'Supprimer le lien', danger: true, act: () => modifier((G) => { const c = cellule(G, A.r, A.c); if (c) { delete c.l; nettoyer(G, adr(A.r, A.c)); } }) }, {
      txt: 'OK', primary: true, act: (o) => {
        const u = val(o, 'lnU').trim(), t = val(o, 'lnT');
        modifier((G) => { const c = assurer(G, A.r, A.c); if (u) c.l = u; else delete c.l; if (t && c.v[0] !== '=') c.v = t; else if (!c.v && u) c.v = u; });
      },
    }],
  });
}
function modifierNote() {
  const F = feuille(), A = actif(), cell = cellule(F, A.r, A.c);
  dialogue({
    titre: `Note — ${adr(A.r, A.c)}`,
    corps: champ('Texte de la note', `<textarea id="ntT" rows="5">${esc(cell && cell.n || '')}</textarea>`),
    boutons: [{ txt: 'Annuler' }, { txt: 'OK', primary: true, act: (o) => { const t = val(o, 'ntT').trim(); modifier((G) => { const c = assurer(G, A.r, A.c); if (t) c.n = t; else delete c.n; nettoyer(G, adr(A.r, A.c)); }); } }],
  });
}

/* ================= Outils de données ================= */
function textEnColonnes() {
  const F = feuille(), R = rect();
  if (R.c1 !== R.c2) { toast('Sélectionne une seule colonne.'); return; }
  dialogue({
    titre: 'Texte en colonnes',
    corps: `<p class="hint">Découpe le texte de ${textePlage(R)} dans les colonnes situées à droite.</p>${champ('Séparateur', `<select id="tcSep">${optHtml([[';', 'Point-virgule ;'], [',', 'Virgule ,'], ['\t', 'Tabulation'], [' ', 'Espace'], ['-', 'Tiret -'], ['/', 'Barre oblique /'], ['autre', 'Autre…']], ';')}</select>`)}${champ('Autre séparateur', '<input id="tcAutre" maxlength="5">')}`,
    boutons: [{ txt: 'Annuler' }, {
      txt: 'Convertir', primary: true, act: (o) => {
        const sep = val(o, 'tcSep') === 'autre' ? val(o, 'tcAutre') : val(o, 'tcSep');
        if (!sep) { alert('Indique un séparateur.'); return false; }
        modifier((G) => {
          for (let r = R.r1; r <= R.r2; r++) {
            const t = brut(G, r, R.c1);
            if (!t || t[0] === '=') continue;
            t.split(sep).forEach((p, j) => { if (R.c1 + j < MAXC) { if (R.c1 + j >= G.nbC) G.nbC = R.c1 + j + 1; poser(G, r, R.c1 + j, p.trim()); } });
          }
        });
      },
    }],
  });
}

function supprimerDoublons() {
  const F = feuille();
  let R = rect();
  if (R.r1 === R.r2 && R.c1 === R.c2) { const z = zoneUtilisee(F); if (z.r2 < 1) return; R = { r1: 0, c1: 0, r2: z.r2, c2: z.c2 }; }
  dialogue({
    titre: 'Supprimer les doublons',
    corps: `<p class="hint">Plage : ${textePlage(R)}. Une ligne est un doublon si toutes ses colonnes sont identiques à une ligne précédente.</p>${champ('Mes données ont des en-têtes', '<input type="checkbox" id="ddE" checked>')}`,
    boutons: [{ txt: 'Annuler' }, {
      txt: 'Supprimer', primary: true, act: (o) => {
        const debut = R.r1 + (coche(o, 'ddE') ? 1 : 0), vus = new Set(), garde = [];
        for (let r = debut; r <= R.r2; r++) {
          let k = '';
          for (let c = R.c1; c <= R.c2; c++) k += texte(valCell(sh.ctx, F, r, c)).toLowerCase() + '\u0001';
          if (vus.has(k)) continue;
          vus.add(k); garde.push(r);
        }
        const supprimes = R.r2 - debut + 1 - garde.length;
        modifier((G) => {
          const copie = garde.map((r) => { const o2 = {}; for (let c = R.c1; c <= R.c2; c++) { const cell = cellule(G, r, c); if (cell) o2[c] = JSON.parse(JSON.stringify(cell)); } return o2; });
          for (let r = debut; r <= R.r2; r++) for (let c = R.c1; c <= R.c2; c++) delete G.cells[adr(r, c)];
          copie.forEach((row, i) => { for (const [c, cell] of Object.entries(row)) G.cells[adr(debut + i, +c)] = cell; });
        });
        toast(`${supprimes} doublon(s) supprimé(s), ${garde.length} valeur(s) unique(s) conservée(s).`);
      },
    }],
  });
}

/* ================= CSV ================= */
function exporterCsv() {
  const F = feuille(), z = zoneUtilisee(F), ctx = sh.ctx;
  const lignes = [];
  for (let r = 0; r <= z.r2; r++) {
    const l = [];
    for (let c = 0; c <= z.c2; c++) {
      let t = afficher(cellule(F, r, c), valCell(ctx, F, r, c));
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
  let ligne = [], champ_ = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { champ_ += '"'; i++; } else q = false; } else champ_ += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { ligne.push(champ_); champ_ = ''; }
    else if (ch === '\n') { ligne.push(champ_.replace(/\r$/, '')); lignes.push(ligne); ligne = []; champ_ = ''; }
    else champ_ += ch;
  }
  if (champ_ !== '' || ligne.length) { ligne.push(champ_.replace(/\r$/, '')); lignes.push(ligne); }
  return lignes;
}
function importerCsv(f) {
  const rd = new FileReader();
  rd.onload = () => {
    const lignes = parserCsv(String(rd.result));
    const T = tableur(), G = nouvelleFeuille((f.name.replace(/\.\w+$/, '') || 'Import').slice(0, 30));
    lignes.slice(0, MAXL).forEach((l, r) => l.slice(0, MAXC).forEach((v, c) => { if (v !== '') { const s = {}; const fa = v[0] !== '=' ? formatAuto(v) : null; if (fa) Object.assign(s, fa); G.cells[adr(r, c)] = { v, s }; } }));
    G.nbL = Math.max(30, Math.min(MAXL, lignes.length + 5));
    G.nbC = Math.max(12, Math.min(MAXC, Math.max(...lignes.map((l) => l.length)) + 1));
    T.feuilles.push(G);
    journaliser('CSV importé : ' + G.nom, T.nom);
    sauver();
    ui.feuille = T.feuilles.length - 1;
    sh.sel = { r1: 0, c1: 0, r2: 0, c2: 0 };
    render();
    toast('Fichier importé dans une nouvelle feuille');
  };
  rd.readAsText(f);
}
