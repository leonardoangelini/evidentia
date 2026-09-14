/**
 * One entry point for every supported server: recognise the document from
 * a tab URL and build the matching version source.
 */
import { createGoogleTokenProvider, resolveGoogleClientId } from '@/google/google-auth';
import { GoogleDriveClient } from '@/google/google-drive-client';
import { parseGoogleDocsLocator, type GoogleDocsLocator } from '@/google/locator';
import type { DocumentProvider, Settings } from '@/models';
import { parseSharePointLocator, type SharePointLocator } from '@/sharepoint/locator';
import { SharePointClient } from '@/sharepoint/sharepoint-client';
import type { VersionSource } from './version-source';

export type DocumentLocator = SharePointLocator | GoogleDocsLocator;

export function parseDocumentLocator(url: string): DocumentLocator | null {
  return parseSharePointLocator(url) ?? parseGoogleDocsLocator(url);
}

export function createVersionSource(locator: DocumentLocator, settings: Settings): VersionSource {
  switch (locator.provider) {
    case 'SHAREPOINT':
      return new SharePointClient(locator);
    case 'GOOGLE_DOCS':
      return new GoogleDriveClient(locator, createGoogleTokenProvider(resolveGoogleClientId(settings)));
  }
}

/** Short description of what the teacher must be signed into, for error hints. */
export function providerHint(provider: DocumentProvider): string {
  return provider === 'GOOGLE_DOCS'
    ? 'Verifica di aver autorizzato Evidentia con l\'account Google che ha accesso al documento (il consenso si può revocare dalle impostazioni), poi riprova dal popup.'
    : 'Verifica di essere autenticato su Microsoft 365 nel browser e di avere accesso al documento, poi riprova dal popup.';
}
