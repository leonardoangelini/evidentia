/**
 * Evidentia mark "Fogli": three versions of a document, one on top of the
 * other, the most recent in front with its lines of text. Single source of
 * geometry for every SVG and PNG in brand/ (see scripts/build-brand.mjs).
 *
 * Grid: 64 × 64. Colours: blue #1D4ED8, light blue #93C5FD, ink #0F172A.
 */

export const BLUE = '#1d4ed8';
export const BLUE_DARK_UI = '#3b6fe6';
export const LIGHT_BLUE = '#93c5fd';
export const INK = '#0f172a';
export const PAPER = '#f7f9fc';
export const WHITE = '#ffffff';

/** Rounded rectangle as path data (clockwise). */
export function rr(x, y, w, h, r) {
  return `M${x + r},${y} H${x + w - r} A${r},${r} 0 0 1 ${x + w},${y + r} V${y + h - r} A${r},${r} 0 0 1 ${x + w - r},${y + h} H${x + r} A${r},${r} 0 0 1 ${x},${y + h - r} V${y + r} A${r},${r} 0 0 1 ${x + r},${y} Z`;
}

const SHEET = { w: 25, h: 31, r: 4 };
const SHEETS = [
  { x: 27, y: 10, opacity: 0.3 },
  { x: 20.5, y: 16.5, opacity: 0.6 },
  { x: 14, y: 23, opacity: 1 },
];
/** Lines on the front sheet: [x, y, w, h, r]. The last one is the "cursor" line. */
const LINES = [
  [19, 31, 15, 3.5, 1.75],
  [19, 38, 15, 3.5, 1.75],
  [19, 45, 9, 3.5, 1.75],
];

/**
 * The mark drawn on a background of colour `bg` (needed for the lines of the
 * front sheet). `fg` is the sheet colour, `accent` the cursor line.
 */
export function markShapes({ fg = WHITE, bg = BLUE, accent = LIGHT_BLUE } = {}) {
  const sheets = SHEETS.map((s) => `<path d="${rr(s.x, s.y, SHEET.w, SHEET.h, SHEET.r)}" fill="${fg}"${s.opacity < 1 ? ` opacity="${s.opacity}"` : ''}/>`).join('');
  const lines = LINES.map(([x, y, w, h, r], i) => `<path d="${rr(x, y, w, h, r)}" fill="${i === LINES.length - 1 ? accent : bg}"/>`).join('');
  return sheets + lines;
}

/**
 * Single-colour mark for any background: the lines are holes in the front
 * sheet (even-odd), so nothing depends on the background colour.
 */
export function markKnockout(color = 'currentColor') {
  const back = SHEETS.slice(0, 2).map((s) => `<path d="${rr(s.x, s.y, SHEET.w, SHEET.h, SHEET.r)}" fill="${color}" opacity="${s.opacity}"/>`).join('');
  const front = SHEETS[2];
  const d = rr(front.x, front.y, SHEET.w, SHEET.h, SHEET.r) + ' ' + LINES.map(([x, y, w, h, r]) => rr(x, y, w, h, r)).join(' ');
  return `${back}<path d="${d}" fill="${color}" fill-rule="evenodd"/>`;
}

/** Simplified mark for 16–32 px: two sheets, larger offset, two thicker lines. */
export function markSmallShapes({ fg = WHITE, bg = BLUE, accent = LIGHT_BLUE } = {}) {
  return (
    `<path d="${rr(24, 9, 29, 37, 5)}" fill="${fg}" opacity="0.5"/>` +
    `<path d="${rr(11, 18, 29, 37, 5)}" fill="${fg}"/>` +
    `<path d="${rr(17, 29, 17, 5, 2.5)}" fill="${bg}"/>` +
    `<path d="${rr(17, 39, 11, 5, 2.5)}" fill="${accent}"/>`
  );
}

export function tile(fill = BLUE) {
  return `<rect width="64" height="64" rx="15" fill="${fill}"/>`;
}

export function svg(inner, { size = 64, title = 'Evidentia', extra = '' } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" role="img" aria-label="Evidentia"${extra}>\n  <title>${title}</title>\n  ${inner}\n</svg>\n`;
}
