import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { test as setup, expect } from '@playwright/test';
import { E2E_ADMIN } from './helpers';

const authFile = 'e2e/.auth/admin.json';

setup('sessão admin', async ({ page }) => {
  mkdirSync(dirname(authFile), { recursive: true });

  await page.goto('/login');
  await page.getByTestId('login-email').fill(E2E_ADMIN.email);
  await page.getByTestId('login-password').fill(E2E_ADMIN.password);
  const loginResponse = page.waitForResponse(
    (res) => res.url().includes('/auth/login') && res.request().method() === 'POST',
    { timeout: 45_000 },
  );
  await page.getByTestId('login-submit').click();
  const response = await loginResponse;
  expect(response.ok(), `setup login falhou: ${response.status()}`).toBeTruthy();

  await expect(page.getByTestId('nav-dashboard')).toBeVisible({ timeout: 30_000 });
  await page.context().storageState({ path: authFile });
});
