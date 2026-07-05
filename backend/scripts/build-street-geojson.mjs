/**
 * Converte export OSM XML (api/0.6/map) em GeoJSON de ruas (pavimentadas + estradas de terra).
 * Uso: node scripts/build-street-geojson.mjs [entrada.osm] [saida.geojson]
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const input = process.argv[2] ?? join(root, 'assets/geo/passagem-franca-map.osm');
const output = process.argv[3] ?? join(root, 'assets/geo/passagem-franca-streets.geojson');

const HIGHWAY =
  /^(primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|trunk|trunk_link|residential|unclassified|living_street|track|path|service)$/;

const UNNAMED_LABEL = {
  primary: 'Via principal',
  primary_link: 'Acesso via principal',
  secondary: 'Via secundária',
  secondary_link: 'Acesso via secundária',
  tertiary: 'Via terciária',
  tertiary_link: 'Acesso via terciária',
  trunk: 'Rodovia',
  trunk_link: 'Acesso rodovia',
  residential: 'Rua sem nome',
  unclassified: 'Via sem nome',
  living_street: 'Rua residencial',
  track: 'Estrada de terra',
  path: 'Caminho',
  service: 'Via de acesso',
};

function resolveName(tags, osmId) {
  const named =
    tags.name?.trim() ||
    tags['name:pt']?.trim() ||
    tags.alt_name?.trim() ||
    tags.loc_name?.trim() ||
    tags.official_name?.trim();
  if (named) return named;

  const ref = tags.ref?.trim();
  if (ref) return ref.startsWith('MA-') || ref.includes('-') ? `Estrada ${ref}` : ref;

  const highway = tags.highway ?? '';
  const label = UNNAMED_LABEL[highway];
  if (!label) return null;
  return `${label} #${osmId}`;
}

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
  if (!tags.highway || !HIGHWAY.test(tags.highway)) continue;

  const name = resolveName(tags, osmId);
  if (!name) continue;

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
      name,
      highway: tags.highway,
    },
    geometry: { type: 'LineString', coordinates },
  });
}

const fc = { type: 'FeatureCollection', features };
writeFileSync(output, JSON.stringify(fc));
const dirt = features.filter((f) => ['track', 'path'].includes(f.properties.highway)).length;
console.log(`GeoJSON: ${features.length} vias (${dirt} estradas de terra) → ${output}`);
