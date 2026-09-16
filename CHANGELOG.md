# Changelog

Che cosa cambia, versione per versione, dal punto di vista di chi usa
Evidentia. Le modifiche interne — CI, documentazione, rifacimenti che non si
vedono — restano nella storia di git.

Questo file è incluso nell'estensione: è quello che la scheda *Info* mostra
senza bisogno di collegarsi a internet. Va aggiornato **prima** di alzare la
`version` in `package.json` (vedi [docs/release.md](docs/release.md)).

## 0.2.0 — 2026-09-16

Interfaccia semplificata: meno schede, meno numeri in primo piano, tutto in
italiano.

- **Cinque schede** al posto di tredici: *Panoramica*, *Cronologia* (grafico,
  sessioni e tempo stimato insieme), *Contenuti*, *Versioni* (ogni versione
  con il passaggio dalla precedente: tipo di cambiamento, parole aggiunte,
  eliminate e sostituite, grandi inserimenti con estratto, confronto parola
  per parola) e *Copertura* (gap, versioni non leggibili, limiti, autori,
  integrità). *Glossario*, *Impostazioni*, *Info* e *Dati grezzi* stanno in
  fondo alla barra laterale.
- La **Panoramica** mostra sei numeri e un blocco *Da guardare* con i grandi
  inserimenti, i passaggi con revisione e i gap; un click porta al dettaglio.
  Parole per ora, mediane e intensità di revisione non compaiono più come
  card: restano nelle tabelle e negli export, con le loro definizioni.
- Senza documenti la Process View propone i **casi demo**; con documenti
  restano dietro *Carica un caso demo…* in fondo alla barra laterale. *Elimina
  tutti i dati* è nelle Impostazioni.
- I vecchi indirizzi delle schede (`#timeline`, `#gaps`…) portano alla scheda
  che le ha assorbite.
- Export: `schemaVersion` 2.2 per l'input LLM ed `exportVersion` 1.1 per lo
  ZIP. `sessions.json` non ha più `netWordChange` (doppione di `netWords` in
  `time-estimates.json`); `metrics.json` non ha più `insertionsOver300Words` e
  `insertionsOver1000Words` (soglie fisse sovrapposte a quella configurabile).

## 0.1.2 — 2026-09-16

- La versione installata compare nell'interfaccia: in fondo al popup e in
  fondo alla colonna sinistra della Process View. Una segnalazione dice così
  sempre quale pacchetto era in uso.
- Nuova scheda **Info**: versione, novità, licenza e contatti.
- La descrizione del pacchetto rientra nei 132 caratteri richiesti dal Chrome
  Web Store.

## 0.1.1 — 2026-09-15

- Nessuna modifica visibile: versione di servizio, per provare la
  pubblicazione automatica sullo store.

## 0.1.0 — 2026-09-15

Prima versione pubblicata.

- Ricostruisce il processo di scrittura di un documento dalla cronologia
  delle versioni che il server conserva già: **Word su SharePoint /
  OneDrive** e **Google Docs** attraverso le revisioni di Google Drive.
- Timeline, sessioni di lavoro, tempo stimato, evoluzione dei contenuti per
  fase, grandi inserimenti, statistiche di revisione.
- **Observation gaps**: ciò che i dati non possono mostrare, dichiarato
  accanto a ciò che mostrano. Il tempo è sempre una stima, mai un'osservazione.
- Export per Copilot e altri LLM (`.docx`, `.md`) ed export ZIP completo con
  i dati grezzi.
- Glossario di ogni valore mostrato, ripreso nei tooltip e negli export.
- Modalità privacy `METRICS_ONLY`: solo conteggi, hash ed etichette
  pseudonime, senza il testo delle versioni.
- Dati demo per esplorare l'interfaccia senza un documento vero.
- Tutti i dati restano nel browser: nessun server, nessuna telemetria.
