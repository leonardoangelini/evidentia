# Evidentia — regole per chi lavora con un agente

Estensione Chrome/Edge per docenti: ricostruisce il processo di scrittura di
un documento dalla cronologia versioni di SharePoint/OneDrive o Google Docs.
Testi dell'interfaccia e documentazione in italiano, commenti nel codice in
inglese. Il resto è in [CONTRIBUTING.md](CONTRIBUTING.md) e in `docs/`.

## Versione e changelog vanno alzati insieme

Ogni modifica visibile a chi usa Evidentia chiude con **entrambi**, nello
stesso lavoro, senza aspettare che venga chiesto:

1. una voce `## <version> — <data>` in cima a [CHANGELOG.md](CHANGELOG.md);
2. la stessa `version` in `package.json` e `package-lock.json`
   (`npm version <patch|minor|major> --no-git-tag-version`, oppure a mano).

Il test `tests/changelog.test.ts` fallisce se le due divergono. Non esiste
una versione "in sospeso": il CHANGELOG aggiornato con la version ferma è un
lavoro non finito. Il push su `main` con la version nuova pubblica sullo
store ([docs/release.md](docs/release.md)): il bump si fa sempre, il
commit e il push solo quando l'utente li chiede.

Cosa è "visibile": interfaccia, popup, export, permessi, comportamento
dell'analisi. Non lo sono CI, documentazione, refactoring senza effetti.

## Vincoli che una modifica non può violare

- Ogni valore mostrato ha una voce in `src/analysis/glossary.ts`, etichettata
  osservato / derivato / stima, e la sua icona "i".
- Nessun punteggio di sospetto, nessuna attribuzione d'autore, nessun
  rilevamento di AI. Il tempo è sempre una stima, mai un'osservazione.
- Tutto resta nel browser: nessun server, nessuna telemetria.
- Niente dati di tenant reali in test, documentazione, issue e screenshot:
  si usano i casi demo (`src/demo/cases.ts`).

## Verifica

`npm run typecheck && npm test && npm run build`. Dopo un cambio di
interfaccia: `npm run store:shots` rigenera gli screenshot dello store da
`.output/chrome-mv3` (serve `npx playwright-core install chromium` una volta).
