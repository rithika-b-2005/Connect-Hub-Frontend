import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT || 4173);
const LOCAL_URL = `http://localhost:${PORT}`;

// The deployed frontend on Render. Its deep routes 404 without a rewrite rule,
// so this project is the regression guard for that bug.
const LIVE_URL = process.env.E2E_LIVE_URL || 'https://connect-hub-frontend-1.onrender.com';

export default defineConfig({
  testDir: './e2e/tests',
  outputDir: './e2e/.artifacts',
  // The backend throttles logins and lives on a free-tier host that can take
  // a while to answer, so tests need more headroom than the defaults.
  timeout: 180_000,
  expect: { timeout: 30_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // The backend throttles POST /auth/login to ~5 requests per minute, so a wide
  // worker pool just queues every worker behind the limiter.
  workers: process.env.CI ? 2 : 2,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'e2e/.artifacts/results.json' }],
  ],
  use: {
    baseURL: LOCAL_URL,
    actionTimeout: 60_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    // The backend only sends `access-control-allow-origin` for the deployed
    // frontend origin, so the browser blocks every API call made from
    // localhost. Relax the browser's same-origin policy so the suite can
    // still exercise the real backend. This changes the test browser only —
    // the application bundle is untouched.
    launchOptions: {
      args: ['--disable-web-security', '--disable-site-isolation-trials'],
    },
  },
  projects: [
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'] },
      // The API contract is viewport independent; run it once to keep the
      // throttled login endpoint as quiet as possible.
      testIgnore: /(live|api)\.spec\.js/,
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
      testIgnore: /live\.spec\.js/,
    },
    {
      // Runs against the real Render deployment: proves the SPA fallback rewrite
      // is live and that the deployed build boots.
      name: 'live',
      testMatch: /(live|spa-fallback)\.spec\.js/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, baseURL: LIVE_URL },
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: LOCAL_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
