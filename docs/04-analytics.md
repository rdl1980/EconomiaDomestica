# 04 - Analytics

## Principio

Le aggregazioni si calcolano in Postgres (viste e viste materializzate), non nel
client. Motivo: le stesse metriche dovranno servire l'app mobile e, un domani,
eventuali export o notifiche. Se la logica sta nei componenti React va riscritta
ogni volta.

## Le domande a cui l'app deve saper rispondere

Questa lista e' il vero requisito: le tabelle e le viste esistono per soddisfarla.

**Livello 1 - dove vanno i soldi**
- quanto ho speso questo mese, e quanto rispetto al mese scorso / allo stesso mese
  dell'anno scorso
- ripartizione per supermercato, per categoria, per membro della famiglia
- scontrino medio per negozio
- andamento settimanale / mensile della spesa

**Livello 2 - il dettaglio prodotto**
- i miei 20 prodotti per spesa totale annua (spesso sorprende)
- quanto spendo di carne / frutta / detersivi
- quante volte compro un prodotto e ogni quanto

**Livello 3 - il confronto prezzi (il valore vero)**
- prezzo al kg dello stesso prodotto per negozio, nel tempo
- **inflazione personale**: indice costruito sul mio paniere reale, non su quello
  ISTAT
- confronto a parita' di paniere: "gli stessi prodotti che compro da A, quanto
  costerebbero da B"
- rilevamento offerte reali: il prezzo di oggi vs la mediana degli ultimi 6 mesi
- stima del risparmio potenziale: quanto avrei risparmiato comprando ogni prodotto
  dove costa meno

**Livello 4 - previsione e controllo** (da M6)
- proiezione di fine mese sulla base dello storico
- budget per categoria con alert
- rilevamento anomalie ("questo mese la carne e' +40%")

## Implementazione

- una vista di fatto `fact_expense_line` che denormalizza riga + data + vendor +
  categoria + prodotto: e' la base di quasi tutte le query
- `mv_monthly_spend`, `mv_price_history` come viste materializzate, aggiornate alla
  conferma di un documento
- una dimensione calendario, cosi' i mesi senza spesa non spariscono dai grafici
- tutti i filtri della dashboard sono nell'URL: periodo, negozio, categoria,
  prodotto, membro. Rende ogni vista condivisibile e salvabile come preset.

## Attenzione ai numeri onesti

Alcune trappole da gestire esplicitamente, altrimenti le statistiche mentono:

- **sconti e punti fedelta'**: si ragiona sempre sul netto effettivamente pagato
- **prodotti non riconosciuti**: se il 20% delle righe e' "da categorizzare", ogni
  grafico per categoria e' falso. La dashboard deve mostrare la percentuale di
  copertura, non nasconderla
- **mesi parziali**: il mese corrente non si confronta con un mese completo senza
  dirlo
- **cambio pezzatura**: se un prodotto passa da 500g a 400g allo stesso prezzo, il
  confronto va fatto sul prezzo normalizzato, non sul prezzo di listino. E' proprio
  il caso in cui l'app deve accorgersi di qualcosa che l'occhio non vede.
