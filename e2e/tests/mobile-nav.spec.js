import { test, expect } from '@playwright/test';
import { openAccountSheet, seedSession } from '../helpers/auth.js';

test.describe('mobile navigation', () => {
  test.skip(({ viewport }) => viewport.width >= 768, 'mobile layout only');

  test.beforeEach(async ({ page, request }) => {
    await seedSession(page, request);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /welcome back,/i })).toBeVisible();
  });

  test('shows the bottom tab bar and hides the desktop sidebar', async ({ page }) => {
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
    await expect(page.locator('aside')).toBeHidden();
  });

  test('bottom tabs navigate between the main sections', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Primary' });

    await nav.getByRole('link', { name: 'Posts' }).click();
    await expect(page).toHaveURL(/\/posts$/);
    await expect(page.getByRole('heading', { name: 'Community Posts' })).toBeVisible();

    await nav.getByRole('link', { name: 'Home' }).click();
    await expect(page).toHaveURL(/\/$/);

    await nav.getByRole('link', { name: 'Profile' }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByRole('heading', { name: 'Personal Information' })).toBeVisible();
  });

  test('exactly one tab is highlighted at a time', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Primary' });

    await nav.getByRole('link', { name: 'Posts' }).click();
    await expect(page).toHaveURL(/\/posts$/);

    const active = nav.locator('a.text-primary');
    await expect(active).toHaveCount(1);
    await expect(active).toContainText('Posts');
  });

  test('the tab bar is reachable with a thumb-sized tap target', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Primary' });
    const box = await nav.getByRole('link', { name: 'Posts' }).boundingBox();

    expect(box.height, 'tab targets should be at least 48px tall').toBeGreaterThanOrEqual(48);
    expect(box.width).toBeGreaterThanOrEqual(48);
  });

  test('the account sheet shows who is signed in', async ({ page }) => {
    await openAccountSheet(page);

    const sheet = page.getByRole('dialog', { name: 'Account' });
    await expect(sheet.getByText('Playwright E2E')).toBeVisible();
    await expect(sheet.getByText(/playwright\.e2e@connecthub\.test/)).toBeVisible();
    await expect(sheet.getByText('User', { exact: true })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Logout' })).toBeVisible();
  });

  test('a member can reach their profile from the bottom tab bar', async ({ page }) => {
    // The account sheet no longer repeats the profile link; the tab bar is
    // the way in on a phone.
    const nav = page.getByRole('navigation', { name: 'Primary' });

    await nav.getByRole('link', { name: 'Profile' }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByRole('heading', { name: 'Personal Information' })).toBeVisible();
  });

  test('logging out from the sheet ends the session', async ({ page }) => {
    await openAccountSheet(page);
    await page.getByRole('dialog', { name: 'Account' }).getByRole('button', { name: 'Logout' }).click();

    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate(() => window.localStorage.getItem('token'))).toBeNull();
  });

  test('the notification bell opens the notifications panel', async ({ page }) => {
    await page.getByRole('button', { name: /notifications/i }).click();
    await expect(page.getByRole('region', { name: 'Notifications' })).toBeVisible();
    await expect(page.getByText(/all caught up/i)).toBeVisible();
  });

  test('the tab bar does not cover the last content', async ({ page }) => {
    await page.goto('/posts');
    // Wait for the app to finish its session check, otherwise the assertion
    // would measure the loading screen instead of the page.
    await expect(page.getByRole('heading', { name: 'Community Posts' })).toBeVisible();

    const main = page.locator('main');
    const padding = await main.evaluate((element) => getComputedStyle(element).paddingBottom);

    expect(
      parseFloat(padding),
      'main needs bottom padding so content clears the fixed tab bar',
    ).toBeGreaterThan(60);
  });

  test('the brand mark in the header navigates home', async ({ page }) => {
    await page.goto('/posts');
    await page.getByRole('link', { name: 'ConnectHub dashboard' }).first().click();
    await expect(page).toHaveURL(/\/$/);
  });
});
