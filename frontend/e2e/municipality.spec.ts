import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test.describe('Multi-município', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('admin vê seletor e pode trocar para Pedreiras', async ({ page }) => {
    const switcher = page.getByTestId('municipality-switcher');
    await expect(switcher).toBeVisible({ timeout: 15_000 });

    await switcher.click();
    await page.getByTestId('municipality-option-pedreiras').click();
    await expect(page.getByTestId('municipality-switch-dialog')).toBeVisible();
    await page.getByTestId('municipality-switch-confirm').click();

    await expect(switcher).toContainText('Pedreiras');
    await expect(page.getByText('Pedreiras/MA')).toBeVisible();
  });
});
