/**
 * OAuth 2.0 for the Google Drive API, without any Evidentia server.
 *
 * chrome.identity.launchWebAuthFlow opens Google's consent screen and hands
 * back the redirect to https://<extension-id>.chromiumapp.org/ with the
 * access token in the fragment (implicit grant: no client secret, nothing
 * to store long-term). Works in Chrome and Edge and does not require the
 * browser profile to be signed into Google.
 *
 * The token lives in chrome.storage.session (memory only, cleared when the
 * browser closes) for its ~1 hour lifetime; a silent renewal
 * (prompt=none) is attempted before asking the teacher again.
 *
 * Scope: drive.readonly. Revisions of a Google Doc are only reachable through
 * the Drive API, and the narrower drive.file scope covers only files opened
 * through a Google Picker, which extension pages cannot load (remote code).
 * The extension still calls the API only for the one document being analysed.
 */
import { VersionSourceError } from '@/import/version-source';
import type { Settings } from '@/models';

export const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';
const STORAGE_KEY = 'googleAuth';
/** Renew a token this close to its expiry, so a long import does not hit a 401 halfway. */
const EXPIRY_MARGIN_MS = 5 * 60_000;

export interface TokenProvider {
  /** A valid access token; `interactive` allows the consent screen to be shown. */
  get(interactive?: boolean): Promise<string>;
  /** Forget the cached token (after a 401). */
  invalidate(): Promise<void>;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
  clientId: string;
  scope: string;
}

export class GoogleAuthError extends VersionSourceError {
  constructor(message: string) {
    super(message, null);
  }
}

/** Client id from the settings, else the one compiled into the build (WXT_GOOGLE_CLIENT_ID). */
export function resolveGoogleClientId(settings: Pick<Settings, 'googleClientId'>): string {
  const fromSettings = settings.googleClientId.trim();
  if (fromSettings) return fromSettings;
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return (env?.WXT_GOOGLE_CLIENT_ID ?? '').trim();
}

export function createGoogleTokenProvider(clientId: string): TokenProvider {
  let memory: CachedToken | null = null;

  const read = async (): Promise<CachedToken | null> => {
    if (memory) return memory;
    memory = (await sessionGet<CachedToken>(STORAGE_KEY)) ?? null;
    return memory;
  };
  const write = async (token: CachedToken | null): Promise<void> => {
    memory = token;
    await sessionSet(STORAGE_KEY, token);
  };
  const usable = (t: CachedToken | null): t is CachedToken => t !== null && t.clientId === clientId && t.scope === GOOGLE_SCOPE && t.expiresAt - EXPIRY_MARGIN_MS > Date.now();

  return {
    async get(interactive = true): Promise<string> {
      if (!clientId) throw new GoogleAuthError('Google Docs: nessun client ID OAuth configurato. Inseriscilo nelle impostazioni di Evidentia (vedi GOOGLE_DOCS_NOTES.md).');
      const cached = await read();
      if (usable(cached)) return cached.accessToken;
      // Silent renewal first: no window if Google still has a session for the account.
      let token = await authorize(clientId, false).catch(() => null);
      if (!token) {
        if (!interactive) throw new GoogleAuthError('Autorizzazione Google richiesta.');
        token = await authorize(clientId, true);
      }
      await write(token);
      return token.accessToken;
    },
    async invalidate(): Promise<void> {
      await write(null);
    },
  };
}

/** Forget the token and ask Google to revoke it (best effort). */
export async function signOutGoogle(): Promise<void> {
  const cached = await sessionGet<CachedToken>(STORAGE_KEY);
  await sessionSet(STORAGE_KEY, null);
  if (!cached) return;
  try {
    await fetch(`${REVOKE_ENDPOINT}?token=${encodeURIComponent(cached.accessToken)}`, { method: 'POST', credentials: 'omit' });
  } catch {
    // Revocation is a courtesy: the token expires within the hour anyway.
  }
}

async function authorize(clientId: string, interactive: boolean): Promise<CachedToken> {
  const state = Math.random().toString(36).slice(2);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: chrome.identity.getRedirectURL(),
    response_type: 'token',
    scope: GOOGLE_SCOPE,
    state,
    include_granted_scopes: 'true',
    prompt: interactive ? 'select_account' : 'none',
  });
  const redirect = await launch(`${AUTH_ENDPOINT}?${params.toString()}`, interactive);
  const fragment = new URLSearchParams(new URL(redirect).hash.replace(/^#/, ''));
  const error = fragment.get('error');
  if (error) throw new GoogleAuthError(describeOAuthError(error));
  const accessToken = fragment.get('access_token');
  if (!accessToken || fragment.get('state') !== state) throw new GoogleAuthError('Risposta OAuth non valida da Google.');
  const expiresIn = Number(fragment.get('expires_in') ?? 3600);
  return { accessToken, expiresAt: Date.now() + (Number.isFinite(expiresIn) ? expiresIn : 3600) * 1000, clientId, scope: GOOGLE_SCOPE };
}

function launch(url: string, interactive: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url, interactive }, (redirect) => {
      const err = chrome.runtime.lastError;
      if (err || !redirect) reject(new GoogleAuthError(err?.message ? `Autorizzazione Google non completata: ${err.message}` : 'Autorizzazione Google non completata.'));
      else resolve(redirect);
    });
  });
}

function describeOAuthError(code: string): string {
  switch (code) {
    case 'access_denied':
      return 'Autorizzazione Google negata: senza il consenso Evidentia non può leggere le revisioni del documento.';
    case 'login_required':
    case 'interaction_required':
    case 'consent_required':
      return 'Autorizzazione Google richiesta.';
    case 'invalid_client':
    case 'unauthorized_client':
      return `Client ID OAuth non valido o non autorizzato per questa estensione (${code}). Verifica l'URI di reindirizzamento ${chrome.identity.getRedirectURL()} nel progetto Google Cloud.`;
    default:
      return `Errore OAuth Google: ${code}.`;
  }
}

/** Memory-only storage: never chrome.storage.local, so the token never touches the disk. */
function sessionArea(): chrome.storage.StorageArea | null {
  try {
    return chrome.storage.session ?? null;
  } catch {
    return null;
  }
}

function sessionGet<T>(key: string): Promise<T | undefined> {
  const area = sessionArea();
  if (!area) return Promise.resolve(undefined);
  return new Promise((resolve) => area.get(key, (items) => resolve(items[key] as T | undefined)));
}

function sessionSet(key: string, value: unknown): Promise<void> {
  const area = sessionArea();
  if (!area) return Promise.resolve();
  return new Promise((resolve) => {
    if (value === null || value === undefined) area.remove(key, () => resolve());
    else area.set({ [key]: value }, () => resolve());
  });
}
