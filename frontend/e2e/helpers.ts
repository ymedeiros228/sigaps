import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export const E2E_ADMIN = {
  email: 'admin@passagemfranca.ma.gov.br',
  password: 'Sigaps@2026',
};

export async function loginAsAdmin(page: Page) {
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
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 });
}
