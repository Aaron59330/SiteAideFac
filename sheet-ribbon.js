'use strict';
/* ============================================================
   Tableur : ruban (onglets), actions, menu contextuel, filtres
   ============================================================ */

const POLICES = { Arial: 'Arial, Helvetica, sans-serif', Verdana: 'Verdana, sans-serif', 'Times New Roman': '"Times New Roman", serif', 'Courier New': '"Courier New", monospace', Georgia: 'Georgia, serif', 'Trebuchet MS': '"Trebuchet MS", sans-serif', 'Comic Sans MS': '"Comic Sans MS", cursive' };
const TAILLES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48];
const ONGLETS_RUBAN = [['accueil', 'Accueil'], ['insertion', 'Insertion'], ['miseenpage', 'Mise en page'], ['formules', 'Formules'], ['donnees', 'Données'], ['affichage', 'Affichage']];

const rb = (a, i, t, tip, cls = '') => `<button class="rb ${cls}" data-sh="${a}" title="${esc(tip || t || '')}"><span class="ri">${i}</span>${t ? `<span class="rt">${t}</span>` : ''}</button>`;
const rm = (i, t, items, tip) => `<details class="more rmenu"><summary class="rb" title="${esc(tip || t)}"><span class="ri">${i}</span><span class="rt">${t} ▾</span></summary><div class="menu">${items.map(([a, l, cls]) => (a === '-' ? '<hr>' : `<button data-sh="${a}"${cls ? ` class="${cls}"` : ''}>${l}</button>`)).join('')}</div></details>`;
const rg = (titre, inner) => `<div class="rg"><div class="rgb">${inner}</div><div class="rgt">${titre}</div></div>`;
const selectHtml = (id, opts, tip) => `<select id="${id}" class="rsel" title="${tip}">${opts.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select>`;

const FORMATS_NOMBRE = [['', 'Standard'], ['n', 'Nombre'], ['eur', 'Monétaire (€)'], ['pct', 'Pourcentage'], ['date', 'Date courte'], ['datel', 'Date longue'], ['heure', 'Heure'], ['sci', 'Scientifique'], ['txt', 'Texte'], ['code', 'Personnalisé…']];

