import { documentRepository, eventRepository, importDataset, loadDataset, snapshotRepository } from '@/storage/repositories';
import { buildCaseA } from '@/demo/cases';

describe('repositories (IndexedDB)', () => {
  it('imports, reads back in order, replaces versions and deletes a dataset', async () => {
    const ds = await buildCaseA();
    await importDataset(ds);
    const loaded = await loadDataset(ds.document.id);
    expect(loaded?.events.map((e) => e.seq)).toEqual(ds.events.map((e) => e.seq));
    expect(loaded?.snapshots.map((s) => s.index)).toEqual(ds.snapshots.map((s) => s.index));
    expect(loaded?.diffs).toHaveLength(ds.diffs.length);
    expect((await eventRepository.last(ds.document.id))?.seq).toBe(ds.events.at(-1)?.seq);
    await snapshotRepository.replaceAll(ds.document.id, ds.snapshots.slice(0, 2), ds.diffs.slice(0, 1));
    expect(await snapshotRepository.count(ds.document.id)).toBe(2);
    await documentRepository.delete(ds.document.id);
    expect(await loadDataset(ds.document.id)).toBeNull();
    expect(await eventRepository.listByDocument(ds.document.id)).toHaveLength(0);
  });
});
