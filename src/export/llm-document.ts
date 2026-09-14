/**
 * A single self-contained file for an LLM (Microsoft 365 Copilot, ChatGPT,
 * Claude…): instructions + observed data + final text. Built from one block
 * model and rendered to Markdown and to DOCX, so both carry the same content.
 */
import { zipSync, strToU8 } from 'fflate';
import type { Analysis } from '@/analysis';
import { sourceLabel, type DocumentDataset } from '@/models';
import { excerpt, formatInt } from '@/utils/text';
import { formatDateTime, formatDuration } from '@/utils/time';
import { buildAnalysisPrompt, buildCompactLlmInput } from './llm-exporter';
import { GLOSSARY_GROUPS, KIND_LABEL, KIND_MEANING, legend, term } from '@/analysis/glossary';

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'table'; header: string[]; rows: string[][] }
  | { type: 'quote'; text: string }
  | { type: 'code'; text: string };

export function buildLlmDocumentBlocks(dataset: DocumentDataset, analysis: Analysis, generatedAt: string): Block[] {
  const c = buildCompactLlmInput(dataset, analysis, generatedAt, { maxTextWords: 20_000 });
  const m = analysis.metrics;
  const o = analysis.observation;
  const doc = dataset.document;
  const blocks: Block[] = [];
  const dt = (iso: string | null | undefined): string => (iso ? formatDateTime(iso) : '–');
  const min = (ms: number | null | undefined): string => (ms === null || ms === undefined ? '–' : formatDuration(ms));

  blocks.push({ type: 'heading', level: 1, text: 'Evidentia — Dati del processo di scrittura per analisi con LLM' });
  blocks.push({ type: 'paragraph', text: `Documento: ${doc.name || '(senza nome)'} · Fonte: ${sourceLabel(doc)} · Generato il ${dt(generatedAt)} · Modalità privacy: ${doc.privacyMode}` });
  blocks.push({ type: 'quote', text: 'Questi dati descrivono esclusivamente le versioni del documento conservate dal server. Non dimostrano chi abbia scritto il testo e non costituiscono un sistema di rilevamento dell\'uso di intelligenza artificiale. Un grande aumento di testo fra due versioni è solo un grande aumento: fra una versione e l\'altra non è osservato nulla. Gli autori sono etichette pseudonime.' });

  blocks.push({ type: 'heading', level: 2, text: 'Istruzioni per l\'analisi' });
  const prompt = buildAnalysisPrompt(dataset);
  const body = prompt.split('\n---\n')[1] ?? prompt;
  for (const line of body.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    if (/^\d+\.\s/.test(t) || t.startsWith('- ')) blocks.push({ type: 'bullets', items: [t.replace(/^(\d+\.|-)\s/, '')] });
    else blocks.push({ type: 'paragraph', text: t });
  }
  blocks.push({ type: 'paragraph', text: 'Le sezioni seguenti riportano i dati osservati. Le sezioni "Copertura" e "Limiti" elencano ciò che non è osservabile: trattale come limiti, non come indizi. Ogni tabella è preceduta da una legenda; il significato completo di ogni valore è nel "Glossario dei dati".' });

  blocks.push({ type: 'heading', level: 2, text: 'Glossario dei dati' });
  blocks.push({ type: 'paragraph', text: `Ogni valore è etichettato come ${(Object.keys(KIND_LABEL) as Array<keyof typeof KIND_LABEL>).map((k) => `${KIND_LABEL[k]} (${KIND_MEANING[k]})`).join(', ')}. Usa queste definizioni per interpretare le tabelle; non attribuire ai valori significati diversi da quelli indicati.` });
  for (const g of GLOSSARY_GROUPS) {
    blocks.push({ type: 'heading', level: 3, text: g.title });
    blocks.push({ type: 'bullets', items: g.ids.map((id) => { const e = term(id); return `${e.label} [${KIND_LABEL[e.kind]}]: ${[e.meaning, e.method, e.use].filter(Boolean).join(' ')}`; }) });
  }

  blocks.push({ type: 'heading', level: 2, text: 'Documento' });
  blocks.push({ type: 'bullets', items: [
    `Nome: ${doc.name || '–'}`,
    `Creato: ${dt(doc.timeCreated)} · Ultima modifica: ${dt(doc.timeLastModified)} · Versione corrente: ${doc.currentVersionLabel ?? '–'}`,
    `Autori delle versioni: ${doc.authors.length ? doc.authors.map((a) => `${a.label} (${a.versions} versioni)`).join(', ') : 'non disponibili'}`,
    ...(doc.student && Object.values(doc.student).some(Boolean) ? [`Identificativi (pseudonimi): ${[doc.student.studentId, doc.student.assignmentId, doc.student.courseId].filter(Boolean).join(' · ')}`] : []),
    `Parole finali: ${formatInt(m.document.finalWordCount)} in ${m.document.finalParagraphCount} paragrafi`,
  ] });

  blocks.push({ type: 'heading', level: 2, text: 'Copertura dell\'osservazione' });
  blocks.push({ type: 'bullets', items: [
    `Versioni sul server: ${o.versionsOnServer} · lette: ${o.versionsStored} · con testo: ${o.versionsReadable}`,
    `Prima versione: ${dt(o.firstVersionAt)} · Ultima versione: ${dt(o.lastVersionAt)} · Arco: ${min(m.versions.totalSpanMs)}`,
    `Intervallo mediano fra versioni: ${min(m.versions.medianIntervalMs)} · Intervallo più lungo: ${min(m.timeline.longestGapBetweenVersionsMs)}`,
  ] });
  blocks.push({ type: 'heading', level: 3, text: `Gap noti (${o.knownGaps.length})` });
  blocks.push(o.knownGaps.length ? { type: 'bullets', items: o.knownGaps.map((g) => `${g.type} · ${dt(g.from)}${g.to ? ` → ${dt(g.to)}` : ''}${g.durationMs !== null ? ` (${min(g.durationMs)})` : ''}: ${g.description}`) } : { type: 'paragraph', text: 'Nessun gap rilevato.' });
  if (o.extractionFailures.length) blocks.push({ type: 'bullets', items: o.extractionFailures.map((f) => `Versione ${f.versionLabel} (${dt(f.at)}) non leggibile: ${f.reason}`) });
  if (o.continuityWarnings.length) blocks.push({ type: 'bullets', items: o.continuityWarnings.map((w) => `${w.type}: ${w.description}`) });
  blocks.push({ type: 'heading', level: 3, text: 'Limiti strutturali' });
  blocks.push({ type: 'bullets', items: c.limitations });

  blocks.push({ type: 'heading', level: 2, text: `Versioni (${c.versions.length})` });
  blocks.push({ type: 'paragraph', text: `"Intervallo" è il tempo dalla versione precedente; "Parole/ora" è calcolato solo per intervalli di almeno ${analysis.time.minIntervalForRateMinutes} minuti all'interno di una sessione; "Sezioni" elenca le sezioni cambiate rispetto alla versione precedente con parole aggiunte/eliminate.` });
  blocks.push({ type: 'paragraph', text: legend(['versionIndex', 'versionLabel', 'versionDate', 'versionAuthor', 'versionWords', 'versionDelta', 'interval', 'wordsPerHour', 'versionSections', 'versionStatus']) });
  const intervalByTo = new Map(analysis.time.intervals.map((x) => [x.toIndex, x]));
  const changeByTo = new Map(analysis.content.versionChanges.map((x) => [x.toIndex, x]));
  blocks.push({ type: 'table', header: ['#', 'Versione', 'Data', 'Autore', 'Parole', 'Δ', 'Intervallo', 'Parole/ora', 'Sezioni', 'Stato'], rows: c.versions.map((v, i) => {
    const iv = intervalByTo.get(i);
    const ch = changeByTo.get(i);
    return [String(i), v.version, dt(v.time), v.author ?? '–', v.wordCount === null ? '–' : formatInt(v.wordCount), v.delta === null ? '–' : `${v.delta >= 0 ? '+' : ''}${formatInt(v.delta)}`, iv ? min(iv.elapsedMs) : '–', iv?.wordsPerHourNet === null || iv?.wordsPerHourNet === undefined ? '–' : formatInt(iv.wordsPerHourNet), ch ? sectionList(ch.sections) : '–', v.status];
  }) });

  blocks.push({ type: 'heading', level: 2, text: `Sessioni (${c.sessions.length})` });
  blocks.push({ type: 'paragraph', text: `Gruppi di versioni salvate a meno di ${analysis.options.sessionGapMinutes} minuti l'una dall'altra. Indicano quando il documento è stato salvato, non quanto tempo è stato dedicato.` });
  blocks.push({ type: 'paragraph', text: legend(['sessionIndex', 'sessionStart', 'sessionEnd', 'sessionSpan', 'sessionVersions', 'sessionWords', 'sessionAuthors']) });
  blocks.push({ type: 'table', header: ['#', 'Inizio', 'Fine', 'Arco', 'Versioni', 'Parole', 'Autori'], rows: c.sessions.map((s) => [String(s.index), dt(s.start), dt(s.end), s.versions > 1 ? `${s.spanMinutes} min` : '–', String(s.versions), `${s.wordsStart ?? '–'} → ${s.wordsEnd ?? '–'}`, s.authors.join(', ') || '–']) });

  blocks.push({ type: 'heading', level: 2, text: `Transizioni principali (${c.majorTransitions.length})` });
  blocks.push({ type: 'paragraph', text: legend(['majorTransitions', 'interval', 'variation', 'paragraphsPDM', 'diffType', 'versionAuthor']) });
  blocks.push(c.majorTransitions.length ? { type: 'table', header: ['Versioni', 'Intervallo', 'Parole', 'Variazione', 'Par. +/−/mod', 'Tipo', 'Autore'], rows: c.majorTransitions.map((t) => [`${t.fromVersion} → ${t.toVersion}`, `${t.elapsedMinutes} min`, `${formatInt(t.wordsBefore)} → ${formatInt(t.wordsAfter)}`, `${t.netChange >= 0 ? '+' : ''}${formatInt(t.netChange)}`, `${t.addedParagraphs}/${t.deletedParagraphs}/${t.modifiedParagraphs}`, t.classification, t.author ?? '–']) } : { type: 'paragraph', text: 'Nessuna transizione di rilievo.' });

  blocks.push({ type: 'heading', level: 2, text: `Grandi inserimenti (${c.largeInsertions.length}, soglia ${m.insertions.thresholdWords} parole)` });
  blocks.push({ type: 'paragraph', text: legend(['largeInsertions', 'excerpt']) });
  if (c.largeInsertions.length === 0) blocks.push({ type: 'paragraph', text: 'Nessuno.' });
  for (const li of c.largeInsertions) {
    blocks.push({ type: 'paragraph', text: `Versione ${li.fromVersion} → ${li.toVersion} (${dt(li.time)}, ${li.elapsedMinutes} min): da ${formatInt(li.wordsBefore)} a ${formatInt(li.wordsAfter)} parole (+${formatInt(li.netChange)}), ${li.addedParagraphs} paragrafi aggiunti, autore ${li.author ?? '–'}.` });
    for (const e of li.addedExcerpts ?? []) blocks.push({ type: 'quote', text: e });
  }

  blocks.push({ type: 'heading', level: 2, text: `Revisioni (${c.revisionPatterns.length})` });
  blocks.push({ type: 'paragraph', text: legend(['revisions', 'diffType', 'diffReplaced', 'paragraphsPDM']) });
  if (c.revisionPatterns.length === 0) blocks.push({ type: 'paragraph', text: 'Nessun passaggio con cancellazioni o riscritture.' });
  for (const r of c.revisionPatterns) {
    blocks.push({ type: 'paragraph', text: `Versione ${r.fromVersion} → ${r.toVersion} (${dt(r.time)}): ${r.classification}, +${r.wordsAdded} / −${r.wordsDeleted} parole, ${r.wordsReplaced} sostituite, ${r.paragraphsModified} paragrafi modificati, ${r.paragraphsAdded} aggiunti, ${r.paragraphsDeleted} eliminati.` });
    for (const e of r.deletedExcerpts ?? []) blocks.push({ type: 'quote', text: `Eliminato: ${e}` });
    for (const e of r.addedExcerpts ?? []) blocks.push({ type: 'quote', text: `Aggiunto: ${e}` });
  }

  blocks.push(...timeBlocks(analysis));
  blocks.push(...contentBlocks(analysis));

  blocks.push({ type: 'heading', level: 2, text: 'Metriche (deterministiche, nessun punteggio)' });
  blocks.push({ type: 'paragraph', text: legend(['wordsAdded', 'wordsDeleted', 'wordsRewritten', 'firstVersionWords', 'sessions', 'largeInsertions', 'revisions', 'revisionIntensity', 'afterFirstDraft', 'chain']) });
  blocks.push({ type: 'bullets', items: [
    `Parole aggiunte / eliminate / riscritte (stima): +${formatInt(m.writing.estimatedWordsAdded)} / −${formatInt(m.writing.estimatedWordsDeleted)} / ~${formatInt(m.writing.estimatedWordsRewritten)} · crescita netta ${formatInt(m.writing.netWordGrowth)}`,
    `Prima versione: ${m.versions.firstVersionWordCount === null ? '–' : `${formatInt(m.versions.firstVersionWordCount)} parole`} · Autori: ${m.versions.numberOfAuthors}`,
    `Sessioni: ${m.sessions.numberOfSessions} (arco medio ${min(m.sessions.averageSessionSpanMs)}, massimo ${min(m.sessions.longestSessionSpanMs)}, ${m.sessions.singleVersionSessions} con una sola versione)`,
    `Grandi inserimenti: ${m.insertions.numberOfLargeInsertions} (il più grande ${formatInt(m.insertions.largestInsertionWords)} parole; ${m.insertions.insertionsOver300Words} > 300, ${m.insertions.insertionsOver1000Words} > 1000)`,
    `Revisioni: ${m.revision.numberOfRevisionEvents} passaggi, ${m.revision.paragraphsRewritten} paragrafi modificati, intensità ${m.revision.revisionIntensity}, quota di versioni dopo la prima bozza completa ${m.revision.proportionOfVersionsAfterFirstCompleteDraft === null ? 'n/d' : `${Math.round(m.revision.proportionOfVersionsAfterFirstCompleteDraft * 100)}%`}`,
    `Aumento massimo fra due versioni: ${formatInt(m.timeline.largestWordIncreaseBetweenVersions)} parole · intervallo più breve con grande aumento: ${min(m.timeline.shortestIntervalWithLargeIncreaseMs)}`,
    `Integrità: hash chain ${analysis.chain.valid ? 'valida' : 'NON valida'} (${analysis.chain.checked} eventi); rileva alterazioni accidentali, non è una prova forense`,
  ] });

  blocks.push({ type: 'heading', level: 2, text: 'Testo della versione corrente' });
  blocks.push({ type: 'paragraph', text: `Disponibilità: ${c.finalDocument.textAvailability}.` });
  if (c.finalDocument.text) for (const p of c.finalDocument.text.split('\n')) if (p.trim()) blocks.push({ type: 'paragraph', text: p });
  else blocks.push({ type: 'paragraph', text: 'Testo non incluso.' });

  blocks.push({ type: 'heading', level: 2, text: 'Appendice: metriche, tempo stimato e copertura in JSON' });
  blocks.push({ type: 'code', text: JSON.stringify({ metrics: m, timeEstimates: c.timeEstimates, observationCoverage: c.observationCoverage, observationGaps: c.observationGaps }, null, 1) });
  return blocks;
}

