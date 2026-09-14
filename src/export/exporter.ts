/**
 * Builds the export ZIP entirely client-side (fflate).
 */
import { strToU8, zipSync } from 'fflate';
import { analyzeDataset, type Analysis } from '@/analysis';
import { documentProvider, providerName, sourceIdOf, sourceLabel, type DocumentDataset, type Settings } from '@/models';
import { nowIso } from '@/utils/time';
import { buildAnalysisPrompt, buildCompactLlmInput, buildLlmInput } from './llm-exporter';
import { buildHtmlReport } from './html-report';
import { buildLlmDocx, buildLlmMarkdown } from './llm-document';
import { GLOSSARY } from '@/analysis/glossary';

export interface ExportFiles {
  [path: string]: string | Uint8Array;
}

export interface ExportResult {
  files: ExportFiles;
  analysis: Analysis;
  generatedAt: string;
}

export async function buildExportFiles(dataset: DocumentDataset, settings: Settings, extensionVersion: string): Promise<ExportResult> {
  const generatedAt = nowIso();
  const analysis = await analyzeDataset(dataset, settings);
  const events = [...dataset.events].sort((a, b) => a.seq - b.seq);
  const snapshots = [...dataset.snapshots].sort((a, b) => a.index - b.index);
  const finalSnapshot = snapshots.filter((s) => s.extractionStatus !== 'UNAVAILABLE').at(-1) ?? null;
  const finalText =
    dataset.document.privacyMode === 'METRICS_ONLY'
      ? '[Testo non disponibile: modalità METRICS_ONLY]'
      : finalSnapshot?.text ?? '[Testo non disponibile: nessuna versione leggibile]';

  const files: ExportFiles = {
    'document.json': json(dataset.document),
    'sessions.json': json(analysis.sessions),
    'events.jsonl': events.map((e) => JSON.stringify(e)).join('\n') + (events.length ? '\n' : ''),
    'versions.json': json(snapshots),
    'diffs.json': json([...dataset.diffs].sort((a, b) => a.toIndex - b.toIndex)),
    'metrics.json': json(analysis.metrics),
    'timeline.json': json(analysis.timeline),
    'observation.json': json(analysis.observation),
    'time-estimates.json': json(analysis.time),
    'content-evolution.json': json(analysis.content),
    'glossary.json': json(GLOSSARY),
    'final.txt': finalText,
    'llm/analysis-input.json': json(buildLlmInput(dataset, analysis, generatedAt)),
    'llm/analysis-input-compact.json': json(buildCompactLlmInput(dataset, analysis, generatedAt)),
    'llm/analysis-prompt.md': buildAnalysisPrompt(dataset),
    'llm/analysis-for-llm.md': buildLlmMarkdown(dataset, analysis, generatedAt),
    'llm/analysis-for-llm.docx': buildLlmDocx(dataset, analysis, generatedAt),
    'report/process-report.html': buildHtmlReport(dataset, analysis, generatedAt),
    'README.txt': readme(dataset, analysis, generatedAt),
  };
  files['manifest.json'] = json({
    product: 'Evidentia',
    exportVersion: '1.0',
    exportedAt: generatedAt,
    extensionVersion,
    documentId: dataset.document.id,
    documentName: dataset.document.name,
    source: sourceIdOf(documentProvider(dataset.document)),
    privacyMode: dataset.document.privacyMode,
    counts: { events: events.length, versions: snapshots.length, diffs: dataset.diffs.length, sessions: analysis.sessions.length },
    integrity: { eventChainValid: analysis.chain.valid, eventsChecked: analysis.chain.checked, lastEventHash: events.at(-1)?.hash ?? null },
    files: [...Object.keys(files), 'manifest.json'].sort(),
    disclaimer: `Derived from ${providerName(documentProvider(dataset.document))} version history. Not an AI detector. Cannot establish authorship.`,
  });
  return { files, analysis, generatedAt };
}

