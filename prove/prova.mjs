// Prove automatiche. Si lanciano con:  node prove/prova.mjs
// Provano: (1) la lettura di una ricetta da pagine web di esempio (prove/pagine: NON sono siti veri)
// e le protezioni dello scaricamento, con una rete finta;
// (2) il programma in modalità prova (dati nel browser), in un browser vero.
// NON provano Appwrite né l'intelligenza artificiale: quelli vanno provati sul servizio vero.
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { estraiRicetta, indirizzoPermesso, ipRiservato, durata, eSocial } from "../functions/importa-link/src/estrai.js";
import { scaricaPagina, dipendenze, MAX_BYTE } from "../functions/importa-link/src/scarica.js";
import importaLink from "../functions/importa-link/src/main.js";

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
prova("procedimento senza codice HTML", r.procedimento === "Montare le uova.\nComporre.");
prova("categorie separate", r.categorie.join("|") === "Dolci|Dessert");
prova("tempo, porzioni, fonte, foto", r.tempo === "1 h 30 min" && r.porzioni === "6 persone" && r.fonte === "es.it" && r.fotoUrl === "https://es.it/t.jpg");
const senza = estraiRicetta(`<title>Solo titolo</title><script type="application/ld+json">{rotto</script>`, "https://x.it");
prova("pagina senza ricetta: solo titolo, nessun errore", !senza.trovata && senza.titolo === "Solo titolo" && senza.ingredienti.length === 0);
prova("durata vuota se assente", durata("") === "" && durata("PT45M") === "45 min" && durata("PT90M") === "1 h 30 min" && durata("P0DT1H0M0S") === "1 h" && durata("PT0M") === "");
prova("rifiuta indirizzi interni", !indirizzoPermesso("http://localhost/x") && !indirizzoPermesso("http://192.168.1.1/") && !indirizzoPermesso("file:///etc/passwd") && indirizzoPermesso("https://www.giallozafferano.it/a"));

prova("rifiuta porte insolite, password nell'indirizzo, nomi di rete interna", !indirizzoPermesso("https://sito.it:8080/") && !indirizzoPermesso("https://utente:segreto@sito.it/") && !indirizzoPermesso("http://server.lan/") && !indirizzoPermesso("http://0x7f.1/") && !indirizzoPermesso("http://[::1]/"));
prova("riconosce gli indirizzi numerici interni", ["127.0.0.1", "10.1.2.3", "192.168.0.5", "172.20.0.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"].every(ipRiservato) && !ipRiservato("93.184.216.34") && !ipRiservato("2606:2800:220:1::1"));

