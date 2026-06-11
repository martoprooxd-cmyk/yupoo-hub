import { createServerFn } from "@tanstack/react-start";

type Category = "zapatillas" | "ropa" | "futbol" | "invierno" | "accesorios";

export type ProductVariant = {
  id: string;
  title: string;
  url: string;
  image: string;
};

export type Product = {
  id: string;
  title: string;
  url: string;
  image: string;
  catalog: string;
  catalogName: string;
  category: Category;
  variants?: ProductVariant[]; // otros colores / versiones del mismo modelo
};

export const CATALOGS: { id: string; name: string; url: string; defaultCategory: Category }[] = [
  { id: "pandashoesx", name: "Panda Shoes", url: "https://pandashoesx.x.yupoo.com", defaultCategory: "zapatillas" },
  { id: "panshirt", name: "Pan Shirt", url: "https://panshirt.x.yupoo.com", defaultCategory: "futbol" },
  { id: "pandaclothes", name: "Panda Clothes", url: "https://pandaclothes.x.yupoo.com", defaultCategory: "ropa" },
  { id: "wu769809876", name: "WU Collection", url: "https://wu769809876.x.yupoo.com", defaultCategory: "ropa" },
  { id: "maoyi998", name: "998 Maoyi", url: "http://998maoyi.x.yupoo.com", defaultCategory: "zapatillas" },
  { id: "winterclothes", name: "Winter Clothes", url: "https://winterclothes.x.yupoo.com", defaultCategory: "invierno" },
];

const SIZE_NAMES = new Set([
  "thumb", "tiny", "xs", "small", "s",
  "medium", "m", "mid",
  "big", "b", "large", "l", "xl", "xxl",
  "square", "origin", "original", "full", "hd", "raw",
]);

// ─── Keywords para detección de categoría por título ─────────────────────────

const CATEGORY_KEYWORDS: { category: Category; keywords: string[] }[] = [
  {
    category: "futbol",
    keywords: ["jersey", "camiseta", "football", "soccer", "kit", "maillot", "calcio",
      "bundesliga", "laliga", "premier", "serie a", "ligue", "champions", "world cup",
      "national team", "selección", "shirt"],
  },
  {
    category: "zapatillas",
    keywords: ["jordan", "nike", "adidas", "yeezy", "dunk", "aj1", "aj4", "aj11",
      "air max", "air force", "new balance", "nb", "asics", "puma", "reebok",
      "sneaker", "zapatilla", "shoe", "trainer", "boost", "foam", "runner",
      "350", "380", "500", "990", "574", "550", "990v", "1080", "2002",
      "vans", "converse", "chuck", "ultraboost", "nmd", "ozweego",
      "off white", "travis", "fragment"],
  },
  {
    category: "invierno",
    keywords: ["jacket", "coat", "puffer", "down", "winter", "fleece", "hoodie",
      "sweatshirt", "sudadera", "chaqueta", "abrigo", "parka", "windbreaker",
      "anorak", "vest", "gilet", "norte face", "north face", "arcteryx",
      "canada goose", "moncler", "stone island"],
  },
  {
    category: "ropa",
    keywords: ["tshirt", "t-shirt", "tee", "polo", "shorts", "pants", "jeans",
      "denim", "cargo", "trousers", "top", "sweat", "tracksuit", "jogger",
      "hoodie", "crewneck", "long sleeve", "boxy", "oversized"],
  },
  {
    category: "accesorios",
    keywords: ["bag", "backpack", "cap", "hat", "belt", "wallet", "watch",
      "sunglasses", "socks", "scarf", "gloves", "keychain", "bracelet",
      "necklace", "ring", "earring", "bolso", "gorra", "cinturón",
      "calcetines", "bufanda"],
  },
];

function detectCategory(title: string, defaultCategory: Category): Category {
  const lower = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return category;
    }
  }

  return defaultCategory;
}

// ─── Normalización de títulos para agrupar variantes ─────────────────────────

// Colores y términos de variante habituales en títulos Yupoo
const COLOR_TOKENS = [
  "black", "white", "red", "blue", "green", "yellow", "orange", "purple",
  "pink", "grey", "gray", "brown", "navy", "cream", "beige", "olive",
  "burgundy", "wine", "khaki", "tan", "mint", "teal", "coral", "maroon",
  "silver", "gold", "multicolor", "multi", "colorway",
  // español
  "negro", "blanco", "rojo", "azul", "verde", "amarillo", "naranja",
  "morado", "rosa", "gris", "marron", "crema", "dorado", "plateado",
  // chino pinyin frecuente
  "hei", "bai", "hong", "lan", "lv",
  // versiones
  "ver\\.", "v\\d", "version", "edition", "collab", "x ", "\\bsp\\b",
  "mid", "low", "high", "og", "retro",
];

const COLOR_REGEX = new RegExp(
  `\\b(${COLOR_TOKENS.join("|")})\\b`,
  "gi"
);

