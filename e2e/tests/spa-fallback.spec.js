import { test, expect } from '@playwright/test';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { seedSession } from '../helpers/auth.js';

// Every client-side route the router can land on.
const ROUTES = ['/', '/login', '/signup', '/posts', '/profile', '/users'];

// The routes that need their own shell in the build output. The root already
// has one.
const BUILD_ROUTES = ['login', 'signup', 'posts', 'profile', 'users'];

test.describe('SPA fallback — refreshing any route must serve the app', () => {
  for (const route of ROUTES) {
    test(`${route} returns the HTML shell, not a 404`, async ({ request, baseURL }) => {
      const response = await request.get(`${baseURL}${route}`);

      expect(
        response.status(),
        `${route} should be served by the SPA fallback. The build writes a shell for every route, and on Render a rewrite rule covers the rest.`,
      ).toBe(200);

      expect(response.headers()['content-type']).toContain('text/html');

      const body = await response.text();
      expect(body, `${route} should contain the React root element`).toContain('<div id="root">');
      expect(body, `${route} must not be the platform 404 page`).not.toMatch(/page not found/i);
      expect(body).not.toMatch(/^\s*not found\s*$/i);
    });
  }

  test('the build output carries a fallback for every route', async () => {
    const dist = join(process.cwd(), 'dist');

    // The last-resort net for hosts that serve a custom 404 page.
    await expect(access(join(dist, '404.html'))).resolves.toBeUndefined();

    // The marker, so a deploy can be checked from outside.
    await expect(access(join(dist, 'spa-fallback.json'))).resolves.toBeUndefined();

    for (const route of BUILD_ROUTES) {
      const shell = join(dist, route, 'index.html');
      await expect(access(shell), `dist/${route}/index.html is missing`).resolves.toBeUndefined();

      const body = await readFile(shell, 'utf8');
      expect(body, `dist/${route}/index.html is not the app shell`).toContain('<div id="root">');
    }
  });

  test('a hard refresh keeps the route and re-renders the page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();

    await page.reload();

    // Router state survives the reload and the same view comes back.
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
  });

  test('an authenticated deep link survives a refresh', async ({ page, request }) => {
    await seedSession(page, request);
    await page.goto('/posts');
    await expect(page).toHaveURL(/\/posts$/);

    await page.reload();

    await expect(page).toHaveURL(/\/posts$/);
    await expect(page.getByRole('heading', { name: 'Community Posts' })).toBeVisible();
  });

  test('no unhandled console errors while booting the shell', async ({ page }) => {
    const errors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();

    expect(errors, `Console errors on boot: ${errors.join(' | ')}`).toHaveLength(0);
  });
});
