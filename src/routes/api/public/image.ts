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

        if (!ALLOWED_IMAGE_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
          return badRequest("Image host not allowed", 403);
        }

        let upstream: Response;
        try {
          upstream = await fetch(url.toString(), {
            headers: IMAGE_HEADERS,
            signal: AbortSignal.timeout(8000),
          });
        } catch (err) {
          console.error("[image-proxy] fetch failed", url.toString(), err);
          return new Response(null, {
            status: 204,
            headers: { "Cache-Control": "no-store" },
          });
        }

        if (!upstream.ok || !upstream.body) {
          console.error("[image-proxy] upstream not ok", url.toString(), upstream.status);
          return new Response(null, {
            status: 204,
            headers: { "Cache-Control": "no-store" },
          });
        }

        const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
        if (!contentType.startsWith("image/")) {
          return new Response(null, {
            status: 204,
            headers: { "Cache-Control": "no-store" },
          });
        }

        return new Response(upstream.body, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=86400, s-maxage=604800",
          },
        });
      },
    },
  },
});