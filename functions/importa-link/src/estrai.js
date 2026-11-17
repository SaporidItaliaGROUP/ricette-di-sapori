// Estrae una ricetta dal testo di una pagina web.
// Molti siti di ricette mettono nella pagina una scheda nascosta per i motori di
// ricerca (formato «schema.org Recipe»). La cerchiamo in due modi:
//   1. «JSON-LD»: un blocco di dati dentro la pagina (la strada più comune e più sicura);
//   2. «microdata»: etichette sparse nel testo della pagina (metodo di riserva, per siti più vecchi).
// Se non c'è nessuna delle due, restano solo titolo e immagine: non si inventa mai niente.

const ENTITA = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", deg: "°", frac12: "½", frac14: "¼", frac34: "¾",
  laquo: "«", raquo: "»", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", hellip: "…", ndash: "–", mdash: "—", euro: "€", times: "×",
  agrave: "à", aacute: "á", acirc: "â", auml: "ä", egrave: "è", eacute: "é", ecirc: "ê", euml: "ë",
  igrave: "ì", iacute: "í", icirc: "î", iuml: "ï", ograve: "ò", oacute: "ó", ocirc: "ô", ouml: "ö",
  ugrave: "ù", uacute: "ú", ucirc: "û", uuml: "ü", ccedil: "ç", ntilde: "ñ", oelig: "œ", aelig: "æ",
  Agrave: "À", Eacute: "É", Egrave: "È", Ecirc: "Ê", Ccedil: "Ç", OElig: "Œ",
};
// Lunghezze massime: sono quelle delle colonne della tabella su Appwrite.
// Social: lì la ricetta sta in un video o in un post, non in una scheda leggibile.
const SOCIAL = /(^|\.)(facebook\.com|fb\.watch|fb\.com|instagram\.com|tiktok\.com|youtube\.com|youtu\.be|pinterest\.[a-z.]+|threads\.net|x\.com|twitter\.com)$/i;
export const eSocial = (url) => { try { return SOCIAL.test(new URL(url).hostname); } catch { return false; } };
const MAX = { descrizione: 3000, titolo: 300, ingrediente: 300, categoria: 60, procedimento: 20000, tempo: 60, porzioni: 60, fotoUrl: 2000, voci: 150 };

const senzaTag = (t) => t.replace(/<\/?(?:b|i|u|em|strong|span|a|sup|sub|small|mark)\b[^>]*>/gi, "").replace(/<[^>]+>/g, " ");
const punto = (n) => { try { return String.fromCodePoint(n); } catch { return ""; } };

export function pulisci(t) {
  const decodificato = senzaTag(String(t ?? ""))
    .replace(/&#(\d+);/g, (_, n) => punto(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => punto(parseInt(n, 16)))
    .replace(/&([a-z0-9]+);/gi, (m, n) => ENTITA[n] ?? ENTITA[n.toLowerCase()] ?? m);
  return senzaTag(decodificato).replace(/\s+/g, " ").trim();
}
const taglia = (t, n) => (t.length > n ? t.slice(0, n - 1) + "…" : t);

// Un testo con paragrafi, elenchi o «a capo» diventa un elenco di righe pulite.
function righeDaTesto(t) {
  return String(t ?? "")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/<\/(?:li|p|div|h\d|tr)>|<br\s*\/?>/gi, "\n")
    .split(/\r?\n/).map(pulisci).filter(Boolean);
}

const lista = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const eRicetta = (n) => lista(n["@type"]).some((t) => /(^|\/)Recipe$/i.test(String(t)));

// Cerca la scheda della ricetta ovunque sia annidata; se ce n'è più d'una, prende la più completa.
function cercaRicette(nodo, livello = 0, trovate = []) {
  if (!nodo || typeof nodo !== "object" || livello > 8) return trovate;
  if (Array.isArray(nodo)) { for (const n of nodo) cercaRicette(n, livello + 1, trovate); return trovate; }
  if (eRicetta(nodo)) { trovate.push(nodo); return trovate; }
  for (const v of Object.values(nodo)) cercaRicette(v, livello + 1, trovate);
  return trovate;
}

