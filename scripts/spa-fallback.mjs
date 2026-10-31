// Makes every client-side route survive a hard refresh on a plain static host.
//
// A browser refresh asks the server for the current path. The server has no
// idea that /login is a React route, so it answers "404 Not Found" unless the
// host is told to fall back to index.html. Render can be told that with a
// rewrite rule, but the rule only applies when the site is created from the
// Blueprint.
//
// This runs as a Vite plugin so the fallback lands in the build output no
// matter how the build is invoked — `npm run build`, `vite build`, or a
// dashboard build command that calls Vite directly. It writes:
//
//   dist/404.html            served by hosts that look for a custom 404 page
//   dist/<route>/index.html  served by hosts that resolve a directory to its
//                            index.html — this one answers with a 200
//
// Both files are byte-for-byte copies of dist/index.html. The app reads the
// path with the History API, so it renders the right view either way.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Every route the router can land on. Keep in sync with the <Route> elements
// in src/App.jsx.
const ROUTES = ['login', 'signup', 'posts', 'profile', 'users'];

/** @returns {import('vite').Plugin} */
export function spaFallback() {
  return {
    name: 'connect-hub:spa-fallback',
    apply: 'build',
    async closeBundle() {
      const dist = join(process.cwd(), 'dist');
      const html = await readFile(join(dist, 'index.html'), 'utf8');

      // The last-resort net: hosts that serve a custom 404 page boot the app
      // from it. The status code stays 404, but the user gets the app instead
      // of a plain-text error.
      await writeFile(join(dist, '404.html'), html);

      // The clean case: a host that resolves /login to /login/index.html
      // answers with 200 and the right content type.
      for (const route of ROUTES) {
        const dir = join(dist, route);
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, 'index.html'), html);
      }

      // A marker, so a deploy can be checked from outside: this file only
      // exists when the fallback was written.
      await writeFile(
        join(dist, 'spa-fallback.json'),
        `${JSON.stringify({ routes: ROUTES }, null, 2)}\n`,
      );

      this.info?.(
        `spa-fallback: wrote dist/404.html and ${ROUTES.length} route shells (${ROUTES.join(', ')})`,
      );
    },
  };
}
