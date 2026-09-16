/**
 * Process View: la shell che tiene lo stato, parla con storage e import, e
 * disegna barra laterale, barra delle schede e la vista corrente. Le viste
 * sono in `sections/` (analisi) e `utility/` (servizio).
 */
import { analyzeDataset } from '@/analysis';
import { DEMO_CASES, type DemoCaseId } from '@/demo/cases';
import type { Settings } from '@/models';
import { importVersionHistory } from '@/import/version-importer';
import { parseDocumentLocator, providerHint } from '@/import/document-locator';
import { signOutGoogle } from '@/google/google-auth';
import { hasGooglePermission, removeGooglePermission, requestGooglePermission } from '@/google/permissions';
import { documentRepository, importDataset, loadDataset } from '@/storage/repositories';
import { loadSettings, saveSettings } from '@/storage/settings-store';
import { getExtensionVersion } from '@/utils/version';
import { clear, h } from '@/ui/shared/dom';
import { exportDocument, exportLlmDocument } from '@/ui/shared/export-action';
import type { ExportKind, State, ViewContext } from './context';
import { renderEmptyState } from './empty-state';
import { renderSidebar } from './sidebar';
import { isTab, parseHash, renderTabBar, type TabId, type UtilityId, type ViewId } from './tabs';
import { renderContenuti } from './sections/contenuti';
import { renderCopertura } from './sections/copertura';
import { renderCronologia } from './sections/cronologia';
import { renderPanoramica } from './sections/panoramica';
import { renderVersioni } from './sections/versioni';
import { renderAbout } from './utility/about';
import { renderGlossary } from './utility/glossary';
import { renderRaw } from './utility/raw';
import { renderSettings } from './utility/settings';

