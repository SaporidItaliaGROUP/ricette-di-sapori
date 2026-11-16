// Prove automatiche. Si lanciano con:  node prove/prova.mjs
// Provano: (1) la lettura di una ricetta da una pagina web finta;
// (2) il programma in modalità prova (dati nel browser), in un browser vero.
// NON provano Appwrite né l'intelligenza artificiale: quelli vanno provati sul servizio vero.
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { estraiRicetta, indirizzoPermesso, durata } from "../functions/importa-link/src/estrai.js";

const qui = path.dirname(fileURLToPath(import.meta.url));
let fallite = 0, passate = 0;
const prova = (nome, vero) => { vero ? passate++ : fallite++; console.log((vero ? "  ok  " : "  NO  ") + nome); };

/* ---- 1. Lettura da pagina web ---- */
console.log("Lettura da link");
const pagina = `<html><head><title>Sito</title><meta property="og:image" content="https://es.it/og.jpg">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite"},
{"@type":["Recipe"],"name":"Tiramis&ugrave; classico","image":[{"url":"https://es.it/t.jpg"}],
"recipeCategory":"Dolci, Dessert","recipeIngredient":["500 g mascarpone","4 uova"],"totalTime":"PT1H30M","recipeYield":["6 persone"],
"recipeInstructions":[{"@type":"HowToSection","itemListElement":[{"@type":"HowToStep","text":"Montare le <b>uova</b>."}]},{"@type":"HowToStep","text":"Comporre."}]}]}</script></head></html>`;
const r = estraiRicetta(pagina, "https://www.es.it/tiramisu");
prova("trova la ricetta", r.trovata);
prova("titolo con accento", r.titolo === "Tiramisù classico");
prova("ingredienti", r.ingredienti.length === 2 && r.ingredienti[0] === "500 g mascarpone");
prova("procedimento senza codice HTML", r.procedimento === "Montare le uova .\nComporre." || r.procedimento === "Montare le uova.\nComporre.");
prova("categorie separate", r.categorie.join("|") === "Dolci|Dessert");
prova("tempo, porzioni, fonte, foto", r.tempo === "1 h 30 min" && r.porzioni === "6 persone" && r.fonte === "es.it" && r.fotoUrl === "https://es.it/t.jpg");
const senza = estraiRicetta(`<title>Solo titolo</title><script type="application/ld+json">{rotto</script>`, "https://x.it");
prova("pagina senza ricetta: solo titolo, nessun errore", !senza.trovata && senza.titolo === "Solo titolo" && senza.ingredienti.length === 0);
prova("durata vuota se assente", durata("") === "" && durata("PT45M") === "45 min");
prova("rifiuta indirizzi interni", !indirizzoPermesso("http://localhost/x") && !indirizzoPermesso("http://192.168.1.1/") && !indirizzoPermesso("file:///etc/passwd") && indirizzoPermesso("https://www.giallozafferano.it/a"));

