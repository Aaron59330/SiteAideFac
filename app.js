'use strict';

/* ================= Données ================= */
const KEY = 'postitbac.v1';
const MATIERES_DEFAUT = [
  ['Maths', '📐', '#4c6ef5'], ['Physique-Chimie', '⚗️', '#15aabf'], ['SVT', '🧬', '#40c057'],
  ['Histoire-Géo', '🌍', '#fd7e14'], ['Français', '📖', '#e64980'], ['Philosophie', '🤔', '#7950f2'],
  ['Anglais', '🇬🇧', '#fa5252'], ['SES', '📊', '#fab005'], ['NSI', '💻', '#868e96'],
];
const uid = () => Math.random().toString(36).slice(2, 9);

function chargerDb() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.matieres) && Array.isArray(d.cours)) return d;
  } catch (e) { /* stockage indisponible ou vide */ }
  return { matieres: MATIERES_DEFAUT.map(([nom, emoji, couleur]) => ({ id: uid(), nom, emoji, couleur })), cours: [] };
}
let db = chargerDb();
function sauver() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { alert('Impossible de sauvegarder (stockage plein ou bloqué).'); }
}

const ui = { mat: 'all', view: 'home', coursId: null, q: '' };

/* ================= Utilitaires ================= */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const matiere = (id) => db.matieres.find((m) => m.id === id);
const cours = (id) => db.cours.find((c) => c.id === id);
const ROT = [-1.5, 1, -0.5, 1.8, -1, 0.6];
const fmtDate = (t) => new Date(t).toLocaleDateString('fr-FR');

/* ================= Résumé automatique ================= */
const STOP = new Set(('alors aucun aussi autre avant avec avoir bon car ce cela ces ceux chaque ci comme comment dans des du dedans dehors depuis devrait doit donc dos droite début elle elles en encore essai est et eu fait faites fois font hors ici il ils je juste la le les leur là ma maintenant mais mes mine moins mon mot même ni nommés notre nous nouveaux ou où par parce pas peut peu pièce plupart pour pourquoi quand que quel quelle quelles quels qui sa sans ses seulement si sien son sont sous soyez sujet sur ta tandis tellement tels tes ton tous tout trop très tu voient vont votre vous vu ça étaient état étions été être aux au une un cette cet ainsi après entre lors puis ses selon sera seront était étant ont ont-ils avait avaient aura auront sont suis es sommes êtes cependant toutefois pendant tant lequel lesquels notamment également permet permettre plus très bien déjà encore ainsi dont celui celle ceux celles quelque quelques autres même mêmes ceci cela chacun').split(/\s+/));

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

function postitHtml(p, i, c, opts = {}) {
  const sup = opts.crumb ? `<div class="crumb">${esc(matiere(c.matiereId)?.emoji || '')} ${esc(c.titre)}</div>` : '';
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
  const items = [`<button class="mat ${ui.mat === 'all' ? 'on' : ''}" data-mat="all">📚 Tous les cours <small>${db.cours.length}</small></button>`];
  db.matieres.forEach((m) => {
    const n = db.cours.filter((c) => c.matiereId === m.id).length;
    items.push(`<button class="mat ${ui.mat === m.id ? 'on' : ''}" data-mat="${m.id}">${esc(m.emoji)} ${esc(m.nom)} <small>${n || ''}</small></button>`);
  });
  $('#matieres').innerHTML = items.join('');
}

const progression = (c) => (c.postits.length ? Math.round(100 * c.postits.filter((p) => p.ok).length / c.postits.length) : 0);

function coursCard(c) {
  const m = matiere(c.matiereId);
  return `<div class="cours" data-open="${c.id}" style="--mc:${m ? m.couleur : '#888'}">
    <h3>${esc(c.titre)}</h3>
    <small>${esc(m ? m.emoji + ' ' + m.nom : 'Sans matière')} · ${c.postits.length} post-it · ${fmtDate(c.date)}</small>
    <div class="bar"><i style="width:${progression(c)}%"></i></div>
    <small>${progression(c)} % maîtrisé</small>
  </div>`;
}

