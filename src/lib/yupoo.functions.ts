import { createServerFn } from "@tanstack/react-start";

type Category = "zapatillas" | "ropa" | "futbol" | "invierno" | "accesorios";

export type Product = {
  id: string;
  title: string;
  url: string;
  image: string;
  catalog: string;
  catalogName: string;
  category: Category;
};

const CATALOGS: { id: string; name: string; url: string; category: Category }[] = [
  { id: "pandashoesx", name: "Panda Shoes", url: "https://pandashoesx.x.yupoo.com", category: "zapatillas" },
  { id: "panshirt", name: "Pan Shirt", url: "https://panshirt.x.yupoo.com", category: "futbol" },
  { id: "pandaclothes", name: "Panda Clothes", url: "https://pandaclothes.x.yupoo.com", category: "ropa" },
  { id: "wu769809876", name: "WU Collection", url: "https://wu769809876.x.yupoo.com", category: "ropa" },
  { id: "maoyi998", name: "998 Maoyi", url: "http://998maoyi.x.yupoo.com", category: "accesorios" },
  { id: "winterclothes", name: "Winter Clothes", url: "https://winterclothes.x.yupoo.com", category: "invierno" },
];

const SIZE_NAMES = new Set([
  "thumb", "tiny", "xs", "small", "s",
  "medium", "m", "mid",
  "big", "b", "large", "l", "xl", "xxl",
  "square", "origin", "original", "full", "hd", "raw",
]);

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function isSizeVariantUrl(src: string): boolean {
  try {
    const u = new URL(src);
    const filename = u.pathname.split("/").pop() ?? "";
    const nameWithoutExt = filename.replace(/\.(jpe?g|png|webp|gif)$/i, "").toLowerCase();
    return SIZE_NAMES.has(nameWithoutExt);
  } catch {
    return false;
  }
}

function normalizeImageKey(src: string): string {
  try {
    const u = new URL(src);
    let path = u.pathname.toLowerCase().replace(/\.jpeg$/i, ".jpg");
    path = path.replace(
      /_(?:thumb|tiny|xs|small|s|medium|m|mid|big|b|large|l|xl|xxl|square|origin|original|full|hd|raw)\.(jpe?g|png|webp|gif)$/i,
      ".$1"
    );
    return u.host + path;
  } catch {
    return src.toLowerCase().split("?")[0].replace(/\.jpeg$/i, ".jpg");
  }
}

function imageQualityScore(src: string): number {
  const lower = src.toLowerCase();
  if (/_(?:origin|original|full|hd|raw)\./i.test(lower)) return 6;
  if (/_(?:xl|xxl)\./i.test(lower)) return 5;
  if (/_(?:large|big|l|b)\./i.test(lower)) return 4;
  if (/_(?:medium|mid|m)\./i.test(lower)) return 3;
  if (/_(?:small|s)\./i.test(lower)) return 2;
  if (/_(?:thumb|tiny|xs)\./i.test(lower)) return 1;
  return 3;
}

function parseAlbums(html: string, base: string): { title: string; url: string; image: string }[] {
  const items: { title: string; url: string; image: string }[] = [];
  const seen = new Set<string>();

  const blockRegex =
    /<a\b[^>]*class="[^"]*\balbum__main\b[^"]*"[^>]*href="([^"]+)"[^>]*?(?:title="([^"]*)")?[^>]*>([\s\S]*?)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = blockRegex.exec(html)) !== null) {
    const href = decodeEntities(m[1]);
    let title = decodeEntities((m[2] || "").trim());
    const inner = m[3];

    const imgMatch =
      inner.match(/data-src="([^"]+)"/i) ||
      inner.match(/data-original="([^"]+)"/i) ||
      inner.match(/<img[^>]*\ssrc="([^"]+)"/i);
    if (!imgMatch) continue;

    let image = decodeEntities(imgMatch[1].trim());
    if (image.startsWith("//")) image = "https:" + image;
    if (image.startsWith("/")) image = base + image;
    if (/im_photo_album|avatar|logo|qrcode|favicon|sprite|loading_icon/i.test(image)) continue;

    if (!title) {
      const titleMatch =
        inner.match(/album__main_title[^>]*>\s*([^<]+?)\s*</i) ||
        inner.match(/\btitle="([^"]+)"/i) ||
        inner.match(/<h[1-6][^>]*>\s*([^<]+?)\s*<\/h[1-6]>/i) ||
        inner.match(/<span[^>]*>\s*([^<]+?)\s*<\/span>/i);
      if (titleMatch) title = decodeEntities(titleMatch[1].trim());
    }
    if (!title) title = "Álbum";

    const url = href.startsWith("http") ? href : base + href;
    const urlKey = url.split("?")[0];
    if (seen.has(urlKey)) continue;
    seen.add(urlKey);

    items.push({ title, url, image });
  }

  return items;
}

