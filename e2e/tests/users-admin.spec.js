import { test, expect } from '@playwright/test';
import { API_URL, E2E_ADMIN, hasAdminCredentials, marker } from '../helpers/config.js';
import { createTestAccount, seedSession, waitForApi } from '../helpers/auth.js';

/** Log the admin in through the API (no page involved). */
async function adminToken(request) {
  const response = await request.post(`${API_URL}/auth/login`, {
    data: { email: E2E_ADMIN.email, password: E2E_ADMIN.password },
  });
  const { accessToken, user } = await response.json();
  return { token: accessToken, user };
}

/**
 * The member list renders twice: as cards on phones and as a table on wide
 * screens. Both are in the DOM, one of them hidden, so every lookup has to
 * be scoped to the visible layout.
 */
function memberEntry(page, email) {
  const table = page.getByRole('row').filter({ hasText: email });
  const card = page.getByRole('listitem').filter({ hasText: email });
  return table.or(card);
}

/**
 * Fill the search box and wait for the (debounced, server side) result list
 * to settle on the one member we care about.
 */
async function searchFor(page, email) {
  await page.getByPlaceholder(/search by name or email/i).fill(email);
  const entry = memberEntry(page, email);
  await expect(entry).toHaveCount(1);
  // The list reloads after the debounce; wait for it to settle.
  await expect(page.getByText('Loading...')).toHaveCount(0);
  return entry;
}

// Admin scenarios need an admin account. The backend creates the admin
// account with a generated password on first start, so the credentials are
// supplied through the environment.
test.describe('user management (admin)', () => {
  test.skip(!hasAdminCredentials, 'set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run admin tests');

  test.beforeEach(async ({ page, request }) => {
    await seedSession(page, request, E2E_ADMIN);
    await page.goto('/users');
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
    await expect(page.getByText('Loading...')).toHaveCount(0);
  });

  test('lists members in a table on wide screens', async ({ page, isMobile }) => {
    test.skip(Boolean(isMobile), 'wide screens only');

    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Email' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Role' })).toBeVisible();
  });

  test('filters members by role', async ({ page, isMobile }) => {
    await page.getByRole('combobox').first().selectOption('admin');

    // The list reloads after a debounce, so poll until the filter has been
    // applied and every remaining row is an admin.
    const roleSelects = page.locator(isMobile ? 'ul select' : 'tbody select');
    await expect.poll(
      async () =>
        roleSelects.evaluateAll((selects) => {
          const roles = selects.map((select) => select.value);
          return roles.length > 0 && roles.every((role) => role === 'admin');
        }),
      { timeout: 20_000 },
    ).toBe(true);
  });

  test('searches members by name or email', async ({ page, request }) => {
    const name = `Searchable ${marker('target')}`;
    const account = await createTestAccount(request, { name });

    const entry = await searchFor(page, account.email);
    await expect(entry).toBeVisible();

    await page.getByPlaceholder(/search by name or email/i).fill('no-such-member-xyz');
    // The message shows in both the card list and the table; only one of
    // them is on screen.
    await expect(page.getByText(/no users found/i).filter({ visible: true })).toBeVisible();
  });

  test('shows the member card list instead of a table on phones', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone layout only');

    await expect(page.getByRole('table')).toBeHidden();
    await expect(page.getByText('Account actions').first()).toBeVisible();
  });

  test('promotes a member to admin and back again', async ({ page, request }) => {
    const account = await createTestAccount(request, { name: `Role Toggle ${marker('target')}` });

    const entry = await searchFor(page, account.email);
    const roleSelect = entry.locator('select');
    await expect(roleSelect).toHaveValue('user');

    await roleSelect.selectOption('admin');
    await expect(roleSelect).toHaveValue('admin');

    // The change must be persisted, not just optimistic. A role change
    // invalidates the account's existing token by design, so sign in again
    // to read the new role off the server.
    const fresh = await request.post(`${API_URL}/auth/login`, {
      data: { email: account.email, password: account.password },
    });
    expect(fresh.status()).toBe(200);
    expect((await fresh.json()).user.role, 'the member should be an admin on the server').toBe(
      'admin',
    );

    await roleSelect.selectOption('user');
    await expect(roleSelect).toHaveValue('user');
  });

  test('resets a member password and shows the new one once', async ({ page, request }) => {
    const account = await createTestAccount(request, { name: `Password Reset ${marker('target')}` });

    const entry = await searchFor(page, account.email);
    page.once('dialog', (dialog) => dialog.accept());

    await entry.getByRole('button', { name: `Reset password for ${account.name}` }).click();

    await expect(page.getByRole('heading', { name: 'Password reset' })).toBeVisible();
    const issued = await page.locator('p.font-mono').textContent();
    expect(issued?.trim(), 'a temporary password should be shown').toBeTruthy();

    // The temporary password really works.
    const login = await request.post(`${API_URL}/auth/login`, {
      data: { email: account.email, password: issued.trim() },
    });
    expect(login.status()).toBe(200);

    // And the old password does not.
    const old = await request.post(`${API_URL}/auth/login`, {
      data: { email: account.email, password: account.password },
    });
    expect(old.status()).toBe(401);
  });

  test('deletes a member', async ({ page, request }) => {
    const account = await createTestAccount(request, { name: `Delete Me ${marker('target')}` });

    const entry = await searchFor(page, account.email);
    await expect(entry).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await entry.getByRole('button', { name: `Delete ${account.name}` }).click();

    await expect(memberEntry(page, account.email)).toHaveCount(0);
  });

  test('an admin cannot delete their own account', async ({ page, request }) => {
    const me = await request.get(`${API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${(await adminToken(request)).token}` },
    });
    const { name } = await me.json();

    const entry = await searchFor(page, E2E_ADMIN.email);
    await expect(entry).toBeVisible();

    await expect(entry.getByRole('button', { name: `Delete ${name}` })).toBeDisabled();
  });

  test('the admin dashboard shows platform-wide stats instead of personal ones', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /welcome back,/i })).toBeVisible();
    await expect(page.getByText('Total Posts', { exact: true })).toBeVisible();
    await expect(page.getByText('Total Users', { exact: true })).toBeVisible();
    await expect(page.getByText('My Posts', { exact: true })).toHaveCount(0);
  });

  test('an admin sees the users section and no profile section', async ({ page }) => {
    await page.goto('/');

    const sidebar = page.locator('aside');
    if (await sidebar.isVisible()) {
      await expect(sidebar.getByRole('link', { name: 'Users' })).toBeVisible();
      await expect(sidebar.getByRole('link', { name: 'Profile' })).toHaveCount(0);
    }
  });
});

