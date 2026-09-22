/**
 * Gli host SharePoint, in un solo posto, come per Google (src/google/origins.ts).
 *
 * `optional_host_permissions` nel manifest dichiara il pattern largo; a
 * runtime si chiede solo l'origin del documento aperto (per esempio
 * `https://scuola-my.sharepoint.com/*`), che deve ricadere nel pattern
 * dichiarato, altrimenti `chrome.permissions.request()` fallisce.
 *
 * Solo SharePoint Online commerciale: `sharepoint-df.com` è l'ambiente
 * interno di Microsoft, `sharepoint.us` il cloud governativo statunitense.
 *
 * Nessun riferimento a `chrome` qui dentro: il modulo è importato anche da
 * wxt.config.ts, che gira in Node al momento della build.
 */
export const SHAREPOINT_ORIGINS = ['https://*.sharepoint.com/*'];

/** Match pattern for the one SharePoint host a document lives on. */
export function sharePointOriginFor(host: string): string {
  return `https://${host.toLowerCase()}/*`;
}

export function isSharePointOrigin(origin: string): boolean {
  return /^https:\/\/[^/]+\.sharepoint\.com\/\*$/i.test(origin);
}
