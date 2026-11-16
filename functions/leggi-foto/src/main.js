// Funzione Appwrite «leggi-foto»: riceve la foto di una ricetta e restituisce
// titolo, ingredienti e procedimento letti dall'intelligenza artificiale.
// La chiave ANTHROPIC_API_KEY sta nelle variabili della funzione su Appwrite,
// mai nei file del progetto.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

const Ricetta = z.object({
  leggibile: z.boolean().describe("false se nella foto non c'è una ricetta leggibile"),
  titolo: z.string(),
  categorie: z.array(z.string()).describe("una o due tra: Antipasti, Primi, Secondi, Contorni, Dolci, Pane e pizza, Salse, Bevande"),
  ingredienti: z.array(z.string()).describe("un ingrediente per voce, con la quantità come scritta"),
  procedimento: z.string(),
  tempo: z.string().describe("vuoto se non è scritto"),
  porzioni: z.string().describe("vuoto se non è scritto"),
  dubbi: z.array(z.string()).describe("parole o quantità lette con incertezza, da far controllare"),
});

const ISTRUZIONI = `Nella foto c'è una ricetta di cucina (pagina stampata, schermo o foglio scritto a mano).
Trascrivila fedelmente nella lingua in cui è scritta.
Non inventare niente: se una quantità o una parola non si legge, scrivi quello che vedi e segnalalo in "dubbi".
Se un dato non c'è nella foto (tempo, porzioni), lascia il campo vuoto.
Se la foto non contiene una ricetta leggibile, metti "leggibile" a false e lascia vuoto il resto.`;

const TIPI = ["image/jpeg", "image/png", "image/webp"];

export default async ({ req, res, error }) => {
  if (!req.headers["x-appwrite-user-id"]) return res.json({ ok: false, errore: "Bisogna accedere." }, 401);
  if (!process.env.ANTHROPIC_API_KEY) return res.json({ ok: false, errore: "Manca la chiave dell'intelligenza artificiale su Appwrite." }, 500);

  const { immagine, tipo } = req.bodyJson || {};
  if (typeof immagine !== "string" || !immagine || !TIPI.includes(tipo))
    return res.json({ ok: false, errore: "Foto mancante o di un tipo non accettato." }, 400);

  const client = new Anthropic();
  try {
    const risposta = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(Ricetta) },
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: tipo, data: immagine } },
          { type: "text", text: ISTRUZIONI },
        ],
      }],
    });
    if (risposta.stop_reason === "refusal" || !risposta.parsed_output)
      return res.json({ ok: false, errore: "L'intelligenza artificiale non è riuscita a leggere questa foto." }, 422);
    const r = risposta.parsed_output;
    if (!r.leggibile) return res.json({ ok: false, errore: "Nella foto non si legge una ricetta. Riprova con una foto più nitida." }, 422);
    return res.json({ ok: true, ricetta: r });
  } catch (e) {
    error(String(e));
    if (e instanceof Anthropic.AuthenticationError) return res.json({ ok: false, errore: "La chiave dell'intelligenza artificiale non è valida." }, 500);
    if (e instanceof Anthropic.RateLimitError) return res.json({ ok: false, errore: "Troppe richieste: riprova tra un minuto." }, 429);
    if (e instanceof Anthropic.APIError) return res.json({ ok: false, errore: "Errore del servizio di lettura (" + e.status + ")." }, 502);
    return res.json({ ok: false, errore: "Errore imprevisto durante la lettura." }, 500);
  }
};
