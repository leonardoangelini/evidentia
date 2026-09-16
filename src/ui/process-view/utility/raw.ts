/** Dati grezzi: tutto ciò che è stato raccolto per il documento, senza interpretazioni. */
import type { Analysis } from '@/analysis';
import type { DocumentDataset } from '@/models';
import { h } from '@/ui/shared/dom';

export function renderRaw(ds: DocumentDataset, an: Analysis): HTMLElement {
  const el = h('section', {});
  el.appendChild(h('h2', {}, 'Dati grezzi'));
  el.appendChild(h('p', { class: 'muted' }, 'Tutto ciò che è stato raccolto per questo documento, senza interpretazioni. Lo stesso contenuto, completo, è nell\'export ZIP.'));
  const block = (title: string, value: unknown): void => {
    const details = h('details', {}, h('summary', {}, title));
    details.appendChild(h('pre', {}, JSON.stringify(value, null, 2)));
    el.appendChild(details);
  };
  block('document.json', ds.document);
  block(`events (${ds.events.length})`, ds.events);
  block(`versions (${ds.snapshots.length})`, ds.snapshots.map((s) => ({ ...s, text: s.text === null ? null : `${s.text.slice(0, 200)}… [${s.text.length} caratteri]` })));
  block(`diffs (${ds.diffs.length})`, ds.diffs);
  block('metrics', an.metrics);
  block('observation', an.observation);
  block('majorTransitions', an.majorTransitions);
  return el;
}
