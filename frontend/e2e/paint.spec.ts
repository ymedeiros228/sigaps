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

  test('mapa zerado exibe guia de entrega ao usuário', async ({ page }) => {
    await openMapAndWaitStreets(page);
    await expandPaintGuide(page);
    await expect(page.getByTestId('paint-guide-empty-map')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/decidir a pintura/i)).toBeVisible();
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

  test('pinta rua inteira no modo whole', async ({ page }) => {
    await openMapAndWaitStreets(page);

    const search = page.getByRole('combobox', { name: /Buscar rua/i });
    await search.fill('Viriato');
    await page.getByRole('option', { name: /Viriato/i }).first().click({ timeout: 20_000 });

    await enterPaintWithMicroarea01(page);
    await page.getByTestId('paint-mode-whole').click();

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
    const body = (await response.request().postDataJSON()) as { scope?: string };
    expect(body.scope).toBe('whole');
  });

  test('modo arrastar envia scope brush com coordenadas de fim', async ({ page }) => {
    await openMapAndWaitStreets(page);

    const search = page.getByRole('combobox', { name: /Buscar rua/i });
    await search.fill('Viriato');
    await page.getByRole('option', { name: /Viriato/i }).first().click({ timeout: 20_000 });

    await enterPaintWithMicroarea01(page);
    await page.getByTestId('paint-mode-brush').click();

    const streetPath = page.locator('.leaflet-overlay-pane path.leaflet-interactive').first();
    await expect(streetPath).toBeVisible({ timeout: 15_000 });
    const box = await streetPath.boundingBox();
    if (!box) throw new Error('Rua não visível no mapa');

    const paintResponse = page.waitForResponse(
      (res) =>
        res.url().includes('/paint-at-point') &&
        res.request().method() === 'POST' &&
        res.status() < 500,
      { timeout: 30_000 },
    );

    const fromX = box.x + box.width * 0.2;
    const toX = box.x + box.width * 0.8;
    const y = box.y + box.height / 2;
    await page.mouse.move(fromX, y);
    await page.mouse.down();
    await page.mouse.move(toX, y, { steps: 8 });
    await page.mouse.up();

    const response = await paintResponse;
    expect(response.ok(), `paint brush falhou: ${response.status()}`).toBeTruthy();
    const body = (await response.request().postDataJSON()) as {
      scope?: string;
      endLatitude?: number;
      endLongitude?: number;
    };
    expect(body.scope).toBe('brush');
    expect(body.endLatitude).toBeDefined();
    expect(body.endLongitude).toBeDefined();
  });

  test('modo apagar remove pintura ao clicar na rua', async ({ page }) => {
    await openMapAndWaitStreets(page);

    const search = page.getByRole('combobox', { name: /Buscar rua/i });
    await search.fill('Viriato');
    await page.getByRole('option', { name: /Viriato/i }).first().click({ timeout: 20_000 });

    await enterPaintWithMicroarea01(page);

    const streetPath = page.locator('.leaflet-overlay-pane path.leaflet-interactive').first();
    await expect(streetPath).toBeVisible({ timeout: 15_000 });
    await streetPath.click({ force: true });
    await expect(page.getByText(/pintada|vinculado/i).first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /^Apagar$/i }).click();
    await expect(page.getByText(/Modo apagar|Toque na rua colorida/i)).toBeVisible({ timeout: 10_000 });

    const unpaintResponse = page.waitForResponse(
      (res) =>
        (res.url().includes('/unpaint-at-point') || res.url().includes('/unassign')) &&
        res.request().method() === 'POST' &&
        res.status() < 500,
      { timeout: 30_000 },
    );
    await streetPath.click({ force: true });
    const response = await unpaintResponse;
    expect(response.ok(), `apagar falhou: ${response.status()}`).toBeTruthy();
  });

  test('modo apagar brush envia unpaint com coordenadas de fim', async ({ page }) => {
    await openMapAndWaitStreets(page);

    const search = page.getByRole('combobox', { name: /Buscar rua/i });
    await search.fill('Viriato');
    await page.getByRole('option', { name: /Viriato/i }).first().click({ timeout: 20_000 });

    await enterPaintWithMicroarea01(page);

    const streetPath = page.locator('.leaflet-overlay-pane path.leaflet-interactive').first();
    await expect(streetPath).toBeVisible({ timeout: 15_000 });
    const box = await streetPath.boundingBox();
    if (!box) throw new Error('Rua não visível no mapa');

    const fromX = box.x + box.width * 0.2;
    const toX = box.x + box.width * 0.8;
    const y = box.y + box.height / 2;
    await page.mouse.move(fromX, y);
    await page.mouse.down();
    await page.mouse.move(toX, y, { steps: 6 });
    await page.mouse.up();

    await expect(page.getByText(/pintada|vinculado/i).first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /^Apagar$/i }).click();
    await expect(page.getByText(/Modo apagar|Arraste na rua colorida/i)).toBeVisible({
      timeout: 10_000,
    });

    const unpaintResponse = page.waitForResponse(
      (res) =>
        res.url().includes('/unpaint-at-point') &&
        res.request().method() === 'POST' &&
        res.status() < 500,
      { timeout: 30_000 },
    );

    await page.mouse.move(fromX, y);
    await page.mouse.down();
    await page.mouse.move(toX, y, { steps: 6 });
    await page.mouse.up();

    const response = await unpaintResponse;
    expect(response.ok(), `apagar brush falhou: ${response.status()}`).toBeTruthy();
    const body = (await response.request().postDataJSON()) as {
      endLatitude?: number;
      endLongitude?: number;
    };
    expect(body.endLatitude).toBeDefined();
    expect(body.endLongitude).toBeDefined();
  });

  test('atalho S sai do modo pintar', async ({ page }) => {
    await openMapAndWaitStreets(page);
    await enterPaintWithMicroarea01(page);
    await expect(page.getByText('Pintando')).toBeVisible();
    await page.keyboard.press('s');
    await expect(page.getByText('Pintando')).toBeHidden({ timeout: 10_000 });
    await expect(page.getByText(/Modo pintar desativado|Pintar microáreas/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('?heatmap=1 ativa camada de famílias quando há dados', async ({ page }) => {
    await page.goto('/mapa?heatmap=1');
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 });
    const heatmapToggle = page.getByTestId('toggle-heatmap');
    const hasFamilyData = await heatmapToggle.isVisible().catch(() => false);
    if (!hasFamilyData) {
      test.skip();
      return;
    }
    const disabled = await heatmapToggle.locator('input').isDisabled().catch(() => true);
    if (disabled) {
      test.skip();
      return;
    }
    await expect(heatmapToggle.locator('input')).toBeChecked({ timeout: 10_000 });
  });
});