console.log("Lettura delle pagine di esempio (non sono siti veri)");
const esempio = async (f) => estraiRicetta(await readFile(path.join(qui, "pagine", f), "utf8"), "https://www.sito-prova.it/ricette/x");
let e = await esempio("scheda-semplice.html");
prova("scheda semplice: tutto letto, nessun avviso", e.trovata && e.titolo === "Spaghetti alla Carbonara" && e.ingredienti.length === 5 && e.ingredienti[1] === "Guanciale 150 g" && e.procedimento.split("\n").length === 3 && e.tempo === "25 min" && e.porzioni === "4" && e.categorie.join() === "Primi piatti" && e.fotoUrl.endsWith("carbonara-1x1.jpg") && e.avvisi.length === 0);
e = await esempio("scheda-wordpress.html");
prova("scheda dentro un grafo: sezioni, tempo sommato, porzioni con parole", e.trovata && e.ingredienti.length === 5 && e.procedimento.startsWith("Per l'impasto:\nMontate le uova") && e.procedimento.includes("180° per 45 minuti") && e.tempo === "1 h 5 min" && e.porzioni === "8 fette" && e.categorie.join() === "Dolci,Torte" && e.fotoUrl.endsWith("torta-mele.jpg"));
e = await esempio("scheda-francese.html");
prova("sito francese: accenti e procedimento in un solo testo", e.trovata && e.titolo === "Tarte Tatin à l'ancienne" && e.ingredienti[4] === "1 cuillère à café de cannelle" && e.procedimento.split("\n").length === 3 && e.tempo === "1 h 30 min" && e.porzioni === "6 personnes");
e = await esempio("scheda-sporca.html");
prova("dati scritti male: riparati, senza codice HTML, foto con indirizzo completo", e.trovata && e.titolo === "Pesto alla genovese" && e.ingredienti[0] === "50 g di basilico genovese" && e.ingredienti[2] === "70 g di Parmigiano Reggiano" && !/[<>]/.test(JSON.stringify(e)) && e.procedimento === "Lavate il basilico.\nPestate aglio e pinoli.\nUnite formaggio e olio." && e.fotoUrl === "https://www.sito-prova.it/foto/pesto.jpg" && e.porzioni === "4" && e.tempo === "20 min");
e = await esempio("etichette-vecchie.html");
prova("sito vecchio senza scheda: letto con il metodo di riserva e segnalato", e.trovata && e.metodo === "etichette" && e.titolo === "Risotto ai funghi porcini" && e.ingredienti.length === 4 && e.ingredienti[0] === "320 g di riso Carnaroli" && e.ingredienti[3] === "40 g di burro" && e.procedimento.split("\n").length === 3 && e.tempo === "35 min" && e.porzioni === "4 persone" && e.avvisi.some((a) => a.includes("metodo di riserva")));
e = await esempio("scheda-povera.html");
prova("scheda incompleta: dice cosa manca e non inventa niente", e.trovata && e.ingredienti.length === 3 && e.procedimento === "" && e.tempo === "" && e.porzioni === "" && e.fotoUrl === "" && e.avvisi.length === 3);
e = await esempio("senza-ricetta.html");
prova("pagina senza ricetta: solo titolo e immagine, niente inventato", !e.trovata && e.titolo === "Dieci idee per la cena" && e.ingredienti.length === 0 && e.procedimento === "" && e.fotoUrl === "https://rivista-prova.it/cena.jpg");
e = estraiRicetta(await readFile(path.join(qui, "pagine", "social-video.html"), "utf8"), "https://www.facebook.com/share/r/abc/");
prova("link di un social: riconosciuto, solo titolo, anteprima e descrizione, nessun ingrediente inventato", !e.trovata && e.sociale && e.titolo.startsWith("Pasta al forno") && e.descrizione.includes("500 g di rigatoni, 400 g di ragù") && e.fotoUrl.endsWith("anteprima.jpg") && e.ingredienti.length === 0 && eSocial("https://fb.watch/x") && eSocial("https://www.instagram.com/reel/x") && !eSocial("https://www.giallozafferano.it/"));
const lunga = estraiRicetta(`<script type="application/ld+json">${JSON.stringify({ "@type": "Recipe", name: "x".repeat(900), recipeIngredient: Array(500).fill("y".repeat(900)), recipeInstructions: "z".repeat(50000) })}</script>`, "https://x.it");
prova("testi troppo lunghi accorciati alle misure della tabella", lunga.titolo.length <= 300 && lunga.ingredienti.length <= 150 && lunga.ingredienti[0].length <= 300 && lunga.procedimento.length <= 20000);

