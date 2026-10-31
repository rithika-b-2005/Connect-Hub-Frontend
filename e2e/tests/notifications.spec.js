import { test, expect } from '@playwright/test';
import { API_URL, E2E_ADMIN, hasAdminCredentials } from '../helpers/config.js';
import { createTestAccount, seedSession, waitForApi } from '../helpers/auth.js';

// The notification bell lives in the top bar on every screen size.
test.describe('notifications', () => {
  test.beforeEach(async ({ page, request }) => {
    await seedSession(page, request);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /welcome back,/i })).toBeVisible();
  });

  test('the bell opens the notifications panel', async ({ page }) => {
    await page.getByRole('button', { name: /notifications/i }).click();

    const panel = page.getByRole('region', { name: 'Notifications' });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'Notifications' })).toBeVisible();
  });

  test('clicking the bell again closes the panel', async ({ page }) => {
    const bell = page.getByRole('button', { name: /notifications/i });

    await bell.click();
    await expect(page.getByRole('region', { name: 'Notifications' })).toBeVisible();

    await bell.click();
    await expect(page.getByRole('region', { name: 'Notifications' })).toBeHidden();
  });

  test('an empty inbox says so instead of rendering nothing', async ({ page, request }) => {
    // A fresh account has no notifications at all.
    const account = await createTestAccount(request, { name: 'Empty Inbox' });
    const empty = await request.get(`${API_URL}/notifications/me`, {
      headers: { Authorization: `Bearer ${account.token}` },
    });
    expect(empty.status()).toBe(200);
    expect(await empty.json()).toEqual([]);

    await seedSession(page, request, account);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /welcome back,/i })).toBeVisible();

    await page.getByRole('button', { name: /notifications/i }).click();

    const panel = page.getByRole('region', { name: 'Notifications' });
    await expect(panel).toBeVisible();
    await expect(panel.getByText(/all caught up/i)).toBeVisible();
  });

  test('the panel does not push the page sideways on a phone', async ({ page }) => {
    await page.getByRole('button', { name: /notifications/i }).click();

    const panel = page.getByRole('region', { name: 'Notifications' });
    await expect(panel).toBeVisible();

    const fits = await panel.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left >= -1 && rect.right <= document.documentElement.clientWidth + 1;
    });
    expect(fits, 'the notifications panel must fit inside the viewport').toBe(true);
  });
});

test.describe('notifications about moderation', () => {
  test.skip(!hasAdminCredentials, 'set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run admin tests');

  test('an author is told when a moderator hides their post, and can mark it read', async ({
    page,
    request,
  }) => {
    const author = await createTestAccount(request, { name: 'Notified Author' });
    const title = `notified-${Date.now().toString(36)}`;

    const created = await request.post(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${author.token}` },
      multipart: { title, description: 'post that will be moderated' },
    });
    const post = await created.json();

    // The admin hides it, which is what raises the notification.
    const adminLogin = await request.post(`${API_URL}/auth/login`, {
      data: { email: E2E_ADMIN.email, password: E2E_ADMIN.password },
    });
    const { accessToken } = await adminLogin.json();
    await request.patch(`${API_URL}/posts/${post.id}/moderation`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { status: 'hidden', reason: 'Off topic for the community' },
    });

    const notifications = await waitForApi(
      request,
      `${API_URL}/notifications/me`,
      (value) => value.length > 0,
      { token: author.token },
    );
    expect(notifications[0].message).toContain(title);
    expect(notifications[0].readAt, 'a new notification starts unread').toBeNull();

    await seedSession(page, request, author);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /welcome back,/i })).toBeVisible();

    // The bell carries an unread badge.
    const bell = page.getByRole('button', { name: /notifications/i });
    await expect(bell).toHaveAttribute('aria-label', /unread/i);

    await bell.click();
    const panel = page.getByRole('region', { name: 'Notifications' });
    await expect(panel).toBeVisible();
    await expect(panel.getByText(title)).toBeVisible();
    await expect(panel.getByText(/off topic for the community/i)).toBeVisible();

    // Marking it read updates the badge and the server.
    await page.getByRole('button', { name: /mark all read/i }).click();
    await expect(bell).toHaveAttribute('aria-label', /^Notifications$/);

    const read = await waitForApi(
      request,
      `${API_URL}/notifications/me`,
      (value) => value.length > 0 && value.every((item) => item.readAt),
      { token: author.token },
    );
    expect(read.every((item) => item.readAt)).toBe(true);
  });
});
