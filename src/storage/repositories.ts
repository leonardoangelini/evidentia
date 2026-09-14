import type { AnalyzedDocument, AnyTrackingEvent, DocumentDataset, Snapshot, SnapshotDiff } from '@/models';
import { getDatabase } from './database';

export const documentRepository = {
  async get(id: string): Promise<AnalyzedDocument | undefined> {
    return (await getDatabase()).get('documents', id);
  },
  async put(doc: AnalyzedDocument): Promise<void> {
    await (await getDatabase()).put('documents', doc);
  },
  async list(): Promise<AnalyzedDocument[]> {
    const all = await (await getDatabase()).getAll('documents');
    return all.sort((a, b) => (a.lastAnalyzedAt < b.lastAnalyzedAt ? 1 : -1));
  },
  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    const tx = db.transaction(['documents', 'events', 'snapshots', 'diffs'], 'readwrite');
    await tx.objectStore('documents').delete(id);
    for (const store of ['events', 'snapshots', 'diffs'] as const) {
      const keys = await tx.objectStore(store).index('documentId').getAllKeys(id);
      for (const key of keys) await tx.objectStore(store).delete(key);
    }
    await tx.done;
  },
  async deleteAll(): Promise<void> {
    const db = await getDatabase();
    const tx = db.transaction(['documents', 'events', 'snapshots', 'diffs'], 'readwrite');
    await Promise.all([tx.objectStore('documents').clear(), tx.objectStore('events').clear(), tx.objectStore('snapshots').clear(), tx.objectStore('diffs').clear()]);
    await tx.done;
  },
};

export const eventRepository = {
  async append(events: AnyTrackingEvent[]): Promise<void> {
    if (events.length === 0) return;
    const db = await getDatabase();
    const tx = db.transaction('events', 'readwrite');
    for (const e of events) await tx.store.put(e);
    await tx.done;
  },
  async listByDocument(documentId: string): Promise<AnyTrackingEvent[]> {
    return (await getDatabase()).getAllFromIndex('events', 'documentSeq', IDBKeyRange.bound([documentId, 0], [documentId, Infinity]));
  },
  async last(documentId: string): Promise<AnyTrackingEvent | undefined> {
    const db = await getDatabase();
    const cursor = await db.transaction('events').store.index('documentSeq').openCursor(IDBKeyRange.bound([documentId, 0], [documentId, Infinity]), 'prev');
    return cursor?.value;
  },
};

export const snapshotRepository = {
  async listByDocument(documentId: string): Promise<Snapshot[]> {
    return (await getDatabase()).getAllFromIndex('snapshots', 'documentIndex', IDBKeyRange.bound([documentId, 0], [documentId, Infinity]));
  },
  async count(documentId: string): Promise<number> {
    return (await getDatabase()).countFromIndex('snapshots', 'documentId', documentId);
  },
  /**
   * Replace the whole version set of a document atomically (indices are
   * recomputed on every import, and so are the consecutive diffs).
   */
  async replaceAll(documentId: string, snapshots: Snapshot[], diffs: SnapshotDiff[]): Promise<void> {
    const db = await getDatabase();
    const tx = db.transaction(['snapshots', 'diffs'], 'readwrite');
    for (const store of ['snapshots', 'diffs'] as const) {
      const keys = await tx.objectStore(store).index('documentId').getAllKeys(documentId);
      for (const key of keys) await tx.objectStore(store).delete(key);
    }
    for (const s of snapshots) await tx.objectStore('snapshots').put(s);
    for (const d of diffs) await tx.objectStore('diffs').put(d);
    await tx.done;
  },
};

export const diffRepository = {
  async listByDocument(documentId: string): Promise<SnapshotDiff[]> {
    return (await getDatabase()).getAllFromIndex('diffs', 'documentTo', IDBKeyRange.bound([documentId, 0], [documentId, Infinity]));
  },
};

export async function loadDataset(documentId: string): Promise<DocumentDataset | null> {
  const document = await documentRepository.get(documentId);
  if (!document) return null;
  const [events, snapshots, diffs] = await Promise.all([eventRepository.listByDocument(documentId), snapshotRepository.listByDocument(documentId), diffRepository.listByDocument(documentId)]);
  return { document, events, snapshots, diffs };
}

/** Store a complete dataset (demo data and tests). */
export async function importDataset(dataset: DocumentDataset): Promise<void> {
  await documentRepository.delete(dataset.document.id);
  await documentRepository.put(dataset.document);
  await eventRepository.append(dataset.events);
  await snapshotRepository.replaceAll(dataset.document.id, dataset.snapshots, dataset.diffs);
}