async function scrapeOne(catalog: (typeof CATALOGS)[number]): Promise<Product[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY not configured");

  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: catalog.url,
      formats: ["html"],
      onlyMainContent: false,
      waitFor: 1500,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error(`Firecrawl ${catalog.id} ${res.status}: ${txt.slice(0, 200)}`);
    return [];
  }

  const json = (await res.json()) as { data?: { html?: string } };
  const html = json.data?.html;
  if (!html) return [];

  const base = catalog.url.replace(/\/$/, "");
  const albums = parseAlbums(html, base);

  return albums.slice(0, 80).map((a, i) => ({
    id: `${catalog.id}-${i}-${a.url.slice(-20)}`,
    title: a.title,
    url: a.url,
    image: a.image,
    catalog: catalog.id,
    catalogName: catalog.name,
    category: catalog.category,
  }));
}

function normalizeTitleKey(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isGenericTitle(t: string): boolean {
  const k = normalizeTitleKey(t);
  if (!k) return true;
  if (/^(album|albumes|albums|foto|fotos|photo|photos|untitled|sin titulo)$/.test(k)) return true;
  if (/^\d+$/.test(k.replace(/\s+/g, ""))) return true;
  return k.replace(/\s+/g, "").length < 4;
}

function dedupeProducts(products: Product[]): Product[] {
  const seenUrl = new Set<string>();
  const seenImage = new Set<string>();
  const seenTitle = new Set<string>();
  const out: Product[] = [];
  for (const p of products) {
    const urlKey = p.url.split("?")[0].toLowerCase();
    const imgKey = normalizeImageKey(p.image);
    if (seenUrl.has(urlKey)) continue;
    if (seenImage.has(imgKey)) continue;
    if (!isGenericTitle(p.title)) {
      const titleKey = `${p.catalog}::${normalizeTitleKey(p.title)}`;
      if (seenTitle.has(titleKey)) continue;
      seenTitle.add(titleKey);
    }
    seenUrl.add(urlKey);
    seenImage.add(imgKey);
    out.push(p);
  }
  return out;
}

// ─── CACHÉ EN CLOUDFLARE KV ───────────────────────────────────────────────────
// Lee los productos del KV si están frescos (menos de 1 hora),
// si no hace el scraping completo y los guarda en KV.

const CACHE_KEY = "yupoo-products-v1";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

/**
 * Obtiene los bindings de Cloudflare de forma segura.
 * Solo disponible en Workers/Pages, retorna null en desarrollo local.
 */
function getCloudflareBindings(): { YUPOO_KV: KVNamespace | null } {
  if (typeof globalThis === "undefined") {
    return { YUPOO_KV: null };
  }
  
  const kv = (globalThis as any).YUPOO_KV ?? null;
  return { YUPOO_KV: kv };
}

async function getFromKV(): Promise<{ products: Product[]; errors: string[]; fetchedAt: string } | null> {
  try {
    const { YUPOO_KV } = getCloudflareBindings();
    if (!YUPOO_KV) {
      console.debug("Cloudflare KV not available (dev environment?)");
      return null;
    }
    const raw = await YUPOO_KV.get(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Comprobar si el caché sigue fresco
    if (Date.now() - new Date(data.fetchedAt).getTime() < CACHE_TTL_MS) {
      return data;
    }
    return null;
  } catch (e) {
    console.error("KV read error:", e);
    return null;
  }
}

async function saveToKV(data: { products: Product[]; errors: string[]; fetchedAt: string }): Promise<void> {
  try {
    const { YUPOO_KV } = getCloudflareBindings();
    if (!YUPOO_KV) {
      console.debug("Cloudflare KV not available (dev environment?)");
      return;
    }
    // TTL de 2 horas en KV (por si el cron falla, los datos siguen disponibles)
    await YUPOO_KV.put(CACHE_KEY, JSON.stringify(data), { expirationTtl: 7200 });
  } catch (e) {
    console.error("KV write error:", e);
  }
}

export const fetchAllProducts = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ products: Product[]; errors: string[]; fetchedAt: string }> => {

    // 1. Intentar leer del caché KV primero
    const cached = await getFromKV();
    if (cached) {
      console.log("Serving from KV cache, fetchedAt:", cached.fetchedAt);
      return cached;
    }

    // 2. Si no hay caché, hacer el scraping completo
    console.log("Cache miss — scraping Firecrawl...");
    const results = await Promise.allSettled(CATALOGS.map((c) => scrapeOne(c)));

    const products: Product[] = [];
    const errors: string[] = [];

    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        products.push(...r.value);
      } else {
        errors.push(`${CATALOGS[i].name}: ${String(r.reason)}`);
      }
    });

    const data = {
      products: dedupeProducts(products),
      errors,
      fetchedAt: new Date().toISOString(),
    };

    // 3. Guardar en KV para las próximas visitas
    await saveToKV(data);

    return data;
  }
);

