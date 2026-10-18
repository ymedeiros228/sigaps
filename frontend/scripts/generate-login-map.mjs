/**
 * Gera src/assets/territorio-passagem-franca.svg: as ruas reais da sede de
 * Passagem Franca (OpenStreetMap) com parte delas "pintada" nas cores das
 * microáreas. É a ilustração da tela de login.
 *
 * Uso: node scripts/generate-login-map.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Caixa da sede (sul, norte, oeste, leste).
const [S, N, W0, E] = [-6.193, -6.168, -43.796, -43.758];
const WIDTH = 800;
const PAINT_RADIUS = 230;
// Mesmas cores de MICROAREA_COLORS (cadastrosConfig.tsx).
const COLORS = ['#E6194B', '#4363D8', '#3CB44B', '#FFE119', '#911EB4', '#F58231', '#42D4F4', '#F032E6', '#469990'];
// Dois grupos ficam sem pintar: o desenho mostra um trabalho em andamento.
const UNPAINTED = new Set([2, 6]);

const query = `[out:json][timeout:60];way["highway"~"^(primary|secondary|tertiary|residential|unclassified|living_street|service|track)$"](${S - 0.01},${W0 - 0.01},${N + 0.01},${E + 0.01});out geom;`;
const res = await fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  headers: { 'User-Agent': 'SIGAPS/1.0 (gerador da ilustração do login)' },
  body: new URLSearchParams({ data: query }),
});
if (!res.ok) throw new Error(`Overpass respondeu ${res.status}`);
const osm = await res.json();

const k = Math.cos((((S + N) / 2) * Math.PI) / 180);
const scale = WIDTH / ((E - W0) * k);
const HEIGHT = Math.round((N - S) * scale);
const inside = (p) => p.lat >= S && p.lat <= N && p.lon >= W0 && p.lon <= E;
const project = (p) => [(p.lon - W0) * k * scale, (N - p.lat) * scale];

// Recorta cada rua na caixa (quebra a linha onde ela sai).
const segments = [];
for (const way of osm.elements) {
  if (!way.geometry) continue;
  let cur = [];
  for (const p of way.geometry) {
    if (inside(p)) cur.push(p);
    else {
      if (cur.length > 1) segments.push({ hw: way.tags.highway, pts: cur });
      cur = [];
    }
  }
  if (cur.length > 1) segments.push({ hw: way.tags.highway, pts: cur });
}

// Douglas-Peucker: menos pontos, mesmo desenho.
function simplify(a, eps) {
  if (a.length < 3) return a;
  const [A, B] = [a[0], a[a.length - 1]];
  let max = 0;
  let idx = 0;
  for (let i = 1; i < a.length - 1; i++) {
    const dx = B[0] - A[0];
    const dy = B[1] - A[1];
    const len = Math.hypot(dx, dy) || 1;
    const d = Math.abs(dy * a[i][0] - dx * a[i][1] + B[0] * A[1] - B[1] * A[0]) / len;
    if (d > max) {
      max = d;
      idx = i;
    }
  }
  if (max < eps) return [A, B];
  return simplify(a.slice(0, idx + 1), eps).slice(0, -1).concat(simplify(a.slice(idx), eps));
}

const lines = segments.map((s) => {
  const p = simplify(s.pts.map(project), 0.5);
  const c = p.reduce((acc, q) => [acc[0] + q[0] / p.length, acc[1] + q[1] / p.length], [0, 0]);
  return { hw: s.hw, p, c, group: -1 };
});

// Agrupa as ruas do centro em "microáreas" (k-means simples).
const urban = new Set(['residential', 'living_street', 'tertiary', 'secondary', 'primary', 'unclassified']);
const [cx, cy] = [WIDTH / 2, HEIGHT / 2];
const paintable = lines.filter(
  (l) => urban.has(l.hw) && Math.hypot(l.c[0] - cx, l.c[1] - cy) < PAINT_RADIUS,
);
let centers = COLORS.map((_, i) => {
  const a = (i / COLORS.length) * 2 * Math.PI;
  return [cx + PAINT_RADIUS * 0.55 * Math.cos(a), cy + PAINT_RADIUS * 0.55 * Math.sin(a)];
});
for (let it = 0; it < 40; it++) {
  const acc = centers.map(() => [0, 0, 0]);
  for (const l of paintable) {
    let best = 0;
    let bestD = Infinity;
    centers.forEach((c, i) => {
      const d = Math.hypot(c[0] - l.c[0], c[1] - l.c[1]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    l.group = best;
    acc[best][0] += l.c[0];
    acc[best][1] += l.c[1];
    acc[best][2]++;
  }
  centers = centers.map((c, i) => (acc[i][2] ? [acc[i][0] / acc[i][2], acc[i][1] / acc[i][2]] : c));
}

const r = (n) => Math.round(n * 10) / 10;
const d = (l) => 'M' + l.p.map((q) => `${r(q[0])} ${r(q[1])}`).join('L');
const groups = {};
for (const l of paintable) {
  if (UNPAINTED.has(l.group)) continue;
  (groups[l.group] ??= []).push(d(l));
}

let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" fill="none" stroke-linecap="round" stroke-linejoin="round">`;
svg += `<path d="${lines.map(d).join('')}" stroke="#fff" stroke-opacity=".2" stroke-width="1.6"/>`;
for (const [g, paths] of Object.entries(groups)) {
  svg += `<path d="${paths.join('')}" stroke="${COLORS[g]}" stroke-width="3.4"/>`;
}
svg += '</svg>\n';

const out = fileURLToPath(new URL('../src/assets/territorio-passagem-franca.svg', import.meta.url));
writeFileSync(out, svg);
console.log(`ok: ${lines.length} trechos, ${paintable.length} pintáveis, ${svg.length} bytes → ${out}`);