function vueAccueil() {
  const m = ui.mat === 'all' ? null : matiere(ui.mat);
  let liste = db.cours.filter((c) => !m || c.matiereId === m.id).sort((a, b) => b.date - a.date);
  let html = `<div class="head"><div><h2>${m ? esc(m.emoji + ' ' + m.nom) : '📚 Tous mes cours'}</h2>
    <p class="sub">${liste.length ? 'Clique sur un cours pour voir ses post-it.' : ''}</p></div>
    ${m ? `<div class="actions"><button class="ghost" data-act="renMat">✏️ Renommer</button><button class="ghost danger" data-act="delMat">🗑️ Supprimer la matière</button></div>` : ''}</div>`;
  if (!liste.length) {
    html += `<div class="empty"><p style="font-size:3rem;margin:0">🗒️</p><p>Aucun cours ${m ? 'en ' + esc(m.nom) : ''} pour l’instant.</p>
      <button class="primary" data-act="new">＋ Ajouter mon premier cours</button></div>`;
  } else if (m) {
    html += `<div class="cours-list">${liste.map(coursCard).join('')}</div>`;
  } else {
    db.matieres.forEach((mm) => {
      const l = liste.filter((c) => c.matiereId === mm.id);
      if (l.length) html += `<h3 class="group-title">${esc(mm.emoji + ' ' + mm.nom)}</h3><div class="cours-list">${l.map(coursCard).join('')}</div>`;
    });
    const orph = liste.filter((c) => !matiere(c.matiereId));
    if (orph.length) html += `<h3 class="group-title">Sans matière</h3><div class="cours-list">${orph.map(coursCard).join('')}</div>`;
  }
  return html;
}

function vueRecherche() {
  const q = ui.q.toLowerCase();
  const res = [];
  db.cours.forEach((c) => c.postits.forEach((p, i) => {
    if ((p.titre + ' ' + p.points.join(' ') + ' ' + c.titre).toLowerCase().includes(q)) res.push({ c, p, i });
  }));
  return `<div class="head"><div><h2>🔎 « ${esc(ui.q)} »</h2><p class="sub">${res.length} post-it trouvé(s)</p></div></div>
    <div class="mur">${res.map((r) => postitHtml(r.p, r.i, r.c, { crumb: true })).join('')}</div>`;
}

function vueNouveau() {
  const defaut = ui.mat !== 'all' ? ui.mat : db.matieres[0]?.id;
  return `<div class="head"><div><h2>＋ Nouveau cours</h2><p class="sub">Colle ton cours, je le transforme en post-it rangés dans ta matière.</p></div></div>
  <div class="card">
    <div class="grid2">
      <div><label class="field" for="fMat">Matière</label>
        <select id="fMat">${db.matieres.map((m) => `<option value="${m.id}" ${m.id === defaut ? 'selected' : ''}>${esc(m.emoji + ' ' + m.nom)}</option>`).join('')}</select></div>
      <div><label class="field" for="fTitre">Titre du cours <span class="hint">(facultatif)</span></label>
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
      <button class="primary" data-act="generer">✨ Générer mes post-it</button>
      <button class="ghost" data-act="exemple">Essayer avec un exemple</button>
      <button class="ghost" data-act="annuler">Annuler</button>
    </div>
    <p class="count" id="fCompte"></p>
  </div>`;
}

function vueCours() {
  const c = cours(ui.coursId);
  if (!c) { ui.view = 'home'; return vueAccueil(); }
  const m = matiere(c.matiereId);
  return `<div class="head"><div>
      <p class="sub" style="margin:0"><a href="#" data-act="retour">← ${esc(m ? m.nom : 'Retour')}</a></p>
      <h2>${esc(c.titre)}</h2>
      <p class="sub">${esc(m ? m.emoji + ' ' + m.nom : '')} · ${c.postits.length} post-it · ${progression(c)} % maîtrisé</p></div>
    <div class="actions">
      <button class="primary" data-act="revision">🧠 Réviser</button>
      <button class="ghost" data-act="copier">📋 Copier</button>
      <button class="ghost" data-act="imprimer">🖨️ Imprimer / PDF</button>
      <button class="ghost" data-act="ajoutPostit">＋ Post-it</button>
      <button class="ghost" data-act="renCours">✏️ Renommer</button>
      <button class="ghost danger" data-act="delCours">🗑️ Supprimer</button>
    </div></div>
    <div class="mur">${c.postits.map((p, i) => postitHtml(p, i, c)).join('')}</div>`;
}

