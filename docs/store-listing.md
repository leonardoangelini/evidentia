# Scheda Chrome Web Store — testi pronti

Da incollare nella dashboard al primo caricamento (vedi [release.md](release.md)).
Listing in italiano, giustificazioni dei permessi in inglese: le legge un
revisore Google.

## Categoria

**Education** (primaria). È la categoria in cui un docente cerca uno strumento
di questo tipo. Alternativa difendibile: *Workflow & Planning*, ma sposta
l'estensione fra i tool di produttività generici e la rende meno trovabile dal
pubblico giusto.

Lingua del listing: **Italiano**.

## Nome (max 75 caratteri)

```
Evidentia — evidenze del processo di scrittura
```

## Descrizione breve (max 132 caratteri)

```
Ricostruisce il processo di scrittura di un documento Word o Google Docs dalla cronologia delle versioni. Tutto in locale.
```

## Descrizione dettagliata

```
Evidentia mostra al docente come è stato scritto un documento, a partire dalla cronologia delle versioni che il server conserva già per quel file: SharePoint / OneDrive for Business per un documento Word, Google Drive per un documento Google Docs.

Evidentia non è un rilevatore di intelligenza artificiale. Non attribuisce la paternità del testo, non assegna punteggi di sospetto, non dice se un testo sia stato generato da un'AI. Rende osservabile una parte del processo di scrittura — quella conservata dal server — e lascia l'interpretazione al docente.

COME FUNZIONA

Apri un documento Word su SharePoint o OneDrive for Business con il tuo account Microsoft 365 di scuola o di lavoro, oppure un documento Google Docs, clicca l'icona di Evidentia e avvia l'analisi. L'estensione legge le versioni che il server ha già salvato — data, autore, testo — e le trasforma in una ricostruzione leggibile. Per Google Docs viene chiesto una volta il consenso a leggere Google Drive (revocabile in qualsiasi momento).

COSA MOSTRA

• Panoramica: i numeri essenziali del documento e i punti da guardare (grandi inserimenti, revisioni, gap)
• Cronologia: parole per versione, sessioni di lavoro, tempo stimato per sessione e per giornata, intervalli lunghi; il grafico mostra i dettagli di ogni versione al passaggio del mouse
• Contenuti: quali sezioni e paragrafi sono comparsi, cambiati o scomparsi in ogni sessione, da dove viene ogni paragrafo del testo finale, quale testo è stato eliminato
• Versioni: ogni versione con il passaggio dalla precedente (tipo di cambiamento, parole aggiunte ed eliminate, grandi inserimenti con estratto) e il confronto parola per parola fra due versioni qualsiasi
• Copertura: ciò che la cronologia non copre, dichiarato esplicitamente
• Glossario: ogni valore ha la sua definizione ed è etichettato Osservato, Derivato o Stima
• Export: report HTML, archivio ZIP con i dati grezzi, documento pronto da allegare a Copilot, ChatGPT o Claude

PRIVACY

Tutti i dati restano nel browser. Evidentia non ha server, non invia telemetria, non usa analytics, non chiama nessuna API di intelligenza artificiale. Le uniche richieste di rete sono letture verso il server del documento: il sito SharePoint con la sessione Microsoft 365 già attiva del docente, oppure l'API di Google Drive con il consenso Google del docente. Sono gli stessi dati a cui ha già accesso dal browser. Nulla viene letto finché non premi "Analizza cronologia versioni". I dati raccolti sono consultabili, esportabili e cancellabili in qualsiasi momento, per singolo documento o tutti insieme. Una modalità "solo metriche" conserva conteggi e impronte senza il testo.

LIMITI

• Fra due versioni non è osservato nulla: niente digitazione, niente incolla, niente tempo attivo
• Il tempo di lavoro è una stima ricavata dagli orari delle versioni, non una misura
• L'autore di una versione è chi l'ha salvata, non necessariamente chi l'ha scritta
• Le versioni cancellate o consolidate dal server non sono rilevabili; per Google Docs l'API espone solo una parte delle revisioni, più rada della cronologia dettagliata dell'editor
• Le impronte di integrità rilevano alterazioni accidentali del dataset: non sono una prova forense

REQUISITI

Per Word: account Microsoft 365 di scuola o di lavoro con accesso al documento (SharePoint Online / OneDrive for Business); OneDrive personale non è supportato. Per Google Docs: account Google con accesso al documento; la scuola può usare il proprio client OAuth (impostazioni).
```

