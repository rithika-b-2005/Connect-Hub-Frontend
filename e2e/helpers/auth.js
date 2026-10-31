import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect } from '@playwright/test';
import { API_URL, E2E_USER, marker } from './config.js';

/**
 * The backend throttles POST /auth/login to roughly five requests per minute
 * and answers 429 beyond that. Without handling it the whole suite spends its
 * time queued behind the limiter, so every login goes through this retry and
 * the resulting token is shared between workers through a cache file.
 */

const THROTTLE_STATUS = 429;
const MAX_LOGIN_ATTEMPTS = 8;
// Backoff between attempts. The limiter resets on a ~60s window, so a single
// long wait is usually enough; the shorter steps recover faster when the
// window has already rolled over.
const BACKOFF_MS = [15_000, 20_000, 30_000, 45_000, 60_000, 60_000, 60_000];

const CACHE_DIR = path.resolve('e2e/.cache');
const SESSION_TTL_MS = 30 * 60 * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** In-process cache: email -> { token, user }. */
const sessionCache = new Map();

const cacheFile = (email) =>
  path.join(CACHE_DIR, `session-${email.replace(/[^a-z0-9]/gi, '_')}.json`);

function readCachedSession(email) {
  const file = cacheFile(email);
  if (!existsSync(file)) return null;

  try {
    const saved = JSON.parse(readFileSync(file, 'utf8'));
    if (!saved?.token) return null;
    if (Date.now() - (saved.savedAt || 0) > SESSION_TTL_MS) return null;
    return { token: saved.token, user: saved.user };
  } catch {
    return null;
  }
}

function writeCachedSession(email, session) {
  try {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(
      cacheFile(email),
      JSON.stringify({ ...session, savedAt: Date.now() }),
      'utf8',
    );
  } catch {
    // A missing cache only costs one extra login.
  }
}

/**
 * Perform a request that is allowed to fail with 429, retrying until the
 * throttle window resets.
 */
export async function requestWithThrottleRetry(request, method, url, options = {}) {
  let response;

  for (let attempt = 0; attempt < MAX_LOGIN_ATTEMPTS; attempt += 1) {
    response = await request[method](url, options);

    if (response.status() !== THROTTLE_STATUS) return response;
    if (attempt === MAX_LOGIN_ATTEMPTS - 1) return response;

    await sleep(BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]);
  }

  return response;
}

/**
 * Log in through the API and return { token, user }.
 *
 * The token is cached per worker and on disk, so a suite run does not spend
 * hundreds of requests on the throttled login endpoint. Pass { fresh: true }
 * to force a brand new login.
 */
export async function apiLogin(request, credentials = E2E_USER, { fresh = false } = {}) {
  if (!fresh) {
    const inMemory = sessionCache.get(credentials.email);
    if (inMemory) return inMemory;

    const onDisk = readCachedSession(credentials.email);
    if (onDisk) {
      sessionCache.set(credentials.email, onDisk);
      return onDisk;
    }
  }

  const response = await requestWithThrottleRetry(request, 'post', `${API_URL}/auth/login`, {
    data: { email: credentials.email, password: credentials.password },
  });

  if (!response || !response.ok()) {
    // The account may simply not exist yet — a wiped database, or a first run
    // against a fresh backend. Sign up for it and use the token signup
    // returns, which is one request instead of a login.
    if (response?.status() === 401) {
      try {
        const created = await createTestAccount(request, credentials);
        sessionCache.set(credentials.email, created);
        writeCachedSession(credentials.email, created);
        return created;
      } catch {
        // The account does exist and the sign in was rejected. Fall through
        // and report the login failure, which says more.
      }
    }

    throw new Error(
      `API login failed for ${credentials.email}: ${response?.status()} ${
        response ? await response.text() : 'no response'
      }`,
    );
  }

  const data = await response.json();
  const session = { token: data.accessToken, user: data.user };
  sessionCache.set(credentials.email, session);
  writeCachedSession(credentials.email, session);
  return session;
}

/** Drop the cached session for an account (used after a password change). */
export function clearSessionCache(credentials = E2E_USER) {
  sessionCache.delete(credentials.email);
  const file = cacheFile(credentials.email);
  if (existsSync(file)) {
    try {
      writeFileSync(file, '', 'utf8');
    } catch {
      // ignore
    }
  }
}

/**
 * Provision a throwaway account through the API.
 *
 * Signup is not throttled, so this is cheap, and the response already carries
 * a token — no second (throttled) login needed. Mutating scenarios (rename,
 * password change) use a dedicated account so the shared one stays stable for
 * the rest of the suite, and so the mobile and desktop projects cannot race
 * each other over the same profile.
 */