function contenuRuban(onglet) {
  switch (onglet) {
    case 'insertion':
      return rg('Tableaux', rb('tcd', '🧮', 'Tableau croisé dynamique', 'Résumer des données (somme, moyenne… par catégorie)') + rb('tableauSel', '▤', 'Mettre sous forme de tableau', 'Appliquer un style de tableau à la sélection')) +
        rg('Graphiques', rm('📊', 'Histogramme', [['graph:bar', 'Groupé'], ['graph:stack', 'Empilé'], ['graph:barh', 'Barres horizontales']]) + rb('graph:line', '📈', 'Courbes') + rb('graph:area', '⛰', 'Aires') + rb('graph:scatter', '⁙', 'Nuage de points') + rm('🥧', 'Secteurs', [['graph:pie', 'Camembert'], ['graph:donut', 'Anneau']])) +
        rg('Minigraphiques', rm('〰', 'Minigraphique', [['mini:courbe', 'Courbe'], ['mini:colonnes', 'Colonnes'], ['mini:gain', 'Gain / perte']], 'Petit graphique dans une cellule')) +
        rg('Liens et notes', rb('lien', '🔗', 'Lien', 'Insérer un lien hypertexte (Ctrl+K)') + rb('note', '💬', 'Note', 'Ajouter une note à la cellule') + rb('noteSuppr', '🚫', 'Supprimer la note')) +
        rg('Contrôles', rb('cases', '☑', 'Cases à cocher', 'Transformer la sélection en cases à cocher') + rb('liste', '▾', 'Liste déroulante', 'Limiter la saisie à une liste de choix') + rb('validation', '🛡', 'Validation des données'));
    case 'miseenpage':
      return rg('Mise en page', rm('📄', 'Orientation', [['orient:portrait', 'Portrait'], ['orient:paysage', 'Paysage']]) + rb('echelle-', '−', '', 'Réduire l’échelle d’impression') + rb('echelle+', '＋', '', 'Agrandir l’échelle d’impression') + rb('miseEnPage', '⚙', 'Options…')) +
        rg('Zone d’impression', rb('zone:def', '▣', 'Définir', 'Définir la sélection comme zone d’impression') + rb('zone:eff', '▢', 'Effacer')) +
        rg('Options de la feuille', rb('quadImpr', '▦', 'Quadrillage imprimé') + rb('quad', '▦', 'Quadrillage affiché') + rb('ent', '🔤', 'En-têtes affichés')) +
        rg('Imprimer', rb('imprimer', '🖨️', 'Imprimer / PDF', 'Imprimer la feuille (Ctrl+P)'));
    case 'formules':
      return rg('Fonctions', rb('fx', 'ƒx', 'Insérer une fonction', 'Parcourir toutes les fonctions') + rm('Σ', 'Somme auto', [['somme:SOMME', 'Somme'], ['somme:MOYENNE', 'Moyenne'], ['somme:NB', 'Nombre'], ['somme:MAX', 'Max'], ['somme:MIN', 'Min']])) +
        rg('Bibliothèque', CATEGORIES.map((cat) => rm('', cat, FONC_LISTE.filter((f) => f.cat === cat).map((f) => [`fn:${f.fr}`, `<b>${f.fr}</b> <small>${esc(f.desc)}</small>`]))).join('')) +
        rg('Noms définis', rb('noms', '🏷', 'Gestionnaire de noms') + rb('defNom', '＋', 'Définir un nom')) +
        rg('Audit', rb('formules', '𝑓', 'Afficher les formules', 'Afficher les formules à la place des résultats') + rb('recalc', '⟳', 'Calculer', 'Recalculer (F9)')) +
        rg('Analyse', rb('cible', '🎯', 'Valeur cible', 'Trouver la valeur d’une cellule qui donne un résultat voulu'));
    case 'donnees':
      return rg('Données externes', rb('importXlsx', '📗', 'Excel', 'Importer un fichier .xlsx') + rb('importCsv', '📄', 'CSV / texte', 'Importer un fichier CSV')) +
        rg('Trier et filtrer', rb('tri:asc', 'A→Z', '', 'Tri croissant') + rb('tri:desc', 'Z→A', '', 'Tri décroissant') + rb('triPerso', '⇅', 'Tri personnalisé') + rb('filtre', '⏷', 'Filtrer', 'Activer / désactiver le filtre (Ctrl+Maj+L)') + rb('filtreEff', '🧹', 'Effacer les filtres')) +
        rg('Outils de données', rb('colonnes', '⫴', 'Texte en colonnes') + rb('doublons', '⧉', 'Supprimer les doublons') + rb('validation', '🛡', 'Validation') + rb('tcd', '🧮', 'Tableau croisé')) +
        rg('Prévisions', rb('cible', '🎯', 'Valeur cible') + rb('graph:scatter', '⁙', 'Nuage de points')) +
        rg('Exporter', rb('exportXlsx', '📗', 'Excel (.xlsx)') + rb('exportCsv', '📄', 'CSV'));
    case 'affichage':
      return rg('Volets', rm('❄', 'Figer les volets', [['figer:sel', 'Figer à la sélection'], ['figer:ligne', 'Figer la première ligne'], ['figer:colonne', 'Figer la première colonne'], ['figer:aucun', 'Libérer les volets']])) +
        rg('Zoom', rb('zoom-', '−', '', 'Zoom arrière') + rb('zoom100', '100 %', '', 'Zoom 100 %') + rb('zoom+', '＋', '', 'Zoom avant')) +
        rg('Afficher', rb('quad', '▦', 'Quadrillage') + rb('ent', '🔤', 'En-têtes') + rb('formules', '𝑓', 'Formules')) +
        rg('Lignes / colonnes', rb('masquerL', '≣', 'Masquer les lignes') + rb('masquerC', '⫴', 'Masquer les colonnes') + rb('afficherTout', '👁', 'Tout afficher'));
    default:
      return rg('Annuler', rb('undo', '↶', '', 'Annuler (Ctrl+Z)') + rb('redo', '↷', '', 'Rétablir (Ctrl+Y)')) +
        rg('Presse-papiers', rm('📋', 'Coller', [['coller:tout', 'Coller'], ['coller:valeurs', 'Coller les valeurs'], ['coller:formules', 'Coller les formules'], ['coller:formats', 'Coller la mise en forme'], ['coller:transposer', 'Coller en transposant']]) + rb('couper', '✂️', '', 'Couper (Ctrl+X)') + rb('copier', '⧉', '', 'Copier (Ctrl+C)') + rb('pinceau', '🖌', 'Reproduire', 'Reproduire la mise en forme')) +
        rg('Police', `<div class="rrow">${selectHtml('shFf', [['', 'Police'], ...Object.keys(POLICES).map((k) => [k, k])], 'Police')}${selectHtml('shFs', [['', '11'], ...TAILLES.map((t) => [String(t), String(t)])], 'Taille')}</div><div class="rrow">${rb('b', '<b>G</b>', '', 'Gras (Ctrl+B)', 'sm')}${rb('i', '<i>I</i>', '', 'Italique (Ctrl+I)', 'sm')}${rb('u', '<u>S</u>', '', 'Souligné (Ctrl+U)', 'sm')}${rb('st', '<s>ab</s>', '', 'Barré (Ctrl+5)', 'sm')}
          ${rm('▦', '', [['bd:tous', 'Toutes les bordures'], ['bd:ext', 'Bordure extérieure'], ['bd:haut', 'Bordure haute'], ['bd:bas', 'Bordure basse'], ['bd:gauche', 'Bordure gauche'], ['bd:droite', 'Bordure droite'], ['-'], ['bd:aucune', 'Aucune bordure']], 'Bordures')}
          <label class="rb sm clr" title="Couleur du texte">A<input type="color" id="shColor" value="#f3f3f4"></label><label class="rb sm clr" title="Couleur de remplissage">▧<input type="color" id="shBg" value="#2a2a31"></label>${rb('nobg', '∅', '', 'Effacer les couleurs', 'sm')}</div>`) +
        rg('Alignement', `<div class="rrow">${rb('va:top', '⤒', '', 'Aligner en haut', 'sm')}${rb('va:middle', '↕', '', 'Centrer verticalement', 'sm')}${rb('va:bottom', '⤓', '', 'Aligner en bas', 'sm')}${rb('wrap', '↵', 'Renvoi', 'Renvoyer à la ligne automatiquement', 'sm')}</div>
          <div class="rrow">${rb('al:left', '⇤', '', 'Aligner à gauche', 'sm')}${rb('al:center', '↔', '', 'Centrer', 'sm')}${rb('al:right', '⇥', '', 'Aligner à droite', 'sm')}${rb('ind+', '⇥', '', 'Augmenter le retrait', 'sm')}${rb('ind-', '⇤', '', 'Diminuer le retrait', 'sm')}${rm('⊞', 'Fusionner', [['fusion:fusionner', 'Fusionner les cellules'], ['fusion:centrer', 'Fusionner et centrer'], ['fusion:defusionner', 'Annuler la fusion']])}</div>`) +
        rg('Nombre', `<div class="rrow">${selectHtml('shFmt', FORMATS_NOMBRE, 'Format de nombre')}</div><div class="rrow">${rb('eur', '€', '', 'Format monétaire', 'sm')}${rb('pct', '%', '', 'Pourcentage', 'sm')}${rb('mil', '000', '', 'Séparateur de milliers', 'sm')}${rb('dec-', '.0←', '', 'Moins de décimales', 'sm')}${rb('dec+', '.00→', '', 'Plus de décimales', 'sm')}${rb('formatCell', '⚙', '', 'Format de cellule (Ctrl+1)', 'sm')}</div>`) +
        rg('Styles', rm('🎨', 'Mise en forme conditionnelle', [['cf:barres', 'Barres de données'], ['cf:echelle', 'Nuances de couleurs'], ['cf:icones', 'Jeux d’icônes'], ['-'], ['cf:gt', 'Supérieur à…'], ['cf:lt', 'Inférieur à…'], ['cf:entre', 'Entre…'], ['cf:eq', 'Égal à…'], ['cf:contient', 'Le texte contient…'], ['cf:doublons', 'Valeurs en double'], ['cf:top', 'Les 10 premières'], ['cf:moy+', 'Supérieur à la moyenne'], ['cf:formule', 'Formule personnalisée…'], ['-'], ['cf:gerer', 'Gérer les règles…'], ['cf:effacer', 'Effacer les règles de la feuille', 'danger']]) + rm('▤', 'Tableau', [['tableau:orange', 'Orange'], ['tableau:bleu', 'Bleu'], ['tableau:vert', 'Vert'], ['tableau:violet', 'Violet'], ['tableau:gris', 'Gris']], 'Mettre sous forme de tableau') + rm('Aa', 'Styles', [['style:titre', 'Titre'], ['style:titre2', 'Titre 2'], ['style:bon', 'Satisfaisant'], ['style:mauvais', 'Insatisfaisant'], ['style:neutre', 'Neutre'], ['style:note', 'Note'], ['style:total', 'Total']], 'Styles de cellule')) +
        rg('Cellules', rm('＋', 'Insérer', [['insL', 'Lignes au-dessus'], ['insC', 'Colonnes à gauche']]) + rm('−', 'Supprimer', [['delL', 'Supprimer les lignes'], ['delC', 'Supprimer les colonnes']]) + rm('⚙', 'Format', [['largeurAuto', 'Ajuster la largeur'], ['hauteurAuto', 'Hauteur standard'], ['largeurDef', 'Largeur standard'], ['-'], ['masquerL', 'Masquer les lignes'], ['masquerC', 'Masquer les colonnes'], ['afficherTout', 'Afficher tout']])) +
        rg('Édition', rm('Σ', 'Somme auto', [['somme:SOMME', 'Somme'], ['somme:MOYENNE', 'Moyenne'], ['somme:NB', 'Nombre'], ['somme:MAX', 'Max'], ['somme:MIN', 'Min']]) + rm('⬇', 'Remplir', [['remplir:d', 'Vers le bas (Ctrl+D)'], ['remplir:r', 'Vers la droite (Ctrl+R)']]) + rm('🧹', 'Effacer', [['effacer:tout', 'Tout effacer'], ['effacer:formats', 'Effacer les formats'], ['effacer:contenu', 'Effacer le contenu'], ['effacer:notes', 'Effacer notes et liens']]) + rm('⇅', 'Trier et filtrer', [['tri:asc', 'Du plus petit au plus grand'], ['tri:desc', 'Du plus grand au plus petit'], ['triPerso', 'Tri personnalisé…'], ['filtre', 'Filtrer'], ['filtreEff', 'Effacer les filtres']]) + rb('rech', '🔍', 'Rechercher', 'Rechercher et remplacer (Ctrl+F)'));
  }
}

