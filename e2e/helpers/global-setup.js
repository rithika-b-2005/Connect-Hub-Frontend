import { request as playwrightRequest } from '@playwright/test';
import { API_URL, E2E_USER } from './config.js';

/**
 * Provision the shared account before the suite starts.
 *
 * The suite signs this account in through the UI as well as through the API,
 * and the UI path has no way to recover from a missing account: the sign-in
 * screen just says "Invalid email or password". So the account has to exist
 * before the first test runs, not as a side effect of whichever test happens
 * to need it first.
 *
 * Signup answers 409 when the account is already there, which is the normal
 * case on a second run. Both outcomes leave the account in place.
 */
export default async function globalSetup() {
  const context = await playwrightRequest.newContext({ baseURL: API_URL });

  try {
    const response = await context.post('/auth/signup', {
      data: { name: E2E_USER.name, email: E2E_USER.email, password: E2E_USER.password },
    });

    if (![200, 201, 409].includes(response.status())) {
      throw new Error(
        `Could not provision ${E2E_USER.email}: ${response.status()} ${await response.text()}`,
      );
    }
  } finally {
    await context.dispose();
  }
}
