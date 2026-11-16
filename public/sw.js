// Servizio in sottofondo: rende l'app installabile e la fa aprire anche senza rete.
// Tiene in memoria solo le pagine del programma, mai i dati di Appwrite.
// Cambiare il numero qui sotto a ogni pubblicazione, insieme a VERSION in index.html.
const MEMORIA = "ricette-di-sapori-0.2";
const FILE = ["./", "index.html", "appwrite.js", "config.js", "manifest.webmanifest", "icona-192.png", "icona-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(MEMORIA).then((c) => c.addAll(FILE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((n) => Promise.all(n.filter((x) => x !== MEMORIA).map((x) => caches.delete(x)))).then(() => self.clients.claim()));
});
// Prima la rete (così arriva sempre la versione nuova); se la rete manca, la copia in memoria.
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then((r) => {
      if (r.ok) { const copia = r.clone(); caches.open(MEMORIA).then((c) => c.put(e.request, copia)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
  );
});
