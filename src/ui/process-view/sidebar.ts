/**
 * Barra laterale: i documenti analizzati, le azioni sul documento corrente e,
 * in fondo, i casi demo e le viste di servizio.
 */
import { DEMO_CASES } from '@/demo/cases';
import { documentProvider } from '@/models';
import { clear, h } from '@/ui/shared/dom';
import { logoMark } from '@/ui/shared/logo';
import { formatDateTime } from '@/utils/time';
import { getVersionLabel } from '@/utils/version';
import type { ViewContext } from './context';
import { UTILITIES } from './tabs';

export function renderSidebar(ctx: ViewContext, el: HTMLElement): void {
  const { state } = ctx;
  clear(el);
  el.appendChild(h('button', { class: 'brand', type: 'button', title: 'Panoramica', onclick: () => ctx.setTab('panoramica') }, logoMark(20), 'EVIDENTIA'));
  el.appendChild(h('div', { class: 'muted small' }, 'Process View · cronologia versioni'));

  el.appendChild(h('h3', {}, 'Documenti analizzati'));
  if (state.documents.length === 0) el.appendChild(h('p', { class: 'muted small' }, 'Nessun documento analizzato.'));
  for (const d of state.documents) {
    el.appendChild(h('button', { class: `doc ${d.id === state.documentId ? 'active' : ''}`, onclick: () => ctx.selectDocument(d.id) }, h('div', { class: 'title' }, d.name || '(senza nome)'), h('div', { class: 'muted small' }, `${formatDateTime(d.lastAnalyzedAt)} · ${d.privacyMode} · ${documentProvider(d) === 'GOOGLE_DOCS' ? 'Google Docs' : 'SharePoint'}`)));
  }

  if (state.documentId && state.dataset) {
    const doc = state.dataset.document;
    if (doc.webUrl && !doc.id.startsWith('demo-')) {
      el.appendChild(h('h3', {}, 'Azioni'));
      el.appendChild(h('button', { class: 'full', disabled: state.progress !== null, onclick: () => void ctx.runImport(doc.webUrl ?? '', 'REFRESH') }, 'Aggiorna dalle versioni sul server'));
    }
    el.appendChild(h('h3', {}, 'Esporta'));
    // Pulsanti fissi e non un menu: ogni export ridisegna la barra due volte
    // (messaggio di avvio e di fine) e un menu si chiuderebbe a metà.
    el.appendChild(
      h(
        'div',
        { class: 'export-links' },
        h('button', { class: 'primary', title: 'Un solo file Word con istruzioni, dati e testo, da caricare in Copilot, ChatGPT o Claude', onclick: () => void ctx.doExport('docx') }, 'Copilot / LLM (.docx)'),
        h('button', { title: 'Stesso contenuto in Markdown', onclick: () => void ctx.doExport('md') }, '.md'),
        h('button', { title: 'Dataset completo: versioni, diff, metriche, report HTML', onclick: () => void ctx.doExport('zip') }, 'ZIP completo'),
      ),
    );
    el.appendChild(h('button', { class: 'link danger', type: 'button', onclick: () => void ctx.deleteCurrent() }, 'Elimina questo documento'));
  }

  const footer = h('div', { class: 'sidebar-footer' });
  if (state.documents.length > 0) {
    footer.appendChild(
      h(
        'details',
        { class: 'demo' },
        h('summary', {}, 'Carica un caso demo…'),
        h('p', { class: 'muted small' }, 'Cronologie simulate per esplorare l\'interfaccia e l\'export.'),
        ...DEMO_CASES.map((c) => h('button', { class: 'full small', title: c.description, onclick: () => void ctx.loadDemo(c.id) }, c.title)),
      ),
    );
  }
  footer.appendChild(h('div', { class: 'links' }, ...UTILITIES.map(([id, label]) => h('button', { class: `link ${state.tab === id ? 'active' : ''}`, type: 'button', onclick: () => ctx.setTab(id) }, label))));
  // La version non è un comando, è l'etichetta di ciò che è installato. Porta alla scheda Info.
  footer.appendChild(h('button', { class: 'version', type: 'button', title: 'Versione installata · apri la scheda Info', onclick: () => ctx.setTab('about') }, `v${getVersionLabel()}`));
  el.appendChild(footer);
}
