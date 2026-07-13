import { test, expect } from '@playwright/test';

async function openApp(page: import('@playwright/test').Page) {
  await page.goto('/');
  await expect(page.getByTestId('nav-dashboard')).toBeVisible({ timeout: 30_000 });
}

test.describe('Sessão autenticada', () => {
  test('navega para o mapa', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('nav-mapa').click();
    await expect(page).toHaveURL(/\/mapa/);
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 });
  });

  test('navega para cadastros', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('nav-cadastros').click();
    await expect(page).toHaveURL(/\/cadastros/);
    await expect(page.getByRole('heading', { name: /Cadastros/i })).toBeVisible();
  });

  test('busca no mapa aceita texto', async ({ page }) => {
    await page.goto('/mapa');
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 });
    const search = page.getByRole('combobox', { name: /Buscar rua/i });
    await search.fill('rua');
    await expect(search).toHaveValue('rua');
  });
});
