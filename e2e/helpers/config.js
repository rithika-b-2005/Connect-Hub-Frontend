// Shared configuration for the end-to-end suite.
// Every value can be overridden with an environment variable so the suite can
// point at a different deployment without editing code.

export const API_URL = (
  process.env.E2E_API_URL || 'https://connect-hub-backend-1.onrender.com'
).replace(/\/+$/, '');

export const LIVE_FRONTEND_URL =
  process.env.E2E_LIVE_URL || 'https://connect-hub-frontend-1.onrender.com';

// Account used by the suite. It is created on first run and reused afterwards.
export const E2E_USER = {
  email: process.env.E2E_EMAIL || 'playwright.e2e@connecthub.test',
  password: process.env.E2E_PASSWORD || 'PlaywrightE2E!2026',
  name: 'Playwright E2E',
};

// Admin scenarios (user management, moderation) need an admin account.
// The backend prints a generated admin password on first start.
export const E2E_ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL || '',
  password: process.env.E2E_ADMIN_PASSWORD || '',
};

export const hasAdminCredentials = Boolean(E2E_ADMIN.email && E2E_ADMIN.password);

// Unique marker so parallel workers never collide on shared backend data.
export const marker = (label) =>
  `e2e-${label}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;
