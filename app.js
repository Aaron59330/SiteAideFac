'use strict';

/* ================= Données ================= */
const KEY = 'postitbac.v1';
const MATIERES_DEFAUT = [
  ['Maths', '📐', '#4c6ef5'], ['Physique-Chimie', '⚗️', '#15aabf'], ['SVT', '🧬', '#40c057'],
  ['Histoire-Géo', '🌍', '#fd7e14'], ['Français', '📖', '#e64980'], ['Philosophie', '🤔', '#7950f2'],
  ['Anglais', '🇬🇧', '#fa5252'], ['SES', '📊', '#fab005'], ['NSI', '💻', '#868e96'],
];
const uid = () => Math.random().toString(36).slice(2, 9);
const JOUR = 86400000;
const DELAIS = [0, 1, 2, 4, 8, 16]; // jours avant la prochaine révision, selon la boîte (répétition espacée)
const debutJour = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

function normaliserPostit(p) {
  if (p.box === undefined) { p.box = p.ok ? 4 : 0; p.due = p.ok ? debutJour() + DELAIS[4] * JOUR : 0; }
  p.ok = p.box >= 4;
  p.due = p.due || 0;
  p.star = !!p.star;
  p.cles = p.cles || [];
  return p;
}
function normaliser(d) {
  d.journal = Array.isArray(d.journal) ? d.journal : [];
  d.revisions = d.revisions && typeof d.revisions === 'object' ? d.revisions : {};
  d.focus = d.focus && typeof d.focus === 'object' ? d.focus : {};
  d.tableurs = Array.isArray(d.tableurs) ? d.tableurs : [];
  d.tableurs.forEach((t) => { t.noms = t.noms || {}; t.feuilles.forEach(completerFeuille); });
  d.xp = +d.xp || 0;
  d.objectif = +d.objectif || 10;
  d.matieres.forEach((m) => { m.exam = m.exam || ''; });
  d.cours.forEach((c) => c.postits.forEach(normaliserPostit));
  return d;
}
function chargerDb() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.matieres) && Array.isArray(d.cours)) return normaliser(d);
  } catch (e) { /* stockage indisponible ou vide */ }
  return normaliser({ matieres: MATIERES_DEFAUT.map(([nom, emoji, couleur]) => ({ id: uid(), nom, emoji, couleur })), cours: [] });
}
let db = chargerDb();
function sauver() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { alert('Impossible de sauvegarder (stockage plein ou bloqué).'); }
}
function journaliser(titre, detail) {
  db.journal.unshift({ t: Date.now(), titre, detail: detail || '' });
  db.journal.length = Math.min(db.journal.length, 200);
}

/* Répétition espacée : une bonne réponse monte d'une boîte (revue de plus en plus tard), une erreur repart à zéro. */
function noter(p, bon) {
  p.box = bon ? Math.min(5, p.box + 1) : 0;
  p.due = debutJour() + (bon ? DELAIS[p.box] : 1) * JOUR;
  p.ok = p.box >= 4;
}
const estDu = (p) => !p.due || p.due <= Date.now();
const niveau = (xp) => Math.floor(Math.sqrt(xp / 40)) + 1;
function gagnerXp(n) {
  const avant = niveau(db.xp);
  db.xp += n;
  if (niveau(db.xp) > avant) toast(`⭐ Niveau ${niveau(db.xp)} atteint !`);
}

const ui = { view: 'dash', mat: 'all', coursId: null, q: '', tab: 'postits', filtre: 'tous', tabId: null, feuille: 0 };

/* ================= Utilitaires ================= */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const matiere = (id) => db.matieres.find((m) => m.id === id);
const cours = (id) => db.cours.find((c) => c.id === id);
const ROT = [-1.5, 1, -0.5, 1.8, -1, 0.6];
const fmtDate = (t) => new Date(t).toLocaleDateString('fr-FR');

/* ================= Résumé automatique ================= */
const STOP = new Set(('alors aucun aussi autre avant avec avoir bon car ce cela ces ceux chaque ci comme comment dans des du dedans dehors depuis devrait doit donc dos droite début elle elles en encore essai est et eu fait faites fois font hors ici il ils je juste la le les leur là ma maintenant mais mes mine moins mon mot même ni nommés notre nous nouveaux ou où par parce pas peut peu pièce plupart pour pourquoi quand que quel quelle quelles quels qui sa sans ses seulement si sien son sont sous soyez sujet sur ta tandis tellement tels tes ton tous tout trop très tu voient vont votre vous vu ça étaient état étions été être aux au une un cette cet ainsi après entre lors puis ses selon sera seront était étant ont ont-ils avait avaient aura auront sont suis es sommes êtes cependant toutefois pendant tant lequel lesquels notamment également permet permettre plus très bien déjà encore ainsi dont celui celle ceux celles quelque quelques autres même mêmes ceci cela chacun deux trois quatre cinq premier première second seconde grands grand grande').split(/\s+/));

