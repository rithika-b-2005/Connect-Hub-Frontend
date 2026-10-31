import { test, expect } from '@playwright/test';
import { LIVE_FRONTEND_URL } from '../helpers/config.js';

// These run against the real Render deployment (project "live").
// They are the guard for the "refresh gives 404" bug: Render serves the
// static bundle with no SPA fallback until the rewrite rule is configured.

test.describe('live deployment', () => {
  test('serves the app shell at the root', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/ConnectHub/i);
    await expect(page.locator('#root')).toBeAttached();
  });

  test('deep routes are rewritten to the SPA shell', async ({ request, baseURL }) => {
    for (const route of ['/login', '/signup', '/posts']) {
      const response = await request.get(`${baseURL}${route}`);
      expect(
        response.status(),
        `${route} returned ${response.status()} on ${LIVE_FRONTEND_URL}. Add the Render rewrite rule: source /*, destination /index.html, type Rewrite.`,
      ).toBe(200);
      expect(await response.text()).toContain('<div id="root">');
    }
  });

  test('static assets resolve', async ({ page }) => {
    const failed = [];
    page.on('response', (response) => {
      if (response.status() >= 400 && !response.url().includes('/notifications')) {
        failed.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.goto('/');
    await expect(page.locator('#root')).toBeAttached();
    await page.waitForLoadState('networkidle');

    expect(failed, `Failing requests: ${failed.join(', ')}`).toHaveLength(0);
  });

  test('the deployed build points at the live backend', async ({ page }) => {
    // A wrong VITE_API_URL is baked into the bundle at build time.
    await page.goto('/');
    const bundle = await page.evaluate(async () => {
      const src = document.querySelector('script[type="module"]')?.src;
      if (!src) return '';
      const text = await (await fetch(src)).text();
      return text;
    });

    expect(bundle, 'The deployed bundle should reference the live backend').toContain(
      'connect-hub-backend-1.onrender.com',
    );
    expect(bundle, 'The deployed bundle still points at the dead Netlify API').not.toContain(
      'connecthubapi.netlify.app',
    );
  });
});
