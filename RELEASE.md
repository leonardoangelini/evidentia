# Release — Chrome Web Store

Workflow: [`.github/workflows/ci.yml`](.github/workflows/ci.yml) esegue
typecheck + test e produce lo ZIP come artefatto su ogni push e pull request.
[`.github/workflows/release.yml`](.github/workflows/release.yml) pubblica, e
parte solo su un tag `vX.Y.Z` (o a mano da *Actions → Run workflow*). Con dei
reviewer configurati sull'environment `chrome-web-store` il rilascio resta
**manuale**, perché ogni submission entra nella review di Google.

## 1. Primo caricamento — a mano, una volta sola

L'API del Chrome Web Store aggiorna un'estensione esistente: non può crearne
una. Il primo upload va fatto dalla dashboard.

1. <https://chrome.google.com/webstore/devconsole> (account con i 5 $ già pagati).
2. Build locale: `npm run zip` → `.output/evidentia-<version>-chrome.zip`.
3. "Add new item", carica lo ZIP.
4. Compila la scheda: descrizione, almeno **1 screenshot 1280×800**, icona 128
   (`public/icon/128.png`), categoria, lingua, URL privacy. Testi pronti da
   incollare: [STORE_LISTING.md](STORE_LISTING.md).
5. Sezione **Privacy practices**: dichiara l'uso di `storage`, `tabs`,
   `identity`, dei permessi host `*.sharepoint.com` e di quelli opzionali
   Google. Motiva ogni permesso — è la causa più frequente di rifiuto.
   Contenuti utili: [PRIVACY.md](PRIVACY.md), [STORE_LISTING.md](STORE_LISTING.md).
6. Pubblica e attendi la review.
7. Annota dalla dashboard:
   - **Extension ID** (32 lettere, nell'URL della pagina dell'item)
   - **Publisher ID** (dashboard → `Publisher → Settings`; è l'UUID che
     compare anche nell'URL della devconsole)

## 2. Service account Google (auth per la CI)

Guida ufficiale: <https://developer.chrome.com/docs/webstore/service-accounts>

1. Crea/usa un progetto su <https://console.cloud.google.com>.
2. Abilita la **Chrome Web Store API**.
3. Crea un **service account** e scarica la chiave **JSON**
   (nella guida: sezione "Obtain access tokens" → "Use a JSON Web Token";
   fermati dopo il download).
4. Nella dashboard del Web Store, sezione **Account**, incolla l'email del
   service account nel campo dedicato e salva. È questo passo a concedere
   l'accesso all'API — non serve un group publisher, ma si può collegare **un
   solo service account per publisher**. Se manca, la API risponde
   `403 PERMISSION_DENIED` su `publishers/<id>/items/<id>` anche quando il
   token OAuth viene emesso correttamente.
5. Dal JSON servono `client_email` e `private_key`.

### Fallback: API v1.1 (OAuth refresh token)

Deprecata da Google ma ancora funzionante, e non richiede di collegare un
service account al publisher: autentica come utente.
Si crea un OAuth client "Desktop app" nel progetto Cloud, si ottiene un refresh
token con `npx publish-extension init` e si usano queste variabili al posto di
publisher ID + service account:

| Variabile | Note |
|---|---|
| `CHROME_CLIENT_ID` | OAuth client |
| `CHROME_CLIENT_SECRET` | OAuth client |
| `CHROME_REFRESH_TOKEN` | dal flow di `init` |

Nel workflow si toglie `--chrome-api-version v2` e la riga che decodifica la
chiave base64. Attenzione: se la schermata di consenso OAuth resta in
"Testing", il refresh token scade dopo 7 giorni — va messa "In production".

## 3. Secret e variabili su GitHub

`Settings → Secrets and variables → Actions`.

Come **secret** (scheda *Secrets*):

| Secret | Valore |
|---|---|
| `CHROME_EXTENSION_ID` | ID dell'item dal punto 1 |
| `CHROME_PUBLISHER_ID` | Publisher ID dal punto 1 |
| `CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL` | `client_email` del JSON |
| `CHROME_SERVICE_ACCOUNT_PRIVATE_KEY_B64` | `private_key` in base64 (vedi sotto) |

Come **variabile** (scheda *Variables*, non è un segreto: finisce nel bundle):

| Variabile | Valore |
|---|---|
| `WXT_GOOGLE_CLIENT_ID` (opzionale) | client ID OAuth compilato nella build per Google Docs; se assente, ogni docente lo inserisce nelle impostazioni. Vedi [GOOGLE_DOCS_NOTES.md](GOOGLE_DOCS_NOTES.md). |

La chiave PEM contiene a-capo: si conserva in base64 e il workflow la decodifica.

```sh
node -p "Buffer.from(require('./sa.json').private_key).toString('base64')"
```

### Approvazione manuale del rilascio

`Settings → Environments → New environment` → `chrome-web-store`, poi
*Required reviewers* con te stesso. Il job di release si ferma in attesa del
tuo OK prima di caricare qualsiasi cosa. Senza environment il rilascio sul tag
parte senza conferma: con un repo pubblico e i secret in gioco, conviene
configurarlo.

> Su un repository pubblico i secret **non** sono esposti alle pull request
> provenienti da un fork: GitHub non li passa. Il workflow di release non gira
> comunque sulle PR, solo sui tag e su `workflow_dispatch`.

## 4. Rilasciare una versione

```sh
npm version patch          # aggiorna package.json (e la version del manifest)
git push && git push --tags
```

Il push del tag avvia il workflow *Release*; se l'environment ha dei reviewer,
approva da *Actions* o dalla notifica. Il job rifiuta il rilascio se il tag non
corrisponde alla `version` di `package.json` — il Web Store rigetta un upload
con una version già usata.

Prima del primo rilascio conviene una prova a vuoto: *Actions → Release → Run
workflow*, lasciando `dry_run` su `true`. Verifica credenziali e ZIP senza
caricare nulla.

## Note

- **Edge**: stesso ZIP. Si aggiunge `--edge-zip` al comando di publish con le
  credenziali del Partner Center.
- La CI usa `publish-browser-extension` (già dipendenza di wxt) con l'API v2 del
  Web Store, quella basata su service account.
- La versione di Node nei workflow (`26`) va tenuta allineata a quella di
  sviluppo; il minimo supportato è dichiarato in `engines` di `package.json`.
- Per caricare senza sottomettere a review: `--chrome-skip-submit-review`.
