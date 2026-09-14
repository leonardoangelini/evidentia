/**
 * Google hosts are optional host permissions: a teacher who only uses
 * SharePoint never grants them, and adding them in an update does not
 * disable the extension for existing users. They are requested from a
 * click in the Process View the first time a Google document is analysed.
 *
 * - www.googleapis.com: Drive API (file metadata, revision list, exports).
 * - docs.google.com: the revision export links returned by the Drive API
 *   point there. Requests carry the OAuth token only, never cookies.
 */
export const GOOGLE_ORIGINS = ['https://www.googleapis.com/*', 'https://docs.google.com/*'];

export function hasGooglePermission(): Promise<boolean> {
  return new Promise((resolve) => chrome.permissions.contains({ origins: GOOGLE_ORIGINS }, (granted) => resolve(Boolean(granted))));
}

/** Must be called from a user gesture (a click). */
export function requestGooglePermission(): Promise<boolean> {
  return new Promise((resolve) => chrome.permissions.request({ origins: GOOGLE_ORIGINS }, (granted) => resolve(Boolean(granted))));
}

export function removeGooglePermission(): Promise<boolean> {
  return new Promise((resolve) => chrome.permissions.remove({ origins: GOOGLE_ORIGINS }, (removed) => resolve(Boolean(removed))));
}
