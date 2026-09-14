/**
 * Which parts of the text were developed when.
 *
 * - Sections: paragraphs are attributed to the nearest preceding heading.
 * - Phases: for each session, the sectioned diff between the last readable
 *   version before the session and the last readable version inside it.
 * - Provenance: for each paragraph of the final text, the version in which it
 *   (or an earlier variant of it) first appeared and the version since which
 *   it has not changed.
 * - Abandoned: paragraphs that existed in some version and are absent from
 *   the final text.
 *
 * Everything is derived from the texts; nothing is inferred about why a
 * change happened.
 */
import { diffArrays } from 'diff';
import type { AbandonedParagraph, ContentEvolution, DocumentDataset, ParagraphProvenance, PhaseContentChange, SectionChange, SectionSummary, Session, Snapshot, VersionContentChange } from '@/models';
import { excerpt, splitParagraphs, tokenizeWords } from '@/utils/text';
import { formatDateTime } from '@/utils/time';

export const NO_SECTION = '(prima del primo titolo)';
export const WHOLE_DOCUMENT = '(documento)';
/**
 * Two paragraphs are variants of each other when the longest common word
 * subsequence covers at least this fraction of their combined length
 * (order-aware, so shared vocabulary alone does not match).
 */
export const SIMILARITY_THRESHOLD = 0.5;
/** Cheap pre-filter on word sets before the order-aware comparison. */
const JACCARD_PREFILTER = 0.3;
const MAX_LCS_CANDIDATES = 5;
const MIN_WORDS_FOR_SIMILARITY = 4;
const MAX_ABANDONED = 30;
const EXCERPT_CHARS = 160;

type Basis = ContentEvolution['basis'];

interface Para {
  key: string;
  text: string | null;
  words: number | null;
  section: string | null;
  isHeading: boolean;
  wordSet: Set<string> | null;
  tokens: string[] | null;
}

interface Sectioned {
  snapshot: Snapshot;
  paras: Para[];
  keys: Set<string>;
  sectionWords: Map<string, number>;
  sectionLevels: Map<string, number>;
  sectionOrder: string[];
}

