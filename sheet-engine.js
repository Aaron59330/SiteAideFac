'use strict';
/* ============================================================
   Moteur de tableur : adresses, formules, fonctions, formats
   (aucune dépendance, pas de eval)
   ============================================================ */

const MAXL = 500, MAXC = 52;

const colNom = (c) => { let s = ''; c++; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };
const colNum = (s) => { let n = 0; for (const ch of s.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
const adr = (r, c) => colNom(c) + (r + 1);
function parseAdr(a) { const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(a); return m ? { c: colNum(m[1]), r: +m[2] - 1 } : null; }
function parsePlage(s) {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d+)(?::\$?([A-Za-z]{1,3})\$?(\d+))?$/.exec(String(s).trim());
  if (!m) return null;
  const a = { c: colNum(m[1]), r: +m[2] - 1 }, b = m[3] ? { c: colNum(m[3]), r: +m[4] - 1 } : a;
  return { r1: Math.min(a.r, b.r), c1: Math.min(a.c, b.c), r2: Math.max(a.r, b.r), c2: Math.max(a.c, b.c) };
}
const textePlage = (R) => (R.r1 === R.r2 && R.c1 === R.c2 ? adr(R.r1, R.c1) : adr(R.r1, R.c1) + ':' + adr(R.r2, R.c2));

/* ---------- Valeurs ---------- */
const E = (e) => ({ err: e });
const estErr = (v) => v !== null && typeof v === 'object' && 'err' in v;
const estRng = (v) => v !== null && typeof v === 'object' && 'rng' in v;

const EPOQUE = Date.UTC(1899, 11, 30);
const serialDate = (y, m, d) => Math.round((Date.UTC(y, m - 1, d) - EPOQUE) / 864e5);
const dateDepuis = (n) => new Date(EPOQUE + Math.round(n * 864e5));
const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const fmtSerie = (n) => `${String(dateDepuis(n).getUTCDate()).padStart(2, '0')}/${String(dateDepuis(n).getUTCMonth() + 1).padStart(2, '0')}/${dateDepuis(n).getUTCFullYear()}`;

const RE_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
const RE_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const RE_HEURE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
const RE_EURO = /^[-+]?\d+([.,]\d+)?\s?€$/;

function constante(raw) {
  if (raw === '' || raw == null) return null;
  const t = String(raw).trim();
  if (/^[-+]?\d+([.,]\d+)?([eE][+-]?\d+)?$/.test(t)) return parseFloat(t.replace(',', '.'));
  if (/^[-+]?\d+([.,]\d+)?\s?%$/.test(t)) return parseFloat(t.replace(',', '.')) / 100;
  if (RE_EURO.test(t)) return parseFloat(t.replace(',', '.'));
  let d = RE_DATE.exec(t);
  if (d) return serialDate(+d[3], +d[2], +d[1]) + (d[4] ? (+d[4] * 3600 + +d[5] * 60 + +(d[6] || 0)) / 86400 : 0);
  d = RE_ISO.exec(t);
  if (d) return serialDate(+d[1], +d[2], +d[3]);
  d = RE_HEURE.exec(t);
  if (d) return (+d[1] * 3600 + +d[2] * 60 + +(d[3] || 0)) / 86400;
  if (/^(VRAI|TRUE)$/i.test(t)) return true;
  if (/^(FAUX|FALSE)$/i.test(t)) return false;
  return String(raw);
}
/* Format automatique déduit de la saisie (date, heure, euro) */
function formatAuto(raw) {
  const t = String(raw).trim();
  const d = RE_DATE.exec(t);
  if (d) return d[4] ? { fmt: 'code', code: 'dd/mm/yyyy hh:mm' } : { fmt: 'date' };
  if (RE_ISO.test(t)) return { fmt: 'date' };
  if (RE_HEURE.test(t)) return { fmt: 'heure' };
  if (RE_EURO.test(t)) return { fmt: 'eur' };
  const pc = /^[-+]?\d+(?:[.,](\d+))?\s?%$/.exec(t);
  if (pc) return { fmt: 'pct', dec: pc[1] ? pc[1].length : 0 };
  return null;
}

function fmtNombre(n) {
  if (!isFinite(n)) return n > 0 ? '#DIV/0!' : '#NUM!';
  if (Number.isInteger(n)) return String(n);
  return String(parseFloat(n.toPrecision(12))).replace('.', ',');
}
function texte(v) {
  if (v === null || v === undefined) return '';
  if (estErr(v)) return v.err;
  if (estRng(v)) return v.rng.length && v.rng[0].length ? texte(v.rng[0][0]) : '';
  if (typeof v === 'boolean') return v ? 'VRAI' : 'FAUX';
  if (typeof v === 'number') return fmtNombre(v);
  if (typeof v === 'object') return '';
  return String(v);
}
function aNum(v) {
  if (estErr(v)) return v;
  if (estRng(v)) return v.rng.length === 1 && v.rng[0].length === 1 ? aNum(v.rng[0][0]) : E('#VALEUR!');
  if (v === null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'object') return E('#VALEUR!');
  const c = constante(v);
  return typeof c === 'number' ? c : E('#VALEUR!');
}
function aBool(v) {
  if (estErr(v)) return v;
  if (estRng(v)) return v.rng.length === 1 && v.rng[0].length === 1 ? aBool(v.rng[0][0]) : E('#VALEUR!');
  if (v === null) return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'object') return E('#VALEUR!');
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
const hauteur = (v) => v.rng.length;
const largeurRng = (v) => (v.rng[0] ? v.rng[0].length : 0);
const matrice = (v) => (estRng(v) ? v.rng : [[v]]);

/* ---------- Formats de nombre (codes à la Excel) ---------- */
const NBSP = ' ';
function grouper(s) { return s.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP); }

