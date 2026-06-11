import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_IMAGE_HOSTS = [
  "photo.yupoo.com",
  "s.yupoo.com",
  "alfred-internal-1365252509.cos.ap-shanghai.myqcloud.com",
];

const IMAGE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
  Referer: "https://www.yupoo.com/",
  Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
};

// 7 días en el edge de Cloudflare, 1 día en el browser
const CACHE_CONTROL = "public, max-age=86400, s-maxage=604800";

function badRequest(message: string, status = 400) {
  return new Response(message, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/public/image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const rawUrl = new URL(request.url).searchParams.get("url");
        if (!rawUrl) return badRequest("Missing image URL");

        let url: URL;
        try {
          url = new URL(rawUrl);
        } catch {
          return badRequest("Invalid image URL");
        }

        if (!["https:", "http:"].includes(url.protocol)) {
          return badRequest("Unsupported image URL");
        }

        if (
          !ALLOWED_IMAGE_HOSTS.some(
            (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
          )
        ) {
          return badRequest("Image host not allowed", 403);
        }

        // ── 1. Buscar en la caché del edge de Cloudflare ──────────────────────
        // caches.default solo existe en el runtime de Cloudflare Workers.
        // En desarrollo local (miniflare / bun dev) puede no estar disponible,
        // por eso envolvemos todo en try/catch.
        const cache = typeof caches !== "undefined" ? caches.default : null;

        if (cache) {
          try {
            const cached = await cache.match(request);
            if (cached) {
              // HIT: devolver directamente desde el edge, sin tocar Yupoo
              return new Response(cached.body, {
                status: cached.status,
                headers: {
                  ...Object.fromEntries(cached.headers.entries()),
                  "X-Cache": "HIT",
                },
              });
            }
          } catch {
            // Si falla la caché (ej. en local), continuar sin ella
          }
        }

        // ── 2. MISS: fetch a Yupoo ────────────────────────────────────────────
        const upstream = await fetch(url.toString(), { headers: IMAGE_HEADERS });

        if (!upstream.ok || !upstream.body) {
          return badRequest("Image unavailable", upstream.status || 502);
        }

        const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
        if (!contentType.startsWith("image/")) {
          return badRequest("URL is not an image", 415);
        }

        // Construir los headers del response final
        const responseHeaders: Record<string, string> = {
          "Content-Type": contentType,
          "Cache-Control": CACHE_CONTROL,
          "X-Cache": "MISS",
        };

        // Propagar Content-Length si existe (mejora streaming)
        const contentLength = upstream.headers.get("content-length");
        if (contentLength) responseHeaders["Content-Length"] = contentLength;

        // ── 3. Guardar en caché del edge ──────────────────────────────────────
        // Necesitamos clonar el body porque un Response solo se puede leer una vez:
        // - responseForCache → lo guardamos en caches.default
        // - responseForClient → lo devolvemos al navegador
        if (cache) {
          try {
            // Tee el stream: upstream.body solo se puede consumir una vez
            const [body1, body2] = upstream.body.tee();

            const responseForCache = new Response(body1, {
              status: 200,
              headers: responseHeaders,
            });

            // put() es async pero no bloqueamos la respuesta al cliente
            // waitUntil no existe en este contexto de TanStack Start,
            // así que usamos un void promise (Cloudflare lo completa antes de cerrar el Worker)
            void cache.put(request, responseForCache);

            return new Response(body2, {
              status: 200,
              headers: responseHeaders,
            });
          } catch {
            // Si falla el tee/put, devolver el upstream directamente sin caché
          }
        }

        // Fallback sin caché (local dev o si algo falló arriba)
        return new Response(upstream.body, {
          status: 200,
          headers: responseHeaders,
        });
      },
    },
  },
});
