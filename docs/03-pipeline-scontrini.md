# 03 - Pipeline scontrini

## Il confine: un contratto, tre sorgenti

Il pezzo piu' importante di questo disegno e' che **le sorgenti di ingestion sono
intercambiabili**. Tutte producono lo stesso oggetto, il `ReceiptDraft`
([schema JSON](schema/receipt-draft.schema.json)), e da li' in poi la pipeline e'
identica e non sa da dove arrivi il dato.

```
  [A] foto -> vision LLM  --+
                            |
  [B] JSON esterno ---------+--> ReceiptDraft --> validazione --> normalizzazione
                            |                                          |
  [C] inserimento manuale --+                                          v
                                                              revisione utente
                                                                       |
                                                                       v
                                                      transaction + line_item
                                                       + alias + price_observation
```

### [A] Vision LLM (dentro l'app)

Foto -> modello vision con output strutturato forzato sullo schema. Non OCR
classico: gli scontrini italiani sono abbreviati e caotici, e un OCR + regex si
rompe su ogni catena diversa. Un modello vision li interpreta molto meglio,
inclusi i prodotti a peso e gli sconti riga. Costo indicativo: pochi centesimi a
scontrino.

### [B] Import di JSON esterno (a costo zero di token)

L'app accetta il caricamento diretto di un file JSON conforme al contratto,
generato altrove. Il prompt pronto all'uso per produrlo e' in
[`schema/prompt-estrazione.md`](schema/prompt-estrazione.md).

Il flusso e': elabori la foto con lo strumento che preferisci fuori dall'app,
incolli o carichi il JSON risultante, e da li' in poi tutto procede identico -
stessa validazione, stessa schermata di revisione, stesso apprendimento degli
alias. Il file viene validato rigorosamente prima di essere accettato: e' un input
esterno, quindi si tratta come dato non fidato.

Questa modalita' e' anche la strada per l'import massivo dello storico.

### [C] Inserimento manuale

Sempre disponibile, con UI veloce (riga per riga, con autocompletamento sui
prodotti gia' noti). Serve per gli scontrini illeggibili e per non restare mai
bloccati.

## Cosa succede dopo il draft

**1. Validazione strutturale** - lo schema JSON e' rispettato? Le date sono
plausibili? I numeri sono numeri?

**2. Validazione contabile** - la somma delle righe piu' IVA e sconti corrisponde
al totale? Se non torna, non si blocca l'import: si marcano le righe sospette e la
schermata di revisione le evidenzia. Ricontrollare tre righe segnalate e' ben
diverso da ricontrollarne quaranta.

**3. Matching vendor** - fuzzy match su insegna + indirizzo contro i vendor gia'
noti; se non trova, propone la creazione.

**4. Matching prodotti** - per ogni riga si cerca un `product_alias` su
`(vendor, descrizione normalizzata)`. Quello che non matcha resta come riga grezza
in attesa dell'utente.

**5. Categorizzazione automatica** - dal prodotto se noto, altrimenti da regole
sulla descrizione, altrimenti "da categorizzare".

**6. Deduplica** - hash SHA-256 dell'immagine (blocca la stessa foto due volte) +
controllo su `(vendor, data, ora, totale)` (intercetta la stessa spesa fotografata
in due momenti diversi). In entrambi i casi si avvisa, non si rifiuta in silenzio.

## La schermata di revisione

Non e' un ripiego, e' il pezzo di prodotto che decide se l'app viene usata o
abbandonata. Requisiti:

- si apre gia' compilata, con evidenza visiva su cosa e' incerto
- correggere una riga deve costare due tap, non una form modale
- ogni correzione scrive un alias, e questo va **mostrato** all'utente
  ("ok, la prossima volta lo riconoscero'"), perche' rende visibile il fatto che
  il lavoro speso oggi vale per sempre
- conferma finale unica -> a quel punto, e solo a quel punto, si scrive nel ledger

Finche' non c'e' conferma, il documento resta in stato `parsed` e nulla entra
nelle statistiche.

## Stati del documento

```
pending --> parsing --> parsed --> confirmed
                |          |
                v          v
              failed    scartato
```
