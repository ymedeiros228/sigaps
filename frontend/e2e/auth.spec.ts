import { test, expect } from '@playwright/test';
import { E2E_ADMIN } from './helpers';

test.describe('Autenticação', () => {
  test('exibe formulário de login', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Bem-vindo' })).toBeVisible();
    await expect(page.getByTestId('login-email')).toBeVisible();
    await expect(page.getByTestId('login-password')).toBeVisible();
    await expect(page.getByTestId('login-submit')).toBeVisible();
  });

  test('login com credenciais válidas abre o dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-email').fill(E2E_ADMIN.email);
    await page.getByTestId('login-password').fill(E2E_ADMIN.password);
    const loginResponse = page.waitForResponse(
      (res) => res.url().includes('/auth/login') && res.request().method() === 'POST',
      { timeout: 45_000 },
    );
    await page.getByTestId('login-submit').click();
    const response = await loginResponse;
    expect(response.ok(), `login falhou: ${response.status()}`).toBeTruthy();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('credenciais inválidas exibem erro', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-email').fill('invalido@teste.gov.br');
    await page.getByTestId('login-password').fill('senha-errada');
    await page.getByTestId('login-submit').click();
    await expect(page.getByRole('alert').filter({ hasText: /inválid/i })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('rota protegida redireciona para login', async ({ page }) => {
    await page.goto('/mapa');
    await expect(page).toHaveURL(/\/login/);
  });
});