const mots = (t) => (t.toLowerCase().match(/[\p{L}][\p{L}'’-]*/gu) || [])
  .map((w) => w.replace(/^[a-zàâçéèêëîïôûùüÿœ]{1,2}['’]/, ''))
  .filter((w) => w.length > 3 && !STOP.has(w));

function frequences(t) {
  const f = {};
  mots(t).forEach((w) => { f[w] = (f[w] || 0) + 1; });
  return f;
}

const PUCE = /^\s*(?:[-–—•·▪●◦*]|•)\s+/;

function estTitre(l, precedentVide, suivant) {
  if (!l || l.length > 90 || PUCE.test(l)) return false;
  const nbMots = l.split(/\s+/).length;
  if (/^#{1,6}\s+\S/.test(l)) return true;
  if (/^(?:(?:[IVXL]+|\d+(?:\.\d+)*|[A-Z])[.)]|(?:Partie|Chapitre|Chap\.|Leçon|Séquence|Thème|Document)\s+\S+)\s*\S/.test(l) && !/[.;,]$/.test(l)) return true;
  if (l === l.toUpperCase() && /\p{L}{3}/u.test(l) && nbMots <= 10 && l.length >= 4) return true;
  if (/:$/.test(l) && nbMots <= 8) return true;
  return precedentVide && !!suivant && nbMots <= 9 && !/[.;,:!?]$/.test(l) && /^\p{Lu}/u.test(l);
}

const nettoyerTitre = (l) => l.replace(/^#{1,6}\s+/, '').replace(/^(?:[IVXL]+|\d+(?:\.\d+)*|[A-Z])[.)]\s*/, '').replace(/[:\s]+$/, '').trim();

function decouper(texte) {
  const lignes = texte.replace(/\r/g, '').split('\n').map((l) => l.trim());
  const sections = [];
  let cur = { titre: null, items: [] };
  let para = [];
  const fin = () => { if (para.length) { cur.items.push({ t: para.join(' '), puce: false }); para = []; } };
  const clore = () => { fin(); if (cur.items.length) sections.push(cur); };
  lignes.forEach((l, i) => {
    if (!l) { fin(); return; }
    if (estTitre(l, i === 0 || !lignes[i - 1], lignes[i + 1])) {
      clore();
      cur = { titre: nettoyerTitre(l), items: [] };
    } else if (PUCE.test(l)) {
      fin();
      cur.items.push({ t: l.replace(PUCE, ''), puce: true });
    } else {
      para.push(l);
    }
  });
  clore();
  return sections;
}

const ABBR = /\b(av|apr|ex|cf|env|etc|Mme|St|Dr|fig|vs|p|M)\./g;
function phrases(item) {
  if (item.puce) return [item.t];
  return item.t.replace(/J\.-C\./g, 'J§-C§').replace(ABBR, '$1§')
    .split(/(?<=[.!?…])\s+(?=[\p{Lu}0-9«"(])/u)
    .map((s) => s.replace(/§/g, '.').trim()).filter((s) => s.length > 3);
}

function raccourcir(s) {
  if (s.length <= 220) return s;
  const coupe = s.slice(0, 200);
  const i = Math.max(coupe.lastIndexOf(','), coupe.lastIndexOf(';'), coupe.lastIndexOf(':'));
  return (i > 90 ? coupe.slice(0, i) : coupe.slice(0, coupe.lastIndexOf(' '))) + '…';
}

const DEF = /\b(est|sont|désigne|définit|défini|définie|appelle|appelée|correspond|signifie|consiste|c'est|s'agit)\b|:/i;
const ANNEE = /\b(1[0-9]{3}|20[0-9]{2})\b/;

function resumerSection(sec, tfGlobal, detail) {
  const k = { 1: 2, 2: 3, 3: 5 }[detail] || 3;
  const phr = sec.items.flatMap((it) => phrases(it).map((t) => ({ t, puce: it.puce })));
  const tfSec = frequences(phr.map((p) => p.t).join(' '));
  const titreMots = new Set(mots(sec.titre || ''));
  const notes = phr.map((p, i) => {
    const ws = mots(p.t);
    let s = ws.reduce((a, w) => a + (tfSec[w] || 0) * 2 + (tfGlobal[w] || 0), 0) / Math.pow(ws.length || 1, 0.6);
    if (DEF.test(p.t)) s *= 1.5;
    if (ANNEE.test(p.t)) s *= 1.25;
    if (p.puce) s *= 1.2;
    if (i === 0) s *= 1.15;
    if (ws.some((w) => titreMots.has(w))) s *= 1.3;
    if (p.t.length < 25 && !p.puce) s *= 0.5;
    return { i, t: p.t, s };
  });
  const choix = notes.sort((a, b) => b.s - a.s).slice(0, k).sort((a, b) => a.i - b.i);
  const cles = Object.entries(tfSec).map(([w, n]) => [w, n * 2 + (tfGlobal[w] || 0)])
    .sort((a, b) => b[1] - a[1]).slice(0, 4).map((e) => e[0]);
  let titre = sec.titre;
  if (!titre) titre = cles.slice(0, 2).map((w) => w[0].toUpperCase() + w.slice(1)).join(' · ') || 'Idées clés';
  return { id: uid(), titre, points: choix.map((c) => raccourcir(c.t)), cles, ok: false, box: 0, due: 0, star: false };
}

function decoupageRegulier(texte, nb) {
  const phr = texte.replace(/\s+/g, ' ').split(/\n+/).flatMap((p) => phrases({ t: p, puce: false }));
  const n = Math.max(1, Math.min(nb, Math.ceil(phr.length / 2)));
  const taille = Math.ceil(phr.length / n);
  const secs = [];
  for (let i = 0; i < phr.length; i += taille) {
    secs.push({ titre: null, items: phr.slice(i, i + taille).map((t) => ({ t, puce: true })) });
  }
  return secs;
}

function resumer(texte, detail, nb) {
  let secs = decouper(texte);
  const tf = frequences(texte);
  if (secs.filter((s) => s.titre).length < 2) secs = decoupageRegulier(texte.replace(/\n/g, ' '), nb);
  else {
    const fusion = [];
    secs.forEach((s) => {
      const taille = s.items.reduce((a, it) => a + it.t.length, 0);
      if (!s.titre && !fusion.length && taille < 80) return;
      if (!s.titre) s.titre = 'Introduction';
      if (taille < 40 && fusion.length) fusion[fusion.length - 1].items.push(...s.items, { t: s.titre, puce: true });
      else fusion.push(s);
    });
    secs = fusion;
  }
  return secs.map((s) => resumerSection(s, tf, detail)).filter((p) => p.points.length);
}


/* ================= Glossaire automatique ================= */
function glossaire(texte) {
  const res = [], vus = new Set();
  const ajout = (terme, def) => {
    terme = terme.replace(/^(?:le|la|les|l['’]|un|une|des|du|de la|d['’])\s*/i, '').trim();
    def = def.trim();
    if (!terme || terme.split(/\s+/).length > 4 || terme.length > 45 || def.length < 12) return;
    const k = terme.toLowerCase();
    if (vus.has(k)) return;
    vus.add(k);
    res.push({ terme: terme[0].toUpperCase() + terme.slice(1), def: raccourcir(def) });
  };
  decouper(texte).forEach((sec) => sec.items.forEach((it) => phrases(it).forEach((s) => {
    let m = s.match(/^(.{3,45}?)\s+(?:désigne|désignent|signifie|signifient|se définit comme|correspond à|correspondent à|s['’]appelle|définit)\s+(.+)$/i)
      || s.match(/^(.{3,45}?)\s+(?:est|sont)\s+((?:un|une|le|la|l['’]|les|des|du)\s*.+)$/i)
      || s.match(/^([^:]{3,40}):\s+(.{12,})$/);
    if (m) ajout(m[1], m[2].replace(/\.$/, ''));
  })));
  return res.slice(0, 30);
}

/* ================= Gamification ================= */
const totalRevisions = () => Object.values(db.revisions).reduce((a, b) => a + b, 0);
const aujourdhui = () => db.revisions[cleJour(new Date())] || 0;

function badges() {
  const maitr = tousPostits().filter((p) => p.ok).length;
  const focus = Object.values(db.focus).reduce((a, b) => a + b, 0);
  const s = serie();
  return [
    ['🌱', 'Premier cours', db.cours.length >= 1], ['🗂️', '5 cours', db.cours.length >= 5],
    ['✅', '10 post-it maîtrisés', maitr >= 10], ['🏅', '50 post-it maîtrisés', maitr >= 50],
    ['🔥', 'Série de 3 jours', s >= 3], ['🚀', 'Série de 7 jours', s >= 7],
    ['💯', '100 révisions', totalRevisions() >= 100], ['⏱️', '1 h de focus', focus >= 60],
    ['🎯', 'Objectif du jour atteint', aujourdhui() >= db.objectif],
  ];
}
const badgesHtml = () => `<div class="badges">${badges().map(([ic, t, ok]) => `<div class="badge ${ok ? 'on' : ''}" title="${esc(t)}"><span>${ic}</span><small>${esc(t)}</small></div>`).join('')}</div>`;

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
}

/* ================= Rendu ================= */
function surligner(texte, cles) {
  let h = esc(texte).replace(ANNEE, '<mark>$1</mark>');
  (cles || []).forEach((c) => {
    h = h.replace(new RegExp('(^|[^\\p{L}>])(' + reEsc(esc(c)) + ')(?=$|[^\\p{L}<])', 'giu'), '$1<mark>$2</mark>');
  });
  return h;
}

const cleJour = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function depuis(t) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'à l’instant';
  if (s < 3600) return 'il y a ' + Math.floor(s / 60) + ' min';
  if (s < 86400) return 'il y a ' + Math.floor(s / 3600) + ' h';
  return 'il y a ' + Math.floor(s / 86400) + ' j';
}
const progression = (c) => (c.postits.length ? Math.round(100 * c.postits.filter((p) => p.ok).length / c.postits.length) : 0);
const tousPostits = () => db.cours.flatMap((c) => c.postits);

function serie() {
  const d = new Date();
  if (!db.revisions[cleJour(d)]) d.setDate(d.getDate() - 1);
  let n = 0;
  while (db.revisions[cleJour(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

function graphique(n) {
  const jours = [...Array(n)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (n - 1 - i)); return d; });
  const vals = jours.map((d) => db.revisions[cleJour(d)] || 0);
  const max = Math.max(5, ...vals);
  const W = 560, H = 150, x0 = 8, h = H - 34;
  const x = (i) => x0 + i * (W - 2 * x0) / (n - 1);
  const y = (v) => 14 + h - (v / max) * h;
  let d = `M${x(0)},${y(vals[0])}`;
  for (let i = 1; i < n; i++) d += ` L${x(i)},${y(vals[i - 1])} L${x(i)},${y(vals[i])}`;
  const aire = `${d} L${x(n - 1)},${14 + h} L${x(0)},${14 + h} Z`;
  const f = (dt) => dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return `<div class="chart-box"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Post-it révisés par jour">
    <text x="${x0}" y="10" fill="#8d8d96" font-size="10">max ${max}</text>
    <path d="${aire}" fill="rgba(240,178,122,.22)"/><path d="${d}" fill="none" stroke="#f0b27a" stroke-width="1.6"/>
    <line x1="${x0}" x2="${W - x0}" y1="${14 + h}" y2="${14 + h}" stroke="#24242a"/></svg>
    <div class="axis"><span>${f(jours[0])}</span><span>Aujourd’hui</span></div></div>`;
}

function calendrier(semaines) {
  const N = semaines * 7;
  const debut = new Date(); debut.setDate(debut.getDate() - (N - 1));
  const vide = (debut.getDay() + 6) % 7;
  let cells = '<i class="hm"></i>'.repeat(vide);
  for (let i = 0; i < N; i++) {
    const d = new Date(debut); d.setDate(d.getDate() + i);
    const v = db.revisions[cleJour(d)] || 0;
    const l = v === 0 ? 0 : v < 3 ? 1 : v < 6 ? 2 : v < 10 ? 3 : 4;
    cells += `<i class="hm l${l}" title="${d.toLocaleDateString('fr-FR')} : ${v} révision(s)"></i>`;
  }
  return `<div class="heat">${cells}</div>`;
}

function postitHtml(p, i, c, opts = {}) {
  const m = matiere(c.matiereId);
  const sup = opts.crumb ? `<div class="crumb-p">${esc(m?.emoji || '')} ${esc(c.titre)}</div>` : '';
  return `<article class="postit c${i % 6}${p.ok ? ' done' : ''}" style="--rot:${ROT[i % 6]}deg" data-c="${c.id}" data-p="${p.id}">
    <div class="tools">
      <button data-act="star" title="Favori">${p.star ? '⭐' : '☆'}</button>
      <button data-act="ok" title="${p.ok ? 'Marquer à revoir' : 'Je sais ce post-it'}">${p.ok ? '✅' : '⬜'}</button>
      <button data-act="edit" title="Modifier">✏️</button>
      <button data-act="del" title="Supprimer">🗑️</button>
    </div>
    <h3>${esc(p.titre)}</h3>
    <ul>${p.points.map((t) => `<li>${surligner(t, p.cles)}</li>`).join('')}</ul>${sup}
    <div class="crumb-p">Boîte ${p.box}/5${p.ok ? ' · maîtrisé' : estDu(p) ? ' · à revoir' : ' · revu, prochain ' + new Date(p.due).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</div>
  </article>`;
}

function renderSide() {
  const nav = (ic, txt, on, extra = '') => `<button class="nav ${on ? 'on' : ''}" ${extra}><span class="ic">${ic}</span>${txt}</button>`;
  const mats = db.matieres.map((m) => {
    const n = db.cours.filter((c) => c.matiereId === m.id).length;
    return `<button class="nav ${ui.view === 'mat' && ui.mat === m.id ? 'on' : ''}" data-mat="${m.id}"><span class="ic">${esc(m.emoji)}</span>${esc(m.nom)}<small>${n || ''}</small></button>`;
  }).join('');
  const nv = niveau(db.xp), a = 40 * (nv - 1) ** 2, b = 40 * nv ** 2;
  $('#side').innerHTML = `
    <div class="logo">PostIt<span>Bac</span></div>
    <div class="switcher"><div class="lv"><span>🎓 Niveau ${nv}</span><small>${db.xp} XP</small></div>
      <div class="bar"><i style="width:${Math.round(100 * (db.xp - a) / (b - a))}%"></i></div></div>
    <div class="sec">Général</div>
    ${nav('⌂', 'Dashboard', ui.view === 'dash', 'data-nav="dash"')}
    ${nav('☰', 'Journal d’activités', ui.view === 'journal', 'data-nav="journal"')}
    ${nav('⟋', 'Statistiques', ui.view === 'stats', 'data-nav="stats"')}
    <div class="sec">Cours</div>
    ${nav('＋', 'Nouveau cours', ui.view === 'new', 'data-nav="new"')}
    ${nav('▦', 'Tous mes cours', ui.view === 'mat' && ui.mat === 'all', 'data-mat="all"')}
    ${nav('🧠', 'Réviser aujourd’hui', false, 'data-nav="rev"')}
    <div class="sec">Outils</div>
    ${nav('▥', 'Tableurs', ui.view === 'tableurs' || ui.view === 'sheet', 'data-nav="tableurs"')}
    <div class="sec">Matières</div>
    ${mats}
    ${nav('＋', 'Nouvelle matière', false, 'data-nav="addmat"')}
    <div class="sec">Données</div>
    ${nav('⬇', 'Sauvegarder', false, 'data-nav="export"')}
    ${nav('⬆', 'Restaurer', false, 'data-nav="import"')}`;
}

function coursCard(c) {
  const m = matiere(c.matiereId);
  const du = c.postits.filter(estDu).length;
  return `<div class="cours" data-open="${c.id}" style="--mc:${m ? m.couleur : '#888'}">
    <h3>${esc(c.titre)}</h3>
    <small>${esc(m ? m.emoji + ' ' + m.nom : 'Sans matière')} · ${c.postits.length} post-it · ${fmtDate(c.date)}</small>
    <div class="bar"><i style="width:${progression(c)}%"></i></div>
    <small>${progression(c)} % maîtrisé · ${du} à revoir aujourd’hui</small>
  </div>`;
}

const logHtml = (liste) => `<ul class="log">${liste.map((j) => `<li><b>${esc(j.titre)}</b><small>${depuis(j.t)}${j.detail ? ' · ' + esc(j.detail) : ''}</small></li>`).join('')}</ul>`;
const entete = (titre, sous, pill) => `<div class="head"><div><h2>${titre}</h2><p class="sub">${sous}</p></div>${pill || ''}</div>`;

function compteARebours() {
  const auj = debutJour();
  const l = db.matieres.filter((m) => m.exam && new Date(m.exam + 'T00:00').getTime() >= auj)
    .map((m) => ({ m, j: Math.round((new Date(m.exam + 'T00:00').getTime() - auj) / JOUR) }))
    .sort((a, b) => a.j - b.j);
  if (!l.length) return '<p class="muted" style="margin:0">Ajoute la date de ton épreuve dans une matière (📅 Examen) pour voir ton compte à rebours et ton rythme conseillé.</p>';
  return l.map(({ m, j }) => {
    const reste = db.cours.filter((c) => c.matiereId === m.id).flatMap((c) => c.postits).filter((p) => !p.ok).length;
    const rythme = reste ? Math.ceil(reste / Math.max(1, j)) : 0;
    return `<div class="row2"><span>${esc(m.emoji + ' ' + m.nom)}</span><b>${j === 0 ? 'Aujourd’hui !' : 'J-' + j}</b><small>${reste} à maîtriser${rythme ? ' · ≈ ' + rythme + '/jour' : ''}</small></div>`;
  }).join('');
}

function vueDash() {
  const ps = tousPostits();
  const du = ps.filter(estDu).length;
  const ok = ps.filter((p) => p.ok).length;
  const pct = ps.length ? Math.round(100 * ok / ps.length) : 0;
  const s = serie();
  const auj = aujourdhui();
  const butoir = Math.min(100, Math.round(100 * auj / db.objectif));
  return entete('Tableau de bord', 'Gestion de ton espace de révision', `<span class="pill ${du ? 'warn' : ''}">${du ? 'À réviser' : 'À jour'}</span>`) + `
  <div class="tiles">
    <div class="tile"><span>À réviser aujourd’hui</span><b>${du}</b><small>${db.cours.length} cours · ${ps.length} post-it</small></div>
    <div class="tile"><span>Maîtrisés</span><b>${pct} %</b><small>${ok} post-it sus</small></div>
    <div class="tile"><span>Objectif du jour</span><b>${auj} / ${db.objectif}</b><div class="bar"><i style="width:${butoir}%"></i></div></div>
    <div class="tile"><span>Série de révision</span><b>${s} jour${s > 1 ? 's' : ''}</b><small>${totalRevisions()} révisions au total</small></div>
  </div>
  <div class="cols">
    <div class="col">
      <div class="card"><h3>Réviser maintenant</h3>
        <div class="status"><strong><i class="dot"></i>${du ? du + ' post-it à revoir aujourd’hui' : ps.length ? 'Rien d’urgent, bravo 🎉' : 'Aucun cours pour l’instant'}</strong></div>
        <div class="actions">
          <button class="btn primary" data-nav="rev">🧠 Cartes</button>
          <button class="btn" data-nav="revTrous">✍️ Texte à trous</button>
          <button class="btn" data-nav="revQcm">🎯 QCM</button>
          <button class="btn ghost" data-nav="new">＋ Nouveau cours</button>
        </div>
        <p class="muted">Les post-it reviennent au bon moment grâce à la répétition espacée : plus tu réussis, plus l’intervalle s’allonge.</p></div>
      <div class="card"><h3>Post-it révisés (14 jours)</h3>${graphique(14)}</div>
      <div class="card"><h3>Compte à rebours</h3>${compteARebours()}</div>
    </div>
    <div class="col">
      <div class="card"><div class="card-head"><h3>Journal d’activités</h3><a data-nav="journal">Voir tout →</a></div>
        ${db.journal.length ? logHtml(db.journal.slice(0, 7)) : '<p class="muted" style="margin:0">Rien pour l’instant. Tes actions apparaîtront ici.</p>'}</div>
      <div class="card"><h3>Badges</h3>${badgesHtml()}</div>
      <div class="card"><h3>Actions rapides</h3>
        <button class="row" data-nav="new"><span><b>Ajouter un cours</b><small>Colle ou importe un fichier .txt</small></span>→</button>
        <button class="row" data-nav="stats"><span><b>Voir mes statistiques</b><small>Calendrier, progression, objectif</small></span>→</button>
        <button class="row" data-nav="export"><span><b>Sauvegarder mes cours</b><small>Télécharger une copie de tout</small></span>→</button></div>
    </div>
  </div>`;
}

function vueJournal() {
  return entete('Journal d’activités', 'Tout ce que tu as fait récemment') +
    `<div class="card">${db.journal.length ? logHtml(db.journal) : '<p class="muted">Rien pour l’instant.</p>'}</div>`;
}

function vueStats() {
  const lignes = db.matieres.map((m) => {
    const cs = db.cours.filter((c) => c.matiereId === m.id);
    const ps = cs.flatMap((c) => c.postits);
    const pct = ps.length ? Math.round(100 * ps.filter((p) => p.ok).length / ps.length) : 0;
    return `<tr><td>${esc(m.emoji + ' ' + m.nom)}</td><td>${cs.length}</td><td>${ps.length}</td><td>${ps.filter(estDu).length}</td>
      <td><div class="bar"><i style="width:${pct}%"></i></div></td><td>${pct} %</td></tr>`;
  }).join('');
  const minutes = Object.values(db.focus).reduce((a, b) => a + b, 0);
  return entete('Statistiques', `${totalRevisions()} révisions · série actuelle : ${serie()} jour(s) · ${minutes} min de focus`) + `
    <div class="tiles">
      <div class="tile"><span>Niveau</span><b>${niveau(db.xp)}</b><small>${db.xp} XP</small></div>
      <div class="tile"><span>Révisions</span><b>${totalRevisions()}</b><small>au total</small></div>
      <div class="tile"><span>Focus</span><b>${minutes} min</b><small>${db.focus[cleJour(new Date())] || 0} min aujourd’hui</small></div>
      <div class="tile"><span>Objectif quotidien</span><b><input id="fObjectif" class="mini" type="number" min="1" max="200" value="${db.objectif}"></b><small>post-it par jour</small></div>
    </div>
    <div class="cols">
      <div class="card"><h3>Post-it révisés (30 jours)</h3>${graphique(30)}</div>
      <div class="card"><h3>Calendrier d’activité (15 semaines)</h3>${calendrier(15)}</div>
    </div>
    <div class="card" style="margin-top:16px"><h3>Progression par matière</h3>
      <table><tr><th>Matière</th><th>Cours</th><th>Post-it</th><th>À revoir</th><th>Progression</th><th></th></tr>${lignes}</table></div>
    <div class="card" style="margin-top:16px"><h3>Badges</h3>${badgesHtml()}</div>`;
}

function vueMat() {
  const m = ui.mat === 'all' ? null : matiere(ui.mat);
  const liste = db.cours.filter((c) => !m || c.matiereId === m.id).sort((a, b) => b.date - a.date);
  let html = `<div class="head"><div><h2>${m ? esc(m.emoji + ' ' + m.nom) : 'Tous mes cours'}</h2>
    <p class="sub">${liste.length ? liste.length + ' cours · clique pour voir les post-it' : ''}</p></div>
    <div class="actions"><button class="btn primary" data-nav="new">＋ Nouveau cours</button>
    ${liste.length ? '<button class="btn" data-act="revMat">🧠 Réviser</button>' : ''}
    ${m ? `<label class="btn ghost exam">📅 Examen <input type="date" data-exam value="${esc(m.exam)}"></label>
    <button class="btn ghost" data-act="renMat">✏️</button><button class="btn ghost danger" data-act="delMat">🗑️</button>` : ''}</div></div>`;
  if (!liste.length) {
    return html + `<div class="empty"><p style="font-size:3rem;margin:0">🗒️</p><p>Aucun cours ${m ? 'en ' + esc(m.nom) : ''} pour l’instant.</p></div>`;
  }
  if (m) return html + `<div class="cours-list">${liste.map(coursCard).join('')}</div>`;
  db.matieres.forEach((mm) => {
    const l = liste.filter((c) => c.matiereId === mm.id);
    if (l.length) html += `<h3 class="group-title">${esc(mm.emoji + ' ' + mm.nom)}</h3><div class="cours-list">${l.map(coursCard).join('')}</div>`;
  });
  const orph = liste.filter((c) => !matiere(c.matiereId));
  if (orph.length) html += `<h3 class="group-title">Sans matière</h3><div class="cours-list">${orph.map(coursCard).join('')}</div>`;
  return html;
}

function vueRecherche() {
  const q = ui.q.toLowerCase();
  const res = [];
  db.cours.forEach((c) => c.postits.forEach((p, i) => {
    if ((p.titre + ' ' + p.points.join(' ') + ' ' + c.titre).toLowerCase().includes(q)) res.push({ c, p, i });
  }));
  return entete(`Recherche : « ${esc(ui.q)} »`, `${res.length} post-it trouvé(s)`) +
    `<div class="mur">${res.map((r) => postitHtml(r.p, r.i, r.c, { crumb: true })).join('')}</div>`;
}

function vueNouveau() {
  const defaut = ui.mat !== 'all' && matiere(ui.mat) ? ui.mat : db.matieres[0]?.id;
  return entete('Nouveau cours', 'Colle ton cours : il devient des post-it rangés dans ta matière.') + `
  <div class="card">
    <div class="grid2">
      <div><label class="field" for="fMat" style="margin-top:0">Matière</label>
        <select id="fMat">${db.matieres.map((m) => `<option value="${m.id}" ${m.id === defaut ? 'selected' : ''}>${esc(m.emoji + ' ' + m.nom)}</option>`).join('')}</select></div>
      <div><label class="field" for="fTitre" style="margin-top:0">Titre du cours <span class="hint">(facultatif)</span></label>
        <input id="fTitre" type="text" placeholder="Ex : La Guerre froide"></div>
    </div>
    <label class="field" for="fTexte">Ton cours <span class="hint">— colle-le, ou glisse un fichier .txt / .md dessus</span></label>
    <textarea id="fTexte" rows="13" placeholder="Copie-colle ton cours entier ici…&#10;&#10;Astuce : si tes titres sont sur leur propre ligne (I. Les causes, 1) …, MAJUSCULES), chaque titre devient un post-it."></textarea>
    <div class="grid2">
      <div><label class="field" for="fDetail">Détail des post-it</label>
        <select id="fDetail"><option value="1">Court (l’essentiel)</option><option value="2" selected>Moyen</option><option value="3">Détaillé</option></select></div>
      <div><label class="field" for="fNb">Nombre de post-it <span class="hint">(si le cours n’a pas de titres)</span></label>
        <input id="fNb" type="number" min="2" max="30" value="8"></div>
    </div>
    <div class="actions">
      <button class="btn primary" data-act="generer">✨ Générer mes post-it</button>
      <label class="btn">📄 Importer un fichier<input id="fFichier" type="file" accept=".txt,.md,.text" hidden></label>
      <button class="btn ghost" data-act="exemple">Essayer avec un exemple</button>
    </div>
    <p class="count" id="fCompte"></p>
  </div>`;
}

function ongletGlossaire(c) {
  const g = c.glossaire;
  if (!g) return '<div class="empty">Glossaire indisponible pour ce cours (ajouté avec une ancienne version).<br>Utilise « Régénérer » dans le menu ⋯ pour le créer.</div>';
  if (!g.length) return '<div class="empty">Aucune définition détectée dans ce cours.<br>Les phrases du type « X désigne… », « X est un… » ou « Terme : définition » en produisent.</div>';
  return `<div class="card"><table class="gloss">${g.map((e) => `<tr><td><b>${esc(e.terme)}</b></td><td>${esc(e.def)}</td></tr>`).join('')}</table></div>`;
}
function ongletFiche(c) {
  return `<div class="card fiche"><h3>${esc(c.titre)}</h3>${c.postits.map((p) =>
    `<h4>${esc(p.titre)}</h4><ul>${p.points.map((t) => `<li>${surligner(t, p.cles)}</li>`).join('')}</ul>`).join('')}</div>`;
}

function vueCours() {
  const c = cours(ui.coursId);
  if (!c) { ui.view = 'dash'; return vueDash(); }
  const m = matiere(c.matiereId);
  const liste = c.postits.filter((p) => ui.filtre === 'revoir' ? !p.ok : ui.filtre === 'fav' ? p.star : true);
  const onglet = (id, txt) => `<button class="tab ${ui.tab === id ? 'on' : ''}" data-tab="${id}">${txt}</button>`;
  const puce = (id, txt) => `<button class="chip ${ui.filtre === id ? 'on' : ''}" data-filtre="${id}">${txt}</button>`;
  let corps;
  if (ui.tab === 'glossaire') corps = ongletGlossaire(c);
  else if (ui.tab === 'fiche') corps = ongletFiche(c);
  else corps = `<div class="chips">${puce('tous', 'Tous')}${puce('revoir', 'À revoir')}${puce('fav', '⭐ Favoris')}</div>
    <div class="mur">${liste.map((p) => postitHtml(p, c.postits.indexOf(p), c)).join('') || '<div class="empty">Aucun post-it dans ce filtre.</div>'}</div>`;
  return `<div class="head"><div>
      <p class="sub" style="margin:0 0 4px"><a href="#" data-act="retour">← ${esc(m ? m.nom : 'Retour')}</a></p>
      <h2>${esc(c.titre)}</h2>
      <p class="sub">${esc(m ? m.emoji + ' ' + m.nom : '')} · ${c.postits.length} post-it · ${progression(c)} % maîtrisé</p></div>
    <div class="actions">
      <button class="btn primary" data-act="revision">🧠 Cartes</button>
      <button class="btn" data-act="revTrous">✍️ Trous</button>
      <button class="btn" data-act="revQcm">🎯 QCM</button>
      <details class="more"><summary class="btn">⋯</summary><div class="menu">
        <button data-act="ajoutPostit">＋ Ajouter un post-it</button>
        <button data-act="copier">📋 Copier le résumé</button>
        <button data-act="imprimer">🖨️ Imprimer / PDF</button>
        <button data-act="anki">⬇ Exporter pour Anki</button>
        <button data-act="regen">🔄 Régénérer le résumé</button>
        <button data-act="renCours">✏️ Renommer</button>
        <button data-act="delCours" class="danger">🗑️ Supprimer</button></div></details>
    </div></div>
    <div class="tabs">${onglet('postits', '🗒️ Post-it')}${onglet('glossaire', '📖 Glossaire')}${onglet('fiche', '📄 Fiche')}</div>
    ${corps}`;
}

function fil() {
  if (ui.q.trim()) return ['Recherche', esc(ui.q)];
  const m = matiere(ui.mat);
  switch (ui.view) {
    case 'journal': return ['Général', 'Journal d’activités'];
    case 'stats': return ['Général', 'Statistiques'];
    case 'tableurs': return ['Outils', 'Tableurs'];
    case 'sheet': { const t = tableur(); return ['Tableurs', esc(t ? t.nom : '')]; }
    case 'new': return ['Cours', 'Nouveau cours'];
    case 'mat': return m ? ['Matières', esc(m.nom)] : ['Cours', 'Tous mes cours'];
    case 'cours': { const c = cours(ui.coursId); const mm = c && matiere(c.matiereId); return [esc(mm ? mm.nom : 'Cours'), esc(c ? c.titre : '')]; }
    default: return ['Général', 'Dashboard'];
  }
}

function render() {
  renderSide();
  const [a, b] = fil();
  $('#crumb').innerHTML = `${a} / <b>${b}</b>`;
  $('#view').innerHTML = ui.q.trim() ? vueRecherche()
    : { dash: vueDash, journal: vueJournal, stats: vueStats, mat: vueMat, new: vueNouveau, cours: vueCours, tableurs: vueTableurs, sheet: vueTableur }[ui.view]();
  if (ui.view === 'sheet' && !ui.q.trim()) initTableur();
  if (ui.view === 'new' && !ui.q.trim()) majCompte();
}

function majCompte() {
  const t = $('#fTexte');
  if (!t) return;
  const n = t.value.trim() ? t.value.trim().split(/\s+/).length : 0;
  $('#fCompte').textContent = n ? `${n} mots collés` : '';
}

function aller(view, extra = {}) {
  Object.assign(ui, { view, q: '' }, extra);
  $('#search').value = '';
  render();
  window.scrollTo(0, 0);
}

/* ================= Actions ================= */
const EXEMPLE = `La Guerre froide (1947-1991)

I. Les origines de l'affrontement
Après la Seconde Guerre mondiale, les États-Unis et l'URSS sont les deux superpuissances. Ils s'opposent par leurs idéologies : le capitalisme libéral américain face au communisme soviétique. La Guerre froide désigne cette rivalité qui ne débouche jamais sur un affrontement direct entre les deux grands. En 1947, la doctrine Truman propose d'aider les pays menacés par le communisme : c'est la politique d'endiguement. L'URSS répond par la doctrine Jdanov qui divise le monde en deux camps.

II. Un monde bipolaire
Le monde se divise en deux blocs. Le bloc de l'Ouest est dirigé par les États-Unis et s'appuie sur l'OTAN créée en 1949. Le bloc de l'Est est dirigé par l'URSS et s'organise autour du pacte de Varsovie fondé en 1955. Berlin est le symbole de cette division : le mur de Berlin est construit en 1961 pour empêcher les Allemands de l'Est de fuir. Plusieurs conflits indirects éclatent comme la guerre de Corée en 1950 ou la guerre du Vietnam.

III. Les crises et la détente
La crise de Cuba en octobre 1962 est le moment où le monde est le plus proche d'une guerre nucléaire. Après cette crise, les deux grands ouvrent un dialogue : c'est la détente. Un téléphone rouge est installé entre Washington et Moscou. Les accords SALT limitent les armes nucléaires en 1972.

IV. La fin de la Guerre froide
Mikhaïl Gorbatchev arrive au pouvoir en 1985 et lance la perestroïka et la glasnost. Le mur de Berlin tombe le 9 novembre 1989. L'URSS disparaît officiellement en 1991, ce qui marque la fin de la Guerre froide et la victoire du bloc occidental.`;

function genererDepuisForm() {
  const texte = $('#fTexte').value.trim();
  if (texte.split(/\s+/).length < 20) { alert('Colle un cours un peu plus long (au moins quelques phrases) 🙂'); return; }
  const detail = +$('#fDetail').value, nb = Math.max(2, Math.min(30, +$('#fNb').value || 8));
  const postits = resumer(texte, detail, nb);
  if (!postits.length) { alert('Je n’ai rien trouvé à résumer. Vérifie que tu as bien collé du texte.'); return; }
  const c = {
    id: uid(), matiereId: $('#fMat').value, date: Date.now(), postits, texte, detail, nb, glossaire: glossaire(texte),
    titre: $('#fTitre').value.trim() || (decouper(texte)[0]?.titre || 'Cours du ' + fmtDate(Date.now())),
  };
  db.cours.push(c);
  gagnerXp(25);
  journaliser('Cours ajouté : ' + c.titre, `${postits.length} post-it · ${matiere(c.matiereId)?.nom || ''}`);
  sauver();
  aller('cours', { mat: c.matiereId, coursId: c.id, tab: 'postits', filtre: 'tous' });
}

function regenerer(c) {
  if (!c.texte) { alert('Le texte original n’a pas été conservé pour ce cours (ajouté avec une ancienne version).'); return; }
  const d = +(prompt('Niveau de détail : 1 = court, 2 = moyen, 3 = détaillé', c.detail || 2) || 0);
  if (![1, 2, 3].includes(d)) return;
  const anciens = new Map(c.postits.map((p) => [p.titre, p]));
  c.postits = resumer(c.texte, d, c.nb || 8).map((p) => { const o = anciens.get(p.titre); return o ? Object.assign(p, { box: o.box, due: o.due, ok: o.ok, star: o.star }) : p; });
  c.detail = d; c.glossaire = glossaire(c.texte);
  journaliser('Résumé régénéré : ' + c.titre);
  sauver(); render();
}

const texteCours = (c) => c.titre + '\n\n' + c.postits.map((p) => '■ ' + p.titre + '\n' + p.points.map((t) => '  • ' + t).join('\n')).join('\n\n');

function exporterAnki(c) {
  const ligne = (p) => [p.titre, p.points.join(' | ')].map((s) => s.replace(/[\t\n\r]+/g, ' ')).join('\t');
  telecharger(c.postits.map(ligne).join('\n'), (c.titre.replace(/[^\p{L}\p{N}]+/gu, '_') || 'cours') + '-anki.txt', 'text/plain');
  toast('Fichier Anki téléchargé : importe-le dans Anki (séparateur : tabulation).');
}
function telecharger(contenu, nom, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([contenu], { type }));
  a.download = nom;
  a.click();
  URL.revokeObjectURL(a.href);
}
const sauvegarder = () => telecharger(JSON.stringify(db), 'postitbac-sauvegarde.json', 'application/json');

function basculerEdition(art) {
  const c = cours(art.dataset.c);
  const p = c?.postits.find((x) => x.id === art.dataset.p);
  if (!p) return;
  const h3 = art.querySelector('h3'), ul = art.querySelector('ul');
  if (h3.isContentEditable) {
    p.titre = h3.textContent.trim() || p.titre;
    const pts = [...ul.querySelectorAll('li')].map((li) => li.textContent.trim()).filter(Boolean);
    if (pts.length) p.points = pts;
    sauver(); render();
  } else {
    h3.contentEditable = ul.contentEditable = 'true';
    h3.focus();
    art.querySelector('[data-act="edit"]').textContent = '💾';
  }
}

function ajouterMatiere() {
  const nom = (prompt('Nom de la nouvelle matière ?') || '').trim();
  if (!nom) return;
  const emoji = (prompt('Un emoji pour la reconnaître ? (facultatif)', '📘') || '📘').trim() || '📘';
  const couleurs = ['#4c6ef5', '#15aabf', '#40c057', '#fd7e14', '#e64980', '#7950f2', '#fa5252', '#fab005'];
  const m = { id: uid(), nom, emoji, couleur: couleurs[db.matieres.length % couleurs.length], exam: '' };
  db.matieres.push(m);
  journaliser('Matière ajoutée : ' + nom);
  sauver();
  aller('mat', { mat: m.id });
}

function lireFichier(f) {
  if (!f) return;
  const r = new FileReader();
  r.onload = () => { $('#fTexte').value = String(r.result); if (!$('#fTitre').value) $('#fTitre').value = f.name.replace(/\.\w+$/, ''); majCompte(); };
  r.readAsText(f);
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.more summary')) document.querySelectorAll('.more[open]').forEach((d) => d.removeAttribute('open'));
  const mat = e.target.closest('[data-mat]');
  if (mat) { aller('mat', { mat: mat.dataset.mat }); return; }

  const nav = e.target.closest('[data-nav]')?.dataset.nav;
  if (nav) {
    if (nav === 'rev') demarrerRevision(db.cours, 'cartes', true);
    else if (nav === 'revTrous') demarrerRevision(db.cours, 'trous', true);
    else if (nav === 'revQcm') demarrerRevision(db.cours, 'qcm', true);
    else if (nav === 'addmat') ajouterMatiere();
    else if (nav === 'export') sauvegarder();
    else if (nav === 'import') $('#import').click();
    else aller(nav);
    return;
  }

  const tab = e.target.closest('[data-tab]')?.dataset.tab;
  if (tab) { ui.tab = tab; render(); return; }
  const filtre = e.target.closest('[data-filtre]')?.dataset.filtre;
  if (filtre) { ui.filtre = filtre; render(); return; }

  const art = e.target.closest('.postit');
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (art && act) {
    const c = cours(art.dataset.c);
    const p = c?.postits.find((x) => x.id === art.dataset.p);
    if (!p) return;
    if (act === 'ok') {
      if (p.ok) { p.box = 0; p.due = 0; p.ok = false; } else { p.box = 4; p.due = debutJour() + DELAIS[4] * JOUR; p.ok = true; journaliser('Post-it maîtrisé : ' + p.titre, c.titre); }
      sauver(); render();
    } else if (act === 'star') { p.star = !p.star; sauver(); render(); }
    else if (act === 'edit') basculerEdition(art);
    else if (act === 'del' && confirm('Supprimer ce post-it ?')) { c.postits = c.postits.filter((x) => x !== p); sauver(); render(); }
    return;
  }

  const ouvrir = e.target.closest('[data-open]');
  if (ouvrir) { aller('cours', { coursId: ouvrir.dataset.open, tab: 'postits', filtre: 'tous' }); return; }

  const c = cours(ui.coursId);
  switch (act) {
    case 'retour': e.preventDefault(); aller('mat', { mat: c ? c.matiereId : 'all' }); break;
    case 'generer': genererDepuisForm(); break;
    case 'exemple': $('#fTexte').value = EXEMPLE; $('#fTitre').value = 'La Guerre froide'; majCompte();
      { const h = db.matieres.find((m) => m.nom === 'Histoire-Géo'); if (h) $('#fMat').value = h.id; } break;
    case 'revision': demarrerRevision([c], 'cartes', false); break;
    case 'revTrous': demarrerRevision(c ? [c] : db.cours, 'trous', !c); break;
    case 'revQcm': demarrerRevision(c ? [c] : db.cours, 'qcm', !c); break;
    case 'revMat': demarrerRevision(db.cours.filter((x) => ui.mat === 'all' || x.matiereId === ui.mat), 'cartes', true); break;
    case 'copier': navigator.clipboard?.writeText(texteCours(c)).then(() => toast('Résumé copié !'), () => alert('Copie impossible sur ce navigateur.')); break;
    case 'imprimer': window.print(); break;
    case 'anki': exporterAnki(c); break;
    case 'regen': regenerer(c); break;
    case 'ajoutPostit': {
      const titre = (prompt('Titre du post-it ?') || '').trim(); if (!titre) break;
      const pt = (prompt('Ce que tu veux retenir ?') || '').trim(); if (!pt) break;
      c.postits.push({ id: uid(), titre, points: [pt], cles: [], ok: false, box: 0, due: 0, star: false }); sauver(); render(); break; }
    case 'renCours': { const t = (prompt('Nouveau titre ?', c.titre) || '').trim(); if (t) { c.titre = t; sauver(); render(); } break; }
    case 'delCours': if (confirm('Supprimer ce cours et tous ses post-it ?')) {
      db.cours = db.cours.filter((x) => x !== c); journaliser('Cours supprimé : ' + c.titre); sauver(); aller('mat', { mat: c.matiereId }); } break;
    case 'renMat': { const m = matiere(ui.mat); const t = (prompt('Nouveau nom ?', m.nom) || '').trim(); if (t) { m.nom = t; sauver(); render(); } break; }
    case 'delMat': { const m = matiere(ui.mat);
      if (confirm(`Supprimer « ${m.nom} » et ses cours ?`)) {
        db.cours = db.cours.filter((x) => x.matiereId !== m.id); db.matieres = db.matieres.filter((x) => x !== m);
        journaliser('Matière supprimée : ' + m.nom); sauver(); aller('mat', { mat: 'all' }); } break; }
    default:
  }
});

document.addEventListener('input', (e) => { if (e.target.id === 'fTexte') majCompte(); });
document.addEventListener('change', (e) => {
  if (e.target.id === 'fFichier') lireFichier(e.target.files[0]);
  if (e.target.matches('[data-exam]')) { const m = matiere(ui.mat); if (m) { m.exam = e.target.value; journaliser('Date d’examen : ' + m.nom, m.exam ? new Date(m.exam).toLocaleDateString('fr-FR') : 'supprimée'); sauver(); render(); } }
  if (e.target.id === 'fObjectif') { db.objectif = Math.max(1, Math.min(200, +e.target.value || 10)); sauver(); toast('Objectif mis à jour : ' + db.objectif + ' post-it par jour'); }
});
document.addEventListener('dragover', (e) => { if (e.target.id === 'fTexte') e.preventDefault(); });
document.addEventListener('drop', (e) => { if (e.target.id === 'fTexte') { e.preventDefault(); lireFichier(e.dataTransfer.files[0]); } });
$('#search').addEventListener('input', (e) => { ui.q = e.target.value; render(); });

/* ================= Mode révision (cartes, texte à trous, QCM) ================= */
const rv = { items: [], i: 0, vu: false, mode: 'cartes', bons: 0, xp: 0, q: null, repondu: false };
const rvPostit = (it) => { const c = cours(it.c); return { c, p: c.postits.find((x) => x.id === it.p) }; };
const melanger = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

function questionTrous(p, avecChoix) {
  for (const pt of p.points) {
    let m = null;
    for (const k of p.cles) {
      m = pt.match(new RegExp('(^|[^\\p{L}])(' + reEsc(k) + ')(?=$|[^\\p{L}])', 'iu'));
      if (m) { m = { i: m.index + m[1].length, rep: m[2], an: false }; break; }
    }
    if (!m) { const y = pt.match(ANNEE); if (y) m = { i: y.index, rep: y[1], an: true }; }
    if (!m) continue;
    const q = { avant: pt.slice(0, m.i), apres: pt.slice(m.i + m.rep.length), rep: m.rep, an: m.an };
    if (avecChoix) {
      let pool;
      if (m.an) pool = [-10, -5, -2, -1, 1, 2, 5, 10].map((d) => String(+m.rep + d));
      else pool = [...new Set(tousPostits().flatMap((x) => x.cles))].filter((w) => norm(w) !== norm(m.rep));
      if (pool.length < 3) return null;
      q.choix = melanger([m.rep, ...melanger(pool).slice(0, 3)]);
    }
    return q;
  }
  return null;
}

function demarrerRevision(liste, mode, seulementDus) {
  let items = liste.flatMap((c) => c.postits.filter((p) => !seulementDus || estDu(p)).map((p) => ({ c: c.id, p: p.id })));
  if (!items.length && seulementDus && liste.flatMap((c) => c.postits).length) {
    if (!confirm('Rien d’urgent aujourd’hui 🎉 Réviser quand même tous les post-it ?')) return;
    items = liste.flatMap((c) => c.postits.map((p) => ({ c: c.id, p: p.id })));
  }
  if (!items.length) { alert('Aucun post-it à réviser pour l’instant : ajoute d’abord un cours 🙂'); return; }
  Object.assign(rv, { items: melanger(items), i: 0, vu: false, mode, bons: 0, xp: 0, repondu: false });
  $('#modal').hidden = false;
  rvRender();
}

function rvFin() {
  const n = rv.items.length;
  journaliser('Révision terminée', `${rv.bons}/${n} réussis · ${rv.mode}`);
  sauver();
  $('#rProgress').textContent = 'Terminé 🎉';
  $('#rCarte').className = 'carte c2';
  $('#rCarte').innerHTML = `<h3>Bravo !</h3><p>${rv.bons} bonne(s) réponse(s) sur ${n}.<br>+${rv.xp} XP gagnés.</p><p>${rv.bons === n ? 'Sans faute ! 🔥' : 'Les post-it ratés reviendront demain.'}</p>`;
  $('#rActions').innerHTML = '<button class="btn primary" data-rv="fin">Fermer</button>';
}

function rvRender() {
  if (rv.i >= rv.items.length) { rvFin(); return; }
  const { c, p } = rvPostit(rv.items[rv.i]);
  rv.q = rv.mode === 'cartes' ? null : questionTrous(p, rv.mode === 'qcm');
  const mode = rv.q ? rv.mode : 'cartes';
  $('#rProgress').innerHTML = `Post-it ${rv.i + 1} / ${rv.items.length} — « ${esc(c.titre)} » <span class="hint">(${mode === 'cartes' ? 'cartes' : mode === 'trous' ? 'texte à trous' : 'QCM'})</span>`;
  $('#rCarte').className = 'carte c' + (rv.i % 6);
  rv.repondu = false;
  if (mode === 'cartes') {
    $('#rCarte').innerHTML = `<h3>${esc(p.titre)}</h3>` + (rv.vu
      ? `<ul>${p.points.map((t) => `<li>${surligner(t, p.cles)}</li>`).join('')}</ul>`
      : '<p class="cache">Essaie de te rappeler ce que tu sais sur ce titre, puis retourne le post-it… <small>(Espace)</small></p>');
    $('#rActions').innerHTML = rv.vu
      ? '<button class="btn" data-rv="non">🔁 À revoir <small>(2)</small></button><button class="btn primary" data-rv="oui">✅ Je sais <small>(1)</small></button>'
      : '<button class="btn primary" data-rv="voir">👀 Voir la réponse</button>';
    return;
  }
  const q = rv.q;
  const phrase = `${esc(q.avant)}<span class="blank">_____</span>${esc(q.apres)}`;
  $('#rCarte').innerHTML = `<h3>${esc(p.titre)}</h3><p>${phrase}</p>`;
  if (mode === 'trous') {
    $('#rActions').innerHTML = '<form id="rForm" class="inline"><input id="rRep" autocomplete="off" placeholder="Ta réponse…"><button class="btn primary">Valider</button></form>';
    $('#rRep').focus();
  } else {
    $('#rActions').innerHTML = `<div class="choix">${q.choix.map((x, k) => `<button class="btn" data-choix="${k}">${esc(x)}</button>`).join('')}</div>`;
  }
}

function rvRepondre(reponse) {
  if (rv.repondu) return;
  rv.repondu = true;
  const { p } = rvPostit(rv.items[rv.i]);
  const a = norm(reponse), b = norm(rv.q.rep);
  const bon = a === b || (b.length > 5 && lev(a, b) <= 1);
  const avant = aujourdhui();
  noter(p, bon);
  const k = cleJour(new Date());
  db.revisions[k] = avant + 1;
  rv.bons += bon ? 1 : 0;
  const gain = bon ? 10 : 3;
  rv.xp += gain; gagnerXp(gain);
  if (avant + 1 === db.objectif) { gagnerXp(20); rv.xp += 20; toast('🎯 Objectif du jour atteint ! +20 XP'); }
  sauver();
  $('#rCarte').innerHTML = `<h3>${esc(p.titre)}</h3><p class="${bon ? 'ok' : 'ko'}">${bon ? '✅ Bonne réponse !' : '❌ La réponse était : <b>' + esc(rv.q.rep) + '</b>'}</p>
    <p>${esc(rv.q.avant)}<mark>${esc(rv.q.rep)}</mark>${esc(rv.q.apres)}</p>`;
  $('#rActions').innerHTML = '<button class="btn primary" data-rv="suite">Suivant →</button>';
  $('#rActions button').focus();
}

function rvCartes(bon) {
  const { p } = rvPostit(rv.items[rv.i]);
  const avant = aujourdhui();
  noter(p, bon);
  db.revisions[cleJour(new Date())] = avant + 1;
  rv.bons += bon ? 1 : 0;
  const gain = bon ? 10 : 3;
  rv.xp += gain; gagnerXp(gain);
  if (avant + 1 === db.objectif) { gagnerXp(20); rv.xp += 20; toast('🎯 Objectif du jour atteint ! +20 XP'); }
  sauver();
  rv.i++; rv.vu = false;
  rvRender();
}

function fermerRevision() { $('#modal').hidden = true; render(); }

$('#modal').addEventListener('click', (e) => {
  const a = e.target.closest('[data-rv]')?.dataset.rv;
  if (e.target.id === 'modal' || e.target.id === 'fermer' || a === 'fin') { fermerRevision(); return; }
  const ch = e.target.closest('[data-choix]');
  if (ch) {
    rvRepondre(rv.q.choix[+ch.dataset.choix]);
    return;
  }
  if (!a) return;
  if (a === 'voir') { rv.vu = true; rvRender(); return; }
  if (a === 'suite') { rv.i++; rvRender(); return; }
  rvCartes(a === 'oui');
});
$('#modal').addEventListener('submit', (e) => { e.preventDefault(); if (e.target.id === 'rForm') rvRepondre($('#rRep').value); });
document.addEventListener('keydown', (e) => {
  if ($('#modal').hidden) return;
  if (e.key === 'Escape') { fermerRevision(); return; }
  if (rv.i >= rv.items.length || rv.q || rv.mode !== 'cartes' && rv.q) return;
  if (e.target.tagName === 'INPUT') return;
  if (!rv.vu && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); rv.vu = true; rvRender(); }
  else if (rv.vu && e.key === '1') rvCartes(true);
  else if (rv.vu && e.key === '2') rvCartes(false);
});

/* ================= Minuteur Focus (Pomodoro) ================= */
const foc = { run: false, mode: 'focus', total: 25 * 60, reste: 25 * 60, fin: 0, timer: null };
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

function bip() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(); o.frequency.value = 880; o.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.4);
  } catch (e) { /* pas de son */ }
}
function majFocus() {
  $('#focusBtn').textContent = foc.run ? `⏱ ${mmss(foc.reste)}` : '⏱ Focus';
  $('#fcTemps').textContent = mmss(foc.reste);
  $('#fcMode').textContent = foc.mode === 'focus' ? 'Concentration' : 'Pause';
  $('#fcGo').textContent = foc.run ? 'Pause' : 'Démarrer';
  $('#fcAuj').textContent = `${db.focus[cleJour(new Date())] || 0} min de focus aujourd’hui`;
}
function focusReglage(min, mode) {
  clearInterval(foc.timer);
  Object.assign(foc, { run: false, mode, total: min * 60, reste: min * 60 });
  majFocus();
}
function focusFini() {
  clearInterval(foc.timer);
  foc.run = false;
  bip();
  if (foc.mode === 'focus') {
    const min = Math.round(foc.total / 60), k = cleJour(new Date());
    db.focus[k] = (db.focus[k] || 0) + min;
    gagnerXp(min);
    journaliser('Session de focus terminée', min + ' min');
    sauver();
    toast(`⏱ ${min} min de focus ! Prends une pause 🙂`);
    focusReglage(5, 'pause');
  } else { toast('Pause terminée, on reprend ?'); focusReglage(25, 'focus'); }
  if (ui.view === 'dash' || ui.view === 'stats') render();
}
function focusBascule() {
  if (foc.run) { clearInterval(foc.timer); foc.run = false; majFocus(); return; }
  foc.run = true; foc.fin = Date.now() + foc.reste * 1000;
  foc.timer = setInterval(() => {
    foc.reste = Math.max(0, Math.ceil((foc.fin - Date.now()) / 1000));
    if (foc.reste === 0) focusFini(); else majFocus();
  }, 500);
  majFocus();
}
$('#focusBtn').addEventListener('click', () => { $('#focusPanel').hidden = !$('#focusPanel').hidden; });
$('#fcGo').addEventListener('click', focusBascule);
$('#fcReset').addEventListener('click', () => focusReglage(Math.round(foc.total / 60), foc.mode));
document.querySelectorAll('[data-fc]').forEach((b) => b.addEventListener('click', () => focusReglage(+b.dataset.fc, b.dataset.fm)));
document.addEventListener('click', (e) => { if (!e.target.closest('#focusPanel, #focusBtn')) $('#focusPanel').hidden = true; });

/* ================= Restauration ================= */
$('#import').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!Array.isArray(d.matieres) || !Array.isArray(d.cours)) throw new Error('format');
      if (!confirm('Remplacer tes cours actuels par cette sauvegarde ?')) return;
      db = normaliser(d); journaliser('Sauvegarde restaurée'); sauver(); aller('dash');
    } catch (err) { alert('Ce fichier n’est pas une sauvegarde PostItBac valide.'); }
  };
  r.readAsText(f);
  e.target.value = '';
});

majFocus();
render();
