import type { Analysis } from '@/analysis';
import { analyzeDataset } from '@/analysis';
import type { AnalyzedDocument, DocumentDataset, Settings, Snapshot } from '@/models';
import { DEMO_CASES } from '@/demo/cases';
import { GLOSSARY_GROUPS, KIND_LABEL, KIND_MEANING, explain, label as glossaryLabel, term, type GlossaryId } from '@/analysis/glossary';
import { wordCountChart } from '@/export/html-report';
import { importVersionHistory, type ImportProgress } from '@/import/version-importer';
import { parseDocumentLocator, providerHint } from '@/import/document-locator';
import { signOutGoogle } from '@/google/google-auth';
import { hasGooglePermission, removeGooglePermission, requestGooglePermission } from '@/google/permissions';
import { documentProvider, sourceLabel, type DocumentProvider } from '@/models';
import { documentRepository, importDataset, loadDataset } from '@/storage/repositories';
import { loadSettings, saveSettings } from '@/storage/settings-store';
import { formatInt } from '@/utils/text';
import { formatDateTime, formatDuration } from '@/utils/time';
import { getExtensionVersion } from '@/utils/version';
import { badge, clear, h, html } from '@/ui/shared/dom';
import { logoMark } from '@/ui/shared/logo';
import { exportDocument, exportLlmDocument } from '@/ui/shared/export-action';
import { renderSnapshotComparison } from './diff-view';

type TabId = 'overview' | 'timeline' | 'sessions' | 'time' | 'content' | 'versions' | 'insertions' | 'revisions' | 'gaps' | 'raw' | 'glossary' | 'settings';
const TABS: Array<[TabId, string]> = [
  ['overview', 'Overview'],
  ['timeline', 'Timeline'],
  ['sessions', 'Sessions'],
  ['time', 'Tempo stimato'],
  ['content', 'Contenuti per fase'],
  ['versions', 'Versions'],
  ['insertions', 'Large insertions'],
  ['revisions', 'Revision statistics'],
  ['gaps', 'Observation gaps'],
  ['raw', 'Raw data'],
  ['glossary', 'Glossario'],
  ['settings', 'Settings'],
];

interface State {
  documents: AnalyzedDocument[];
  documentId: string | null;
  dataset: DocumentDataset | null;
  analysis: Analysis | null;
  tab: TabId;
  selected: string[];
  settings: Settings;
  message: string;
  progress: ImportProgress | null;
  /** Server of the import in progress or just failed, for the error hint. */
  importProvider: DocumentProvider | null;
  /** Google import waiting for the optional host permission (needs a click). */
  pendingGoogleImport: { url: string; trigger: 'MANUAL' | 'REFRESH' } | null;
}

