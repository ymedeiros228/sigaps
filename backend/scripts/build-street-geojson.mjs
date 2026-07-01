/**
 * Converte export OSM XML (api/0.6/map) em GeoJSON de ruas nomeadas.
 * Uso: node scripts/build-street-geojson.mjs [entrada.osm] [saida.geojson]
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const input = process.argv[2] ?? join(root, 'assets/geo/passagem-franca-map.osm');
const output = process.argv[3] ?? join(root, 'assets/geo/passagem-franca-streets.geojson');

const HIGHWAY = /^(primary|secondary|tertiary|residential|unclassified|living_street)$/;

const xml = readFileSync(input, 'utf8');

const nodes = new Map();
for (const m of xml.matchAll(/<node id="(\d+)"[^>]*lat="([^"]+)" lon="([^"]+)"/g)) {
  nodes.set(m[1], [Number(m[2]), Number(m[3])]);
}

const features = [];

for (const wayBlock of xml.matchAll(/<way id="(\d+)"[^>]*>([\s\S]*?)<\/way>/g)) {
  const osmId = wayBlock[1];
  const inner = wayBlock[2];
  const tags = {};
  for (const t of inner.matchAll(/<tag k="([^"]+)" v="([^"]*)"/g)) {
    tags[t[1]] = t[2];
  }
  if (!tags.highway || !HIGHWAY.test(tags.highway) || !tags.name?.trim()) continue;

  const refs = [...inner.matchAll(/<nd ref="(\d+)"/g)].map((r) => r[1]);
  const coordinates = refs
    .map((ref) => {
      const n = nodes.get(ref);
      if (!n) return null;
      return [n[1], n[0]];
    })
    .filter(Boolean);

  if (coordinates.length < 2) continue;

  features.push({
    type: 'Feature',
    properties: {
      osmId,
      name: tags.name.trim(),
      highway: tags.highway,
    },
    geometry: { type: 'LineString', coordinates },
  });
}

const fc = { type: 'FeatureCollection', features };
writeFileSync(output, JSON.stringify(fc));
console.log(`GeoJSON: ${features.length} ruas → ${output}`);
