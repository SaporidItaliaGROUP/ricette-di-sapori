// Scarica una pagina web in modo prudente:
//  - solo indirizzi di siti pubblici, controllati a ogni rimando (un sito può rimandare altrove);
//  - il nome del sito non deve portare a un computer interno;
//  - limite di tempo e di dimensione; solo pagine web, non file.
import { lookup } from "node:dns/promises";
import { indirizzoPermesso, ipRiservato } from "./estrai.js";

export const MAX_BYTE = 3_000_000, MAX_RIMANDI = 5, TEMPO_MS = 12000;
export const dipendenze = { lookup }; // sostituibile nelle prove

export class ErroreLettura extends Error {
  constructor(messaggio, codice = 502) { super(messaggio); this.codice = codice; }
}

async function controlla(url) {
  if (!indirizzoPermesso(url)) throw new ErroreLettura("Indirizzo non valido: serve l'indirizzo di una pagina pubblica, che comincia con https://", 400);
  let indirizzi;
  try { indirizzi = await dipendenze.lookup(new URL(url).hostname, { all: true }); }
  catch { throw new ErroreLettura("Non trovo questo sito. Controlla che l'indirizzo sia scritto bene."); }
  if (!indirizzi.length || indirizzi.some((i) => ipRiservato(i.address))) throw new ErroreLettura("Indirizzo non valido.", 400);
}

function codifica(tipo, inizio) {
  const m = /charset\s*=\s*["']?([\w-]+)/i.exec(tipo || "") || /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(inizio);
  try { return new TextDecoder(m ? m[1] : "utf-8"); } catch { return new TextDecoder("utf-8"); }
}

export async function scaricaPagina(url) {
  const scadenza = AbortSignal.timeout(TEMPO_MS);
  let attuale = url;
  for (let rimandi = 0; rimandi <= MAX_RIMANDI; rimandi++) {
    await controlla(attuale);
    let r;
    try {
      r = await fetch(attuale, {
        redirect: "manual", signal: scadenza,
        headers: { "user-agent": "Mozilla/5.0 (compatible; ricettario/1.0)", accept: "text/html,application/xhtml+xml", "accept-language": "it,fr;q=0.8,en;q=0.5" },
      });
    } catch (e) {
      throw new ErroreLettura(e && e.name === "TimeoutError" ? "Il sito ci mette troppo a rispondere." : "Non sono riuscito a collegarmi al sito.");
    }
    const prossimo = r.status >= 300 && r.status < 400 && r.headers.get("location");
    if (prossimo) {
      try { await r.body?.cancel(); } catch {}
      try { attuale = new URL(prossimo, attuale).href; } catch { throw new ErroreLettura("Il sito rimanda a un indirizzo non valido."); }
      continue;
    }
    if (r.status === 401 || r.status === 403 || r.status === 429) throw new ErroreLettura("Il sito rifiuta le letture automatiche (errore " + r.status + "). La ricetta va inserita a mano.");
    if (!r.ok) throw new ErroreLettura("Il sito ha risposto con un errore (" + r.status + ").");
    const tipo = r.headers.get("content-type") || "";
    if (tipo && !/html|xml|text\/plain/i.test(tipo)) throw new ErroreLettura("Questo indirizzo non è una pagina web (è un file di altro tipo).", 400);

    // Si legge a pezzi e ci si ferma al limite: una pagina enorme non riempie la memoria.
    const pezzi = []; let totale = 0;
    try {
      const lettore = r.body.getReader();
      while (totale < MAX_BYTE) {
        const { done, value } = await lettore.read();
        if (done) break;
        pezzi.push(value.subarray(0, MAX_BYTE - totale)); totale += value.length;
      }
      if (totale >= MAX_BYTE) { try { await lettore.cancel(); } catch {} }
    } catch (e) {
      throw new ErroreLettura(e && e.name === "TimeoutError" ? "Il sito ci mette troppo a rispondere." : "La lettura della pagina si è interrotta.");
    }
    const byte = Buffer.concat(pezzi.map((p) => Buffer.from(p.buffer, p.byteOffset, p.byteLength)));
    return { html: codifica(tipo, byte.subarray(0, 2000).toString("latin1")).decode(byte), url: attuale };
  }
  throw new ErroreLettura("Il sito rimanda troppe volte da un indirizzo all'altro.");
}
