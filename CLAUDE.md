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

## Stato al 16/11/2026 (versione 0.1, non pubblicata)

- Provato in automatico, in modalità prova: aggiungere, modificare, eliminare, stelle, ricerca per ingrediente, filtri, dati che restano dopo il ricaricamento; lettura di una pagina web finta.
- **Mai provato sul servizio vero**: tutto il collegamento ad Appwrite (accesso, salvataggio, foto, permessi), la lettura da link su siti reali, la lettura delle foto con l'intelligenza artificiale.
- Mancano: creazione di database, raccolta, archivio foto, squadra e funzioni su Appwrite; scelta di dove pubblicare il sito.
- Dubbi da verificare: tempo massimo di una funzione Appwrite chiamata dal browser (la lettura di una foto potrebbe superarlo); dimensione massima della foto inviata alla funzione; Appwrite ha annunciato la versione 2.0 e i nomi delle sue funzioni potrebbero essere cambiati.
- Schermate solo in italiano: i clienti di Dakar leggono il francese (da decidere).
