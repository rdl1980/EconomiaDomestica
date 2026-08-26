# 05 - UI/UX

## Direzione

Mobile-first fin dal primo pixel. Il web e' il primo target, ma la forma e' quella
del telefono: l'app si usa in piedi davanti alla cassa o sul divano la sera, non
alla scrivania. Il desktop e' la stessa app che respira di piu'.

L'obiettivo dichiarato e' una UI "catchy". Tradotto in requisiti concreti:

- **densita' bassa, gerarchia forte**: un numero grande che conta, il resto sotto
- **colore con un significato**: le categorie hanno colori stabili, ovunque
- **movimento breve**: transizioni 150-250ms, mai animazioni che rallentano
- **skeleton al posto degli spinner**: l'app non deve mai sembrare ferma
- **dark mode nativa**, non un tema aggiunto dopo
- **zero form modali lunghe**: sheet dal basso, campi grandi, tastiera numerica
  dove serve

## Navigazione

Bottom nav a 4 voci con il pulsante di cattura al centro, in evidenza:

```
   Home        Spese      [ FOTO ]      Prezzi      Altro
 dashboard    elenco       azione      confronti   utenze,
                          centrale                  impostazioni
```

Il pulsante centrale e' il gesto principale dell'app. Dalla schermata di cattura si
puo' scattare, scegliere dalla galleria, importare un JSON o inserire a mano: la
stessa azione, quattro strade.

## Le schermate che decidono il successo

**Cattura + revisione.** Trattata come il flusso di prodotto piu' importante, non
come un form. Vedi doc 03.

**Dashboard.** Deve dare una risposta in tre secondi: quanto ho speso, se sto
andando peggio del solito, dove. Grafici sotto, non sopra.

**Confronto prezzi.** La schermata che nessun'altra app di budget ha davvero.
Prodotto -> curva del prezzo al kg per negozio nel tempo.

## Sistema

Tailwind + shadcn/ui, con **design tokens centralizzati** (colori semantici,
spaziature, raggi, ombre, tipografia) in `packages/ui`. I componenti leggono i
token, mai valori hard-coded: cosi' un restyling non tocca i componenti e il tema
scuro non e' una lista di eccezioni.

Accessibilita' come requisito minimo, non come rifinitura: contrasto AA, target
touch da 44px, focus visibile, grafici che non comunicano solo col colore.
