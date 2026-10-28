'use strict';
/* ============================================================
   Tableur : graphiques
   ============================================================ */

const TYPES_GRAPH = {
  bar: 'Histogramme', barh: 'Barres horizontales', stack: 'Histogramme empilé', line: 'Courbes', area: 'Aires',
  scatter: 'Nuage de points', pie: 'Camembert', donut: 'Anneau',
};

function donneesGraph(F, plage, type) {
  const R = parsePlage(plage);
  if (!R) return null;
  const M = [];
  for (let r = R.r1; r <= R.r2; r++) { const row = []; for (let c = R.c1; c <= R.c2; c++) row.push(valCell(sh.ctx, F, r, c)); M.push(row); }
  if (M.length < 2 || M[0].length < 1) return null;
  const entete = M[0].some((x) => typeof x === 'string') && M.length > 1;
  const corps = entete ? M.slice(1) : M;
  const etiq = M[0].length > 1 && (type === 'scatter' ? corps.every((row) => typeof row[0] === 'number') : corps.every((row) => typeof row[0] !== 'number'));
  const debut = etiq ? 1 : 0, series = [];
  for (let c = debut; c < M[0].length; c++) series.push({ nom: entete ? texte(M[0][c]) || 'Série ' + (c - debut + 1) : 'Série ' + (c - debut + 1), v: corps.map((row) => (typeof row[c] === 'number' ? row[c] : 0)) });
  if (!series.length) return null;
  return { labels: corps.map((row, i) => (etiq ? texte(row[0]) : String(i + 1))), xs: etiq && type === 'scatter' ? corps.map((row) => row[0]) : corps.map((_, i) => i + 1), series };
}

