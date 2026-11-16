// Estrae una ricetta dal testo di una pagina web.
// Molti siti di ricette mettono nella pagina una scheda nascosta per i motori di
// ricerca (formato «schema.org Recipe»): leggiamo quella. Se non c'è, restano
// solo titolo e immagine della pagina.

const ENTITA = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", egrave: "è", eacute: "é", agrave: "à", ograve: "ò", ugrave: "ù", igrave: "ì" };

export function pulisci(t) {
  return String(t ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITA[n.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

const lista = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

function cercaRicetta(nodo) {
  for (const n of lista(nodo)) {
    if (!n || typeof n !== "object") continue;
    if (lista(n["@type"]).includes("Recipe")) return n;
    const dentro = cercaRicetta(n["@graph"]);
    if (dentro) return dentro;
  }
  return null;
}

function immagine(v) {
  const primo = lista(v)[0];
  if (!primo) return "";
  return typeof primo === "string" ? primo : primo.url || "";
}

function passi(v) {
  const righe = [];
  for (const p of lista(v)) {
    if (typeof p === "string") righe.push(pulisci(p));
    else if (p && p.itemListElement) righe.push(...passi(p.itemListElement));
    else if (p && (p.text || p.name)) righe.push(pulisci(p.text || p.name));
  }
  return righe.filter(Boolean);
}

// «PT1H30M» → «1 h 30 min»
export function durata(iso) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i.exec(String(iso || ""));
  if (!m || (!m[1] && !m[2] && !m[3])) return "";
  const ore = (+m[1] || 0) * 24 + (+m[2] || 0), min = +m[3] || 0;
  return [ore ? ore + " h" : "", min ? min + " min" : ""].filter(Boolean).join(" ");
}

function meta(html, nome) {
  const tag = new RegExp(`<meta[^>]+(?:property|name)=["']${nome}["'][^>]*>`, "i").exec(html);
  const c = tag && /content=["']([^"']*)["']/i.exec(tag[0]);
  return c ? pulisci(c[1]) : "";
}

export function estraiRicetta(html, url = "") {
  let fonte = "";
  try { fonte = new URL(url).hostname.replace(/^www\./, ""); } catch {}
  const titoloPagina = meta(html, "og:title") || pulisci((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1]);
  const base = { trovata: false, titolo: titoloPagina, fotoUrl: meta(html, "og:image"), fonte, categorie: [], ingredienti: [], procedimento: "", tempo: "", porzioni: "" };

  const blocchi = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const b of blocchi) {
    let dati;
    try { dati = JSON.parse(b[1].trim()); } catch { continue; }
    const r = cercaRicetta(dati);
    if (!r) continue;
    return {
      trovata: true,
      titolo: pulisci(r.name) || base.titolo,
      fotoUrl: immagine(r.image) || base.fotoUrl,
      fonte,
      categorie: lista(r.recipeCategory).flatMap((c) => String(c).split(",")).map(pulisci).filter(Boolean),
      ingredienti: lista(r.recipeIngredient).map(pulisci).filter(Boolean),
      procedimento: passi(r.recipeInstructions).join("\n"),
      tempo: durata(r.totalTime) || durata(r.cookTime) || durata(r.prepTime),
      porzioni: pulisci(lista(r.recipeYield)[0]),
    };
  }
  return base;
}

// Rifiuta indirizzi che non sono siti pubblici (protezione del server).
export function indirizzoPermesso(testo) {
  let u;
  try { u = new URL(testo); } catch { return false; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || !h.includes(".")) return false;
  if (/^[\d.]+$/.test(h) || h.includes(":") || h.startsWith("[")) return false; // niente indirizzi numerici
  return true;
}