function render() {
  renderSide();
  $('#view').innerHTML = ui.q.trim() ? vueRecherche()
    : ui.view === 'new' ? vueNouveau()
    : ui.view === 'cours' ? vueCours() : vueAccueil();
  if (ui.view === 'new' && !ui.q.trim()) majCompte();
}

function majCompte() {
  const t = $('#fTexte');
  if (!t) return;
  const n = t.value.trim() ? t.value.trim().split(/\s+/).length : 0;
  $('#fCompte').textContent = n ? `${n} mots collés` : '';
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
  sauver();
  ui.mat = c.matiereId; ui.view = 'cours'; ui.coursId = c.id;
  render();
  window.scrollTo(0, 0);
}

function ouvrirCours(id) { ui.coursId = id; ui.view = 'cours'; ui.q = ''; $('#search').value = ''; render(); window.scrollTo(0, 0); }

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
  db.matieres.push(m); sauver(); ui.mat = m.id; ui.view = 'home'; render();
}

document.addEventListener('click', (e) => {
  const mat = e.target.closest('[data-mat]');
  if (mat) { ui.mat = mat.dataset.mat; ui.view = 'home'; ui.q = ''; $('#search').value = ''; render(); return; }

  const art = e.target.closest('.postit');
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (art && act) {
    const c = cours(art.dataset.c);
    const p = c?.postits.find((x) => x.id === art.dataset.p);
    if (!p) return;
    if (act === 'ok') { p.ok = !p.ok; sauver(); render(); }
    else if (act === 'edit') basculerEdition(art);
    else if (act === 'del' && confirm('Supprimer ce post-it ?')) { c.postits = c.postits.filter((x) => x !== p); sauver(); render(); }
    return;
  }

  const ouvrir = e.target.closest('[data-open]');
  if (ouvrir) { ouvrirCours(ouvrir.dataset.open); return; }

  const c = cours(ui.coursId);
  switch (act) {
    case 'new': ui.view = 'new'; render(); break;
    case 'annuler': case 'retour': e.preventDefault(); ui.view = 'home'; render(); break;
    case 'generer': genererDepuisForm(); break;
    case 'exemple': $('#fTexte').value = EXEMPLE; $('#fTitre').value = 'La Guerre froide'; majCompte();
      { const h = db.matieres.find((m) => m.nom === 'Histoire-Géo'); if (h) $('#fMat').value = h.id; } break;
    case 'revision': demarrerRevision(c); break;
    case 'copier': navigator.clipboard?.writeText(texteCours(c)).then(() => alert('Copié ! Tu peux le coller où tu veux.'), () => alert('Copie impossible sur ce navigateur.')); break;
    case 'imprimer': window.print(); break;
    case 'ajoutPostit': {
      const titre = (prompt('Titre du post-it ?') || '').trim(); if (!titre) break;
      const pt = (prompt('Ce que tu veux retenir ?') || '').trim(); if (!pt) break;
      c.postits.push({ id: uid(), titre, points: [pt], cles: [], ok: false }); sauver(); render(); break; }
    case 'renCours': { const t = (prompt('Nouveau titre ?', c.titre) || '').trim(); if (t) { c.titre = t; sauver(); render(); } break; }
    case 'delCours': if (confirm('Supprimer ce cours et tous ses post-it ?')) { db.cours = db.cours.filter((x) => x !== c); sauver(); ui.view = 'home'; render(); } break;
    case 'renMat': { const m = matiere(ui.mat); const t = (prompt('Nouveau nom ?', m.nom) || '').trim(); if (t) { m.nom = t; sauver(); render(); } break; }
    case 'delMat': { const m = matiere(ui.mat);
      if (confirm(`Supprimer « ${m.nom} » et ses cours ?`)) { db.cours = db.cours.filter((x) => x.matiereId !== m.id); db.matieres = db.matieres.filter((x) => x !== m); sauver(); ui.mat = 'all'; render(); } break; }
    default:
  }
});

