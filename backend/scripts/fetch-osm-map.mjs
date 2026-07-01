/** Baixa ruas de Passagem Franca via API OSM (sem Overpass). */
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'assets', 'geo');
const outFile = join(outDir, 'passagem-franca-map.osm');

mkdirSync(outDir, { recursive: true });

const bbox = '-43.86,-6.24,-43.75,-6.13';
const url = `https://api.openstreetmap.org/api/0.6/map?bbox=${bbox}`;

console.log('Baixando OSM map API...');
const res = await fetch(url, {
  headers: { 'User-Agent': 'SIGAPS/1.0 (Passagem Franca APS)' },
  signal: AbortSignal.timeout(120_000),
});

if (!res.ok) {
  console.error(`Falhou: HTTP ${res.status}`);
  process.exit(1);
}

const xml = await res.text();
writeFileSync(outFile, xml);
console.log(`Salvo: ${outFile} (${xml.length} bytes)`);
console.log('Próximo passo: npm run streets:build-geojson');
