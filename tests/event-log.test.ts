import { sealEvent, verifyChain, type ChainState } from '@/integrity/event-log';
import type { AnyTrackingEvent } from '@/models';

async function chainOf(n: number): Promise<AnyTrackingEvent[]> {
  const chain: ChainState = { lastSeq: 0, lastHash: null };
  const out: AnyTrackingEvent[] = [];
  for (let i = 0; i < n; i++) {
    out.push(await sealEvent({ type: 'VERSION_FETCHED', timestamp: `2026-09-12T09:00:0${i}+02:00`, payload: { versionId: String(512 + i), versionLabel: `${i + 1}.0`, created: `2026-09-12T08:00:0${i}+02:00`, bytes: 100 + i, textHash: 'h', wordCount: 10 * i, extractionStatus: 'FULL' } }, 'doc', 'run', chain));
  }
  return out;
}

describe('hash chain', () => {
  it('links events and verifies', async () => {
    const events = await chainOf(4);
    expect(events[0]?.previousHash).toBeNull();
    expect(events[1]?.previousHash).toBe(events[0]?.hash);
    expect(events.map((e) => e.seq)).toEqual([1, 2, 3, 4]);
    expect((await verifyChain(events)).valid).toBe(true);
  });
  it('detects a modified payload', async () => {
    const events = await chainOf(3);
    const target = events[1] as AnyTrackingEvent & { type: 'VERSION_FETCHED' };
    target.payload = { ...target.payload, wordCount: 999 };
    const v = await verifyChain(events);
    expect(v.valid).toBe(false);
    expect(v.firstBrokenSeq).toBe(2);
    expect(v.reason).toBe('hash mismatch');
  });
  it('detects a removed event', async () => {
    const events = await chainOf(3);
    events.splice(1, 1);
    const v = await verifyChain(events);
    expect(v.valid).toBe(false);
    expect(v.reason).toBe('previousHash mismatch');
  });
});
