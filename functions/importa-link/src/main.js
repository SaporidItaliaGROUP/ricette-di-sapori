// Funzione Appwrite «importa-link»: scarica la pagina di una ricetta e ne
// restituisce titolo, ingredienti, procedimento e immagine quando il sito li dichiara.
// Chi può usarla lo decide Appwrite (permesso «execute» = squadra redazione):
// qui si controlla in più che la richiesta arrivi da un utente che ha fatto l'accesso.
import { estraiRicetta } from "./estrai.js";
import { scaricaPagina, ErroreLettura } from "./scarica.js";

export default async ({ req, res, error }) => {
  if (!req.headers["x-appwrite-user-id"]) return res.json({ ok: false, errore: "Bisogna accedere." }, 401);
  try {
    let corpo = {};
    try { corpo = req.bodyJson || {}; } catch {}
    const url = String(corpo.url || "").trim();
    const pagina = await scaricaPagina(url);
    return res.json({ ok: true, ricetta: estraiRicetta(pagina.html, pagina.url) });
  } catch (e) {
    if (e instanceof ErroreLettura) return res.json({ ok: false, errore: e.message }, e.codice);
    error(String(e));
    return res.json({ ok: false, errore: "Non sono riuscito a leggere il sito." }, 502);
  }
};
