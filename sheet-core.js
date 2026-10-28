'use strict';
/* ============================================================
   Tableur : état, affichage de la grille, mise en forme
   ============================================================ */

const PALETTE = ['#f0b27a', '#74c0fc', '#8ce99a', '#ffa8a8', '#d0bfff', '#ffe066', '#63e6be', '#faa2c1'];
const LARG_DEF = 96, LARG_ENT = 46, HAUT_DEF = 26;
const COULEURS_REF = ['#f0b27a', '#74c0fc', '#8ce99a', '#ffa8a8', '#d0bfff', '#ffe066'];
const sh = {
  sel: { r1: 0, c1: 0, r2: 0, c2: 0 }, ed: null, tds: [], drag: null, clip: null, histo: { id: null, undo: [], redo: [] },
  ctx: null, fp: [], fus: new Map(), couv: new Set(), masqL: new Set(), masqC: new Set(), pinceau: null, pt: null, rf: [], cf: [], dvCache: null,
};

const tableur = () => db.tableurs.find((t) => t.id === ui.tabId);
const feuille = () => { const t = tableur(); return t ? t.feuilles[Math.min(ui.feuille || 0, t.feuilles.length - 1)] : null; };
const nouvelleFeuille = (nom) => completerFeuille({ id: uid(), nom, cells: {}, nbL: 30, nbC: 12 });
function completerFeuille(F) {
  F.largeurs = F.largeurs || {}; F.hauteurs = F.hauteurs || {}; F.graphs = F.graphs || []; F.merges = F.merges || [];
  F.gel = F.gel || { r: 0, c: 0 }; F.cache = F.cache || { l: [], c: [] }; F.cf = F.cf || []; F.valids = F.valids || [];
  if (F.filtre === undefined) F.filtre = null;
  F.zoom = F.zoom || 100; if (F.quad === undefined) F.quad = true; if (F.ent === undefined) F.ent = true; F.formules = !!F.formules;
  F.impr = F.impr || { orient: 'portrait', quad: false, echelle: 100, zone: null };
  return F;
}
const zf = (F) => (F.zoom || 100) / 100;
const largeur = (F, c) => Math.round((F.largeurs[c] || LARG_DEF) * zf(F));
const hauteurDef = (F, r) => Math.round((F.hauteurs[r] || HAUT_DEF) * zf(F));
const cellule = (F, r, c) => F.cells[adr(r, c)];
const brut = (F, r, c) => (F.cells[adr(r, c)] ? F.cells[adr(r, c)].v : '');
const fusionDe = (F, r, c) => (F.merges || []).find((m) => r >= m.r1 && r <= m.r2 && c >= m.c1 && c <= m.c2) || null;

function etendreFusions(R, F) {
  let ch = true;
  while (ch) {
    ch = false;
    for (const m of F.merges || []) {
      if (m.r2 < R.r1 || m.r1 > R.r2 || m.c2 < R.c1 || m.c1 > R.c2) continue;
      if (m.r1 < R.r1) { R.r1 = m.r1; ch = true; } if (m.r2 > R.r2) { R.r2 = m.r2; ch = true; }
      if (m.c1 < R.c1) { R.c1 = m.c1; ch = true; } if (m.c2 > R.c2) { R.c2 = m.c2; ch = true; }
    }
  }
  return R;
}
const rectBrut = () => ({ r1: Math.min(sh.sel.r1, sh.sel.r2), r2: Math.max(sh.sel.r1, sh.sel.r2), c1: Math.min(sh.sel.c1, sh.sel.c2), c2: Math.max(sh.sel.c1, sh.sel.c2) });
const rect = () => { const F = feuille(); return F ? etendreFusions(rectBrut(), F) : rectBrut(); };
const actif = () => { const F = feuille(), m = F && fusionDe(F, sh.sel.r1, sh.sel.c1); return m ? { r: m.r1, c: m.c1 } : { r: sh.sel.r1, c: sh.sel.c1 }; };

