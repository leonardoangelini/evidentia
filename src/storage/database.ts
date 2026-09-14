/**
 * IndexedDB schema. Used by extension pages (import, process view, export).
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AnalyzedDocument, AnyTrackingEvent, Snapshot, SnapshotDiff } from '@/models';

export interface EvidentiaDB extends DBSchema {
  documents: { key: string; value: AnalyzedDocument; indexes: { lastAnalyzedAt: string } };
  events: { key: string; value: AnyTrackingEvent; indexes: { documentId: string; documentSeq: [string, number] } };
  snapshots: { key: string; value: Snapshot; indexes: { documentId: string; documentIndex: [string, number]; documentVersion: [string, string] } };
  diffs: { key: string; value: SnapshotDiff; indexes: { documentId: string; documentTo: [string, number] } };
}

export const DB_NAME = 'evidentia';
/** v2: version-history model (the v1 tracking prototype data is dropped). */
export const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<EvidentiaDB>> | null = null;

export function getDatabase(): Promise<IDBPDatabase<EvidentiaDB>> {
  if (!dbPromise) {
    dbPromise = openDB<EvidentiaDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        for (const name of Array.from(db.objectStoreNames)) db.deleteObjectStore(name);
        const documents = db.createObjectStore('documents', { keyPath: 'id' });
        documents.createIndex('lastAnalyzedAt', 'lastAnalyzedAt');
        const events = db.createObjectStore('events', { keyPath: 'id' });
        events.createIndex('documentId', 'documentId');
        events.createIndex('documentSeq', ['documentId', 'seq'], { unique: true });
        const snapshots = db.createObjectStore('snapshots', { keyPath: 'id' });
        snapshots.createIndex('documentId', 'documentId');
        snapshots.createIndex('documentIndex', ['documentId', 'index'], { unique: true });
        snapshots.createIndex('documentVersion', ['documentId', 'versionId'], { unique: true });
        const diffs = db.createObjectStore('diffs', { keyPath: 'id' });
        diffs.createIndex('documentId', 'documentId');
        diffs.createIndex('documentTo', ['documentId', 'toIndex'], { unique: true });
      },
    });
  }
  return dbPromise;
}

/** For tests: drop the cached connection. */
export function resetDatabaseConnection(): void {
  dbPromise = null;
}
