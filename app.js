'use strict';

/* ================= Données ================= */
const KEY = 'postitbac.v1';
const MATIERES_DEFAUT = [
  ['Maths', '📐', '#4c6ef5'], ['Physique-Chimie', '⚗️', '#15aabf'], ['SVT', '🧬', '#40c057'],
  ['Histoire-Géo', '🌍', '#fd7e14'], ['Français', '📖', '#e64980'], ['Philosophie', '🤔', '#7950f2'],
  ['Anglais', '🇬🇧', '#fa5252'], ['SES', '📊', '#fab005'], ['NSI', '💻', '#868e96'],
];
const uid = () => Math.random().toString(36).slice(2, 9);

function normaliser(d) {
  d.journal = Array.isArray(d.journal) ? d.journal : [];
  d.revisions = d.revisions && typeof d.revisions === 'object' ? d.revisions : {};
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

const ui = { view: 'dash', mat: 'all', coursId: null, q: '' };

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
  return { id: uid(), titre, points: choix.map((c) => raccourcir(c.t)), cles, ok: false };
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

function postitHtml(p, i, c, opts = {}) {
  const m = matiere(c.matiereId);
  const sup = opts.crumb ? `<div class="crumb-p">${esc(m?.emoji || '')} ${esc(c.titre)}</div>` : '';
  return `<article class="postit c${i % 6}${p.ok ? ' done' : ''}" style="--rot:${ROT[i % 6]}deg" data-c="${c.id}" data-p="${p.id}">
    <div class="tools">
      <button data-act="ok" title="${p.ok ? 'Marquer à revoir' : 'Je sais ce post-it'}">${p.ok ? '✅' : '⬜'}</button>
      <button data-act="edit" title="Modifier">✏️</button>
      <button data-act="del" title="Supprimer">🗑️</button>
    </div>
    <h3>${esc(p.titre)}</h3>
    <ul>${p.points.map((t) => `<li>${surligner(t, p.cles)}</li>`).join('')}</ul>${sup}
  </article>`;
}

function renderSide() {
  const nav = (v, ic, txt, on, extra = '') => `<button class="nav ${on ? 'on' : ''}" ${extra}><span class="ic">${ic}</span>${txt}</button>`;
  const mats = db.matieres.map((m) => {
    const n = db.cours.filter((c) => c.matiereId === m.id).length;
    return `<button class="nav ${ui.view === 'mat' && ui.mat === m.id ? 'on' : ''}" data-mat="${m.id}"><span class="ic">${esc(m.emoji)}</span>${esc(m.nom)}<small>${n || ''}</small></button>`;
  }).join('');
  $('#side').innerHTML = `
    <div class="logo">PostIt<span>Bac</span></div>
    <div class="switcher"><span>🎓 Mon espace de révision</span></div>
    <div class="sec">Général</div>
    ${nav('dash', '⌂', 'Dashboard', ui.view === 'dash', 'data-nav="dash"')}
    ${nav('journal', '☰', 'Journal d’activités', ui.view === 'journal', 'data-nav="journal"')}
    ${nav('stats', '⟋', 'Statistiques', ui.view === 'stats', 'data-nav="stats"')}
    <div class="sec">Cours</div>
    ${nav('new', '＋', 'Nouveau cours', ui.view === 'new', 'data-nav="new"')}
    ${nav('all', '▦', 'Tous mes cours', ui.view === 'mat' && ui.mat === 'all', 'data-mat="all"')}
    ${nav('rev', '🧠', 'Réviser', false, 'data-nav="rev"')}
    <div class="sec">Matières</div>
    ${mats}
    ${nav('addmat', '＋', 'Nouvelle matière', false, 'data-nav="addmat"')}
    <div class="sec">Données</div>
    ${nav('export', '⬇', 'Sauvegarder', false, 'data-nav="export"')}
    ${nav('import', '⬆', 'Restaurer', false, 'data-nav="import"')}`;
}

function coursCard(c) {
  const m = matiere(c.matiereId);
  return `<div class="cours" data-open="${c.id}" style="--mc:${m ? m.couleur : '#888'}">
    <h3>${esc(c.titre)}</h3>
    <small>${esc(m ? m.emoji + ' ' + m.nom : 'Sans matière')} · ${c.postits.length} post-it · ${fmtDate(c.date)}</small>
    <div class="bar"><i style="width:${progression(c)}%"></i></div>
    <small>${progression(c)} % maîtrisé</small>
  </div>`;
}

const logHtml = (liste) => `<ul class="log">${liste.map((j) => `<li><b>${esc(j.titre)}</b><small>${depuis(j.t)}${j.detail ? ' · ' + esc(j.detail) : ''}</small></li>`).join('')}</ul>`;
const entete = (titre, sous, pill) => `<div class="head"><div><h2>${titre}</h2><p class="sub">${sous}</p></div>${pill || ''}</div>`;

function vueDash() {
  const ps = tousPostits();
  const aRevoir = ps.filter((p) => !p.ok).length;
  const ok = ps.length - aRevoir;
  const pct = ps.length ? Math.round(100 * ok / ps.length) : 0;
  const s = serie();
  const aujourdhui = db.revisions[cleJour(new Date())] || 0;
  return entete('Tableau de bord', 'Gestion de ton espace de révision', `<span class="pill ${aRevoir ? 'warn' : ''}">${aRevoir ? 'À réviser' : 'À jour'}</span>`) + `
  <div class="tiles">
    <div class="tile"><span>Cours</span><b>${db.cours.length}</b><small>${db.matieres.filter((m) => db.cours.some((c) => c.matiereId === m.id)).length} matière(s) utilisée(s)</small></div>
    <div class="tile"><span>Post-it</span><b>${ps.length}</b><small>${aRevoir} à revoir</small></div>
    <div class="tile"><span>Maîtrisés</span><b>${pct} %</b><small>${ok} post-it sus</small></div>
    <div class="tile"><span>Série de révision</span><b>${s} jour${s > 1 ? 's' : ''}</b><small>${aujourdhui} post-it révisés aujourd’hui</small></div>
  </div>
  <div class="cols">
    <div class="col">
      <div class="card"><h3>État de tes révisions</h3>
        <div class="status"><strong><i class="dot"></i>${aRevoir ? aRevoir + ' post-it à revoir' : ps.length ? 'Tout est maîtrisé 🎉' : 'Aucun cours pour l’instant'}</strong>
          <button class="btn" data-nav="rev">Lancer une révision</button></div>
        <div class="actions"><button class="btn primary" data-nav="new">＋ Nouveau cours</button></div>
        <p class="muted">${db.cours.length ? 'Dernier cours : ' + esc([...db.cours].sort((a, b) => b.date - a.date)[0].titre) : 'Colle ton premier cours pour commencer.'}</p></div>
      <div class="card"><h3>Post-it révisés (14 jours)</h3>${graphique(14)}</div>
      <div class="card"><h3>Actions rapides</h3>
        <button class="row" data-nav="new"><span><b>Ajouter un cours</b><small>Colle ton cours, reçois des post-it</small></span>→</button>
        <button class="row" data-nav="rev"><span><b>Réviser tout</b><small>Les post-it que tu ne sais pas encore</small></span>→</button>
        <button class="row" data-nav="export"><span><b>Sauvegarder mes cours</b><small>Télécharger une copie de tout</small></span>→</button></div>
    </div>
    <div class="col"><div class="card">
      <div class="card-head"><h3>Journal d’activités</h3><a data-nav="journal">Voir tout →</a></div>
      ${db.journal.length ? logHtml(db.journal.slice(0, 8)) : '<p class="muted">Rien pour l’instant. Tes actions apparaîtront ici.</p>'}
    </div></div>
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
    return `<tr><td>${esc(m.emoji + ' ' + m.nom)}</td><td>${cs.length}</td><td>${ps.length}</td>
      <td><div class="bar"><i style="width:${pct}%"></i></div></td><td>${pct} %</td></tr>`;
  }).join('');
  const total = Object.values(db.revisions).reduce((a, b) => a + b, 0);
  return entete('Statistiques', `${total} post-it révisés au total · série actuelle : ${serie()} jour(s)`) + `
    <div class="card"><h3>Post-it révisés (30 jours)</h3>${graphique(30)}</div>
    <div class="card" style="margin-top:16px"><h3>Progression par matière</h3>
      <table><tr><th>Matière</th><th>Cours</th><th>Post-it</th><th>Progression</th><th></th></tr>${lignes}</table></div>`;
}

function vueMat() {
  const m = ui.mat === 'all' ? null : matiere(ui.mat);
  const liste = db.cours.filter((c) => !m || c.matiereId === m.id).sort((a, b) => b.date - a.date);
  let html = `<div class="head"><div><h2>${m ? esc(m.emoji + ' ' + m.nom) : 'Tous mes cours'}</h2>
    <p class="sub">${liste.length ? liste.length + ' cours · clique pour voir les post-it' : ''}</p></div>
    <div class="actions"><button class="btn primary" data-nav="new">＋ Nouveau cours</button>
    ${liste.length ? '<button class="btn" data-act="revMat">🧠 Réviser</button>' : ''}
    ${m ? '<button class="btn ghost" data-act="renMat">✏️ Renommer</button><button class="btn ghost danger" data-act="delMat">🗑️ Supprimer</button>' : ''}</div></div>`;
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
    <label class="field" for="fTexte">Ton cours</label>
    <textarea id="fTexte" rows="13" placeholder="Copie-colle ton cours entier ici…&#10;&#10;Astuce : si tes titres sont sur leur propre ligne (I. Les causes, 1) …, MAJUSCULES), chaque titre devient un post-it."></textarea>
    <div class="grid2">
      <div><label class="field" for="fDetail">Détail des post-it</label>
        <select id="fDetail"><option value="1">Court (l’essentiel)</option><option value="2" selected>Moyen</option><option value="3">Détaillé</option></select></div>
      <div><label class="field" for="fNb">Nombre de post-it <span class="hint">(si le cours n’a pas de titres)</span></label>
        <input id="fNb" type="number" min="2" max="30" value="8"></div>
    </div>
    <div class="actions">
      <button class="btn primary" data-act="generer">✨ Générer mes post-it</button>
      <button class="btn" data-act="exemple">Essayer avec un exemple</button>
    </div>
    <p class="count" id="fCompte"></p>
  </div>`;
}

function vueCours() {
  const c = cours(ui.coursId);
  if (!c) { ui.view = 'dash'; return vueDash(); }
  const m = matiere(c.matiereId);
  return `<div class="head"><div>
      <p class="sub" style="margin:0 0 4px"><a href="#" data-act="retour">← ${esc(m ? m.nom : 'Retour')}</a></p>
      <h2>${esc(c.titre)}</h2>
      <p class="sub">${esc(m ? m.emoji + ' ' + m.nom : '')} · ${c.postits.length} post-it · ${progression(c)} % maîtrisé</p></div>
    <div class="actions">
      <button class="btn primary" data-act="revision">🧠 Réviser</button>
      <button class="btn" data-act="copier">📋 Copier</button>
      <button class="btn" data-act="imprimer">🖨️ Imprimer / PDF</button>
      <button class="btn" data-act="ajoutPostit">＋ Post-it</button>
      <button class="btn ghost" data-act="renCours">✏️ Renommer</button>
      <button class="btn ghost danger" data-act="delCours">🗑️ Supprimer</button>
    </div></div>
    <div class="mur">${c.postits.map((p, i) => postitHtml(p, i, c)).join('')}</div>`;
}

function fil() {
  if (ui.q.trim()) return ['Recherche', esc(ui.q)];
  const m = matiere(ui.mat);
  switch (ui.view) {
    case 'journal': return ['Général', 'Journal d’activités'];
    case 'stats': return ['Général', 'Statistiques'];
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
    : { dash: vueDash, journal: vueJournal, stats: vueStats, mat: vueMat, new: vueNouveau, cours: vueCours }[ui.view]();
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
  const postits = resumer(texte, +$('#fDetail').value, Math.max(2, Math.min(30, +$('#fNb').value || 8)));
  if (!postits.length) { alert('Je n’ai rien trouvé à résumer. Vérifie que tu as bien collé du texte.'); return; }
  const c = {
    id: uid(), matiereId: $('#fMat').value, date: Date.now(), postits,
    titre: $('#fTitre').value.trim() || (decouper(texte)[0]?.titre || 'Cours du ' + fmtDate(Date.now())),
  };
  db.cours.push(c);
  journaliser('Cours ajouté : ' + c.titre, `${postits.length} post-it · ${matiere(c.matiereId)?.nom || ''}`);
  sauver();
  aller('cours', { mat: c.matiereId, coursId: c.id });
}


function texteCours(c) {
  return c.titre + '\n\n' + c.postits.map((p) => '■ ' + p.titre + '\n' + p.points.map((t) => '  • ' + t).join('\n')).join('\n\n');
}

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
  const m = { id: uid(), nom, emoji, couleur: couleurs[db.matieres.length % couleurs.length] };
  db.matieres.push(m);
  journaliser('Matière ajoutée : ' + nom);
  sauver();
  aller('mat', { mat: m.id });
}

function sauvegarder() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(db)], { type: 'application/json' }));
  a.download = 'postitbac-sauvegarde.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

