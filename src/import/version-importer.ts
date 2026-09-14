/**
 * Import the version history of a document (SharePoint/OneDrive or Google
 * Drive) into the local database: list versions, download each one as
 * DOCX, extract its text, seal snapshots, recompute consecutive diffs, and
 * log every step in the hash-chained event log.
 *
 * Runs in an extension page (needs DOMParser and the network access of the
 * chosen source).
 * Re-running on the same document only downloads versions not stored yet
 * and refreshes the current file.
 */
import { computeAllDiffs } from '@/analysis/diff-engine';
import { extractDocxText } from '@/docx/docx-text';
import type { AnalyzedDocument, AnyRawEvent, AnyTrackingEvent, Author, PrivacyMode, Settings, Snapshot } from '@/models';
import { documentRepository, eventRepository, snapshotRepository } from '@/storage/repositories';
import { sealEvent, type ChainState } from '@/integrity/event-log';
import { sha256 } from '@/utils/hash';
import { newId } from '@/utils/id';
import { nowIso, parseIso, toIsoLocal } from '@/utils/time';
import { createVersionSource, type DocumentLocator } from './document-locator';
import { buildSnapshotCandidate, sealSnapshot, type VersionMeta } from './snapshot-builder';
import type { SourceVersionInfo, VersionSource } from './version-source';

export interface ImportProgress {
  phase: 'INFO' | 'LIST' | 'DOWNLOAD' | 'STORE' | 'DONE' | 'ERROR';
  current: number;
  total: number;
  message: string;
}

export interface ImportResult {
  documentId: string;
  fetched: number;
  failed: number;
  skipped: number;
  totalVersions: number;
}

export interface ImportOptions {
  locator: DocumentLocator;
  settings: Settings;
  extensionVersion: string;
  trigger?: 'MANUAL' | 'REFRESH';
  onProgress?: (p: ImportProgress) => void;
  /** Injectable for tests; built from the locator otherwise. */
  client?: VersionSource;
}