function renderRuban() {
  const tabs = $('#shRTabs'), r = $('#shRibbon');
  if (!tabs || !r) return;
  sh.rtab = sh.rtab || 'accueil';
  if (sh.rcol === undefined) { try { sh.rcol = localStorage.getItem('postitbac.ruban') === '1'; } catch (e) { sh.rcol = false; } }
  tabs.innerHTML = ONGLETS_RUBAN.map(([id, t]) => `<button class="rtab${sh.rtab === id ? ' on' : ''}" data-rt="${id}">${t}</button>`).join('');
  tabs.innerHTML += `<button class="rtab rcol" data-sh="ruban" title="Réduire / afficher le ruban">${sh.rcol ? '⌄' : '⌃'}</button>`;
  r.hidden = !!sh.rcol;
  r.innerHTML = contenuRuban(sh.rtab);
  majRuban();
}

function formatVersSelect(s) { return s.fmt || ''; }
function majRuban(cell) {
  const root = $('#shRibbon');
  if (!root) return;
  const F = feuille();
  if (!F) return;
  const A = actif();
  if (cell === undefined) cell = cellule(F, A.r, A.c);
  const s = cell ? cell.s : {};
  const on = (sel, v) => root.querySelectorAll(`[data-sh="${sel}"]`).forEach((b) => b.classList.toggle('on', !!v));
  on('b', s.b); on('i', s.i); on('u', s.u); on('st', s.st); on('wrap', s.wrap);
  ['left', 'center', 'right'].forEach((a) => on('al:' + a, s.al === a));
  ['top', 'middle', 'bottom'].forEach((a) => on('va:' + a, s.va === a));
  on('pinceau', !!sh.pinceau); on('formules', F.formules); on('quad', F.quad); on('ent', F.ent); on('quadImpr', F.impr && F.impr.quad);
  const set = (id, v) => { const e = document.getElementById(id); if (e && document.activeElement !== e) e.value = v; };
  set('shFmt', formatVersSelect(s));
  const ff = Object.entries(POLICES).find(([, v]) => v === s.ff); set('shFf', ff ? ff[0] : ''); set('shFs', s.fs ? String(s.fs) : '');
  const z = document.getElementById('shZoom'); if (z) { z.value = F.zoom; document.getElementById('shZoomV').textContent = F.zoom + ' %'; }
  const g = document.getElementById('shGrid'); if (g) g.classList.toggle('painter', !!sh.pinceau);
}

