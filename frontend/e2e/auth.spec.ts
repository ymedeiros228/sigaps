import { test, expect } from '@playwright/test';
import { E2E_ADMIN, loginAsAdmin } from './helpers';

test.describe('Autenticação', () => {
  test('exibe formulário de login', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Bem-vindo' })).toBeVisible();
    await expect(page.getByTestId('login-email')).toBeVisible();
    await expect(page.getByTestId('login-password')).toBeVisible();
    await expect(page.getByTestId('login-submit')).toBeVisible();
  });

  test('login com credenciais válidas abre o dashboard', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('credenciais inválidas exibem erro', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-email').fill('invalido@teste.gov.br');
    await page.getByTestId('login-password').fill('senha-errada');
    await page.getByTestId('login-submit').click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('rota protegida redireciona para login', async ({ page }) => {
    await page.goto('/mapa');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Sessão autenticada', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('navega para o mapa', async ({ page }) => {
    await page.getByTestId('nav-mapa').click();
    await expect(page).toHaveURL(/\/mapa/);
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 });
  });

  test('navega para cadastros', async ({ page }) => {
    await page.getByTestId('nav-cadastros').click();
    await expect(page).toHaveURL(/\/cadastros/);
    await expect(page.getByRole('heading', { name: /Cadastros/i })).toBeVisible();
  });

  test('busca no mapa aceita texto', async ({ page }) => {
    await page.getByTestId('nav-mapa').click();
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 });
    const search = page.getByRole('combobox', { name: /Buscar rua/i });
    await search.fill('rua');
    await expect(search).toHaveValue('rua');
  });
});
