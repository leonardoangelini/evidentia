/** Turn an extracted version into a snapshot candidate, then seal it. */
import type { ExtractedDocument, PrivacyMode, Snapshot, SnapshotCandidate } from '@/models';
import { hashObject, sha256 } from '@/utils/hash';
import { newId } from '@/utils/id';

export interface VersionMeta {
  versionId: string;
  versionLabel: string;
  timestamp: string;
  authorLabel: string | null;
  isCurrent: boolean;
  sizeBytes: number | null;
}

export async function buildSnapshotCandidate(
  meta: VersionMeta,
  extracted: ExtractedDocument | null,
  privacyMode: PrivacyMode,
  sourceBytes: Uint8Array | null,
  failureNotes: string[] = [],
): Promise<SnapshotCandidate> {
  const unavailable = extracted === null;
  const text = unavailable ? '' : extracted.text;
  const paragraphs = unavailable ? [] : extracted.paragraphs;
  return {
    ...meta,
    wordCount: unavailable ? 0 : extracted.wordCount,
    characterCount: unavailable ? 0 : extracted.characterCount,
    paragraphCount: paragraphs.length,
    text: !unavailable && privacyMode === 'FULL' ? text : null,
    textHash: unavailable ? '' : await sha256(text),
    paragraphHashes: await Promise.all(paragraphs.map((p) => sha256(p))),
    headings: unavailable ? [] : privacyMode === 'FULL' ? extracted.headings : extracted.headings.map((h) => ({ level: h.level, text: '' })),
    extractionStatus: unavailable ? 'UNAVAILABLE' : 'FULL',
    extractionNotes: [...failureNotes, ...(extracted?.notes ?? [])],
    sourceHash: sourceBytes ? await sha256Bytes(sourceBytes) : null,
  };
}

/** The hash covers content and identity, not the chronological index (recomputed on every import). */
export async function sealSnapshot(candidate: SnapshotCandidate, documentId: string, index: number): Promise<Snapshot> {
  const id = newId('ver');
  const hash = await hashObject({ ...candidate, documentId, id });
  return { ...candidate, id, documentId, index, hash };
}

async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