function decouperSections(code) {
  const out = [];
  let cur = '', q = false;
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (ch === '"') q = !q;
    if (ch === ';' && !q) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out;
}
const EST_DATE = /(^|[^\\"])(yy|aa|mm|dd|jj|hh|ss|[dyjhs]|AM\/PM)/i;
function squelette(sec) { return sec.replace(/"[^"]*"/g, '').replace(/\\./g, '').replace(/\[[^\]]*\]/g, ''); }

function formaterDate(x, sec) {
  const jours = Math.floor(x), frac = x - jours;
  const d = dateDepuis(jours);
  let secs = Math.round(frac * 86400);
  const hh = Math.floor(secs / 3600) % 24, mi = Math.floor(secs / 60) % 60, ss = secs % 60;
  const tokens = [];
  const re = /"([^"]*)"|\\(.)|\[[^\]]*\]|(yyyy|aaaa|yy|aa|mmmm|mmm|mm|m|dddd|jjjj|ddd|jjj|dd|jj|d|j|hh|h|ss|s|AM\/PM|A\/P)|([\s\S])/gi;
  let m;
  while ((m = re.exec(sec))) {
    if (m[1] !== undefined) tokens.push({ lit: m[1] });
    else if (m[2] !== undefined) tokens.push({ lit: m[2] });
    else if (m[3]) tokens.push({ tok: m[3].toLowerCase() });
    else if (m[4] !== undefined && !/^\[/.test(m[0])) tokens.push({ lit: m[4] });
  }
  const ampm = tokens.some((t) => t.tok === 'am/pm' || t.tok === 'a/p');
  tokens.forEach((t, i) => {
    if (t.tok === 'm' || t.tok === 'mm') {
      const prev = tokens.slice(0, i).reverse().find((x) => x.tok), next = tokens.slice(i + 1).find((x) => x.tok);
      if ((prev && /^h/.test(prev.tok)) || (next && /^s/.test(next.tok))) t.minute = true;
    }
  });
  return tokens.map((t) => {
    if (t.lit !== undefined) return t.lit;
    const k = t.tok;
    if (t.minute) return k === 'mm' ? String(mi).padStart(2, '0') : String(mi);
    switch (k) {
      case 'yyyy': case 'aaaa': return String(d.getUTCFullYear());
      case 'yy': case 'aa': return String(d.getUTCFullYear()).slice(-2);
      case 'mmmm': return MOIS_FR[d.getUTCMonth()];
      case 'mmm': return MOIS_FR[d.getUTCMonth()].slice(0, 4).replace(/\.?$/, '.');
      case 'mm': return String(d.getUTCMonth() + 1).padStart(2, '0');
      case 'm': return String(d.getUTCMonth() + 1);
      case 'dddd': case 'jjjj': return JOURS_FR[d.getUTCDay()];
      case 'ddd': case 'jjj': return JOURS_FR[d.getUTCDay()].slice(0, 3) + '.';
      case 'dd': case 'jj': return String(d.getUTCDate()).padStart(2, '0');
      case 'd': case 'j': return String(d.getUTCDate());
      case 'hh': return String(ampm ? hh % 12 || 12 : hh).padStart(2, '0');
      case 'h': return String(ampm ? hh % 12 || 12 : hh);
      case 'ss': return String(ss).padStart(2, '0');
      case 's': return String(ss);
      case 'am/pm': return hh < 12 ? 'AM' : 'PM';
      case 'a/p': return hh < 12 ? 'A' : 'P';
      default: return '';
    }
  }).join('');
}

function formaterNombreMasque(x, sec) {
  let s = sec, pct = false;
  const lits = [];
  s = s.replace(/"([^"]*)"|\\(.)|\[[^\]]*\]|_.|\*./g, (m, a, b) => {
    if (a !== undefined) { lits.push(a); return '\u0001' + (lits.length - 1) + '\u0002'; }
    if (b !== undefined) { lits.push(b); return '\u0001' + (lits.length - 1) + '\u0002'; }
    if (m[0] === '_') { lits.push(' '); return '\u0001' + (lits.length - 1) + '\u0002'; }
    return '';
  });
  s = s.replace(/([#0?]) ([#0?]{3})(?![#0?])/g, '$1,$2');                  // « # ##0 » = séparateur de milliers
  if (!/\./.test(s) && /[#0?],(?:[#0?]{1,2}|[#0?]{4,})(?![#0?,])/.test(s)) s = s.replace(/([#0?]),([#0?]{1,2}|[#0?]{4,})(?![#0?,])/, '$1.$2'); // « 0,00 » = décimales
  if (/%/.test(s)) { pct = true; x *= 100; }
  const sci = /([0#?.,]+)E([+-])(0+)/i.exec(s);
  let corps;
  if (sci) {
    const mask = sci[1], dec = (mask.split('.')[1] || '').length;
    let exp = x === 0 ? 0 : Math.floor(Math.log10(Math.abs(x)));
    let mant = x / Math.pow(10, exp);
    if (+mant.toFixed(dec) >= 10) { mant /= 10; exp++; }
    corps = mant.toFixed(dec).replace('.', ',') + 'E' + (exp < 0 ? '-' : sci[2] === '+' ? '+' : '') + String(Math.abs(exp)).padStart(sci[3].length, '0');
    s = s.replace(sci[0], '\u0003');
  } else {
    const m = /[0#?][0#?,]*(?:\.[0#?]+)?|\.[0#?]+/.exec(s);
    if (!m) return s.replace(/\u0001(\d+)\u0002/g, (_, i) => lits[+i]).replace(/%/g, '%');
    const masque = m[0], [mi, md = ''] = masque.split('.');
    const trailing = (/,+$/.exec(mi) || [''])[0].length;
    let xv = x / Math.pow(1000, trailing);
    const intMask = mi.replace(/,+$/, ''), thousands = /,/.test(intMask), intDigits = intMask.replace(/,/g, '');
    const minInt = (intDigits.match(/0/g) || []).length;
    const dec = md.length, minDec = (md.match(/0/g) || []).length;
    let fixed = Math.abs(xv).toFixed(Math.min(dec, 15));
    let [ip, dp = ''] = fixed.split('.');
    while (dp.length > minDec && dp.endsWith('0')) dp = dp.slice(0, -1);
    ip = ip.replace(/^0+/, '');
    if (ip.length < minInt) ip = ip.padStart(minInt, '0');
    if (thousands) ip = grouper(ip);
    if (!ip && !minInt && !dp) ip = '';
    corps = ip + (dp ? ',' + dp : '');
    s = s.replace(m[0], '\u0003');
  }
  return s.replace('\u0003', corps).replace(/\u0001(\d+)\u0002/g, (_, i) => lits[+i]);
}

function formaterCode(val, code) {
  if (val === null) return '';
  if (typeof val === 'boolean') return val ? 'VRAI' : 'FAUX';
  const sections = decouperSections(code);
  if (typeof val === 'string') {
    const t = sections[3] || (sections.length > 1 && /@/.test(sections[sections.length - 1]) ? sections[sections.length - 1] : '@');
    return t.replace(/@/g, val).replace(/"([^"]*)"/g, '$1');
  }
  let sec = sections[0], x = val, signe = '';
  if (val < 0) { if (sections.length > 1) { sec = sections[1]; x = -val; } else { signe = '-'; x = -val; } } else if (val === 0 && sections.length > 2) sec = sections[2];
  const sq = squelette(sec);
  if (EST_DATE.test(sq) && !/[0#]/.test(sq.replace(/[yamdjhs]+/gi, ''))) return signe + formaterDate(x, sec);
  return signe + formaterNombreMasque(x, sec);
}

const CODES = { n: (d) => (d > 0 ? '#,##0.' + '0'.repeat(d) : '#,##0'), pct: (d) => (d > 0 ? '0.' + '0'.repeat(d) + '%' : '0%'), eur: (d) => (d > 0 ? '#,##0.' + '0'.repeat(d) + ' "€"' : '#,##0 "€"'), sci: () => '0.00E+00', date: () => 'dd/mm/yyyy', datel: () => 'dddd d mmmm yyyy', heure: () => 'hh:mm:ss' };

/* ---------- Analyse syntaxique ---------- */
const RE_IDENT = /^[A-Za-zÀ-ÿ_][\wÀ-ÿ.]*/;
const RE_REFRNG = /^(\$?[A-Za-z]{1,3}\$?\d+)(?::(\$?[A-Za-z]{1,3}\$?\d+))?(?![\wÀ-ÿ(])/;
const RE_COLS = /^(\$?[A-Za-z]{1,3}):(\$?[A-Za-z]{1,3})(?![\wÀ-ÿ(\d])/;
const RE_ROWS = /^(\$?\d+):(\$?\d+)(?![\wÀ-ÿ(.,])/;
const RE_SHEET = /^(?:'((?:[^']|'')+)'|([A-Za-zÀ-ÿ_][\wÀ-ÿ]*))!/;

function tokeniser(s, anglais = false) {
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
    let sheet = null, prefixe = '', body = rest;
    const ms = RE_SHEET.exec(rest);
    if (ms) { sheet = (ms[1] || ms[2]).replace(/''/g, "'"); prefixe = ms[0]; body = rest.slice(ms[0].length); }
    let m = !sheet ? RE_ROWS.exec(body) : RE_ROWS.exec(body);
    if (m) {
      t.push({ k: 'node', raw: prefixe + m[0], node: { t: 'range', sheet, r1: parseInt(m[1].replace('$', ''), 10) - 1, r2: parseInt(m[2].replace('$', ''), 10) - 1, c1: 0, c2: 0, colsAll: true } });
      i += prefixe.length + m[0].length; continue;
    }
    m = (anglais ? /^(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?/ : /^(?:\d+(?:[.,]\d+)?|\.\d+)(?:[eE][+-]?\d+)?/).exec(body);
    if (m && !sheet) { t.push({ k: 'num', v: parseFloat(m[0].replace(',', '.')) }); i += m[0].length; continue; }
    m = RE_COLS.exec(body);
    if (m) {
      t.push({ k: 'node', raw: prefixe + m[0], node: { t: 'range', sheet, c1: colNum(m[1].replace('$', '')), c2: colNum(m[2].replace('$', '')), r1: 0, r2: 0, rowsAll: true } });
      i += prefixe.length + m[0].length; continue;
    }
    const id = RE_IDENT.exec(body);
    if (!sheet && id && body[id[0].length] === '(') { t.push({ k: 'func', v: id[0] }); i += id[0].length; continue; }
    const mr = RE_REFRNG.exec(body);
    if (mr) {
      const a = parseAdr(mr[1]);
      const nd = mr[2] ? (() => { const b = parseAdr(mr[2]); return { t: 'range', sheet, r1: Math.min(a.r, b.r), c1: Math.min(a.c, b.c), r2: Math.max(a.r, b.r), c2: Math.max(a.c, b.c) }; })() : { t: 'ref', sheet, r: a.r, c: a.c };
      t.push({ k: 'node', node: nd, raw: prefixe + mr[0] });
      i += prefixe.length + mr[0].length;
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
      return { t: 'nom', v: t.v };
    }
    if (t.k === 'func') {
      attendre('(');
      const args = [];
      if (!estOp(')')) {
        for (;;) {
          if (peek() && peek().k === 'sep') args.push({ t: 'vide' });
          else if (estOp(')')) args.push({ t: 'vide' });
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
  if (cacheAst.size > 4000) cacheAst.clear();
  cacheAst.set(src, a);
  return a;
}

const XL_PREFIXE = { IFS: '_xlfn.IFS', SWITCH: '_xlfn.SWITCH', TEXTJOIN: '_xlfn.TEXTJOIN', CONCAT: '_xlfn.CONCAT', MAXIFS: '_xlfn.MAXIFS', MINIFS: '_xlfn.MINIFS', XLOOKUP: '_xlfn.XLOOKUP', SEQUENCE: '_xlfn.SEQUENCE', UNIQUE: '_xlfn.UNIQUE', SORT: '_xlfn._xlws.SORT', FILTER: '_xlfn._xlws.FILTER', IFNA: '_xlfn.IFNA', XOR: '_xlfn.XOR', 'STDEV.P': '_xlfn.STDEV.P', 'VAR.P': '_xlfn.VAR.P', 'NORM.DIST': '_xlfn.NORM.DIST', 'NORM.S.DIST': '_xlfn.NORM.S.DIST', 'BINOM.DIST': '_xlfn.BINOM.DIST', DAYS: '_xlfn.DAYS' };
/* Traduction des formules : 'xl' = syntaxe Excel anglaise, 'fr' = syntaxe française */
function traduireFormule(src, mode) {
  let toks;
  try { toks = tokeniser(src, mode === 'fr'); } catch (e) { return src; }
  let out = '';
  for (const t of toks) {
    if (t.k === 'num') out += mode === 'fr' ? String(t.v).replace('.', ',') : String(t.v);
    else if (t.k === 'str') out += '"' + t.v.replace(/"/g, '""') + '"';
    else if (t.k === 'node') out += t.raw;
    else if (t.k === 'func') {
      const u = t.v.toUpperCase().replace(/^_XLFN\.(_XLWS\.)?/, '');
      if (mode === 'xl') { const en = FR2EN[u] || (EN2FR[u] ? u : t.v); out += XL_PREFIXE[en] || en; } else out += EN2FR[u] || u;
    }
    else if (t.k === 'ident') out += /^(VRAI|TRUE)$/i.test(t.v) ? (mode === 'xl' ? 'TRUE' : 'VRAI') : /^(FAUX|FALSE)$/i.test(t.v) ? (mode === 'xl' ? 'FALSE' : 'FAUX') : t.v;
    else if (t.k === 'sep') out += mode === 'xl' ? ',' : ';';
    else out += t.v;
  }
  return out;
}

/* ---------- Évaluation ---------- */
function nouveauCtx(tab) { return { tab, memo: new Map(), pile: new Set(), spill: new Map(), anchors: new Map(), cur: null, ext: {} }; }

const RE_SPILLFN = /\b(SEQUENCE|TRANSPOSE|UNIQUE|TRIER|SORT|FILTRE|FILTER|DECALER|OFFSET)\s*\(/i;
function evaluerTout(ctx) {
  const feuilles = ctx.tab.feuilles;
  for (const pass of [1, 2]) {
    for (const f of feuilles) {
      for (const [a, cell] of Object.entries(f.cells)) {
        if (!cell.v || cell.v[0] !== '=') continue;
        if (pass === 1 && !RE_SPILLFN.test(cell.v)) continue;
        const p = parseAdr(a);
        valCell(ctx, f, p.r, p.c);
      }
    }
  }
}

function etaler(ctx, f, r, c, res) {
  const m = res.rng, h = m.length, w = m[0] ? m[0].length : 0;
  if (!h || !w) return E('#VALEUR!');
  if (h === 1 && w === 1) return m[0][0];
  if (r + h > MAXL || c + w > MAXC) return E('#SPILL!');
  for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) {
    if (!i && !j) continue;
    const cell = f.cells[adr(r + i, c + j)];
    if (cell && cell.v !== '') return E('#SPILL!');
  }
  for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) {
    if (!i && !j) continue;
    const k = f.id + ':' + (r + i) + ',' + (c + j);
    ctx.spill.set(k, m[i][j]);
    ctx.memo.delete(k);
  }
  ctx.anchors.set(f.id + ':' + r + ',' + c, { h, w });
  const e = ctx.ext[f.id] || (ctx.ext[f.id] = { r: 0, c: 0 });
  e.r = Math.max(e.r, r + h); e.c = Math.max(e.c, c + w);
  return m[0][0];
}

function valCell(ctx, f, r, c) {
  const k = f.id + ':' + r + ',' + c;
  if (ctx.memo.has(k)) return ctx.memo.get(k);
  const cell = f.cells[adr(r, c)];
  let res;
  if (!cell || cell.v === '') res = ctx.spill.has(k) ? ctx.spill.get(k) : null;
  else if (cell.v[0] === '=') {
    if (ctx.pile.has(k)) return E('#CYCLE!');
    ctx.pile.add(k);
    const prev = ctx.cur;
    ctx.cur = { f, r, c };
    res = evalNode(arbre(cell.v.slice(1)), ctx, f);
    ctx.cur = prev;
    ctx.pile.delete(k);
    if (estRng(res)) res = etaler(ctx, f, r, c, res);
  } else res = constante(cell.v);
  ctx.memo.set(k, res);
  return res;
}

function feuilleDe(ctx, f, nom) {
  if (!nom) return f;
  return ctx.tab.feuilles.find((x) => x.nom.toLowerCase() === nom.toLowerCase()) || null;
}

function plageNode(ctx, f, n) {
  const g = feuilleDe(ctx, f, n.sheet);
  if (!g) return null;
  const r1 = n.r1, c1 = n.c1;
  const r2 = n.rowsAll ? Math.max(r1, g.nbL - 1) : n.r2, c2 = n.colsAll ? Math.max(c1, g.nbC - 1) : n.c2;
  const rr1 = n.rowsAll ? 0 : r1, cc1 = n.colsAll ? 0 : c1;
  return { g, r1: rr1, c1: cc1, r2, c2 };
}

function evalNode(n, ctx, f) {
  switch (n.t) {
    case 'num': case 'str': case 'bool': return n.v;
    case 'vide': return null;
    case 'err': return E(n.v);
    case 'ref': { const g = feuilleDe(ctx, f, n.sheet); return g ? valCell(ctx, g, n.r, n.c) : E('#REF!'); }
    case 'range': {
      const P = plageNode(ctx, f, n);
      if (!P) return E('#REF!');
      const rng = [];
      for (let r = P.r1; r <= P.r2; r++) { const row = []; for (let c = P.c1; c <= P.c2; c++) row.push(valCell(ctx, P.g, r, c)); rng.push(row); }
      return { rng, f: P.g, r1: P.r1, c1: P.c1, r2: P.r2, c2: P.c2 };
    }
    case 'nom': {
      const d = (ctx.tab.noms || {})[n.v.toUpperCase()];
      if (!d) return E('#NOM?');
      const g = ctx.tab.feuilles.find((x) => x.id === d.f);
      if (!g) return E('#REF!');
      return d.r1 === d.r2 && d.c1 === d.c2 ? valCell(ctx, g, d.r1, d.c1) : evalNode({ t: 'range', r1: d.r1, c1: d.c1, r2: d.r2, c2: d.c2, sheet: g.nom }, ctx, f);
    }
    case 'un': { const v = evalNode(n.a, ctx, f); return mapRng(v, (x) => { const y = aNum(x); return estErr(y) ? y : -y; }); }
    case 'pct': { const v = evalNode(n.a, ctx, f); return mapRng(v, (x) => { const y = aNum(x); return estErr(y) ? y : y / 100; }); }
    case 'bin': return operation(n, ctx, f);
    case 'call': return appel(n, ctx, f);
    default: return E('#ERREUR!');
  }
}

function mapRng(v, fn) {
  if (!estRng(v)) return fn(v);
  return { rng: v.rng.map((row) => row.map(fn)) };
}
function elementwise(a, b, fn) {
  const A = matrice(a), B = matrice(b);
  const h = Math.max(A.length, B.length), w = Math.max(A[0].length, B[0].length);
  const get = (M, i, j) => { const r = M.length === 1 ? 0 : i, c = M[0].length === 1 ? 0 : j; return M[r] && M[r][c] !== undefined ? M[r][c] : E('#N/A'); };
  const rng = [];
  for (let i = 0; i < h; i++) { const row = []; for (let j = 0; j < w; j++) row.push(fn(get(A, i, j), get(B, i, j))); rng.push(row); }
  return { rng };
}
function opScalaire(op, a, b) {
  if (estErr(a)) return a;
  if (estErr(b)) return b;
  if (op === '&') return texte(a) + texte(b);
  if (['=', '<>', '<', '>', '<=', '>='].includes(op)) {
    const d = cmp(a, b);
    return { '=': d === 0, '<>': d !== 0, '<': d < 0, '>': d > 0, '<=': d <= 0, '>=': d >= 0 }[op];
  }
  const x = aNum(a), y = aNum(b);
  if (estErr(x)) return x;
  if (estErr(y)) return y;
  switch (op) {
    case '+': return x + y;
    case '-': return x - y;
    case '*': return x * y;
    case '/': return y === 0 ? E('#DIV/0!') : x / y;
    case '^': { const r = Math.pow(x, y); return isFinite(r) ? r : E('#NUM!'); }
    default: return E('#ERREUR!');
  }
}
function operation(n, ctx, f) {
  const a = evalNode(n.a, ctx, f), b = evalNode(n.b, ctx, f);
  if (estRng(a) || estRng(b)) return elementwise(a, b, (x, y) => opScalaire(n.op, x, y));
  return opScalaire(n.op, a, b);
}

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
const somme = (a) => a.reduce((s, x) => s + x, 0);

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

/* Critères multiples : retourne les indices (à plat) qui satisfont toutes les paires (plage; critère) */
function indicesEns(paires) {
  let ok = null;
  for (let i = 0; i < paires.length; i += 2) {
    const pl = paires[i], cr = paires[i + 1];
    if (!estRng(pl)) return E('#VALEUR!');
    const t = critere(cr), flat = pl.rng.flat();
    if (ok && ok.length !== flat.length) return E('#VALEUR!');
    ok = flat.map((x, j) => t(x) && (!ok || ok[j]));
  }
  return ok;
}

function refArg(n, ctx, f) {
  if (!n) return null;
  if (n.t === 'ref') { const g = feuilleDe(ctx, f, n.sheet); return g ? { g, r1: n.r, c1: n.c, r2: n.r, c2: n.c } : null; }
  if (n.t === 'range') return plageNode(ctx, f, n);
  if (n.t === 'nom') { const d = (ctx.tab.noms || {})[n.v.toUpperCase()]; if (!d) return null; return { g: ctx.tab.feuilles.find((x) => x.id === d.f), r1: d.r1, c1: d.c1, r2: d.r2, c2: d.c2 }; }
  return null;
}

function appel(n, ctx, f) {
  const up = n.name.toUpperCase();
  const nom = EN2FR[up] || up;
  const arg = (i) => evalNode(n.args[i], ctx, f);
  const nargs = n.args.length;
  switch (nom) {
    case 'SI': {
      const c = arg(0);
      if (estRng(c)) {
        const a = nargs > 1 ? arg(1) : true, b = nargs > 2 ? arg(2) : false;
        return elementwise(elementwise(c, a, (x, y) => [x, y]), b, (xy, z) => { if (estErr(xy[0])) return xy[0]; const t = aBool(xy[0]); return estErr(t) ? t : t ? xy[1] : z; });
      }
      const t = aBool(c);
      if (estErr(t)) return t;
      if (t) return nargs > 1 ? arg(1) : true;
      return nargs > 2 ? arg(2) : false;
    }
    case 'SIERREUR': { const v = arg(0); return estErr(v) ? arg(1) : v; }
    case 'SI.NON.DISP': { const v = arg(0); return estErr(v) && v.err === '#N/A' ? arg(1) : v; }
    case 'SI.CONDITIONS': {
      for (let i = 0; i + 1 < nargs; i += 2) { const t = aBool(arg(i)); if (estErr(t)) return t; if (t) return arg(i + 1); }
      return E('#N/A');
    }
    case 'SI.MULTIPLE': {
      const x = arg(0);
      if (estErr(x)) return x;
      for (let i = 1; i + 1 < nargs; i += 2) if (cmp(x, arg(i)) === 0) return arg(i + 1);
      return nargs % 2 === 0 ? arg(nargs - 1) : E('#N/A');
    }
    case 'CHOISIR': { const k = aNum(arg(0)); if (estErr(k)) return k; return k >= 1 && k < nargs ? arg(Math.floor(k)) : E('#VALEUR!'); }
    case 'LIGNE': { const R = refArg(n.args[0], ctx, f); return R ? R.r1 + 1 : ctx.cur ? ctx.cur.r + 1 : E('#VALEUR!'); }
    case 'COLONNE': { const R = refArg(n.args[0], ctx, f); return R ? R.c1 + 1 : ctx.cur ? ctx.cur.c + 1 : E('#VALEUR!'); }
    case 'LIGNES': { const R = refArg(n.args[0], ctx, f); if (R) return R.r2 - R.r1 + 1; const v = arg(0); return estRng(v) ? hauteur(v) : 1; }
    case 'COLONNES': { const R = refArg(n.args[0], ctx, f); if (R) return R.c2 - R.c1 + 1; const v = arg(0); return estRng(v) ? largeurRng(v) : 1; }
    case 'DECALER': {
      const R = refArg(n.args[0], ctx, f);
      if (!R) return E('#REF!');
      const dl = aNum(arg(1)), dc = aNum(arg(2));
      if (estErr(dl)) return dl;
      if (estErr(dc)) return dc;
      const h = nargs > 3 && n.args[3].t !== 'vide' ? aNum(arg(3)) : R.r2 - R.r1 + 1, w = nargs > 4 && n.args[4].t !== 'vide' ? aNum(arg(4)) : R.c2 - R.c1 + 1;
      const r1 = R.r1 + dl, c1 = R.c1 + dc;
      if (r1 < 0 || c1 < 0 || h < 1 || w < 1) return E('#REF!');
      const rng = [];
      for (let r = r1; r < r1 + h; r++) { const row = []; for (let c = c1; c < c1 + w; c++) row.push(valCell(ctx, R.g, r, c)); rng.push(row); }
      return { rng, f: R.g, r1, c1, r2: r1 + h - 1, c2: c1 + w - 1 };
    }
    case 'INDIRECT': {
      const t = texte(arg(0)).trim();
      try {
        const toks = tokeniser(t);
        if (toks.length === 1 && toks[0].k === 'node') return evalNode(toks[0].node, ctx, f);
        if (toks.length === 1 && toks[0].k === 'ident') return evalNode({ t: 'nom', v: toks[0].v }, ctx, f);
      } catch (e) { /* tombe sur #REF! */ }
      return E('#REF!');
    }
    default:
  }
  const fn = FN[nom];
  if (!fn) return E('#NOM?');
  const vals = n.args.map((_, i) => arg(i));
  let res;
  try { res = fn(vals, ctx, f); } catch (e) { return E('#VALEUR!'); }
  if (typeof res === 'number' && !isFinite(res)) return isNaN(res) ? E('#NUM!') : E('#DIV/0!');
  return res;
}

/* ---------- Fonctions ---------- */
const m1 = (g) => (v) => { const x = aNum(v[0]); if (estErr(x)) return x; const r = g(x); return typeof r === 'number' && !isFinite(r) ? E('#NUM!') : r; };
const m2 = (g) => (v) => { const x = aNum(v[0]), y = aNum(v[1]); if (estErr(x)) return x; if (estErr(y)) return y; const r = g(x, y); return typeof r === 'number' && !isFinite(r) ? E('#NUM!') : r; };
const optNum = (v, i, d) => (v.length > i && v[i] !== null ? aNum(v[i]) : d);
const agg = (g) => (v) => { const a = nombres(v); return Array.isArray(a) ? g(a) : a; };
const arrondir = (mode) => (v) => {
  const x = aNum(v[0]), d = optNum(v, 1, 0);
  if (estErr(x)) return x;
  if (estErr(d)) return d;
  const k = 10 ** d, y = Math.abs(x) * k;
  const r = mode === 'sup' ? Math.ceil(y - 1e-9) : mode === 'inf' ? Math.floor(y + 1e-9) : Math.round(y + 1e-9);
  return Math.sign(x) * r / k;
};
const centile = (a, k) => { const s = [...a].sort((x, y) => x - y), pos = (s.length - 1) * k, i = Math.floor(pos); return i + 1 < s.length ? s[i] + (pos - i) * (s[i + 1] - s[i]) : s[i]; };
function paires(v1, v2) {
  const a = aplatir([v1]), b = aplatir([v2]), X = [], Y = [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (typeof a[i] === 'number' && typeof b[i] === 'number') { X.push(a[i]); Y.push(b[i]); }
  return [X, Y];
}
function regression(v) {
  const [Y, X] = paires(v[0], v[1]);
  const n = X.length;
  if (n < 2) return E('#DIV/0!');
  const mx = somme(X) / n, my = somme(Y) / n;
  const sxy = somme(X.map((x, i) => (x - mx) * (Y[i] - my))), sxx = somme(X.map((x) => (x - mx) ** 2)), syy = somme(Y.map((y) => (y - my) ** 2));
  if (!sxx) return E('#DIV/0!');
  return { pente: sxy / sxx, ord: my - (sxy / sxx) * mx, r: sxy / Math.sqrt(sxx * syy), n };
}
const erf = (x) => { const t = 1 / (1 + 0.5 * Math.abs(x)); const y = 1 - t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? y : -y; };
const cdfNormale = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
const fact = (n) => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
const combin = (n, k) => { if (k < 0 || k > n) return 0; k = Math.min(k, n - k); let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); };
const pgcd = (a, b) => (b ? pgcd(b, a % b) : Math.abs(a));
function pmt(taux, n, va, vc, type) { return taux === 0 ? -(va + vc) / n : -(taux * (va * (1 + taux) ** n + vc)) / ((1 + taux * type) * ((1 + taux) ** n - 1)); }
function fvf(taux, n, p, va, type) { return taux === 0 ? -(va + p * n) : -(va * (1 + taux) ** n + p * (1 + taux * type) * ((1 + taux) ** n - 1) / taux); }
const dateNum = (v) => { const x = aNum(v); return estErr(x) ? x : Math.floor(x); };
function lecture(v, i, def) { return v.length > i && v[i] !== null ? v[i] : def; }

function rechercheTable(v, horizontal) {
  if (!estRng(v[1])) return E('#VALEUR!');
  const idx = aNum(v[2]);
  if (estErr(idx)) return idx;
  const exact = v.length > 3 && aBool(v[3]) === false;
  const t = horizontal ? v[1].rng[0].map((_, j) => v[1].rng.map((row) => row[j])) : v[1].rng;
  if (idx < 1 || idx > t[0].length) return E('#REF!');
  let trouve = -1;
  for (let i = 0; i < t.length; i++) {
    const k = t[i][0];
    if (exact) { if (k !== null && cmp(k, v[0]) === 0) { trouve = i; break; } } else if (k !== null && typeof k === typeof v[0] && cmp(k, v[0]) <= 0) trouve = i;
  }
  return trouve < 0 ? E('#N/A') : t[trouve][idx - 1];
}

const FN = {
  SOMME: agg((a) => somme(a)),
  MOYENNE: agg((a) => (a.length ? somme(a) / a.length : E('#DIV/0!'))),
  MIN: agg((a) => (a.length ? Math.min(...a) : 0)),
  MAX: agg((a) => (a.length ? Math.max(...a) : 0)),
  NB: agg((a) => a.length),
  NBVAL: (v) => aplatir(v).filter((x) => x !== null && x !== '').length,
  'NB.VIDE': (v) => aplatir(v).filter((x) => x === null || x === '').length,
  PRODUIT: agg((a) => a.reduce((s, x) => s * x, 1)),
  'SOMME.CARRES': agg((a) => somme(a.map((x) => x * x))),
  MEDIANE: agg((a) => { if (!a.length) return E('#NUM!'); const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }),
  MODE: agg((a) => { const c = new Map(); a.forEach((x) => c.set(x, (c.get(x) || 0) + 1)); let best = null, bn = 1; for (const [k, n] of c) if (n > bn) { best = k; bn = n; } return best === null ? E('#N/A') : best; }),
  ECARTYPE: agg((a) => { if (a.length < 2) return E('#DIV/0!'); const m = somme(a) / a.length; return Math.sqrt(somme(a.map((x) => (x - m) ** 2)) / (a.length - 1)); }),
  'ECARTYPE.PEARSON': agg((a) => { if (!a.length) return E('#DIV/0!'); const m = somme(a) / a.length; return Math.sqrt(somme(a.map((x) => (x - m) ** 2)) / a.length); }),
  VAR: agg((a) => { if (a.length < 2) return E('#DIV/0!'); const m = somme(a) / a.length; return somme(a.map((x) => (x - m) ** 2)) / (a.length - 1); }),
  'VAR.P': agg((a) => { if (!a.length) return E('#DIV/0!'); const m = somme(a) / a.length; return somme(a.map((x) => (x - m) ** 2)) / a.length; }),
  'MOYENNE.GEOMETRIQUE': agg((a) => (a.length && a.every((x) => x > 0) ? Math.exp(somme(a.map(Math.log)) / a.length) : E('#NUM!'))),
  QUARTILE: (v) => { const a = nombres([v[0]]), q = aNum(v[1]); if (!Array.isArray(a)) return a; if (estErr(q)) return q; return a.length && q >= 0 && q <= 4 ? centile(a, Math.floor(q) / 4) : E('#NUM!'); },
  CENTILE: (v) => { const a = nombres([v[0]]), k = aNum(v[1]); if (!Array.isArray(a)) return a; if (estErr(k)) return k; return a.length && k >= 0 && k <= 1 ? centile(a, k) : E('#NUM!'); },
  'GRANDE.VALEUR': (v) => { const a = nombres([v[0]]), k = aNum(v[1]); if (!Array.isArray(a)) return a; if (estErr(k)) return k; return [...a].sort((x, y) => y - x)[k - 1] ?? E('#NUM!'); },
  'PETITE.VALEUR': (v) => { const a = nombres([v[0]]), k = aNum(v[1]); if (!Array.isArray(a)) return a; if (estErr(k)) return k; return [...a].sort((x, y) => x - y)[k - 1] ?? E('#NUM!'); },
  RANG: (v) => {
    const x = aNum(v[0]);
    if (estErr(x)) return x;
    const a = nombres([v[1]]);
    if (!Array.isArray(a)) return a;
    const croissant = v.length > 2 && aNum(v[2]) !== 0;
    if (!a.includes(x)) return E('#N/A');
    return 1 + a.filter((y) => (croissant ? y < x : y > x)).length;
  },
  CORREL: (v) => { const r = regression(v); return estErr(r) ? r : r.r; },
  PENTE: (v) => { const r = regression(v); return estErr(r) ? r : r.pente; },
  'ORDONNEE.ORIGINE': (v) => { const r = regression(v); return estErr(r) ? r : r.ord; },
  'COEFFICIENT.DETERMINATION': (v) => { const r = regression(v); return estErr(r) ? r : r.r * r.r; },
  PREVISION: (v) => { const x = aNum(v[0]); if (estErr(x)) return x; const r = regression([v[1], v[2]]); return estErr(r) ? r : r.ord + r.pente * x; },
  'LOI.NORMALE.N': (v) => { const x = aNum(v[0]), mu = aNum(v[1]), sg = aNum(v[2]); if (estErr(x)) return x; if (sg <= 0) return E('#NUM!'); const z = (x - mu) / sg; return v.length > 3 && aBool(v[3]) ? cdfNormale(z) : Math.exp(-z * z / 2) / (sg * Math.sqrt(2 * Math.PI)); },
  'LOI.NORMALE.STANDARD.N': (v) => { const z = aNum(v[0]); if (estErr(z)) return z; return v.length > 1 && aBool(v[1]) ? cdfNormale(z) : Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI); },
  'LOI.BINOMIALE.N': (v) => {
    const k = Math.floor(aNum(v[0])), n = Math.floor(aNum(v[1])), p = aNum(v[2]);
    if ([k, n, p].some(estErr) || k < 0 || k > n || p < 0 || p > 1) return E('#NUM!');
    const pm = (j) => combin(n, j) * p ** j * (1 - p) ** (n - j);
    if (v.length > 3 && aBool(v[3])) { let s = 0; for (let j = 0; j <= k; j++) s += pm(j); return s; }
    return pm(k);
  },
  SOMMEPROD: (v) => {
    if (!v.every((x) => estRng(x) || typeof x === 'number')) return E('#VALEUR!');
    const M = v.map(matrice), h = M[0].length, w = M[0][0].length;
    if (M.some((x) => x.length !== h || x[0].length !== w)) return E('#VALEUR!');
    let s = 0;
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) { let p = 1; for (const x of M) { const e = x[r][c]; if (estErr(e)) return e; p *= typeof e === 'number' ? e : typeof e === 'boolean' ? +e : 0; } s += p; }
    return s;
  },
  'SOMME.SI': (v) => {
    if (!estRng(v[0])) return E('#VALEUR!');
    const t = critere(v[1]), src = v[0].rng.flat(), sm = (v[2] && estRng(v[2]) ? v[2] : v[0]).rng.flat();
    let s = 0;
    src.forEach((x, i) => { if (t(x) && typeof sm[i] === 'number') s += sm[i]; });
    return s;
  },
  'NB.SI': (v) => { if (!estRng(v[0])) return E('#VALEUR!'); const t = critere(v[1]); return v[0].rng.flat().filter(t).length; },
  'MOYENNE.SI': (v) => {
    if (!estRng(v[0])) return E('#VALEUR!');
    const t = critere(v[1]), src = v[0].rng.flat(), moy = (v[2] && estRng(v[2]) ? v[2] : v[0]).rng.flat(), a = [];
    src.forEach((x, i) => { if (t(x) && typeof moy[i] === 'number') a.push(moy[i]); });
    return a.length ? somme(a) / a.length : E('#DIV/0!');
  },
  'SOMME.SI.ENS': (v) => { const ok = indicesEns(v.slice(1)); if (estErr(ok)) return ok; if (!estRng(v[0])) return E('#VALEUR!'); return somme(v[0].rng.flat().filter((x, i) => ok[i] && typeof x === 'number')); },
  'NB.SI.ENS': (v) => { const ok = indicesEns(v); return estErr(ok) ? ok : ok.filter(Boolean).length; },
  'MOYENNE.SI.ENS': (v) => { const ok = indicesEns(v.slice(1)); if (estErr(ok)) return ok; const a = v[0].rng.flat().filter((x, i) => ok[i] && typeof x === 'number'); return a.length ? somme(a) / a.length : E('#DIV/0!'); },
  'MIN.SI.ENS': (v) => { const ok = indicesEns(v.slice(1)); if (estErr(ok)) return ok; const a = v[0].rng.flat().filter((x, i) => ok[i] && typeof x === 'number'); return a.length ? Math.min(...a) : 0; },
  'MAX.SI.ENS': (v) => { const ok = indicesEns(v.slice(1)); if (estErr(ok)) return ok; const a = v[0].rng.flat().filter((x, i) => ok[i] && typeof x === 'number'); return a.length ? Math.max(...a) : 0; },
  ABS: m1(Math.abs), ENT: m1(Math.floor), RACINE: m1((x) => (x < 0 ? E('#NUM!') : Math.sqrt(x))), EXP: m1(Math.exp),
  LN: m1((x) => (x > 0 ? Math.log(x) : E('#NUM!'))), LOG10: m1((x) => (x > 0 ? Math.log10(x) : E('#NUM!'))),
  LOG: (v) => { const x = aNum(v[0]), b = optNum(v, 1, 10); if (estErr(x)) return x; if (estErr(b)) return b; return x > 0 && b > 0 && b !== 1 ? Math.log(x) / Math.log(b) : E('#NUM!'); },
  SIGNE: m1(Math.sign), PI: () => Math.PI, FACT: m1((x) => (x >= 0 && x <= 170 ? fact(Math.floor(x)) : E('#NUM!'))),
  SIN: m1(Math.sin), COS: m1(Math.cos), TAN: m1(Math.tan), ASIN: m1((x) => (Math.abs(x) <= 1 ? Math.asin(x) : E('#NUM!'))), ACOS: m1((x) => (Math.abs(x) <= 1 ? Math.acos(x) : E('#NUM!'))), ATAN: m1(Math.atan),
  ATAN2: m2((x, y) => Math.atan2(y, x)), DEGRES: m1((x) => x * 180 / Math.PI), RADIANS: m1((x) => x * Math.PI / 180),
  PUISSANCE: m2((x, y) => Math.pow(x, y)),
  MOD: m2((x, y) => (y === 0 ? E('#DIV/0!') : x - y * Math.floor(x / y))),
  QUOTIENT: m2((x, y) => (y === 0 ? E('#DIV/0!') : Math.trunc(x / y))),
  COMBIN: m2((n, k) => (n >= 0 && k >= 0 && k <= n ? combin(Math.floor(n), Math.floor(k)) : E('#NUM!'))),
  PERMUT: m2((n, k) => (n >= 0 && k >= 0 && k <= n ? fact(Math.floor(n)) / fact(Math.floor(n - k)) : E('#NUM!'))),
  PGCD: agg((a) => a.map(Math.abs).reduce(pgcd, 0)),
  PPCM: agg((a) => a.map(Math.abs).reduce((x, y) => (x && y ? x / pgcd(x, y) * y : 0), 1)),
  TRONQUE: (v) => { const x = aNum(v[0]), d = optNum(v, 1, 0); if (estErr(x)) return x; const k = 10 ** d; return Math.trunc(x * k) / k; },
  PLAFOND: m2((x, m) => (m === 0 ? 0 : Math.ceil(x / m - 1e-9) * m)),
  PLANCHER: m2((x, m) => (m === 0 ? 0 : Math.floor(x / m + 1e-9) * m)),
  ARRONDI: arrondir('std'), 'ARRONDI.SUP': arrondir('sup'), 'ARRONDI.INF': arrondir('inf'),
  ALEA: () => Math.random(),
  'ALEA.ENTRE.BORNES': (v) => { const a = aNum(v[0]), b = aNum(v[1]); return estErr(a) ? a : estErr(b) ? b : a + Math.floor(Math.random() * (b - a + 1)); },
  SEQUENCE: (v) => {
    const h = optNum(v, 0, 1), w = optNum(v, 1, 1), d = optNum(v, 2, 1), p = optNum(v, 3, 1);
    if ([h, w, d, p].some(estErr)) return E('#VALEUR!');
    if (h < 1 || w < 1 || h * w > 5000) return E('#VALEUR!');
    const rng = [];
    for (let i = 0; i < h; i++) { const row = []; for (let j = 0; j < w; j++) row.push(d + (i * w + j) * p); rng.push(row); }
    return { rng };
  },
  ET: (v) => { for (const x of aplatir(v)) { if (x === null) continue; const b = aBool(x); if (estErr(b)) return b; if (!b) return false; } return true; },
  OU: (v) => { for (const x of aplatir(v)) { if (x === null) continue; const b = aBool(x); if (estErr(b)) return b; if (b) return true; } return false; },
  OUX: (v) => { let n = 0; for (const x of aplatir(v)) { if (x === null) continue; const b = aBool(x); if (estErr(b)) return b; if (b) n++; } return n % 2 === 1; },
  NON: (v) => mapRng(v[0], (x) => { const b = aBool(x); return estErr(b) ? b : !b; }),
  VRAI: () => true, FAUX: () => false,
  ESTVIDE: (v) => mapRng(v[0], (x) => x === null), ESTNUM: (v) => mapRng(v[0], (x) => typeof x === 'number'),
  ESTTEXTE: (v) => mapRng(v[0], (x) => typeof x === 'string'), ESTLOGIQUE: (v) => mapRng(v[0], (x) => typeof x === 'boolean'),
  ESTERREUR: (v) => mapRng(v[0], (x) => estErr(x)), ESTNA: (v) => mapRng(v[0], (x) => estErr(x) && x.err === '#N/A'),
  ESTPAIR: (v) => { const x = aNum(v[0]); return estErr(x) ? x : Math.floor(x) % 2 === 0; },
  ESTIMPAIR: (v) => { const x = aNum(v[0]); return estErr(x) ? x : Math.abs(Math.floor(x) % 2) === 1; },
  N: (v) => (typeof v[0] === 'number' ? v[0] : typeof v[0] === 'boolean' ? +v[0] : estErr(v[0]) ? v[0] : 0),
  NA: () => E('#N/A'),
  CONCATENER: (v) => aplatir(v).map(texte).join(''),
  CONCAT: (v) => aplatir(v).map(texte).join(''),
  'JOINDRE.TEXTE': (v) => { const sep = texte(v[0]), ign = aBool(v[1]); return aplatir(v.slice(2)).filter((x) => !(ign === true && (x === null || x === ''))).map(texte).join(sep); },
  GAUCHE: (v) => { const n = optNum(v, 1, 1); return estErr(n) ? n : n < 0 ? E('#VALEUR!') : texte(v[0]).slice(0, n); },
  DROITE: (v) => { const n = optNum(v, 1, 1); return estErr(n) ? n : n < 0 ? E('#VALEUR!') : n === 0 ? '' : texte(v[0]).slice(-n); },
  STXT: (v) => { const d = aNum(v[1]), n = aNum(v[2]); return estErr(d) ? d : estErr(n) ? n : d < 1 || n < 0 ? E('#VALEUR!') : texte(v[0]).substr(d - 1, n); },
  NBCAR: (v) => mapRng(v[0], (x) => texte(x).length),
  MAJUSCULE: (v) => mapRng(v[0], (x) => texte(x).toUpperCase()), MINUSCULE: (v) => mapRng(v[0], (x) => texte(x).toLowerCase()),
  NOMPROPRE: (v) => texte(v[0]).toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()),
  SUPPRESPACE: (v) => mapRng(v[0], (x) => texte(x).trim().replace(/\s+/g, ' ')),
  EPURAGE: (v) => texte(v[0]).replace(/[\u0000-\u001f]/g, ''),
  TROUVE: (v) => { const d = optNum(v, 2, 1), i = texte(v[1]).indexOf(texte(v[0]), d - 1); return i < 0 ? E('#VALEUR!') : i + 1; },
  CHERCHE: (v) => { const d = optNum(v, 2, 1), i = texte(v[1]).toLowerCase().indexOf(texte(v[0]).toLowerCase(), d - 1); return i < 0 ? E('#VALEUR!') : i + 1; },
  SUBSTITUE: (v) => {
    const t = texte(v[0]), a = texte(v[1]), b = texte(v[2]);
    if (!a) return t;
    if (v.length > 3 && v[3] !== null) { let k = aNum(v[3]), pos = -1; while (k-- > 0) { pos = t.indexOf(a, pos + 1); if (pos < 0) return t; } return t.slice(0, pos) + b + t.slice(pos + a.length); }
    return t.split(a).join(b);
  },
  REMPLACER: (v) => { const t = texte(v[0]), d = aNum(v[1]), n = aNum(v[2]); return estErr(d) ? d : estErr(n) ? n : t.slice(0, d - 1) + texte(v[3]) + t.slice(d - 1 + n); },
  REPT: (v) => { const n = aNum(v[1]); return estErr(n) ? n : n < 0 || n > 5000 ? E('#VALEUR!') : texte(v[0]).repeat(n); },
  EXACT: (v) => texte(v[0]) === texte(v[1]),
  TEXTE: (v) => { const x = v[0]; return estErr(x) ? x : formaterCode(typeof x === 'number' || typeof x === 'boolean' || x === null ? x : constante(x), texte(v[1])); },
  VALEUR: (v) => { const x = v[0]; if (typeof x === 'number') return x; const c = constante(texte(x).trim()); return typeof c === 'number' ? c : E('#VALEUR!'); },
  CAR: (v) => { const n = aNum(v[0]); return estErr(n) ? n : String.fromCharCode(n); },
  CODE: (v) => texte(v[0]).charCodeAt(0) || E('#VALEUR!'),
  AUJOURDHUI: () => { const d = new Date(); return serialDate(d.getFullYear(), d.getMonth() + 1, d.getDate()); },
  MAINTENANT: () => { const d = new Date(); return serialDate(d.getFullYear(), d.getMonth() + 1, d.getDate()) + (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400; },
  DATE: (v) => { const y = aNum(v[0]), m = aNum(v[1]), d = aNum(v[2]); return [y, m, d].find(estErr) || Math.round((Date.UTC(y, m - 1, d) - EPOQUE) / 864e5); },
  TEMPS: (v) => { const h = aNum(v[0]), m = aNum(v[1]), s = aNum(v[2]); return [h, m, s].find(estErr) || ((h * 3600 + m * 60 + s) / 86400) % 1; },
  ANNEE: m1((x) => dateDepuis(x).getUTCFullYear()), MOIS: m1((x) => dateDepuis(x).getUTCMonth() + 1), JOUR: m1((x) => dateDepuis(x).getUTCDate()),
  HEURE: m1((x) => Math.floor(Math.round((x % 1) * 86400) / 3600) % 24), MINUTE: m1((x) => Math.floor(Math.round((x % 1) * 86400) / 60) % 60), SECONDE: m1((x) => Math.round((x % 1) * 86400) % 60),
  JOURSEM: (v) => { const x = dateNum(v[0]), t = optNum(v, 1, 1); if (estErr(x)) return x; const w = dateDepuis(x).getUTCDay(); return t === 2 ? (w + 6) % 7 + 1 : t === 3 ? (w + 6) % 7 : w + 1; },
  'NO.SEMAINE': (v) => { const x = dateNum(v[0]), t = optNum(v, 1, 1); if (estErr(x)) return x; const d = dateDepuis(x), y = d.getUTCFullYear(), j1 = new Date(Date.UTC(y, 0, 1)).getUTCDay(), jour = Math.round((d - Date.UTC(y, 0, 1)) / 864e5); const off = t === 2 ? (j1 + 6) % 7 : j1; return Math.floor((jour + off) / 7) + 1; },
  'FIN.MOIS': (v) => { const x = dateNum(v[0]), n = aNum(v[1]); if (estErr(x)) return x; if (estErr(n)) return n; const d = dateDepuis(x); return serialDate(d.getUTCFullYear(), d.getUTCMonth() + 1 + n + 1, 0); },
  'MOIS.DECALER': (v) => { const x = dateNum(v[0]), n = aNum(v[1]); if (estErr(x)) return x; if (estErr(n)) return n; const d = dateDepuis(x), t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)); const dm = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); return serialDate(t.getUTCFullYear(), t.getUTCMonth() + 1, Math.min(d.getUTCDate(), dm)); },
  JOURS: (v) => { const a = dateNum(v[0]), b = dateNum(v[1]); return estErr(a) ? a : estErr(b) ? b : a - b; },
  DATEDIF: (v) => {
    const a = dateNum(v[0]), b = dateNum(v[1]);
    if (estErr(a)) return a;
    if (estErr(b)) return b;
    if (b < a) return E('#NUM!');
    const d1 = dateDepuis(a), d2 = dateDepuis(b), u = texte(v[2]).toUpperCase();
    let mois = (d2.getUTCFullYear() - d1.getUTCFullYear()) * 12 + d2.getUTCMonth() - d1.getUTCMonth();
    if (d2.getUTCDate() < d1.getUTCDate()) mois--;
    if (u === 'D') return b - a;
    if (u === 'M') return mois;
    if (u === 'Y') return Math.floor(mois / 12);
    if (u === 'YM') return mois % 12;
    if (u === 'MD') return d2.getUTCDate() >= d1.getUTCDate() ? d2.getUTCDate() - d1.getUTCDate() : new Date(Date.UTC(d2.getUTCFullYear(), d2.getUTCMonth(), 0)).getUTCDate() - d1.getUTCDate() + d2.getUTCDate();
    if (u === 'YD') { const y = new Date(Date.UTC(d2.getUTCFullYear(), d1.getUTCMonth(), d1.getUTCDate())); let diff = Math.round((d2 - y) / 864e5); if (diff < 0) diff += 365; return diff; }
    return E('#NUM!');
  },
  'NB.JOURS.OUVRES': (v) => {
    let a = dateNum(v[0]), b = dateNum(v[1]);
    if (estErr(a)) return a;
    if (estErr(b)) return b;
    const feries = new Set(v.length > 2 ? aplatir([v[2]]).filter((x) => typeof x === 'number').map(Math.floor) : []);
    const signe = b < a ? -1 : 1;
    if (b < a) [a, b] = [b, a];
    let n = 0;
    for (let x = a; x <= b; x++) { const w = dateDepuis(x).getUTCDay(); if (w !== 0 && w !== 6 && !feries.has(x)) n++; }
    return n * signe;
  },
  DATEVAL: (v) => { const c = constante(texte(v[0]).trim()); return typeof c === 'number' ? Math.floor(c) : E('#VALEUR!'); },
  RECHERCHEV: (v) => rechercheTable(v, false),
  RECHERCHEH: (v) => rechercheTable(v, true),
  RECHERCHEX: (v) => {
    if (!estRng(v[1]) || !estRng(v[2])) return E('#VALEUR!');
    const cle = v[1].rng.flat(), vertical = v[1].rng[0].length === 1;
    const i = cle.findIndex((x) => x !== null && cmp(x, v[0]) === 0);
    if (i < 0) return v.length > 3 && v[3] !== null ? v[3] : E('#N/A');
    return vertical ? (v[2].rng[i] && v[2].rng[i].length === 1 ? v[2].rng[i][0] : { rng: [v[2].rng[i]] }) : (v[2].rng.length === 1 ? v[2].rng[0][i] : { rng: v[2].rng.map((row) => [row[i]]) });
  },
  EQUIV: (v) => {
    if (!estRng(v[1])) return E('#VALEUR!');
    const liste = v[1].rng.flat(), exact = v.length > 2 && aNum(v[2]) === 0;
    let trouve = -1;
    for (let i = 0; i < liste.length; i++) {
      if (exact) { if (liste[i] !== null && cmp(liste[i], v[0]) === 0) { trouve = i; break; } } else if (liste[i] !== null && typeof liste[i] === typeof v[0] && cmp(liste[i], v[0]) <= 0) trouve = i;
    }
    return trouve < 0 ? E('#N/A') : trouve + 1;
  },
  INDEX: (v) => {
    if (!estRng(v[0])) return E('#VALEUR!');
    const r = aNum(v[1]), c = v.length > 2 && v[2] !== null ? aNum(v[2]) : null, t = v[0].rng;
    if (estErr(r)) return r;
    if (c !== null && estErr(c)) return c;
    if (c === null && t.length === 1) return t[0][r - 1] !== undefined ? t[0][r - 1] : E('#REF!');
    const cc = c === null ? 1 : c;
    if (r === 0) return cc === 0 ? v[0] : { rng: t.map((row) => [row[cc - 1]]) };
    if (cc === 0) return { rng: [t[r - 1]] };
    return t[r - 1] && t[r - 1][cc - 1] !== undefined ? t[r - 1][cc - 1] : E('#REF!');
  },
  TRANSPOSE: (v) => { const M = matrice(v[0]); return { rng: M[0].map((_, j) => M.map((row) => row[j])) }; },
  UNIQUE: (v) => {
    const M = matrice(v[0]), vus = new Set(), out = [];
    M.forEach((row) => { const k = row.map(texte).join('\u0001').toLowerCase(); if (!vus.has(k)) { vus.add(k); out.push(row); } });
    return { rng: out };
  },
  TRIER: (v) => {
    const M = matrice(v[0]).map((r) => [...r]), col = optNum(v, 1, 1) - 1, desc = v.length > 2 && aNum(v[2]) === -1;
    M.sort((a, b) => (desc ? -1 : 1) * cmp(a[col] ?? null, b[col] ?? null));
    return { rng: M };
  },
  FILTRE: (v) => {
    const M = matrice(v[0]), cond = matrice(v[1]).flat();
    const out = M.filter((_, i) => aBool(cond[i]) === true);
    if (!out.length) return v.length > 2 && v[2] !== null ? v[2] : E('#N/A');
    return { rng: out };
  },
  MINIGRAPHIQUE: (v) => {
    if (!estRng(v[0])) return E('#VALEUR!');
    const vals = v[0].rng.flat().map((x) => (typeof x === 'number' ? x : 0));
    return { spark: { vals, type: v.length > 1 ? texte(v[1]).toLowerCase() : 'courbe' } };
  },
  VPM: (v) => { const t = aNum(v[0]), n = aNum(v[1]), va = aNum(v[2]), vc = optNum(v, 3, 0), ty = optNum(v, 4, 0); return [t, n, va, vc, ty].find(estErr) || pmt(t, n, va, vc, ty); },
  VA: (v) => { const t = aNum(v[0]), n = aNum(v[1]), p = aNum(v[2]), vc = optNum(v, 3, 0), ty = optNum(v, 4, 0); if ([t, n, p, vc, ty].some(estErr)) return E('#VALEUR!'); return t === 0 ? -(vc + p * n) : -(vc + p * (1 + t * ty) * ((1 + t) ** n - 1) / t) / (1 + t) ** n; },
  VC: (v) => { const t = aNum(v[0]), n = aNum(v[1]), p = aNum(v[2]), va = optNum(v, 3, 0), ty = optNum(v, 4, 0); return [t, n, p, va, ty].find(estErr) || fvf(t, n, p, va, ty); },
  NPM: (v) => { const t = aNum(v[0]), p = aNum(v[1]), va = aNum(v[2]), vc = optNum(v, 3, 0), ty = optNum(v, 4, 0); if ([t, p, va, vc, ty].some(estErr)) return E('#VALEUR!'); return t === 0 ? -(va + vc) / p : Math.log((p * (1 + t * ty) - vc * t) / (p * (1 + t * ty) + va * t)) / Math.log(1 + t); },
  TAUX: (v) => {
    const n = aNum(v[0]), p = aNum(v[1]), va = aNum(v[2]), vc = optNum(v, 3, 0), ty = optNum(v, 4, 0);
    if ([n, p, va, vc, ty].some(estErr)) return E('#VALEUR!');
    let t = 0.1;
    for (let i = 0; i < 100; i++) {
      const f = va * (1 + t) ** n + p * (1 + t * ty) * ((1 + t) ** n - 1) / t + vc, h = 1e-6;
      const t2 = t + h, f2 = va * (1 + t2) ** n + p * (1 + t2 * ty) * ((1 + t2) ** n - 1) / t2 + vc;
      const nt = t - f * h / (f2 - f);
      if (!isFinite(nt)) return E('#NUM!');
      if (Math.abs(nt - t) < 1e-10) return nt;
      t = nt;
    }
    return E('#NUM!');
  },
  VAN: (v) => { const t = aNum(v[0]); if (estErr(t)) return t; const a = nombres(v.slice(1)); return Array.isArray(a) ? a.reduce((s, x, i) => s + x / (1 + t) ** (i + 1), 0) : a; },
  TRI: (v) => {
    const a = nombres([v[0]]);
    if (!Array.isArray(a)) return a;
    if (!a.some((x) => x > 0) || !a.some((x) => x < 0)) return E('#NUM!');
    const van = (t) => a.reduce((s, x, i) => s + x / (1 + t) ** i, 0);
    let lo = -0.99, hi = 10;
    if (van(lo) * van(hi) > 0) return E('#NUM!');
    for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (van(lo) * van(mid) <= 0) hi = mid; else lo = mid; }
    return (lo + hi) / 2;
  },
  AMORLIN: (v) => { const c = aNum(v[0]), r = aNum(v[1]), d = aNum(v[2]); return [c, r, d].find(estErr) || (d === 0 ? E('#DIV/0!') : (c - r) / d); },
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
/* Références présentes dans une formule (pour la colorisation pendant l'édition) */
function referencesDe(formule) {
  const out = [];
  if (!formule || formule[0] !== '=') return out;
  formule.replace(RE_REFS, (m, chaine, a, b) => {
    if (!chaine) { const R = parsePlage(a + (b ? ':' + b : '')); if (R) out.push(R); }
    return m;
  });
  return out;
}