function definirZoom(n) {
  const F = feuille();
  F.zoom = Math.max(50, Math.min(200, Math.round(n / 10) * 10));
  sauver();
  renderGrille();
}
function figer(mode) {
  modifier((F) => {
    if (mode === 'sel') F.gel = { r: actif().r, c: actif().c };
    else if (mode === 'ligne') F.gel = { r: 1, c: F.gel.c };
    else if (mode === 'colonne') F.gel = { r: F.gel.r, c: 1 };
    else F.gel = { r: 0, c: 0 };
  });
}

function appliquerPinceau() {
  const st = sh.pinceau;
  sh.pinceau = null;
  if (!st) return;
  const R = rect();
  modifier((F) => {
    for (let r = R.r1; r <= R.r2; r++) for (let c = R.c1; c <= R.c2; c++) { assurer(F, r, c).s = JSON.parse(JSON.stringify(st)); nettoyer(F, adr(r, c)); }
  });
  majRuban();
}

function sommeAuto(fn = 'SOMME') {
  const F = feuille(), R = rect();
  const estNombre = (r, c) => typeof valCell(sh.ctx, F, r, c) === 'number';
  let cible, plage;
  if (R.r1 !== R.r2 && R.c1 === R.c2) { cible = { r: R.r2 + 1, c: R.c1 }; plage = textePlage(R); }
  else if (R.r1 === R.r2 && R.c1 !== R.c2) { cible = { r: R.r1, c: R.c2 + 1 }; plage = textePlage(R); }
  else if (R.r1 !== R.r2 && R.c1 !== R.c2) {
    modifier((G) => { for (let c = R.c1; c <= R.c2; c++) poser(G, R.r2 + 1, c, `=${fn}(${adr(R.r1, c)}:${adr(R.r2, c)})`); });
    return;
  } else {
    cible = { r: R.r1, c: R.c1 };
    let r = R.r1 - 1;
    while (r >= 0 && estNombre(r, R.c1)) r--;
    if (r < R.r1 - 1) plage = `${adr(r + 1, R.c1)}:${adr(R.r1 - 1, R.c1)}`;
    else { let c = R.c1 - 1; while (c >= 0 && estNombre(R.r1, c)) c--; if (c < R.c1 - 1) plage = `${adr(R.r1, c + 1)}:${adr(R.r1, R.c1 - 1)}`; }
  }
  if (!plage || cible.r >= F.nbL || cible.c >= F.nbC) { toast('Sélectionne des nombres (colonne ou ligne) ou place-toi sous une colonne de nombres.'); return; }
  modifier((G) => poser(G, cible.r, cible.c, `=${fn}(${plage})`));
  selectionner(cible.r, cible.c, cible.r, cible.c);
}

function insererFonction(nom) {
  const t = nom + '(';
  if (sh.ed) {
    const ta = sh.ed.ta;
    if (!ta.value.startsWith('=')) ta.value = '=' + ta.value;
    ta.setRangeText(t, ta.selectionStart, ta.selectionEnd, 'end');
    ta.focus();
    ta.dispatchEvent(new Event('input'));
  } else editer(actif().r, actif().c, '=' + t);
}

const STYLES_TABLEAU = { orange: '#f0b27a', bleu: '#74c0fc', vert: '#8ce99a', violet: '#d0bfff', gris: '#9aa0aa' };
function styleTableau(nom) {
  const R = rect(), couleur = STYLES_TABLEAU[nom] || '#f0b27a';
  if (R.r1 === R.r2) { toast('Sélectionne le tableau (avec sa ligne d’en-tête).'); return; }
  modifier((F) => {
    for (let r = R.r1; r <= R.r2; r++) for (let c = R.c1; c <= R.c2; c++) {
      const cell = assurer(F, r, c);
      if (r === R.r1) Object.assign(cell.s, { bg: couleur, c: '#111', b: true });
      else { cell.s.bg = (r - R.r1) % 2 ? '#1b1b21' : '#131318'; delete cell.s.c; delete cell.s.b; }
      cell.s.bd = { b: '#2a2a31', t: r === R.r1 ? couleur : undefined };
      if (!cell.s.bd.t) delete cell.s.bd.t;
    }
    for (let c = R.c1; c <= R.c2; c++) assurer(F, R.r2, c).s.bd.b = couleur;
  });
}
const STYLES_CELLULE = {
  titre: { b: true, fs: 18, c: '#f0b27a' }, titre2: { b: true, fs: 14, c: '#f3f3f4', bd: { b: '#f0b27a' } },
  bon: { bg: '#1f4d3a', c: '#8ce99a' }, mauvais: { bg: '#5e2a35', c: '#ffa8a8' }, neutre: { bg: '#5a4a1f', c: '#ffe066' },
  note: { bg: '#3a3a24', i: true, c: '#ddd' }, total: { b: true, bd: { t: '#9aa0aa', b: '#9aa0aa' } },
};