/* ---- 2. Il programma nel browser ---- */
console.log("Programma (modalità prova)");
const TIPI = { ".html": "text/html", ".js": "text/javascript" };
const server = http.createServer(async (req, res) => {
  const f = path.join(qui, "../public", req.url === "/" ? "index.html" : req.url.split("?")[0]);
  try { res.writeHead(200, { "content-type": TIPI[path.extname(f)] || "application/octet-stream" }); res.end(await readFile(f)); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const indirizzo = "http://localhost:" + server.address().port + "/";

let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); }
catch { ({ chromium } = createRequire("/opt/node22/lib/node_modules/")("playwright")); }
const browser = await chromium.launch();
const p = await browser.newPage();
const errori = [];
p.on("pageerror", (e) => errori.push(String(e)));
p.on("console", (m) => { if (m.type() === "error") errori.push(m.text()); });
p.on("dialog", (d) => d.accept());
// Le prove girano in modalità prova: al posto di config.js ne usiamo uno senza progetto.
await p.route("**/config.js", (r) => r.fulfill({ contentType: "text/javascript", body: "window.RICETTE_CONFIG = { projectId: '' };" }));
await p.goto(indirizzo);

prova("avviso di modalità prova visibile", await p.locator("#avviso").isVisible());
prova("elenco vuoto all'inizio", (await p.locator(".vuoto").textContent()).includes("Non ci sono ancora ricette"));

async function aggiungi(titolo, categorie, ingredienti, nStelle) {
  await p.click("#btnNuova");
  await p.fill("#mTitolo", titolo);
  await p.fill("#mCategorie", categorie);
  await p.fill("#mIngredienti", ingredienti);
  await p.fill("#mLink", "https://www.esempio.it/ricetta");
  if (nStelle) await p.click(`#mStelle button[data-n="${nStelle}"]`);
  await p.click("#mSalva");
  await p.waitForSelector(".velo", { state: "detached" });
}
await p.click("#btnNuova"); await p.click("#mSalva");
prova("senza titolo non salva", (await p.locator("#mErrore").textContent()).includes("Manca il titolo"));
await p.click("#mAnnulla");

await aggiungi("Carbonara", "Primi", "guanciale\nuova\npecorino", 5);
await aggiungi("Torta <img src=x onerror=window.bucato=1>", "Dolci, Feste", "farina\nzucchero", 3);
prova("due ricette in elenco", (await p.locator(".scheda").count()) === 2);
prova("testo dell'utente non diventa codice", (await p.evaluate(() => window.bucato)) === undefined && (await p.locator(".scheda h3").first().textContent()).includes("<img"));

await p.fill("#fTesto", "guanciale");
prova("ricerca per ingrediente", (await p.locator(".scheda").count()) === 1 && (await p.locator(".scheda h3").textContent()) === "Carbonara");
await p.fill("#fTesto", "");
await p.selectOption("#fCategoria", "Feste");
prova("filtro per categoria nuova", (await p.locator(".scheda").count()) === 1);
await p.selectOption("#fCategoria", "");
await p.selectOption("#fStelle", "4");
prova("filtro per stelle", (await p.locator(".scheda").count()) === 1 && (await p.locator(".scheda h3").textContent()) === "Carbonara");
await p.selectOption("#fStelle", "0");

await p.reload();
prova("dopo il ricaricamento le ricette restano", (await p.locator(".scheda").count()) === 2);

await p.click(".scheda >> text=Carbonara");
prova("scheda: ingredienti e link", (await p.locator(".dettaglio li").count()) === 3 && (await p.locator(".dettaglio a").getAttribute("href")) === "https://www.esempio.it/ricetta");
await p.click("#dModifica");
await p.fill("#mTitolo", "Carbonara romana");
await p.click('#mStelle button[data-n="4"]');
await p.click("#mSalva");
await p.waitForSelector(".velo", { state: "detached" });
prova("modifica salvata", (await p.locator(".scheda >> text=Carbonara romana").count()) === 1 && (await p.locator('.scheda:has-text("Carbonara romana") .stelle').getAttribute("aria-label")) === "4 stelle su 5");

await p.click("#btnNuova");
await p.fill("#mLink", "https://www.esempio.it/x");
await p.click("#mLeggiLink");
await p.waitForFunction(() => document.getElementById("mStato").textContent.includes("Appwrite"));
prova("lettura da link: in modalità prova lo dice chiaramente", true);
await p.click("#mAnnulla");

await p.click(".scheda >> text=Carbonara romana");
await p.click("#dElimina");
await p.waitForSelector(".velo", { state: "detached" });
prova("eliminazione", (await p.locator(".scheda").count()) === 1);

const vecchio = await p.evaluate(() => { localStorage.setItem("ricette-di-sapori-v1", JSON.stringify([{ id: "v1", titolo: "Vecchia" }])); return true; });
await p.reload();
await p.click(".scheda >> text=Vecchia");
prova("dati vecchi incompleti si aprono senza errori", vecchio && (await p.locator(".dettaglio h2").textContent()) === "Vecchia");
prova("nessun errore nella pagina", errori.length === 0);
if (errori.length) console.log(errori);

await browser.close(); server.close();
console.log(`\n${passate} prove passate, ${fallite} fallite`);
process.exit(fallite ? 1 : 0);
