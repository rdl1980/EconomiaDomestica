# 02 - Modello dati

Schema di riferimento eseguibile: [`schema/000-core.sql`](schema/000-core.sql).
Qui c'e' il ragionamento dietro le scelte.

## Core

| Tabella | Ruolo |
|---|---|
| `household` | il nucleo domestico. Radice di ogni dato: tutto ha `household_id`. |
| `member` | i membri, legati a un utente Supabase Auth. Ruoli: owner / adult / viewer. |
| `category` | albero gerarchico (`parent_id`) con un campo `domain` (alimentari, utenze, casa, trasporti...). Categorie di sistema in seed + categorie custom per household. |
| `vendor` | controparte della spesa: supermercato, fornitore luce, operatore telefonico. Una tabella sola con un campo `type`. |
| `document` | il file caricato (foto o PDF) + lo stato della pipeline di estrazione + il draft JSON grezzo. |
| `transaction` | testata del movimento: data, vendor, totale, metodo pagamento, documento sorgente, `module`. |
| `line_item` | riga di dettaglio: descrizione, quantita', unita', prezzo unitario, sconto, categoria. |

## Modulo Spesa

| Tabella | Ruolo |
|---|---|
| `product` | catalogo normalizzato: "Latte parz. scremato 1L Granarolo". |
| `product_alias` | `(vendor, stringa_scontrino) -> product`. E' qui che l'app impara. |
| `price_observation` | derivata: prodotto x negozio x data x prezzo normalizzato. |

### `product_alias` e' il motore di apprendimento

Gli scontrini italiani scrivono `PMD LATTE PS 1L`, `POMOD.CILIEG.VASCH`,
`SACCH.BIO GR.` Nessun sistema indovina tutto al primo colpo. Ma ogni volta che
l'utente corregge una riga nella schermata di revisione, si scrive un alias. Dal
terzo scontrino Esselunga in poi il riconoscimento e' quasi perfetto, e il costo di
inserimento crolla.

Gli alias sono per-vendor perche' la stessa abbreviazione puo' significare cose
diverse in catene diverse. C'e' anche un livello globale (vendor NULL) per gli
alias ovvi.

### `price_observation` e' la tabella che giustifica l'app

E' cio' che rende possibili le domande interessanti:
- dove costa meno il parmigiano **al kg**
- quanto e' aumentato **il mio** paniere negli ultimi 12 mesi
- quel prodotto in offerta e' davvero un'offerta o e' il prezzo di sempre

Si popola come effetto della conferma di uno scontrino, non ricalcolando al volo:
la storia dei prezzi va conservata anche se il catalogo prodotti cambia.

## Le unita' di misura (il punto delicato)

Ogni `line_item` porta tre campi indipendenti:

- `quantity` - quanto (2, oppure 0.482)
- `unit` - in cosa: `kg`, `l`, `pcs`
- `unit_price` - prezzo per unita' (EUR/kg, EUR/L, EUR/pz)

Per i prodotti venduti a peso lo scontrino riporta gia' sia il prezzo al kg sia il
peso: si salvano **entrambi** e si verifica che `quantity * unit_price ~= amount`.

`price_observation.unit_price_normalized` esiste per rendere confrontabile "3
confezioni da 500g" con "1,4 kg di sfuso": si normalizza sempre a EUR/kg, EUR/L o
EUR/pz. Senza questo campo il confronto tra supermercati non funziona, perche' le
pezzature differiscono.

Nota sui decimali: importi in `numeric(12,2)`, prezzi unitari in `numeric(12,4)`
(esistono prezzi tipo 0,0295 EUR/kWh), quantita' in `numeric(12,3)` (grammi).
Mai float.

## Moduli futuri, gia' previsti nel disegno

**Utenze** (`utility_contract`, `utility_bill`, `meter_reading`): oltre alla spesa
tracciano il **consumo** (kWh, smc, GB) e la lettura contatore. Questo abilita
statistiche che con i soli euro sarebbero impossibili: "consumo meno luce di un
anno fa ma pago di piu'", cioe' separare l'effetto quantita' dall'effetto prezzo.

**Abbonamenti** (`subscription`): ricorrenza, prossimo rinnovo, costo annualizzato,
alert prima del rinnovo.

Entrambi scrivono `transaction` nel ledger comune.

## Sicurezza dei dati

Row Level Security su ogni tabella, con la stessa forma: un record e' visibile se
`household_id` e' fra gli household di cui l'utente e' membro. Il bucket delle foto
e' privato, l'accesso passa da signed URL a scadenza breve.