function echelle(mn, mx, nb = 5) {
  if (mx === mn) { mx = mn + 1; }
  const brut = (mx - mn) / nb, e = Math.pow(10, Math.floor(Math.log10(brut))), r = brut / e;
  const pas = (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * e;
  return { bas: Math.floor(mn / pas) * pas, haut: Math.ceil(mx / pas) * pas, pas };
}
const nf = (x) => fmtNombre(parseFloat(x.toPrecision(6)));

function svgGraph(g, d) {
  const W = 640, H = 330, mg = { l: 54, r: 18, t: 18, b: 52 };
  const type = g.type, leg = g.legende !== false, etiq = !!g.etiq;
  const col = (i) => PALETTE[i % PALETTE.length];
  const legende = (items, y) => (leg ? items.map((nom, i) => {
    const x = mg.l + i * Math.min(140, (W - mg.l - mg.r) / items.length);
    return `<g><rect x="${x}" y="${y - 9}" width="10" height="10" rx="2" fill="${col(i)}"/><text x="${x + 15}" y="${y}" fill="#aaa" font-size="11">${esc(nom.length > 16 ? nom.slice(0, 15) + '…' : nom)}</text></g>`;
  }).join('') : '');
  const titreAxe = (sx, sy, t, rot) => (t ? `<text x="${sx}" y="${sy}" fill="#8d8d96" font-size="11" text-anchor="middle"${rot ? ` transform="rotate(-90 ${sx} ${sy})"` : ''}>${esc(t)}</text>` : '');

  if (type === 'pie' || type === 'donut') {
    const vals = d.series[0].v.map((x) => Math.max(0, x)), tot = vals.reduce((s, x) => s + x, 0);
    if (!tot) return '<p class="muted">Pas de données positives à afficher.</p>';
    const cx = 160, cy = 165, R = 120, ri = type === 'donut' ? 62 : 0;
    let ang = -Math.PI / 2, s = '';
    vals.forEach((v, i) => {
      if (!v) return;
      const a2 = ang + (v / tot) * 2 * Math.PI, grand = a2 - ang > Math.PI ? 1 : 0;
      const p = (a, r) => `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
      if (v === tot) s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${col(i)}"/>${ri ? `<circle cx="${cx}" cy="${cy}" r="${ri}" fill="#111113"/>` : ''}`;
      else s += `<path d="M${p(ang, R)} A${R},${R} 0 ${grand} 1 ${p(a2, R)} ${ri ? `L${p(a2, ri)} A${ri},${ri} 0 ${grand} 0 ${p(ang, ri)}` : `L${cx},${cy}`} Z" fill="${col(i)}" stroke="#111113" stroke-width="2"><title>${esc(d.labels[i])} : ${nf(v)}</title></path>`;
      if (etiq && v / tot > 0.04) { const am = (ang + a2) / 2, rr = ri ? (R + ri) / 2 : R * 0.65; s += `<text x="${cx + rr * Math.cos(am)}" y="${cy + rr * Math.sin(am) + 4}" fill="#111" font-size="11" text-anchor="middle" font-weight="700">${Math.round(100 * v / tot)}%</text>`; }
      ang = a2;
    });
    const lg = d.labels.map((l, i) => `<g><rect x="330" y="${34 + i * 22 - 9}" width="10" height="10" rx="2" fill="${col(i)}"/><text x="346" y="${34 + i * 22}" fill="#aaa" font-size="12">${esc(l)} — ${Math.round(100 * vals[i] / tot)} % (${nf(vals[i])})</text></g>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" role="img">${s}${leg ? lg : ''}</svg>`;
  }

  const horizontal = type === 'barh', pile = type === 'stack';
  let mn, mx;
  if (type === 'scatter') {
    const all = d.series.flatMap((x) => x.v);
    mn = Math.min(0, ...all); mx = Math.max(...all, 1);
  } else if (pile) {
    const tops = d.labels.map((_, i) => d.series.reduce((s, x) => s + Math.max(0, x.v[i]), 0)), bots = d.labels.map((_, i) => d.series.reduce((s, x) => s + Math.min(0, x.v[i]), 0));
    mn = Math.min(0, ...bots); mx = Math.max(...tops, 1);
  } else {
    const all = d.series.flatMap((x) => x.v);
    mn = Math.min(0, ...all); mx = Math.max(0, ...all) || 1;
  }
  const E2 = echelle(mn, mx);
  const L = horizontal ? { l: 90, r: 18, t: 18, b: 40 } : mg;
  const iw = W - L.l - L.r, ih = H - L.t - L.b;
  const yv = (v) => L.t + ih * (1 - (v - E2.bas) / (E2.haut - E2.bas));
  const xv = (v) => L.l + iw * ((v - E2.bas) / (E2.haut - E2.bas));
  let s = '';
  for (let v = E2.bas; v <= E2.haut + 1e-9; v += E2.pas) {
    if (horizontal) s += `<line x1="${xv(v)}" x2="${xv(v)}" y1="${L.t}" y2="${H - L.b}" stroke="#24242a"/><text x="${xv(v)}" y="${H - L.b + 14}" fill="#8d8d96" font-size="10" text-anchor="middle">${nf(v)}</text>`;
    else s += `<line x1="${L.l}" x2="${W - L.r}" y1="${yv(v)}" y2="${yv(v)}" stroke="#24242a"/><text x="${L.l - 6}" y="${yv(v) + 4}" fill="#8d8d96" font-size="10" text-anchor="end">${nf(v)}</text>`;
  }
  const n = d.labels.length;
  if (type === 'scatter') {
    const xs = d.xs, ex = echelle(Math.min(...xs), Math.max(...xs));
    const xp = (v) => L.l + iw * ((v - ex.bas) / (ex.haut - ex.bas));
    for (let v = ex.bas; v <= ex.haut + 1e-9; v += ex.pas) s += `<line x1="${xp(v)}" x2="${xp(v)}" y1="${L.t}" y2="${H - L.b}" stroke="#1c1c22"/><text x="${xp(v)}" y="${H - L.b + 14}" fill="#8d8d96" font-size="10" text-anchor="middle">${nf(v)}</text>`;
    d.series.forEach((se, si) => {
      se.v.forEach((v, i) => { s += `<circle cx="${xp(xs[i])}" cy="${yv(v)}" r="4" fill="${col(si)}"><title>${nf(xs[i])} ; ${nf(v)}</title></circle>`; });
      if (g.tend && xs.length > 1) {
        const m = xs.reduce((a, b) => a + b, 0) / xs.length, my = se.v.reduce((a, b) => a + b, 0) / xs.length;
        const sxx = xs.reduce((a, x) => a + (x - m) ** 2, 0), sxy = xs.reduce((a, x, i) => a + (x - m) * (se.v[i] - my), 0);
        if (sxx) { const p = sxy / sxx, o = my - p * m, x1 = Math.min(...xs), x2 = Math.max(...xs); s += `<line x1="${xp(x1)}" y1="${yv(o + p * x1)}" x2="${xp(x2)}" y2="${yv(o + p * x2)}" stroke="${col(si)}" stroke-dasharray="5 4" stroke-width="1.6"/>`; }
      }
    });
  } else if (horizontal) {
    const gh = ih / n, k = d.series.length, bh = Math.min(28, (gh * 0.8) / k);
    d.labels.forEach((l, i) => { s += `<text x="${L.l - 6}" y="${L.t + gh * (i + 0.5) + 4}" fill="#8d8d96" font-size="10" text-anchor="end">${esc(l.length > 14 ? l.slice(0, 13) + '…' : l)}</text>`; });
    d.series.forEach((se, si) => se.v.forEach((v, i) => {
      const y0 = L.t + gh * i + (gh - bh * k) / 2 + bh * si;
      s += `<rect x="${Math.min(xv(v), xv(0))}" y="${y0}" width="${Math.abs(xv(v) - xv(0))}" height="${bh - 2}" rx="2" fill="${col(si)}"><title>${esc(d.labels[i])} : ${nf(v)}</title></rect>`;
      if (etiq) s += `<text x="${xv(v) + 4}" y="${y0 + bh / 2 + 3}" fill="#ccc" font-size="10">${nf(v)}</text>`;
    }));
  } else {
    const gw = iw / n;
    d.labels.forEach((l, i) => { s += `<text x="${L.l + gw * (i + 0.5)}" y="${H - L.b + 16}" fill="#8d8d96" font-size="10" text-anchor="middle">${esc(l.length > 12 ? l.slice(0, 11) + '…' : l)}</text>`; });
    if (type === 'bar' || pile) {
      const k = pile ? 1 : d.series.length, bw = Math.min(46, (gw * 0.8) / k);
      d.labels.forEach((_, i) => {
        let hp = 0, hn = 0;
        d.series.forEach((se, si) => {
          const v = se.v[i], x = L.l + gw * i + (gw - bw * k) / 2 + (pile ? 0 : bw * si);
          let y1, y2;
          if (pile) { if (v >= 0) { y1 = yv(hp + v); y2 = yv(hp); hp += v; } else { y1 = yv(hn); y2 = yv(hn + v); hn += v; } } else { y1 = Math.min(yv(v), yv(0)); y2 = Math.max(yv(v), yv(0)); }
          s += `<rect x="${x}" y="${y1}" width="${bw - 2}" height="${Math.max(0, y2 - y1)}" rx="2" fill="${col(si)}"><title>${esc(d.labels[i])} — ${esc(se.nom)} : ${nf(v)}</title></rect>`;
          if (etiq && !pile) s += `<text x="${x + (bw - 2) / 2}" y="${(v >= 0 ? y1 : y2) + (v >= 0 ? -4 : 12)}" fill="#ccc" font-size="10" text-anchor="middle">${nf(v)}</text>`;
        });
      });
    } else {
      d.series.forEach((se, si) => {
        const pts = se.v.map((v, i) => [L.l + gw * (i + 0.5), yv(v)]);
        if (type === 'area') s += `<polygon points="${pts[0][0]},${yv(Math.max(0, E2.bas))} ${pts.map((p) => p.join(',')).join(' ')} ${pts[pts.length - 1][0]},${yv(Math.max(0, E2.bas))}" fill="${col(si)}" fill-opacity=".28"/>`;
        s += `<polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${col(si)}" stroke-width="2"/>`;
        pts.forEach((p, i) => { s += `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${col(si)}"><title>${esc(d.labels[i])} : ${nf(se.v[i])}</title></circle>`; if (etiq) s += `<text x="${p[0]}" y="${p[1] - 8}" fill="#ccc" font-size="10" text-anchor="middle">${nf(se.v[i])}</text>`; });
        if (g.tend && se.v.length > 1) {
          const xs = se.v.map((_, i) => i), m = xs.reduce((a, b) => a + b, 0) / xs.length, my = se.v.reduce((a, b) => a + b, 0) / xs.length;
          const sxx = xs.reduce((a, x) => a + (x - m) ** 2, 0), sxy = xs.reduce((a, x, i) => a + (x - m) * (se.v[i] - my), 0);
          if (sxx) { const p = sxy / sxx, o = my - p * m; s += `<line x1="${pts[0][0]}" y1="${yv(o)}" x2="${pts[n - 1][0]}" y2="${yv(o + p * (n - 1))}" stroke="${col(si)}" stroke-dasharray="5 4" stroke-width="1.4"/>`; }
        }
      });
    }
  }
  s += horizontal ? `<line x1="${xv(0)}" x2="${xv(0)}" y1="${L.t}" y2="${H - L.b}" stroke="#3a3a42"/>` : `<line x1="${L.l}" x2="${W - L.r}" y1="${yv(0)}" y2="${yv(0)}" stroke="#3a3a42"/>`;
  s += titreAxe(L.l + iw / 2, H - 22, horizontal ? g.axeY : g.axeX) + titreAxe(14, L.t + ih / 2, horizontal ? g.axeX : g.axeY, true);
  return `<svg viewBox="0 0 ${W} ${H}" role="img">${s}${legende(d.series.map((x) => x.nom), H - 6)}</svg>`;
}

function renderGraphs() {
  const F = feuille();
  const zone = $('#shGraphs');
  if (!zone) return;
  zone.innerHTML = (F.graphs || []).map((g) => {
    const d = donneesGraph(F, g.range, g.type);
    return `<div class="card gcard"><div class="card-head"><h3>${esc(g.titre)} <small class="hint">${esc(TYPES_GRAPH[g.type] || '')} · ${esc(g.range)}</small></h3>
      <span><button class="btn ghost" data-sh="graphOpt:${g.id}" title="Options du graphique">⚙️</button><button class="btn ghost" data-sh="graphPng:${g.id}" title="Enregistrer en image">🖼️</button><button class="btn ghost danger" data-sh="graphSuppr:${g.id}" title="Supprimer">🗑️</button></span></div>
      ${d ? `<div id="g_${g.id}">${svgGraph(g, d)}</div>` : '<p class="muted">Plage invalide : il faut au moins 2 lignes (un en-tête puis des données).</p>'}</div>`;
  }).join('');
}

function creerGraph(type) {
  const R = rect();
  if (R.r1 === R.r2) { toast('Sélectionne d’abord les cellules à représenter (avec l’en-tête).'); return; }
  const plage = textePlage(R);
  const id = uid();
  modifier((F) => F.graphs.push({ id, type, range: plage, titre: TYPES_GRAPH[type], legende: true }));
  const el = document.getElementById('g_' + id);
  if (el) el.scrollIntoView({ block: 'nearest' });
}

function graphVersPng(id) {
  const el = document.querySelector('#g_' + id + ' svg');
  if (!el) return;
  const svg = new XMLSerializer().serializeToString(el).replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg" style="background:#111113"');
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 660;
    const cx = cv.getContext('2d'); cx.fillStyle = '#111113'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height);
    cv.toBlob((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'graphique.png'; a.click(); URL.revokeObjectURL(a.href); });
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