const MAX_PARAGRAPH_ROWS = 400;

function sectionList(changes: Analysis['content']['versionChanges'][number]['sections']): string {
  const items = changes.filter((x) => x.wordsAdded + x.wordsDeleted + x.paragraphsModified + x.paragraphsAdded + x.paragraphsDeleted > 0).map((x) => `${x.section} (+${x.wordsAdded}/−${x.wordsDeleted})`);
  return items.length ? `${items.slice(0, 3).join('; ')}${items.length > 3 ? '; …' : ''}` : '–';
}

function timeBlocks(analysis: Analysis): Block[] {
  const t = analysis.time;
  const min = (ms: number | null | undefined): string => (ms === null || ms === undefined ? '–' : formatDuration(ms));
  const rate = (n: number | null): string => (n === null ? '–' : formatInt(n));
  const dt = (iso: string): string => formatDateTime(iso);
  const blocks: Block[] = [];
  blocks.push({ type: 'heading', level: 2, text: 'Tempo stimato e ritmo (stime, non misure)' });
  blocks.push({ type: 'paragraph', text: `Il tempo osservato è la somma, per ogni sessione, dell'intervallo fra la prima e l'ultima versione. Il tempo attivo stimato aggiunge un margine di avvio di ${t.leadInMinutes} minuti per sessione (limitato dal tempo trascorso dalla versione precedente). Le parole per ora sono calcolate solo su sessioni con almeno ${t.minSessionForRateMinutes} minuti stimati.` });
  blocks.push({ type: 'bullets', items: [
    `Arco di calendario: ${min(t.calendarSpanMs)} · giornate con versioni: ${t.daysWithVersions}`,
    `Tempo osservato (somma archi delle sessioni): ${min(t.observedTotalMs)} · Tempo attivo stimato: ${min(t.estimatedActiveTotalMs)}`,
    `Parole per ora (stima, sull'intero lavoro): nette ${rate(t.wordsPerHourNet)} · aggiunte ${rate(t.wordsPerHourAdded)} · mediana per sessione ${rate(t.medianSessionWordsPerHourNet)}`,
    t.maxIntervalRate ? `Intervallo con il ritmo più alto: versione ${t.maxIntervalRate.fromVersion} → ${t.maxIntervalRate.toVersion}, ${formatInt(t.maxIntervalRate.netWords)} parole nette in ${min(t.maxIntervalRate.elapsedMs)} (${formatInt(t.maxIntervalRate.wordsPerHourNet)} parole/ora)` : 'Nessun intervallo abbastanza lungo per un ritmo per intervallo.',
  ] });
  blocks.push({ type: 'paragraph', text: legend(['calendarSpan', 'daysWithVersions', 'observedTotal', 'estimatedActiveTotal', 'wordsPerHourNet', 'wordsPerHourAdded', 'medianSessionRate', 'maxIntervalRate']) });
  blocks.push({ type: 'heading', level: 3, text: 'Per sessione' });
  blocks.push({ type: 'paragraph', text: legend(['observedSpan', 'leadIn', 'estimatedActive', 'netWords', 'plusMinus', 'wordsPerHour']) });
  blocks.push({ type: 'table', header: ['#', 'Inizio', 'Fine', 'Versioni', 'Arco osservato', 'Avvio', 'Tempo stimato', 'Parole nette', '+ / −', 'Parole/ora'], rows: t.sessions.map((s) => [String(s.sessionIndex + 1), dt(s.startedAt), s.versionCount > 1 ? dt(s.endedAt) : '–', String(s.versionCount), s.versionCount > 1 ? min(s.observedSpanMs) : '0', min(s.leadInMs), min(s.estimatedActiveMs), `${s.netWords >= 0 ? '+' : ''}${formatInt(s.netWords)}${s.includesFirstVersionContent ? '' : ' *'}`, `+${formatInt(s.wordsAdded)} / −${formatInt(s.wordsDeleted)}`, rate(s.wordsPerHourNet)]) });
  blocks.push({ type: 'paragraph', text: '* Prima sessione: il contenuto della prima versione disponibile non è attribuito (scritto prima dell\'osservazione).' });
  blocks.push({ type: 'heading', level: 3, text: 'Per giornata' });
  blocks.push({ type: 'paragraph', text: legend(['day', 'daySessions', 'dayVersions', 'estimatedActive', 'netWords', 'plusMinus']) });
  blocks.push({ type: 'table', header: ['Giorno', 'Sessioni', 'Versioni', 'Tempo stimato', 'Parole nette', '+ / −', 'Autori'], rows: t.days.map((d) => [d.date, String(d.sessions), String(d.versions), min(d.estimatedActiveMs), `${d.netWords >= 0 ? '+' : ''}${formatInt(d.netWords)}`, `+${formatInt(d.wordsAdded)} / −${formatInt(d.wordsDeleted)}`, d.authorLabels.join(', ') || '–']) });
  blocks.push({ type: 'heading', level: 3, text: 'Avvertenze sulle stime di tempo' });
  blocks.push({ type: 'bullets', items: t.caveats });
  return blocks;
}