export function zipFiles(files: ExportFiles): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [path, content] of Object.entries(files)) entries[path] = typeof content === 'string' ? strToU8(content) : content;
  return zipSync(entries, { level: 6 });
}

export async function buildExportZip(dataset: DocumentDataset, settings: Settings, extensionVersion: string): Promise<{ zip: Uint8Array; result: ExportResult }> {
  const result = await buildExportFiles(dataset, settings, extensionVersion);
  return { zip: zipFiles(result.files), result };
}

export function exportFileName(dataset: DocumentDataset, generatedAt: string): string {
  const title = (dataset.document.name || 'documento').replace(/\.[a-z0-9]+$/i, '').replace(/[^\w\-]+/g, '_').slice(0, 40);
  const stamp = generatedAt.slice(0, 19).replace(/[:T]/g, '-');
  return `evidentia-export_${title}_${stamp}.zip`;
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2) + '\n';
}

function readme(dataset: DocumentDataset, analysis: Analysis, generatedAt: string): string {
  return `EVIDENTIA — EXPORT DEL PROCESSO DI SCRITTURA
=============================================

Documento : ${dataset.document.name}
Fonte     : ${sourceLabel(dataset.document)} (${dataset.document.host})
Esportato : ${generatedAt}
Modalità  : ${dataset.document.privacyMode}
Versioni  : ${dataset.snapshots.length}   Sessioni: ${analysis.sessions.length}   Eventi di analisi: ${dataset.events.length}
Hash chain: ${analysis.chain.valid ? 'valida' : 'NON valida'}

Evidentia non dimostra chi abbia scritto un testo e non dimostra l'uso di AI.
Rende osservabile una parte del processo con cui il testo è stato prodotto,
attraverso le versioni conservate dal server. Questo export descrive versioni
e differenze; non contiene punteggi di sospetto.

CONTENUTO
---------
manifest.json                 indice dei file, conteggi, integrità
document.json                 metadati del documento e autori (etichette pseudonime)
versions.json                 versioni lette (testo solo in modalità FULL)
diffs.json                    differenze fra versioni consecutive
sessions.json                 gruppi di versioni vicine nel tempo
events.jsonl                  log delle operazioni di analisi, con hash chain SHA-256
metrics.json                  metriche deterministiche
timeline.json                 timeline normalizzata
observation.json              copertura dell'osservazione: gap, versioni non leggibili, limiti
time-estimates.json           tempo osservato/stimato per sessione e giornata, parole per ora (stime)
content-evolution.json        sezioni e paragrafi per fase, provenienza dei paragrafi finali, testo eliminato
glossary.json                 definizione di ogni valore (significato, metodo, lettura; osservato/derivato/stima)
final.txt                     testo della versione corrente
llm/analysis-input.json       input completo per un LLM
llm/analysis-input-compact.json  input ridotto (meno token)
llm/analysis-prompt.md        prompt da usare insieme al JSON
llm/analysis-for-llm.docx     UN SOLO FILE con istruzioni, dati e testo: caricalo in Copilot/ChatGPT/Claude
llm/analysis-for-llm.md       lo stesso contenuto in Markdown
report/process-report.html    report leggibile in qualsiasi browser, senza server

COME USARE L'INPUT PER UN LLM
-----------------------------
Modo più semplice (Microsoft 365 Copilot, ChatGPT, Claude): carica il singolo file
llm/analysis-for-llm.docx e scrivi "Segui le istruzioni contenute nel documento".
Contiene già prompt, dati osservati, limiti e testo della versione corrente.

Modo dettagliato: copia il prompt da llm/analysis-prompt.md e allega
llm/analysis-input-compact.json (o analysis-input.json per il dettaglio completo).
Chiedi una descrizione del processo, non un giudizio sull'origine del testo.

INTEGRITÀ
---------
Ogni evento contiene previousHash e hash (SHA-256 del contenuto canonico).
La catena rileva modifiche accidentali dei file esportati. Non è una prova forense:
chi controlla il browser può alterare i dati prima dell'export.
`;
}
