/** Diagnóstico do mapa: console, requisições de tiles e screenshot. */
import { chromium } from 'playwright';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.SIGAPS_URL || 'https://sigaps-api.onrender.com';
const EMAIL = process.env.SIGAPS_EMAIL || 'admin@passagemfranca.ma.gov.br';
const PASS = process.env.SIGAPS_PASS || 'Sigaps@2026';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: 'pt-BR',
});
await context.addInitScript(() => {
  localStorage.setItem('sigaps_hosting_notice_dismissed', '1');
});
const page = await context.newPage();

const consoleMsgs = [];
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') {
    consoleMsgs.push(`[${msg.type()}] ${msg.text().slice(0, 300)}`);
  }
});
page.on('pageerror', (err) => consoleMsgs.push(`[pageerror] ${String(err).slice(0, 300)}`));

const tileRequests = new Map();
page.on('response', (res) => {
  const url = res.url();
  if (/cartocdn|openstreetmap|arcgisonline|opentopomap/.test(url)) {
    const host = new URL(url).host;
    const key = `${host} ${res.status()}`;
    tileRequests.set(key, (tileRequests.get(key) ?? 0) + 1);
  }
});
page.on('requestfailed', (req) => {
  const url = req.url();
  if (/cartocdn|openstreetmap|arcgisonline|opentopomap/.test(url)) {
    const key = `${new URL(url).host} FAILED ${req.failure()?.errorText}`;
    tileRequests.set(key, (tileRequests.get(key) ?? 0) + 1);
  }
});

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
await page.waitForLoadState('networkidle', { timeout: 120_000 }).catch(() => {});
await page.getByLabel('Email').fill(EMAIL);
await page.getByLabel('Senha').fill(PASS);
await page.getByRole('button', { name: /Entrar/i }).click();
await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 120_000 });

await page.goto(`${BASE}/mapa`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {});
await page.waitForTimeout(6000);

const domInfo = await page.evaluate(() => {
  const container = document.querySelector('.leaflet-container');
  const tilePane = document.querySelector('.leaflet-tile-pane');
  const mapPane = document.querySelector('.leaflet-map-pane');
  const tiles = [...document.querySelectorAll('.leaflet-tile')];
  const overlaySvg = document.querySelector('.leaflet-overlay-pane svg');
  const rect = container?.getBoundingClientRect();
  return {
    containerSize: rect ? `${Math.round(rect.width)}x${Math.round(rect.height)}` : 'none',
    containerBg: container ? getComputedStyle(container).backgroundColor : 'none',
    mapPaneTransform: mapPane ? getComputedStyle(mapPane).transform : 'none',
    tilePaneOpacity: tilePane ? getComputedStyle(tilePane).opacity : 'none',
    tileCount: tiles.length,
    tilesLoaded: tiles.filter((t) => t.complete && t.naturalWidth > 0).length,
    firstTileSrc: tiles[0]?.src?.slice(0, 100) ?? 'none',
    firstTileStyle: tiles[0] ? `${getComputedStyle(tiles[0]).opacity} vis=${getComputedStyle(tiles[0]).visibility}` : 'none',
    overlayPathCount: overlaySvg ? overlaySvg.querySelectorAll('path').length : 0,
    buildMarker: document.querySelector('meta[name="build"]')?.content ?? 'n/a',
  };
});

console.log('--- DOM ---');
console.log(JSON.stringify(domInfo, null, 2));
console.log('--- TILE REQUESTS ---');
for (const [key, count] of tileRequests) console.log(`${key}: ${count}`);
console.log('--- CONSOLE (últimos 15) ---');
consoleMsgs.slice(-15).forEach((m) => console.log(m));

await page.screenshot({ path: join(__dirname, '..', 'debug-mapa.png') });
console.log('screenshot: debug-mapa.png');
await browser.close();
