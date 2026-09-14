import { fileURLToPath } from 'node:url';
import { defineWebExtConfig } from 'wxt';

/**
 * How `npm run dev` launches the browser with Evidentia already loaded.
 *
 * Requires the `web-ext` dev dependency: without it WXT silently falls back
 * to its manual runner and only prints "Load ... as an unpacked extension
 * manually" instead of opening a browser.
 *
 * - a dedicated, persistent Chrome profile in .wxt/chrome-profile so the
 *   Microsoft 365 login survives restarts (the folder is git-ignored);
 * - the browser opens directly on Word Online.
 *
 * The profile path must be absolute: web-ext passes it to Chrome as
 * --user-data-dir, which does not resolve relative paths predictably.
 *
 * Environment overrides (useful for a second, parallel instance):
 *   EVIDENTIA_CHROME_PROFILE=/abs/path   use another profile directory
 *   EVIDENTIA_DEBUG_PORT=9333            expose the DevTools protocol on that port
 *   EVIDENTIA_START_URL=https://...      open a different start page
 *
 * To use a specific binary (e.g. Edge) set `binaries.chrome` to its path.
 */
const profileDir = process.env.EVIDENTIA_CHROME_PROFILE ?? fileURLToPath(new URL('.wxt/chrome-profile', import.meta.url));
const debugPort = process.env.EVIDENTIA_DEBUG_PORT;

export default defineWebExtConfig({
  chromiumProfile: profileDir,
  keepProfileChanges: true,
  startUrls: [process.env.EVIDENTIA_START_URL ?? 'https://www.office.com/launch/word'],
  chromiumArgs: ['--no-first-run', '--disable-features=TranslateUI', ...(debugPort ? [`--remote-debugging-port=${debugPort}`] : [])],
  // binaries: { chrome: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' },
});