export function analyzeContentEvolution(dataset: DocumentDataset, sessions: Session[]): ContentEvolution {
  const snapshots = [...dataset.snapshots].sort((a, b) => a.index - b.index);
  const readable = snapshots.filter((s) => s.extractionStatus !== 'UNAVAILABLE');
  const notes: string[] = [];
  if (readable.length === 0) {
    return { basis: 'NONE', hasSections: false, sections: [], phases: [], versionChanges: [], finalParagraphs: [], abandoned: [], notes: ['Nessuna versione leggibile: l\'evoluzione dei contenuti non è determinabile.'] };
  }
  const basis: Basis = readable.every((s) => typeof s.text === 'string') ? 'TEXT' : 'PARAGRAPH_HASHES';
  const R = readable.map((s) => sectionize(s, basis));
  const final = R[R.length - 1] as Sectioned;
  const hasSections = basis === 'TEXT' && final.snapshot.headings.some((h) => h.text.trim().length > 0);
  const sessionOf = (index: number): number => sessions.find((s) => index >= s.fromSnapshotIndex && index <= s.toSnapshotIndex)?.index ?? 0;
  const versionOf = (index: number): string => snapshots.find((s) => s.index === index)?.versionLabel ?? '';

  if (basis === 'PARAGRAPH_HASHES') notes.push('Modalità METRICS_ONLY: i paragrafi sono confrontati per hash; sezioni, estratti e parole per paragrafo non sono disponibili.');
  if (basis === 'TEXT' && !hasSections) notes.push('Il documento non contiene titoli di sezione riconoscibili: l\'evoluzione è descritta per paragrafo e per posizione nel testo finale.');
  if (readable.length < snapshots.length) notes.push(`${snapshots.length - readable.length} versioni non leggibili: i confronti saltano alle versioni leggibili più vicine.`);

  // Provenance of every final paragraph.
  const finalParagraphs: ParagraphProvenance[] = final.paras.map((p, position) => {
    let current = p;
    let revisions = 0;
    let firstSeen = final.snapshot.index;
    let lastChanged = final.snapshot.index;
    let lastChangedFixed = false;
    for (let k = R.length - 2; k >= 0; k--) {
      const prev = R[k] as Sectioned;
      if (prev.keys.has(current.key)) {
        firstSeen = prev.snapshot.index;
        if (!lastChangedFixed) lastChanged = prev.snapshot.index;
        continue;
      }
      const ancestor = basis === 'TEXT' ? bestSimilar(current, prev.paras) : null;
      if (!ancestor) break;
      revisions += 1;
      lastChangedFixed = true;
      current = ancestor;
      firstSeen = prev.snapshot.index;
    }
    return {
      position,
      section: p.section,
      isHeading: p.isHeading,
      words: p.words,
      excerpt: p.text === null ? null : excerpt(p.text, EXCERPT_CHARS),
      firstSeenIndex: firstSeen,
      firstSeenVersion: versionOf(firstSeen),
      firstSeenSession: sessionOf(firstSeen),
      lastChangedIndex: lastChanged,
      lastChangedVersion: versionOf(lastChanged),
      lastChangedSession: sessionOf(lastChanged),
      revisions,
    };
  });

  // Consecutive version changes and abandoned paragraphs.
  const versionChanges: VersionContentChange[] = [];
  const abandonedAll: AbandonedParagraph[] = [];
  for (let k = 1; k < R.length; k++) {
    const from = R[k - 1] as Sectioned;
    const to = R[k] as Sectioned;
    const d = sectionedDiff(from, to);
    if (d.changes.length) versionChanges.push({ fromIndex: from.snapshot.index, toIndex: to.snapshot.index, fromVersion: from.snapshot.versionLabel, toVersion: to.snapshot.versionLabel, at: to.snapshot.timestamp, sections: d.changes });
    for (const p of d.deleted) {
      if (final.keys.has(p.key)) continue;
      if (R.slice(k).some((later) => later.keys.has(p.key))) continue;
      if (basis === 'TEXT' && bestSimilar(p, final.paras)) continue;
      let firstSeenK = k - 1;
      while (firstSeenK > 0 && (R[firstSeenK - 1] as Sectioned).keys.has(p.key)) firstSeenK -= 1;
      abandonedAll.push({
        words: p.words,
        excerpt: p.text === null ? null : excerpt(p.text, EXCERPT_CHARS),
        section: p.section,
        firstSeenIndex: (R[firstSeenK] as Sectioned).snapshot.index,
        firstSeenVersion: (R[firstSeenK] as Sectioned).snapshot.versionLabel,
        lastSeenIndex: from.snapshot.index,
        lastSeenVersion: from.snapshot.versionLabel,
        removedIndex: to.snapshot.index,
        removedVersion: to.snapshot.versionLabel,
        removedSession: sessionOf(to.snapshot.index),
      });
    }
  }

  // Phases = sessions.
  const firstReadableIndex = (R[0] as Sectioned).snapshot.index;
  const phases: PhaseContentChange[] = sessions.map((s) => {
    const inside = R.filter((x) => x.snapshot.index >= s.fromSnapshotIndex && x.snapshot.index <= s.toSnapshotIndex);
    const before = R.filter((x) => x.snapshot.index < s.fromSnapshotIndex).at(-1) ?? null;
    const last = inside.at(-1) ?? null;
    const first = inside[0] ?? null;
    const isFirstPhase = before === null;
    const fromSectioned = isFirstPhase ? first : before;
    const changes = last && fromSectioned && fromSectioned !== last ? sectionedDiff(fromSectioned, last).changes : [];
    const present = isFirstPhase ? finalParagraphs.filter((p) => p.firstSeenIndex === firstReadableIndex) : [];
    const fresh = finalParagraphs.filter((p) => p.firstSeenSession === s.index && !(isFirstPhase && p.firstSeenIndex === firstReadableIndex));
    const revised = finalParagraphs.filter((p) => p.lastChangedSession === s.index && p.firstSeenSession !== s.index);
    const abandoned = abandonedAll.filter((a) => a.removedSession === s.index);
    const phase: PhaseContentChange = {
      sessionIndex: s.index,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      fromIndex: before?.snapshot.index ?? null,
      toIndex: last?.snapshot.index ?? s.toSnapshotIndex,
      sections: changes,
      presentInFirstVersionParagraphs: present.length,
      presentInFirstVersionWords: sumWords(present),
      newFinalParagraphs: fresh.length,
      newFinalWords: sumWords(fresh),
      revisedFinalParagraphs: revised.length,
      abandonedParagraphs: abandoned.length,
      abandonedWords: sumWords(abandoned),
      summary: '',
    };
    phase.summary = describePhase(phase, s, last === null, hasSections);
    return phase;
  });

  // Section summaries (final structure).
  const sections: SectionSummary[] = hasSections
    ? final.sectionOrder.map((name) => {
        const paras = finalParagraphs.filter((p) => p.section === name);
        const firstSeenIndex = paras.length ? Math.min(...paras.map((p) => p.firstSeenIndex)) : final.snapshot.index;
        return {
          section: name,
          level: final.sectionLevels.get(name) ?? 0,
          finalWords: final.sectionWords.get(name) ?? 0,
          finalParagraphs: paras.length,
          firstSeenIndex,
          firstSeenVersion: versionOf(firstSeenIndex),
          firstSeenSession: sessionOf(firstSeenIndex),
          sessionsTouched: phases.filter((ph) => ph.sections.some((c) => c.section === name)).map((ph) => ph.sessionIndex),
          wordsByPhase: phases.map((ph) => ({ sessionIndex: ph.sessionIndex, words: R.find((x) => x.snapshot.index === ph.toIndex)?.sectionWords.get(name) ?? 0 })),
        };
      })
    : [];

  const abandoned = [...abandonedAll]
    .sort((a, b) => (b.words ?? 0) - (a.words ?? 0))
    .slice(0, MAX_ABANDONED)
    .sort((a, b) => a.removedIndex - b.removedIndex);
  if (abandonedAll.length > MAX_ABANDONED) notes.push(`${abandonedAll.length} paragrafi eliminati in totale; sono riportati i ${MAX_ABANDONED} più lunghi.`);

  return { basis, hasSections, sections, phases, versionChanges, finalParagraphs, abandoned, notes };
}

