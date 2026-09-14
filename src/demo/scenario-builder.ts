/**
 * Builds realistic version-history datasets by replaying a scenario through
 * the same sealing/diff/event code used by the importer.
 */
import { computeAllDiffs } from '@/analysis/diff-engine';
import { buildSnapshotCandidate, sealSnapshot } from '@/import/snapshot-builder';
import { sealEvent, type ChainState } from '@/integrity/event-log';
import type { AnalyzedDocument, AnyTrackingEvent, Author, DocumentDataset, Heading, PrivacyMode, Snapshot } from '@/models';
import { countWords, normalizeText, splitParagraphs } from '@/utils/text';
import { nowIso, toIsoLocal } from '@/utils/time';

export interface ScenarioOptions {
  documentId: string;
  name: string;
  privacyMode?: PrivacyMode;
  /** Timestamp of the first version. */
  start: string;
  created?: string;
  student?: AnalyzedDocument['student'];
}

interface PendingVersion {
  label: string;
  timestamp: string;
  author: string | null;
  text: string | null;
  failure: string | null;
}

/** Scenario text marks headings Markdown-style ("# Titolo", "## Sottotitolo"); the marker is stripped from the stored text. */
export function parseHeadings(text: string): { paragraphs: string[]; headings: Heading[] } {
  const paragraphs: string[] = [];
  const headings: Heading[] = [];
  for (const raw of splitParagraphs(text)) {
    const m = /^(#{1,3})\s+(.+)$/.exec(raw);
    if (m) {
      const title = (m[2] as string).trim();
      paragraphs.push(title);
      headings.push({ level: (m[1] as string).length, text: title });
    } else paragraphs.push(raw);
  }
  return { paragraphs, headings };
}

export class VersionScenarioBuilder {
  private clock: number;
  private text = '';
  private readonly versions: PendingVersion[] = [];
  private major = 0;
  private minor = 0;
  private readonly authors = new Map<string, Author>();

  constructor(private readonly options: ScenarioOptions) {
    this.clock = Date.parse(options.start);
  }

  get now(): string {
    return toIsoLocal(new Date(this.clock));
  }
  get currentText(): string {
    return this.text;
  }
  advance(ms: number): this {
    this.clock += ms;
    return this;
  }
  setText(text: string): this {
    this.text = normalizeText(text);
    return this;
  }
  append(paragraphs: string[]): this {
    this.text = normalizeText(this.text ? `${this.text}\n${paragraphs.join('\n')}` : paragraphs.join('\n'));
    return this;
  }
  /** Append a section heading (level 1-3). */
  heading(title: string, level = 1): this {
    return this.append([`${'#'.repeat(level)} ${title}`]);
  }
  deleteParagraphs(index: number, count: number): this {
    const paras = splitParagraphs(this.text);
    paras.splice(index, count);
    this.text = paras.join('\n');
    return this;
  }
  rewriteParagraph(index: number, newText: string): this {
    const paras = splitParagraphs(this.text);
    if (index < paras.length) paras[index] = newText;
    this.text = paras.join('\n');
    return this;
  }

  /** Save a version of the current text (SharePoint minor/major numbering). */
  save(author = 'studente', major = false): this {
    if (major) {
      this.major += 1;
      this.minor = 0;
    } else this.minor += 1;
    if (this.major === 0) this.major = 1;
    this.versions.push({ label: `${this.major}.${this.minor}`, timestamp: this.now, author, text: this.text, failure: null });
    return this;
  }

  /** A version that exists on the server but cannot be downloaded. */
  saveUnavailable(reason: string, author = 'studente'): this {
    this.minor += 1;
    if (this.major === 0) this.major = 1;
    this.versions.push({ label: `${this.major}.${this.minor}`, timestamp: this.now, author, text: null, failure: reason });
    return this;
  }

  async build(): Promise<DocumentDataset> {
    const privacyMode = this.options.privacyMode ?? 'FULL';
    const analyzedAt = nowIso();
    const chain: ChainState = { lastSeq: 0, lastHash: null };
    const events: AnyTrackingEvent[] = [];
    const runId = `run_demo_${this.options.documentId}`;
    const log = async (raw: Parameters<typeof sealEvent>[0]): Promise<void> => {
      events.push(await sealEvent(raw, this.options.documentId, runId, chain));
    };
    await log({ type: 'ANALYSIS_START', timestamp: analyzedAt, payload: { privacyMode, trigger: 'MANUAL', extensionVersion: 'demo' } });
    await log({ type: 'VERSIONS_LISTED', timestamp: analyzedAt, payload: { versionsOnServer: this.versions.length - 1, includingCurrent: this.versions.length, alreadyStored: 0 } });

    const snapshots: Snapshot[] = [];
    let failed = 0;
    for (let i = 0; i < this.versions.length; i++) {
      const v = this.versions[i] as PendingVersion;
      const isCurrent = i === this.versions.length - 1;
      const meta = { versionId: isCurrent ? 'current' : String(512 + i), versionLabel: v.label, timestamp: v.timestamp, authorLabel: isCurrent ? null : this.authorLabel(v.author), isCurrent, sizeBytes: v.text ? 9000 + v.text.length * 2 : null };
      if (v.text === null) {
        failed += 1;
        snapshots.push(await sealSnapshot(await buildSnapshotCandidate(meta, null, privacyMode, null, [v.failure ?? 'download failed']), this.options.documentId, i));
        await log({ type: 'VERSION_FETCH_FAILED', timestamp: analyzedAt, payload: { versionId: meta.versionId, versionLabel: v.label, created: v.timestamp, reason: v.failure ?? 'download failed', httpStatus: 403 } });
        continue;
      }
      const { paragraphs, headings } = parseHeadings(v.text);
      const text = paragraphs.join('\n');
      const extracted = { status: 'FULL' as const, text, paragraphs, headings, wordCount: countWords(text), characterCount: text.length, notes: [] };
      const bytes = new TextEncoder().encode(text);
      const candidate = await buildSnapshotCandidate(meta, extracted, privacyMode, bytes);
      snapshots.push(await sealSnapshot(candidate, this.options.documentId, i));
      await log({ type: 'VERSION_FETCHED', timestamp: analyzedAt, payload: { versionId: meta.versionId, versionLabel: v.label, created: v.timestamp, bytes: bytes.length, textHash: candidate.textHash, wordCount: candidate.wordCount, extractionStatus: 'FULL' } });
    }
    await log({ type: 'ANALYSIS_END', timestamp: analyzedAt, payload: { fetched: this.versions.length - failed, failed, skipped: 0, durationMs: 1200 } });

    const first = this.versions[0]?.timestamp ?? analyzedAt;
    const last = this.versions.at(-1)?.timestamp ?? analyzedAt;
    return {
      document: {
        id: this.options.documentId,
        name: this.options.name,
        provider: 'SHAREPOINT',
        siteUrl: 'https://contoso-my.sharepoint.com/personal/demo_contoso_it',
        serverRelativeUrl: `/personal/demo_contoso_it/Documents/${this.options.name}`,
        webUrl: `https://contoso-my.sharepoint.com/personal/demo_contoso_it/Documents/${encodeURIComponent(this.options.name)}`,
        host: 'contoso-my.sharepoint.com',
        timeCreated: this.options.created ?? first,
        timeLastModified: last,
        currentVersionLabel: this.versions.at(-1)?.label ?? null,
        firstAnalyzedAt: analyzedAt,
        lastAnalyzedAt: analyzedAt,
        extensionVersion: 'demo',
        privacyMode,
        authors: Array.from(this.authors.values()),
        student: this.options.student ?? { studentId: 'studente-demo', assignmentId: 'saggio-pedagogia', courseId: 'PED-101' },
      },
      events,
      snapshots,
      diffs: computeAllDiffs(snapshots),
    };
  }

  private authorLabel(name: string | null): string | null {
    if (!name) return null;
    let a = this.authors.get(name);
    if (!a) {
      a = { label: `Autore ${this.authors.size + 1}`, identityHash: `demo-author-${this.authors.size + 1}`, versions: 0, ...((this.options.privacyMode ?? 'FULL') === 'FULL' ? { displayName: name } : {}) };
      this.authors.set(name, a);
    }
    a.versions += 1;
    return a.label;
  }
}
