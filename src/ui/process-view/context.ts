/**
 * Stato della Process View e le azioni che le sezioni possono chiedere alla
 * shell. Le sezioni leggono lo stato e chiamano le azioni; solo la shell lo
 * modifica e ridisegna.
 */
import type { Analysis } from '@/analysis';
import type { DemoCaseId } from '@/demo/cases';
import type { ImportProgress } from '@/import/version-importer';
import type { AnalyzedDocument, DocumentDataset, DocumentProvider, Settings } from '@/models';
import type { ViewId } from './tabs';

export interface State {
  documents: AnalyzedDocument[];
  documentId: string | null;
  dataset: DocumentDataset | null;
  analysis: Analysis | null;
  tab: ViewId;
  /** Versioni selezionate nella scheda Versioni (al massimo due). */
  selected: string[];
  settings: Settings;
  message: string;
  progress: ImportProgress | null;
  /** Server of the import in progress or just failed, for the error hint. */
  importProvider: DocumentProvider | null;
  /** Google import waiting for the optional host permission (needs a click). */
  pendingGoogleImport: { url: string; trigger: 'MANUAL' | 'REFRESH' } | null;
}

export type ExportKind = 'docx' | 'md' | 'zip';

export interface ViewContext {
  state: State;
  render(): void;
  setTab(view: ViewId): void;
  /** Imposta le versioni selezionate e, se richiesto, apre la scheda Versioni sul confronto. */
  select(ids: string[], goTo?: 'versioni'): void;
  runImport(url: string, trigger: 'MANUAL' | 'REFRESH'): Promise<void>;
  selectDocument(id: string): void;
  loadDemo(id: DemoCaseId): Promise<void>;
  doExport(kind: ExportKind): Promise<void>;
  deleteCurrent(): Promise<void>;
  deleteAll(): Promise<void>;
  saveSettings(next: Settings): Promise<void>;
  disconnectGoogle(): Promise<void>;
}