/* ================= Actions ================= */
function actionSh(act, arg) {
  const T = tableur(), F = feuille();
  switch (act) {
    case 'undo': finirEdition(true); annuler(); break;
    case 'redo': refaire(); break;
    case 'couper': copier(null, true); break;
    case 'copier': copier(null, false); break;
    case 'coller': collerSpecial(arg); break;
    case 'pinceau': { const A = actif(), c = cellule(F, A.r, A.c); sh.pinceau = JSON.parse(JSON.stringify(c ? c.s : {})); majRuban(); toast('Sélectionne les cellules à mettre en forme (Échap pour annuler)'); break; }
    case 'b': case 'i': case 'u': case 'st': appliquerStyle(basculer(act)); break;
    case 'wrap': appliquerStyle(basculer('wrap')); break;
    case 'al': appliquerStyle({ al: arg }); break;
    case 'va': appliquerStyle({ va: arg }); break;
    case 'ind+': appliquerStyle((s) => ({ ind: Math.min(10, (s.ind || 0) + 1) })); break;
    case 'ind-': appliquerStyle((s) => ({ ind: Math.max(0, (s.ind || 0) - 1) })); break;
    case 'nobg': appliquerStyle({ bg: '', c: '' }); break;
    case 'bd': appliquerBordures(arg); break;
    case 'fusion': if (arg === 'defusionner') defusionner(); else { fusionner(); if (arg === 'centrer') appliquerStyle({ al: 'center', va: 'middle' }); } break;
    case 'eur': appliquerStyle({ fmt: 'eur', dec: undefined, code: undefined }); break;
    case 'pct': appliquerStyle({ fmt: 'pct', dec: undefined, code: undefined }); break;
    case 'mil': appliquerStyle({ fmt: 'n', dec: 0, code: undefined }); break;
    case 'dec+': case 'dec-': appliquerStyle((s) => { const d = s.dec ?? DEC_DEFAUT[s.fmt] ?? 0; return { fmt: s.fmt || 'n', dec: Math.max(0, Math.min(10, d + (act === 'dec+' ? 1 : -1))) }; }); break;
    case 'formatCell': ouvrirFormatCellule(); break;
    case 'cf': ouvrirCF(arg); break;
    case 'tableau': styleTableau(arg); break;
    case 'tableauSel': styleTableau('bleu'); break;
    case 'style': appliquerStyle(() => ({ ...STYLES_CELLULE[arg] })); break;
    case 'insL': insererAxe('r'); break;
    case 'insC': insererAxe('c'); break;
    case 'delL': supprimerAxe('r'); break;
    case 'delC': supprimerAxe('c'); break;
    case 'largeurAuto': { const R = rect(); for (let c = R.c1; c <= R.c2; c++) ajusterLargeurAuto(c); break; }
    case 'hauteurAuto': { const R = rect(); modifier((G) => { for (let r = R.r1; r <= R.r2; r++) delete G.hauteurs[r]; }); break; }
    case 'largeurDef': { const R = rect(); modifier((G) => { for (let c = R.c1; c <= R.c2; c++) delete G.largeurs[c]; }); break; }
    case 'masquerL': masquerAxe('r'); break;
    case 'masquerC': masquerAxe('c'); break;
    case 'afficherTout': afficherTout(); break;
    case 'somme': sommeAuto(arg); break;
    case 'remplir': remplirDirection(arg); break;
    case 'effacer': effacer(arg); break;
    case 'tri': trier(arg); break;
    case 'triPerso': ouvrirTriPerso(); break;
    case 'filtre': basculerFiltre(); break;
    case 'filtreEff': modifier((G) => { if (G.filtre) G.filtre.crit = {}; }); break;
    case 'rech': ouvrirRecherche(false); break;
    case 'tcd': ouvrirTCD(); break;
    case 'graph': creerGraph(arg); break;
    case 'graphSuppr': modifier((G) => { G.graphs = G.graphs.filter((g) => g.id !== arg); }); break;
    case 'graphOpt': ouvrirOptionsGraph(arg); break;
    case 'graphPng': graphVersPng(arg); break;
    case 'mini': inserer_mini(arg); break;
    case 'lien': modifierLien(); break;
    case 'note': modifierNote(); break;
    case 'noteSuppr': { const A = actif(); modifier((G) => { const c = cellule(G, A.r, A.c); if (c) { delete c.n; nettoyer(G, adr(A.r, A.c)); } }); break; }
    case 'cases': appliquerCases(); break;
    case 'liste': ouvrirValidation('liste'); break;
    case 'validation': ouvrirValidation(); break;
    case 'orient': modifier((G) => { G.impr.orient = arg; }); toast('Orientation : ' + arg); break;
    case 'echelle+': case 'echelle-': modifier((G) => { G.impr.echelle = Math.max(30, Math.min(200, (G.impr.echelle || 100) + (act === 'echelle+' ? 10 : -10))); }); toast('Échelle d’impression : ' + feuille().impr.echelle + ' %'); break;
    case 'miseEnPage': ouvrirMiseEnPage(); break;
    case 'zone': modifier((G) => { G.impr.zone = arg === 'def' ? textePlage(rect()) : null; }); toast(arg === 'def' ? 'Zone d’impression définie' : 'Zone d’impression effacée'); break;
    case 'quadImpr': modifier((G) => { G.impr.quad = !G.impr.quad; }); break;
    case 'quad': modifier((G) => { G.quad = !G.quad; }); break;
    case 'ent': modifier((G) => { G.ent = !G.ent; }); break;
    case 'formules': modifier((G) => { G.formules = !G.formules; }); break;
    case 'imprimer': imprimerFeuille(); break;
    case 'fx': ouvrirInsererFonction(); break;
    case 'fn': insererFonction(arg); break;
    case 'noms': ouvrirNoms(); break;
    case 'defNom': { const n = (prompt('Nom à donner à la sélection (' + textePlage(rect()) + ') ?') || '').trim(); if (n) allerA(n); break; }
    case 'recalc': renderGrille(); break;
    case 'cible': ouvrirCible(); break;
    case 'figer': figer(arg); break;
    case 'zoom+': definirZoom(F.zoom + 10); break;
    case 'zoom-': definirZoom(F.zoom - 10); break;
    case 'zoom100': definirZoom(100); break;
    case 'colonnes': textEnColonnes(); break;
    case 'doublons': supprimerDoublons(); break;
    case 'importCsv': $('#shCsv').click(); break;
    case 'importXlsx': $('#shXlsx').click(); break;
    case 'exportCsv': exporterCsv(); break;
    case 'exportXlsx': exporterXlsx(); break;
    case 'supprTab': if (confirm(`Supprimer le tableur « ${T.nom} » ?`)) { db.tableurs = db.tableurs.filter((x) => x !== T); journaliser('Tableur supprimé : ' + T.nom); sauver(); aller('tableurs'); } return;
    case 'onglet': finirEdition(true); ui.feuille = +arg; sh.sel = { r1: 0, c1: 0, r2: 0, c2: 0 }; renderGrille(); break;
    case 'ajoutFeuille': { finirEdition(true); T.feuilles.push(nouvelleFeuille('Feuille ' + (T.feuilles.length + 1))); ui.feuille = T.feuilles.length - 1; sh.sel = { r1: 0, c1: 0, r2: 0, c2: 0 }; sauver(); renderGrille(); break; }
    case 'renFeuille': { const n = (prompt('Nom de la feuille ?', F.nom) || '').trim(); if (n) { F.nom = n; sauver(); renderOnglets(); } break; }
    case 'dupFeuille': { const cp = JSON.parse(JSON.stringify(F)); cp.id = uid(); cp.nom = F.nom + ' (copie)'; cp.graphs.forEach((g) => { g.id = uid(); }); T.feuilles.push(cp); ui.feuille = T.feuilles.length - 1; sauver(); renderGrille(); break; }
    case 'gaucheFeuille': case 'droiteFeuille': { const i = T.feuilles.indexOf(F), j = i + (act === 'gaucheFeuille' ? -1 : 1); if (j >= 0 && j < T.feuilles.length) { [T.feuilles[i], T.feuilles[j]] = [T.feuilles[j], T.feuilles[i]]; ui.feuille = j; sauver(); renderOnglets(); } break; }
    case 'couleurFeuille': { const c = prompt('Couleur de l’onglet (ex : #f0b27a, ou vide pour retirer) ?', F.couleur || '#f0b27a'); if (c !== null) { F.couleur = c.trim() || undefined; sauver(); renderOnglets(); } break; }
    case 'supprFeuille': if (confirm(`Supprimer la feuille « ${F.nom} » ?`)) { T.feuilles = T.feuilles.filter((x) => x !== F); ui.feuille = 0; sh.sel = { r1: 0, c1: 0, r2: 0, c2: 0 }; sauver(); renderGrille(); } break;
    case 'plusL': modifier((G) => { G.nbL = Math.min(MAXL, G.nbL + 30); }); break;
    case 'plusC': modifier((G) => { G.nbC = Math.min(MAXC, G.nbC + 5); }); break;
    case 'ruban': sh.rcol = !sh.rcol; try { localStorage.setItem('postitbac.ruban', sh.rcol ? '1' : '0'); } catch (e) { /* ignoré */ } renderRuban(); break;
    case 'menu': break;
    default:
  }
}

