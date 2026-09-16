/** Pagina senza documenti: come si avvia un'analisi, oppure un caso demo. */
import { DEMO_CASES } from '@/demo/cases';
import { h } from '@/ui/shared/dom';
import type { ViewContext } from './context';

export function renderEmptyState(ctx: ViewContext): HTMLElement {
  return h(
    'section',
    { class: 'empty-state' },
    h('h1', {}, 'Nessun documento analizzato'),
    h('p', {}, 'Apri un documento Word su SharePoint/OneDrive o un documento Google Docs e avvia l\'analisi dal popup dell\'estensione. La cronologia delle versioni viene letta in sola lettura e resta in questo browser.'),
    h('h2', {}, 'Oppure esplora un caso demo'),
    h('p', { class: 'muted' }, 'Cronologie simulate per esplorare l\'interfaccia e l\'export: nessun documento reale.'),
    h('div', { class: 'demo-grid' }, ...DEMO_CASES.map((c) => h('button', { class: 'demo-card', type: 'button', onclick: () => void ctx.loadDemo(c.id) }, h('strong', {}, c.title), h('div', { class: 'muted small' }, c.description)))),
  );
}
