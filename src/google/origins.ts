/**
 * Gli host Google, in un solo posto.
 *
 * La stessa lista serve a due consumatori che devono per forza coincidere:
 * `optional_host_permissions` nel manifest (wxt.config.ts) e la richiesta
 * a runtime via `chrome.permissions` (permissions.ts). Se divergessero,
 * `chrome.permissions.request()` chiederebbe un origin non dichiarato nel
 * manifest e fallirebbe senza errore visibile.
 *
 * - www.googleapis.com: Drive API (file metadata, revision list, exports).
 * - docs.google.com: the revision export links returned by the Drive API
 *   point there. Requests carry the OAuth token only, never cookies.
 *
 * Nessun riferimento a `chrome` qui dentro: il modulo è importato anche da
 * wxt.config.ts, che gira in Node al momento della build.
 */
export const GOOGLE_ORIGINS = ['https://www.googleapis.com/*', 'https://docs.google.com/*'];
