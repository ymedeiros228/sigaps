#!/usr/bin/env node
// Confere o tamanho do JS que a tela de login baixa (o "JS inicial").
//
// Lê o manifest do Vite (dist/.vite/manifest.json), parte da entrada index.html e segue
// os imports ESTÁTICOS (os que o navegador baixa antes de a página funcionar; o Vite
// coloca todos como <link rel="modulepreload">). Imports dinâmicos (lazy) ficam de fora:
// só baixam quando a rota precisa. Se a LoginPage virar lazy, o grafo dela entra na conta.
//
// Soma o tamanho gzip de cada arquivo .js e falha (exit 1) se passar do limite.
// Também mostra o precache do service worker (dist/sw.js), só como informação.
//
// Uso: npm run build && npm run check:bundle
// Limite: BUNDLE_LIMIT_KB (padrão 260, em KB gzip).

import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(here, '..', 'dist');
const manifestPath = join(distDir, '.vite', 'manifest.json');
const limitKb = Number(process.env.BUNDLE_LIMIT_KB ?? 260);

// Rotas que a tela de login precisa além da entrada (se forem lazy, entram na conta).
const loginSources = ['src/pages/LoginPage.tsx'];

if (!existsSync(manifestPath)) {
  console.error(`[check:bundle] manifest não encontrado em ${manifestPath}. Rode "npm run build" antes.`);
  process.exit(1);
}

/** @type {Record<string, {file: string, src?: string, isEntry?: boolean, imports?: string[], css?: string[]}>} */
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const entryKey = Object.keys(manifest).find((key) => manifest[key].isEntry && key.endsWith('index.html'));
if (!entryKey) {
  console.error('[check:bundle] entrada index.html não encontrada no manifest.');
  process.exit(1);
}

// Percorre os imports estáticos a partir das chaves dadas.
const visited = new Set();
function walk(key) {
  if (visited.has(key) || !manifest[key]) return;
  visited.add(key);
  for (const dep of manifest[key].imports ?? []) walk(dep);
}
walk(entryKey);
for (const src of loginSources) walk(src);

const gzipKb = (file) => gzipSync(readFileSync(join(distDir, file))).length / 1024;
const rawKb = (file) => statSync(join(distDir, file)).size / 1024;

const jsFiles = [...new Set([...visited].map((key) => manifest[key].file))].filter((f) => f.endsWith('.js'));
const cssFiles = [...new Set([...visited].flatMap((key) => manifest[key].css ?? []))];

const rows = jsFiles
  .map((file) => ({ file, raw: rawKb(file), gz: gzipKb(file) }))
  .sort((a, b) => b.gz - a.gz);

console.log('\nJS inicial (tela de login):');
for (const row of rows) {
  console.log(`  ${row.gz.toFixed(1).padStart(7)} KB gz  ${row.raw.toFixed(1).padStart(8)} KB  ${row.file}`);
}
const totalGz = rows.reduce((sum, row) => sum + row.gz, 0);
const totalRaw = rows.reduce((sum, row) => sum + row.raw, 0);
const cssGz = cssFiles.reduce((sum, file) => sum + gzipKb(file), 0);
console.log(`  ------`);
console.log(`  ${totalGz.toFixed(1).padStart(7)} KB gz  ${totalRaw.toFixed(1).padStart(8)} KB  TOTAL JS (${rows.length} arquivos)`);
console.log(`  ${cssGz.toFixed(1).padStart(7)} KB gz  CSS inicial (${cssFiles.length} arquivos)`);

// Precache do service worker (informativo): o generateSW lista {url, revision} no sw.js.
const swPath = join(distDir, 'sw.js');
if (existsSync(swPath)) {
  const sw = readFileSync(swPath, 'utf8');
  const urls = [...sw.matchAll(/url:"([^"]+)"/g)].map((m) => m[1]);
  const bytes = urls.reduce((sum, url) => {
    const path = join(distDir, url.split('?')[0]);
    return sum + (existsSync(path) ? statSync(path).size : 0);
  }, 0);
  console.log(`\nPrecache do service worker: ${urls.length} arquivos, ${(bytes / 1024 / 1024).toFixed(2)} MB`);
}

if (totalGz > limitKb) {
  console.error(`\n[check:bundle] FALHOU: JS inicial ${totalGz.toFixed(1)} KB gz > limite ${limitKb} KB gz.`);
  console.error('Algo pesado (gráficos, PDF, mapa, planilha) entrou na tela de login. Veja codeSplitting no vite.config.ts.');
  process.exit(1);
}
console.log(`\n[check:bundle] OK: JS inicial ${totalGz.toFixed(1)} KB gz <= ${limitKb} KB gz.`);