// ---------------------------------------------------------------- helpers

function sectionize(snapshot: Snapshot, basis: Basis): Sectioned {
  const paras: Para[] = [];
  const sectionWords = new Map<string, number>();
  const sectionLevels = new Map<string, number>();
  const sectionOrder: string[] = [];
  if (basis === 'TEXT') {
    const headings = snapshot.headings.filter((h) => h.text.trim().length > 0);
    const seen = new Map<string, number>();
    let k = 0;
    let section = headings.length ? NO_SECTION : WHOLE_DOCUMENT;
    for (const text of splitParagraphs(snapshot.text as string)) {
      let isHeading = false;
      const next = headings[k];
      if (next && next.text === text) {
        const n = (seen.get(text) ?? 0) + 1;
        seen.set(text, n);
        section = n > 1 ? `${text} (${n})` : text;
        sectionLevels.set(section, next.level);
        isHeading = true;
        k += 1;
      }
      const tokens = tokenizeWords(text);
      if (!sectionOrder.includes(section)) sectionOrder.push(section);
      sectionWords.set(section, (sectionWords.get(section) ?? 0) + tokens.length);
      const lower = tokens.map((t) => t.toLowerCase());
      paras.push({ key: text, text, words: tokens.length, section, isHeading, wordSet: new Set(lower), tokens: lower });
    }
  } else {
    for (const h of snapshot.paragraphHashes) paras.push({ key: h, text: null, words: null, section: null, isHeading: false, wordSet: null, tokens: null });
  }
  return { snapshot, paras, keys: new Set(paras.map((p) => p.key)), sectionWords, sectionLevels, sectionOrder };
}