function inserer_mini(type) {
  const F = feuille(), R = rect();
  if (R.r1 === R.r2 && R.c1 === R.c2) { toast('Sélectionne les cellules contenant les valeurs.'); return; }
  const largeLigne = R.c2 - R.c1 >= R.r2 - R.r1;
  const cible = largeLigne ? { r: R.r1, c: R.c2 + 1 } : { r: R.r2 + 1, c: R.c1 };
  if (cible.r >= F.nbL || cible.c >= F.nbC) { toast('Plus de place à côté de la sélection.'); return; }
  modifier((G) => poser(G, cible.r, cible.c, `=MINIGRAPHIQUE(${textePlage(R)};"${type}")`));
  selectionner(cible.r, cible.c, cible.r, cible.c);
}

function appliquerCases() {
  const R = rect();
  modifier((F) => {
    F.valids = F.valids.filter((v) => v.range !== textePlage(R));
    F.valids.push({ id: uid(), range: textePlage(R), type: 'case', op: 'entre', a: '', b: '', source: '', message: '', alerte: 'stop' });
    for (let r = R.r1; r <= R.r2; r++) for (let c = R.c1; c <= R.c2; c++) { const cell = cellule(F, r, c); if (!cell || cell.v === '') poser(F, r, c, 'FAUX'); const x = assurer(F, r, c); x.s.al = 'center'; }
  });
}