function contentBlocks(analysis: Analysis): Block[] {
  const c = analysis.content;
  const blocks: Block[] = [];
  const sess = (i: number): string => `S${i + 1}`;
  blocks.push({ type: 'heading', level: 2, text: 'Evoluzione dei contenuti per fase' });
  blocks.push({ type: 'paragraph', text: 'Le fasi coincidono con le sessioni. Per ogni fase: quali paragrafi del testo finale sono comparsi, quali sono stati rivisti, quali paragrafi sono stati eliminati senza ricomparire, e come sono cambiate le sezioni (parole prima → dopo). "Prima comparsa" è la versione in cui il paragrafo, o una sua variante precedente, appare per la prima volta.' });
  if (c.notes.length) blocks.push({ type: 'bullets', items: c.notes });
  if (c.basis === 'NONE') return blocks;
  blocks.push({ type: 'paragraph', text: legend(['phases', 'section', 'wordsBeforeAfter', 'sectionWordsAdded', 'sectionWordsDeleted', 'paragraphsPDM']) });
  for (const p of c.phases) {
    blocks.push({ type: 'paragraph', text: p.summary });
    const changed = p.sections.filter((x) => x.wordsAdded + x.wordsDeleted + x.paragraphsAdded + x.paragraphsDeleted + x.paragraphsModified > 0);
    if (c.hasSections && changed.length) blocks.push({ type: 'table', header: ['Sezione', 'Parole prima → dopo', '+ parole', '− parole', 'Par. +/−/mod'], rows: changed.map((x) => [x.section, `${formatInt(x.wordsBefore)} → ${formatInt(x.wordsAfter)}`, formatInt(x.wordsAdded), formatInt(x.wordsDeleted), `${x.paragraphsAdded}/${x.paragraphsDeleted}/${x.paragraphsModified}`]) });
  }
  if (c.hasSections) {
    blocks.push({ type: 'heading', level: 3, text: `Sezioni del testo finale (${c.sections.length})` });
    blocks.push({ type: 'paragraph', text: legend(['sectionFinalWords', 'sectionParagraphs', 'firstSeen', 'sessionsTouched', 'wordsByPhase']) });
    blocks.push({ type: 'table', header: ['Sezione', 'Parole finali', 'Paragrafi', 'Prima comparsa', 'Modificata nelle sessioni', 'Parole a fine sessione'], rows: c.sections.map((x) => [`${'  '.repeat(Math.max(0, x.level - 1))}${x.section}`, formatInt(x.finalWords), String(x.finalParagraphs), `v${x.firstSeenVersion} (${sess(x.firstSeenSession)})`, x.sessionsTouched.map(sess).join(', ') || '–', x.wordsByPhase.map((w) => `${sess(w.sessionIndex)}: ${formatInt(w.words)}`).join(' · ')]) });
  }
  blocks.push({ type: 'heading', level: 3, text: `Mappa del testo finale (${c.finalParagraphs.length} paragrafi)` });
  blocks.push({ type: 'paragraph', text: legend(['position', 'paragraphWords', 'firstSeen', 'lastChanged', 'variants', 'incipit']) });
  const rows = c.finalParagraphs.slice(0, MAX_PARAGRAPH_ROWS);
  blocks.push({ type: 'table', header: ['#', 'Sezione', 'Parole', 'Prima comparsa', 'Ultima modifica', 'Varianti', 'Incipit'], rows: rows.map((p) => [String(p.position + 1), p.section ?? '–', p.words === null ? '–' : String(p.words), `v${p.firstSeenVersion} (${sess(p.firstSeenSession)})`, p.lastChangedIndex === p.firstSeenIndex ? '=' : `v${p.lastChangedVersion} (${sess(p.lastChangedSession)})`, String(p.revisions), p.excerpt ? excerpt(p.excerpt, p.isHeading ? 80 : 90) : '–']) });
  if (c.finalParagraphs.length > MAX_PARAGRAPH_ROWS) blocks.push({ type: 'paragraph', text: `Riportati i primi ${MAX_PARAGRAPH_ROWS} paragrafi su ${c.finalParagraphs.length}.` });
  blocks.push({ type: 'heading', level: 3, text: `Contenuto eliminato e non ripreso (${c.abandoned.length})` });
  if (c.abandoned.length === 0) blocks.push({ type: 'paragraph', text: 'Nessun paragrafo eliminato definitivamente fra le versioni leggibili.' });
  else blocks.push({ type: 'paragraph', text: legend(['abandoned', 'removedIn', 'removedSession', 'presentSince']) }, { type: 'table', header: ['Rimosso in', 'Sessione', 'Sezione', 'Parole', 'Presente da', 'Estratto'], rows: c.abandoned.map((a) => [`v${a.removedVersion}`, sess(a.removedSession), a.section ?? '–', a.words === null ? '–' : String(a.words), `v${a.firstSeenVersion}`, a.excerpt ?? '–']) });
  return blocks;
}

