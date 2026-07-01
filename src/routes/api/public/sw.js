// VAULT — Service Worker básico
//
// Estrategia deliberadamente conservadora para no romper nada:
// - NUNCA intercepta peticiones POST (los server functions de TanStack Start
//   usan POST; interceptarlos rompería el scraping, el carrito y los pedidos)
// - NUNCA cachea /api/ (el proxy de imágenes y fetchAlbumImages ya gestionan
//   su propio cache-control desde el servidor)
// - Cache-first + revalidación en background para JS/CSS/fuentes/imágenes
//   estáticas del build (mejora la carga en visitas repetidas)
// - Network-first con fallback a caché para navegación (permite ver la
//   última versión visitada si el usuario pierde conexión)

const CACHE_NAME = "vault-static-v1";
const STATIC_EXTENSIONS = /\.(?:js|css|woff2?|ttf|png|jpg|jpeg|webp|svg|ico)$/;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Solo interceptar GET — nunca tocar POST (server functions de TanStack Start)
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Nunca cachear nada bajo /api/ (proxy de imágenes, fetch de álbumes, etc.)
  if (url.pathname.startsWith("/api/")) return;

  // Assets estáticos del build: cache-first, revalidando en background
  if (STATIC_EXTENSIONS.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const networkFetch = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // Navegación HTML: network-first, con fallback a caché si no hay conexión
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.open(CACHE_NAME).then((cache) => cache.match(request).then((r) => r || cache.match("/")))
      )
    );
  }
});