/* ---- Événements du ruban et des onglets ---- */
document.addEventListener('click', (e) => {
  const tb = e.target.closest('[data-tb]');
  if (tb && (ui.view === 'tableurs' || ui.view === 'sheet')) {
    e.preventDefault();
    const [act, arg] = tb.dataset.tb.split(':');
    if (act === 'new') creerTableur(arg);
    else if (act === 'open') { sh.sel = { r1: 0, c1: 0, r2: 0, c2: 0 }; sh.histo = { id: null, undo: [], redo: [] }; aller('sheet', { tabId: arg, feuille: 0 }); }
    else if (act === 'retour') aller('tableurs');
    return;
  }
  if (ui.view !== 'sheet') return;
  const rt = e.target.closest('[data-rt]');
  if (rt) { sh.rtab = rt.dataset.rt; if (sh.rcol) { sh.rcol = false; } renderRuban(); return; }
  const ai = e.target.closest('[data-ai]');
  if (ai) { accepterAuto(+ai.dataset.ai); return; }
  const b = e.target.closest('[data-sh]');
  if (!b) return;
  const i = b.dataset.sh.indexOf(':');
  const act = i < 0 ? b.dataset.sh : b.dataset.sh.slice(0, i), arg = i < 0 ? undefined : b.dataset.sh.slice(i + 1);
  finirEditionSiBesoin(act);
  actionSh(act, arg);
  const mantenirFocus = ['ruban', 'onglet', 'supprTab', 'imprimer', 'exportCsv', 'exportXlsx', 'importCsv', 'importXlsx', 'fn', 'fx', 'renFeuille', 'noms', 'cf', 'validation', 'liste', 'tcd', 'rech', 'cible', 'triPerso', 'formatCell', 'miseEnPage', 'graphOpt', 'lien', 'note', 'couleurFeuille', 'defNom'];
  if (!mantenirFocus.includes(act) && !sh.ed) { const g = $('#shGrid'); if (g) g.focus({ preventScroll: true }); }
});
function finirEditionSiBesoin(act) { if (sh.ed && !['fn'].includes(act)) finirEdition(true); }

document.addEventListener('change', (e) => {
  if (ui.view !== 'sheet') return;
  const id = e.target.id;
  if (id === 'shNom') { const T = tableur(); T.nom = e.target.value.trim() || T.nom; sauver(); }
  else if (id === 'shColor') appliquerStyle({ c: e.target.value });
  else if (id === 'shBg') appliquerStyle({ bg: e.target.value });
  else if (id === 'shFf') appliquerStyle({ ff: POLICES[e.target.value] || undefined });
  else if (id === 'shFs') appliquerStyle({ fs: +e.target.value || undefined });
  else if (id === 'shFmt') { if (e.target.value === 'code') ouvrirFormatCellule(); else appliquerStyle({ fmt: e.target.value, dec: undefined, code: undefined }); }
  else if (id === 'shCsv') { if (e.target.files[0]) importerCsv(e.target.files[0]); e.target.value = ''; }
  else if (id === 'shXlsx') { if (e.target.files[0]) importerXlsx(e.target.files[0]); e.target.value = ''; }
  const g = $('#shGrid');
  if (g && ['shColor', 'shBg', 'shFf', 'shFs', 'shFmt'].includes(id)) g.focus({ preventScroll: true });
});
document.addEventListener('input', (e) => { if (ui.view === 'sheet' && e.target.id === 'shZoom') definirZoom(+e.target.value); });

/* ================= Liste déroulante & filtre ================= */
function fermerPopups() { document.querySelectorAll('.shpop').forEach((x) => x.remove()); }
document.addEventListener('mousedown', (e) => { if (!e.target.closest('.shpop, .flb, .dvb')) fermerPopups(); });

function ouvrirListeDeroulante(td) {
  fermerPopups();
  const F = feuille(), r = +td.dataset.r, c = +td.dataset.c, v = validationDe(F, r, c);
  if (!v || v.type !== 'liste') return;
  const opts = optionsListe(F, v);
  const pop = document.createElement('div');
  pop.className = 'shpop shlist';
  pop.innerHTML = opts.length ? opts.map((o) => `<button data-o="${esc(o)}">${esc(o)}</button>`).join('') : '<div class="hint" style="padding:8px">Liste vide</div>';
  document.body.appendChild(pop);
  placerPopup(pop, td);
  pop.addEventListener('click', (e) => {
    const b = e.target.closest('[data-o]');
    if (!b) return;
    fermerPopups();
    modifier((G) => poser(G, r, c, b.dataset.o));
    selectionner(r, c, r, c);
    $('#shGrid').focus({ preventScroll: true });
  });
}

function basculerFiltre() {
  const F = feuille();
  if (F.filtre) { modifier((G) => { G.filtre = null; }); return; }
  let R = rect();
  const A = actif();
  if (R.r1 === R.r2 && R.c1 === R.c2) {
    let c1 = A.c, c2 = A.c;
    while (c1 > 0 && nonVide(F, A.r, c1 - 1)) c1--;
    while (c2 < F.nbC - 1 && nonVide(F, A.r, c2 + 1)) c2++;
    R = { r1: A.r, r2: null, c1, c2 };
  }
  modifier((G) => { G.filtre = { r: R.r1, r2: R.r2 === R.r1 ? null : R.r2, c1: R.c1, c2: R.c2, crit: {} }; });
}