function parseAlbumImages(html: string): string[] {
  const bestByKey = new Map<string, { src: string; score: number }>();
  const keyOrder: string[] = [];

  const imgRegex = /<img\b([^>]+)>/gi;
  const attrRegex =
    /\b(?:data-origin-src|data-origin|data-src|data-original|data-lazy|data-echo|src)\s*=\s*"([^"]+)"/gi;

  let m: RegExpExecArray | null;
  while ((m = imgRegex.exec(html)) !== null) {
    const tag = m[1];
    attrRegex.lastIndex = 0;
    let a: RegExpExecArray | null;
    while ((a = attrRegex.exec(tag)) !== null) {
      let src = decodeEntities(a[1].trim());
      if (!src || src.startsWith("data:")) continue;
      if (src.startsWith("//")) src = "https:" + src;
      if (!/^https?:\/\/photo\.yupoo\.com\//i.test(src)) continue;
      if (/im_photo_album|avatar|logo|qrcode|favicon|sprite|loading_icon/i.test(src)) continue;
      if (isSizeVariantUrl(src)) continue;

      const key = normalizeImageKey(src);
      const score = imageQualityScore(src);
      const existing = bestByKey.get(key);

      if (!existing) {
        bestByKey.set(key, { src, score });
        keyOrder.push(key);
      } else if (score > existing.score) {
        bestByKey.set(key, { src, score });
      }
    }
  }

  return keyOrder.map((key) => bestByKey.get(key)!.src).slice(0, 25);
}

export const fetchAlbumImages = createServerFn({ method: "POST" })
  .inputValidator((input: { url: string }) => {
    if (!input?.url || typeof input.url !== "string") throw new Error("url required");
    if (!/yupoo\.com/i.test(input.url)) throw new Error("Invalid yupoo url");
    return input;
  })
  .handler(async ({ data }): Promise<{ images: string[] }> => {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) throw new Error("FIRECRAWL_API_KEY not configured");

    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: decodeEntities(data.url),
        formats: ["html"],
        onlyMainContent: false,
        waitFor: 2000,
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Firecrawl ${res.status}: ${txt.slice(0, 160)}`);
    }

    const json = (await res.json()) as { data?: { html?: string } };
    const html = json.data?.html ?? "";
    const images = parseAlbumImages(html);
    return { images };
  });
