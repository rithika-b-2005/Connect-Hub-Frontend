import { test, expect } from '@playwright/test';
import { API_URL, marker } from '../helpers/config.js';
import { apiLogin, createTestAccount, seedSession, waitForApi } from '../helpers/auth.js';

/** Find a post id on the server by its exact title. */
async function findPostId(request, token, title) {
  const response = await request.get(`${API_URL}/posts`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const posts = await response.json();
  return posts.find((post) => post.title === title)?.id;
}

async function getPost(request, token, id) {
  const response = await request.get(`${API_URL}/posts/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

test.describe('posts feed', () => {
  let token;
  const created = [];

  test.beforeEach(async ({ page, request }) => {
    const session = await apiLogin(request);
    token = session.token;
    await seedSession(page, request);
    await page.goto('/posts');
    await expect(page.getByRole('heading', { name: 'Community Posts' })).toBeVisible();
  });

  test.afterEach(async ({ request }) => {
    for (const title of created.splice(0)) {
      const id = await findPostId(request, token, title);
      if (id) {
        await request.delete(`${API_URL}/posts/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    }
  });

  test('shows the empty state when nothing matches', async ({ page }) => {
    await page.getByPlaceholder(/search posts/i).fill(marker('no-match'));
    await expect(page.getByText(/no posts match/i)).toBeVisible();
  });

  test('creates a post through the modal and it appears in the feed', async ({ page, request }) => {
    const title = marker('created');
    const description = 'Created by the Playwright end-to-end suite.';

    await page.getByRole('button', { name: /new post/i }).click();
    await expect(page.getByRole('heading', { name: 'Create New Post' })).toBeVisible();

    await page.getByLabel('Post Title').fill(title);
    await page.getByLabel('Description').fill(description);
    await page.getByRole('button', { name: /^create post$/i }).click();

    await expect(page.getByRole('heading', { name: 'Create New Post' })).toBeHidden();
    await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible();

    const id = await findPostId(request, token, title);
    expect(id, 'the new post should be persisted on the server').toBeTruthy();
    created.push(title);
  });

  test('the modal requires a title and description', async ({ page }) => {
    await page.getByRole('button', { name: /new post/i }).click();
    await expect(page.getByRole('heading', { name: 'Create New Post' })).toBeVisible();

    // Submitting an empty form must not create anything.
    await page.getByRole('button', { name: /^create post$/i }).click();
    await expect(page.getByRole('heading', { name: 'Create New Post' })).toBeVisible();
    await expect(page.getByLabel('Post Title')).toHaveValue('');
    await expect(page.getByLabel('Description')).toHaveValue('');
  });

  test('search narrows the feed down to the matching post', async ({ page, request }) => {
    const title = marker('searchable');
    const other = marker('other');
    for (const t of [title, other]) {
      await request.post(`${API_URL}/posts`, {
        headers: { Authorization: `Bearer ${token}` },
        multipart: { title: t, description: 'search fixture' },
      });
      created.push(t);
    }

    await page.reload();
    await page.getByPlaceholder(/search posts/i).fill(title);

    await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: other, exact: true })).toHaveCount(0);
  });

  test('liking a post updates the UI and the server', async ({ page, request }) => {
    const title = marker('likeable');
    await request.post(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: { title, description: 'like fixture' },
    });
    created.push(title);

    await page.reload();
    await page.getByPlaceholder(/search posts/i).fill(title);

    const likeButton = page.getByRole('button', { name: `Like ${title}`, exact: true });
    await expect(likeButton).toBeVisible();
    await likeButton.click();

    await expect(page.getByRole('button', { name: `Unlike ${title}`, exact: true })).toBeVisible();

    const id = await findPostId(request, token, title);
    // The UI updates optimistically, so poll the server until it agrees.
    const post = await waitForApi(
      request,
      `${API_URL}/posts/${id}`,
      (value) => value.likeCount === 1 && value.likedByMe === true,
      { token },
    );
    expect(post.likeCount, 'the like should be persisted server-side').toBe(1);
    expect(post.likedByMe).toBe(true);

    await page.getByRole('button', { name: `Unlike ${title}`, exact: true }).click();
    await expect(page.getByRole('button', { name: `Like ${title}`, exact: true })).toBeVisible();

    const after = await waitForApi(
      request,
      `${API_URL}/posts/${id}`,
      (value) => value.likeCount === 0,
      { token },
    );
    expect(after.likeCount).toBe(0);
  });

  test('sorting by most viewed reorders the feed', async ({ page, request }) => {
    // A shared prefix keeps the fixture set isolated from other test runs.
    const prefix = marker('sort');
    const viewed = `${prefix}-viewed`;
    const ignored = `${prefix}-ignored`;
    for (const t of [viewed, ignored]) {
      await request.post(`${API_URL}/posts`, {
        headers: { Authorization: `Bearer ${token}` },
        multipart: { title: t, description: 'sort fixture' },
      });
      created.push(t);
    }

    // A view only counts when another member opens the post, so the fixture
    // posts are authored by the shared account and read by a second one.
    const viewer = await createTestAccount(request, { name: 'Sort Viewer' });
    const viewedId = await findPostId(request, token, viewed);
    await request.get(`${API_URL}/posts/${viewedId}`, {
      headers: { Authorization: `Bearer ${viewer.token}` },
    });

    await page.reload();
    await page.getByPlaceholder(/search posts/i).fill(prefix);

    // Open the post from the feed so the client picks up the new view count.
    await page.getByRole('button', { name: viewed, exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Post & comments' })).toBeVisible();
    await page.getByRole('button', { name: 'Close post details' }).click();

    await page.getByLabel('Sort posts').selectOption('viewed');

    const order = await page.locator('article').evaluateAll((cards) =>
      cards.map((card) => card.querySelector('button.font-heading')?.textContent?.trim()),
    );

    expect(order, 'both fixtures should be in the feed').toContain(viewed);
    expect(order).toContain(ignored);
    expect(
      order.indexOf(viewed),
      'the post with a view should be listed first',
    ).toBeLessThan(order.indexOf(ignored));
  });

  test('opens post details and posts a comment', async ({ page, request }) => {
    const title = marker('commentable');
    const commentText = `comment ${marker('c')}`;
    await request.post(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: { title, description: 'comment fixture' },
    });
    created.push(title);

    await page.reload();
    await page.getByPlaceholder(/search posts/i).fill(title);
    await page.getByRole('button', { name: title, exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Post & comments' })).toBeVisible();
    await page.getByLabel('Write a comment').fill(commentText);
    await page.getByRole('button', { name: /^post$/i }).click();

    await expect(page.getByText(commentText)).toBeVisible();

    const id = await findPostId(request, token, title);
    const post = await getPost(request, token, id);
    expect(post.comments.some((comment) => comment.content === commentText)).toBe(true);
  });

  test('deletes a post the member owns', async ({ page, request }) => {
    const title = marker('deletable');
    await request.post(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: { title, description: 'delete fixture' },
    });

    await page.reload();
    await page.getByPlaceholder(/search posts/i).fill(title);
    await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTitle('Delete post').click();

    await expect(page.getByRole('button', { name: title, exact: true })).toHaveCount(0);
    expect(await findPostId(request, token, title)).toBeUndefined();
  });

  test('a member cannot see moderation controls', async ({ page }) => {
    const title = marker('mod');
    await page.getByPlaceholder(/search posts/i).fill(title);
    await expect(page.getByRole('button', { name: /^hide$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^restrict$/i })).toHaveCount(0);
  });
});