console.log("Scaricamento protetto (rete finta)");
const reteVera = globalThis.fetch, nomiVeri = dipendenze.lookup;
const chiamati = [];
const INTERNET = {
  "https://buono.it/ricetta": () => new Response(`<title>Ok</title><script type="application/ld+json">{"@type":"Recipe","name":"Buona","recipeIngredient":["1 uovo"]}</script>`, { headers: { "content-type": "text/html; charset=utf-8" } }),
  "https://rimando.it/a": () => new Response(null, { status: 302, headers: { location: "https://buono.it/ricetta" } }),
  "https://cattivo.it/": () => new Response(null, { status: 301, headers: { location: "http://169.254.169.254/latest/meta-data/" } }),
  "https://giro.it/": () => new Response(null, { status: 302, headers: { location: "https://giro.it/" } }),
  "https://enorme.it/": () => new Response("<html>" + "a".repeat(MAX_BYTE + 500000), { headers: { "content-type": "text/html" } }),
  "https://file.it/foto.jpg": () => new Response("xx", { headers: { "content-type": "image/jpeg" } }),
  "https://social.it/reel/1": () => new Response(null, { status: 302, headers: { location: "https://social.it/login/?next=reel" } }),
  "https://social.it/login/?next=reel": () => new Response("<title>Accedi</title>", { headers: { "content-type": "text/html" } }),
  "https://chiuso.it/": () => new Response("no", { status: 403 }),
  "https://vecchio.fr/": () => new Response(Buffer.from("<title>Cr\xe8me br\xfbl\xe9e</title>", "latin1"), { headers: { "content-type": "text/html; charset=iso-8859-1" } }),
};
globalThis.fetch = async (u) => { chiamati.push(String(u)); if (!INTERNET[u]) throw new Error("sito inesistente"); return INTERNET[u](); };
dipendenze.lookup = async (nome) => (nome === "travestito.it" ? [{ address: "10.0.0.7", family: 4 }] : [{ address: "93.184.216.34", family: 4 }]);
const errore = async (u) => { try { await scaricaPagina(u); return ""; } catch (x) { return x.message; } };
prova("pagina normale scaricata", (await scaricaPagina("https://buono.it/ricetta")).html.includes("Buona"));
prova("segue un rimando verso un sito pubblico", (await scaricaPagina("https://rimando.it/a")).url === "https://buono.it/ricetta");
chiamati.length = 0;
prova("un rimando verso un indirizzo interno viene fermato prima di chiamarlo", (await errore("https://cattivo.it/")).includes("non valido") && chiamati.length === 1);
chiamati.length = 0;
prova("un nome che porta a un computer interno non viene chiamato", (await errore("https://travestito.it/")) !== "" && chiamati.length === 0);
prova("rimandi senza fine: si ferma", (await errore("https://giro.it/")).includes("troppe volte"));
prova("pagina enorme: tagliata al limite", (await scaricaPagina("https://enorme.it/")).html.length === MAX_BYTE);
prova("un file che non è una pagina viene rifiutato", (await errore("https://file.it/foto.jpg")).includes("non è una pagina"));
prova("sito che rifiuta le letture automatiche: lo dice", (await errore("https://chiuso.it/")).includes("rifiuta"));
prova("pagina che rimanda all'accesso: lo dice e non prende il titolo «Accedi»", (await errore("https://social.it/reel/1")).includes("accesso"));
prova("pagina con vecchia codifica francese: accenti giusti", (await scaricaPagina("https://vecchio.fr/")).html.includes("Crème brûlée"));
const chiama = async (intestazioni, corpo) => { let out; await importaLink({ req: { headers: intestazioni, bodyJson: corpo }, res: { json: (d, c = 200) => (out = { ...d, codice: c }) }, error() {} }); return out; };
prova("funzione: senza accesso rifiuta", (await chiama({}, { url: "https://buono.it/ricetta" })).codice === 401);
const fatta = await chiama({ "x-appwrite-user-id": "u1" }, { url: "https://buono.it/ricetta" });
prova("funzione: con accesso restituisce la ricetta", fatta.ok && fatta.ricetta.trovata && fatta.ricetta.ingredienti[0] === "1 uovo");
prova("funzione: indirizzo interno rifiutato con messaggio chiaro", (await chiama({ "x-appwrite-user-id": "u1" }, { url: "http://localhost/admin" })).codice === 400);
globalThis.fetch = reteVera; dipendenze.lookup = nomiVeri;

/* ---- 2. Il programma nel browser ---- */
console.log("Programma (modalità prova)");
const TIPI = { ".html": "text/html", ".js": "text/javascript", ".webmanifest": "application/manifest+json", ".png": "image/png" };
const server = http.createServer(async (req, res) => {
  // Le prove girano in modalità prova: al posto di config.js il server ne dà uno senza progetto.
  // In più indicano un finto server (qui sotto) che fa le veci della funzione «importa-link».
  if (req.url.startsWith("/config.js")) { res.writeHead(200, { "content-type": "text/javascript" }); return res.end("window.RICETTE_CONFIG = { projectId: '', serverDiProva: '/finto/', fnLink: 'importa-link' };"); }
  if (req.url === "/finto/importa-link") {
    let corpo = ""; for await (const c of req) corpo += c;
    const url = JSON.parse(corpo).url, nome = path.basename(new URL(url).pathname);
    if (nome === "bloccato") { res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify({ ok: false, errore: "Questa pagina si vede solo dopo aver fatto l'accesso al sito: non posso leggerla." })); }
    res.writeHead(200, { "content-type": "application/json" });
    try { return res.end(JSON.stringify({ ok: true, ricetta: estraiRicetta(await readFile(path.join(qui, "pagine", nome.replace(/^reel-/, "")), "utf8"), url) })); }
    catch { return res.end(JSON.stringify({ ok: false, errore: "Il sito ha risposto con un errore (404)." })); }
  }
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
// Le foto dei siti di esempio non esistono: al loro posto il browser riceve un puntino trasparente.
const PUNTINO = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
await p.context().route((u) => u.hostname !== "localhost", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PUNTINO }));
const errori = [];
p.on("pageerror", (e) => errori.push(String(e)));
p.on("console", (m) => { if (m.type() === "error") errori.push(m.text()); });
p.on("dialog", (d) => d.accept());
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

