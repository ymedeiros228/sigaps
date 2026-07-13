import { test, expect } from '@playwright/test';

async function openMapAndWaitStreets(page: import('@playwright/test').Page) {
  await page.getByTestId('nav-mapa').click();
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('paint-guide')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Carregando ruas do município')).toBeHidden({ timeout: 90_000 });
}

async function expandPaintGuide(page: import('@playwright/test').Page) {
  const header = page.getByTestId('paint-guide-header');
  const collapsed = await page.getByText('Mapa guardado').isVisible().catch(() => false);
  if (collapsed) {
    await header.click();
  }
  await expect(page.getByText('Cores do ACS')).toBeVisible({ timeout: 15_000 });
}

async function enterPaintWithMicroarea01(page: import('@playwright/test').Page) {
  await expandPaintGuide(page);
  await page.getByTestId('paint-chip-1').click();
  await expect(page.getByText('Pintando')).toBeVisible({ timeout: 10_000 });
}

test.describe('Pintura no mapa', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('nav-dashboard')).toBeVisible({ timeout: 30_000 });
  });

  test('painel de pintura expande e seleciona microárea', async ({ page }) => {
    await openMapAndWaitStreets(page);
    await enterPaintWithMicroarea01(page);
    await expect(page.getByTestId('paint-mode-start')).toBeVisible();
    await expect(page.getByText(/Toque nas ruas|Escolha a cor/i)).toBeVisible();
  });

  test('pinta trecho de rua após busca', async ({ page }) => {
    await openMapAndWaitStreets(page);

    const search = page.getByRole('combobox', { name: /Buscar rua/i });
    await search.fill('Viriato');
    await page.getByRole('option', { name: /Viriato/i }).first().click({ timeout: 20_000 });

    await enterPaintWithMicroarea01(page);

    const paintResponse = page.waitForResponse(
      (res) =>
        res.url().includes('/paint-at-point') &&
        res.request().method() === 'POST' &&
        res.status() < 500,
      { timeout: 30_000 },
    );

    const streetPath = page.locator('.leaflet-overlay-pane path.leaflet-interactive').first();
    await expect(streetPath).toBeVisible({ timeout: 15_000 });
    await streetPath.click({ force: true });

    const response = await paintResponse;
    expect(response.ok(), `paint-at-point falhou: ${response.status()}`).toBeTruthy();

    await expect(
      page.getByText(/Trecho vinculado|Trecho pintado|vinculado à/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
