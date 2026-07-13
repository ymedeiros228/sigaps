import { test, expect } from '@playwright/test';

test.describe('Multi-município', () => {
  test('admin vê seletor e pode trocar para Pedreiras', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('nav-dashboard')).toBeVisible({ timeout: 30_000 });
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
