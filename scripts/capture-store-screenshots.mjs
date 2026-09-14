/**
 * Genera gli screenshot 1280x800 per la scheda del Chrome Web Store a partire
 * dai casi demo (nessun documento reale). Vedi docs/store-listing.md.
 *
 *   npm run build
 *   npx playwright-core install chromium     # una volta
 *   node scripts/capture-store-screenshots.mjs
 *
 * Nota: Chrome stabile dalla versione 137 ignora --load-extension, quindi serve
 * la build "Chrome for Testing" che playwright-core scarica. Si può indicare un
 * altro binario con EVIDENTIA_CHROME_BIN.
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const EXT = join(root, '.output/chrome-mv3');
const OUT = join(root, 'store/screenshots');
const PROFILE = join(root, '.output/scratch/store-shot-profile');
const WIDTH = 1280;
const HEIGHT = 800;

if (!existsSync(join(EXT, 'manifest.json'))) {
  console.error(`Estensione non trovata in ${EXT}. Esegui prima: npm run build`);
  process.exit(1);
}

const bin = process.env.EVIDENTIA_CHROME_BIN ?? chromium.executablePath();
if (!existsSync(bin)) {
  console.error(`Browser non trovato: ${bin}\nEsegui: npx playwright-core install chromium`);
  process.exit(1);
}

// Chrome deriva l'ID di un'estensione unpacked dal path assoluto: sha256, primi
// 16 byte, ogni nibble mappato 0-f -> a-p.
const extId = createHash('sha256').update(EXT).digest('hex').slice(0, 32)
  .split('').map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');

// Nomi plausibili al posto di quelli dei casi demo: la vetrina non deve
// mostrare "Caso A" come se fosse il nome di un compito.
const RENAME = {
  'Saggio Pedagogia - Caso A.docx': 'Saggio argomentativo.docx',
  'Saggio Pedagogia - Caso C.docx': 'Relazione di laboratorio.docx',
  'Saggio Pedagogia - Caso E.docx': 'Tema di italiano.docx',
};

rmSync(PROFILE, { recursive: true, force: true });
mkdirSync(join(PROFILE, 'Default'), { recursive: true });
mkdirSync(OUT, { recursive: true });
// Come scripts/prepare-dev-profile.mjs: senza modalita sviluppatore Chrome
// disabilita le estensioni caricate da riga di comando.
writeFileSync(join(PROFILE, 'Default', 'Preferences'), JSON.stringify({ extensions: { ui: { developer_mode: true } } }));

const ctx = await chromium.launchPersistentContext(PROFILE, {
  executablePath: bin,
  headless: false,
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 2, // si cattura a 2560x1600 e si riduce: testo piu nitido
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--hide-scrollbars'],
});

const page = await ctx.newPage();
await page.goto(`chrome-extension://${extId}/process-view.html`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);

for (const c of ['Caso A', 'Caso C', 'Caso E']) {
  await page.getByRole('button', { name: new RegExp(`^${c}`) }).click();
  await page.waitForTimeout(2500);
}

// Il nome nella sidebar puo essere gia stato sostituito da tidy(): si accetta
// sia quello originale del caso demo sia quello mostrato in vetrina.
const selectDoc = async (letter) => {
  const original = `Saggio Pedagogia - Caso ${letter}.docx`;
  const shown = RENAME[original];
  await page.locator('aside.sidebar button.doc', { hasText: new RegExp(`${original}|${shown}`) }).click();
  await page.waitForTimeout(1500);
};

const openTab = async (label) => {
  await page.locator('nav.tabs button', { hasText: new RegExp(`^${label}$`) }).click();
  await page.waitForTimeout(700);
};

/** Toglie il messaggio di stato e sostituisce i nomi dei file demo. */
const tidy = () =>
  page.evaluate((rename) => {
    for (const el of document.querySelectorAll('.notice')) el.remove();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      for (const [from, to] of Object.entries(rename)) {
        if (n.nodeValue.includes(from)) n.nodeValue = n.nodeValue.replaceAll(from, to);
      }
    }
  }, RENAME);

const shot = async (name, { keepScroll = false } = {}) => {
  // I click sulla sidebar lasciano la pagina scrollata: senza questo la
  // schermata parte a meta interfaccia.
  if (!keepScroll) {
    // La sidebar ha un proprio overflow: va riportata in cima anche lei.
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      document.querySelector('aside.sidebar')?.scrollTo(0, 0);
    });
    await page.waitForTimeout(200);
  }
  await tidy();
  const buf = await page.screenshot();
  await sharp(buf).resize(WIDTH, HEIGHT).png().toFile(join(OUT, `${name}.png`));
  console.log(`store/screenshots/${name}.png`);
};

await selectDoc('A');
await openTab('Overview');
await shot('1-overview');
await openTab('Timeline');
await shot('2-timeline');
await openTab('Contenuti per fase');
await shot('3-contenuti-per-fase');

await selectDoc('C');
await openTab('Versions');
const rows = page.locator('table tr.selectable');
const n = await rows.count();
await rows.nth(0).click();
await rows.nth(n - 1).click();
await page.waitForTimeout(900);
await page.locator('h2, h3', { hasText: /^Confronto versione/ }).first().evaluate((el) => {
  el.scrollIntoView({ block: 'start' });
  window.scrollBy(0, -140);
});
await page.waitForTimeout(400);
await shot('4-confronto-versioni', { keepScroll: true });

await selectDoc('E');
await openTab('Observation gaps');
await shot('5-gap-di-osservazione');

await ctx.close();
rmSync(PROFILE, { recursive: true, force: true });
