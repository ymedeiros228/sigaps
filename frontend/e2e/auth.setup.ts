import { test as setup, expect } from '@playwright/test';
import { E2E_ADMIN } from './helpers';

const authFile = 'e2e/.auth/admin.json';

const apiBase =
  process.env.E2E_API_URL?.replace(/\/$/, '') ?? 'http://127.0.0.1:3000';

setup('sessão admin', async ({ page }) => {
  const loginRes = await page.request.post(`${apiBase}/auth/login`, {
    data: { email: E2E_ADMIN.email, password: E2E_ADMIN.password },
  });
  expect(loginRes.ok(), `setup login falhou: ${loginRes.status()}`).toBeTruthy();
  const body = await loginRes.json();

  await page.goto('/login');
  await page.evaluate(
    ({ user, accessToken, refreshToken }) => {
      localStorage.setItem('sigaps_token', accessToken);
      localStorage.setItem('sigaps_refresh', refreshToken);
      localStorage.setItem('sigaps_user', JSON.stringify(user));
      if (user.municipalityId) {
        localStorage.setItem('sigaps_active_municipality', user.municipalityId);
      }
    },
    {
      user: body.user,
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
    },
  );

  await page.context().storageState({ path: authFile });
});
