#!/usr/bin/env node
/**
 * Baixa do OpenStreetMap os pontos de referência com nome (saúde, escola, igreja,
 * praça, órgão público, comércio) do município e grava em
 * frontend/src/data/referencePoints.json.
 *
 * O PDF usa esse arquivo na hora (sem esperar o Overpass, que é lento e às vezes cai).
 *
 * Uso: node scripts/fetch-reference-points.mjs [sul oeste norte leste]
 * Padrão: área de Passagem Franca-MA (tirada dos povoados cadastrados).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'frontend/src/data/referencePoints.json');

const args = process.argv.slice(2).map(Number);
const bbox = args.length === 4 ? args : [-6.4, -44.0, -5.94, -43.52];

const filters = [
  '["amenity"~"^(hospital|clinic|doctors|pharmacy|health_post|dentist)$"]',
  '["healthcare"]',
  '["amenity"~"^(school|kindergarten|college|university)$"]',
  '["amenity"="place_of_worship"]',
  '["leisure"~"^(park|pitch|stadium|sports_centre|playground)$"]',
  '["place"="square"]',
  '["amenity"~"^(townhall|police|fire_station|post_office|courthouse|community_centre|social_facility|bank|marketplace)$"]',
  '["office"="government"]',
  '["shop"~"^(supermarket|convenience|general|bakery)$"]',
];

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

function categoryOf(t) {
  const a = t.amenity;
  if (t.healthcare || ['hospital', 'clinic', 'doctors', 'pharmacy', 'health_post', 'dentist'].includes(a)) return 'saude';
  if (['school', 'kindergarten', 'college', 'university'].includes(a)) return 'escola';
  if (a === 'place_of_worship') return 'igreja';
  if (t.leisure || t.place === 'square') return 'praca';
  if (t.shop) return 'comercio';
  if (a || t.office) return 'publico';
  return null;
}

async function queryTile(tile) {
  const box = tile.map((n) => n.toFixed(5)).join(',');
  const query = `[out:json][timeout:90];(${filters.map((f) => `nwr${f}["name"](${box});`).join('')});out center tags;`;
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const url of ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
            'User-Agent': 'SIGAPS/1.0 (mapa oficial de microareas)',
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(100_000),
        });
        if (res.ok) return (await res.json()).elements ?? [];
        console.log(`  ${url} HTTP ${res.status}`);
      } catch (err) {
        console.log(`  ${url} falhou (${err.message})`);
      }
    }
    await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
  }
  throw new Error(`Pedaço ${box} sem resposta. Tente de novo mais tarde.`);
}

// O Overpass recusa caixas grandes quando está cheio: 2 x 2 pedaços.
const [s, w, n, e] = bbox;
const midLat = (s + n) / 2;
const midLng = (w + e) / 2;
const tiles = [
  [s, w, midLat, midLng],
  [s, midLng, midLat, e],
  [midLat, w, n, midLng],
  [midLat, midLng, n, e],
];

const elements = [];
for (const [i, tile] of tiles.entries()) {
  console.log(`Pedaço ${i + 1}/4...`);
  try {
    const els = await queryTile(tile);
    console.log(`  ${els.length} elementos`);
    elements.push(...els);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

const seen = new Set();
const points = [];
for (const el of elements) {
  const t = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  const category = categoryOf(t);
  if (!t.name || lat == null || lng == null || !category) continue;
  // O mesmo lugar às vezes vem como ponto e como contorno: fica um só.
  const key = `${t.name.toLowerCase()}|${lat.toFixed(3)}|${lng.toFixed(3)}`;
  if (seen.has(key)) continue;
  seen.add(key);
  points.push({
    id: `${el.type}/${el.id}`,
    name: t.name.trim(),
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    category,
  });
}
points.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name, 'pt-BR'));

mkdirSync(dirname(out), { recursive: true });
writeFileSync(
  out,
  JSON.stringify({ bbox, generatedAt: new Date().toISOString(), source: 'OpenStreetMap (ODbL)', points }, null, 1) + '\n',
);
const byCat = points.reduce((acc, p) => ((acc[p.category] = (acc[p.category] ?? 0) + 1), acc), {});
console.log(`${points.length} pontos gravados em ${out}`, byCat);
