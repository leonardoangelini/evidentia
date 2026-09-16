# Contribuire a Evidentia

Grazie dell'interesse. Segnalazioni, correzioni e discussioni sul metodo sono
tutte benvenute — anche da chi non scrive codice: un docente che descrive un
caso reale in cui l'analisi risulta fuorviante è un contributo prezioso.

## Prima di aprire una pull request

Apri prima una **issue** se la modifica cambia il comportamento visibile, il
modello dati o il modo in cui un dato viene presentato. Evidentia fa
affermazioni su come è stato scritto un testo, e queste affermazioni finiscono
in un contesto valutativo: vale la pena discuterle prima di implementarle.

Per correzioni evidenti (bug, refuso, dipendenza) vai pure diretto alla PR.

## Ambiente

```bash
npm install
npm run dev            # Chrome con l'estensione caricata e ricarica automatica
npm run typecheck
npm test
```

Serve Node ≥ 20 (lo sviluppo avviene su Node 26). `npm run dev` usa un profilo
Chrome dedicato in `.wxt/chrome-profile`, così il login Microsoft 365 resta fra
un avvio e l'altro.

Per lavorare sull'interfaccia senza un documento reale ci sono i **casi demo**
(pagina iniziale della Process View, o *Carica un caso demo…* in fondo alla
barra laterale): cronologie sintetiche che coprono i casi
limite. Usali anche negli screenshot: nessun documento reale deve finire nel
repository, nelle issue o nelle PR.

## Requisiti di una PR

- `npm run typecheck` e `npm test` passano.
- Il comportamento nuovo o modificato ha un test in `tests/`.
- Nessun dato reale nei test: usa `contoso.sharepoint.com`, nomi di fantasia,
  identificativi inventati. Guarda `tests/locator.test.ts` come riferimento.
- Commit in inglese o in italiano, purché il messaggio dica *perché*.
- Se la modifica si vede (interfaccia, popup, export, permessi, analisi):
  voce nuova in cima a `CHANGELOG.md` **e** `version` alzata in `package.json`
  e `package-lock.json`, nella stessa PR. Il test `tests/changelog.test.ts`
  fallisce se le due divergono; il push su `main` con la version nuova
  pubblica sullo store ([docs/release.md](docs/release.md)).

## Vincoli di progetto da rispettare

Questi non sono dettagli di stile: sono il motivo per cui il progetto ha la
forma che ha. Una PR che li viola verrà discussa prima di essere accettata.

1. **Tutto resta nel browser.** Nessuna chiamata di rete verso terzi, nessuna
   telemetria, nessun invio di testo a un servizio esterno. Le uniche
   destinazioni sono il tenant SharePoint dell'utente e le API Google Drive.
2. **Nessun punteggio di sospetto, nessuna attribuzione dell'origine del
   testo.** Evidentia rende osservabile un processo; non dichiara chi ha
   scritto e non rileva l'uso di AI. Le PR che aggiungono un "indice di
   rischio", una percentuale di AI o simili non verranno accettate.
3. **Distinguere sempre osservato, derivato e stimato.** Ogni valore mostrato
   ha la sua etichetta e la sua definizione in `src/analysis/glossary.ts`, che
   è la sorgente unica per interfaccia, report HTML ed export. Un valore nuovo
   si aggiunge lì.
4. **Permessi minimi.** Niente `<all_urls>`, niente content script, niente
   service worker: le pagine dell'estensione fanno tutto. Un permesso in più
   nel manifest va motivato nella PR.
5. **Il token OAuth non tocca il disco**: `chrome.storage.session`, mai
   `local`. Vedi `src/google/google-auth.ts`.

## Licenza dei contributi

Il progetto è distribuito sotto [Apache License 2.0](LICENSE). Aprendo una pull
request accetti che il tuo contributo sia distribuito con la stessa licenza
(Apache-2.0, sezione 5). Non serve firmare un CLA.

## Segnalazioni di sicurezza

Non aprire una issue pubblica: vedi [SECURITY.md](SECURITY.md).
