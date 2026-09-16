# Evidentia — Google Docs / Google Drive Notes

Come Evidentia legge la cronologia delle revisioni di un documento Google
Docs (o di un file Word conservato in Google Drive), cosa è affidabile,
cosa non lo è, e cosa serve per attivare il supporto. Il codice specifico
è confinato in `src/google/`; l'estrazione del testo riusa `src/docx/`
perché ogni revisione viene esportata in DOCX.

## 1. Come si riconosce il documento

Dall'URL della tab (`chrome.tabs`, senza content script):

```text
https://docs.google.com/document/d/<fileId>/edit
https://docs.google.com/document/u/1/d/<fileId>/edit
https://docs.google.com/a/<dominio>/document/d/<fileId>/edit
https://drive.google.com/file/d/<fileId>/view        (file .docx in Drive)
https://drive.google.com/open?id=<fileId>
```

Fogli, Presentazioni e cartelle non sono riconosciuti. L'URL non contiene
il nome del file: arriva dall'API.

## 2. API usate (Drive API v3, tutte GET, con token OAuth)

```text
GET https://www.googleapis.com/drive/v3/files/{fileId}
      ?fields=id,name,mimeType,createdTime,modifiedTime,size,webViewLink,lastModifyingUser(...)
GET https://www.googleapis.com/drive/v3/files/{fileId}/revisions
      ?fields=nextPageToken,revisions(id,modifiedTime,size,mimeType,keepForever,exportLinks,lastModifyingUser(...))
      &pageSize=1000[&pageToken=…]
GET {revision.exportLinks[docx]}                              → DOCX della revisione (Google Doc nativo)
GET https://www.googleapis.com/drive/v3/files/{fileId}/export?mimeType=…docx   → DOCX corrente (Google Doc nativo)
GET …/files/{fileId}/revisions/{revisionId}?alt=media          → revisione di un file Word in Drive
GET …/files/{fileId}?alt=media                                 → file Word corrente in Drive
```

Header `Authorization: Bearer <token>`, `credentials: 'omit'` (mai cookie).
I link di esportazione delle revisioni puntano a `docs.google.com`, per
questo l'host è fra i permessi opzionali insieme a `www.googleapis.com`.

### Revisione di testa e versione corrente

A differenza di SharePoint, l'elenco delle revisioni di Drive include lo
stato attuale (l'ultima revisione). Evidentia la esclude dalle versioni
passate quando il suo `modifiedTime` coincide con quello del file (±2 s):
in quel caso la "versione corrente" scaricata con `export` è lo stesso
contenuto. Se il file è stato modificato dopo l'ultima revisione (Drive
non ne ha ancora creata una nuova), la revisione di testa resta una
versione passata e il corrente è un'istantanea in più.

Le etichette delle versioni sono il numero progressivo della revisione
(1, 2, 3…); l'id di revisione di Drive è il `versionId` conservato, quello
usato per non riscaricare ciò che è già presente.

## 3. Autenticazione: OAuth 2.0 senza server

`chrome.identity.launchWebAuthFlow` apre la schermata di consenso Google e
restituisce il token di accesso nel frammento dell'URL di ritorno
(`https://<id-estensione>.chromiumapp.org/`, implicit grant: nessun client
secret). Il token vive in `chrome.storage.session` (solo memoria, sparisce
alla chiusura del browser) per circa un'ora; prima di chiedere di nuovo il
consenso si tenta un rinnovo silenzioso (`prompt=none`).

Scope: `https://www.googleapis.com/auth/drive.readonly`. È l'unico scope che
dà accesso alle revisioni di un documento arbitrario a cui il docente ha
già accesso: lo scope più stretto `drive.file` copre solo i file scelti
tramite il Google Picker, che le pagine di un'estensione MV3 non possono
caricare (codice remoto). L'estensione chiama comunque solo gli endpoint
del documento in analisi.

### Cosa serve per attivare Google Docs

Serve un **client OAuth 2.0** in un progetto Google Cloud:

1. <https://console.cloud.google.com> → progetto → *API e servizi* →
   abilita **Google Drive API**.
2. *Schermata consenso OAuth*: tipo **Interno** se il progetto è in una
   organizzazione Google Workspace (scuola/università): vale per tutti
   gli utenti del dominio, senza verifica di Google. Tipo *Esterno* per
   tutti gli altri casi (vedi sotto).
3. *Credenziali* → *Crea credenziali* → **ID client OAuth** → tipo
   **Applicazione web** → URI di reindirizzamento autorizzato:
   `https://<id-estensione>.chromiumapp.org/` (l'id esatto è mostrato
   nelle impostazioni di Evidentia, sezione Google Docs).
4. Il client ID (`….apps.googleusercontent.com`) va:
   - nelle **impostazioni di Evidentia** (ogni docente o la scuola per i
     propri docenti), oppure
   - nella **build**, con la variabile `WXT_GOOGLE_CLIENT_ID` (file `.env`
     in locale, *Actions variable* su GitHub): diventa il valore predefinito
     quando il campo nelle impostazioni è vuoto.