console.log("Importazione da link nel browser (pagine di esempio)");
const leggi = async (pagina, atteso) => {
  await p.fill("#mLink", "https://www.sito-prova.it/ricette/" + pagina);
  await p.click("#mLeggiLink");
  await p.waitForFunction((t) => document.getElementById("mStato").textContent.includes(t), atteso);
};
await p.click("#btnNuova");
await p.check("#mPubblica");
await leggi("scheda-wordpress.html", "Letta.");
prova("scheda da controllare riempita con i dati del sito", (await p.inputValue("#mTitolo")) === "Torta di mele della nonna" && (await p.inputValue("#mIngredienti")).split("\n").length === 5 && (await p.inputValue("#mProcedimento")).includes("Montate le uova") && (await p.inputValue("#mTempo")) === "1 h 5 min" && (await p.inputValue("#mPorzioni")) === "8 fette" && (await p.inputValue("#mCategorie")) === "Dolci, Torte");
prova("avviso di controllo visibile, foto del sito in anteprima, ricetta rimessa privata", (await p.locator("#mDubbi").textContent()).includes("controlla i dati prima di salvare") && (await p.locator("#mAnteprima img").getAttribute("src")).endsWith("torta-mele.jpg") && !(await p.isChecked("#mPubblica")));
if (process.env.FOTO) await p.screenshot({ path: process.env.FOTO, fullPage: true });
await p.fill("#mIngredienti", (await p.inputValue("#mIngredienti")) + "\n1 pizzico di cannella");
await p.click("#mSalva");
await p.waitForSelector(".velo", { state: "detached" });
await p.fill("#fTesto", "CANNELLA");
prova("ricetta importata e corretta a mano: salvata e trovata per ingrediente", (await p.locator(".scheda").count()) === 1 && (await p.locator(".scheda h3").textContent()) === "Torta di mele della nonna" && (await p.locator(".scheda .privata").count()) === 1);
await p.click(".scheda >> text=Torta di mele della nonna");
prova("scheda salvata: link alla pagina originale e fonte", (await p.locator(".dettaglio a").getAttribute("href")) === "https://www.sito-prova.it/ricette/scheda-wordpress.html" && (await p.locator(".dettaglio").textContent()).includes("Fonte: sito-prova.it") && (await p.locator(".dettaglio li").count()) === 6);
await p.click("#dChiudi");
await p.fill("#fTesto", "");

await p.click("#btnNuova");
await p.fill("#mIngredienti", "scritto a mano");
await leggi("senza-ricetta.html", "inseriscila a mano");
prova("pagina senza ricetta: lo dice, propone solo il titolo, non cancella quello già scritto", (await p.locator("#mDubbi").textContent()).includes("non contiene una ricetta leggibile") && (await p.inputValue("#mTitolo")) === "Dieci idee per la cena" && (await p.inputValue("#mIngredienti")) === "scritto a mano" && (await p.inputValue("#mProcedimento")) === "");
await leggi("scheda-povera.html", "Letta.");
prova("scheda incompleta: quello che manca è in evidenza", (await p.locator("#mDubbi li").allTextContents()).some((t) => t.includes("procedimento")) && (await p.inputValue("#mProcedimento")) === "");
await leggi("non-esiste.html", "inseriscila a mano");
prova("sito che risponde con un errore: messaggio chiaro, dati lasciati come sono", (await p.locator("#mDubbi").textContent()).includes("errore (404)") && (await p.inputValue("#mTitolo")) === "Insalata caprese");
await p.click("#mAnnulla");