## Privacy practices — testi in inglese

### Single purpose

```
Evidentia has a single purpose: to let a teacher review the version history of one document they already have access to — the SharePoint / OneDrive for Business versions of a Word document, or the Google Drive revisions of a Google Docs document — and present it as a readable reconstruction of how that document was written. All processing and storage happen locally in the browser.
```

### Permesso `storage`

```
Stores the user's own settings (privacy mode, session threshold, session start-up margin, optional OAuth client id) in chrome.storage.local, and keeps the short-lived Google OAuth access token in chrome.storage.session (memory only). No document content and no personal data are stored through this permission.
```

### Permesso `activeTab`

```
When the teacher clicks the extension icon, the popup reads the URL of the active tab to recognise which SharePoint or Google Docs document is open. activeTab grants this only for the tab the teacher clicked on, only at that moment. Tab contents are never read and no other tab is accessed.
```

### Optional host permissions (`https://*.sharepoint.com/*`)

```
Requested at runtime, from a click, for the one SharePoint site that hosts the document being analysed (for example https://school-my.sharepoint.com/*), never for all of *.sharepoint.com at once. The extension then reads the version history and the version contents of that document with read-only GET requests issued from its own pages, which carry the teacher's existing Microsoft 365 session cookies. Granted sites can be revoked from the extension settings. The extension requests no <all_urls> permission, injects no content script and runs no background service worker.
```

### Permesso `identity`

```
Used only to run the Google OAuth 2.0 consent flow (chrome.identity.launchWebAuthFlow) when the teacher analyses a Google Docs document. The resulting access token is used for read-only Google Drive API requests about that one document and is kept in session memory. The extension does not read the browser's signed-in accounts (no identity.email).
```

### Optional host permissions (`https://www.googleapis.com/*`, `https://docs.google.com/*`)

```
Requested at runtime, from a click, only when the teacher analyses a Google Docs document. www.googleapis.com serves the Drive API (file metadata, revision list, DOCX export of the current content); docs.google.com serves the revision export links returned by the Drive API. All requests are read-only GETs authenticated with the OAuth token only (credentials omitted, no cookies) and concern the single document being analysed. The permission can be revoked from the extension settings. Teachers who only use SharePoint never grant it.
```

### Remote code

**No**, l'estensione non esegue codice remoto.

### Data usage

Nessuna categoria di dati raccolta: niente lascia il dispositivo. Gli export
sono file che l'utente salva localmente con un'azione esplicita, non una
trasmissione. Vanno spuntate le tre dichiarazioni finali (non vendo i dati a
terzi, non li uso per scopi estranei alla funzione dichiarata, non li uso per
valutare il merito creditizio).

## Immagini

- **Icona 128×128**: `public/icon/128.png`
- **Screenshot 1280×800**: cinque, già pronti in
  [store/screenshots/](../store/screenshots/), nell'ordine in cui caricarli.

  | # | File | Cosa mostra |
  |---|---|---|
  | 1 | `1-panoramica.png` | I numeri essenziali e i punti da guardare |
  | 2 | `2-cronologia.png` | Il grafico delle parole per versione, le sessioni e il tempo stimato |
  | 3 | `3-contenuti.png` | Cosa è comparso, cambiato o sparito in ogni sessione |
  | 4 | `4-confronto-versioni.png` | Il diff parola per parola fra due versioni |
  | 5 | `5-copertura.png` | Ciò che la cronologia non copre, dichiarato |

  Vengono dai casi demo, quindi nessun documento reale finisce in vetrina. Per
  rigenerarli dopo un cambio di interfaccia: `npm run build && npm run store:shots`
  (serve una volta `npx playwright-core install chromium` — Chrome stabile dalla
  137 ignora `--load-extension`, quindi lo script usa la build Chrome for Testing).
- **Tile promozionale 440×280**: in [brand/](../brand/).

## Da preparare prima

**URL della privacy policy**: campo obbligatorio e deve essere pubblicamente
raggiungibile. Con il repository pubblico su GitHub basta il permalink a
[PRIVACY.md](../PRIVACY.md):

    https://github.com/leonardoangelini/evidentia/blob/main/PRIVACY.md

In alternativa, GitHub Pages o una pagina sul proprio dominio. Va indicato
prima di inviare la scheda.