export function mountProcessView(root: HTMLElement): void {
  const params = new URLSearchParams(location.search);
  const initialTab = parseHash(location.hash);
  const state: State = {
    documents: [],
    documentId: params.get('doc'),
    dataset: null,
    analysis: null,
    tab: initialTab,
    selected: [],
    settings: null as unknown as Settings,
    message: '',
    progress: null,
    importProvider: null,
    pendingGoogleImport: null,
  };
  // Un vecchio hash (#timeline, #gaps…) viene riscritto con la scheda che lo ha assorbito.
  if (location.hash && location.hash !== `#${initialTab}`) history.replaceState(null, '', `${location.search}#${initialTab}`);

  const sidebar = h('aside', { class: 'sidebar' });
  const main = h('main', { class: 'main' });
  root.append(sidebar, main);

  async function load(): Promise<void> {
    state.settings = await loadSettings();
    state.documents = await documentRepository.list();
    if (!state.documentId && state.documents[0]) state.documentId = state.documents[0].id;
    if (state.documentId) {
      state.dataset = await loadDataset(state.documentId);
      state.analysis = state.dataset ? await analyzeDataset(state.dataset, state.settings) : null;
    } else {
      state.dataset = null;
      state.analysis = null;
    }
    render();
  }

  async function runImport(url: string, trigger: 'MANUAL' | 'REFRESH'): Promise<void> {
    const locator = parseDocumentLocator(url);
    if (!locator) {
      state.message = 'URL non riconosciuto come documento SharePoint/OneDrive o Google Docs.';
      return render();
    }
    state.settings = await loadSettings();
    state.importProvider = locator.provider;
    state.pendingGoogleImport = null;
    if (locator.provider === 'GOOGLE_DOCS' && !(await hasGooglePermission())) {
      // Optional host permission: Chrome only grants it from a click, so ask and resume from the button.
      state.pendingGoogleImport = { url, trigger };
      state.progress = null;
      state.message = '';
      return render();
    }
    state.progress = { phase: 'INFO', current: 0, total: 0, message: 'Avvio…' };
    state.message = '';
    render();
    try {
      const result = await importVersionHistory({ locator, settings: state.settings, extensionVersion: getExtensionVersion(), trigger, onProgress: (p) => { state.progress = p; renderProgress(); } });
      state.progress = null;
      state.message = `Analisi completata: ${result.totalVersions} versioni (${result.fetched} scaricate, ${result.skipped} già presenti, ${result.failed} non leggibili).`;
      state.documentId = result.documentId;
      history.replaceState(null, '', `?doc=${encodeURIComponent(result.documentId)}#${state.tab}`);
    } catch (e) {
      state.progress = { phase: 'ERROR', current: 0, total: 0, message: e instanceof Error ? e.message : String(e) };
    }
    await load();
  }

  function selectDocument(id: string): void {
    state.documentId = id;
    state.selected = [];
    if (!isTab(state.tab)) state.tab = 'panoramica';
    history.replaceState(null, '', `?doc=${encodeURIComponent(id)}#${state.tab}`);
    void load();
  }

  function setTab(tab: ViewId): void {
    state.tab = tab;
    history.replaceState(null, '', `${location.search}#${tab}`);
    render();
    window.scrollTo(0, 0);
  }

  function select(ids: string[], goTo?: 'versioni'): void {
    state.selected = ids.slice(-2);
    if (goTo) setTab(goTo);
    else render();
  }

  const progressBox = h('div', { class: 'notice progress' });
  function renderProgress(): void {
    clear(progressBox);
    const p = state.progress;
    if (!p) return;
    const pct = p.total > 0 ? Math.round((p.current / p.total) * 100) : 0;
    progressBox.append(
      h('strong', {}, p.phase === 'ERROR' ? 'Errore durante l\'analisi' : 'Analisi della cronologia versioni in corso'),
      h('div', {}, p.message),
    );
    if (p.phase !== 'ERROR' && p.total > 0) progressBox.append(h('div', { class: 'bar' }, h('div', { class: 'fill', style: `width:${pct}%` })));
    if (p.phase === 'ERROR') progressBox.append(h('div', { class: 'muted small' }, providerHint(state.importProvider ?? 'SHAREPOINT')));
  }

  /** Shown when a Google document was requested and the Google hosts are not yet permitted. */
  function renderGooglePermissionRequest(): HTMLElement {
    const pending = state.pendingGoogleImport as NonNullable<State['pendingGoogleImport']>;
    const grant = async (): Promise<void> => {
      const granted = await requestGooglePermission();
      if (!granted) {
        state.message = 'Permesso non concesso: senza l\'accesso a Google Drive le revisioni non possono essere lette.';
        return render();
      }
      state.pendingGoogleImport = null;
      await runImport(pending.url, pending.trigger);
    };
    return h(
      'div',
      { class: 'notice' },
      h('strong', {}, 'Accesso a Google Drive'),
      h('div', {}, 'Per leggere le revisioni di un documento Google Docs, Evidentia deve poter contattare www.googleapis.com e docs.google.com dalle proprie pagine. Il permesso vale solo per queste richieste, in sola lettura, con l\'autorizzazione Google che ti verrà chiesta subito dopo; si può revocare dalle impostazioni.'),
      h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'primary', onclick: () => void grant() }, 'Consenti l\'accesso a Google Drive e analizza'), h('button', { onclick: () => { state.pendingGoogleImport = null; render(); } }, 'Annulla')),
    );
  }

  function renderUtility(view: UtilityId): HTMLElement {
    if (view === 'settings') return renderSettings(ctx);
    if (view === 'glossary') return renderGlossary();
    if (view === 'about') return renderAbout();
    if (state.dataset && state.analysis) return renderRaw(state.dataset, state.analysis);
    return h('p', { class: 'muted', style: 'padding:24px 0' }, 'Nessun documento selezionato: i dati grezzi si riferiscono a un documento analizzato.');
  }

  function render(): void {
    renderSidebar(ctx, sidebar);
    clear(main);
    const hasData = state.dataset !== null && state.analysis !== null;
    if (hasData || !isTab(state.tab)) main.appendChild(renderTabBar(state.tab, setTab));
    if (state.progress) {
      renderProgress();
      main.appendChild(progressBox);
    }
    if (state.pendingGoogleImport) main.appendChild(renderGooglePermissionRequest());
    if (state.message) main.appendChild(h('div', { class: 'notice status' }, state.message));
    if (!isTab(state.tab)) return void main.appendChild(renderUtility(state.tab));
    if (!hasData) {
      // Durante la prima analisi la pagina vuota confonderebbe: basta il progresso.
      if (!state.progress) main.appendChild(renderEmptyState(ctx));
      return;
    }
    const ds = state.dataset as NonNullable<State['dataset']>;
    const an = state.analysis as NonNullable<State['analysis']>;
    const section: Record<TabId, () => HTMLElement> = {
      panoramica: () => renderPanoramica(ds, an, ctx),
      cronologia: () => renderCronologia(ds, an),
      contenuti: () => renderContenuti(an),
      versioni: () => renderVersioni(ds, an, ctx),
      copertura: () => renderCopertura(ds, an),
    };
    main.appendChild(section[state.tab]());
  }

  async function doExport(kind: ExportKind): Promise<void> {
    if (!state.documentId) return;
    const id = state.documentId;
    state.message = 'Preparazione export…';
    render();
    try {
      const name = kind === 'zip' ? await exportDocument(id) : await exportLlmDocument(id, kind);
      state.message = `Esportato: ${name}`;
    } catch (e) {
      state.message = `Errore export: ${String(e)}`;
    }
    render();
  }

  async function deleteCurrent(): Promise<void> {
    if (!state.documentId || !confirm('Eliminare tutti i dati raccolti per questo documento? L\'operazione non è reversibile.')) return;
    await documentRepository.delete(state.documentId);
    state.documentId = null;
    state.message = 'Dati eliminati.';
    await load();
  }

  async function deleteAll(): Promise<void> {
    if (!confirm('Eliminare TUTTI i dati di Evidentia in questo browser? L\'operazione non è reversibile.')) return;
    await documentRepository.deleteAll();
    state.documentId = null;
    state.tab = 'panoramica';
    state.message = 'Tutti i dati sono stati eliminati.';
    await load();
  }

  async function loadDemo(id: DemoCaseId): Promise<void> {
    const c = DEMO_CASES.find((x) => x.id === id);
    if (!c) return;
    state.message = 'Generazione dati demo…';
    render();
    const ds = await c.build();
    await importDataset(ds);
    state.message = `Caricato: ${c.title}`;
    selectDocument(ds.document.id);
  }

  async function saveAndReload(next: Settings): Promise<void> {
    await saveSettings(next);
    state.settings = next;
    state.message = 'Impostazioni salvate. Le soglie di analisi si applicano subito; la modalità privacy vale per i documenti analizzati da ora in poi.';
    await load();
  }

  async function disconnectGoogle(): Promise<void> {
    await signOutGoogle();
    const removed = await removeGooglePermission();
    state.message = removed ? 'Autorizzazione Google dimenticata e permesso host revocato.' : 'Autorizzazione Google dimenticata (nessun permesso host da revocare).';
    render();
  }

  const ctx: ViewContext = { state, render, setTab, select, runImport, selectDocument, loadDemo, doExport, deleteCurrent, deleteAll, saveSettings: saveAndReload, disconnectGoogle };

  window.addEventListener('hashchange', () => {
    const next = parseHash(location.hash);
    if (next !== state.tab) {
      state.tab = next;
      render();
    }
  });

  const importUrl = params.get('import');
  if (importUrl) {
    history.replaceState(null, '', location.pathname);
    void loadSettings().then((s) => {
      state.settings = s;
      return runImport(importUrl, 'MANUAL');
    });
  } else void load();
}
