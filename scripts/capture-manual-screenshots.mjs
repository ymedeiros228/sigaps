/**
 * Captura telas em alta resolução para o Manual de Entrega SIGAPS.
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
  if (opts.locator) {
    await opts.locator.screenshot({ path, animations: 'disabled' });
  } else {
    await page.screenshot({
      path,
      fullPage: opts.fullPage ?? false,
      animations: 'disabled',
      caret: 'hide',
    });
  }
  console.log(`  ✓ ${name}.png`);
}

async function waitApp(page) {
  await page.waitForLoadState('networkidle', { timeout: 120_000 }).catch(() => {});
  await page.waitForTimeout(1200);
}

async function cleanUi(page) {
  await page.evaluate(() => {
    localStorage.setItem('sigaps_hosting_notice_dismissed', '1');
    document.querySelectorAll('.MuiAlert-root').forEach((el) => el.remove());
  });
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await waitApp(page);
  await cleanUi(page);
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Senha').fill(PASS);
  await page.getByRole('button', { name: /Entrar/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 120_000 });
  await waitApp(page);
  await cleanUi(page);
}

async function expandPaintPanel(page) {
  const openBtn = page.getByRole('button', { name: 'Abrir painel' });
  if (await openBtn.isVisible().catch(() => false)) {
    await openBtn.click();
    await page.waitForTimeout(900);
  }
  const firstMicro = page.locator('.MuiChip-root').filter({ hasText: /Microárea/i }).first();
  if (await firstMicro.isVisible().catch(() => false)) {
    await firstMicro.click();
    await page.waitForTimeout(400);
  }
}

async function shotChecklist(page) {
  try {
    await page.waitForSelector('text=Checklist operacional', { timeout: 60_000 });
    const card = page
      .getByText('Checklist operacional', { exact: true })
      .locator('xpath=ancestor::div[contains(@class,"MuiCard-root")]')
      .first();
    await card.waitFor({ state: 'visible', timeout: 10_000 });
    await shot(page, '02-dashboard-checklist', { locator: card });
  } catch (err) {
    console.warn('  ! checklist não capturado:', err.message);
  }
}
async function openMapLegend(page) {
  const legend = page.getByText('Legenda', { exact: true }).first();
  if (await legend.isVisible().catch(() => false)) {
    await legend.click();
    await page.waitForTimeout(400);
  }
}

async function scrollToText(page, text) {
  const el = page.getByText(text, { exact: false }).first();
  if (await el.isVisible()) {
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  }
}

async function main() {
  console.log('Capturando telas SIGAPS em alta resolução…');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
    locale: 'pt-BR',
  });

  await context.addInitScript(() => {
    localStorage.setItem('sigaps_hosting_notice_dismissed', '1');
  });

  const page = await context.newPage();

  // Login
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await waitApp(page);
  await cleanUi(page);
  await shot(page, '01-login');

  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Senha').fill(PASS);
  await page.getByRole('button', { name: /Entrar/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 120_000 });
  await waitApp(page);
  await cleanUi(page);

  // Dashboard — visão geral + checklist
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await waitApp(page);
  await cleanUi(page);
  await page.waitForSelector('text=Checklist operacional', { timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(800);
  await shot(page, '02-dashboard');
  await shotChecklist(page);

  // Mapa — visão geral
  await page.goto(`${BASE}/mapa`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await waitApp(page);
  await page.waitForTimeout(2500);
  await cleanUi(page);
  await openMapLegend(page);
  await shot(page, '03-mapa');

  // Mapa — painel de pintura expandido
  await expandPaintPanel(page);
  await shot(page, '03-mapa-pintura');

  // Painel de pintura isolado (detalhe)
  const paintPanel = page.locator('.map-float-panel').filter({ hasText: 'Pintar microáreas' }).first();
  if (await paintPanel.isVisible()) {
    await shot(page, '03-mapa-painel-detalhe', { locator: paintPanel });
  }

  const cadastros = [
    ['04-cadastros-municipio', 'municipio', null],
    ['05-cadastros-ubs', 'ubs', null],
    ['06-cadastros-acs', 'acs', 'Agentes Comunitários'],
    ['07-cadastros-bairros', 'bairros', 'Bairros'],
    ['08-cadastros-povoados', 'povoados', 'Povoados e localidades'],
    ['09-cadastros-microareas', 'microareas', 'Microáreas'],
  ];

  for (const [file, secao, scrollText] of cadastros) {
    await page.goto(`${BASE}/cadastros?secao=${secao}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await waitApp(page);
    await cleanUi(page);
    if (scrollText) await scrollToText(page, scrollText);
    await shot(page, file);
  }

  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await waitApp(page);
  await cleanUi(page);
  await shot(page, '10-admin');

  await page.goto(`${BASE}/ajuda`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await waitApp(page);
  await cleanUi(page);
  await shot(page, '11-ajuda');

  await browser.close();
  console.log(`\nTelas salvas em: ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