export async function importVersionHistory(options: ImportOptions): Promise<ImportResult> {
  const { locator, settings, extensionVersion } = options;
  const progress = options.onProgress ?? (() => undefined);
  const client = options.client ?? createVersionSource(locator, settings);
  const provider = client.provider;
  const startedAt = Date.now();

  progress({ phase: 'INFO', current: 0, total: 0, message: 'Lettura metadati del documento…' });
  const info = await client.getFileInfo();
  const documentId = info.id;
  const existing = await documentRepository.get(documentId);
  const privacyMode: PrivacyMode = existing?.privacyMode ?? settings.privacyMode;
  const now = nowIso();
  const doc: AnalyzedDocument = existing
    ? { ...existing, provider, name: info.name || existing.name, serverRelativeUrl: info.path, webUrl: info.webUrl || existing.webUrl, timeCreated: toLocal(info.timeCreated), timeLastModified: toLocal(info.timeLastModified), currentVersionLabel: info.versionLabel, lastAnalyzedAt: now, extensionVersion, student: settings.student }
    : {
        id: documentId,
        name: info.name || locator.fileName || '',
        provider,
        siteUrl: locator.provider === 'SHAREPOINT' ? locator.siteUrl : 'https://drive.google.com',
        serverRelativeUrl: info.path,
        webUrl: info.webUrl,
        host: locator.host,
        timeCreated: toLocal(info.timeCreated),
        timeLastModified: toLocal(info.timeLastModified),
        currentVersionLabel: info.versionLabel,
        firstAnalyzedAt: now,
        lastAnalyzedAt: now,
        extensionVersion,
        privacyMode,
        authors: [],
        student: settings.student,
      };
  await documentRepository.put(doc);

  const runId = newId('run');
  const lastEvent = await eventRepository.last(documentId);
  const chain: ChainState = { lastSeq: lastEvent?.seq ?? 0, lastHash: lastEvent?.hash ?? null };
  const events: AnyTrackingEvent[] = [];
  const log = async (raw: AnyRawEvent): Promise<void> => {
    events.push(await sealEvent(raw, documentId, runId, chain));
  };
  await log({ type: 'ANALYSIS_START', timestamp: now, payload: { privacyMode, trigger: options.trigger ?? 'MANUAL', extensionVersion } });

  progress({ phase: 'LIST', current: 0, total: 0, message: 'Elenco delle versioni…' });
  let versions = await client.listVersions();
  let truncatedNote: string | null = null;
  if (versions.length > settings.maxVersions) {
    truncatedNote = `Solo le ${settings.maxVersions} versioni più recenti su ${versions.length} sono state scaricate.`;
    versions = versions.slice(-settings.maxVersions);
  }
  const stored = await snapshotRepository.listByDocument(documentId);
  const storedByVersion = new Map(stored.filter((s) => !s.isCurrent).map((s) => [s.versionId, s]));
  await log({ type: 'VERSIONS_LISTED', timestamp: nowIso(), payload: { versionsOnServer: versions.length, includingCurrent: versions.length + 1, alreadyStored: storedByVersion.size } });

  const authors = new AuthorRegistry(doc.authors, privacyMode);
  const candidates: Array<Awaited<ReturnType<typeof buildSnapshotCandidate>>> = [];
  let fetched = 0;
  let failed = 0;
  let skipped = 0;
  const total = versions.length + 1;

  for (let i = 0; i < versions.length; i++) {
    const v = versions[i] as SourceVersionInfo;
    const meta: VersionMeta = { versionId: v.id, versionLabel: v.label, timestamp: toLocal(v.created), authorLabel: await authors.labelFor(v), isCurrent: false, sizeBytes: v.size };
    const already = storedByVersion.get(v.id);
    if (already && already.extractionStatus === 'FULL') {
      skipped += 1;
      candidates.push(stripSnapshot(already));
      continue;
    }
    progress({ phase: 'DOWNLOAD', current: i + 1, total, message: `Versione ${v.label} (${new Date(parseIso(meta.timestamp)).toLocaleString('it-IT')})` });
    try {
      const bytes = await client.downloadVersion(v);
      const extracted = extractDocxText(bytes);
      const candidate = await buildSnapshotCandidate(meta, extracted, privacyMode, bytes);
      candidates.push(candidate);
      fetched += 1;
      await log({ type: 'VERSION_FETCHED', timestamp: nowIso(), payload: { versionId: v.id, versionLabel: v.label, created: meta.timestamp, bytes: bytes.length, textHash: candidate.textHash, wordCount: candidate.wordCount, extractionStatus: 'FULL' } });
    } catch (e) {
      failed += 1;
      const reason = e instanceof Error ? e.message : String(e);
      const status = (e as { status?: number | null }).status ?? null;
      candidates.push(await buildSnapshotCandidate(meta, null, privacyMode, null, [reason]));
      await log({ type: 'VERSION_FETCH_FAILED', timestamp: nowIso(), payload: { versionId: v.id, versionLabel: v.label, created: meta.timestamp, reason, httpStatus: status } });
    }
  }

  // Current file: always refreshed (the server turns the previous current into a version on save).
  progress({ phase: 'DOWNLOAD', current: total, total, message: `Versione corrente ${info.versionLabel}` });
  const currentMeta: VersionMeta = { versionId: 'current', versionLabel: info.versionLabel || 'corrente', timestamp: toLocal(info.timeLastModified), authorLabel: await authors.labelFor({ authorIdentity: info.modifiedByIdentity, authorName: info.modifiedByName }), isCurrent: true, sizeBytes: info.sizeBytes };
  try {
    const bytes = await client.downloadCurrent();
    const extracted = extractDocxText(bytes);
    const candidate = await buildSnapshotCandidate(currentMeta, extracted, privacyMode, bytes);
    candidates.push(candidate);
    fetched += 1;
    await log({ type: 'VERSION_FETCHED', timestamp: nowIso(), payload: { versionId: 'current', versionLabel: currentMeta.versionLabel, created: currentMeta.timestamp, bytes: bytes.length, textHash: candidate.textHash, wordCount: candidate.wordCount, extractionStatus: 'FULL' } });
  } catch (e) {
    failed += 1;
    const reason = e instanceof Error ? e.message : String(e);
    candidates.push(await buildSnapshotCandidate(currentMeta, null, privacyMode, null, [reason]));
    await log({ type: 'VERSION_FETCH_FAILED', timestamp: nowIso(), payload: { versionId: 'current', versionLabel: currentMeta.versionLabel, created: currentMeta.timestamp, reason, httpStatus: (e as { status?: number | null }).status ?? null } });
  }

  progress({ phase: 'STORE', current: total, total, message: 'Calcolo delle differenze…' });
  candidates.sort((a, b) => parseIso(a.timestamp) - parseIso(b.timestamp) || (a.isCurrent ? 1 : 0) - (b.isCurrent ? 1 : 0));
  const snapshots: Snapshot[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i] as (typeof candidates)[number];
    const kept = storedByVersion.get(c.versionId);
    snapshots.push(kept && kept.extractionStatus === 'FULL' ? { ...kept, index: i } : await sealSnapshot(c, documentId, i));
  }
  if (truncatedNote) {
    const first = snapshots[0];
    if (first) first.extractionNotes = [...first.extractionNotes, truncatedNote];
  }
  const diffs = computeAllDiffs(snapshots);
  await snapshotRepository.replaceAll(documentId, snapshots, diffs);
  await documentRepository.put({ ...doc, authors: authors.list(), lastAnalyzedAt: nowIso() });
  await log({ type: 'ANALYSIS_END', timestamp: nowIso(), payload: { fetched, failed, skipped, durationMs: Date.now() - startedAt } });
  await eventRepository.append(events);

  progress({ phase: 'DONE', current: total, total, message: `Analisi completata: ${snapshots.length} versioni (${failed} non leggibili).` });
  return { documentId, fetched, failed, skipped, totalVersions: snapshots.length };
}

/** Stable pseudonymous author labels ("Autore 1", "Autore 2"…) across analyses. */
class AuthorRegistry {
  private readonly byHash = new Map<string, Author>();
  constructor(
    existing: Author[],
    private readonly privacyMode: PrivacyMode,
  ) {
    for (const a of existing) this.byHash.set(a.identityHash, { ...a, versions: 0 });
  }
  async labelFor(v: { authorIdentity: string | null; authorName: string | null }): Promise<string | null> {
    const identity = v.authorIdentity ?? v.authorName;
    if (!identity) return null;
    const identityHash = await sha256(identity.toLowerCase());
    let author = this.byHash.get(identityHash);
    if (!author) {
      author = { label: `Autore ${this.byHash.size + 1}`, identityHash, versions: 0 };
      if (this.privacyMode === 'FULL' && v.authorName) author.displayName = v.authorName;
      this.byHash.set(identityHash, author);
    }
    author.versions += 1;
    return author.label;
  }
  list(): Author[] {
    return Array.from(this.byHash.values());
  }
}

function stripSnapshot(s: Snapshot): Awaited<ReturnType<typeof buildSnapshotCandidate>> {
  const { id: _id, documentId: _d, index: _i, hash: _h, ...candidate } = s;
  return candidate;
}

/** Servers return UTC ("2026-09-12T07:42:30Z"); store in local ISO with offset. */
function toLocal(iso: string): string {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? iso : toIsoLocal(new Date(ms));
}
