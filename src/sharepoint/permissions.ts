/**
 * SharePoint hosts are optional host permissions, granted one site at a
 * time: the install prompt shows no host warning, and the teacher grants
 * only the tenant of the document being analysed, from a click in the
 * Process View. Once granted, fetches from extension pages carry the
 * teacher's Microsoft 365 cookies, exactly as a required permission would.
 */
import { isSharePointOrigin, sharePointOriginFor } from './origins';

export function hasSharePointPermission(host: string): Promise<boolean> {
  return new Promise((resolve) => chrome.permissions.contains({ origins: [sharePointOriginFor(host)] }, (granted) => resolve(Boolean(granted))));
}

/** Must be called from a user gesture (a click). */
export function requestSharePointPermission(host: string): Promise<boolean> {
  return new Promise((resolve) => chrome.permissions.request({ origins: [sharePointOriginFor(host)] }, (granted) => resolve(Boolean(granted))));
}

/** Removes every SharePoint site granted so far; returns the hosts removed. */
export async function removeSharePointPermissions(): Promise<string[]> {
  const all = await new Promise<chrome.permissions.Permissions>((resolve) => chrome.permissions.getAll(resolve));
  const origins = (all.origins ?? []).filter(isSharePointOrigin);
  if (origins.length === 0) return [];
  const removed = await new Promise<boolean>((resolve) => chrome.permissions.remove({ origins }, (ok) => resolve(Boolean(ok))));
  return removed ? origins.map((o) => o.replace(/^https:\/\/|\/\*$/g, '')) : [];
}
