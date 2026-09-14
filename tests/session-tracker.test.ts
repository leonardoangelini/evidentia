import { deriveSessions } from '@/analysis/session-tracker';
import { buildCaseA, buildCaseD } from '@/demo/cases';

describe('sessions from version timestamps', () => {
  it('clusters versions closer than the gap into sessions', async () => {
    const ds = await buildCaseA();
    const sessions = deriveSessions(ds.snapshots, { gapMs: 30 * 60_000 });
    expect(sessions).toHaveLength(3);
    expect(sessions[0]?.versionCount).toBe(6);
    expect(sessions[0]?.spanMs).toBe(30 * 60_000);
    expect(sessions[0]?.wordCountStart).toBeLessThan(sessions[0]?.wordCountEnd as number);
    expect(sessions.every((s) => s.authorLabels.length >= 1 || s.versionCount === 1)).toBe(true);
    const totalVersions = sessions.reduce((n, s) => n + s.versionCount, 0);
    expect(totalVersions).toBe(ds.snapshots.length);
  });
  it('yields single-version sessions for sparse histories and lists the second author', async () => {
    const ds = await buildCaseD();
    const sessions = deriveSessions(ds.snapshots, { gapMs: 30 * 60_000 });
    expect(sessions).toHaveLength(3);
    expect(sessions[0]?.versionCount).toBe(1);
    expect(sessions[0]?.spanMs).toBe(0);
    expect(sessions[1]?.authorLabels).toEqual(['Autore 2']);
  });
});
