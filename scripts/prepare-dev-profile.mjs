/**
 * Runs before `npm run dev`. Recent Chrome versions disable extensions loaded
 * from the command line (which is how web-ext loads Evidentia) unless the
 * profile has "Developer mode" enabled in chrome://extensions. Seed that
 * preference in the dev profile so the first launch already works.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const profile = process.env.EVIDENTIA_CHROME_PROFILE ?? fileURLToPath(new URL('../.wxt/chrome-profile', import.meta.url));
const prefsPath = join(profile, 'Default', 'Preferences');
mkdirSync(join(profile, 'Default'), { recursive: true });
let prefs = {};
if (existsSync(prefsPath)) {
  try { prefs = JSON.parse(readFileSync(prefsPath, 'utf8')); } catch { prefs = {}; }
}
prefs.extensions ??= {};
prefs.extensions.ui ??= {};
if (prefs.extensions.ui.developer_mode !== true) {
  prefs.extensions.ui.developer_mode = true;
  writeFileSync(prefsPath, JSON.stringify(prefs));
  console.log(`[evidentia] developer mode enabled in dev profile: ${profile}`);
}
