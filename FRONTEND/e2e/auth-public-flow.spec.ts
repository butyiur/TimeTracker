import { expect, test } from '@playwright/test';

test.describe('Public Auth Flow', () => {
  test('login page renders and public navigation works', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Bejelentkezés' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Belépés' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Regisztráció' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Elfelejtett jelszó' })).toBeVisible();

    await page.getByRole('link', { name: 'Regisztráció' }).click();
    await expect(page).toHaveURL(/\/register$/);

    await page.goto('/login');
    await page.getByRole('link', { name: 'Elfelejtett jelszó' }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);
  });
});