> Chi installa Evidentia dal Chrome Web Store usa il client ID della build
> ufficiale. Chi **forka** il progetto deve registrarne uno proprio: usare il
> client ID altrui significa consumarne la quota e mostrare il nome del suo
> progetto Cloud nella schermata di consenso.

#### Due id, un solo client

L'estensione ha **due id diversi**, e quindi due redirect URI: quello
assegnato dal Chrome Web Store all'item pubblicato, e quello delle build
locali. Non servono due client OAuth — un client di tipo *Applicazione web*
accetta più **URI di reindirizzamento autorizzati**. Registrali entrambi
sullo stesso client:

```text
https://<id-item-sullo-store>.chromiumapp.org/
https://<id-build-locale>.chromiumapp.org/
```

L'ID di un'estensione caricata non pacchettizzata dipende dal percorso della
cartella (e `npm run dev` usa `.output/chrome-mv3-dev`, un percorso diverso
dalla build), quindi cambierebbe di continuo. Per fissarlo, `wxt.config.ts`
mette nel manifest la chiave pubblica `WXT_EXTENSION_KEY` letta da `.env`
(vedi `.env.example` per generarla): con la chiave l'id è lo stesso in ogni
profilo e cartella, ed è quello da registrare come redirect URI di sviluppo.
Per leggerlo, carica la build in `chrome://extensions` — oppure aprilo dalle
impostazioni di Evidentia, sezione Google Docs, che mostrano il redirect URI
completo.

In CI la variabile non esiste, quindi lo ZIP per lo store non contiene la
chiave e l'item usa l'id assegnato dallo store.

### Verifica di Google (schermata "Esterno")

`drive.readonly` è uno scope **restricted**: un'app pubblicata con
consenso *Esterno* in stato "In produzione" richiede la verifica di Google
(revisione dell'app e, per gli scope restricted, una valutazione di
sicurezza CASA a pagamento). Senza verifica il client resta in stato
"Test": fino a 100 utenti di prova elencati a mano, con un avviso "app
non verificata" al consenso. Per una scuola con Google Workspace la via
pratica è il consenso **Interno**, che non richiede nulla di tutto ciò.

## 4. Permessi

- `identity`: per `launchWebAuthFlow`.
- `optional_host_permissions` su `https://www.googleapis.com/*` e
  `https://docs.google.com/*`: richiesti con un click nella Process View la
  prima volta che si analizza un documento Google; chi usa solo SharePoint
  non li concede mai. *Disconnetti Google e revoca il permesso* nelle
  impostazioni dimentica il token, lo revoca presso Google (best effort)
  e ritira i permessi host.

## 5. Che cosa produce il salvataggio automatico su Google

Google Docs salva in continuazione e conserva internamente una cronologia
dettagliata delle modifiche. **L'API Drive espone però solo una parte di
queste revisioni**, più rada della cronologia dettagliata visibile
nell'editor, e Google può accorpare nel tempo le revisioni non
contrassegnate "conserva per sempre" (`keepForever`). Di conseguenza:

- la granularità è decisa da Google, non dall'estensione, e non è
  prevedibile a priori;
- le revisioni "con nome" (versioni salvate dal docente o dallo studente)
  sono sempre presenti;
- gli endpoint interni usati dall'editor per la cronologia dettagliata
  non sono documentati né stabili: non vengono usati per scelta.

Come per SharePoint: fra due revisioni non è osservato nulla; l'intervallo
non misura il tempo di lavoro; le sessioni sono raggruppamenti di
revisioni vicine.

## 6. Limiti strutturali (sempre dichiarati nel report)

1. Revisioni accorpate o cancellate da Google non sono rilevabili.
2. La granularità delle revisioni via API è più rada della cronologia
   dettagliata di Google Docs.
3. Modifiche da app mobile, offline o importazione compaiono come revisioni
   indistinguibili.
4. L'autore di una revisione è chi l'ha salvata secondo Drive; per file
   condivisi con link l'identità può mancare (autore nullo) o essere
   disponibile solo come `permissionId` (Drive non espone sempre l'email).
5. Se la prima revisione contiene già molto testo, la stesura non è
   osservabile (`BEFORE_FIRST_VERSION`).
6. Limite di esportazione Google: 10 MB per esportazione (documenti molto
   lunghi con immagini possono fallire con `exportSizeLimitExceeded`; la
   versione viene marcata `UNAVAILABLE`).

## 7. Estrazione del testo

L'esportazione DOCX di Google Docs usa gli stili `Heading 1…6` (id
`Heading1`, nome `heading 1`): i titoli vengono riconosciuti dallo stesso
estrattore di Word. Il resto (tabelle, revisioni tracciate, intestazioni
escluse) segue [sharepoint.md](sharepoint.md) §4.

## 8. Verifica manuale consigliata

1. Apri un documento Google Docs, clicca l'icona di Evidentia: il popup
   indica "Google Docs · revisioni di Google Drive".
2. *Analizza cronologia versioni* → nella Process View: concedi l'accesso a
   Google Drive (una volta) → consenso Google → avanzamento.
3. Verifica in *Versioni* date, autori, conteggi; confronta due revisioni.
4. *Copertura* elenca i limiti specifici di Google Drive.
5. *Export ZIP* → `manifest.json` riporta `source: GOOGLE_DRIVE_REVISIONS`.
