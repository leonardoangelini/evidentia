/**
 * Builds the coordinated brand assets from brand/src/marks.mjs:
 *   brand/svg/     vector originals (mark, small mark, mono, lockups, wordmark; text as outlines)
 *   brand/png/     rasters at common sizes
 *   brand/store/   Chrome Web Store icon and promo tiles
 *   brand/social/  Open Graph image and avatar
 *   brand/favicon.ico
 *   public/icon/{16,32,48,128}.png   extension icons (WXT picks them up automatically)
 *
 * Usage: npm run brand:build
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import opentype from 'opentype.js';
import { BLUE, INK, LIGHT_BLUE, PAPER, WHITE, markKnockout, markShapes, markSmallShapes, svg, tile } from '../brand/src/marks.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = (p) => join(root, p);
const ensure = (p) => mkdirSync(dirname(p), { recursive: true });
const write = (p, data) => { ensure(out(p)); writeFileSync(out(p), data); console.log('  ' + p); };

const font = opentype.parse(readFileSync(out('brand/src/fonts/Manrope-ExtraBold.ttf')).buffer);
const fontMedium = opentype.parse(readFileSync(out('brand/src/fonts/Manrope-Medium.ttf')).buffer);
const CAP = font.tables.os2.sCapHeight / font.unitsPerEm; // ≈ 0.72

/** Path data from opentype commands. opentype's own toPathData() emits NaN for some coordinates. */
function pathData(path) {
  const n = (v) => (Math.round(v * 100) / 100).toString();
  return path.commands
    .map((c) => {
      switch (c.type) {
        case 'M': return `M${n(c.x)} ${n(c.y)}`;
        case 'L': return `L${n(c.x)} ${n(c.y)}`;
        case 'Q': return `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`;
        case 'C': return `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`;
        default: return 'Z';
      }
    })
    .join('');
}

/** Wordmark "Evidentia" as outlines. Returns path data and its advance width for the given font size. */
function wordmark(size, x, baseline, color) {
  const text = 'Evidentia';
  const options = { kerning: true, letterSpacing: -0.03 };
  const path = font.getPath(text, x, baseline, size, options);
  const width = font.getAdvanceWidth(text, size, options);
  const d = pathData(path);
  if (d.includes('NaN')) throw new Error('wordmark outline contains NaN');
  return { d, width, svg: `<path d="${d}" fill="${color}"/>` };
}