export async function createTestAccount(request, overrides = {}) {
  const email = overrides.email || `e2e-${marker('acct')}@connecthub.test`;
  const password = overrides.password || 'PlaywrightE2E!2026';
  const name = overrides.name || 'E2E Account';

  const response = await requestWithThrottleRetry(request, 'post', `${API_URL}/auth/signup`, {
    data: { name, email, password },
  });

  if (!response || !response.ok()) {
    throw new Error(
      `Could not create test account ${email}: ${response?.status()} ${
        response ? await response.text() : 'no response'
      }`,
    );
  }

  const data = await response.json();
  return { email, password, name, token: data.accessToken, user: data.user };
}

/**
 * Seed localStorage so the app boots straight into an authenticated session.
 * The session check still runs against the real backend.
 */
export async function seedSession(page, request, credentials = E2E_USER) {
  // An account created through signup already carries a token; reuse it
  // instead of spending another request on the throttled login endpoint.
  const session = credentials.token
    ? { token: credentials.token, user: credentials.user }
    : await apiLogin(request, credentials);

  await page.addInitScript(
    ([t, u]) => {
      window.localStorage.setItem('token', t);
      window.localStorage.setItem('user', u);
    },
    [session.token, JSON.stringify(session.user)],
  );
  return session;
}

/**
 * Log in through the UI and wait for the dashboard.
 *
 * Retries when the backend throttles the login, since a throttled attempt
 * renders the same error panel as any other failed sign in.
 */
export async function loginViaUi(page, credentials = E2E_USER) {
  await page.goto('/login');

  for (let attempt = 1; attempt <= MAX_LOGIN_ATTEMPTS; attempt += 1) {
    await page.getByLabel('Work Email').fill(credentials.email);
    await page.getByLabel('Password', { exact: true }).fill(credentials.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    // The dashboard heading carries the member name ("Welcome back, …"); the
    // login screen's own heading is just "Welcome Back", so the comma keeps
    // the two apart.
    const dashboard = page.getByRole('heading', { name: /welcome back,/i });
    const alert = page.getByRole('alert');

    const outcome = await Promise.race([
      dashboard.waitFor({ state: 'visible', timeout: 20_000 }).then(() => 'ok'),
      alert.waitFor({ state: 'visible', timeout: 20_000 }).then(() => 'error'),
    ]);

    if (outcome === 'ok') return;

    const message = ((await alert.textContent()) || '').trim();
    const throttled = /too many (attempts|requests)|throttl|429/i.test(message);
    if (!throttled || attempt === MAX_LOGIN_ATTEMPTS) {
      throw new Error(`UI login failed: ${message}`);
    }

    await sleep(BACKOFF_MS[Math.min(attempt - 1, BACKOFF_MS.length - 1)]);
  }
}

/** Open the mobile account sheet. */
export async function openAccountSheet(page) {
  const nav = page.getByRole('navigation', { name: 'Primary' });
  await nav.getByRole('button', { name: 'Account' }).click();
  await expect(page.getByRole('dialog', { name: 'Account' })).toBeVisible();
}

/** Log out through whichever UI is present (sidebar on desktop, sheet on mobile). */
export async function logoutViaUi(page) {
  const sidebarLogout = page.getByRole('button', { name: 'Logout' });
  if (await sidebarLogout.isVisible()) {
    await sidebarLogout.click();
  } else {
    await openAccountSheet(page);
    await page.getByRole('dialog', { name: 'Account' }).getByRole('button', { name: 'Logout' }).click();
  }
  await expect(page).toHaveURL(/\/login$/);
}

/**
 * Force the shared E2E account back onto a known password.
 * Tries each candidate password until one authenticates, then resets it.
 */
export async function resetAccountPassword(request, desired, candidates) {
  for (const password of candidates) {
    const login = await requestWithThrottleRetry(request, 'post', `${API_URL}/auth/login`, {
      data: { email: E2E_USER.email, password },
    });
    if (!login || !login.ok()) continue;

    const { accessToken } = await login.json();
    const patched = await request.patch(`${API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { currentPassword: password, newPassword: desired },
    });
    if (patched.ok()) {
      clearSessionCache();
      return true;
    }
  }
  return false;
}

/** Delete a post directly through the API (author cleanup). */
export async function deletePost(request, token, postId) {
  const response = await request.delete(`${API_URL}/posts/${postId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.status();
}

/** Create a post directly through the API and return it. */
export async function createPost(request, token, { title, description }) {
  const response = await request.post(`${API_URL}/posts`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      title,
      description,
    },
  });
  if (!response.ok()) {
    throw new Error(`Create post failed: ${response.status()} ${await response.text()}`);
  }
  return response.json();
}

/**
 * Poll the API until `predicate` holds. Use this instead of a fixed sleep
 * when the UI has just fired a request that the server still has to persist.
 */
export async function waitForApi(request, url, predicate, { token, timeout = 15_000 } = {}) {
  const deadline = Date.now() + timeout;
  let last;

  while (Date.now() < deadline) {
    const response = await request.get(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (response.ok()) {
      last = await response.json();
      if (predicate(last)) return last;
    }
    await sleep(400);
  }

  throw new Error(`Timed out waiting for ${url}. Last value: ${JSON.stringify(last)}`);
}
