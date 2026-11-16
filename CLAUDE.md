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
| `functions/importa-link/` | Funzione Appwrite: legge una ricetta da un indirizzo web (scheda «schema.org Recipe»). |
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
- Schermate solo in italiano: i clienti di Dakar leggono il francese (da decidere).
