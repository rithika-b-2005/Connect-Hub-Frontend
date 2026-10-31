import { test, expect } from '@playwright/test';
import { seedSession } from '../helpers/auth.js';

test.describe('dashboard', () => {
  test.beforeEach(async ({ page, request }) => {
    await seedSession(page, request);
  });

  test('renders the welcome header and personal stat cards', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /welcome back,/i })).toBeVisible();
    await expect(page.getByText('Live Analytics')).toBeVisible();

    // A regular member sees personal stats, not platform stats.
    await expect(page.getByText('My Posts', { exact: true })).toBeVisible();
    await expect(page.getByText('Likes Received', { exact: true })).toBeVisible();
    await expect(page.getByText('Views Received', { exact: true })).toBeVisible();
  });

  test('shows the performance chart and the recent posts panel', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'My Posts Performance' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'My Recent Posts' })).toBeVisible();
    await expect(page.getByRole('link', { name: /view all posts/i })).toBeVisible();
  });

  test('the create post call to action is present for members', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /create post/i })).toBeVisible();
  });

  test('the member navigation exposes profile and hides users', async ({ page }) => {
    await page.goto('/');

    const nav = page.getByRole('navigation', { name: 'Primary' });
    const sidebar = page.locator('aside');

    // Bottom tab bar (phones) and sidebar (desktop) must agree on the routes.
    if (await nav.isVisible()) {
      await expect(nav.getByRole('link', { name: 'Profile' })).toBeVisible();
      await expect(nav.getByRole('link', { name: 'Users' })).toHaveCount(0);
    }
    if (await sidebar.isVisible()) {
      await expect(sidebar.getByRole('link', { name: 'Profile' })).toBeVisible();
      await expect(sidebar.getByRole('link', { name: 'Users' })).toHaveCount(0);
    }
  });
});