/* ================= Format d'affichage ================= */
const DEC_DEFAUT = { n: 2, pct: 0, eur: 2 };
function afficher(cell, val) {
  if (estErr(val)) return val.err;
  if (val === null) return '';
  if (typeof val === 'boolean') return val ? 'VRAI' : 'FAUX';
  if (typeof val === 'object') return '';
  if (typeof val !== 'number') return String(val);
  const s = cell ? cell.s : {};
  switch (s.fmt) {
    case 'code': return formaterCode(val, s.code || '0');
    case 'txt': return cell && cell.v[0] !== '=' ? cell.v : fmtNombre(val);
    case 'n': case 'pct': case 'eur': return formaterCode(val, CODES[s.fmt](s.dec ?? DEC_DEFAUT[s.fmt]));
    case 'sci': case 'date': case 'datel': case 'heure': return formaterCode(val, CODES[s.fmt]());
    default: return s.dec != null ? formaterCode(val, CODES.n(s.dec)) : fmtNombre(val);
  }
}
function texteAffiche(F, r, c) { return afficher(cellule(F, r, c), valCell(sh.ctx, F, r, c)); }

/* ================= Mise en forme conditionnelle ================= */
const hexRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h); const n = parseInt(m ? m[1] : '808080', 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const mixer = (a, b, t) => { const A = hexRgb(a), B = hexRgb(b); return `rgb(${A.map((x, i) => Math.round(x + (B[i] - x) * t)).join(',')})`; };
const ICONES = { fleches: ['▼', '▶', '▲'], feux: ['🔴', '🟡', '🟢'], etoiles: ['☆', '★', '★★'] };

function preparerCF(F, ctx) {
  return (F.cf || []).map((rule) => {
    const R = parsePlage(rule.range);
    if (!R) return null;
    const vals = [], tous = [];
    for (let r = R.r1; r <= R.r2; r++) for (let c = R.c1; c <= R.c2; c++) {
      const v = valCell(ctx, F, r, c);
      tous.push(v);
      if (typeof v === 'number') vals.push(v);
    }
    const st = { min: Math.min(...vals), max: Math.max(...vals), moy: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0 };
    if (rule.type === 'doublons' || rule.type === 'uniques') { st.cnt = new Map(); tous.forEach((v) => { if (v !== null) { const k = texte(v).toLowerCase(); st.cnt.set(k, (st.cnt.get(k) || 0) + 1); } }); }
    if (rule.type === 'top' || rule.type === 'bottom') { const n = Math.max(1, +rule.a || 10), s = [...vals].sort((a, b) => (rule.type === 'top' ? b - a : a - b)); st.seuil = s[Math.min(n, s.length) - 1]; }
    if (rule.type === 'echelle' || rule.type === 'icones') { const s = [...vals].sort((a, b) => a - b); st.t1 = s[Math.floor(s.length / 3)]; st.t2 = s[Math.floor(2 * s.length / 3)]; }
    return { rule, R, st };
  }).filter(Boolean);
}
function cfCell(ctx, F, regles, r, c, val) {
  const out = { css: '', icone: '', barre: null };
  for (const { rule, R, st } of regles) {
    if (r < R.r1 || r > R.r2 || c < R.c1 || c > R.c2) continue;
    const a = constante(rule.a), b = constante(rule.b), num = typeof val === 'number';
    let ok = false;
    switch (rule.type) {
      case 'gt': ok = cmpCF(val, a) > 0; break; case 'ge': ok = cmpCF(val, a) >= 0; break;
      case 'lt': ok = cmpCF(val, a) < 0; break; case 'le': ok = cmpCF(val, a) <= 0; break;
      case 'eq': ok = val !== null && cmp(val, a) === 0; break; case 'ne': ok = val === null || cmp(val, a) !== 0; break;
      case 'entre': ok = num && val >= Math.min(a, b) && val <= Math.max(a, b); break;
      case 'contient': ok = val !== null && texte(val).toLowerCase().includes(String(rule.a).toLowerCase()); break;
      case 'debute': ok = val !== null && texte(val).toLowerCase().startsWith(String(rule.a).toLowerCase()); break;
      case 'finit': ok = val !== null && texte(val).toLowerCase().endsWith(String(rule.a).toLowerCase()); break;
      case 'doublons': ok = val !== null && st.cnt.get(texte(val).toLowerCase()) > 1; break;
      case 'uniques': ok = val !== null && st.cnt.get(texte(val).toLowerCase()) === 1; break;
      case 'top': ok = num && val >= st.seuil; break; case 'bottom': ok = num && val <= st.seuil; break;
      case 'moy+': ok = num && val > st.moy; break; case 'moy-': ok = num && val < st.moy; break;
      case 'vide': ok = val === null || val === ''; break; case 'nonvide': ok = val !== null && val !== ''; break; case 'erreur': ok = estErr(val); break;
      case 'formule': {
        try { const e = arbre(decalerRelatives('=' + rule.a.replace(/^=/, ''), r - R.r1, c - R.c1).slice(1)); const x = evalNode(e, ctx, F); ok = aBool(estRng(x) ? x.rng[0][0] : x) === true; } catch (e) { ok = false; }
        break;
      }
      case 'barres': if (num && st.max > Math.min(0, st.min)) out.barre = { pct: Math.max(0, (val - Math.min(0, st.min)) / (st.max - Math.min(0, st.min))), couleur: (rule.couleurs || [])[0] || '#5b8def' }; continue;
      case 'echelle': {
        if (!num || st.max === st.min) continue;
        const t = (val - st.min) / (st.max - st.min), cc = rule.couleurs || ['#f87171', '#ffe066', '#4ade80'];
        const col = cc.length === 3 ? (t < 0.5 ? mixer(cc[0], cc[1], t * 2) : mixer(cc[1], cc[2], (t - 0.5) * 2)) : mixer(cc[0], cc[1], t);
        out.css += `background-color:${col};color:#111;`;
        continue;
      }
      case 'icones': if (num) out.icone = ICONES[rule.a || 'fleches'][val <= st.t1 ? 0 : val <= st.t2 ? 1 : 2]; continue;
      default:
    }
    if (ok) {
      const s = rule.st || {};
      out.css += `${s.bg ? `background-color:${s.bg};` : ''}${s.c ? `color:${s.c};` : ''}${s.b ? 'font-weight:700;' : ''}${s.i ? 'font-style:italic;' : ''}`;
    }
  }
  return out;
}
function cmpCF(val, a) { if (val === null || a === null || typeof val !== typeof a) return NaN; return cmp(val, a); }

/* ================= Validation des données ================= */
function validationDe(F, r, c) {
  for (const v of F.valids || []) { const R = parsePlage(v.range); if (R && r >= R.r1 && r <= R.r2 && c >= R.c1 && c <= R.c2) return v; }
  return null;
}
function optionsListe(F, v) {
  if (/^[A-Za-z]{1,3}\d+(:[A-Za-z]{1,3}\d+)?$/.test(v.source.trim()) || /!/.test(v.source)) {
    const T = tableur(), ctx = sh.ctx || nouveauCtx(T);
    const x = evalNode(arbre(v.source.trim()), ctx, F);
    return aplatir([x]).filter((y) => y !== null).map(texte);
  }
  return v.source.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
}
/* Renvoie un message d'erreur si la valeur saisie est refusée */
function verifierValidation(F, r, c, valeur) {
  const v = validationDe(F, r, c);
  if (!v || (valeur === '' && v.ignoreVide !== false)) return null;
  const x = valeur[0] === '=' ? null : constante(valeur);
  const a = constante(v.a), b = constante(v.b);
  const op = (n) => {
    switch (v.op) {
      case 'entre': return n >= Math.min(a, b) && n <= Math.max(a, b);
      case 'horsde': return n < Math.min(a, b) || n > Math.max(a, b);
      case 'egal': return n === a; case 'diff': return n !== a;
      case 'sup': return n > a; case 'supeg': return n >= a; case 'inf': return n < a; case 'infeg': return n <= a;
      default: return true;
    }
  };
  let ok = true;
  switch (v.type) {
    case 'liste': ok = optionsListe(F, v).some((o) => o.toLowerCase() === valeur.toLowerCase()); break;
    case 'entier': ok = typeof x === 'number' && Number.isInteger(x) && op(x); break;
    case 'decimal': ok = typeof x === 'number' && op(x); break;
    case 'date': ok = typeof x === 'number' && op(Math.floor(x)); break;
    case 'longueur': ok = op(valeur.length); break;
    case 'case': ok = /^(vrai|faux|true|false)$/i.test(valeur); break;
    case 'perso': { try { const R = parsePlage(v.range); const e = arbre(decalerRelatives('=' + v.a.replace(/^=/, ''), r - R.r1, c - R.c1).slice(1)); ok = aBool(evalNode(e, sh.ctx, F)) === true; } catch (er) { ok = false; } break; }
    default:
  }
  return ok ? null : (v.message || 'Cette valeur n’est pas autorisée par les règles de validation de la cellule.');
}

/* ================= Filtre automatique ================= */
function plageFiltre(F) {
  const f = F.filtre;
  if (!f) return null;
  const z = zoneUtilisee(F);
  return { r1: f.r, r2: Math.max(f.r, f.r2 ?? z.r2), c1: f.c1, c2: f.c2 };
}
function lignesFiltrees(F) {
  const out = new Set(), P = plageFiltre(F);
  if (!P) return out;
  for (let r = P.r1 + 1; r <= P.r2; r++) {
    for (const [c, permis] of Object.entries(F.filtre.crit || {})) {
      const t = texteAffiche(F, r, +c) || '(vide)';
      if (!permis.includes(t)) { out.add(r); break; }
    }
  }
  return out;
}

/* ================= Rendu de la grille ================= */
const esc2 = (s) => esc(s).replace(/\n/g, '<br>');
const URL_RE = /^(https?:\/\/|www\.)\S+$/i;

function styleCss(F, cell, val, cf) {
  const s = cell ? cell.s : {};
  const al = s.al || (typeof val === 'number' ? 'right' : typeof val === 'boolean' || estErr(val) ? 'center' : 'left');
  const z = zf(F);
  let css = `text-align:${al};`;
  if (s.b) css += 'font-weight:700;';
  if (s.i) css += 'font-style:italic;';
  if (s.u || s.st) css += `text-decoration:${[s.u && 'underline', s.st && 'line-through'].filter(Boolean).join(' ')};`;
  if (s.c) css += `color:${s.c};`;
  if (s.bg) css += `background-color:${s.bg};`;
  if (s.fs) css += `font-size:${Math.round(s.fs * z * 10) / 10}pt;`;
  if (s.ff) css += `font-family:${s.ff};`;
  if (s.va) css += `vertical-align:${s.va};`;
  if (s.wrap) css += 'white-space:pre-wrap;word-break:break-word;';
  if (s.ind) css += `padding-left:${6 + s.ind * 10 * z}px;`;
  if (s.bd) for (const [k, side] of [['t', 'top'], ['r', 'right'], ['b', 'bottom'], ['l', 'left']]) if (s.bd[k]) css += `border-${side}:1px solid ${s.bd[k]} !important;`;
  if (cf && cf.css) css += cf.css;
  if (cf && cf.barre) css += `background-image:linear-gradient(90deg,${cf.barre.couleur} ${Math.round(cf.barre.pct * 100)}%,transparent ${Math.round(cf.barre.pct * 100)}%);`;
  return css;
}

function sparkSvg(sp, w, h) {
  const vals = sp.vals;
  if (!vals.length) return '';
  const mn = Math.min(...vals, 0), mx = Math.max(...vals), pad = 3, W = Math.max(40, w - 8), H = Math.max(14, h - 6);
  const y = (v) => pad + (H - 2 * pad) * (1 - (v - mn) / ((mx - mn) || 1));
  const bw = W / vals.length;
  let s = '';
  if (/col/.test(sp.type)) vals.forEach((v, i) => { s += `<rect x="${i * bw + 1}" y="${Math.min(y(v), y(0))}" width="${Math.max(1, bw - 2)}" height="${Math.max(1, Math.abs(y(v) - y(0)))}" fill="#f0b27a"/>`; });
  else if (/gain/.test(sp.type)) vals.forEach((v, i) => { s += `<rect x="${i * bw + 1}" y="${v >= 0 ? H / 2 - H / 3 : H / 2}" width="${Math.max(1, bw - 2)}" height="${H / 3}" fill="${v >= 0 ? '#4ade80' : '#f87171'}"/>`; });
  else s = `<polyline fill="none" stroke="#f0b27a" stroke-width="1.6" points="${vals.map((v, i) => `${(i + 0.5) * bw},${y(v)}`).join(' ')}"/>`;
  return `<svg class="spk" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${s}</svg>`;
}

function contenuCell(F, r, c, cell, val, cf, w, h) {
  if (val !== null && typeof val === 'object' && val.spark) return sparkSvg(val.spark, w, h);
  const v = validationDe(F, r, c);
  if (v && v.type === 'case' && (typeof val === 'boolean' || val === null)) return `<span class="chk" data-chk="1">${val ? '☑' : '☐'}</span>`;
  let t = F.formules && cell && cell.v[0] === '=' ? cell.v : afficher(cell, val);
  let html = esc2(t);
  if (cell && cell.l) html = `<a href="${esc(/^[a-z]+:/i.test(cell.l) ? cell.l : 'https://' + cell.l)}" target="_blank" rel="noopener noreferrer" data-lien="1">${html || esc(cell.l)}</a>`;
  else if (typeof val === 'string' && URL_RE.test(val.trim())) html = `<a href="${esc(/^[a-z]+:/i.test(val) ? val : 'https://' + val)}" target="_blank" rel="noopener noreferrer" data-lien="1">${html}</a>`;
  if (cf && cf.icone) html = `<span class="ico">${cf.icone}</span> ${html}`;
  return html;
}

function renderGrille() {
  const F0 = feuille(), grid = $('#shGrid');
  if (!F0 || !grid) return;
  const F = completerFeuille(F0), T = tableur();
  const sx = grid.scrollLeft, sy = grid.scrollTop;
  sh.ctx = nouveauCtx(T);
  evaluerTout(sh.ctx);
  const ext = sh.ctx.ext[F.id];
  if (ext) { F.nbL = Math.max(F.nbL, Math.min(MAXL, ext.r)); F.nbC = Math.max(F.nbC, Math.min(MAXC, ext.c)); }
  sh.masqL = new Set([...(F.cache.l || []), ...lignesFiltrees(F)]);
  sh.masqC = new Set(F.cache.c || []);
  sh.fus = new Map(); sh.couv = new Set();
  for (const m of F.merges) for (let r = m.r1; r <= m.r2; r++) for (let c = m.c1; c <= m.c2; c++) { if (r === m.r1 && c === m.c1) sh.fus.set(r + ',' + c, m); else sh.couv.add(r + ',' + c); }
  sh.cf = preparerCF(F, sh.ctx);
  const z = zf(F), P = plageFiltre(F);
  const gel = F.gel;
  const rowH = (r) => hauteurDef(F, r);
  let h = `<table class="sh${F.quad ? '' : ' nogrid'}${F.ent ? '' : ' noent'}" style="--zf:${z}"><colgroup><col style="width:${Math.round(LARG_ENT * z)}px">`;
  for (let c = 0; c < F.nbC; c++) h += `<col data-col="${c}" style="${sh.masqC.has(c) ? 'width:0;visibility:collapse' : `width:${largeur(F, c)}px`}">`;
  h += '</colgroup><thead><tr><th class="corner" data-all="1"></th>';
  for (let c = 0; c < F.nbC; c++) h += `<th class="ch${sh.masqC.has(c) ? ' hidc' : ''}" data-ch="${c}">${colNom(c)}<i class="rs" data-rs="${c}"></i></th>`;
  h += '</tr></thead><tbody>';
  for (let r = 0; r < F.nbL; r++) {
    const caché = sh.masqL.has(r);
    h += `<tr data-r="${r}"${caché ? ' class="hidr"' : ''} style="height:${rowH(r)}px"><th class="rh" data-rh="${r}">${r + 1}<i class="rsr" data-rsr="${r}"></i></th>`;
    for (let c = 0; c < F.nbC; c++) {
      if (sh.couv.has(r + ',' + c)) { h += `<td class="cv" data-r="${r}" data-c="${c}" style="display:none"></td>`; continue; }
      const cell = cellule(F, r, c), val = valCell(sh.ctx, F, r, c);
      const cf = sh.cf.length ? cfCell(sh.ctx, F, sh.cf, r, c, val) : null;
      const m = sh.fus.get(r + ',' + c);
      let span = '', w = largeur(F, c), hh = rowH(r);
      if (m) {
        let cs = 0, rs = 0;
        w = 0; hh = 0;
        for (let k = m.c1; k <= m.c2; k++) if (!sh.masqC.has(k)) { cs++; w += largeur(F, k); }
        for (let k = m.r1; k <= m.r2; k++) if (!sh.masqL.has(k)) { rs++; hh += rowH(k); }
        span = ` colspan="${cs || 1}" rowspan="${rs || 1}"`;
      }
      const clas = [estErr(val) ? 'er' : '', sh.masqC.has(c) ? 'hidc' : '', cell && cell.n ? 'nt' : '', m ? 'mg' : '', cell && cell.s.wrap ? 'wr' : ''].filter(Boolean).join(' ');
      let extra = '';
      const v = validationDe(F, r, c);
      if (v && v.type === 'liste') extra += `<i class="dvb" data-dv="1" title="Liste déroulante">▾</i>`;
      if (P && r === P.r1 && c >= P.c1 && c <= P.c2) extra += `<i class="flb${F.filtre.crit && F.filtre.crit[c] ? ' on' : ''}" data-fl="${c}" title="Filtrer">▾</i>`;
      h += `<td data-r="${r}" data-c="${c}"${span} class="${clas}" style="${styleCss(F, cell, val, cf)}"${cell && cell.n ? ` title="${esc(cell.n)}"` : ''}>${contenuCell(F, r, c, cell, val, cf, w, hh)}${extra}</td>`;
    }
    h += '</tr>';
  }
  grid.innerHTML = h + '</tbody></table>';
  grid.scrollLeft = sx; grid.scrollTop = sy;
  sh.tds = [];
  grid.querySelectorAll('tbody tr').forEach((tr, r) => { sh.tds[r] = [...tr.querySelectorAll('td')]; });
  sh.fp = []; sh.rf = [];
  grid.classList.toggle('nogridw', !F.quad);
  if (gel.r || gel.c) appliquerGel(grid, F);
  const s = sh.sel;
  s.r1 = Math.min(s.r1, F.nbL - 1); s.r2 = Math.min(s.r2, F.nbL - 1); s.c1 = Math.min(s.c1, F.nbC - 1); s.c2 = Math.min(s.c2, F.nbC - 1);
  majSelection(null);
  renderGraphs();
  renderOnglets();
  majStatut();
}

function appliquerGel(grid, F) {
  const table = grid.querySelector('table');
  const thead = table.querySelector('thead tr');
  let top = thead.offsetHeight;
  const rows = [...table.querySelectorAll('tbody tr')];
  for (let r = 0; r < F.gel.r && r < rows.length; r++) {
    const tr = rows[r];
    if (tr.classList.contains('hidr')) continue;
    [...tr.children].forEach((x) => { x.classList.add('fz'); x.style.top = top + 'px'; if (r === F.gel.r - 1) x.classList.add('fzb'); });
    top += tr.offsetHeight;
  }
  let left = Math.round(LARG_ENT * zf(F));
  const lefts = {};
  for (let c = 0; c < F.gel.c && c < F.nbC; c++) { if (sh.masqC.has(c)) continue; lefts[c] = left; left += largeur(F, c); }
  table.querySelectorAll('[data-c], [data-ch]').forEach((x) => {
    const c = x.dataset.c !== undefined ? +x.dataset.c : +x.dataset.ch;
    if (c < F.gel.c && lefts[c] !== undefined) {
      x.classList.add('fz', 'fzc'); x.style.left = lefts[c] + 'px';
      if (c === F.gel.c - 1 || (x.colSpan > 1 && c + x.colSpan - 1 >= F.gel.c - 1)) x.classList.add('fzr');
    }
  });
}

/* ================= Sélection ================= */
function majSelection(ancien) {
  const F = feuille();
  if (!F) return;
  const bascule = (rc, on) => {
    for (let r = rc.r1; r <= rc.r2; r++) for (let c = rc.c1; c <= rc.c2; c++) {
      const td = sh.tds[r] && sh.tds[r][c];
      if (!td) continue;
      td.classList.toggle('sel', on);
      if (!on) { td.classList.remove('act'); td.querySelectorAll('.fh').forEach((x) => x.remove()); }
    }
  };
  if (ancien) bascule(ancien, false);
  else document.querySelectorAll('#shGrid td.sel, #shGrid td.act').forEach((td) => { td.classList.remove('sel', 'act'); td.querySelectorAll('.fh').forEach((x) => x.remove()); });
  const n = rect();
  bascule(n, true);
  const A = actif();
  const a = sh.tds[A.r] && sh.tds[A.r][A.c];
  if (a) a.classList.add('act');
  const coin = sh.tds[n.r2] && sh.tds[n.r2][n.c2];
  const cible = coin && coin.classList.contains('cv') ? (sh.tds[fusionDe(F, n.r2, n.c2).r1] || [])[fusionDe(F, n.r2, n.c2).c1] : coin;
  if (cible && !sh.ed && !cible.querySelector('.fh')) { const fh = document.createElement('i'); fh.className = 'fh'; fh.dataset.fh = '1'; cible.appendChild(fh); }
  const box = $('#shAddr');
  if (box && document.activeElement !== box) box.value = textePlage({ r1: n.r1, c1: n.c1, r2: n.r2, c2: n.c2 }).replace(/^([A-Z]+\d+):\1$/, '$1');
  const bar = $('#shFormule');
  if (!sh.ed && bar && document.activeElement !== bar) bar.value = brut(F, A.r, A.c);
  const cell = cellule(F, A.r, A.c);
  majRuban(cell);
  majStatut();
}
function selectionner(r1, c1, r2, c2) {
  const ancien = rect();
  sh.sel = { r1, c1, r2, c2 };
  majSelection(ancien);
}
function defiler() {
  const td = sh.tds[sh.sel.r2] && sh.tds[sh.sel.r2][sh.sel.c2];
  if (td && !td.classList.contains('cv')) td.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function majStatut() {
  const el = $('#shStat');
  if (!el || !sh.ctx) return;
  const F = feuille(), R = rect();
  if (!F) return;
  const nums = [];
  let nb = 0;
  for (let r = R.r1; r <= R.r2 && nb < 20000; r++) for (let c = R.c1; c <= R.c2; c++) {
    if (sh.masqL.has(r) || sh.masqC.has(c)) continue;
    const v = valCell(sh.ctx, F, r, c);
    nb++;
    if (typeof v === 'number') nums.push(v);
  }
  const f = (x) => fmtNombre(parseFloat(x.toPrecision(10)));
  const P = plageFiltre(F);
  const nbDonnees = P ? P.r2 - P.r1 : 0, vis = P ? [...Array(nbDonnees)].filter((_, i) => !sh.masqL.has(P.r1 + 1 + i)).length : 0;
  el.innerHTML = (nums.length > 1 || (nums.length === 1 && nb > 1)
    ? `<span>Moyenne : <b>${f(nums.reduce((a, b) => a + b, 0) / nums.length)}</b></span><span>Nb : <b>${nums.length}</b></span><span>Min : <b>${f(Math.min(...nums))}</b></span><span>Max : <b>${f(Math.max(...nums))}</b></span><span>Somme : <b>${f(nums.reduce((a, b) => a + b, 0))}</b></span>`
    : '<span class="hint">Prêt</span>') + (P ? `<span>${vis} sur ${nbDonnees} enregistrements</span>` : '');
}

/* ================= Historique ================= */
const instantane = (F) => { const { id, nom, ...reste } = F; return JSON.stringify(reste); };
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
  if (sh.histo.id !== F.id || !sh.histo.undo.length) { toast('Rien à annuler'); return; }
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

/* ================= Écriture des cellules ================= */
function assurer(F, r, c) { const a = adr(r, c); return F.cells[a] || (F.cells[a] = { v: '', s: {} }); }
function nettoyer(F, a) {
  const cell = F.cells[a];
  if (cell && cell.v === '' && !Object.keys(cell.s).length && !cell.n && !cell.l) delete F.cells[a];
}
function poser(F, r, c, valeur) {
  const a = adr(r, c);
  let cell = F.cells[a];
  if (valeur === '' && !cell) return;
  if (!cell) cell = F.cells[a] = { v: '', s: {} };
  cell.v = valeur;
  if (valeur && valeur[0] !== '=' && !cell.s.fmt) { const fa = formatAuto(valeur); if (fa) Object.assign(cell.s, fa); }
  nettoyer(F, a);
}
