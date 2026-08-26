# Prompt di estrazione (sorgente [B] - JSON esterno)

Serve a produrre un `ReceiptDraft` **fuori dall'app**, con lo strumento che
preferisci, per non consumare token dell'applicazione. Il JSON risultante si carica
nell'app e prosegue nella pipeline normale.

Allega la foto dello scontrino e usa il testo qui sotto.

---

```
Estrai i dati da questo scontrino della spesa italiano e restituisci ESCLUSIVAMENTE
un oggetto JSON valido, senza testo prima o dopo, senza blocchi di codice.

REGOLE

1. `raw_description` deve essere la descrizione ESATTA come stampata sullo
   scontrino, abbreviazioni e refusi inclusi. Non espandere, non correggere, non
   tradurre. Serve per il riconoscimento automatico futuro.

2. Prodotti venduti a peso (frutta, verdura, salumi, carne): lo scontrino riporta
   il peso e il prezzo al kg. Allora `unit` = "kg", `quantity` = il peso in kg
   (es. 0.482), `unit_price` = il prezzo al kg. NON mettere 1 come quantita'.

3. Prodotti a pezzo: `unit` = "pcs", `quantity` = numero di pezzi,
   `unit_price` = prezzo del singolo pezzo.

4. Liquidi venduti a volume: `unit` = "l".

5. Sconti: se lo sconto e' riferito a una riga specifica, mettilo in
   `discount_amount` di quella riga e riduci di conseguenza `net_amount`. Se e'
   uno sconto generale sul totale, mettilo in `discount_total`.

6. Per ogni riga deve valere, a meno di arrotondamenti:
   quantity * unit_price - discount_amount = net_amount

7. `total_amount` e' il totale effettivamente pagato.

8. NON INVENTARE. Se un dato non e' leggibile: metti null se il campo lo consente,
   e aggiungi una stringa esplicativa in `warnings`. Un warning e' sempre meglio di
   un numero inventato: l'app lo evidenziera' per la correzione manuale.

9. Se la somma delle righe non corrisponde al totale, riporta comunque quello che
   leggi e segnala la discrepanza in `warnings`. Non aggiustare i numeri per farli
   tornare.

10. `source` deve valere "external".

FORMATO

{
  "schema_version": "1.0",
  "source": "external",
  "vendor": { "name": "", "chain": null, "address": null, "city": null, "vat_number": null },
  "purchased_at": "2026-08-20T18:32:00+02:00",
  "currency": "EUR",
  "payment_method": null,
  "total_amount": 0,
  "discount_total": null,
  "loyalty": null,
  "lines": [
    {
      "line_no": 1,
      "raw_description": "",
      "quantity": 0,
      "unit": "pcs",
      "unit_price": 0,
      "gross_amount": null,
      "discount_amount": null,
      "net_amount": 0,
      "vat_rate": null,
      "category_hint": null,
      "notes": null
    }
  ],
  "confidence": 0.0,
  "warnings": []
}

Valori ammessi:
- unit: "pcs" | "kg" | "l"
- payment_method: "contanti" | "carta" | "bancomat" | "buoni_pasto" | "app" | "altro" | null
```

---

## Esempio di output

```json
{
  "schema_version": "1.0",
  "source": "external",
  "vendor": { "name": "ESSELUNGA", "chain": "Esselunga", "address": "Via Roma 12", "city": "Milano", "vat_number": null },
  "purchased_at": "2026-08-20T18:32:00+02:00",
  "currency": "EUR",
  "payment_method": "carta",
  "total_amount": 12.44,
  "discount_total": null,
  "loyalty": { "card_last4": "4417", "points_earned": 12, "points_redeemed": null },
  "lines": [
    {
      "line_no": 1, "raw_description": "PMD LATTE PS 1L", "quantity": 2, "unit": "pcs",
      "unit_price": 1.29, "gross_amount": 2.58, "discount_amount": null, "net_amount": 2.58,
      "vat_rate": 4, "category_hint": "latticini", "notes": null
    },
    {
      "line_no": 2, "raw_description": "POMOD.CILIEG.", "quantity": 0.482, "unit": "kg",
      "unit_price": 3.90, "gross_amount": 1.88, "discount_amount": null, "net_amount": 1.88,
      "vat_rate": 4, "category_hint": "ortofrutta", "notes": null
    },
    {
      "line_no": 3, "raw_description": "PARMIGIANO REGG.24M", "quantity": 0.310, "unit": "kg",
      "unit_price": 26.90, "gross_amount": 8.34, "discount_amount": 0.36, "net_amount": 7.98,
      "vat_rate": 4, "category_hint": "latticini", "notes": null
    }
  ],
  "confidence": 0.94,
  "warnings": ["L'ora e' parzialmente illeggibile, i minuti sono stimati."]
}
```