// ---------------------------------------------------------------- Markdown

export function renderMarkdown(blocks: Block[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case 'heading':
        out.push(`${'#'.repeat(b.level)} ${b.text}`, '');
        break;
      case 'paragraph':
        out.push(b.text, '');
        break;
      case 'bullets':
        for (const i of b.items) out.push(`- ${i}`);
        out.push('');
        break;
      case 'quote':
        out.push(`> ${b.text.replace(/\n/g, '\n> ')}`, '');
        break;
      case 'code':
        out.push('```json', b.text, '```', '');
        break;
      case 'table': {
        const esc = (s: string): string => s.replace(/\|/g, '\\|');
        out.push(`| ${b.header.map(esc).join(' | ')} |`, `| ${b.header.map(() => '---').join(' | ')} |`);
        for (const r of b.rows) out.push(`| ${r.map(esc).join(' | ')} |`);
        out.push('');
        break;
      }
    }
  }
  return out.join('\n');
}

// ---------------------------------------------------------------- DOCX

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function xmlEsc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function run(text: string, mono = false): string {
  const rPr = mono ? '<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="16"/></w:rPr>' : '';
  return `<w:r>${rPr}<w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r>`;
}

function para(text: string, style?: string, mono = false): string {
  const pPr = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : '';
  return `<w:p>${pPr}${run(text, mono)}</w:p>`;
}

