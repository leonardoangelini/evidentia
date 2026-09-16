/**
 * One definition for every number Evidentia shows: what it is, how it is
 * computed, how to read it, and whether it is observed (read from the
 * server), derived (computed deterministically from observed data) or an
 * estimate (modelled). UI tooltips, report legends and export glossaries all
 * come from here, so the wording is the same everywhere.
 */

export type GlossaryKind = 'osservato' | 'derivato' | 'stima';

export const KIND_LABEL: Record<GlossaryKind, string> = { osservato: 'Osservato', derivato: 'Derivato', stima: 'Stima' };

export const KIND_MEANING: Record<GlossaryKind, string> = {
  osservato: 'letto direttamente dalla cronologia versioni del server',
  derivato: 'calcolato in modo deterministico dai dati osservati, senza modelli',
  stima: 'valore modellato a partire dagli orari delle versioni: un ordine di grandezza, non una misura',
};

interface Def {
  label: string;
  kind: GlossaryKind;
  /** What the value is. */
  meaning: string;
  /** How it is computed (optional). */
  method?: string;
  /** How to read it, what it does not mean (optional). */
  use?: string;
}

const ENTRIES = {
  // ---------------------------------------------------------- documento e versioni
  versions: { label: 'Versioni', kind: 'osservato', meaning: 'Numero di versioni della cronologia del server (SharePoint/OneDrive o Google Drive) lette per questo documento; fra parentesi quelle di cui è stato estratto il testo.', use: 'Più versioni rendono il processo più documentato. Poche versioni non significano poco lavoro: Word e Google Docs creano versioni con cadenza variabile, e Google espone tramite API solo una parte delle revisioni.' },
  versionIndex: { label: '#', kind: 'derivato', meaning: 'Posizione cronologica della versione, da 0 (la più antica) alla versione corrente.' },
  versionLabel: { label: 'Versione', kind: 'osservato', meaning: 'Etichetta assegnata da SharePoint (es. 1.0, 2.3) o numero progressivo della revisione Google Drive (1, 2, 3…). La versione corrente è il file com\'è oggi.' },
  versionDate: { label: 'Data', kind: 'osservato', meaning: 'Data e ora in cui il server ha creato la versione, in ora locale.' },
  versionAuthor: { label: 'Autore', kind: 'osservato', meaning: 'Chi ha salvato la versione secondo il server (SharePoint o Google Drive), come etichetta pseudonima (Autore 1, Autore 2…).', use: 'È chi ha salvato, non necessariamente chi ha scritto il testo.' },
  authors: { label: 'Autori', kind: 'osservato', meaning: 'Numero di identità distinte che hanno salvato almeno una versione.', use: 'Le etichette sono pseudonime; i nomi reali non compaiono negli export per LLM.' },
  versionWords: { label: 'Parole', kind: 'derivato', meaning: 'Parole del testo della versione, contate con lo stesso algoritmo per tutte le versioni (parole separate da spazi, senza intestazioni, note e commenti).', use: 'Può differire dal conteggio di Word; conta la coerenza fra versioni, non il valore assoluto.' },
  versionDelta: { label: 'Δ', kind: 'derivato', meaning: 'Variazione netta di parole rispetto alla versione leggibile precedente.' },
  versionParagraphs: { label: 'Paragrafi', kind: 'derivato', meaning: 'Numero di paragrafi non vuoti nel testo della versione (titoli inclusi).' },
  versionStatus: { label: 'Stato', kind: 'osservato', meaning: 'FULL: versione scaricata e testo estratto. UNAVAILABLE: la versione esiste sul server ma non è stata scaricata o letta; per essa contano solo i metadati.' },
  versionHash: { label: 'Hash', kind: 'derivato', meaning: 'Prime cifre dell\'impronta SHA-256 del testo della versione. Due versioni con lo stesso hash hanno testo identico.' },
  interval: { label: 'Intervallo', kind: 'osservato', meaning: 'Tempo trascorso dalla versione precedente.', use: 'Fra due versioni non è osservato nulla: un intervallo lungo non implica assenza di lavoro né la sua presenza.' },
  versionSections: { label: 'Sezioni', kind: 'derivato', meaning: 'Sezioni (titoli) in cui il testo è cambiato rispetto alla versione precedente, con parole aggiunte ed eliminate.' },
  finalWords: { label: 'Parole finali', kind: 'derivato', meaning: 'Parole della versione corrente del documento.' },
  wordsProgress: { label: 'Parole', kind: 'derivato', meaning: 'Parole della prima versione leggibile e della versione corrente; sotto, parole aggiunte ed eliminate in tutti i passaggi fra versioni (stima dal diff).', use: 'Se la prima versione è già lunga, gran parte della stesura precede l\'osservazione (gap BEFORE_FIRST_VERSION).' },
  firstVersionWords: { label: 'Prima versione', kind: 'derivato', meaning: 'Parole contenute nella prima versione leggibile.', use: 'Se è una quota alta del testo finale, gran parte della stesura è avvenuta prima dell\'osservazione (gap BEFORE_FIRST_VERSION).' },
  calendarSpan: { label: 'Arco temporale', kind: 'osservato', meaning: 'Tempo fra la prima e l\'ultima versione della cronologia.', use: 'È un arco di calendario, non tempo di lavoro.' },
  daysWithVersions: { label: 'Giornate con versioni', kind: 'derivato', meaning: 'Numero di giorni di calendario (ora locale) in cui è stata salvata almeno una versione.' },
  medianInterval: { label: 'Intervallo mediano', kind: 'derivato', meaning: 'Mediana degli intervalli fra versioni consecutive.' },

  // ---------------------------------------------------------- sessioni e tempo
  sessions: { label: 'Sessioni', kind: 'derivato', meaning: 'Gruppi di versioni salvate a meno di un certo intervallo l\'una dall\'altra (soglia nelle impostazioni, default 30 minuti).', use: 'Indicano quando il documento è stato salvato, non quanto tempo è stato dedicato.' },
  sessionIndex: { label: '#', kind: 'derivato', meaning: 'Numero progressivo della sessione in ordine cronologico.' },
  sessionStart: { label: 'Inizio', kind: 'osservato', meaning: 'Data e ora della prima versione della sessione.' },
  sessionEnd: { label: 'Fine', kind: 'osservato', meaning: 'Data e ora dell\'ultima versione della sessione.' },
  sessionSpan: { label: 'Arco', kind: 'osservato', meaning: 'Tempo fra la prima e l\'ultima versione della sessione. Una sessione con una sola versione ha arco zero.' },
  sessionVersions: { label: 'Versioni', kind: 'osservato', meaning: 'Numero di versioni salvate nella sessione.' },
  sessionWords: { label: 'Parole', kind: 'derivato', meaning: 'Parole della prima e dell\'ultima versione leggibile della sessione.' },
  sessionAuthors: { label: 'Autori', kind: 'osservato', meaning: 'Etichette pseudonime di chi ha salvato versioni nella sessione.' },
  observedTotal: { label: 'Tempo osservato', kind: 'osservato', meaning: 'Somma, per tutte le sessioni, del tempo fra la prima e l\'ultima versione.', use: 'È un limite inferiore: il lavoro prima della prima versione di ogni sessione non è visibile.' },
  estimatedActiveTotal: { label: 'Tempo attivo stimato', kind: 'stima', meaning: 'Stima del tempo di lavoro nel documento: tempo osservato più un margine di avvio per ogni sessione (default 5 minuti, modificabile).', method: 'Il margine è limitato dal tempo trascorso dalla versione precedente o dalla creazione del file.', use: 'L\'attività non è osservata: il documento può essere rimasto aperto senza modifiche, e il lavoro fuori dal documento non compare. Trattalo come ordine di grandezza.' },
  observedSpan: { label: 'Arco osservato', kind: 'osservato', meaning: 'Tempo fra la prima e l\'ultima versione della sessione.' },
  leadIn: { label: 'Avvio', kind: 'stima', meaning: 'Margine di lavoro ipotizzato prima che la prima versione della sessione fosse salvata.', method: 'Valore fisso dalle impostazioni, ridotto se la versione precedente (o la creazione del file) è più vicina.' },
  estimatedActive: { label: 'Tempo stimato', kind: 'stima', meaning: 'Arco osservato più margine di avvio della sessione.' },
  netWords: { label: 'Parole nette', kind: 'derivato', meaning: 'Parole alla fine della sessione meno parole dell\'ultima versione leggibile precedente: include le modifiche portate dalla prima versione della sessione.', use: 'Per la prima sessione il contenuto della prima versione in assoluto non è attribuito (asterisco): la sua stesura precede l\'osservazione.' },
  plusMinus: { label: '+ / −', kind: 'derivato', meaning: 'Parole aggiunte ed eliminate nei passaggi fra versioni attribuiti alla sessione o alla giornata (stima dal diff).' },
  wordsPerHour: { label: 'Parole/ora', kind: 'stima', meaning: 'Parole nette divise per il tempo stimato.', method: 'Calcolato solo quando il tempo stimato è di almeno 10 minuti (sessioni) o 5 minuti (intervalli dentro una sessione).', use: 'È un rapporto fra conteggi e tempo stimato: non descrive la velocità di digitazione né la provenienza del testo. Può essere negativo se il testo si è accorciato.' },
  wordsPerHourNet: { label: 'Parole/ora nette (stima)', kind: 'stima', meaning: 'Crescita netta del testo (parole finali meno parole della prima versione leggibile) divisa per il tempo attivo stimato totale.', use: 'Non è velocità di scrittura: dipende dal margine di avvio e dai soli orari delle versioni.' },
  wordsPerHourAdded: { label: 'Parole/ora aggiunte (stima)', kind: 'stima', meaning: 'Parole aggiunte (stima dai diff) divise per il tempo attivo stimato totale. Più alta delle parole nette quando ci sono state cancellazioni.' },
  medianSessionRate: { label: 'Mediana per sessione', kind: 'stima', meaning: 'Mediana delle parole/ora nette delle sessioni con almeno 10 minuti stimati.' },
  maxIntervalRate: { label: 'Intervallo con il ritmo più alto', kind: 'stima', meaning: 'Coppia di versioni consecutive, dentro una sessione, con il rapporto più alto fra parole nette e tempo trascorso.', use: 'Un ritmo alto fra due versioni è solo un ritmo alto: fra le due versioni non è osservato nulla.' },
  day: { label: 'Giorno', kind: 'derivato', meaning: 'Giorno di calendario (ora locale) in cui iniziano le sessioni conteggiate nella riga.' },
  daySessions: { label: 'Sessioni', kind: 'derivato', meaning: 'Sessioni iniziate in quel giorno.' },
  dayVersions: { label: 'Versioni', kind: 'osservato', meaning: 'Versioni salvate nelle sessioni di quel giorno.' },

  // ---------------------------------------------------------- testo e cambiamenti
  wordsAdded: { label: 'Parole aggiunte (stima)', kind: 'derivato', meaning: 'Somma delle parole aggiunte in ogni passaggio fra versioni consecutive.', method: 'Diff a livello di paragrafo e, dentro i paragrafi modificati, di parola.', use: 'È una stima perché fra due versioni si vede solo il risultato, non il percorso.' },
  wordsDeleted: { label: 'Parole eliminate (stima)', kind: 'derivato', meaning: 'Somma delle parole eliminate in ogni passaggio fra versioni consecutive (stesso metodo delle parole aggiunte).' },
  wordsRewritten: { label: 'Parole riscritte (stima)', kind: 'derivato', meaning: 'Parole sostituite all\'interno di paragrafi modificati: per ogni passaggio, il minimo fra parole aggiunte ed eliminate nei paragrafi accoppiati.' },
  diffType: { label: 'Tipo', kind: 'derivato', meaning: 'Forma del cambiamento fra due versioni: ADDING (quasi solo aggiunte), DELETING (quasi solo cancellazioni), REWRITING (sostituzioni dentro paragrafi), MIXED (aggiunte e cancellazioni insieme), UNCHANGED (testo identico), UNKNOWN (una delle due versioni non è leggibile).', use: 'Descrive la forma del cambiamento, non l\'intenzione.' },
  diffAdded: { label: '+ parole', kind: 'derivato', meaning: 'Parole aggiunte nel passaggio fra le due versioni.' },
  diffDeleted: { label: '− parole', kind: 'derivato', meaning: 'Parole eliminate nel passaggio fra le due versioni.' },
  diffReplaced: { label: 'Sostituite', kind: 'derivato', meaning: 'Parole sostituite dentro paragrafi modificati (minimo fra aggiunte ed eliminate).' },
  paragraphsPDM: { label: 'Par. +/−/mod', kind: 'derivato', meaning: 'Paragrafi aggiunti / eliminati / modificati nel passaggio. Un paragrafo è "modificato" quando una versione precedente e una successiva sono accoppiate dal diff.' },
  diffWords: { label: '+ / − / ~', kind: 'derivato', meaning: 'Parole aggiunte, eliminate e sostituite nel passaggio dalla versione precedente. Le sostituite sono il minimo fra aggiunte ed eliminate dentro i paragrafi modificati.' },
  largeInsertions: { label: 'Grandi inserimenti', kind: 'derivato', meaning: 'Passaggi fra versioni consecutive con un aumento netto di parole almeno pari alla soglia (default 300, modificabile).', use: 'È un\'osservazione su dimensione e tempo. La provenienza del testo non è osservabile: fra le due versioni non si vede nulla.' },
  insertionParagraphs: { label: '+ paragrafi', kind: 'derivato', meaning: 'Paragrafi interamente nuovi nel passaggio.' },
  majorTransitions: { label: 'Transizioni principali', kind: 'derivato', meaning: 'I passaggi fra versioni consecutive con i cambiamenti più grandi (per parole variate o paragrafi toccati), al massimo dieci.' },
  variation: { label: 'Variazione', kind: 'derivato', meaning: 'Variazione netta di parole nel passaggio.' },
  revisions: { label: 'Revisioni', kind: 'derivato', meaning: 'Passaggi fra versioni classificati come DELETING, REWRITING o MIXED.' },
  paragraphsRewritten: { label: 'Paragrafi modificati', kind: 'derivato', meaning: 'Somma dei paragrafi modificati in tutti i passaggi fra versioni.' },
  revisionIntensity: { label: 'Intensità di revisione', kind: 'derivato', meaning: 'Parole riscritte divise per le parole finali.', use: 'Confronta la quantità di riscrittura con la lunghezza del testo; non è un punteggio di qualità.' },
  afterFirstDraft: { label: 'Versioni dopo prima bozza completa', kind: 'derivato', meaning: 'Quota di versioni salvate dopo la prima versione che raggiunge il 90% del conteggio finale di parole.', use: 'Alta quando molte versioni seguono una bozza già completa (fase di revisione osservabile).' },
  excerpt: { label: 'Estratto', kind: 'osservato', meaning: 'Inizio del testo aggiunto o eliminato, riportato solo in modalità FULL.' },

  // ---------------------------------------------------------- contenuti per fase
  phases: { label: 'Fasi', kind: 'derivato', meaning: 'Le fasi coincidono con le sessioni. Per ogni fase si confronta l\'ultima versione leggibile precedente con l\'ultima della sessione.' },
  section: { label: 'Sezione', kind: 'derivato', meaning: 'Parte del documento delimitata da un titolo Word (stile Titolo/Heading). Ogni paragrafo appartiene alla sezione del titolo che lo precede; il testo prima del primo titolo è "(prima del primo titolo)".' },
  wordsBeforeAfter: { label: 'Parole prima → dopo', kind: 'derivato', meaning: 'Parole della sezione all\'inizio e alla fine della fase.' },
  sectionWordsAdded: { label: '+ parole', kind: 'derivato', meaning: 'Parole aggiunte nella sezione durante la fase.' },
  sectionWordsDeleted: { label: '− parole', kind: 'derivato', meaning: 'Parole eliminate dalla sezione durante la fase.' },
  sectionFinalWords: { label: 'Parole finali', kind: 'derivato', meaning: 'Parole della sezione nella versione corrente.' },
  sectionParagraphs: { label: 'Paragrafi', kind: 'derivato', meaning: 'Paragrafi della sezione nella versione corrente, titolo incluso.' },
  firstSeen: { label: 'Prima comparsa', kind: 'derivato', meaning: 'Versione (e sessione) in cui il paragrafo, o una sua variante precedente, appare per la prima volta. Per una sezione: la prima comparsa del suo paragrafo più antico.', method: 'Un paragrafo è variante di un altro quando la sequenza comune di parole copre almeno la metà della loro lunghezza.' },
  sessionsTouched: { label: 'Modificata nelle sessioni', kind: 'derivato', meaning: 'Sessioni in cui il testo della sezione è cambiato.' },
  wordsByPhase: { label: 'Parole a fine sessione', kind: 'derivato', meaning: 'Parole della sezione alla fine di ciascuna sessione (S1, S2, …). Mostra quando la sezione è cresciuta o si è ridotta.' },
  position: { label: '#', kind: 'derivato', meaning: 'Posizione del paragrafo nella versione corrente.' },
  paragraphWords: { label: 'Parole', kind: 'derivato', meaning: 'Parole del paragrafo nella versione corrente.' },
  lastChanged: { label: 'Ultima modifica', kind: 'derivato', meaning: 'Versione dalla quale il paragrafo non è più cambiato. "=" quando coincide con la prima comparsa (mai modificato da allora).' },
  variants: { label: 'Varianti', kind: 'derivato', meaning: 'Numero di versioni precedenti del paragrafo riconosciute come sue varianti. 0 = il paragrafo è comparso già nella forma attuale.', use: 'Riscritture radicali non vengono riconosciute come varianti: appaiono come paragrafo nuovo più paragrafo eliminato.' },
  incipit: { label: 'Incipit', kind: 'osservato', meaning: 'Inizio del testo del paragrafo (solo in modalità FULL).' },
  removedIn: { label: 'Rimosso in', kind: 'derivato', meaning: 'Prima versione in cui il paragrafo non compare più.' },
  removedSession: { label: 'Sessione', kind: 'derivato', meaning: 'Sessione in cui il paragrafo è stato rimosso.' },
  presentSince: { label: 'Presente da', kind: 'derivato', meaning: 'Versione in cui il paragrafo eliminato era comparso.' },
  abandoned: { label: 'Contenuto eliminato e non ripreso', kind: 'derivato', meaning: 'Paragrafi presenti in qualche versione, assenti dalla versione corrente e senza varianti nel testo finale (al massimo i 30 più lunghi).' },

  // ---------------------------------------------------------- timeline
  timelineTime: { label: 'Ora', kind: 'osservato', meaning: 'Data e ora dell\'evento in ora locale.' },
  timelineEvent: { label: 'Evento', kind: 'derivato', meaning: 'VERSION: versione salvata. SESSION_START/SESSION_END: inizio e fine di una sessione. LARGE_INSERTION: aumento oltre soglia fra due versioni. REVISION: passaggio con cancellazioni o riscritture rilevanti. GAP: periodo o versione non osservabile.' },
  timelineDetail: { label: 'Dettaglio', kind: 'derivato', meaning: 'Versione, autore, parole e durata relativi all\'evento.' },

  // ---------------------------------------------------------- copertura e integrità
  gaps: { label: 'Gap di osservazione', kind: 'derivato', meaning: 'Periodi o versioni per cui l\'osservazione manca: BEFORE_FIRST_VERSION (la prima versione contiene già testo), LONG_INTERVAL (nessuna versione per molte ore), VERSION_UNAVAILABLE (versione non scaricabile), NO_VERSION_HISTORY (nessuna versione precedente).', use: 'Sono limiti dei dati, non indizi su chi scrive.' },
  source: { label: 'Fonte', kind: 'osservato', meaning: 'Numero di versioni presenti sul server, lette dall\'estensione e di cui è stato estratto il testo.' },
  firstLast: { label: 'Prima / ultima versione', kind: 'osservato', meaning: 'Date della versione più antica e di quella più recente lette.' },
  lastAnalyzed: { label: 'Ultima analisi', kind: 'osservato', meaning: 'Quando l\'estensione ha letto per l\'ultima volta la cronologia dal server.' },
  extractionFailures: { label: 'Versioni non leggibili', kind: 'osservato', meaning: 'Versioni esistenti sul server che non sono state scaricate o il cui testo non è stato estratto, con il motivo.' },
  warnings: { label: 'Avvisi', kind: 'derivato', meaning: 'Anomalie nei dati: DUPLICATE_CONTENT (due versioni con testo identico), NON_MONOTONIC_TIMESTAMP (date non crescenti), PARTIAL_IMPORT (analisi incompleta), HASH_CHAIN_BREAK (log di analisi alterato).' },
  limitations: { label: 'Limiti strutturali', kind: 'derivato', meaning: 'Ciò che l\'analisi delle versioni non può mostrare per costruzione, sempre elencato.' },
  chain: { label: 'Integrità hash chain', kind: 'derivato', meaning: 'Ogni operazione di analisi è registrata in un log in cui ciascun evento contiene l\'impronta SHA-256 del precedente.', use: 'Rileva alterazioni accidentali del dataset esportato; non è una prova forense.' },
  chart: { label: 'Parole per versione nel tempo', kind: 'derivato', meaning: 'Ogni punto è una versione (parole sul verticale, tempo sull\'orizzontale). Le bande azzurre sono le sessioni, le linee rosse i grandi inserimenti, i cerchi viola le revisioni, il tratteggio gli intervalli lunghi.' },
} as const satisfies Record<string, Def>;