// Link di un social (reel): si salva il link, il resto a mano.
const leggiSocial = async (indirizzoSocial) => {
  await p.fill("#mLink", indirizzoSocial);
  await p.click("#mLeggiLink");
  await p.waitForFunction(() => document.getElementById("mStato").textContent.includes("inseriscila a mano"));
};
await p.click("#btnNuova");
await leggiSocial("https://www.facebook.com/share/r/reel-social-video.html");
prova("reel con anteprima leggibile: titolo, immagine e descrizione proposti, ingredienti vuoti, avviso chiaro", (await p.locator("#mDubbi").textContent()).includes("Link di un social") && (await p.inputValue("#mTitolo")).startsWith("Pasta al forno") && (await p.inputValue("#mProcedimento")).includes("500 g di rigatoni") && (await p.inputValue("#mIngredienti")) === "" && (await p.locator("#mAnteprima img").getAttribute("src")).endsWith("anteprima.jpg"));
await p.click("#mAnnulla");
await p.click("#btnNuova");
await leggiSocial("https://www.facebook.com/share/r/bloccato");
prova("reel non leggibile: lo dice e lascia scrivere a mano", (await p.locator("#mDubbi").textContent()).includes("social spesso rifiutano") && (await p.locator("#mDubbi").textContent()).includes("Il link resta nella scheda") && (await p.inputValue("#mTitolo")) === "");
await p.fill("#mTitolo", "Pasta del reel");
await p.fill("#mIngredienti", "500 g di rigatoni\n400 g di ragù");
await p.click("#mSalva");
await p.waitForSelector(".velo", { state: "detached" });
await p.click(".scheda >> text=Pasta del reel");
prova("reel non leggibile: salvato lo stesso con il link e gli ingredienti scritti a mano", (await p.locator(".dettaglio a").getAttribute("href")) === "https://www.facebook.com/share/r/bloccato" && (await p.locator(".dettaglio li").count()) === 2 && (await p.locator(".dettaglio").textContent()).includes("Fonte: facebook.com"));
await p.click("#dChiudi");
await p.fill("#fTesto", "carbonàra ROMANA");
prova("la ricerca non bada ad accenti e maiuscole", (await p.locator(".scheda").count()) === 1);
prova("link al sito di Sapori d'Italia", (await p.locator("#btnSapori").getAttribute("href")) === "https://www.saporiditalia.club" && (await p.locator("#btnSapori").getAttribute("target")) === "_blank");
await p.fill("#fTesto", "");

await p.click(".scheda >> text=Carbonara romana");
await p.click("#dElimina");
await p.waitForSelector(".velo", { state: "detached" });
prova("eliminazione", (await p.locator(".scheda").count()) === 3);

console.log("App installabile");
const man = await p.evaluate(async () => (await fetch(document.querySelector('link[rel="manifest"]').href)).json());
const icone = await p.evaluate(async (l) => Promise.all(l.map(async (i) => (await fetch(i.src)).ok)), man.icons);
prova("scheda dell'app: nome, schermo pieno, icone 192 e 512 presenti", man.name === "Le ricette di Sapori" && man.display === "standalone" && man.icons.some((i) => i.sizes === "192x192") && man.icons.some((i) => i.sizes === "512x512") && icone.every(Boolean));
prova("servizio in sottofondo attivo", await p.evaluate(async () => !!(await navigator.serviceWorker.ready).active));
await p.waitForFunction(async () => (await caches.keys()).length > 0);
await p.context().setOffline(true);
await p.reload();
prova("si apre anche senza rete", (await p.locator("header h1").textContent()).includes("Le ricette di Sapori") && (await p.locator(".scheda").count()) === 3);
await p.context().setOffline(false);
await p.setViewportSize({ width: 390, height: 800 });
prova("su iPhone il pulsante spiega come installare", await (async () => {
  const q = await browser.newPage({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1", viewport: { width: 390, height: 800 } });
  await q.goto(indirizzo); await q.click("#btnInstalla");
  const ok = (await q.locator(".finestra").textContent()).includes("Aggiungi alla schermata Home"); await q.close(); return ok;
})());

const vecchio = await p.evaluate(() => { localStorage.setItem("ricette-di-sapori-v1", JSON.stringify([{ id: "v1", titolo: "Vecchia" }])); return true; });
await p.reload();
await p.click(".scheda >> text=Vecchia");
prova("dati vecchi incompleti si aprono senza errori", vecchio && (await p.locator(".dettaglio h2").textContent()) === "Vecchia");
prova("nessun errore nella pagina", errori.length === 0);
if (errori.length) console.log(errori);

await browser.close(); server.close();
console.log(`\n${passate} prove passate, ${fallite} fallite`);
process.exit(fallite ? 1 : 0);
