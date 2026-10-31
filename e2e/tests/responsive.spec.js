import { test, expect } from '@playwright/test';
import { seedSession } from '../helpers/auth.js';

const WIDTHS = [320, 360, 375, 390, 414, 768, 1024, 1280];
const ROUTES = ['/login', '/', '/posts', '/profile'];

/**
 * Elements wider than the viewport, ignoring anything that a clipped or
 * scrollable ancestor already contains. A decorative blob inside an
 * `overflow: hidden` wrapper can stick out of the viewport without ever
 * producing a scrollbar.
 */
async function findOverflowingElements(page) {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const offenders = [];

    const containedByAncestor = (element) => {
      let parent = element.parentElement;
      while (parent && parent !== document.body && parent !== document.documentElement) {
        const overflowX = getComputedStyle(parent).overflowX;
        if (
          overflowX === 'hidden' ||
          overflowX === 'clip' ||
          overflowX === 'auto' ||
          overflowX === 'scroll'
        ) {
          return true;
        }
        parent = parent.parentElement;
      }
      return false;
    };

    document.querySelectorAll('body *').forEach((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      if (rect.right <= viewportWidth + 1) return;
      if (containedByAncestor(element)) return;

      // Decorative, non-interactive layers (glows, blurs) are meant to bleed
      // off the edge of the screen. They cannot be scrolled to and cannot
      // trap a click, so only the scrollWidth check above holds them to
      // account.
      if (getComputedStyle(element).pointerEvents === 'none') return;

      const className = String(element.className || '').slice(0, 70);
      offenders.push(`${element.tagName.toLowerCase()}${className ? `.${className}` : ''} right=${Math.round(rect.right)}`);
    });

    return offenders.slice(0, 8);
  });
}

/** True when the document can actually be scrolled sideways. */
async function canScrollHorizontally(page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    return de.scrollWidth > de.clientWidth + 1;
  });
}

for (const width of WIDTHS) {
  test.describe(`viewport ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } });

    test('no horizontal overflow on any page', async ({ page, request }) => {
      await seedSession(page, request);

      for (const route of ROUTES) {
        await page.goto(route);
        await page.waitForLoadState('networkidle');

        // The user-visible symptom: a sideways scrollbar.
        expect(
          await canScrollHorizontally(page),
          `${route} at ${width}px can be scrolled sideways`,
        ).toBe(false);

        const offenders = await findOverflowingElements(page);
        expect(offenders, `${route} at ${width}px overflows: ${offenders.join(', ')}`).toEqual(
          [],
        );
      }
    });

    test('the navigation switches between bottom tabs and sidebar', async ({ page, request }) => {
      await seedSession(page, request);
      await page.goto('/');

      const tabBar = page.getByRole('navigation', { name: 'Primary' });
      const sidebar = page.locator('aside');

      if (width < 768) {
        await expect(tabBar).toBeVisible();
        await expect(sidebar).toBeHidden();
      } else {
        await expect(sidebar).toBeVisible();
        await expect(tabBar).toBeHidden();
      }
    });

    test('the primary action stays reachable and tappable', async ({ page, request }) => {
      await seedSession(page, request);
      await page.goto('/posts');
      await expect(page.getByRole('heading', { name: 'Community Posts' })).toBeVisible();

      const newPost = page.getByRole('button', { name: /new post/i });
      await expect(newPost).toBeVisible();

      const box = await newPost.boundingBox();
      expect(box, 'the primary action must be on screen').not.toBeNull();
      expect(box.height, 'the primary action should be a comfortable tap target').toBeGreaterThanOrEqual(
        32,
      );
      expect(box.x + box.width, 'the primary action must fit in the viewport').toBeLessThanOrEqual(
        width + 1,
      );
    });
  });
}
