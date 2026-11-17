# Le ricette di Sapori — regole del progetto

Ricettario di Sapori d'Italia (épicerie fine a Dakar): raccoglie le ricette trovate sul web
o fotografate, con categorie, ingredienti e stelle. I clienti vedono le ricette pubbliche;
solo la redazione (Claudio e Veronique) aggiunge e modifica.

## Come parlare con il proprietario

- Rispondere in **italiano semplice**: il proprietario non è un programmatore.
- Dire la **verità in modo critico**: cosa funziona, cosa no, cosa non è stato verificato. Mai dire «fatto» senza averlo provato.
- **Non pubblicare niente** (sito visibile ai clienti, modifiche su Appwrite) senza un «ok» esplicito dato per quella volta.

## Com'è fatto

| File | A cosa serve |
|---|---|
| `public/index.html` | Tutta l'applicazione in un solo file, JavaScript semplice, nessuna compilazione. |
| `public/config.js` | Collegamento ad Appwrite (niente segreti). Con `projectId` vuoto il programma lavora in **modalità prova**: dati solo nel browser. |
| `public/appwrite.js` | Libreria di Appwrite per il browser (versione 29.2.0). Non modificare. |
| `functions/importa-link/` | Funzione Appwrite: legge una ricetta da un indirizzo web. `src/estrai.js` ricava la ricetta dalla pagina (scheda «schema.org Recipe» in JSON-LD; etichette «microdata» come riserva); `src/scarica.js` scarica la pagina con le protezioni (solo siti pubblici, controllo a ogni rimando, limiti di tempo e dimensione). Può eseguirla solo la squadra `redazione` (impostazione su Appwrite). |
| `prove/pagine/` | Pagine di esempio per le prove della lettura da link. **Scritte a mano, non sono siti veri.** |
| `functions/leggi-foto/` | Funzione Appwrite: legge la foto di una ricetta con l'intelligenza artificiale (Claude). La chiave `ANTHROPIC_API_KEY` sta solo nelle variabili della funzione su Appwrite. |
| `public/manifest.webmanifest`, `public/icona-*.png` | Scheda e icone dell'app installabile sul telefono. |
| `public/sw.js` | Servizio in sottofondo: rende l'app installabile e apribile senza rete. Tiene in memoria solo le pagine, mai i dati. **Cambiare il numero `MEMORIA` a ogni pubblicazione**, insieme a `VERSION`. |
| `prove/prova.mjs` | Prove automatiche: `node prove/prova.mjs`. |

## Dati

- Su Appwrite: database `ricette`, raccolta `ricette`, archivio foto `foto`, squadra `redazione`.
- Campi di una ricetta: `titolo, link, fonte, categorie[], ingredienti[], procedimento, note, tempo, porzioni, stelle (0-5), pubblica, fotoId, fotoUrl`.
- Permessi: ogni ricetta è leggibile e modificabile dalla squadra `redazione`; è leggibile da tutti solo se `pubblica` è vero.
- In modalità prova: `localStorage`, chiave `ricette-di-sapori-v1`.
- **Non rompere i dati già salvati**: se cambia la forma, completare i vecchi in `normalize()`.
- Mai scrivere password o chiavi nei file del progetto. Il repository è pubblico.

## Regole per il codice

