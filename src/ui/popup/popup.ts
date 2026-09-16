import { parseDocumentLocator, type DocumentLocator } from '@/import/document-locator';
import { documentRepository } from '@/storage/repositories';
import { formatDateTime } from '@/utils/time';
import { clear, h } from '@/ui/shared/dom';
import { exportDocument, exportLlmDocument } from '@/ui/shared/export-action';
import { logoMark } from '@/ui/shared/logo';
import { getVersionLabel } from '@/utils/version';

async function activeTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

const openPage = (path: string): void => {
  void chrome.tabs.create({ url: chrome.runtime.getURL('/' + path) });
};

export function mountPopup(root: HTMLElement): void {
  let message = '';
  let busy = false;

  const render = async (): Promise<void> => {
    clear(root);
    root.appendChild(h('div', { class: 'brand' }, h('span', { class: 'logo' }, logoMark(18), 'EVIDENTIA'), h('span', { class: 'muted small' }, 'learning process evidence')));
    const tab = await activeTab();
    const locator: DocumentLocator | null = tab?.url ? parseDocumentLocator(tab.url) : null;
    if (!locator) {
      root.appendChild(h('p', { class: 'empty' }, 'Apri un documento Word su SharePoint o OneDrive (account di lavoro o scuola), oppure un documento Google Docs.'));
      root.appendChild(h('p', { class: 'muted small', style: 'text-align:center' }, 'Evidentia legge la cronologia delle versioni del documento aperto nella tab corrente, in sola lettura: con la tua sessione Microsoft 365 per SharePoint/OneDrive, con la tua autorizzazione Google per Google Docs.'));
      root.appendChild(footer());
      return;
    }
    const existing = await documentRepository.get(locator.fileId);
    root.appendChild(h('div', { class: 'section' }, h('div', { class: 'k' }, 'Documento'), h('div', { class: 'v' }, existing?.name || locator.fileName || tab?.title || locator.fileId), h('div', { class: 'muted small' }, locator.provider === 'GOOGLE_DOCS' ? 'Google Docs · revisioni di Google Drive' : 'Word · cronologia versioni SharePoint/OneDrive')));
    root.appendChild(
      h(
        'div',
        { class: 'section' },
        h('div', { class: 'k' }, 'Analisi'),
        existing
          ? h('div', { class: 'v status on' }, h('span', { class: 'dot' }), `Ultima analisi ${formatDateTime(existing.lastAnalyzedAt)}`)
          : h('div', { class: 'v status off' }, h('span', { class: 'dot' }), 'Mai analizzato'),
        existing ? h('div', { class: 'muted small' }, `Modalità ${existing.privacyMode} · versione corrente ${existing.currentVersionLabel ?? '–'}`) : null,
      ),
    );
    const actions = h('div', { class: 'actions' });
    actions.appendChild(
      h('button', { class: 'primary', disabled: busy, onclick: () => openPage(`process-view.html?import=${encodeURIComponent(tab?.url ?? '')}`) }, existing ? 'Aggiorna analisi delle versioni' : 'Analizza cronologia versioni'),
    );
    if (existing) {
      actions.appendChild(h('button', { onclick: () => openPage(`process-view.html?doc=${existing.id}`) }, 'Apri l\'analisi'));
      actions.appendChild(h('button', { disabled: busy, onclick: () => void doExport(() => exportLlmDocument(existing.id, 'docx')) }, 'Esporta per Copilot / LLM (.docx)'));
      actions.appendChild(h('button', { disabled: busy, onclick: () => void doExport(() => exportDocument(existing.id)) }, 'Export ZIP completo'));
    }
    root.appendChild(actions);
    if (message) root.appendChild(h('div', { class: 'muted small' }, message));
    root.appendChild(footer());
  };

  const footer = (): HTMLElement =>
    h(
      'div',
      { class: 'footer' },
      h('a', { href: '#', onclick: (e: Event) => { e.preventDefault(); openPage('process-view.html#settings'); } }, 'Impostazioni'),
      ' · ',
      h('a', { href: '#', onclick: (e: Event) => { e.preventDefault(); openPage('process-view.html'); } }, 'Tutti i documenti'),
      // La version porta alla scheda Info: novità, licenza, contatti.
      h('a', { class: 'version', href: '#', title: 'Versione installata · novità e informazioni', onclick: (e: Event) => { e.preventDefault(); openPage('process-view.html#about'); } }, `v${getVersionLabel()}`),
    );

  const doExport = async (run: () => Promise<string>): Promise<void> => {
    busy = true;
    message = 'Preparazione export…';
    await render();
    try {
      message = `Esportato: ${await run()}`;
    } catch (e) {
      message = `Errore export: ${String(e)}`;
    }
    busy = false;
    await render();
  };

  void render();
}