document.addEventListener('click', (e) => {
  const mat = e.target.closest('[data-mat]');
  if (mat) { aller('mat', { mat: mat.dataset.mat }); return; }

  const nav = e.target.closest('[data-nav]')?.dataset.nav;
  if (nav) {
    if (nav === 'rev') demarrerRevision(db.cours);
    else if (nav === 'addmat') ajouterMatiere();
    else if (nav === 'export') sauvegarder();
    else if (nav === 'import') $('#import').click();
    else aller(nav);
    return;
  }

  const art = e.target.closest('.postit');
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (art && act) {
    const c = cours(art.dataset.c);
    const p = c?.postits.find((x) => x.id === art.dataset.p);
    if (!p) return;
    if (act === 'ok') { p.ok = !p.ok; if (p.ok) journaliser('Post-it maîtrisé : ' + p.titre, c.titre); sauver(); render(); }
    else if (act === 'edit') basculerEdition(art);
    else if (act === 'del' && confirm('Supprimer ce post-it ?')) { c.postits = c.postits.filter((x) => x !== p); sauver(); render(); }
    return;
  }

  const ouvrir = e.target.closest('[data-open]');
  if (ouvrir) { aller('cours', { coursId: ouvrir.dataset.open }); return; }

  const c = cours(ui.coursId);
  switch (act) {
    case 'retour': e.preventDefault(); aller('mat', { mat: c ? c.matiereId : 'all' }); break;
    case 'generer': genererDepuisForm(); break;
    case 'exemple': $('#fTexte').value = EXEMPLE; $('#fTitre').value = 'La Guerre froide'; majCompte();
      { const h = db.matieres.find((m) => m.nom === 'Histoire-Géo'); if (h) $('#fMat').value = h.id; } break;
    case 'revision': demarrerRevision([c]); break;
    case 'revMat': demarrerRevision(db.cours.filter((x) => ui.mat === 'all' || x.matiereId === ui.mat)); break;
    case 'copier': navigator.clipboard?.writeText(texteCours(c)).then(() => alert('Copié ! Tu peux le coller où tu veux.'), () => alert('Copie impossible sur ce navigateur.')); break;
    case 'imprimer': window.print(); break;
    case 'ajoutPostit': {
      const titre = (prompt('Titre du post-it ?') || '').trim(); if (!titre) break;
      const pt = (prompt('Ce que tu veux retenir ?') || '').trim(); if (!pt) break;
      c.postits.push({ id: uid(), titre, points: [pt], cles: [], ok: false }); sauver(); render(); break; }
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
$('#search').addEventListener('input', (e) => { ui.q = e.target.value; render(); });

/* ================= Mode révision ================= */
const rv = { items: [], i: 0, vu: false };
const rvPostit = (it) => { const c = cours(it.c); return { c, p: c.postits.find((x) => x.id === it.p) }; };

function demarrerRevision(liste) {
  let items = liste.flatMap((c) => c.postits.filter((p) => !p.ok).map((p) => ({ c: c.id, p: p.id })));
  if (!items.length) items = liste.flatMap((c) => c.postits.map((p) => ({ c: c.id, p: p.id })));
  if (!items.length) { alert('Aucun post-it à réviser pour l’instant : ajoute d’abord un cours 🙂'); return; }
  if (liste.length > 1) items.sort(() => Math.random() - 0.5);
  Object.assign(rv, { items, i: 0, vu: false });
  $('#modal').hidden = false;
  rvRender();
}

function rvRender() {
  if (rv.i >= rv.items.length) {
    journaliser('Révision terminée', rv.items.length + ' post-it');
    sauver();
    $('#rProgress').textContent = 'Terminé 🎉';
    $('#rCarte').className = 'carte c2';
    $('#rCarte').innerHTML = `<h3>Bravo !</h3><p>Tu as fait le tour de ${rv.items.length} post-it.</p>`;
    $('#rActions').innerHTML = '<button class="btn primary" data-rv="fin">Fermer</button>';
    return;
  }
  const { c, p } = rvPostit(rv.items[rv.i]);
  $('#rProgress').textContent = `Post-it ${rv.i + 1} / ${rv.items.length} — « ${c.titre} »`;
  $('#rCarte').className = 'carte c' + (rv.i % 6);
  $('#rCarte').innerHTML = `<h3>${esc(p.titre)}</h3>` + (rv.vu
    ? `<ul>${p.points.map((t) => `<li>${surligner(t, p.cles)}</li>`).join('')}</ul>`
    : '<p class="cache">Essaie de te rappeler ce que tu sais sur ce titre, puis retourne le post-it…</p>');
  $('#rActions').innerHTML = rv.vu
    ? '<button class="btn" data-rv="non">🔁 À revoir</button><button class="btn primary" data-rv="oui">✅ Je sais</button>'
    : '<button class="btn primary" data-rv="voir">👀 Voir la réponse</button>';
}

function fermerRevision() { $('#modal').hidden = true; render(); }

$('#modal').addEventListener('click', (e) => {
  const a = e.target.closest('[data-rv]')?.dataset.rv;
  if (e.target.id === 'modal' || e.target.id === 'fermer' || a === 'fin') { fermerRevision(); return; }
  if (!a) return;
  if (a === 'voir') { rv.vu = true; rvRender(); return; }
  const { p } = rvPostit(rv.items[rv.i]);
  p.ok = a === 'oui';
  const k = cleJour(new Date());
  db.revisions[k] = (db.revisions[k] || 0) + 1;
  sauver();
  rv.i++; rv.vu = false;
  rvRender();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modal').hidden) fermerRevision(); });

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

render();