- Ogni testo scritto dall'utente o letto da un sito o da una foto passa da `esc()` prima di finire nella pagina; i link solo se cominciano con `http(s)://`.
- Quello che l'intelligenza artificiale legge da una foto va **sempre mostrato per il controllo** prima del salvataggio, con i dubbi in evidenza.
- Le ricette nascono **private**: diventano visibili ai clienti solo se la redazione lo sceglie (attenzione ai diritti d'autore di testi e foto altrui).
- Versione e data sono in cima al programma (`VERSION`, `VERSION_DATE`): aggiornarle a ogni pubblicazione.
- Se si aggiunge una funzione, aggiungere la sua prova.
- La lettura da link **non inventa mai**: se il sito non dichiara un dato, il campo resta vuoto e l'avviso lo dice. I testi letti vengono accorciati alle misure delle colonne della tabella.
- Le ricette lette da un sito sono per uso interno: restano private. Nessun collegamento tra ingredienti e catalogo prodotti (deciso dal proprietario): c'è solo il pulsante «Apri il sito di Sapori d'Italia» (https://www.saporiditalia.club).
- Non copiare codice da progetti con licenza AGPL/GPL (Mealie, Tandoor, KitchenOwl…).

## Appwrite (versione 2 del servizio)

- Progetto `6afaec92001e6fb9cc6e`, regione Francoforte (`https://fra.cloud.appwrite.io/v1`).
- La tabella si crea e si usa con i comandi nuovi «TablesDB» (tabelle, righe, colonne), non con i vecchi «collections/documents»: la chiave API del progetto non ha i permessi vecchi.
- Le funzioni si caricano con `POST /functions/<nome>/deployments` (archivio .tar.gz della cartella, senza `node_modules`).
- Sito pubblicato su Appwrite Sites (sito `ricette`): https://ricette-di-sapori.appwrite.network . Si pubblica caricando la cartella `public` con `POST /sites/ricette/deployments` (`activate=true`). L'indirizzo leggibile è una regola legata alla pubblicazione del 16/11/2026: dopo ogni nuova pubblicazione controllare che mostri la versione nuova, altrimenti rifare la regola (`POST /proxy/rules/site`).
- Pubblicazioni: 0.1 il 16/11/2026 (prima pubblicazione, mai aperta dall'ambiente di sviluppo: l'indirizzo del sito da qui non è raggiungibile).
- La chiave `ANTHROPIC_API_KEY` va messa a mano nelle variabili della funzione `leggi-foto` dal pannello Appwrite.

## Stato al 16/11/2026 (versione 0.1, sito pubblicato ma non ancora provato)

- Provato in automatico, in modalità prova: aggiungere, modificare, eliminare, stelle, ricerca per ingrediente, filtri, dati che restano dopo il ricaricamento; lettura di una pagina web finta.
- Fatto e controllato sul servizio vero: squadra `redazione`, database e tabella `ricette` con tutti i campi, archivio `foto`, funzioni `importa-link` e `leggi-foto` caricate; una riga di prova creata ed eliminata con la chiave di amministratore; `importa-link` risponde e rifiuta chi non ha fatto l'accesso.
- **Mai provato dal browser sul servizio vero**: accesso con email e password, salvataggio e foto fatti da un utente, ricette private invisibili ai clienti, lettura da link su siti reali, lettura delle foto con l'intelligenza artificiale (manca la chiave). Dall'ambiente di sviluppo non si può: ogni richiesta parte come amministratore.
- Mancano: utenti della redazione, chiave dell'intelligenza artificiale, prova del sito dal browser.
- Versione 0.2 (app installabile sul telefono, pulsante «Installa l'app», apertura senza rete): scritta e provata in automatico, **non pubblicata**. L'installazione su un telefono vero non è stata provata. Senza rete si apre il programma ma non si vedono le ricette (stanno sul server).
- L'indirizzo gratuito `appwrite.network` viene bloccato da Avast sul computer del proprietario: per i clienti serve un indirizzo proprio (es. `ricette.saporiditalia.club`).
- Dubbi da verificare: tempo massimo di una funzione chiamata dal browser (la lettura di una foto potrebbe superarlo); dimensione massima della foto inviata alla funzione.
- Versione 0.3 del 17/11/2026 (ramo `claude/importazione-dal-web`, **non pubblicata, funzione non caricata su Appwrite**): lettura da link più robusta (schede annidate o scritte male, siti francesi, metodo di riserva per siti vecchi), avvisi su cosa manca, anteprima della foto del sito, protezioni dello scaricamento, ricerca che non bada agli accenti, pulsante verso il sito di Sapori. Provata solo in automatico su pagine di esempio scritte a mano e con una rete finta: **mai provata su un sito vero** (dall'ambiente di sviluppo i siti di cucina sono bloccati). Da fare: farsi dare dal proprietario 4-5 siti che usa, caricare la funzione su Appwrite con il suo «ok» e misurare quanti siti vengono letti (GialloZafferano, Cucchiaio d'Argento, Marmiton e i suoi). Alcuni siti potrebbero rifiutare le letture automatiche.
- 17/11/2026: funzione `importa-link` nuova **caricata su Appwrite con l'«ok» del proprietario** (pubblicazione `6afc0cf7aae251a408a3`, attiva). Controllato solo che risponda e rifiuti chi non ha fatto l'accesso. La lettura di siti veri **non è stata provata**: dall'ambiente di sviluppo ogni chiamata parte come amministratore e la funzione la rifiuta; va provata dal browser da un utente della redazione (ne esiste uno). Il sito pubblicato è ancora la versione vecchia: chiama la funzione nuova (è compatibile) ma non mostra gli avvisi nuovi.
- Il proprietario prende le ricette quasi solo da **reel di Facebook**, non da siti (unico sito nominato: GialloZafferano). Deciso da lui: per i social basta salvare il link con titolo e anteprima se leggibili senza accesso, e scrivere o incollare il resto a mano; niente lettura del video, niente trascrizione, niente intelligenza artificiale per i video. Non si sa ancora se Facebook dia titolo e anteprima alla funzione: probabile che rifiuti.
- Richiesta in sospeso: scansionare ricette da fogli, libri, riviste (in un altro progetto è stato usato tesseract.js nel browser, italiano e francese). Qui esiste già `leggi-foto` con l'intelligenza artificiale: il proprietario deve scegliere quale strada, e cosa intende per «foto» (scansione intera o ritaglio a mano del piatto).
- Le foto delle ricette lette da link non vengono copiate: si mostra quella del sito originale (se il sito la toglie o la blocca, sparisce).
- Schermate solo in italiano: i clienti di Dakar leggono il francese (da decidere).