export function mountProcessView(root: HTMLElement): void {
  const params = new URLSearchParams(location.search);
  const state: State = {
    documents: [],
    documentId: params.get('doc'),
    dataset: null,
    analysis: null,
    tab: (location.hash.replace('#', '') as TabId) || 'overview',
    selected: [],
    settings: null as unknown as Settings,
    message: '',
    progress: null,
    importProvider: null,
    pendingGoogleImport: null,
  };

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
    history.replaceState(null, '', `?doc=${encodeURIComponent(id)}#${state.tab}`);
    void load();
  }

  function setTab(tab: TabId): void {
    state.tab = tab;
    history.replaceState(null, '', `${location.search}#${tab}`);
    render();
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

  function render(): void {
    renderSidebar();
    clear(main);
    main.appendChild(h('nav', { class: 'tabs' }, ...TABS.map(([id, label]) => h('button', { class: state.tab === id ? 'active' : '', onclick: () => setTab(id) }, label))));
    if (state.progress) {
      renderProgress();
      main.appendChild(progressBox);
    }
    if (state.pendingGoogleImport) main.appendChild(renderGooglePermissionRequest());
    if (state.message) main.appendChild(h('div', { class: 'notice' }, state.message));
    if (state.tab === 'settings') return void main.appendChild(renderSettings());
    if (state.tab === 'glossary') return void main.appendChild(renderGlossary());
    if (!state.dataset || !state.analysis) {
      main.appendChild(h('p', { class: 'muted', style: 'padding:24px 0' }, 'Nessun documento selezionato. Apri un documento Word su SharePoint/OneDrive o un documento Google Docs e avvia l\'analisi dal popup, oppure carica un caso demo dalla barra laterale.'));
      return;
    }
    const ds = state.dataset;
    const an = state.analysis;
    const section: Record<TabId, () => HTMLElement> = {
      overview: () => renderOverview(ds, an),
      timeline: () => renderTimeline(ds, an),
      sessions: () => renderSessions(an),
      time: () => renderTime(an),
      content: () => renderContent(an),
      versions: () => renderVersions(ds),
      insertions: () => renderInsertions(ds, an),
      revisions: () => renderRevisions(ds, an),
      gaps: () => renderGaps(an),
      raw: () => renderRaw(ds, an),
      glossary: () => renderGlossary(),
      settings: () => renderSettings(),
    };
    main.appendChild(section[state.tab]());
  }

  function renderSidebar(): void {
    clear(sidebar);
    sidebar.appendChild(h('div', { class: 'brand' }, logoMark(20), 'EVIDENTIA'));
    sidebar.appendChild(h('div', { class: 'muted small' }, 'Process View · cronologia versioni'));
    sidebar.appendChild(h('h3', {}, 'Documenti analizzati'));
    if (state.documents.length === 0) sidebar.appendChild(h('p', { class: 'muted small' }, 'Nessun documento analizzato.'));
    for (const d of state.documents) {
      sidebar.appendChild(h('button', { class: `doc ${d.id === state.documentId ? 'active' : ''}`, onclick: () => selectDocument(d.id) }, h('div', { class: 'title' }, d.name || '(senza nome)'), h('div', { class: 'muted small' }, `${formatDateTime(d.lastAnalyzedAt)} · ${d.privacyMode} · ${documentProvider(d) === 'GOOGLE_DOCS' ? 'Google Docs' : 'SharePoint'}`)));
    }
    if (state.documentId && state.dataset) {
      sidebar.appendChild(h('h3', {}, 'Azioni'));
      if (state.dataset.document.webUrl && !state.dataset.document.id.startsWith('demo-')) {
        sidebar.appendChild(h('button', { class: 'full', disabled: state.progress !== null, onclick: () => void runImport(state.dataset?.document.webUrl ?? '', 'REFRESH') }, 'Aggiorna dalle versioni sul server'));
      }
      sidebar.appendChild(h('button', { class: 'primary full', onclick: () => void doExport(() => exportLlmDocument(state.documentId as string, 'docx')) }, 'Esporta per Copilot / LLM (.docx)'));
      sidebar.appendChild(h('button', { class: 'full', onclick: () => void doExport(() => exportLlmDocument(state.documentId as string, 'md')) }, 'Esporta per LLM (.md)'));
      sidebar.appendChild(h('button', { class: 'full', onclick: () => void doExport(() => exportDocument(state.documentId as string)) }, 'Export ZIP completo'));
      sidebar.appendChild(h('button', { class: 'danger full', onclick: () => void deleteCurrent() }, 'Elimina dati di questo documento'));
    }
    sidebar.appendChild(h('h3', {}, 'Dati demo'));
    sidebar.appendChild(h('p', { class: 'muted small' }, 'Cronologie simulate per esplorare l\'interfaccia e l\'export.'));
    for (const c of DEMO_CASES) sidebar.appendChild(h('button', { class: 'full small', title: c.description, onclick: () => void loadDemo(c.id) }, c.title));
    sidebar.appendChild(h('h3', {}, 'Privacy'));
    sidebar.appendChild(h('p', { class: 'muted small' }, 'Tutti i dati restano in questo browser. Le versioni sono lette con la tua sessione Microsoft 365, in sola lettura. Nessun server, nessuna telemetria.'));
    sidebar.appendChild(h('button', { class: 'danger full small', onclick: () => void deleteAll() }, 'Elimina tutti i dati'));
  }

  async function doExport(run: () => Promise<string>): Promise<void> {
    if (!state.documentId) return;
    state.message = 'Preparazione export…';
    render();
    try {
      state.message = `Esportato: ${await run()}`;
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
    state.message = 'Tutti i dati sono stati eliminati.';
    await load();
  }

  async function loadDemo(id: string): Promise<void> {
    const c = DEMO_CASES.find((x) => x.id === id);
    if (!c) return;
    state.message = 'Generazione dati demo…';
    render();
    const ds = await c.build();
    await importDataset(ds);
    state.message = `Caricato: ${c.title}`;
    selectDocument(ds.document.id);
  }

  // ------------------------------------------------------------ sections

  function renderOverview(ds: DocumentDataset, an: Analysis): HTMLElement {
    const m = an.metrics;
    const o = an.observation;
    const el = h('section', {});
    el.appendChild(h('h1', {}, ds.document.name || '(senza nome)'));
    el.appendChild(h('p', { class: 'muted' }, `${ds.document.host} · creato ${ds.document.timeCreated ? formatDateTime(ds.document.timeCreated) : '–'} · ultima modifica ${ds.document.timeLastModified ? formatDateTime(ds.document.timeLastModified) : '–'} · analizzato ${formatDateTime(ds.document.lastAnalyzedAt)} · modalità ${ds.document.privacyMode}`));
    el.appendChild(
      h(
        'div',
        { class: 'cards' },
        card('versions', `${m.versions.numberOfVersions} (${m.versions.numberOfReadableVersions} leggibili)`),
        card('calendarSpan', formatDuration(m.versions.totalSpanMs)),
        card('sessions', String(m.sessions.numberOfSessions)),
        card('estimatedActiveTotal', formatDuration(an.time.estimatedActiveTotalMs)),
        card('wordsPerHourNet', an.time.wordsPerHourNet === null ? '–' : formatInt(an.time.wordsPerHourNet), 'Parole/ora (stima)'),
        card('authors', String(m.versions.numberOfAuthors)),
        card('finalWords', formatInt(m.document.finalWordCount)),
        card('firstVersionWords', m.versions.firstVersionWordCount === null ? '–' : `${formatInt(m.versions.firstVersionWordCount)} parole`),
        card('wordsAdded', `+${formatInt(m.writing.estimatedWordsAdded)}`),
        card('wordsDeleted', `−${formatInt(m.writing.estimatedWordsDeleted)}`),
        card('largeInsertions', String(m.insertions.numberOfLargeInsertions)),
        card('revisions', String(m.revision.numberOfRevisionEvents)),
        card('gaps', String(o.knownGaps.length)),
      ),
    );
    el.appendChild(h('h2', {}, 'Parole per versione nel tempo', info('chart')));
    el.appendChild(html(wordCountChart(ds, an)));
    if (ds.document.authors.length) {
      el.appendChild(h('h2', {}, 'Autori delle versioni'));
      el.appendChild(h('ul', {}, ...ds.document.authors.map((a) => h('li', {}, `${a.label}${a.displayName ? ` (${a.displayName})` : ''}: ${a.versions} versioni`))));
    }
    el.appendChild(h('h2', {}, 'Integrità', info('chain')));
    el.appendChild(h('p', {}, an.chain.valid ? badge(`hash chain valida (${an.chain.checked} eventi)`, 'ok') : badge(`hash chain NON valida dall'evento ${an.chain.firstBrokenSeq}`, 'danger'), ' ', h('span', { class: 'muted' }, 'Rileva alterazioni accidentali; non è una protezione forense.')));
    el.appendChild(h('div', { class: 'notice' }, h('strong', {}, 'Evidentia non dimostra chi abbia scritto un testo e non dimostra l\'uso di AI.'), ' Rende osservabile una parte del processo con cui il testo è stato prodotto, attraverso le versioni conservate dal server.'));
    return el;
  }

  function renderTimeline(ds: DocumentDataset, an: Analysis): HTMLElement {
    const el = h('section', {});
    el.appendChild(h('h2', {}, 'Timeline'));
    el.appendChild(html(wordCountChart(ds, an)));
    el.appendChild(
      h(
        'table',
        {},
        h('thead', {}, h('tr', {}, th('timelineTime'), th('timelineEvent'), th('timelineDetail'))),
        h('tbody', {}, ...an.timeline.map((t) => h('tr', {}, h('td', { class: 'mono' }, formatDateTime(t.time)), h('td', {}, badge(t.type, t.type === 'LARGE_INSERTION' ? 'danger' : t.type === 'REVISION' ? 'rev' : t.type === 'GAP' ? 'warn' : t.type === 'VERSION' ? 'ok' : '')), h('td', {}, [t.versionLabel ? `versione ${t.versionLabel}` : null, t.author ?? null, t.wordCount !== undefined ? `${formatInt(t.wordCount)} parole` : null, t.words !== undefined ? `${formatInt(t.words)} parole` : null, t.durationMs !== undefined ? formatDuration(t.durationMs) : null, t.label ?? null].filter(Boolean).join(' · '))))),
      ),
    );
    return el;
  }

  function renderSessions(an: Analysis): HTMLElement {
    const el = h('section', {});
    el.appendChild(h('h2', {}, `Sessioni (${an.sessions.length})`, info('sessions')));
    el.appendChild(h('p', { class: 'muted' }, `Gruppi di versioni salvate a meno di ${an.options.sessionGapMinutes} minuti l'una dall'altra. Indicano quando il documento è stato salvato, non quanto tempo è stato dedicato.`));
    el.appendChild(
      h(
        'table',
        {},
        h('thead', {}, h('tr', {}, th('sessionIndex'), th('sessionStart'), th('sessionEnd'), th('sessionSpan'), th('sessionVersions'), th('sessionWords'), th('sessionDelta'), th('sessionAuthors'))),
        h('tbody', {}, ...an.sessions.map((s) => h('tr', {}, h('td', {}, String(s.index + 1)), h('td', { class: 'mono' }, formatDateTime(s.startedAt)), h('td', { class: 'mono' }, formatDateTime(s.endedAt)), h('td', {}, s.versionCount > 1 ? formatDuration(s.spanMs) : '–'), h('td', {}, String(s.versionCount)), h('td', {}, `${s.wordCountStart ?? '–'} → ${s.wordCountEnd ?? '–'}`), h('td', {}, `${s.netWordChange >= 0 ? '+' : ''}${s.netWordChange}`), h('td', {}, s.authorLabels.join(', ') || '–')))),
      ),
    );
    return el;
  }

  function renderTime(an: Analysis): HTMLElement {
    const t = an.time;
    const rate = (n: number | null): string => (n === null ? '–' : formatInt(n));
    const el = h('section', {});
    el.appendChild(h('h2', {}, 'Tempo stimato e ritmo', info('estimatedActiveTotal')));
    el.appendChild(h('p', { class: 'muted' }, `Stime derivate dai soli orari delle versioni: il tempo attivo non è osservato. Metodo: somma degli archi delle sessioni più ${t.leadInMinutes} minuti di avvio per sessione (modificabile nelle impostazioni); parole/ora solo su sessioni con almeno ${t.minSessionForRateMinutes} minuti stimati.`));
    el.appendChild(
      h(
        'div',
        { class: 'cards' },
        card('calendarSpan', formatDuration(t.calendarSpanMs), 'Arco di calendario'),
        card('daysWithVersions', String(t.daysWithVersions)),
        card('observedTotal', formatDuration(t.observedTotalMs)),
        card('estimatedActiveTotal', formatDuration(t.estimatedActiveTotalMs)),
        card('wordsPerHourNet', rate(t.wordsPerHourNet)),
        card('wordsPerHourAdded', rate(t.wordsPerHourAdded)),
        card('medianSessionRate', rate(t.medianSessionWordsPerHourNet)),
      ),
    );
    if (t.maxIntervalRate) el.appendChild(h('p', { class: 'muted' }, info('maxIntervalRate'), ` Intervallo con il ritmo più alto: versione ${t.maxIntervalRate.fromVersion} → ${t.maxIntervalRate.toVersion}, ${formatInt(t.maxIntervalRate.netWords)} parole nette in ${formatDuration(t.maxIntervalRate.elapsedMs)} (${formatInt(t.maxIntervalRate.wordsPerHourNet)} parole/ora).`));
    el.appendChild(h('h3', {}, 'Per sessione'));
    el.appendChild(
      h(
        'table',
        {},
        h('thead', {}, h('tr', {}, th('sessionIndex'), th('sessionStart'), th('sessionEnd'), th('sessionVersions'), th('observedSpan'), th('leadIn'), th('estimatedActive'), th('netWords'), th('plusMinus'), th('wordsPerHour'))),
        h('tbody', {}, ...t.sessions.map((s) => h('tr', {}, h('td', {}, String(s.sessionIndex + 1)), h('td', { class: 'mono' }, formatDateTime(s.startedAt)), h('td', { class: 'mono' }, s.versionCount > 1 ? formatDateTime(s.endedAt) : '–'), h('td', {}, String(s.versionCount)), h('td', {}, s.versionCount > 1 ? formatDuration(s.observedSpanMs) : '0'), h('td', {}, formatDuration(s.leadInMs)), h('td', {}, formatDuration(s.estimatedActiveMs)), h('td', {}, `${s.netWords >= 0 ? '+' : ''}${formatInt(s.netWords)}${s.includesFirstVersionContent ? '' : ' *'}`), h('td', {}, `+${formatInt(s.wordsAdded)} / −${formatInt(s.wordsDeleted)}`), h('td', {}, rate(s.wordsPerHourNet))))),
      ),
    );
    el.appendChild(h('p', { class: 'muted small' }, '* Prima sessione: il contenuto della prima versione disponibile non è attribuito (scritto prima dell\'osservazione).'));
    el.appendChild(h('h3', {}, 'Per giornata'));
    el.appendChild(
      h(
        'table',
        {},
        h('thead', {}, h('tr', {}, th('day'), th('daySessions'), th('dayVersions'), th('estimatedActive'), th('netWords'), th('plusMinus'), th('sessionAuthors'))),
        h('tbody', {}, ...t.days.map((d) => h('tr', {}, h('td', { class: 'mono' }, d.date), h('td', {}, String(d.sessions)), h('td', {}, String(d.versions)), h('td', {}, formatDuration(d.estimatedActiveMs)), h('td', {}, `${d.netWords >= 0 ? '+' : ''}${formatInt(d.netWords)}`), h('td', {}, `+${formatInt(d.wordsAdded)} / −${formatInt(d.wordsDeleted)}`), h('td', {}, d.authorLabels.join(', ') || '–')))),
      ),
    );
    el.appendChild(h('h3', {}, 'Avvertenze'));
    el.appendChild(h('ul', {}, ...t.caveats.map((x) => h('li', { class: 'muted' }, x))));
    return el;
  }

  function renderContent(an: Analysis): HTMLElement {
    const c = an.content;
    const sess = (i: number): string => `S${i + 1}`;
    const el = h('section', {});
    el.appendChild(h('h2', {}, 'Evoluzione dei contenuti per fase', info('phases')));
    el.appendChild(h('p', { class: 'muted' }, 'Le fasi coincidono con le sessioni. Per ogni fase: paragrafi del testo finale comparsi o rivisti, paragrafi eliminati senza ricomparire, sezioni cambiate (parole prima → dopo). Sono descritti i cambiamenti, non le loro cause.'));
    if (c.notes.length) el.appendChild(h('ul', {}, ...c.notes.map((n) => h('li', { class: 'muted' }, n))));
    if (c.basis === 'NONE') return el;
    for (const p of c.phases) {
      const box = h('div', { class: 'notice' }, h('div', {}, p.summary));
      const changed = p.sections.filter((x) => x.wordsAdded + x.wordsDeleted + x.paragraphsAdded + x.paragraphsDeleted + x.paragraphsModified > 0);
      if (c.hasSections && changed.length) {
        box.appendChild(
          h(
            'table',
            {},
            h('thead', {}, h('tr', {}, th('section'), th('wordsBeforeAfter'), th('sectionWordsAdded'), th('sectionWordsDeleted'), th('paragraphsPDM'))),
            h('tbody', {}, ...changed.map((x) => h('tr', {}, h('td', {}, x.section), h('td', {}, `${formatInt(x.wordsBefore)} → ${formatInt(x.wordsAfter)}`), h('td', {}, formatInt(x.wordsAdded)), h('td', {}, formatInt(x.wordsDeleted)), h('td', {}, `${x.paragraphsAdded}/${x.paragraphsDeleted}/${x.paragraphsModified}`)))),
          ),
        );
      }
      el.appendChild(box);
    }
    if (c.hasSections) {
      el.appendChild(h('h3', {}, `Sezioni del testo finale (${c.sections.length})`));
      el.appendChild(
        h(
          'table',
          {},
          h('thead', {}, h('tr', {}, th('section'), th('sectionFinalWords'), th('sectionParagraphs'), th('firstSeen'), th('sessionsTouched'), th('wordsByPhase'))),
          h('tbody', {}, ...c.sections.map((x) => h('tr', {}, h('td', { style: `padding-left:${8 + Math.max(0, x.level - 1) * 14}px` }, x.section), h('td', {}, formatInt(x.finalWords)), h('td', {}, String(x.finalParagraphs)), h('td', {}, `v${x.firstSeenVersion} (${sess(x.firstSeenSession)})`), h('td', {}, x.sessionsTouched.map(sess).join(', ') || '–'), h('td', { class: 'mono' }, x.wordsByPhase.map((w) => `${sess(w.sessionIndex)}: ${formatInt(w.words)}`).join(' · '))))),
        ),
      );
    }
    el.appendChild(h('h3', {}, `Mappa del testo finale (${c.finalParagraphs.length} paragrafi)`));
    el.appendChild(h('p', { class: 'muted' }, 'Per ogni paragrafo: quando è comparso (versione e sessione), da quando non cambia più, quante varianti precedenti sono state trovate.'));
    el.appendChild(
      h(
        'table',
        {},
        h('thead', {}, h('tr', {}, th('position'), th('section'), th('paragraphWords'), th('firstSeen'), th('lastChanged'), th('variants'), th('incipit'))),
        h('tbody', {}, ...c.finalParagraphs.map((p) => h('tr', { style: p.isHeading ? 'font-weight:600' : '' }, h('td', {}, String(p.position + 1)), h('td', {}, p.section ?? '–'), h('td', {}, p.words === null ? '–' : String(p.words)), h('td', {}, `v${p.firstSeenVersion} (${sess(p.firstSeenSession)})`), h('td', {}, p.lastChangedIndex === p.firstSeenIndex ? '=' : `v${p.lastChangedVersion} (${sess(p.lastChangedSession)})`), h('td', {}, String(p.revisions)), h('td', {}, p.excerpt ?? '–')))),
      ),
    );
    el.appendChild(h('h3', {}, `Contenuto eliminato e non ripreso (${c.abandoned.length})`, info('abandoned')));
    if (c.abandoned.length === 0) el.appendChild(h('p', { class: 'muted' }, 'Nessun paragrafo eliminato definitivamente fra le versioni leggibili.'));
    else
      el.appendChild(
        h(
          'table',
          {},
          h('thead', {}, h('tr', {}, th('removedIn'), th('removedSession'), th('section'), th('paragraphWords'), th('presentSince'), th('excerpt'))),
          h('tbody', {}, ...c.abandoned.map((a) => h('tr', {}, h('td', {}, `v${a.removedVersion}`), h('td', {}, sess(a.removedSession)), h('td', {}, a.section ?? '–'), h('td', {}, a.words === null ? '–' : String(a.words)), h('td', {}, `v${a.firstSeenVersion}`), h('td', {}, a.excerpt ?? '–')))),
        ),
      );
    return el;
  }

  function renderVersions(ds: DocumentDataset): HTMLElement {
    const el = h('section', {});
    const snaps = [...ds.snapshots].sort((a, b) => a.index - b.index);
    el.appendChild(h('h2', {}, `Versioni (${snaps.length})`, info('versions')));
    el.appendChild(h('p', { class: 'muted' }, 'Seleziona due versioni per confrontarle.'));
    const toggle = (s: Snapshot): void => {
      const i = state.selected.indexOf(s.id);
      if (i >= 0) state.selected.splice(i, 1);
      else {
        state.selected.push(s.id);
        if (state.selected.length > 2) state.selected.shift();
      }
      render();
    };
    let prevWords: number | null = null;
    el.appendChild(
      h(
        'table',
        {},
        h('thead', {}, h('tr', {}, h('th', {}, ''), th('versionIndex'), th('versionLabel'), th('versionDate'), th('versionAuthor'), th('versionWords'), th('versionDelta'), th('versionParagraphs'), th('versionStatus'), th('versionHash'))),
        h(
          'tbody',
          {},
          ...snaps.map((s) => {
            const un = s.extractionStatus === 'UNAVAILABLE';
            const delta = !un && prevWords !== null ? s.wordCount - prevWords : null;
            if (!un) prevWords = s.wordCount;
            return h(
              'tr',
              { class: `selectable ${state.selected.includes(s.id) ? 'selected' : ''}`, onclick: () => toggle(s) },
              h('td', {}, h('input', { type: 'checkbox', checked: state.selected.includes(s.id), onclick: (e: Event) => { e.stopPropagation(); toggle(s); } })),
              h('td', {}, String(s.index)),
              h('td', {}, `${s.versionLabel}${s.isCurrent ? ' (corrente)' : ''}`),
              h('td', { class: 'mono' }, formatDateTime(s.timestamp)),
              h('td', {}, s.authorLabel ?? '–'),
              h('td', {}, un ? '–' : formatInt(s.wordCount)),
              h('td', {}, delta === null ? '–' : `${delta >= 0 ? '+' : ''}${formatInt(delta)}`),
              h('td', {}, un ? '–' : String(s.paragraphCount)),
              h('td', {}, badge(s.extractionStatus, un ? 'danger' : 'ok'), s.extractionNotes.length ? h('div', { class: 'muted small' }, s.extractionNotes.join('; ')) : null),
              h('td', { class: 'mono' }, s.textHash.slice(0, 10) || '–'),
            );
          }),
        ),
      ),
    );
    if (state.selected.length === 2) {
      const [a, b] = state.selected.map((id) => snaps.find((s) => s.id === id)) as [Snapshot, Snapshot];
      el.appendChild(h('h2', {}, `Confronto versione ${a.index <= b.index ? a.versionLabel : b.versionLabel} → ${a.index <= b.index ? b.versionLabel : a.versionLabel}`));
      el.appendChild(renderSnapshotComparison(a, b));
    } else if (state.selected.length === 1) {
      const s = snaps.find((x) => x.id === state.selected[0]);
      if (s) {
        el.appendChild(h('h2', {}, `Versione ${s.versionLabel}`));
        el.appendChild(s.text !== null ? h('pre', { style: 'white-space:pre-wrap' }, s.text) : h('p', { class: 'muted' }, 'Testo non disponibile per questa versione.'));
      }
    }
    return el;
  }

  function renderInsertions(ds: DocumentDataset, an: Analysis): HTMLElement {
    const el = h('section', {});
    const byId = new Map(ds.snapshots.map((s) => [s.id, s]));
    const threshold = an.metrics.insertions.thresholdWords;
    const large = [...ds.diffs].filter((d) => d.wordCountDelta >= threshold).sort((a, b) => a.toIndex - b.toIndex);
    el.appendChild(h('h2', {}, `Grandi inserimenti (${large.length})`, info('largeInsertions')));
    el.appendChild(h('p', { class: 'muted' }, `Aumenti di almeno ${threshold} parole fra due versioni consecutive. Sono osservazioni su dimensione e tempo: fra una versione e l'altra non è osservato nulla, e la provenienza del testo non è determinabile.`));
    if (large.length === 0) el.appendChild(h('p', { class: 'muted' }, 'Nessuno.'));
    for (const d of large) {
      const from = byId.get(d.fromSnapshotId);
      const to = byId.get(d.toSnapshotId);
      el.appendChild(
        h(
          'div',
          { class: 'notice', style: 'cursor:pointer', onclick: () => { state.selected = [d.fromSnapshotId, d.toSnapshotId]; setTab('versions'); } },
          h('div', { class: 'row' }, h('strong', {}, `${from?.versionLabel ?? ''} → ${to?.versionLabel ?? ''}`), badge(`+${formatInt(d.wordCountDelta)} parole`, d.wordCountDelta > 1000 ? 'danger' : 'warn'), h('span', { class: 'muted' }, `${formatDuration(d.elapsedMs)} · ${from?.wordCount ?? 0} → ${to?.wordCount ?? 0} parole · +${d.paragraphsAdded} paragrafi · ${to?.authorLabel ?? 'autore sconosciuto'} · ${formatDateTime(to?.timestamp ?? '')}`)),
          ...d.addedBlocks.slice(0, 2).map((b) => h('blockquote', { class: 'add' }, b.excerpt)),
        ),
      );
    }
    return el;
  }

  function renderRevisions(ds: DocumentDataset, an: Analysis): HTMLElement {
    const el = h('section', {});
    const m = an.metrics;
    el.appendChild(h('h2', {}, 'Revision statistics', info('revisions')));
    el.appendChild(
      h(
        'div',
        { class: 'cards' },
        card('revisions', String(m.revision.numberOfRevisionEvents), 'Passaggi con revisione'),
        card('paragraphsRewritten', String(m.revision.paragraphsRewritten)),
        card('wordsRewritten', formatInt(m.writing.estimatedWordsRewritten)),
        card('revisionIntensity', String(m.revision.revisionIntensity)),
        card('afterFirstDraft', m.revision.proportionOfVersionsAfterFirstCompleteDraft === null ? 'n/d' : `${Math.round(m.revision.proportionOfVersionsAfterFirstCompleteDraft * 100)}%`),
      ),
    );
    const byId = new Map(ds.snapshots.map((s) => [s.id, s]));
    const diffs = [...ds.diffs].sort((a, b) => a.toIndex - b.toIndex);
    el.appendChild(
      h(
        'table',
        {},
        h('thead', {}, h('tr', {}, th('versionLabel', 'Versioni'), th('versionDate', 'Ora'), th('interval'), th('diffType'), th('diffAdded'), th('diffDeleted'), th('diffReplaced'), th('paragraphsPDM'), th('diffDelta'))),
        h('tbody', {}, ...diffs.map((d) => h('tr', { class: 'selectable', onclick: () => { state.selected = [d.fromSnapshotId, d.toSnapshotId]; setTab('versions'); } }, h('td', {}, `${byId.get(d.fromSnapshotId)?.versionLabel ?? ''} → ${byId.get(d.toSnapshotId)?.versionLabel ?? ''}`), h('td', { class: 'mono' }, formatDateTime(byId.get(d.toSnapshotId)?.timestamp ?? '')), h('td', {}, formatDuration(d.elapsedMs)), h('td', {}, badge(d.classification, d.classification === 'REWRITING' ? 'rev' : d.classification === 'DELETING' ? 'danger' : d.classification === 'ADDING' ? 'ok' : d.classification === 'UNKNOWN' ? 'warn' : '')), h('td', {}, String(d.wordsAdded)), h('td', {}, String(d.wordsDeleted)), h('td', {}, String(d.wordsReplaced)), h('td', {}, `${d.paragraphsAdded}/${d.paragraphsDeleted}/${d.paragraphsModified}`), h('td', {}, `${d.wordCountDelta >= 0 ? '+' : ''}${d.wordCountDelta}`)))),
      ),
    );
    el.appendChild(h('p', { class: 'muted' }, 'Clicca una riga per aprire il confronto fra le due versioni.'));
    return el;
  }

  function renderGaps(an: Analysis): HTMLElement {
    const o = an.observation;
    const el = h('section', {});
    el.appendChild(h('h2', {}, 'Observation coverage'));
    el.appendChild(h('table', { class: 'kv' }, kv('source', `${sourceLabel(state.dataset?.document ?? {})}: ${o.versionsOnServer} versioni sul server, ${o.versionsStored} lette, ${o.versionsReadable} con testo`), kv('firstLast', `${o.firstVersionAt ? formatDateTime(o.firstVersionAt) : '–'} / ${o.lastVersionAt ? formatDateTime(o.lastVersionAt) : '–'}`), kv('lastAnalyzed', o.lastAnalyzedAt ? formatDateTime(o.lastAnalyzedAt) : '–')));
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
    return el;
  }

  function renderRaw(ds: DocumentDataset, an: Analysis): HTMLElement {
    const el = h('section', {});
    el.appendChild(h('h2', {}, 'Raw data'));
    el.appendChild(h('p', { class: 'muted' }, 'Tutto ciò che è stato raccolto per questo documento, senza interpretazioni.'));
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

  function renderSettings(): HTMLElement {
    const s = state.settings;
    const el = h('section', {});
    el.appendChild(h('h2', {}, 'Impostazioni'));
    const privacy = h('select', {}, h('option', { value: 'FULL', selected: s.privacyMode === 'FULL' }, 'FULL — salva il testo delle versioni e i nomi degli autori'), h('option', { value: 'METRICS_ONLY', selected: s.privacyMode === 'METRICS_ONLY' }, 'METRICS_ONLY — solo conteggi, hash ed etichette pseudonime')) as HTMLSelectElement;
    const gap = h('input', { type: 'number', min: 5, max: 720, value: s.sessionGapMinutes }) as HTMLInputElement;
    const large = h('input', { type: 'number', min: 50, max: 10000, value: s.largeInsertionWords }) as HTMLInputElement;
    const longGap = h('input', { type: 'number', min: 1, max: 720, value: s.longIntervalHours }) as HTMLInputElement;
    const leadIn = h('input', { type: 'number', min: 0, max: 60, value: s.sessionLeadInMinutes }) as HTMLInputElement;
    const maxV = h('input', { type: 'number', min: 10, max: 5000, value: s.maxVersions }) as HTMLInputElement;
    const googleClientId = h('input', { type: 'text', value: s.googleClientId, placeholder: 'xxxxxxxx.apps.googleusercontent.com (vuoto: usa quello incluso nella build, se presente)', spellcheck: 'false' }) as HTMLInputElement;
    const studentId = h('input', { type: 'text', value: s.student.studentId ?? '', placeholder: 'pseudonimo, es. studente-17' }) as HTMLInputElement;
    const assignmentId = h('input', { type: 'text', value: s.student.assignmentId ?? '', placeholder: 'es. saggio-1' }) as HTMLInputElement;
    const courseId = h('input', { type: 'text', value: s.student.courseId ?? '', placeholder: 'es. PED-101' }) as HTMLInputElement;
    const save = async (): Promise<void> => {
      const next: Settings = {
        ...s,
        privacyMode: privacy.value as Settings['privacyMode'],
        sessionGapMinutes: clamp(Number(gap.value), 5, 720),
        largeInsertionWords: clamp(Number(large.value), 50, 10000),
        longIntervalHours: clamp(Number(longGap.value), 1, 720),
        sessionLeadInMinutes: clamp(Number(leadIn.value), 0, 60),
        maxVersions: clamp(Number(maxV.value), 10, 5000),
        googleClientId: googleClientId.value.trim(),
        student: { studentId: studentId.value.trim() || undefined, assignmentId: assignmentId.value.trim() || undefined, courseId: courseId.value.trim() || undefined },
      };
      await saveSettings(next);
      state.settings = next;
      state.message = 'Impostazioni salvate. Le soglie di analisi si applicano subito; la modalità privacy vale per i documenti analizzati da ora in poi.';
      await load();
    };
    el.append(
      h('label', {}, 'Modalità privacy (fissata alla prima analisi di ciascun documento)'), privacy,
      h('label', {}, 'Nuova sessione dopo un intervallo fra versioni di (minuti)'), gap,
      h('label', {}, 'Grande inserimento: aumento di almeno (parole)'), large,
      h('label', {}, 'Intervallo fra versioni segnalato come gap dopo (ore)'), longGap,
      h('label', {}, 'Stima del tempo: margine di avvio per sessione (minuti, lavoro prima della prima versione salvata)'), leadIn,
      h('label', {}, 'Numero massimo di versioni da scaricare'), maxV,
      h('h3', {}, 'Google Docs'),
      h('label', {}, 'Client ID OAuth 2.0 (progetto Google Cloud della scuola; redirect URI ' + googleRedirectUrl() + ')'), googleClientId,
      h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { onclick: () => void disconnectGoogle() }, 'Disconnetti Google e revoca il permesso'), h('span', { class: 'muted small' }, 'Dimentica l\'autorizzazione e ritira l\'accesso a googleapis.com / docs.google.com fino alla prossima analisi di un documento Google.')),
      h('h3', {}, 'Identificativi opzionali (preferisci pseudonimi)'),
      h('label', {}, 'Student ID / pseudonimo'), studentId,
      h('label', {}, 'Assignment ID'), assignmentId,
      h('label', {}, 'Course ID'), courseId,
      h('div', { class: 'row', style: 'margin-top:16px' }, h('button', { class: 'primary', onclick: () => void save() }, 'Salva impostazioni')),
      h('div', { class: 'notice' }, h('strong', {}, 'Privacy.'), ' Tutti i dati restano nel browser. Le versioni sono lette in sola lettura: con la tua sessione Microsoft 365 per SharePoint/OneDrive, con la tua autorizzazione Google (Drive API) per Google Docs. Nessun server, nessuna telemetria, nessuna API AI. L\'unico modo in cui i dati escono è l\'export ZIP avviato da te.'),
    );
    return el;
  }

  function googleRedirectUrl(): string {
    try {
      return chrome.identity.getRedirectURL();
    } catch {
      return 'https://<id-estensione>.chromiumapp.org/';
    }
  }

  async function disconnectGoogle(): Promise<void> {
    await signOutGoogle();
    const removed = await removeGooglePermission();
    state.message = removed ? 'Autorizzazione Google dimenticata e permesso host revocato.' : 'Autorizzazione Google dimenticata (nessun permesso host da revocare).';
    render();
  }

  /** Small "i" that shows the glossary definition on hover or keyboard focus. */
  function info(id: GlossaryId): HTMLElement {
    const text = explain(id);
    const flip = (e: Event): void => {
      const el = e.currentTarget as HTMLElement;
      el.classList.toggle('left', el.getBoundingClientRect().left + 340 > window.innerWidth);
    };
    return h('button', { class: 'info', type: 'button', 'data-tip': text, title: text, 'aria-label': `Spiegazione: ${glossaryLabel(id)}`, onmouseenter: flip, onfocus: flip }, 'i');
  }
  function card(id: GlossaryId, v: string, labelOverride?: string): HTMLElement {
    return h('div', { class: 'card' }, h('div', { class: 'v' }, v), h('div', { class: 'k' }, labelOverride ?? glossaryLabel(id), info(id)));
  }
  function th(id: GlossaryId, labelOverride?: string): HTMLElement {
    return h('th', {}, labelOverride ?? glossaryLabel(id), info(id));
  }
  function kv(id: GlossaryId, v: string): HTMLElement {
    return h('tr', {}, h('th', {}, glossaryLabel(id), info(id)), h('td', {}, v));
  }

  function renderGlossary(): HTMLElement {
    const el = h('section', { class: 'glossary' });
    el.appendChild(h('h2', {}, 'Glossario dei dati'));
    el.appendChild(h('p', { class: 'muted' }, 'Ogni valore mostrato da Evidentia è spiegato qui e nei tooltip (icona "i"). Le stesse definizioni sono incluse negli export.'));
    el.appendChild(h('ul', {}, ...(Object.keys(KIND_LABEL) as Array<keyof typeof KIND_LABEL>).map((k) => h('li', {}, h('strong', {}, KIND_LABEL[k]), `: ${KIND_MEANING[k]}.`))));
    for (const g of GLOSSARY_GROUPS) {
      el.appendChild(h('h3', {}, g.title));
      const dl = h('dl', {});
      for (const id of g.ids) {
        const e = term(id);
        dl.appendChild(h('dt', {}, e.label, badge(KIND_LABEL[e.kind], e.kind === 'stima' ? 'warn' : e.kind === 'osservato' ? 'ok' : '')));
        dl.appendChild(h('dd', {}, [e.meaning, e.method, e.use].filter(Boolean).join(' ')));
      }
      el.appendChild(dl);
    }
    return el;
  }
  function clamp(n: number, lo: number, hi: number): number {
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
  }

  const importUrl = params.get('import');
  if (importUrl) {
    history.replaceState(null, '', location.pathname);
    void loadSettings().then((s) => {
      state.settings = s;
      return runImport(importUrl, 'MANUAL');
    });
  } else void load();
}
