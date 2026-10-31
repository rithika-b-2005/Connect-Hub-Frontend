import { test, expect } from '@playwright/test';
import { E2E_USER } from '../helpers/config.js';
import { apiLogin, loginViaUi, logoutViaUi, seedSession } from '../helpers/auth.js';

test.describe('authentication', () => {
  test('rejects invalid credentials with a visible error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Work Email').fill('nobody@connecthub.test');
    await page.getByLabel('Password', { exact: true }).fill('definitely-wrong');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
  });

  test('never leaks a raw backend exception into the error panel', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Work Email').fill('nobody@connecthub.test');
    await page.getByLabel('Password', { exact: true }).fill('definitely-wrong');
    await page.getByRole('button', { name: /sign in/i }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();

    const message = (await alert.textContent()) || '';
    expect(message, 'the error panel should read like a sentence').not.toMatch(
      /ThrottlerException|Exception:|undefined|\[object/i,
    );
    expect(message, 'the error panel should not leak a stack trace').not.toMatch(/\bat\s+\w+.*:\d+:\d+/);
  });

  test('signs in and stores the session', async ({ page }) => {
    await loginViaUi(page);

    await expect(page).toHaveURL(/\/$/);
    const token = await page.evaluate(() => window.localStorage.getItem('token'));
    const user = await page.evaluate(() => window.localStorage.getItem('user'));
    expect(token).toBeTruthy();
    expect(JSON.parse(user).email).toBe(E2E_USER.email);
  });

  test('the password field can be revealed and hidden again', async ({ page }) => {
    await page.goto('/login');

    const password = page.getByLabel('Password', { exact: true });
    await expect(password).toHaveAttribute('type', 'password');

    await page.getByRole('button', { name: 'Toggle password visibility' }).click();
    await expect(password).toHaveAttribute('type', 'text');

    await page.getByRole('button', { name: 'Toggle password visibility' }).click();
    await expect(password).toHaveAttribute('type', 'password');
  });

  test('the signup link on the login screen leads to the signup page', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: /create a connecthub account/i }).click();

    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
  });

  test('blocks protected routes when signed out', async ({ page }) => {
    for (const route of ['/', '/posts', '/profile', '/users']) {
      await page.goto(route);
      await expect(page, `${route} must redirect to the login screen`).toHaveURL(/\/login$/);
    }
  });

  test('a non-admin is redirected away from the admin route', async ({ page, request }) => {
    await seedSession(page, request);

    await page.goto('/users');
    await expect(page).toHaveURL(/\/$/);
  });

  test('unknown routes fall back to the dashboard', async ({ page, request }) => {
    const { token, user } = await apiLogin(request);
    await page.addInitScript(
      ([t, u]) => {
        window.localStorage.setItem('token', t);
        window.localStorage.setItem('user', u);
      },
      [token, JSON.stringify(user)],
    );

    await page.goto('/this-route-does-not-exist');
    await expect(page).toHaveURL(/\/$/);
  });

  test('an expired or garbage token is cleared and the user is bounced to login', async ({ page }) => {
    // Seed the broken session on a page that does not need one, then load the
    // app. addInitScript would put the token back on every navigation and
    // send the app into a redirect loop.
    await page.goto('/login');
    await page.evaluate(() => {
      window.localStorage.setItem('token', 'not-a-real-jwt');
      window.localStorage.setItem(
        'user',
        JSON.stringify({ id: 1, name: 'Ghost', email: 'ghost@connecthub.test', role: 'user' }),
      );
    });

    await page.goto('/');

    await expect(page).toHaveURL(/\/login$/);
    await expect
      .poll(async () => page.evaluate(() => window.localStorage.getItem('token')))
      .toBeNull();
  });

  test('logging out clears the session', async ({ page, request }) => {
    await seedSession(page, request);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /welcome back,/i })).toBeVisible();

    await logoutViaUi(page);

    expect(await page.evaluate(() => window.localStorage.getItem('token'))).toBeNull();
    expect(await page.evaluate(() => window.localStorage.getItem('user'))).toBeNull();
  });

  test('the signup page creates an account and lands on the dashboard', async ({ page }) => {
    const email = `e2e-signup-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}@connecthub.test`;
    const password = 'PlaywrightE2E!2026';

    await page.goto('/signup');
    await page.getByLabel('Full Name').fill('E2E Signup');
    await page.getByLabel('Work Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByRole('heading', { name: /welcome back,/i })).toBeVisible();
    expect(await page.evaluate(() => window.localStorage.getItem('token'))).toBeTruthy();
  });

  test('a duplicate email is reported as an error', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel('Full Name').fill('E2E Duplicate');
    await page.getByLabel('Work Email').fill(E2E_USER.email);
    await page.getByLabel('Password', { exact: true }).fill(E2E_USER.password);
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/signup$/);
  });

  test('the signup form validates before hitting the network', async ({ page }) => {
    await page.goto('/signup');

    // Empty required fields must not submit.
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/signup$/);

    // A too short password must be rejected by the client.
    await page.getByLabel('Full Name').fill('E2E Short');
    await page.getByLabel('Work Email').fill(`e2e-short-${Date.now().toString(36)}@connecthub.test`);
    await page.getByLabel('Password', { exact: true }).fill('abc');
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page).toHaveURL(/\/signup$/);
    expect(await page.evaluate(() => window.localStorage.getItem('token'))).toBeNull();
  });
});
