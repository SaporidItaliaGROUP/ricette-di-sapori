// Funzione Appwrite «importa-link»: scarica la pagina di una ricetta e ne
// restituisce titolo, ingredienti, procedimento e immagine quando il sito li dichiara.
import { estraiRicetta, indirizzoPermesso } from "./estrai.js";

const MAX_BYTE = 3_000_000;

export default async ({ req, res, error }) => {
  if (!req.headers["x-appwrite-user-id"]) return res.json({ ok: false, errore: "Bisogna accedere." }, 401);
  const url = String((req.bodyJson || {}).url || "").trim();
  if (!indirizzoPermesso(url)) return res.json({ ok: false, errore: "Indirizzo non valido." }, 400);

  try {
    const r = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
      headers: { "user-agent": "Mozilla/5.0 (compatible; ricettario/1.0)", accept: "text/html" },
    });
    if (!indirizzoPermesso(r.url)) return res.json({ ok: false, errore: "Indirizzo non valido." }, 400);
    if (!r.ok) return res.json({ ok: false, errore: "Il sito ha risposto con un errore (" + r.status + ")." }, 502);
    const html = (await r.text()).slice(0, MAX_BYTE);
    return res.json({ ok: true, ricetta: estraiRicetta(html, r.url) });
  } catch (e) {
    error(String(e));
    return res.json({ ok: false, errore: "Non sono riuscito a leggere il sito." }, 502);
  }
};