// Elimina colores, números sueltos, paréntesis vacíos y espacios extra
function variantKey(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")       // quitar tildes
    .replace(COLOR_REGEX, " ")              // eliminar colores
    .replace(/\b\d{1,4}\b/g, " ")          // eliminar números sueltos
    .replace(/[^a-z0-9 ]+/g, " ")          // solo alfanumérico
    .replace(/\s+/g, " ")
    .trim();
}

// Similitud simple por palabras comunes (Jaccard sobre tokens)
function titleSimilarity(a: string, b: string): number {
  const tokA = new Set(variantKey(a).split(" ").filter(Boolean));
  const tokB = new Set(variantKey(b).split(" ").filter(Boolean));
  if (tokA.size === 0 || tokB.size === 0) return 0;
  let intersection = 0;
  tokA.forEach((t) => { if (tokB.has(t)) intersection++; });
  const union = tokA.size + tokB.size - intersection;
  return intersection / union;
}

const VARIANT_THRESHOLD = 0.72; // similaridad mínima para considerarlos variantes

/**
 * Agrupa variantes de color/versión dentro de un mismo catálogo.
 * Deja un producto "base" (el primero encontrado) y añade el resto en `.variants[]`.
 */
function groupVariants(products: Product[]): Product[] {
  // Agrupar solo dentro del mismo catálogo para evitar falsos positivos
  const byCatalog = new Map<string, Product[]>();
  for (const p of products) {
    const list = byCatalog.get(p.catalog) ?? [];
    list.push(p);
    byCatalog.set(p.catalog, list);
  }

  const result: Product[] = [];

  for (const [, items] of byCatalog) {
    // Union-Find ligero
    const parent = new Map<string, string>();
    const find = (id: string): string => {
      if (parent.get(id) === id) return id;
      const root = find(parent.get(id)!);
      parent.set(id, root);
      return root;
    };
    const union = (a: string, b: string) => {
      parent.set(find(b), find(a));
    };

    items.forEach((p) => parent.set(p.id, p.id));

    // Comparar cada par (O(n²) — OK para ≤80 items por catálogo)
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (titleSimilarity(items[i].title, items[j].title) >= VARIANT_THRESHOLD) {
          union(items[i].id, items[j].id);
        }
      }
    }

    // Construir grupos
    const groups = new Map<string, Product[]>();
    for (const p of items) {
      const root = find(p.id);
      const g = groups.get(root) ?? [];
      g.push(p);
      groups.set(root, g);
    }

    for (const group of groups.values()) {
      const [base, ...rest] = group;
      if (rest.length === 0) {
        result.push(base);
      } else {
        result.push({
          ...base,
          variants: rest.map((p) => ({
            id: p.id,
            title: p.title,
            url: p.url,
            image: p.image,
          })),
        });
      }
    }
  }

  return result;
}

// ─── Helpers de imagen ───────────────────────────────────────────────────────

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
    // Detectar categoría por título; si no se reconoce, usar la del catálogo
    category: detectCategory(a.title, catalog.defaultCategory),
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

// ─── Caché KV ─────────────────────────────────────────────────────────────────

const CACHE_KEY = "yupoo-products-v2"; // v2 para invalidar caché antigua
const CACHE_TTL_MS = 60 * 60 * 1000;

async function getFromKV(): Promise<{ products: Product[]; errors: string[]; fetchedAt: string } | null> {
  try {
    // @ts-expect-error YUPOO_KV binding de Cloudflare
    const kv = globalThis.YUPOO_KV;
    if (!kv) return null;
    const raw = await kv.get(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - new Date(data.fetchedAt).getTime() < CACHE_TTL_MS) return data;
    return null;
  } catch {
    return null;
  }
}

async function saveToKV(data: { products: Product[]; errors: string[]; fetchedAt: string }): Promise<void> {
  try {
    // @ts-expect-error YUPOO_KV binding de Cloudflare
    const kv = globalThis.YUPOO_KV;
    if (!kv) return;
    await kv.put(CACHE_KEY, JSON.stringify(data), { expirationTtl: 7200 });
  } catch (e) {
    console.error("KV write error:", e);
  }
}

export const fetchAllProducts = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ products: Product[]; errors: string[]; fetchedAt: string }> => {

    const cached = await getFromKV();
    if (cached) {
      console.log("Serving from KV cache, fetchedAt:", cached.fetchedAt);
      return cached;
    }

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

    // 1. Deduplicar por URL/imagen/título exacto
    const deduped = dedupeProducts(products);

    // 2. Agrupar variantes de color/versión del mismo modelo
    const grouped = groupVariants(deduped);

    const data = {
      products: grouped,
      errors,
      fetchedAt: new Date().toISOString(),
    };

    await saveToKV(data);
    return data;
  }
);

// ─── Album images ─────────────────────────────────────────────────────────────

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
