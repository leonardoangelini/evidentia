/** Renders a readable comparison of two snapshots. */
import { diffArrays } from 'diff';
import type { Snapshot } from '@/models';
import { computeDiff } from '@/analysis/diff-engine';
import { splitParagraphs, tokenizeWords } from '@/utils/text';
import { formatDuration } from '@/utils/time';
import { badge, h } from '@/ui/shared/dom';

export function renderSnapshotComparison(a: Snapshot, b: Snapshot): HTMLElement {
  const [from, to] = a.index <= b.index ? [a, b] : [b, a];
  const d = computeDiff(from, to);
  const container = h('div', {});
  container.appendChild(
    h(
      'div',
      { class: 'cards' },
      card('Classificazione', d.classification),
      card('Versioni', `${from.versionLabel} → ${to.versionLabel}`),
      card('Intervallo', formatDuration(d.elapsedMs)),
      card('Parole', `${from.wordCount} → ${to.wordCount} (${d.wordCountDelta >= 0 ? '+' : ''}${d.wordCountDelta})`),
      card('+ parole / − parole', `${d.wordsAdded} / ${d.wordsDeleted}`),
      card('Sostituite', String(d.wordsReplaced)),
      card('Paragrafi +/−/mod', `${d.paragraphsAdded} / ${d.paragraphsDeleted} / ${d.paragraphsModified}`),
      card('Base del confronto', d.basis),
    ),
  );
  if (d.basis !== 'TEXT') {
    container.appendChild(h('p', { class: 'muted' }, d.basis === 'PARAGRAPH_HASHES' ? 'Testo non disponibile (METRICS_ONLY): confronto a livello di paragrafo tramite hash.' : 'Una delle due versioni non è stata letta: solo i conteggi sono confrontabili.'));
    return container;
  }
  const fromParas = splitParagraphs(from.text as string);
  const toParas = splitParagraphs(to.text as string);
  const changes = diffArrays(fromParas, toParas);
  const body = h('div', { class: 'mono', style: 'font-size:13px;line-height:1.5' });
  let pendingRemoved: string[] = [];
  const flush = (): void => {
    for (const p of pendingRemoved) body.appendChild(h('div', { class: 'diffpara removed' }, h('del', {}, p)));
    pendingRemoved = [];
  };
  for (const c of changes) {
    const items = c.value as string[];
    if (c.removed) {
      flush();
      pendingRemoved = items;
    } else if (c.added) {
      const pairs = Math.min(pendingRemoved.length, items.length);
      for (let i = 0; i < pairs; i++) body.appendChild(h('div', { class: 'diffpara modified' }, ...wordLevel(pendingRemoved[i] as string, items[i] as string)));
      for (const p of pendingRemoved.slice(pairs)) body.appendChild(h('div', { class: 'diffpara removed' }, h('del', {}, p)));
      for (const p of items.slice(pairs)) body.appendChild(h('div', { class: 'diffpara added' }, h('ins', {}, p)));
      pendingRemoved = [];
    } else {
      flush();
      if (items.length > 3) {
        body.appendChild(h('div', { class: 'diffpara' }, items[0] as string));
        body.appendChild(h('div', { class: 'diffpara muted' }, `… ${items.length - 2} paragrafi invariati …`));
        body.appendChild(h('div', { class: 'diffpara' }, items[items.length - 1] as string));
      } else for (const p of items) body.appendChild(h('div', { class: 'diffpara' }, p));
    }
  }
  flush();
  container.appendChild(h('div', { class: 'legend', style: 'margin:8px 0' }, h('span', {}, h('ins', {}, 'aggiunto')), h('span', {}, h('del', {}, 'eliminato')), badge('paragrafo modificato', 'warn')));
  container.appendChild(body);
  return container;
}

function wordLevel(before: string, after: string): Node[] {
  const out: Node[] = [];
  for (const c of diffArrays(tokenizeWords(before), tokenizeWords(after))) {
    const text = (c.value as string[]).join(' ') + ' ';
    if (c.added) out.push(h('ins', {}, text));
    else if (c.removed) out.push(h('del', {}, text));
    else out.push(document.createTextNode(text));
  }
  return out;
}

function card(k: string, v: string): HTMLElement {
  return h('div', { class: 'card' }, h('div', { class: 'v', style: 'font-size:15px' }, v), h('div', { class: 'k' }, k));
}
