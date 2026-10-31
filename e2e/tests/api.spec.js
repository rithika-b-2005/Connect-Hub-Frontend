import { test, expect } from '@playwright/test';
import { API_URL, E2E_USER, marker } from '../helpers/config.js';
import { apiLogin, requestWithThrottleRetry } from '../helpers/auth.js';

test.describe('API contract', () => {
  test('the health endpoint reports the service is up', async ({ request }) => {
    const response = await request.get(`${API_URL}/health`);
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  test('protected routes reject anonymous callers', async ({ request }) => {
    for (const route of ['/posts', '/users', '/notifications/me', '/users/me']) {
      const response = await request.get(`${API_URL}${route}`);
      expect(response.status(), `${route} must require authentication`).toBe(401);
    }
  });

  test('login rejects wrong credentials', async ({ request }) => {
    const response = await requestWithThrottleRetry(request, 'post', `${API_URL}/auth/login`, {
      data: { email: 'nobody@connecthub.test', password: 'not-the-password' },
    });
    expect(response.status()).toBe(401);
    expect((await response.json()).message).toBeTruthy();
  });

  test('login returns a token and the user profile', async ({ request }) => {
    const { token, user } = await apiLogin(request, E2E_USER, { fresh: true });
    expect(token).toBeTruthy();
    expect(user.email).toBe(E2E_USER.email);
    expect(['admin', 'user']).toContain(user.role);
  });

  test('a garbage token is rejected with 401, not 500', async ({ request }) => {
    const response = await request.get(`${API_URL}/users/me`, {
      headers: { Authorization: 'Bearer not-a-real-token' },
    });
    expect(response.status()).toBe(401);
  });

  test('a valid token unlocks the profile endpoint', async ({ request }) => {
    const { token } = await apiLogin(request);

    const response = await request.get(`${API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status()).toBe(200);

    const user = await response.json();
    expect(user.email).toBe(E2E_USER.email);
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('createdAt');
  });

  test('duplicate signups are rejected', async ({ request }) => {
    const response = await requestWithThrottleRetry(request, 'post', `${API_URL}/auth/signup`, {
      data: { name: 'Duplicate', email: E2E_USER.email, password: E2E_USER.password },
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
  });

  test('creating a post requires authentication', async ({ request }) => {
    const response = await request.post(`${API_URL}/posts`, {
      multipart: { title: 'anonymous', description: 'should not be created' },
    });
    expect(response.status()).toBe(401);
  });

  test('a post can be created, read, liked and deleted', async ({ request }) => {
    const { token } = await apiLogin(request);
    const headers = { Authorization: `Bearer ${token}` };

    const title = marker('api-roundtrip');
    const created = await request.post(`${API_URL}/posts`, {
      headers,
      multipart: { title, description: 'API round trip fixture' },
    });
    expect(created.status()).toBe(201);
    const post = await created.json();
    expect(post.title).toBe(title);

    const read = await request.get(`${API_URL}/posts/${post.id}`, { headers });
    expect(read.status()).toBe(200);
    expect((await read.json()).title).toBe(title);

    // The like endpoint answers 201 with the new counters.
    const liked = await request.post(`${API_URL}/posts/${post.id}/like`, { headers });
    expect(liked.status()).toBe(201);
    const likeBody = await liked.json();
    expect(likeBody.likeCount).toBe(1);
    expect(likeBody.liked).toBe(true);

    // Liking again toggles it off.
    const unliked = await request.post(`${API_URL}/posts/${post.id}/like`, { headers });
    expect(unliked.status()).toBe(201);
    expect((await unliked.json()).likeCount).toBe(0);

    const deleted = await request.delete(`${API_URL}/posts/${post.id}`, { headers });
    expect(deleted.status()).toBeLessThan(300);

    const gone = await request.get(`${API_URL}/posts/${post.id}`, { headers });
    expect(gone.status()).toBeGreaterThanOrEqual(400);
  });

  test('comments can be added to a post', async ({ request }) => {
    const { token } = await apiLogin(request);
    const headers = { Authorization: `Bearer ${token}` };

    const title = marker('api-comment');
    const created = await request.post(`${API_URL}/posts`, {
      headers,
      multipart: { title, description: 'comment fixture' },
    });
    const post = await created.json();

    const comment = await request.post(`${API_URL}/posts/${post.id}/comments`, {
      headers,
      data: { content: 'api comment fixture' },
    });
    expect(comment.status()).toBe(201);

    await request.delete(`${API_URL}/posts/${post.id}`, { headers });
  });

  test('CORS allows the deployed frontend origin', async ({ request }) => {
    const response = await request.fetch(`${API_URL}/health`, {
      headers: { Origin: 'https://connect-hub-frontend-1.onrender.com' },
    });
    expect(response.headers()['access-control-allow-origin']).toBeTruthy();
  });

  test('unknown routes answer with JSON, not an HTML error page', async ({ request }) => {
    const response = await request.get(`${API_URL}/definitely-not-a-route`);
    expect(response.status()).toBe(404);
    expect(response.headers()['content-type']).toContain('application/json');
  });
});
