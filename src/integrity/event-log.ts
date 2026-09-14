/**
 * Sequencing and hash chain for the analysis event log.
 *
 * event.hash = sha256(canonical({ ...event without hash }))
 * event.previousHash = hash of the previous event of the same document.
 *
 * Detects accidental modification of an exported dataset. It is NOT a
 * forensic guarantee: whoever controls the browser controls the data.
 */
import type { AnyRawEvent, AnyTrackingEvent } from '@/models';
import { hashObject } from '@/utils/hash';
import { newId } from '@/utils/id';

export interface ChainState {
  lastSeq: number;
  lastHash: string | null;
}

export async function sealEvent(raw: AnyRawEvent, documentId: string, runId: string, chain: ChainState): Promise<AnyTrackingEvent> {
  const seq = chain.lastSeq + 1;
  const unsealed = { ...raw, id: newId('evt'), documentId, runId, seq, previousHash: chain.lastHash };
  const hash = await hashObject(unsealed);
  chain.lastSeq = seq;
  chain.lastHash = hash;
  return { ...unsealed, hash } as AnyTrackingEvent;
}

export interface ChainVerification {
  valid: boolean;
  checked: number;
  firstBrokenSeq: number | null;
  reason: string | null;
}

/** Recompute every hash and link; events must be sorted by seq. */
export async function verifyChain(events: AnyTrackingEvent[]): Promise<ChainVerification> {
  let previousHash: string | null = null;
  for (let i = 0; i < events.length; i++) {
    const event = events[i] as AnyTrackingEvent;
    const { hash, ...rest } = event;
    if (event.previousHash !== previousHash) return { valid: false, checked: i, firstBrokenSeq: event.seq, reason: 'previousHash mismatch' };
    if ((await hashObject(rest)) !== hash) return { valid: false, checked: i, firstBrokenSeq: event.seq, reason: 'hash mismatch' };
    previousHash = hash;
  }
  return { valid: true, checked: events.length, firstBrokenSeq: null, reason: null };
}