// Il blocco di dati a volte è scritto male (a capo dentro le frasi, commenti intorno): si prova a ripararlo.
function leggiJson(testo) {
  const t = testo.trim().replace(/^<!--/, "").replace(/-->$/, "").replace(/^\/\*\s*<!\[CDATA\[\s*\*\/|^<!\[CDATA\[/, "").replace(/\/\*\s*\]\]>\s*\*\/$|\]\]>$/, "").trim();
  try { return JSON.parse(t); } catch {}
  try { return JSON.parse(t.replace(/[\u0000-\u001f]+/g, " ")); } catch {}
  return null;
}

function indirizzoAssoluto(v, base) {
  if (!String(v ?? "").trim()) return "";
  try { const u = new URL(String(v).trim(), base || undefined); return /^https?:$/.test(u.protocol) && u.href.length <= MAX.fotoUrl ? u.href : ""; } catch { return ""; }
}
function immagine(v, base) {
  for (const x of lista(v)) {
    const grezzo = typeof x === "string" ? x : x && (x.url || x.contentUrl || (x["@id"] && /\.(jpe?g|png|webp)/i.test(x["@id"]) ? x["@id"] : ""));
    const u = grezzo && indirizzoAssoluto(typeof grezzo === "string" ? grezzo : immagine(grezzo, base), base);
    if (u) return u;
  }
  return "";
}

function passi(v, livello = 0) {
  const out = [];
  if (livello > 5) return out;
  for (const p of lista(v)) {
    if (typeof p === "string") out.push(...righeDaTesto(p));
    else if (p && p.itemListElement) {
      const nome = pulisci(p.name);
      if (nome && livello === 0) out.push(nome.replace(/[:.]$/, "") + ":");
      out.push(...passi(p.itemListElement, livello + 1));
    } else if (p && (p.text || p.name || p.description)) out.push(...righeDaTesto(p.text || p.description || p.name));
  }
  return out;
}

// «PT1H30M» oppure «PT90M» → 90 (minuti). Zero se non è una durata scritta in quel modo.
function minuti(iso) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+(?:[.,]\d+)?)H)?(?:(\d+)M)?(?:\d+(?:[.,]\d+)?S)?$/i.exec(String(iso || "").trim());
  if (!m || (!m[1] && !m[2] && !m[3])) return 0;
  return Math.round((+m[1] || 0) * 1440 + (parseFloat(String(m[2] || 0).replace(",", ".")) || 0) * 60 + (+m[3] || 0));
}
const inParole = (min) => [min >= 60 ? Math.floor(min / 60) + " h" : "", min % 60 ? (min % 60) + " min" : ""].filter(Boolean).join(" ");
export function durata(iso) {
  const min = minuti(iso);
  if (min) return inParole(min);
  const testo = pulisci(iso); // qualche sito scrive «30 minuti» invece della sigla
  return /\d/.test(testo) && !/^P/i.test(testo) && testo.length <= 40 ? testo : "";
}
function tempoTotale(totale, preparazione, cottura) {
  if (durata(totale)) return durata(totale);
  const p = minuti(preparazione), c = minuti(cottura);
  return p || c ? inParole(p + c) : durata(cottura) || durata(preparazione);
}
function porzioni(v) {
  const voci = lista(v).map((x) => pulisci(typeof x === "object" && x ? x.value ?? x.name ?? "" : x)).filter(Boolean);
  return taglia(voci.find((x) => /[a-zà-ú]/i.test(x)) || voci[0] || "", MAX.porzioni);
}
const categorie = (v) => [...new Set(lista(v).flatMap((c) => String(c).split(/[,;]/)).map(pulisci).filter(Boolean).map((c) => taglia(c, MAX.categoria)))].slice(0, 8);
const ingredienti = (v) => lista(v).flatMap((x) => (typeof x === "string" ? righeDaTesto(x) : [])).map((x) => taglia(x, MAX.ingrediente)).slice(0, MAX.voci);
const procedimento = (righe) => taglia(righe.join("\n"), MAX.procedimento);

