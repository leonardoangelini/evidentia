/**
 * Demo datasets. Each case exercises a different version-history pattern.
 * Used by tests and by "Carica dati demo" in the Process View.
 */
import type { DocumentDataset } from '@/models';
import { VersionScenarioBuilder } from './scenario-builder';
import { TextGenerator } from './text-generator';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export type DemoCaseId = 'A' | 'B' | 'C' | 'D' | 'E';

export interface DemoCase {
  id: DemoCaseId;
  title: string;
  description: string;
  build: () => Promise<DocumentDataset>;
}

/** CASE A — progressive writing across several days, versions every few minutes. */
export async function buildCaseA(): Promise<DocumentDataset> {
  const gen = new TextGenerator(1);
  const s = new VersionScenarioBuilder({ documentId: 'demo-case-a', name: 'Saggio Pedagogia - Caso A.docx', start: '2026-09-08T09:00:00+02:00', created: '2026-09-08T08:58:00+02:00' });
  s.heading('Introduzione').append(gen.paragraphs(40)).save();
  for (let i = 0; i < 5; i++) s.advance(6 * MIN).append(gen.paragraphs(90)).save();
  s.advance(20 * HOUR);
  s.heading('Quadro teorico');
  for (let i = 0; i < 4; i++) s.advance(7 * MIN).append(gen.paragraphs(110)).save();
  s.advance(3 * MIN).rewriteParagraph(2, gen.paragraph(5)).save();
  s.advance(2 * DAY);
  s.heading('Conclusioni');
  for (let i = 0; i < 3; i++) s.advance(5 * MIN).append(gen.paragraphs(80)).save();
  s.advance(4 * MIN).deleteParagraphs(4, 1).save();
  return s.build();
}

/** CASE B — a large insertion between two consecutive versions. */
export async function buildCaseB(): Promise<DocumentDataset> {
  const gen = new TextGenerator(2);
  const s = new VersionScenarioBuilder({ documentId: 'demo-case-b', name: 'Saggio Pedagogia - Caso B.docx', start: '2026-09-11T15:00:00+02:00', created: '2026-09-11T14:59:00+02:00' });
  s.heading('Introduzione').append(gen.paragraphs(60)).save();
  for (let i = 0; i < 3; i++) s.advance(6 * MIN).append(gen.paragraphs(80)).save();
  s.advance(4 * MIN).heading('Analisi').append(gen.paragraphs(700)).save();
  s.heading('Conclusioni');
  for (let i = 0; i < 3; i++) s.advance(6 * MIN).append(gen.paragraphs(70)).save();
  s.advance(5 * MIN).rewriteParagraph(6, gen.paragraph(4)).save();
  return s.build();
}

/** CASE C — complete draft in one sitting, heavy revision two days later. */
export async function buildCaseC(): Promise<DocumentDataset> {
  const gen = new TextGenerator(3);
  const s = new VersionScenarioBuilder({ documentId: 'demo-case-c', name: 'Saggio Pedagogia - Caso C.docx', start: '2026-09-08T18:00:00+02:00', created: '2026-09-08T17:55:00+02:00' });
  s.heading('Introduzione').append(gen.paragraphs(150)).save();
  for (let i = 0; i < 5; i++) s.advance(8 * MIN).heading(i < 4 ? `Capitolo ${i + 1}` : 'Conclusioni').append(gen.paragraphs(150)).save();
  s.advance(2 * DAY);
  s.rewriteParagraph(1, gen.paragraph(6)).rewriteParagraph(2, gen.paragraph(5)).save();
  s.advance(6 * MIN).deleteParagraphs(4, 3).append(gen.paragraphs(60)).save();
  s.advance(7 * MIN).rewriteParagraph(5, gen.paragraph(7)).rewriteParagraph(7, gen.paragraph(4)).rewriteParagraph(8, gen.paragraph(5)).save();
  s.advance(5 * MIN).append(gen.paragraphs(40)).save('studente', true);
  return s.build();
}

/** CASE D — sparse history: first version already complete, long gaps, a second author. */
export async function buildCaseD(): Promise<DocumentDataset> {
  const gen = new TextGenerator(4);
  const s = new VersionScenarioBuilder({ documentId: 'demo-case-d', name: 'Saggio Pedagogia - Caso D.docx', start: '2026-09-09T10:00:00+02:00', created: '2026-09-09T09:59:30+02:00' });
  s.append(gen.paragraphs(1400)).save(); // uploaded already complete
  s.advance(3 * DAY).rewriteParagraph(1, gen.paragraph(5)).save('tutor');
  s.advance(26 * HOUR).append(gen.paragraphs(120)).save();
  s.advance(5 * MIN).rewriteParagraph(3, gen.paragraph(6)).save();
  return s.build();
}

/** CASE E — some versions exist on the server but cannot be downloaded. */
export async function buildCaseE(): Promise<DocumentDataset> {
  const gen = new TextGenerator(5);
  const s = new VersionScenarioBuilder({ documentId: 'demo-case-e', name: 'Saggio Pedagogia - Caso E.docx', start: '2026-09-12T08:30:00+02:00', created: '2026-09-12T08:29:00+02:00' });
  s.append(gen.paragraphs(120)).save();
  s.advance(6 * MIN).append(gen.paragraphs(150)).saveUnavailable('HTTP 403: Accesso negato alla versione');
  s.advance(6 * MIN).append(gen.paragraphs(150)).saveUnavailable('HTTP 403: Accesso negato alla versione');
  s.advance(6 * MIN).append(gen.paragraphs(120)).save();
  s.advance(9 * MIN).append(gen.paragraphs(90)).save();
  return s.build();
}

export const DEMO_CASES: DemoCase[] = [
  { id: 'A', title: 'Caso A — scrittura progressiva in più giornate', description: 'Versioni frequenti su tre giornate, crescita graduale, piccole revisioni.', build: buildCaseA },
  { id: 'B', title: 'Caso B — grande inserimento fra due versioni', description: 'Circa 700 parole in più fra due versioni a 4 minuti di distanza.', build: buildCaseB },
  { id: 'C', title: 'Caso C — bozza completa + revisione importante', description: 'Bozza in una seduta, riscrittura estesa due giorni dopo.', build: buildCaseC },
  { id: 'D', title: 'Caso D — cronologia scarsa e prima versione già completa', description: 'Documento caricato già scritto, intervalli di giorni, un secondo autore.', build: buildCaseD },
  { id: 'E', title: 'Caso E — versioni non scaricabili', description: 'Due versioni esistono ma il download fallisce: gap dichiarati.', build: buildCaseE },
];