export type GlossaryId = keyof typeof ENTRIES;

export interface GlossaryEntry extends Def {
  id: GlossaryId;
}

export const GLOSSARY_GROUPS: Array<{ title: string; ids: GlossaryId[] }> = [
  { title: 'Documento e versioni', ids: ['versions', 'versionIndex', 'versionLabel', 'versionDate', 'versionAuthor', 'authors', 'versionWords', 'versionDelta', 'versionParagraphs', 'versionStatus', 'versionHash', 'interval', 'versionSections', 'finalWords', 'wordsProgress', 'firstVersionWords', 'calendarSpan', 'daysWithVersions', 'medianInterval'] },
  { title: 'Sessioni e tempo', ids: ['sessions', 'sessionIndex', 'sessionStart', 'sessionEnd', 'sessionSpan', 'sessionVersions', 'sessionWords', 'sessionAuthors', 'observedTotal', 'estimatedActiveTotal', 'observedSpan', 'leadIn', 'estimatedActive', 'netWords', 'plusMinus', 'wordsPerHour', 'wordsPerHourNet', 'wordsPerHourAdded', 'medianSessionRate', 'maxIntervalRate', 'day', 'daySessions', 'dayVersions'] },
  { title: 'Testo e cambiamenti', ids: ['wordsAdded', 'wordsDeleted', 'wordsRewritten', 'diffType', 'diffAdded', 'diffDeleted', 'diffReplaced', 'diffWords', 'paragraphsPDM', 'largeInsertions', 'insertionParagraphs', 'majorTransitions', 'variation', 'revisions', 'paragraphsRewritten', 'revisionIntensity', 'afterFirstDraft', 'excerpt'] },
  { title: 'Contenuti per fase', ids: ['phases', 'section', 'wordsBeforeAfter', 'sectionWordsAdded', 'sectionWordsDeleted', 'sectionFinalWords', 'sectionParagraphs', 'firstSeen', 'sessionsTouched', 'wordsByPhase', 'position', 'paragraphWords', 'lastChanged', 'variants', 'incipit', 'removedIn', 'removedSession', 'presentSince', 'abandoned'] },
  { title: 'Cronologia, copertura e integrità', ids: ['timelineTime', 'timelineEvent', 'timelineDetail', 'gaps', 'source', 'firstLast', 'lastAnalyzed', 'extractionFailures', 'warnings', 'limitations', 'chain', 'chart'] },
];

export function term(id: GlossaryId): GlossaryEntry {
  return { id, ...ENTRIES[id] };
}

export const GLOSSARY: GlossaryEntry[] = (Object.keys(ENTRIES) as GlossaryId[]).map(term);

/** Full explanation as one plain-text paragraph (tooltips, legends). */
export function explain(id: GlossaryId, withLabel = false): string {
  const e = term(id);
  const body = [e.meaning, e.method, e.use].filter(Boolean).join(' ');
  return withLabel ? `${e.label} — ${KIND_LABEL[e.kind]}. ${body}` : `${KIND_LABEL[e.kind]}. ${body}`;
}

/** "Legenda: A = …; B = …" for the columns of a table. */
export function legend(ids: GlossaryId[]): string {
  const seen = new Set<GlossaryId>();
  const parts: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const e = term(id);
    parts.push(`${e.label} = ${e.meaning}${e.use ? ` ${e.use}` : ''}`);
  }
  return `Legenda: ${parts.join(' · ')}`;
}

export function label(id: GlossaryId): string {
  return ENTRIES[id].label;
}
