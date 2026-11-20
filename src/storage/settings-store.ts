/** Settings in chrome.storage.local (light-weight state only). */
import { DEFAULT_SETTINGS, type Settings } from '@/models';

const SETTINGS_KEY = 'settings';

function storageGet<T>(key: string): Promise<T | undefined> {
  return new Promise((resolve) => chrome.storage.local.get(key, (items) => resolve(items[key] as T | undefined)));
}

function storageSet(key: string, value: unknown): Promise<void> {
  return new Promise((resolve) => chrome.storage.local.set({ [key]: value }, () => resolve()));
}

export async function loadSettings(): Promise<Settings> {
  const raw = await storageGet<Partial<Settings> & { googleClientId?: unknown }>(SETTINGS_KEY);
  // googleClientId was a setting until 0.3.1: drop it so a stale value is never saved back.
  const { googleClientId: _legacy, ...stored } = raw ?? {};
  return { ...DEFAULT_SETTINGS, ...stored, student: { ...DEFAULT_SETTINGS.student, ...(stored.student ?? {}) } };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await storageSet(SETTINGS_KEY, settings);
}
