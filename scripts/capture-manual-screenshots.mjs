/**
 * Captura telas em alta resolução para o Manual de Entrega SIGAPS.
 * Uso: node scripts/capture-manual-screenshots.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'docs', 'manual', 'screenshots');
const BASE = process.env.SIGAPS_URL || 'https://sigaps-api.onrender.com';
const EMAIL = process.env.SIGAPS_EMAIL || 'admin@passagemfranca.ma.gov.br';
const PASS = process.env.SIGAPS_PASS || 'Sigaps@2026';

mkdirSync(OUT, { recursive: true });

async function shot(page, name, opts = {}) {
  const path = join(OUT, `${name}.png`);
  await page.screenshot({
    path,
    fullPage: opts.fullPage ?? false,
    animations: 'disabled',
    caret: 'hide',
  });
  console.log(`  ✓ ${name}.png`);
}

async function waitApp(page) {
  await page.waitForLoadState('networkidle', { timeout: 120_000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await waitApp(page);
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Senha').fill(PASS);
  await page.getByRole('button', { name: /Entrar/i }).click();
  await page.waitForURL(/\/(dashboard)?$|\/$/, { timeout: 120_000 }).catch(() => {});
  await waitApp(page);
}

async function main() {
  console.log('Capturando telas SIGAPS em alta resolução…');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
    locale: 'pt-BR',
  });
  const page = await context.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await waitApp(page);
  await shot(page, '01-login');

  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Senha').fill(PASS);
  await page.getByRole('button', { name: /Entrar/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 120_000 });
  await waitApp(page);

  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await waitApp(page);
  await shot(page, '02-dashboard');

  await page.goto(`${BASE}/mapa`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await waitApp(page);
  await page.waitForTimeout(3000);
  await shot(page, '03-mapa');

  const cadastros = [
    ['04-cadastros-municipio', 'municipio'],
    ['05-cadastros-ubs', 'ubs'],
    ['06-cadastros-acs', 'acs'],
    ['07-cadastros-bairros', 'bairros'],
    ['08-cadastros-povoados', 'povoados'],
    ['09-cadastros-microareas', 'microareas'],
  ];
  for (const [file, secao] of cadastros) {
    await page.goto(`${BASE}/cadastros?secao=${secao}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await waitApp(page);
    await shot(page, file);
  }

  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await waitApp(page);
  await shot(page, '10-admin');

  await page.goto(`${BASE}/ajuda`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await waitApp(page);
  await shot(page, '11-ajuda');

  await browser.close();
  console.log(`\nTelas salvas em: ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