test.describe('post moderation (admin)', () => {
  test.skip(!hasAdminCredentials, 'set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run admin tests');

  test('hides and restores a member post', async ({ page, request }) => {
    // A member writes the post the admin moderates.
    const author = await createTestAccount(request, { name: 'Moderated Author' });
    const title = `moderated-${marker('post')}`;

    const created = await request.post(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${author.token}` },
      multipart: { title, description: 'post awaiting moderation' },
    });
    expect(created.status()).toBe(201);

    await seedSession(page, request, E2E_ADMIN);
    await page.goto('/posts');
    await expect(page.getByRole('heading', { name: 'Community Posts' })).toBeVisible();

    await page.getByPlaceholder(/search posts/i).fill(title);
    await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible();

    // Hide it, with a reason.
    await page.getByRole('button', { name: /^hide$/i }).click();
    await expect(page.getByRole('heading', { name: 'Hide post' })).toBeVisible();
    await page.getByLabel(/reason/i).fill('Hidden by the end-to-end suite');
    await page.getByRole('button', { name: /^confirm$/i }).click();

    await expect(page.getByRole('button', { name: /^restore$/i })).toBeVisible();

    // The author is told about it.
    const notifications = await waitForApi(
      request,
      `${API_URL}/notifications/me`,
      (value) => value.length > 0,
      { token: author.token },
    );
    expect(notifications[0].message).toContain(title);

    // Restore it again.
    await page.getByRole('button', { name: /^restore$/i }).click();
    await expect(page.getByRole('heading', { name: 'Restore post' })).toBeVisible();
    await page.getByRole('button', { name: /^restore post$/i }).click();

    await expect(page.getByRole('button', { name: /^hide$/i })).toBeVisible();
  });

  test('the author sees the moderation reason on a moderated post', async ({ page, request }) => {
    const author = await createTestAccount(request, { name: 'Restricted Author' });
    const title = `restricted-${marker('post')}`;

    const created = await request.post(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${author.token}` },
      multipart: { title, description: 'post to be restricted' },
    });
    const post = await created.json();

    const admin = await adminToken(request);
    const moderated = await request.patch(`${API_URL}/posts/${post.id}/moderation`, {
      headers: { Authorization: `Bearer ${admin.token}` },
      data: { status: 'restricted', reason: 'Links to an external site' },
    });
    expect(moderated.status()).toBeLessThan(300);

    await seedSession(page, request, author);
    await page.goto('/posts');
    await page.getByPlaceholder(/search posts/i).fill(title);

    await expect(page.getByText(/moderation reason/i)).toBeVisible();
    await expect(page.getByText(/links to an external site/i)).toBeVisible();
  });
});
