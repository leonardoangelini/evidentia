# Evidentia — immagine coordinata

Marchio **"Fogli"**: tre versioni di un documento una sull'altra, la più
recente in primo piano con le sue righe di testo; la riga azzurra è il punto
in cui il testo si ferma oggi. Racconta ciò che l'estensione fa (leggere la
cronologia delle versioni) senza simboli di sorveglianza: niente lenti,
occhi, scudi o lucchetti.

Tutti i file sono generati da un'unica sorgente geometrica
(`src/marks.mjs`) con `npm run brand:build`. Non modificare i file generati:
modifica la sorgente e rigenera.

## Colori

| Nome | Hex | Uso |
| --- | --- | --- |
| Blu Evidentia | `#1D4ED8` | riquadro del marchio, accento dell'interfaccia |
| Azzurro | `#93C5FD` | riga "cursore", punti versione |
| Inchiostro | `#0F172A` | wordmark su fondo chiaro, fondi scuri |
| Carta | `#F7F9FC` | fondo chiaro |
| Blu per tema scuro | `#3B6FE6` | riquadro del marchio nell'interfaccia in tema scuro |

## Carattere

Wordmark: **Manrope ExtraBold**, spaziatura −3 %. Nei file SVG il testo è
convertito in tracciati, quindi non serve il font installato. I TTF
(`src/fonts/`, licenza SIL OFL 1.1) servono solo alla rigenerazione.
Interfaccia e report usano il font di sistema; nella barra laterale il nome
resta in maiuscoletto spaziato (`EVIDENTIA`) accanto al marchio monocromo.

## File

```text
svg/logo.svg                    marchio principale, riquadro blu (64×64)
svg/logo-small.svg              versione semplificata per 16–32 px (due fogli, righe più spesse)
svg/logo-mono.svg               monocromo, colore ereditato (currentColor); righe "a giorno": va su qualsiasi fondo
svg/logo-blue.svg               blu su trasparente
svg/logo-white.svg              bianco su trasparente, per fondi scuri
svg/lockup-horizontal.svg       marchio + wordmark (inchiostro)
svg/lockup-horizontal-white.svg marchio + wordmark bianco, per fondi scuri
svg/lockup-horizontal-mono.svg  marchio monocromo blu + wordmark blu (stampa a un colore)
svg/lockup-vertical.svg         marchio sopra il wordmark
svg/lockup-vertical-white.svg   idem per fondi scuri
svg/wordmark.svg, wordmark-white.svg
png/logo-{16…1024}.png          marchio (16 e 32 usano la versione semplificata)
png/logo-blue-512.png, logo-white-512.png
png/lockup-horizontal-{800,1600}.png, lockup-horizontal-white-1600.png
png/lockup-vertical-1024.png, wordmark-1600.png
favicon.ico                     16 + 32 + 48
store/icon-128.png              Chrome Web Store: icona
store/small-promo-440x280.png   Chrome Web Store: small promo tile
store/marquee-1400x560.png      Chrome Web Store: marquee
social/og-1200x630.png          anteprima link (Open Graph)
social/avatar-512.png           avatar quadrato
presentazione.html              pagina di presentazione del marchio (costruzione, scale, varianti, alternative, regole)
concepts/                       prime proposte (E che cresce, timeline)
alternative/                    le altre quattro alternative valutate
```

Le icone dell'estensione (`public/icon/{16,32,48,128}.png`) sono copie
di `png/logo-*.png`; WXT le inserisce nel manifest.

## Regole d'uso

- Area di rispetto: almeno un quarto del lato del riquadro su ogni lato.
- Dimensione minima: 16 px per il marchio (usa `logo-small`), 120 px di
  larghezza per il lockup orizzontale.
- Su fondi colorati o fotografici usa il monocromo bianco; su fondi chiari
  il riquadro blu o il monocromo blu.
- Non ruotare, non aggiungere ombre o gradienti, non cambiare l'ordine dei
  fogli, non sostituire il blu.
- Niente lenti d'ingrandimento, occhi, scudi o lucchetti accanto al marchio:
  Evidentia descrive versioni, non rileva né giudica.
