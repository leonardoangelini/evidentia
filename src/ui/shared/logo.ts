/**
 * Evidentia mark "Fogli" for the UI, single colour (currentColor). Same
 * geometry as brand/src/marks.mjs (markKnockout): three sheets, the front one
 * with its text lines cut out, so it works on any background.
 */
const D_BACK = 'M31,10 H48 A4,4 0 0 1 52,14 V37 A4,4 0 0 1 48,41 H31 A4,4 0 0 1 27,37 V14 A4,4 0 0 1 31,10 Z';
const D_MID = 'M24.5,16.5 H41.5 A4,4 0 0 1 45.5,20.5 V43.5 A4,4 0 0 1 41.5,47.5 H24.5 A4,4 0 0 1 20.5,43.5 V20.5 A4,4 0 0 1 24.5,16.5 Z';
const D_FRONT =
  'M18,23 H35 A4,4 0 0 1 39,27 V50 A4,4 0 0 1 35,54 H18 A4,4 0 0 1 14,50 V27 A4,4 0 0 1 18,23 Z ' +
  'M20.75,31 H32.25 A1.75,1.75 0 0 1 34,32.75 V32.75 A1.75,1.75 0 0 1 32.25,34.5 H20.75 A1.75,1.75 0 0 1 19,32.75 V32.75 A1.75,1.75 0 0 1 20.75,31 Z ' +
  'M20.75,38 H32.25 A1.75,1.75 0 0 1 34,39.75 V39.75 A1.75,1.75 0 0 1 32.25,41.5 H20.75 A1.75,1.75 0 0 1 19,39.75 V39.75 A1.75,1.75 0 0 1 20.75,38 Z ' +
  'M20.75,45 H26.25 A1.75,1.75 0 0 1 28,46.75 V46.75 A1.75,1.75 0 0 1 26.25,48.5 H20.75 A1.75,1.75 0 0 1 19,46.75 V46.75 A1.75,1.75 0 0 1 20.75,45 Z';

export const LOGO_MONO_SVG = `<svg viewBox="0 0 64 64" width="20" height="20" aria-hidden="true" focusable="false"><path d="${D_BACK}" fill="currentColor" opacity=".3"/><path d="${D_MID}" fill="currentColor" opacity=".6"/><path d="${D_FRONT}" fill="currentColor" fill-rule="evenodd"/></svg>`;

/** DOM element with the mark (for popup and Process View). */
export function logoMark(size = 20): SVGElement {
  const t = document.createElement('template');
  t.innerHTML = LOGO_MONO_SVG.replace('width="20" height="20"', `width="${size}" height="${size}"`);
  return t.content.firstElementChild as SVGElement;
}
