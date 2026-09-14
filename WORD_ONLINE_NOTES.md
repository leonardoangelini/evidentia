# Evidentia — SharePoint / Word Online Notes

Come Evidentia legge la cronologia delle versioni di un documento Word su
SharePoint Online / OneDrive for Business, cosa è affidabile, cosa non lo
è. Il codice specifico è confinato in `src/sharepoint/` e `src/docx/`.
Per Google Docs vedi [GOOGLE_DOCS_NOTES.md](GOOGLE_DOCS_NOTES.md).

## 1. Come si riconosce il documento

Dall'URL della tab (`chrome.tabs`, senza content script):

```text
https://<tenant>-my.sharepoint.com/:w:/r/personal/<utente>/_layouts/15/doc2.aspx?sourcedoc={GUID}&file=Nome.docx
https://<tenant>.sharepoint.com/sites/<sito>/_layouts/15/Doc.aspx?sourcedoc={GUID}&file=Nome.docx
https://<tenant>-my.sharepoint.com/personal/<utente>/Documents/Cartella/Nome.docx?d=w<guid>
```

- `siteUrl` = origin + percorso fino a `/_layouts/` (oppure `/personal/<x>`,
  `/sites/<x>`, `/teams/<x>`); il prefisso di condivisione `/:w:/r/` viene rimosso.
- `fileId` = `sourcedoc` (o `d`) normalizzato a GUID minuscolo.
- Word Online in sé (l'iframe `*.officeapps.live.com`) non viene toccato.

## 2. API usate (tutte GET, con i cookie del docente)

```text
{siteUrl}/_api/web/GetFileById('{fileId}')
    ?$select=UniqueId,Name,ServerRelativeUrl,LinkingUrl,TimeCreated,TimeLastModified,UIVersionLabel,Length
{siteUrl}/_api/web/GetFileById('{fileId}')/Versions
    ?$select=ID,VersionLabel,Created,Size,Url,CreatedBy/Title,CreatedBy/Email,CreatedBy/LoginName&$expand=CreatedBy
{siteUrl}/{version.Url}            → DOCX della versione (es. _vti_history/512/Documents/Nome.docx)
{siteUrl}/_api/web/GetFileById('{fileId}')/$value   → DOCX corrente
```

Header `Accept: application/json;odata=nometadata`, `credentials: 'include'`.
La chiamata va fatta **sul sito del documento** (`/personal/...`), non
sulla radice del tenant: altrimenti 404 "File non trovato".

Verificato il 12/09/2026 su un tenant Microsoft 365 di ateneo: elenco versioni con
autore (Title, Email), download del corrente (`application/octet-stream`,
firma `PK`) e di una versione storica (`application/vnd.openxmlformats-...`).

## 3. Autenticazione

Le pagine dell'estensione, avendo host permission su `*.sharepoint.com`,
inviano i cookie di sessione (FedAuth/rtFa). Se la sessione è scaduta o il
browser è stato riavviato senza "Resta connesso", la API risponde
`403 Attempted to perform an unauthorized operation` e l'estensione mostra:
"Verifica di essere autenticato su Microsoft 365 nel browser e di avere
accesso al documento". Basta aprire il documento e ripetere l'analisi.

## 4. Estrazione del testo dal DOCX

`word/document.xml` viene letto con `DOMParser` (namespace
`wordprocessingml/2006/main`):

- paragrafi `w:p` → testo dei `w:t`; `w:tab`, `w:br`, `w:cr` → spazio;
  paragrafi vuoti ignorati; tabelle incluse (le celle contengono `w:p`);
- revisioni tracciate: `w:del`/`w:delText` esclusi, `w:ins` incluso
  (coerente con "Tutte le revisioni" di Word);
- titoli: `w:pStyle` con id `Heading1..9` o nome localizzato
  (`Titolo 1`, `Título 1`, `Titre 1`, `Überschrift 1`, letto da
  `word/styles.xml`), oppure `w:outlineLvl`;
- esclusi: intestazioni, piè di pagina, note, commenti, caselle di testo
  in `word/header*.xml` ecc.

Word count: token separati da spazi dopo normalizzazione (stesso algoritmo
per tutto il sistema). Può differire leggermente dal conteggio di Word.

## 5. Che cosa produce il salvataggio automatico

Word Online salva in continuazione e SharePoint crea una **nuova versione
minore** con cadenza variabile (tipicamente ogni pochi minuti di modifica,
mai per ogni tasto). Di conseguenza:

- una versione è un'istantanea del testo a un istante: fra due versioni non
  si sa nulla;
- l'intervallo fra versioni non misura il tempo di lavoro;
- le "sessioni" sono raggruppamenti di versioni vicine (`sessionGapMinutes`).

## 6. Limiti strutturali (sempre dichiarati nel report)

1. Versioni cancellate o consolidate dal server non sono rilevabili.
2. Il limite di versioni della raccolta (impostazione SharePoint, spesso
   500) può aver eliminato le più vecchie.
3. Modifiche con Word desktop o via sincronizzazione appaiono come versioni
   indistinguibili.
4. L'autore di una versione è chi l'ha salvata, non necessariamente chi ha
   scritto.
5. Se la prima versione contiene già molto testo, la stesura non è
   osservabile (`BEFORE_FIRST_VERSION`).
6. OneDrive consumer (onedrive.live.com) non espone `_api`: non supportato.

## 7. Performance

Un documento di 20.000 parole è un DOCX di poche centinaia di KB; 100
versioni sono decine di MB scaricati una volta sola (le versioni già
presenti non vengono riscaricate). Le diff sono ricalcolate per intero a
ogni import; per 100 versioni di 500 paragrafi restano sotto il secondo.

## 8. Verifica manuale consigliata

1. Apri un documento Word su SharePoint/OneDrive, clicca l'icona di Evidentia.
2. *Analizza cronologia versioni* → la Process View mostra l'avanzamento.
3. Verifica in *Versions* date, autori, conteggi; confronta due versioni.
4. *Observation gaps* elenca ciò che non è osservabile.
5. *Export ZIP* → apri `report/process-report.html`.
