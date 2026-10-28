'use strict';
/* ============================================================
   Moteur de tableur : adresses, formules, fonctions
   (aucune dépendance, pas de eval)
   ============================================================ */

const MAXL = 500, MAXC = 52;

const colNom = (c) => { let s = ''; c++; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };
const colNum = (s) => { let n = 0; for (const ch of s.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
const adr = (r, c) => colNom(c) + (r + 1);
function parseAdr(a) { const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(a); return m ? { c: colNum(m[1]), r: +m[2] - 1 } : null; }

/* ---------- Valeurs ---------- */
const E = (e) => ({ err: e });
const estErr = (v) => v !== null && typeof v === 'object' && 'err' in v;
const estRng = (v) => v !== null && typeof v === 'object' && 'rng' in v;

const EPOQUE = Date.UTC(1899, 11, 30);
const serialDate = (y, m, d) => Math.round((Date.UTC(y, m - 1, d) - EPOQUE) / 864e5);
const dateDepuis = (n) => new Date(EPOQUE + n * 864e5);
const fmtSerie = (n) => dateDepuis(n).toLocaleDateString('fr-FR', { timeZone: 'UTC' });

function constante(raw) {
  if (raw === '' || raw == null) return null;
  const t = String(raw).trim();
  if (/^[-+]?\d+([.,]\d+)?([eE][+-]?\d+)?$/.test(t)) return parseFloat(t.replace(',', '.'));
  if (/^[-+]?\d+([.,]\d+)?\s?%$/.test(t)) return parseFloat(t.replace(',', '.')) / 100;
  const d = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (d) return serialDate(+d[3], +d[2], +d[1]);
  if (/^(VRAI|TRUE)$/i.test(t)) return true;
  if (/^(FAUX|FALSE)$/i.test(t)) return false;
  return String(raw);
}

function fmtNombre(n) {
  if (!isFinite(n)) return n > 0 ? '#DIV/0!' : '#NUM!';
  if (Number.isInteger(n)) return String(n);
  return String(parseFloat(n.toPrecision(12))).replace('.', ',');
}
function texte(v) {
  if (v === null || v === undefined) return '';
  if (estErr(v)) return v.err;
  if (typeof v === 'boolean') return v ? 'VRAI' : 'FAUX';
  if (typeof v === 'number') return fmtNombre(v);
  return String(v);
}
function aNum(v) {
  if (estErr(v)) return v;
  if (estRng(v)) return E('#VALEUR!');
  if (v === null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const c = constante(v);
  return typeof c === 'number' ? c : E('#VALEUR!');
}
function aBool(v) {
  if (estErr(v)) return v;
  if (estRng(v)) return E('#VALEUR!');
  if (v === null) return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const c = constante(v);
  return typeof c === 'boolean' ? c : E('#VALEUR!');
}
function cmp(a, b) {
  const defaut = (x, autre) => (x !== null ? x : typeof autre === 'string' ? '' : typeof autre === 'boolean' ? false : 0);
  a = defaut(a, b); b = defaut(b, a);
  const rang = (x) => (typeof x === 'number' ? 0 : typeof x === 'string' ? 1 : 2);
  if (rang(a) !== rang(b)) return rang(a) - rang(b);
  if (rang(a) === 1) { const x = a.toLowerCase(), y = b.toLowerCase(); return x < y ? -1 : x > y ? 1 : 0; }
  return +a - +b;
}

/* ---------- Analyse syntaxique ---------- */
const RE_IDENT = /^[A-Za-zÀ-ÿ_][\wÀ-ÿ.]*/;
const RE_REFRNG = /^(\$?[A-Za-z]{1,3}\$?\d+)(?::(\$?[A-Za-z]{1,3}\$?\d+))?(?![\wÀ-ÿ(])/;
const RE_SHEET = /^(?:'([^']+)'|([A-Za-zÀ-ÿ_][\wÀ-ÿ]*))!/;

function tokeniser(s) {
  const t = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '"') {
      let j = i + 1, v = '';
      while (j < s.length) {
        if (s[j] === '"') { if (s[j + 1] === '"') { v += '"'; j += 2; continue; } break; }
        v += s[j++];
      }
      if (j >= s.length) throw new Error('chaîne non fermée');
      t.push({ k: 'str', v }); i = j + 1; continue;
    }
    const rest = s.slice(i);
    let m = /^(?:\d+(?:[.,]\d+)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(rest);
    if (m) { t.push({ k: 'num', v: parseFloat(m[0].replace(',', '.')) }); i += m[0].length; continue; }
    let sheet = null, body = rest;
    const ms = RE_SHEET.exec(rest);
    if (ms) { sheet = ms[1] || ms[2]; body = rest.slice(ms[0].length); }
    const id = RE_IDENT.exec(body);
    if (!sheet && id && body[id[0].length] === '(') { t.push({ k: 'func', v: id[0] }); i += id[0].length; continue; }
    const mr = RE_REFRNG.exec(body);
    if (mr) {
      const a = parseAdr(mr[1]);
      const nd = mr[2] ? (() => { const b = parseAdr(mr[2]); return { t: 'range', sheet, r1: Math.min(a.r, b.r), c1: Math.min(a.c, b.c), r2: Math.max(a.r, b.r), c2: Math.max(a.c, b.c) }; })() : { t: 'ref', sheet, r: a.r, c: a.c };
      t.push({ k: 'node', node: nd });
      i += (ms ? ms[0].length : 0) + mr[0].length;
      continue;
    }
    if (!sheet && id) { t.push({ k: 'ident', v: id[0] }); i += id[0].length; continue; }
    m = /^(<=|>=|<>|[-+*/^&=<>%()])/.exec(rest);
    if (m) { t.push({ k: 'op', v: m[1] }); i += m[1].length; continue; }
    if (ch === ';' || ch === ',') { t.push({ k: 'sep' }); i++; continue; }
    throw new Error('caractère inattendu : ' + ch);
  }
  return t;
}

function parser(tokens) {
  let p = 0;
  const peek = () => tokens[p];
  const estOp = (v) => peek() && peek().k === 'op' && peek().v === v;
  const attendre = (v) => { if (!estOp(v)) throw new Error('« ' + v + ' » attendu'); p++; };
  const binaire = (suivant, ops) => () => {
    let a = suivant();
    while (peek() && peek().k === 'op' && ops.includes(peek().v)) { const op = tokens[p++].v; a = { t: 'bin', op, a, b: suivant() }; }
    return a;
  };
  const prim = () => {
    const t = tokens[p++];
    if (!t) throw new Error('fin inattendue');
    if (t.k === 'num') return { t: 'num', v: t.v };
    if (t.k === 'str') return { t: 'str', v: t.v };
    if (t.k === 'node') return t.node;
    if (t.k === 'ident') {
      if (/^(VRAI|TRUE)$/i.test(t.v)) return { t: 'bool', v: true };
      if (/^(FAUX|FALSE)$/i.test(t.v)) return { t: 'bool', v: false };
      return { t: 'err', v: '#NOM?' };
    }
    if (t.k === 'func') {
      attendre('(');
      const args = [];
      if (!estOp(')')) {
        for (;;) {
          if (peek() && peek().k === 'sep') args.push({ t: 'vide' });
          else args.push(expr());
          if (peek() && peek().k === 'sep') { p++; continue; }
          break;
        }
      }
      attendre(')');
      return { t: 'call', name: t.v, args };
    }
    if (t.k === 'op' && t.v === '(') { const e = expr(); attendre(')'); return e; }
    throw new Error('syntaxe');
  };
  const post = () => { let a = prim(); while (estOp('%')) { p++; a = { t: 'pct', a }; } return a; };
  const unaire = () => {
    if (estOp('-')) { p++; return { t: 'un', a: unaire() }; }
    if (estOp('+')) { p++; return unaire(); }
    return post();
  };
  const puiss = binaire(unaire, ['^']);
  const mul = binaire(puiss, ['*', '/']);
  const add = binaire(mul, ['+', '-']);
  const conc = binaire(add, ['&']);
  const expr = binaire(conc, ['=', '<>', '<=', '>=', '<', '>']);
  const racine = expr();
  if (p < tokens.length) throw new Error('syntaxe');
  return racine;
}

const cacheAst = new Map();
function arbre(src) {
  if (cacheAst.has(src)) return cacheAst.get(src);
  let a;
  try { a = parser(tokeniser(src)); } catch (e) { a = { t: 'err', v: '#ERREUR!' }; }
  if (cacheAst.size > 3000) cacheAst.clear();
  cacheAst.set(src, a);
  return a;
}

/* ---------- Évaluation ---------- */
function nouveauCtx(tab) { return { tab, memo: new Map(), pile: new Set() }; }

function valCell(ctx, f, r, c) {
  const k = f.id + ':' + r + ',' + c;
  if (ctx.memo.has(k)) return ctx.memo.get(k);
  const cell = f.cells[adr(r, c)];
  let res;
  if (!cell || cell.v === '') res = null;
  else if (cell.v[0] === '=') {
    if (ctx.pile.has(k)) return E('#CYCLE!');
    ctx.pile.add(k);
    res = evalNode(arbre(cell.v.slice(1)), ctx, f);
    if (estRng(res)) res = E('#VALEUR!');
    ctx.pile.delete(k);
  } else res = constante(cell.v);
  ctx.memo.set(k, res);
  return res;
}

function feuilleDe(ctx, f, nom) {
  if (!nom) return f;
  return ctx.tab.feuilles.find((x) => x.nom.toLowerCase() === nom.toLowerCase()) || null;
}

function evalNode(n, ctx, f) {
  switch (n.t) {
    case 'num': case 'str': case 'bool': return n.v;
    case 'vide': return null;
    case 'err': return E(n.v);
    case 'ref': { const g = feuilleDe(ctx, f, n.sheet); return g ? valCell(ctx, g, n.r, n.c) : E('#REF!'); }
    case 'range': {
      const g = feuilleDe(ctx, f, n.sheet);
      if (!g) return E('#REF!');
      const rng = [];
      for (let r = n.r1; r <= n.r2; r++) { const row = []; for (let c = n.c1; c <= n.c2; c++) row.push(valCell(ctx, g, r, c)); rng.push(row); }
      return { rng };
    }
    case 'un': { const v = aNum(evalNode(n.a, ctx, f)); return estErr(v) ? v : -v; }
    case 'pct': { const v = aNum(evalNode(n.a, ctx, f)); return estErr(v) ? v : v / 100; }
    case 'bin': return operation(n, ctx, f);
    case 'call': return appel(n, ctx, f);
    default: return E('#ERREUR!');
  }
}

function operation(n, ctx, f) {
  const a = evalNode(n.a, ctx, f), b = evalNode(n.b, ctx, f);
  if (estErr(a)) return a;
  if (estErr(b)) return b;
  if (estRng(a) || estRng(b)) return E('#VALEUR!');
  if (n.op === '&') return texte(a) + texte(b);
  if (['=', '<>', '<', '>', '<=', '>='].includes(n.op)) {
    const d = cmp(a, b);
    return { '=': d === 0, '<>': d !== 0, '<': d < 0, '>': d > 0, '<=': d <= 0, '>=': d >= 0 }[n.op];
  }
  const x = aNum(a), y = aNum(b);
  if (estErr(x)) return x;
  if (estErr(y)) return y;
  switch (n.op) {
    case '+': return x + y;
    case '-': return x - y;
    case '*': return x * y;
    case '/': return y === 0 ? E('#DIV/0!') : x / y;
    case '^': { const r = Math.pow(x, y); return isFinite(r) ? r : E('#NUM!'); }
    default: return E('#ERREUR!');
  }
}

const ALIAS = {
  SUM: 'SOMME', AVERAGE: 'MOYENNE', COUNT: 'NB', COUNTA: 'NBVAL', IF: 'SI', AND: 'ET', OR: 'OU', NOT: 'NON', ROUND: 'ARRONDI',
  ROUNDUP: 'ARRONDI.SUP', ROUNDDOWN: 'ARRONDI.INF', SQRT: 'RACINE', POWER: 'PUISSANCE', INT: 'ENT', MEDIAN: 'MEDIANE', STDEV: 'ECARTYPE',
  PRODUCT: 'PRODUIT', SUMIF: 'SOMME.SI', COUNTIF: 'NB.SI', AVERAGEIF: 'MOYENNE.SI', CONCATENATE: 'CONCATENER', CONCAT: 'CONCATENER',
  UPPER: 'MAJUSCULE', LOWER: 'MINUSCULE', LEFT: 'GAUCHE', RIGHT: 'DROITE', LEN: 'NBCAR', TODAY: 'AUJOURDHUI', RAND: 'ALEA',
  RANDBETWEEN: 'ALEA.ENTRE.BORNES', IFERROR: 'SIERREUR', VLOOKUP: 'RECHERCHEV', MATCH: 'EQUIV', RANK: 'RANG', SUMPRODUCT: 'SOMMEPROD',
  TRIM: 'SUPPRESPACE', ISBLANK: 'ESTVIDE', YEAR: 'ANNEE', MONTH: 'MOIS', DAY: 'JOUR', VAR: 'VAR', ABS: 'ABS', MOD: 'MOD', PI: 'PI',
  LARGE: 'GRANDE.VALEUR', SMALL: 'PETITE.VALEUR', ISNUMBER: 'ESTNUM', ISTEXT: 'ESTTEXTE',
};

function nombres(vals) {
  const out = [];
  for (const v of vals) {
    if (estRng(v)) {
      for (const row of v.rng) for (const x of row) { if (estErr(x)) return x; if (typeof x === 'number') out.push(x); }
    } else {
      if (estErr(v)) return v;
      if (v === null) continue;
      const x = aNum(v);
      if (estErr(x)) return x;
      out.push(x);
    }
  }
  return out;
}
const aplatir = (vals) => vals.flatMap((v) => (estRng(v) ? v.rng.flat() : [v]));

function critere(crit) {
  if (typeof crit === 'number') return (v) => typeof v === 'number' && v === crit;
  if (typeof crit === 'boolean') return (v) => v === crit;
  const m = /^(<=|>=|<>|<|>|=)?([\s\S]*)$/.exec(texte(crit));
  const op = m[1] || '=', ref = m[2], k = constante(ref);
  if (op === '=' || op === '<>') {
    let eq;
    if (typeof k === 'number' || typeof k === 'boolean') eq = (v) => v === k;
    else if (/[*?]/.test(ref)) {
      const re = new RegExp('^' + ref.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
      eq = (v) => v !== null && re.test(texte(v));
    } else if (ref === '') eq = (v) => v === null || v === '';
    else eq = (v) => typeof v === 'string' && v.toLowerCase() === ref.toLowerCase();
    return op === '=' ? eq : (v) => !eq(v);
  }
  return (v) => {
    if (v === null || typeof v !== typeof k) return false;
    const d = cmp(v, k);
    return { '<': d < 0, '>': d > 0, '<=': d <= 0, '>=': d >= 0 }[op];
  };
}

function appel(n, ctx, f) {
  const nom = ALIAS[n.name.toUpperCase()] || n.name.toUpperCase();
  const arg = (i) => evalNode(n.args[i], ctx, f);
  if (nom === 'SI') {
    const c = aBool(arg(0));
    if (estErr(c)) return c;
    if (c) return n.args.length > 1 ? arg(1) : true;
    return n.args.length > 2 ? arg(2) : false;
  }
  if (nom === 'SIERREUR') { const v = arg(0); return estErr(v) ? arg(1) : v; }
  const fn = FN[nom];
  if (!fn) return E('#NOM?');
  const vals = n.args.map((_, i) => arg(i));
  try { return fn(vals); } catch (e) { return E('#VALEUR!'); }
}

const FN = {
  SOMME: (v) => { const a = nombres(v); return Array.isArray(a) ? a.reduce((s, x) => s + x, 0) : a; },
  MOYENNE: (v) => { const a = nombres(v); return !Array.isArray(a) ? a : a.length ? a.reduce((s, x) => s + x, 0) / a.length : E('#DIV/0!'); },
  MIN: (v) => { const a = nombres(v); return !Array.isArray(a) ? a : a.length ? Math.min(...a) : 0; },
  MAX: (v) => { const a = nombres(v); return !Array.isArray(a) ? a : a.length ? Math.max(...a) : 0; },
  NB: (v) => { const a = nombres(v); return Array.isArray(a) ? a.length : a; },
  NBVAL: (v) => aplatir(v).filter((x) => x !== null && x !== '').length,
  PRODUIT: (v) => { const a = nombres(v); return Array.isArray(a) ? a.reduce((s, x) => s * x, 1) : a; },
  MEDIANE: (v) => {
    const a = nombres(v);
    if (!Array.isArray(a)) return a;
    if (!a.length) return E('#NUM!');
    a.sort((x, y) => x - y);
    const m = a.length >> 1;
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  },
  ECARTYPE: (v) => { const a = nombres(v); if (!Array.isArray(a)) return a; if (a.length < 2) return E('#DIV/0!'); const m = a.reduce((s, x) => s + x, 0) / a.length; return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); },
  VAR: (v) => { const a = nombres(v); if (!Array.isArray(a)) return a; if (a.length < 2) return E('#DIV/0!'); const m = a.reduce((s, x) => s + x, 0) / a.length; return a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1); },
  'GRANDE.VALEUR': (v) => { const a = nombres([v[0]]); const k = aNum(v[1]); if (!Array.isArray(a)) return a; if (estErr(k)) return k; a.sort((x, y) => y - x); return a[k - 1] ?? E('#NUM!'); },
  'PETITE.VALEUR': (v) => { const a = nombres([v[0]]); const k = aNum(v[1]); if (!Array.isArray(a)) return a; if (estErr(k)) return k; a.sort((x, y) => x - y); return a[k - 1] ?? E('#NUM!'); },
  SOMMEPROD: (v) => {
    if (!v.every(estRng)) return E('#VALEUR!');
    const h = v[0].rng.length, w = v[0].rng[0].length;
    if (v.some((x) => x.rng.length !== h || x.rng[0].length !== w)) return E('#VALEUR!');
    let s = 0;
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) { let p = 1; for (const x of v) { const e = x.rng[r][c]; if (estErr(e)) return e; p *= typeof e === 'number' ? e : 0; } s += p; }
    return s;
  },
  ABS: (v) => { const x = aNum(v[0]); return estErr(x) ? x : Math.abs(x); },
  ENT: (v) => { const x = aNum(v[0]); return estErr(x) ? x : Math.floor(x); },
  RACINE: (v) => { const x = aNum(v[0]); return estErr(x) ? x : x < 0 ? E('#NUM!') : Math.sqrt(x); },
  PUISSANCE: (v) => { const x = aNum(v[0]), y = aNum(v[1]); return estErr(x) ? x : estErr(y) ? y : Math.pow(x, y); },
  MOD: (v) => { const x = aNum(v[0]), y = aNum(v[1]); return estErr(x) ? x : estErr(y) ? y : y === 0 ? E('#DIV/0!') : x - y * Math.floor(x / y); },
  PI: () => Math.PI,
  ARRONDI: (v) => { const x = aNum(v[0]), d = v.length > 1 ? aNum(v[1]) : 0; if (estErr(x)) return x; if (estErr(d)) return d; const k = 10 ** d; return Math.sign(x) * Math.round(Math.abs(x) * k + 1e-9) / k; },
  'ARRONDI.SUP': (v) => { const x = aNum(v[0]), d = v.length > 1 ? aNum(v[1]) : 0; if (estErr(x)) return x; if (estErr(d)) return d; const k = 10 ** d; return Math.sign(x) * Math.ceil(Math.abs(x) * k - 1e-9) / k; },
  'ARRONDI.INF': (v) => { const x = aNum(v[0]), d = v.length > 1 ? aNum(v[1]) : 0; if (estErr(x)) return x; if (estErr(d)) return d; const k = 10 ** d; return Math.sign(x) * Math.floor(Math.abs(x) * k + 1e-9) / k; },
  ALEA: () => Math.random(),
  'ALEA.ENTRE.BORNES': (v) => { const a = aNum(v[0]), b = aNum(v[1]); return estErr(a) ? a : estErr(b) ? b : a + Math.floor(Math.random() * (b - a + 1)); },
  ET: (v) => { for (const x of aplatir(v)) { if (x === null) continue; const b = aBool(x); if (estErr(b)) return b; if (!b) return false; } return true; },
  OU: (v) => { for (const x of aplatir(v)) { if (x === null) continue; const b = aBool(x); if (estErr(b)) return b; if (b) return true; } return false; },
  NON: (v) => { const b = aBool(v[0]); return estErr(b) ? b : !b; },
  ESTVIDE: (v) => v[0] === null,
  ESTNUM: (v) => typeof v[0] === 'number',
  ESTTEXTE: (v) => typeof v[0] === 'string',
  CONCATENER: (v) => aplatir(v).map(texte).join(''),
  MAJUSCULE: (v) => texte(v[0]).toUpperCase(),
  MINUSCULE: (v) => texte(v[0]).toLowerCase(),
  GAUCHE: (v) => texte(v[0]).slice(0, v.length > 1 ? aNum(v[1]) : 1),
  DROITE: (v) => { const t = texte(v[0]), n = v.length > 1 ? aNum(v[1]) : 1; return n === 0 ? '' : t.slice(-n); },
  NBCAR: (v) => texte(v[0]).length,
  SUPPRESPACE: (v) => texte(v[0]).trim().replace(/\s+/g, ' '),
  AUJOURDHUI: () => { const d = new Date(); return serialDate(d.getFullYear(), d.getMonth() + 1, d.getDate()); },
  DATE: (v) => { const y = aNum(v[0]), m = aNum(v[1]), d = aNum(v[2]); return estErr(y) ? y : estErr(m) ? m : estErr(d) ? d : Math.round((Date.UTC(y, m - 1, d) - EPOQUE) / 864e5); },
  ANNEE: (v) => { const x = aNum(v[0]); return estErr(x) ? x : dateDepuis(x).getUTCFullYear(); },
  MOIS: (v) => { const x = aNum(v[0]); return estErr(x) ? x : dateDepuis(x).getUTCMonth() + 1; },
  JOUR: (v) => { const x = aNum(v[0]); return estErr(x) ? x : dateDepuis(x).getUTCDate(); },
  'NB.SI': (v) => { if (!estRng(v[0])) return E('#VALEUR!'); const t = critere(v[1]); return v[0].rng.flat().filter(t).length; },
  'SOMME.SI': (v) => {
    if (!estRng(v[0])) return E('#VALEUR!');
    const t = critere(v[1]), src = v[0].rng.flat(), somme = (v[2] && estRng(v[2]) ? v[2] : v[0]).rng.flat();
    let s = 0;
    src.forEach((x, i) => { if (t(x) && typeof somme[i] === 'number') s += somme[i]; });
    return s;
  },
  'MOYENNE.SI': (v) => {
    if (!estRng(v[0])) return E('#VALEUR!');
    const t = critere(v[1]), src = v[0].rng.flat(), moy = (v[2] && estRng(v[2]) ? v[2] : v[0]).rng.flat();
    const a = [];
    src.forEach((x, i) => { if (t(x) && typeof moy[i] === 'number') a.push(moy[i]); });
    return a.length ? a.reduce((s, x) => s + x, 0) / a.length : E('#DIV/0!');
  },
  RANG: (v) => {
    const x = aNum(v[0]);
    if (estErr(x)) return x;
    const a = nombres([v[1]]);
    if (!Array.isArray(a)) return a;
    const croissant = v.length > 2 && aNum(v[2]) !== 0;
    if (!a.includes(x)) return E('#N/A');
    return 1 + a.filter((y) => (croissant ? y < x : y > x)).length;
  },
  RECHERCHEV: (v) => {
    if (!estRng(v[1])) return E('#VALEUR!');
    const col = aNum(v[2]);
    if (estErr(col)) return col;
    const exact = v.length > 3 && aBool(v[3]) === false;
    const t = v[1].rng;
    if (col < 1 || col > t[0].length) return E('#REF!');
    let trouve = -1;
    for (let i = 0; i < t.length; i++) {
      const k = t[i][0];
      if (exact) { if (k !== null && cmp(k, v[0]) === 0) { trouve = i; break; } } else if (k !== null && typeof k === typeof v[0] && cmp(k, v[0]) <= 0) trouve = i;
    }
    return trouve < 0 ? E('#N/A') : t[trouve][col - 1];
  },
  EQUIV: (v) => {
    if (!estRng(v[1])) return E('#VALEUR!');
    const liste = v[1].rng.flat();
    const exact = v.length > 2 && aNum(v[2]) === 0;
    let trouve = -1;
    for (let i = 0; i < liste.length; i++) {
      if (exact) { if (liste[i] !== null && cmp(liste[i], v[0]) === 0) { trouve = i; break; } } else if (liste[i] !== null && typeof liste[i] === typeof v[0] && cmp(liste[i], v[0]) <= 0) trouve = i;
    }
    return trouve < 0 ? E('#N/A') : trouve + 1;
  },
  INDEX: (v) => {
    if (!estRng(v[0])) return E('#VALEUR!');
    const r = aNum(v[1]), c = v.length > 2 ? aNum(v[2]) : 1, t = v[0].rng;
    if (estErr(r)) return r;
    if (estErr(c)) return c;
    const ligne = t.length === 1 && v.length === 2 ? 1 : r, colonne = t.length === 1 && v.length === 2 ? r : c;
    return t[ligne - 1] && t[ligne - 1][colonne - 1] !== undefined ? t[ligne - 1][colonne - 1] : E('#REF!');
  },
};