document.addEventListener('input', (e) => { if (e.target.id === 'fTexte') majCompte(); });
$('#addMat').addEventListener('click', ajouterMatiere);
$('#newCours').addEventListener('click', () => { ui.view = 'new'; ui.q = ''; $('#search').value = ''; render(); });
$('#search').addEventListener('input', (e) => { ui.q = e.target.value; render(); });

/* ================= Mode révision ================= */
const rv = { c: null, ids: [], i: 0, vu: false };

function demarrerRevision(c) {
  const aRevoir = c.postits.filter((p) => !p.ok);
  const liste = aRevoir.length ? aRevoir : c.postits;
  if (!liste.length) return;
  rv.c = c; rv.ids = liste.map((p) => p.id); rv.i = 0; rv.vu = false;
  $('#modal').hidden = false;
  rvRender();
}

function rvRender() {
  const c = rv.c;
  if (rv.i >= rv.ids.length) {
    $('#rProgress').textContent = 'Terminé 🎉';
    $('#rCarte').className = 'carte c2';
    $('#rCarte').innerHTML = `<h3>Bravo !</h3><p>Tu as fait le tour. Maîtrisé : ${progression(c)} %.</p>`;
    $('#rActions').innerHTML = '<button class="primary" data-rv="fin">Fermer</button>';
    render();
    return;
  }
  const p = c.postits.find((x) => x.id === rv.ids[rv.i]);
  $('#rProgress').textContent = `Post-it ${rv.i + 1} / ${rv.ids.length} — « ${c.titre} »`;
  $('#rCarte').className = 'carte c' + (rv.i % 6);
  $('#rCarte').innerHTML = `<h3>${esc(p.titre)}</h3>` + (rv.vu
    ? `<ul>${p.points.map((t) => `<li>${surligner(t, p.cles)}</li>`).join('')}</ul>`
    : '<p class="cache">Essaie de te rappeler ce que tu sais sur ce titre, puis retourne le post-it…</p>');
  $('#rActions').innerHTML = rv.vu
    ? '<button data-rv="non">🔁 À revoir</button><button class="primary" data-rv="oui">✅ Je sais</button>'
    : '<button class="primary" data-rv="voir">👀 Voir la réponse</button>';
}

$('#modal').addEventListener('click', (e) => {
  const a = e.target.closest('[data-rv]')?.dataset.rv;
  if (e.target.id === 'modal' || e.target.id === 'fermer' || a === 'fin') { $('#modal').hidden = true; render(); return; }
  if (!a) return;
  if (a === 'voir') { rv.vu = true; rvRender(); return; }
  const p = rv.c.postits.find((x) => x.id === rv.ids[rv.i]);
  p.ok = a === 'oui';
  sauver();
  rv.i++; rv.vu = false;
  rvRender();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { $('#modal').hidden = true; } });

/* ================= Sauvegarde / restauration ================= */
$('#export').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(db)], { type: 'application/json' }));
  a.download = 'postitbac-sauvegarde.json';
  a.click();
  URL.revokeObjectURL(a.href);
});
$('#import').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!Array.isArray(d.matieres) || !Array.isArray(d.cours)) throw new Error('format');
      if (!confirm('Remplacer tes cours actuels par cette sauvegarde ?')) return;
      db = d; sauver(); ui.mat = 'all'; ui.view = 'home'; render();
    } catch (err) { alert('Ce fichier n’est pas une sauvegarde PostItBac valide.'); }
  };
  r.readAsText(f);
  e.target.value = '';
});

render();