function table(header: string[], rows: string[][]): string {
  const cell = (t: string, bold: boolean): string => `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr><w:p><w:r>${bold ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${xmlEsc(t)}</w:t></w:r></w:p></w:tc>`;
  const tr = (cells: string[], bold: boolean): string => `<w:tr>${cells.map((c) => cell(c, bold)).join('')}</w:tr>`;
  return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr>${tr(header, true)}${rows.map((r) => tr(r, false)).join('')}</w:tbl><w:p/>`;
}

/** Minimal but valid WordprocessingML package: Word, Copilot and LibreOffice open it. */
export function renderDocx(blocks: Block[], title: string): Uint8Array {
  const body = blocks
    .map((b) => {
      switch (b.type) {
        case 'heading':
          return para(b.text, b.level === 1 ? 'Title' : `Heading${b.level - 1}`);
        case 'paragraph':
          return para(b.text);
        case 'bullets':
          return b.items.map((i) => para(i, 'ListBullet')).join('');
        case 'quote':
          return para(b.text, 'Quote');
        case 'code':
          return b.text.split('\n').map((l) => para(l, 'Code', true)).join('');
        case 'table':
          return table(b.header, b.rows);
      }
    })
    .join('');
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`;
  const style = (id: string, name: string, extra: string): string => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/>${extra}</w:style>`;
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>${style('Title', 'Title', '<w:rPr><w:b/><w:sz w:val="40"/></w:rPr>')}${style('Heading1', 'heading 1', '<w:pPr><w:outlineLvl w:val="0"/><w:spacing w:before="360"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr>')}${style('Heading2', 'heading 2', '<w:pPr><w:outlineLvl w:val="1"/><w:spacing w:before="240"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr>')}${style('ListBullet', 'List Bullet', '<w:pPr><w:ind w:left="360" w:hanging="200"/></w:pPr>')}${style('Quote', 'Quote', '<w:pPr><w:ind w:left="567"/></w:pPr><w:rPr><w:i/><w:color w:val="555555"/></w:rPr>')}${style('Code', 'Code', '<w:pPr><w:spacing w:after="0"/></w:pPr>')}<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/></w:style></w:styles>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xmlEsc(title)}</dc:title><dc:creator>Evidentia</dc:creator></cp:coreProperties>`;
  return zipSync({
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(rels),
    'word/_rels/document.xml.rels': strToU8(docRels),
    'word/document.xml': strToU8(documentXml),
    'word/styles.xml': strToU8(stylesXml),
    'docProps/core.xml': strToU8(core),
  });
}

export function buildLlmMarkdown(dataset: DocumentDataset, analysis: Analysis, generatedAt: string): string {
  return renderMarkdown(buildLlmDocumentBlocks(dataset, analysis, generatedAt));
}

export function buildLlmDocx(dataset: DocumentDataset, analysis: Analysis, generatedAt: string): Uint8Array {
  return renderDocx(buildLlmDocumentBlocks(dataset, analysis, generatedAt), `Evidentia — ${dataset.document.name}`);
}

export function llmFileBaseName(dataset: DocumentDataset, generatedAt: string): string {
  const title = (dataset.document.name || 'documento').replace(/\.[a-z0-9]+$/i, '').replace(/[^\w\-]+/g, '_').slice(0, 40);
  return `evidentia-analisi_${title}_${generatedAt.slice(0, 19).replace(/[:T]/g, '-')}`;
}