/** Horizontal lockup: mark tile (64) + wordmark with cap height = 32, on a transparent canvas. */
function lockupHorizontal({ text = INK, markBg = BLUE, withTile = true } = {}) {
  const size = 32 / CAP;
  const gap = 18;
  const w = wordmark(size, 64 + gap, 32 + 16, text);
  const width = Math.ceil(64 + gap + w.width);
  const mark = withTile ? `${tile(markBg)}${markShapes({ bg: markBg })}` : markKnockout(text);
  return { width, height: 64, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 64" width="${width}" height="64" role="img" aria-label="Evidentia">\n  <title>Evidentia</title>\n  <g>${mark}</g>\n  ${w.svg}\n</svg>\n` };
}

/** Vertical lockup: mark (96) above the wordmark, centred. */
function lockupVertical({ text = INK, markBg = BLUE } = {}) {
  const size = 22 / CAP;
  const probe = wordmark(size, 0, 0, text);
  const width = Math.ceil(Math.max(96, probe.width) + 16);
  const wm = wordmark(size, (width - probe.width) / 2, 96 + 20 + 22, text);
  const height = 96 + 20 + 22 + 10;
  return { width, height, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Evidentia">\n  <title>Evidentia</title>\n  <g transform="translate(${(width - 96) / 2},0) scale(1.5)">${tile(markBg)}${markShapes({ bg: markBg })}</g>\n  ${wm.svg}\n</svg>\n` };
}

function wordmarkOnly(color) {
  const size = 40 / CAP;
  const w = wordmark(size, 2, 42, color);
  const width = Math.ceil(w.width + 4);
  return { width, height: 52, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 52" width="${width}" height="52" role="img" aria-label="Evidentia">\n  <title>Evidentia</title>\n  ${w.svg}\n</svg>\n` };
}

/** Promo tile: background colour, lockup centred, optional tagline. */
function promo(width, height, { bg, text, markBg, tagline, taglineColor }) {
  const scale = Math.min(width / 520, height / 200);
  const lk = lockupHorizontal({ text, markBg });
  const lw = lk.width * scale;
  const lh = 64 * scale;
  const y = tagline ? (height - lh) / 2 - 14 * scale : (height - lh) / 2;
  const inner = lk.svg.replace(/^[\s\S]*?<title>Evidentia<\/title>\n/, '').replace(/<\/svg>\s*$/, '');
  // Tagline as outlines too (Manrope Medium), sized to fit 86% of the width.
  // letterSpacing must be non-zero: opentype.js emits NaN coordinates for some glyphs when it is 0/undefined.
  let tag = '';
  if (tagline) {
    const opts = { kerning: true, letterSpacing: 0.001 };
    let fs = 18 * scale;
    let tw = fontMedium.getAdvanceWidth(tagline, fs, opts);
    if (tw > width * 0.86) { fs *= (width * 0.86) / tw; tw = fontMedium.getAdvanceWidth(tagline, fs, opts); }
    const d = pathData(fontMedium.getPath(tagline, (width - tw) / 2, y + lh + 44 * scale, fs, opts));
    if (d.includes('NaN')) throw new Error('tagline outline contains NaN');
    tag = `<path d="${d}" fill="${taglineColor}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${bg}"/><g transform="translate(${(width - lw) / 2},${y}) scale(${scale})">${inner}</g>${tag}</svg>`;
}

async function png(svgText, path, { width, height, density = 384 } = {}) {
  let img = sharp(Buffer.from(svgText), { density });
  if (width) img = img.resize(width, height ?? width, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
  const buf = await img.png().toBuffer();
  write(path, buf);
  return buf;
}

/** ICO container holding PNG images (supported by every modern browser and Windows). */
function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, buf } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(buf.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += buf.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.buf)]);
}

console.log('brand assets →');

// --- SVG originals
const primary = svg(tile(BLUE) + markShapes({ bg: BLUE }), { title: 'Evidentia — marchio "Fogli"' });
const small = svg(tile(BLUE) + markSmallShapes({ bg: BLUE }), { title: 'Evidentia — marchio semplificato per 16–32 px' });
const mono = svg(markKnockout('currentColor'), { title: 'Evidentia — marchio monocromo (currentColor)' });
const blue = svg(markKnockout(BLUE), { title: 'Evidentia — marchio blu su fondo trasparente' });
const white = svg(markKnockout(WHITE), { title: 'Evidentia — marchio bianco per fondi scuri' });
write('brand/svg/logo.svg', primary);
write('brand/svg/logo-small.svg', small);
write('brand/svg/logo-mono.svg', mono);
write('brand/svg/logo-blue.svg', blue);
write('brand/svg/logo-white.svg', white);
const lkH = lockupHorizontal();
const lkHWhite = lockupHorizontal({ text: WHITE });
const lkHMono = lockupHorizontal({ text: BLUE, withTile: false });
const lkV = lockupVertical();
const lkVWhite = lockupVertical({ text: WHITE });
const wmInk = wordmarkOnly(INK);
const wmWhite = wordmarkOnly(WHITE);
write('brand/svg/lockup-horizontal.svg', lkH.svg);
write('brand/svg/lockup-horizontal-white.svg', lkHWhite.svg);
write('brand/svg/lockup-horizontal-mono.svg', lkHMono.svg);
write('brand/svg/lockup-vertical.svg', lkV.svg);
write('brand/svg/lockup-vertical-white.svg', lkVWhite.svg);
write('brand/svg/wordmark.svg', wmInk.svg);
write('brand/svg/wordmark-white.svg', wmWhite.svg);

// --- PNG marks
const pngs = {};
for (const size of [16, 32, 48, 64, 96, 128, 256, 512, 1024]) {
  pngs[size] = await png(size <= 32 ? small : primary, `brand/png/logo-${size}.png`, { width: size });
}
await png(blue, 'brand/png/logo-blue-512.png', { width: 512 });
await png(white, 'brand/png/logo-white-512.png', { width: 512 });
await png(lkH.svg, 'brand/png/lockup-horizontal-800.png', { width: 800, height: Math.round((800 * 64) / lkH.width) });
await png(lkH.svg, 'brand/png/lockup-horizontal-1600.png', { width: 1600, height: Math.round((1600 * 64) / lkH.width) });
await png(lkHWhite.svg, 'brand/png/lockup-horizontal-white-1600.png', { width: 1600, height: Math.round((1600 * 64) / lkHWhite.width) });
await png(lkV.svg, 'brand/png/lockup-vertical-1024.png', { width: 1024, height: Math.round((1024 * lkV.height) / lkV.width) });
await png(wmInk.svg, 'brand/png/wordmark-1600.png', { width: 1600, height: Math.round((1600 * 52) / wmInk.width) });

// --- favicon.ico (16 + 32 + 48)
write('brand/favicon.ico', ico([16, 32, 48].map((size) => ({ size, buf: pngs[size] }))));

// --- Chrome Web Store
await png(primary, 'brand/store/icon-128.png', { width: 128 });
await png(promo(440, 280, { bg: BLUE, text: WHITE, markBg: BLUE, tagline: 'La storia di un documento, versione per versione', taglineColor: '#bfdbfe' }), 'brand/store/small-promo-440x280.png', { width: 440, height: 280 });
await png(promo(1400, 560, { bg: PAPER, text: INK, markBg: BLUE, tagline: 'Evidenza del processo di scrittura dalla cronologia versioni di SharePoint', taglineColor: '#5b6b82' }), 'brand/store/marquee-1400x560.png', { width: 1400, height: 560 });

// --- social
await png(promo(1200, 630, { bg: INK, text: WHITE, markBg: BLUE, tagline: 'Estensione Chrome per docenti · nessun punteggio, solo versioni', taglineColor: LIGHT_BLUE }), 'brand/social/og-1200x630.png', { width: 1200, height: 630 });
await png(primary, 'brand/social/avatar-512.png', { width: 512 });

// --- extension icons
for (const size of [16, 32, 48, 128]) write(`public/icon/${size}.png`, pngs[size]);

console.log('done');