function ouvrirFiltre(col, td) {
  fermerPopups();
  const F = feuille(), P = plageFiltre(F);
  if (!P) return;
  const valeurs = [];
  const vus = new Set();
  for (let r = P.r1 + 1; r <= P.r2; r++) { const t = texteAffiche(F, r, col) || '(vide)'; if (!vus.has(t)) { vus.add(t); valeurs.push(t); } }
  valeurs.sort((a, b) => { const x = constante(a), y = constante(b); return typeof x === 'number' && typeof y === 'number' ? x - y : String(a).localeCompare(String(b), 'fr'); });
  const permis = F.filtre.crit[col];
  const pop = document.createElement('div');
  pop.className = 'shpop shfiltre';
  pop.innerHTML = `<div class="fb"><button data-f="asc">A→Z Trier</button><button data-f="desc">Z→A Trier</button></div>
    <input class="fs" placeholder="Rechercher…" autocomplete="off">
    <label class="fa"><input type="checkbox" data-all checked> (Tout sélectionner)</label>
    <div class="fl">${valeurs.map((v) => `<label><input type="checkbox" data-v="${esc(v)}" ${!permis || permis.includes(v) ? 'checked' : ''}> ${esc(v)}</label>`).join('')}</div>
    <div class="fb"><button class="primary" data-f="ok">OK</button><button data-f="clear">Effacer le filtre</button></div>`;
  document.body.appendChild(pop);
  placerPopup(pop, td);
  const cases = () => [...pop.querySelectorAll('[data-v]')];
  const maj = () => { pop.querySelector('[data-all]').checked = cases().every((x) => x.checked); };
  maj();
  pop.addEventListener('input', (e) => {
    if (e.target.classList.contains('fs')) { const q = e.target.value.toLowerCase(); cases().forEach((x) => { x.parentElement.style.display = x.dataset.v.toLowerCase().includes(q) ? '' : 'none'; }); }
  });
  pop.addEventListener('change', (e) => {
    if (e.target.matches('[data-all]')) cases().forEach((x) => { if (x.parentElement.style.display !== 'none') x.checked = e.target.checked; });
    else maj();
  });
  pop.addEventListener('click', (e) => {
    const b = e.target.closest('[data-f]');
    if (!b) return;
    const a = b.dataset.f;
    fermerPopups();
    if (a === 'asc' || a === 'desc') { trierPlage({ r1: P.r1, r2: P.r2, c1: P.c1, c2: P.c2 }, [{ col, desc: a === 'desc' }], true); return; }
    modifier((G) => {
      if (a === 'clear') delete G.filtre.crit[col];
      else { const sel = cases().filter((x) => x.checked).map((x) => x.dataset.v); if (sel.length === cases().length) delete G.filtre.crit[col]; else G.filtre.crit[col] = sel; }
    });
  });
}

/* ================= Menu contextuel ================= */
function menuContextuel(e) {
  fermerPopups();
  const F = feuille();
  const R = rect();
  const items = [
    ['couper', '✂️ Couper'], ['copier', '⧉ Copier'], ['coller:tout', '📋 Coller'], ['coller:valeurs', '📋 Coller les valeurs'], ['coller:transposer', '📋 Coller en transposant'], ['-'],
    ['insL', '＋ Insérer des lignes'], ['insC', '＋ Insérer des colonnes'], ['delL', '− Supprimer les lignes'], ['delC', '− Supprimer les colonnes'], ['-'],
    ['effacer:contenu', '🧹 Effacer le contenu'], ['effacer:formats', '🧹 Effacer les formats'], ['-'],
    ['formatCell', '⚙ Format de cellule…'], ['lien', '🔗 Lien…'], ['note', '💬 Note…'], ['validation', '🛡 Validation des données…'], ['-'],
    ['tri:asc', 'A→Z Trier croissant'], ['tri:desc', 'Z→A Trier décroissant'], ['filtre', F.filtre ? '⏷ Retirer le filtre' : '⏷ Filtrer'], ['-'],
    ['masquerL', '≣ Masquer les lignes'], ['masquerC', '⫴ Masquer les colonnes'], ['afficherTout', '👁 Tout afficher'],
  ];
  if (R.r1 !== R.r2 || R.c1 !== R.c2) items.splice(14, 0, ['fusion:fusionner', '⊞ Fusionner les cellules']);
  const pop = document.createElement('div');
  pop.className = 'shpop shctx';
  pop.innerHTML = items.map(([a, l]) => (a === '-' ? '<hr>' : `<button data-c="${a}">${l}</button>`)).join('');
  document.body.appendChild(pop);
  pop.style.left = Math.min(e.clientX, window.innerWidth - 240) + 'px';
  pop.style.top = Math.min(e.clientY, window.innerHeight - pop.offsetHeight - 8) + 'px';
  pop.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-c]');
    if (!b) return;
    const i = b.dataset.c.indexOf(':');
    fermerPopups();
    const g = $('#shGrid');
    if (g) g.focus({ preventScroll: true });
    actionSh(i < 0 ? b.dataset.c : b.dataset.c.slice(0, i), i < 0 ? undefined : b.dataset.c.slice(i + 1));
  });
}
