import type { Page } from '@playwright/test';

export const E2E_ADMIN = {
  email: 'admin@passagemfranca.ma.gov.br',
  password: 'Sigaps@2026',
};

export async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.getByTestId('login-email').fill(E2E_ADMIN.email);
  await page.getByTestId('login-password').fill(E2E_ADMIN.password);
  await page.getByTestId('login-submit').click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 });
}
