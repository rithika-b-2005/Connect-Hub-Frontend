import { test, expect } from '@playwright/test';
import { API_URL, E2E_USER } from '../helpers/config.js';
import { createTestAccount, requestWithThrottleRetry, seedSession } from '../helpers/auth.js';

test.describe('profile', () => {
  test('shows the account name, email and role', async ({ page, request }) => {
    const { user } = await seedSession(page, request);
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'Personal Information' })).toBeVisible();

    await expect(page.getByRole('heading', { name: user.name })).toBeVisible();
    await expect(page.getByLabel('Email Address')).toHaveValue(user.email);
    await expect(page.getByLabel('Email Address')).toBeDisabled();

    // The role badge on the profile card (the header badge is hidden on
    // phones, so it cannot be used here).
    const banner = page.locator('section').first();
    await expect(banner.getByText(/^user$/i)).toBeVisible();
  });

  test('the save button stays disabled when nothing changed', async ({ page, request }) => {
    await seedSession(page, request);
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'Personal Information' })).toBeVisible();

    await expect(page.getByRole('button', { name: /save changes/i })).toBeDisabled();
  });

  test('updates the display name and restores it', async ({ page, request }) => {
    // A dedicated account: the shared one must stay untouched so the mobile
    // and desktop projects do not race each other over the same profile.
    const account = await createTestAccount(request, { name: 'Profile Rename' });
    const temporary = 'Playwright Renamed';

    await seedSession(page, request, account);
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'Personal Information' })).toBeVisible();

    await page.getByLabel('Full Name').fill(temporary);
    await page.getByRole('button', { name: /save changes/i }).click();
    await expect(page.getByText('Name updated')).toBeVisible();
    await expect(page.getByRole('heading', { name: temporary })).toBeVisible();

    // Restore so the account is reusable.
    await page.getByLabel('Full Name').fill(account.name);
    await page.getByRole('button', { name: /save changes/i }).click();
    await expect(page.getByText('Name updated')).toBeVisible();
    await expect(page.getByRole('heading', { name: account.name })).toBeVisible();
  });

  test('rejects a wrong current password', async ({ page, request }) => {
    const account = await createTestAccount(request, { name: 'Profile Password' });

    await seedSession(page, request, account);
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'Personal Information' })).toBeVisible();

    await page.getByLabel('Current Password', { exact: true }).fill('wrong-password');
    await page.getByLabel('New Password', { exact: true }).fill('AnotherPassword!1');
    await page.getByRole('button', { name: /update password/i }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText('Password changed')).toHaveCount(0);

    // A wrong current password is a form error, not a session failure: the
    // user must stay signed in and stay on the profile page.
    await expect(page).toHaveURL(/\/profile$/);
    expect(
      await page.evaluate(() => window.localStorage.getItem('token')),
      'a rejected password change must not sign the user out',
    ).toBeTruthy();

    // The original password must still work afterwards.
    const login = await requestWithThrottleRetry(request, 'post', `${API_URL}/auth/login`, {
      data: { email: account.email, password: account.password },
    });
    expect(login.status()).toBe(200);
  });

  test('changes the password', async ({ page, request }) => {
    const account = await createTestAccount(request, { name: 'Profile Password' });
    const temporary = 'PlaywrightTmp!2026';

    await seedSession(page, request, account);
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'Personal Information' })).toBeVisible();

    await page.getByLabel('Current Password', { exact: true }).fill(account.password);
    await page.getByLabel('New Password', { exact: true }).fill(temporary);
    await page.getByRole('button', { name: /update password/i }).click();
    await expect(page.getByText('Password changed')).toBeVisible();

    // The new password works and the old one no longer does.
    const withNew = await requestWithThrottleRetry(request, 'post', `${API_URL}/auth/login`, {
      data: { email: account.email, password: temporary },
    });
    expect(withNew.status()).toBe(200);

    const withOld = await requestWithThrottleRetry(request, 'post', `${API_URL}/auth/login`, {
      data: { email: account.email, password: account.password },
    });
    expect(withOld.status()).toBe(401);
  });

  test('the session survives a reload and keeps the signed-in user', async ({ page, request }) => {
    await seedSession(page, request);
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'Personal Information' })).toBeVisible();

    await page.reload();

    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByRole('heading', { name: 'Personal Information' })).toBeVisible();
    await expect(page.getByLabel('Email Address')).toHaveValue(E2E_USER.email);
  });
});
