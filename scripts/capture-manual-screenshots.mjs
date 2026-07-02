/**
 * Captura telas em alta resolução para o Manual de Entrega SIGAPS.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { prepareManualDemo } from './prepare-manual-demo.mjs';

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

async function collapsePaintPanel(page) {
  const minimize = page.getByRole('button', { name: 'Minimizar painel' });
  if (await minimize.isVisible().catch(() => false)) {
    await minimize.click();
    await page.waitForTimeout(500);
  }
}

async function hidePaintPanel(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.map-float-panel').forEach((el) => {
      if (el.textContent?.includes('Pintar microáreas')) el.style.display = 'none';
    });
  });
}

async function showPaintPanel(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.map-float-panel').forEach((el) => {
      if (el.textContent?.includes('Pintar microáreas')) el.style.display = '';
    });
  });
}

async function expandPaintPanel(page) {
  await showPaintPanel(page);
  const openBtn = page.getByRole('button', { name: 'Abrir painel' });
  if (await openBtn.isVisible().catch(() => false)) {
    await openBtn.click();
    await page.waitForTimeout(900);
  } else {
    const header = page.getByText('Pintar microáreas', { exact: false }).first();
    if (await header.isVisible().catch(() => false)) await header.click();
    await page.waitForTimeout(600);
  }
}

async function ensureToggle(page, label, on = true) {
  const row = page.locator('label').filter({ hasText: label }).first();
  if (!(await row.isVisible().catch(() => false))) return;
  const input = row.locator('input[type="checkbox"]');
  const checked = await input.isChecked().catch(() => false);
  if (checked !== on) await row.click();
  await page.waitForTimeout(200);
}

async function openMapLegend(page) {
  const legend = page.getByText('Legenda', { exact: true }).first();
  if (await legend.isVisible().catch(() => false)) {
    const collapseBtn = legend.locator('xpath=ancestor::div[contains(@class,"map-float-panel")]').getByRole('button').first();
    const panel = legend.locator('xpath=ancestor::div[contains(@class,"map-float-panel")]').first();
    const text = await panel.innerText().catch(() => '');
    if (!text.includes('Microárea 01') && !text.includes('Estrada')) {
      await legend.click();
    }
    await page.waitForTimeout(400);
  }
}

async function hideDivisionsPanel(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.map-float-panel').forEach((el) => {
      if (el.textContent?.includes('Divisões de mapa')) {
        el.style.display = 'none';
      }
    });
  });
}

async function centerMap(page) {
  const btn = page.getByRole('button', { name: /Centralizar/i });
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(1200);
  }
}

async function scrollToText(page, text) {
  const el = page.getByText(text, { exact: false }).first();
  if (await el.isVisible().catch(() => false)) {
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  }
}

async function captureMapShots(page) {
  await page.goto(`${BASE}/mapa`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await waitApp(page);
  await page.waitForTimeout(3500);
  await cleanUi(page);
  await hideDivisionsPanel(page);
  await ensureToggle(page, 'Microáreas', true);
  await ensureToggle(page, 'UBS', true);
  await ensureToggle(page, 'Povoados', true);
  await centerMap(page);
  await collapsePaintPanel(page);
  await openMapLegend(page);
  await hidePaintPanel(page);
  await shot(page, '03-mapa-cobertura');

  await showPaintPanel(page);
  await expandPaintPanel(page);
  await page.waitForTimeout(600);
  await shot(page, '03-mapa-pintura');
  const paintPanel = page.locator('.map-float-panel').filter({ hasText: 'MICROÁREAS' }).first();
  if (await paintPanel.count() > 0 && await paintPanel.isVisible().catch(() => false)) {
    await shot(page, '03-mapa-painel-detalhe', { locator: paintPanel });
  } else {
    console.warn('  ! painel detalhe não encontrado');
  }

  await hidePaintPanel(page);
  await shot(page, '03-mapa');
}

async function main() {
  console.log('Capturando telas SIGAPS em alta resolução…');

  try {
    await prepareManualDemo();
  } catch (err) {
    console.warn('  Demo do mapa:', err.message);
  }

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

  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await waitApp(page);
  await cleanUi(page);
  await page.waitForTimeout(1500);
  await shot(page, '02-dashboard');

  await captureMapShots(page);

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