function meta(html, nome) {
  const tag = new RegExp(`<meta[^>]+(?:property|name)=["']${nome}["'][^>]*>`, "i").exec(html);
  const c = tag && /content=(?:"([^"]*)"|'([^']*)')/i.exec(tag[0]);
  return c ? pulisci(c[1] ?? c[2]) : "";
}

/* ---------- Metodo di riserva: etichette «microdata» nel testo della pagina ---------- */
const VUOTI = new Set(["meta", "img", "link", "br", "input", "source"]);
const attributo = (attr, nome) => { const m = new RegExp(`\\b${nome}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(attr); return m ? m[1] ?? m[2] : null; };

// Tutti gli elementi che portano una certa etichetta, con i loro attributi e il loro contenuto.
function etichettati(html, nomi) {
  const out = [], re = /<([a-z][a-z0-9]*)\b([^>]*\bitemprop\s*=\s*["'][^"']*["'][^>]*)>/gi;
  let m;
  while ((m = re.exec(html)) && out.length < 400) {
    const tag = m[1].toLowerCase(), attr = m[2];
    if (!(attributo(attr, "itemprop") || "").split(/\s+/).some((p) => nomi.includes(p))) continue;
    let dentro = "";
    if (!VUOTI.has(tag) && !/\/\s*$/.test(attr)) {
      const pari = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi"); pari.lastIndex = re.lastIndex;
      let aperti = 1, fine = html.length, x;
      while ((x = pari.exec(html))) { aperti += x[1] ? -1 : 1; if (!aperti) { fine = x.index; break; } }
      dentro = html.slice(re.lastIndex, fine);
    }
    out.push({ tag, attr, dentro });
  }
  return out;
}
const valore = (e) => (e.tag === "meta" ? attributo(e.attr, "content") : e.tag === "img" ? attributo(e.attr, "src") : e.tag === "link" || e.tag === "a" && !pulisci(e.dentro) ? attributo(e.attr, "href") : attributo(e.attr, "content") ?? e.dentro) ?? "";

function daMicrodata(html, url) {
  const inizio = html.search(/itemtype\s*=\s*["']https?:\/\/schema\.org\/Recipe\/?["']/i);
  if (inizio < 0) return null;
  const zona = html.slice(inizio);
  const primo = (nomi) => { const e = etichettati(zona, nomi)[0]; return e ? valore(e) : ""; };
  const tempoDi = (nome) => { const e = etichettati(zona, [nome])[0]; return e ? attributo(e.attr, "datetime") ?? attributo(e.attr, "content") ?? e.dentro : ""; };
  const ingr = ingredienti(etichettati(zona, ["recipeIngredient", "ingredients"]).map(valore));
  const righe = [...new Set(etichettati(zona, ["recipeInstructions"]).flatMap((e) => righeDaTesto(valore(e))))];
  if (!ingr.length && !righe.length) return null;
  const foto = etichettati(zona, ["image"])[0];
  return {
    titolo: pulisci(primo(["name"])),
    fotoUrl: foto ? indirizzoAssoluto(attributo(foto.attr, "src") ?? attributo(foto.attr, "content") ?? attributo(foto.attr, "href") ?? "", url) : "",
    categorie: categorie(etichettati(zona, ["recipeCategory"]).map(valore)),
    ingredienti: ingr,
    procedimento: procedimento(righe),
    tempo: taglia(tempoTotale(tempoDi("totalTime"), tempoDi("prepTime"), tempoDi("cookTime")), MAX.tempo),
    porzioni: porzioni(primo(["recipeYield"])),
  };
}

/* ---------- La lettura vera e propria ---------- */
export function estraiRicetta(html, url = "") {
  html = String(html || "");
  let fonte = "";
  try { fonte = new URL(url).hostname.replace(/^www\./, ""); } catch {}
  const titoloPagina = taglia(meta(html, "og:title") || pulisci((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1]), MAX.titolo);
  const fotoPagina = indirizzoAssoluto(meta(html, "og:image"), url);
  // La descrizione della pagina (nei social spesso contiene il testo del post): solo come aiuto, da sistemare a mano.
  const descrizione = taglia(meta(html, "og:description") || meta(html, "description"), MAX.descrizione);
  const base = { trovata: false, sociale: eSocial(url), descrizione, metodo: "", avvisi: [], titolo: titoloPagina, fotoUrl: fotoPagina, fonte, categorie: [], ingredienti: [], procedimento: "", tempo: "", porzioni: "" };

  const candidate = [];
  for (const b of html.matchAll(/<script[^>]+type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) candidate.push(...cercaRicette(leggiJson(b[1])));
  const peso = (r) => lista(r.recipeIngredient ?? r.ingredients).length * 2 + (r.recipeInstructions ? 1 : 0);
  const r = candidate.sort((a, b) => peso(b) - peso(a))[0];

  let trovata = null;
  if (r) {
    trovata = {
      metodo: "scheda",
      titolo: taglia(pulisci(r.name || r.headline), MAX.titolo),
      fotoUrl: immagine(r.image, url),
      categorie: categorie(r.recipeCategory),
      ingredienti: ingredienti(r.recipeIngredient ?? r.ingredients),
      procedimento: procedimento(passi(r.recipeInstructions)),
      tempo: taglia(tempoTotale(r.totalTime, r.prepTime, r.cookTime), MAX.tempo),
      porzioni: porzioni(r.recipeYield),
    };
  }
  // La scheda manca, oppure è vuota: si prova con le etichette nel testo.
  if (!trovata || (!trovata.ingredienti.length && !trovata.procedimento)) {
    const m = daMicrodata(html, url);
    if (m) trovata = { metodo: "etichette", ...m };
  }
  if (!trovata || (!trovata.ingredienti.length && !trovata.procedimento)) return base;

  const avvisi = [];
  if (trovata.metodo === "etichette") avvisi.push("Questo sito usa un formato vecchio: ho letto la ricetta con il metodo di riserva. Confrontala con la pagina originale.");
  if (!trovata.ingredienti.length) avvisi.push("Il sito non dichiara gli ingredienti: vanno scritti a mano.");
  if (!trovata.procedimento) avvisi.push("Il sito non dichiara il procedimento: va scritto a mano.");
  if (!trovata.tempo) avvisi.push("Tempo non dichiarato dal sito.");
  if (!trovata.porzioni) avvisi.push("Porzioni non dichiarate dal sito.");
  return { ...base, ...trovata, trovata: true, avvisi, titolo: trovata.titolo || base.titolo, fotoUrl: trovata.fotoUrl || base.fotoUrl };
}

/* ---------- Protezione: solo indirizzi di siti pubblici ---------- */
export function indirizzoPermesso(testo) {
  let u;
  try { u = new URL(String(testo)); } catch { return false; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (u.username || u.password || u.port) return false; // niente «utente:password@» né porte insolite
  const h = u.hostname.toLowerCase().replace(/\.$/, "");
  if (h === "localhost" || /\.(local|localhost|internal|lan|home|corp|intranet)$/.test(h) || !h.includes(".")) return false;
  if (/^[\d.]+$/.test(h) || /^0x/i.test(h) || h.includes(":") || h.startsWith("[")) return false; // niente indirizzi numerici
  return true;
}

// Vero se l'indirizzo numerico di un computer NON è su internet (rete interna, lo stesso server, ecc.).
export function ipRiservato(ip) {
  let t = String(ip || "").toLowerCase();
  const mappato = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(t);
  if (mappato) t = mappato[1];
  if (t.includes(":")) return t === "::" || t === "::1" || /^(fc|fd|fe[89ab]|ff)/.test(t) || t.startsWith("::ffff:") || t.startsWith("64:ff9b:");
  const n = t.split(".").map(Number);
  if (n.length !== 4 || n.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) return true;
  const [a, b] = n;
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
}