function bestSimilar(target: Para, candidates: Para[]): Para | null {
  if (!target.wordSet || !target.tokens || target.wordSet.size < MIN_WORDS_FOR_SIMILARITY) return null;
  const shortlist = candidates
    .filter((c) => c.wordSet && c.tokens && c.wordSet.size >= MIN_WORDS_FOR_SIMILARITY && c.isHeading === target.isHeading)
    .map((c) => ({ c, j: jaccard(target.wordSet as Set<string>, c.wordSet as Set<string>) }))
    .filter((x) => x.j >= JACCARD_PREFILTER)
    .sort((a, b) => b.j - a.j)
    .slice(0, MAX_LCS_CANDIDATES);
  let best: Para | null = null;
  let bestScore = 0;
  for (const { c } of shortlist) {
    const score = sequenceSimilarity(target.tokens, c.tokens as string[]);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return bestScore >= SIMILARITY_THRESHOLD ? best : null;
}

/** 2·LCS / (|a| + |b|) on word sequences. */
export function sequenceSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  let common = 0;
  for (const c of diffArrays(a, b)) if (!c.added && !c.removed) common += c.value.length;
  return (2 * common) / (a.length + b.length);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const w of a) if (b.has(w)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

interface SectionedDiffResult {
  changes: SectionChange[];
  added: Para[];
  deleted: Para[];
  modified: Array<[Para, Para]>;
}

/** Paragraph diff between two versions, attributed to sections. */
export function sectionedDiff(from: Sectioned, to: Sectioned): SectionedDiffResult {
  const added: Para[] = [];
  const deleted: Para[] = [];
  const modified: Array<[Para, Para]> = [];
  let fi = 0;
  let ti = 0;
  let pending: Para[] = [];
  for (const c of diffArrays(from.paras.map((p) => p.key), to.paras.map((p) => p.key))) {
    const n = c.value.length;
    if (c.removed) {
      deleted.push(...pending);
      pending = from.paras.slice(fi, fi + n);
      fi += n;
      continue;
    }
    if (c.added) {
      const items = to.paras.slice(ti, ti + n);
      const pairs = Math.min(pending.length, items.length);
      for (let i = 0; i < pairs; i++) modified.push([pending[i] as Para, items[i] as Para]);
      deleted.push(...pending.slice(pairs));
      pending = [];
      added.push(...items.slice(pairs));
      ti += n;
      continue;
    }
    deleted.push(...pending);
    pending = [];
    fi += n;
    ti += n;
  }
  deleted.push(...pending);

  const bySection = new Map<string, SectionChange>();
  const get = (name: string | null): SectionChange => {
    const key = name ?? WHOLE_DOCUMENT;
    let s = bySection.get(key);
    if (!s) {
      s = { section: key, wordsBefore: from.sectionWords.get(key) ?? 0, wordsAfter: to.sectionWords.get(key) ?? 0, wordsAdded: 0, wordsDeleted: 0, paragraphsAdded: 0, paragraphsDeleted: 0, paragraphsModified: 0 };
      bySection.set(key, s);
    }
    return s;
  };
  for (const p of added) {
    const s = get(p.section);
    s.paragraphsAdded += 1;
    s.wordsAdded += p.words ?? 0;
  }
  for (const p of deleted) {
    const s = get(p.section);
    s.paragraphsDeleted += 1;
    s.wordsDeleted += p.words ?? 0;
  }
  for (const [before, after] of modified) {
    const s = get(after.section);
    s.paragraphsModified += 1;
    if (before.text !== null && after.text !== null) {
      for (const c of diffArrays(tokenizeWords(before.text), tokenizeWords(after.text))) {
        if (c.added) s.wordsAdded += c.value.length;
        else if (c.removed) s.wordsDeleted += c.value.length;
      }
    }
  }
  const order = [...to.sectionOrder, ...from.sectionOrder.filter((n) => !to.sectionOrder.includes(n))];
  const changes = [...bySection.values()].sort((a, b) => order.indexOf(a.section) - order.indexOf(b.section));
  return { changes, added, deleted, modified };
}

function sumWords(items: Array<{ words: number | null }>): number {
  return items.reduce((n, x) => n + (x.words ?? 0), 0);
}

function describePhase(p: PhaseContentChange, s: Session, unreadable: boolean, hasSections: boolean): string {
  const head = `Sessione ${s.index + 1} (${formatDateTime(s.startedAt)}${s.versionCount > 1 ? ` → ${formatDateTime(s.endedAt)}` : ''}, ${s.versionCount} ${s.versionCount === 1 ? 'versione' : 'versioni'})`;
  if (unreadable) return `${head}: nessuna versione leggibile in questa sessione.`;
  const parts: string[] = [];
  if (p.presentInFirstVersionParagraphs > 0) parts.push(`la prima versione contiene già ${p.presentInFirstVersionParagraphs} paragrafi del testo finale (${p.presentInFirstVersionWords} parole), scritti prima dell'osservazione`);
  if (p.newFinalParagraphs > 0) parts.push(`introdotti ${p.newFinalParagraphs} paragrafi del testo finale (${p.newFinalWords} parole)`);
  if (p.revisedFinalParagraphs > 0) parts.push(`rivisti ${p.revisedFinalParagraphs} paragrafi già presenti`);
  if (p.abandonedParagraphs > 0) parts.push(`eliminati ${p.abandonedParagraphs} paragrafi poi non ripresi (${p.abandonedWords} parole)`);
  if (hasSections && p.sections.length) {
    const touched = p.sections.filter((c) => c.wordsAdded + c.wordsDeleted + c.paragraphsModified > 0).slice(0, 5).map((c) => `${c.section} (${c.wordsBefore} → ${c.wordsAfter} parole)`);
    if (touched.length) parts.push(`sezioni modificate: ${touched.join(', ')}${p.sections.length > 5 ? ', …' : ''}`);
  }
  if (parts.length === 0) parts.push('nessuna modifica al testo rilevata fra le versioni leggibili');
  return `${head}: ${parts.join('; ')}.`;
}
