import { buildExportZip, exportFileName } from '@/export/exporter';
import { analyzeDataset } from '@/analysis';
import { buildLlmDocx, buildLlmMarkdown, llmFileBaseName } from '@/export/llm-document';
import { nowIso } from '@/utils/time';
import { loadSettings } from '@/storage/settings-store';
import { loadDataset } from '@/storage/repositories';
import { getExtensionVersion } from '@/utils/version';

export function downloadBytes(bytes: Uint8Array, filename: string, type = 'application/zip'): void {
  const blob = new Blob([bytes as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Build the ZIP for a document and trigger a local download. */
export async function exportDocument(documentId: string): Promise<string> {
  const dataset = await loadDataset(documentId);
  if (!dataset) throw new Error('Documento non trovato');
  const settings = await loadSettings();
  const { zip, result } = await buildExportZip(dataset, settings, getExtensionVersion());
  const name = exportFileName(dataset, result.generatedAt);
  downloadBytes(zip, name);
  return name;
}

/** Download the single-file LLM input (.docx for Copilot/ChatGPT/Claude uploads, or .md). */
export async function exportLlmDocument(documentId: string, format: 'docx' | 'md'): Promise<string> {
  const dataset = await loadDataset(documentId);
  if (!dataset) throw new Error('Documento non trovato');
  const settings = await loadSettings();
  const analysis = await analyzeDataset(dataset, settings);
  const generatedAt = nowIso();
  const base = llmFileBaseName(dataset, generatedAt);
  if (format === 'docx') {
    const name = `${base}.docx`;
    downloadBytes(buildLlmDocx(dataset, analysis, generatedAt), name, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    return name;
  }
  const name = `${base}.md`;
  downloadBytes(new TextEncoder().encode(buildLlmMarkdown(dataset, analysis, generatedAt)), name, 'text/markdown');
  return name;
}