/* ---------- Réécriture des références (insertion, suppression, recopie) ---------- */
const RE_REFS = /("(?:[^"]|"")*")|(?<![\w!.À-ÿ'])(\$?[A-Za-z]{1,3}\$?\d+)(?::(\$?[A-Za-z]{1,3}\$?\d+))?(?![\w(À-ÿ])/g;
const decomposer = (r) => { const m = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/.exec(r); return { ac: m[1], c: colNum(m[2]), ar: m[3], r: +m[4] - 1 }; };
const composer = (o) => `${o.ac}${colNom(o.c)}${o.ar}${o.r + 1}`;

function reecrireRefs(formule, fn) {
  return formule.replace(RE_REFS, (m, chaine, a, b) => {
    if (chaine) return chaine;
    const res = fn(decomposer(a), b ? decomposer(b) : null);
    return res === null ? '#REF!' : res;
  });
}
function decalerRelatives(formule, dr, dc) {
  if (formule[0] !== '=') return formule;
  return reecrireRefs(formule, (a, b) => {
    const dep = (o) => ({ ...o, c: o.ac ? o.c : o.c + dc, r: o.ar ? o.r : o.r + dr });
    const x = dep(a), y = b ? dep(b) : null;
    if (x.r < 0 || x.c < 0 || (y && (y.r < 0 || y.c < 0))) return null;
    return composer(x) + (y ? ':' + composer(y) : '');
  });
}
function ajusterAxe(a, b, idx, delta) {
  if (delta > 0) return [a >= idx ? a + 1 : a, b >= idx ? b + 1 : b];
  if (a === b) return a === idx ? null : [a > idx ? a - 1 : a, a > idx ? a - 1 : a];
  const na = a > idx ? a - 1 : a, nb = b >= idx ? b - 1 : b;
  return na > nb ? null : [na, nb];
}
function decalerAxe(formule, axe, idx, delta) {
  if (formule[0] !== '=') return formule;
  return reecrireRefs(formule, (a, b) => {
    const k = axe === 'r' ? 'r' : 'c';
    const res = ajusterAxe(a[k], b ? b[k] : a[k], idx, delta);
    if (!res) return null;
    const x = { ...a, [k]: res[0] };
    if (!b) return composer(x);
    return composer(x) + ':' + composer({ ...b, [k]: res[1] });
  });
}
