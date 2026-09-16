/**
 * Copertura: dove la cronologia è muta, chi ha salvato, e l'integrità del
 * log di analisi. È la scheda che impedisce di scambiare l'assenza di dati
 * per assenza di lavoro.
 */
import type { Analysis } from '@/analysis';
import { sourceLabel, type DocumentDataset } from '@/models';
import { badge, h } from '@/ui/shared/dom';
import { formatDateTime, formatDuration } from '@/utils/time';
import { info, kv } from '../widgets';

export function renderCopertura(ds: DocumentDataset, an: Analysis): HTMLElement {
  const o = an.observation;
  const el = h('section', {});
  el.appendChild(h('h2', {}, 'Copertura dell\'osservazione'));
  el.appendChild(
    h(
      'table',
      { class: 'kv' },
      kv('source', `${sourceLabel(ds.document)}: ${o.versionsOnServer} versioni sul server, ${o.versionsStored} lette, ${o.versionsReadable} con testo`),
      kv('firstLast', `${o.firstVersionAt ? formatDateTime(o.firstVersionAt) : '–'} / ${o.lastVersionAt ? formatDateTime(o.lastVersionAt) : '–'}`),
      kv('lastAnalyzed', o.lastAnalyzedAt ? formatDateTime(o.lastAnalyzedAt) : '–'),
      kv('authors', ds.document.authors.length ? ds.document.authors.map((a) => `${a.label}${a.displayName ? ` (${a.displayName})` : ''}: ${a.versions} versioni`).join(' · ') : '–'),
    ),
  );

  el.appendChild(h('h3', {}, `Gap noti (${o.knownGaps.length})`, info('gaps')));
  if (o.knownGaps.length === 0) el.appendChild(h('p', { class: 'muted' }, 'Nessun gap rilevato.'));
  for (const g of o.knownGaps) el.appendChild(h('div', { class: 'gap' }, h('strong', {}, g.type), ' · ', h('span', { class: 'mono' }, `${formatDateTime(g.from)}${g.to ? ` → ${formatDateTime(g.to)}` : ''}${g.durationMs !== null ? ` (${formatDuration(g.durationMs)})` : ''}`), h('div', {}, g.description), g.evidence ? h('div', { class: 'muted mono small' }, JSON.stringify(g.evidence)) : null));

  el.appendChild(h('h3', {}, `Versioni non leggibili (${o.extractionFailures.length})`, info('extractionFailures')));
  if (o.extractionFailures.length === 0) el.appendChild(h('p', { class: 'muted' }, 'Tutte le versioni sono state lette.'));
  else el.appendChild(h('ul', {}, ...o.extractionFailures.map((f) => h('li', { class: 'mono' }, `${formatDateTime(f.at)} — versione ${f.versionLabel}: ${f.reason}`))));

  el.appendChild(h('h3', {}, `Avvisi (${o.continuityWarnings.length})`, info('warnings')));
  if (o.continuityWarnings.length === 0) el.appendChild(h('p', { class: 'muted' }, 'Nessuno.'));
  else el.appendChild(h('ul', {}, ...o.continuityWarnings.map((w) => h('li', { class: 'mono' }, `${formatDateTime(w.at)} — ${w.type}: ${w.description}`))));

  el.appendChild(h('h3', {}, 'Limiti strutturali', info('limitations')));
  el.appendChild(h('ul', {}, ...o.limitations.map((l) => h('li', { class: 'muted' }, l))));

  el.appendChild(h('h3', {}, 'Integrità', info('chain')));
  el.appendChild(h('p', {}, an.chain.valid ? badge(`hash chain valida (${an.chain.checked} eventi)`, 'ok') : badge(`hash chain NON valida dall'evento ${an.chain.firstBrokenSeq}`, 'danger'), ' ', h('span', { class: 'muted' }, 'Rileva alterazioni accidentali; non è una protezione forense.')));
  return el;
}
