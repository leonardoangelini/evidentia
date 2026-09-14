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
  const stored = await storageGet<Partial<Settings>>(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}), student: { ...DEFAULT_SETTINGS.student, ...(stored?.student ?? {}) } };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await storageSet(SETTINGS_KEY, settings);
}
