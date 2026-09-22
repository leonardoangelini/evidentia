# Evidentia — Privacy

## Chi usa i dati

Evidentia è usata dal **docente** sul documento di uno studente. I dati
trattati sono: il testo delle versioni del documento, le date di
salvataggio e l'identità di chi ha salvato ciascuna versione secondo il
server (SharePoint/OneDrive o Google Drive). Il docente ha già accesso a
tutto questo tramite Microsoft 365 o Google Drive; l'estensione lo organizza
e lo conserva nel suo browser.

## Principi

1. **Local only.** Tutti i dati restano nel browser del docente (IndexedDB
   e `chrome.storage.local` dell'estensione). Le uniche richieste di rete
   sono le GET verso il server del documento, in sola lettura: il sito
   SharePoint con la sessione già autenticata del docente, oppure l'API di
   Google Drive con un token OAuth che il docente concede esplicitamente
   (consenso Google, revocabile). Nessun server di Evidentia, nessuna
   telemetria, nessuna API AI, nessun analytics.
2. **Azione esplicita.** Nulla viene letto finché il docente non preme
   *Analizza cronologia versioni*. L'avanzamento è visibile.
3. **Controllo.** Il docente può vedere tutto ciò che è stato raccolto
   (Process View → Dati grezzi), esportare e cancellare i dati per singolo
   documento o tutti.
4. **Minimizzazione.** Non vengono letti altri file, altre tab, la posta o
   il profilo del docente. Per Google lo scope richiesto (`drive.readonly`)
   è l'unico che dà accesso alle revisioni di un documento qualsiasi, ma
   l'estensione chiama solo gli endpoint del documento in analisi; il token
   resta in memoria di sessione e scade entro un'ora. Gli autori delle versioni sono conservati come
   etichette pseudonime (`Autore 1`, `Autore 2`) più un hash SHA-256
   dell'identità; il nome visualizzato è salvato solo in modalità FULL e
   **non compare mai** nell'input per LLM.
5. **Nessuna interpretazione automatica.** Non esistono punteggi di
   sospetto né attribuzioni di origine del testo. Il dataset descrive versioni.
   Le stime di tempo e di ritmo (parole per ora) derivano dai soli orari
   delle versioni, sono etichettate come stime ovunque compaiano e sono
   accompagnate dalle relative avvertenze.

## Modalità

| | FULL | METRICS_ONLY |
|--|--|--|
| Testo delle versioni | sì | no (solo hash, conteggi, hash per paragrafo) |
| Estratti nei diff e negli inserimenti | sì | no |
| Nome degli autori | sì (solo localmente) | no (solo etichetta e hash) |
| `final.txt` | sì | nota "non disponibile in METRICS_ONLY" |
| Metriche, timeline, coverage | sì | sì |

La modalità si sceglie nelle impostazioni e viene fissata alla prima
analisi di ciascun documento (evita dataset misti).

## Identificativi

`studentId`, `assignmentId`, `courseId` sono opzionali e compilati dal
docente; l'interfaccia suggerisce pseudonimi.

## Permessi richiesti (Manifest V3)

- `storage`: impostazioni.
Nessuno di questi permessi produce un avviso al momento dell'installazione.

- `activeTab`: leggere l'URL della tab attiva, solo quando il docente clicca
  l'icona, per riconoscere il documento.
- `optional_host_permissions` su `https://*.sharepoint.com/*`: alla prima
  analisi, con un click, si concede l'accesso al solo sito SharePoint del
  documento (per esempio `scuola-my.sharepoint.com`), non a tutti. Serve
  perché le fetch dalle pagine dell'estensione portino i cookie di
  sessione. Revocabili da *Impostazioni → Revoca l'accesso ai siti
  SharePoint*. Nessun `<all_urls>`, nessun content script, nessun service
  worker.
- `identity`: apre la schermata di consenso Google (`launchWebAuthFlow`)
  per ottenere il token della Drive API. Nessun accesso all'account del
  browser.
- `optional_host_permissions` su `www.googleapis.com` e `docs.google.com`:
  richiesti solo alla prima analisi di un documento Google, con un click
  del docente; chi usa solo SharePoint non li concede mai. Le richieste
  verso questi host portano solo il token OAuth, mai i cookie. Revocabili
  da *Impostazioni → Disconnetti Google e revoca il permesso*.

## Integrità

Ogni versione ha un SHA-256 del testo e dei byte del DOCX (scaricato da
SharePoint o esportato da Google Drive); il log delle
operazioni di analisi è una hash chain. Serve a rilevare **alterazioni
accidentali** del dataset esportato. **Non è una garanzia forense**: chi
controlla il browser può alterare i dati prima dell'export. Il report lo
dichiara.

## Cancellazione

Process View → *Elimina dati di questo documento* oppure *Elimina tutti i
dati*. Immediata e non reversibile. I dati sul server (SharePoint o Google
Drive) non vengono mai toccati.
