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

const PAGE_BATCH_SIZE = 4;
const MAX_PAGES_SAFETY = 20;
const MAX_PRODUCTS_PER_CATALOG = 600;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const wordBoundaryRegexCache = new Map<string, RegExp>();

function matchesKeyword(haystack: string, keyword: string): boolean {
  let re = wordBoundaryRegexCache.get(keyword);
  if (!re) {
    re = new RegExp(`(?<![a-z0-9])${escapeRegExp(keyword)}(?![a-z0-9])`, "i");
    wordBoundaryRegexCache.set(keyword, re);
  }
  return re.test(haystack);
}

function matchesAnyKeyword(haystack: string, keywords: string[]): boolean {
  return keywords.some((kw) => matchesKeyword(haystack, kw));
}

const CENSOR_SEPARATOR = `[\\s*_\\-.]{0,1}`;
const CENSOR_WILDCARD = `[*_\\-.]`;

function buildTolerantAlternatives(keyword: string): string[] {
  const chars = keyword.replace(/\s+/g, "").split("");
  const literal = chars.map((c) => escapeRegExp(c)).join(CENSOR_SEPARATOR);
  const variants = [literal];
  for (let i = 0; i < chars.length; i++) {
    const withWildcard = chars
      .map((c, idx) => (idx === i ? CENSOR_WILDCARD : escapeRegExp(c)))
      .join(CENSOR_SEPARATOR);
    variants.push(withWildcard);
  }
  return variants;
}

const tolerantRegexCache = new Map<string, RegExp>();

function matchesKeywordTolerant(haystack: string, keyword: string): boolean {
  if (keyword.replace(/\s+/g, "").length < 4) {
    return matchesKeyword(haystack, keyword);
  }
  let re = tolerantRegexCache.get(keyword);
  if (!re) {
    const alternatives = buildTolerantAlternatives(keyword);
    re = new RegExp(`(?<![a-z0-9])(?:${alternatives.join("|")})(?![a-z0-9])`, "i");
    tolerantRegexCache.set(keyword, re);
  }
  return re.test(haystack);
}

function matchesAnyKeywordTolerant(haystack: string, keywords: string[]): boolean {
  return keywords.some((kw) => matchesKeywordTolerant(haystack, kw));
}

const CATEGORY_KEYWORDS: { category: Category; keywords: string[] }[] = [
  {
    category: "futbol",
    keywords: ["jersey", "camiseta de futbol", "camiseta futbol", "football",
      "soccer", "kit", "maillot", "calcio", "bundesliga", "laliga", "premier",
      "serie a", "ligue 1", "champions league", "world cup", "national team",
      "seleccion", "panshirt", "pan shirt"],
  },
  {
    category: "zapatillas",
    keywords: ["jordan", "nike", "adidas", "yeezy", "dunk", "aj1", "aj4", "aj11",
      "air max", "air force", "new balance", "nb", "asics", "puma", "reebok",
      "under armour", "sneaker", "zapatilla", "zapatillas", "shoe", "shoes",
      "trainer", "trainers", "boost", "runner", "350", "380", "500", "990",
      "574", "550", "990v", "1080", "2002", "vans", "converse", "chuck",
      "ultraboost", "nmd", "ozweego", "off white", "travis scott", "fragment",
      "balenciaga track", "balenciaga triple", "balenciaga speed", "triple s",
      "speed trainer", "mule", "slide", "slides", "slipper", "boot", "boots",
      "bota", "botas", "clog", "clogs", "prada americas", "prada cloudbust",
      "prada monolith", "mary jane", "loafer", "loafers", "mocasin", "cleats",
      "botin", "botines", "vapormax", "pegasus", "react", "cortez", "blazer",
      "terrex"],
  },
  {
    category: "invierno",
    keywords: ["jacket", "coat", "puffer", "down jacket", "winter", "fleece",
      "hoodie", "sweatshirt", "sudadera", "chaqueta", "abrigo", "parka",
      "windbreaker", "anorak", "vest", "gilet", "north face", "arcteryx",
      "canada goose", "moncler", "stone island"],
  },
  {
    category: "ropa",
    keywords: ["tshirt", "t-shirt", "tee", "polo", "shorts", "pants", "jeans",
      "denim", "cargo", "trousers", "sweat", "tracksuit", "jogger", "joggers",
      "crewneck", "long sleeve", "boxy", "oversized", "sudadera", "pantalon",
      "bermuda", "falda", "vestido", "dress", "skirt"],
  },
  {
    category: "accesorios",
    keywords: ["bag", "backpack", "cap", "belt", "wallet", "watch",
      "sunglasses", "socks", "scarf", "gloves", "keychain", "bracelet",
      "necklace", "ring", "earring", "bolso", "gorra", "cinturon",
      "calcetines", "bufanda"],
  },
];

const STRONG_SNEAKER_MARKERS = [
  "jordan", "dunk", "yeezy", "samba", "aj1", "aj4", "aj11", "air max",
  "air force", "vapormax", "pegasus", "cortez", "blazer", "ultraboost", "nmd",
];

const CLOTHING_OVERRIDE_KEYWORDS = [
  "hoodie", "sudadera", "tshirt", "t-shirt", "tee", "polo", "sweater", "sweatshirt",
  "pants", "pantalon", "jeans", "denim", "shorts", "bermuda", "falda",
  "vestido", "dress", "skirt", "abrigo", "coat",
];

const FOOTBALL_CONTEXT_MARKERS = [
  "home", "away", "third", "kit", "fc", "cf", "real madrid", "barcelona",
  "psg", "manchester", "liverpool", "chelsea", "arsenal", "juventus",
  "bayern", "milan", "national team", "seleccion", "world cup", "champions",
  "premier", "laliga", "bundesliga", "calcio", "ligue 1", "serie a",
];

const FOOTBALL_TEAM_NAMES = [
  "real madrid", "barcelona", "barca", "atletico madrid", "atletico de madrid",
  "sevilla", "valencia", "real sociedad", "athletic bilbao", "villarreal",
  "psg", "paris saint germain", "marseille", "lyon", "monaco",
  "manchester united", "manchester city", "liverpool", "chelsea", "arsenal",
  "tottenham", "newcastle", "everton", "aston villa", "west ham",
  "bayern munich", "bayern", "dortmund", "borussia dortmund", "leipzig",
  "juventus", "milan", "inter milan", "ac milan", "napoli", "roma", "lazio",
  "ajax", "psv", "porto", "benfica", "sporting",
  "brazil", "brasil", "argentina", "francia", "france", "alemania", "germany",
  "españa", "espana", "spain", "italia", "italy", "portugal", "inglaterra",
  "england", "holanda", "netherlands", "belgica", "belgium",
];

const SEASON_PATTERN = /\b(20)?\d{2}[\/\-](20)?\d{2}\b/;

function hasFootballShirt(lower: string): boolean {
  if (matchesKeyword(lower, "shirt")) {
    return matchesAnyKeyword(lower, FOOTBALL_CONTEXT_MARKERS);
  }
  if (SEASON_PATTERN.test(lower) && matchesAnyKeyword(lower, FOOTBALL_TEAM_NAMES)) {
    return true;
  }
  return false;
}

function detectCategory(title: string, defaultCategory: Category): Category {
  const lower = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  let detected: Category | null = null;

  if (hasFootballShirt(lower)) {
    detected = "futbol";
  } else {
    for (const { category, keywords } of CATEGORY_KEYWORDS) {
      if (matchesAnyKeywordTolerant(lower, keywords)) {
        detected = category;
        break;
      }
    }
  }

  if (detected === "zapatillas") {
    const hasStrongSneaker = matchesAnyKeywordTolerant(lower, STRONG_SNEAKER_MARKERS);
    const hasClothingOverride = matchesAnyKeywordTolerant(lower, CLOTHING_OVERRIDE_KEYWORDS);
    if (hasClothingOverride && !hasStrongSneaker) {
      return "ropa";
    }
  }

  if (
    !detected &&
    defaultCategory === "zapatillas" &&
    matchesAnyKeywordTolerant(lower, CLOTHING_OVERRIDE_KEYWORDS) &&
    !matchesAnyKeywordTolerant(lower, STRONG_SNEAKER_MARKERS)
  ) {
    return "ropa";
  }

  return detected ?? defaultCategory;
}

const NON_PRODUCT_KEYWORDS = [
  "contact", "contacto", "contactanos", "contáctanos", "whatsapp", "wechat",
  "telegram", "kakao", "线上", "联系", "微信", "客服", "customer service",
  "rule", "rules", "norma", "normas", "instruction", "instrucciones",
  "notice", "announcement", "anuncio", "aviso", "how to order", "como comprar",
  "cómo comprar", "shipping", "envio", "envío", "policy", "política",
  "more catalog", "more catalogue", "other catalog", "otros catalogos",
  "otros catálogos", "click here", "haz clic", "link", "enlace", "更多",
  "目录", "qr code", "código qr", "codigo qr", "scan", "escanea",
  "welcome", "bienvenido", "bienvenida", "vip", "guide", "guia", "guía",
  "size chart", "tabla de tallas", "measurement", "medidas",
];

function isNonProductAlbum(title: string): boolean {
  const lower = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return matchesAnyKeyword(lower, NON_PRODUCT_KEYWORDS);
}

const COLOR_WORDS = new Set([
  "black","white","red","blue","green","yellow","orange","purple","pink",
  "grey","gray","brown","navy","cream","beige","olive","burgundy","wine",
  "khaki","tan","mint","teal","coral","maroon","silver","gold","multicolor",
  "multi","colorway","volt","infrared","bred","cement","chicago","royal",
  "shadow","court","obsidian","platinum","university","smoke","arctic",
  "thunder","concord","pine","wheat","cactus","sail","ice","crystal","vast",
  "negro","blanco","rojo","azul","verde","amarillo","naranja","morado",
  "rosa","gris","marron","crema","dorado","plateado","cafe",
  "hei","bai","hong","lan","lv","huang","zi","fen","hui",
]);

const TITLE_STOPWORDS = new Set([
  "the","and","for","with","from","new","de","la","el","los","las","con",
  "para","en","se","una","uno","and","or","of","in","to","a","an",
]);

function isLikelySizeToken(token: string, normalizedTitle: string): boolean {
  if (!/^\d{1,2}$/.test(token)) return false;
  const n = Number(token);
  if (n >= 35 && n <= 48) return true;
  if (n >= 1 && n <= 14 && /\b(size|sz|talla|eu|us|uk)\s*\d{1,2}\b/.test(normalizedTitle)) {
    return true;
  }
  return false;
}

function modelKey(title: string): string | null {
  if (isGenericTitle(title)) return null;

  const normalizedTitle = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ");

  const tokens = normalizedTitle
    .split(/\s+/)
    .filter((t) => {
      if (!t || (t.length < 2 && !/^\d$/.test(t))) return false;
      if (COLOR_WORDS.has(t)) return false;
      if (TITLE_STOPWORDS.has(t)) return false;
      if (isLikelySizeToken(t, normalizedTitle)) return false;
      return true;
    });

  if (tokens.length < 3) return null;
  return tokens.sort().join(" ");
}

function groupVariants(products: Product[]): Product[] {
  const byCatalog = new Map<string, Product[]>();
  for (const p of products) {
    const list = byCatalog.get(p.catalog) ?? [];
    list.push(p);
    byCatalog.set(p.catalog, list);
  }

  const result: Product[] = [];

  for (const [, items] of byCatalog) {
    const groups = new Map<string, Product[]>();
    for (const p of items) {
      const key = modelKey(p.title);
      if (!key) {
        result.push(p);
        continue;
      }
      const g = groups.get(key) ?? [];
      g.push(p);
      groups.set(key, g);
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

function cleanTitleText(raw: string): string {
  return decodeEntities(raw)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAlbums(html: string, base: string): { title: string; url: string; image: string }[] {
  const items: { title: string; url: string; image: string }[] = [];
  const seen = new Set<string>();

  const blockRegex =
    /<a\b[^>]*class="[^"]*\balbum__main\b[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = blockRegex.exec(html)) !== null) {
    const openingTag = m[0].slice(0, m[0].indexOf(">") + 1);
    const inner = m[1];
    const blockEndIndex = blockRegex.lastIndex;

    const hrefMatch = openingTag.match(/\bhref="([^"]+)"/i);
    if (!hrefMatch) continue;
    const href = decodeEntities(hrefMatch[1]);

    const titleAttrMatch = openingTag.match(/\btitle="([^"]*)"/i);
    let title = titleAttrMatch ? decodeEntities(titleAttrMatch[1].trim()) : "";

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
        inner.match(/<h[1-6][^>]*>\s*([^<]+?)\s*<\/h[1-6]>/i) ||
        inner.match(/<span[^>]*>\s*([^<]+?)\s*<\/span>/i);
      if (titleMatch) title = cleanTitleText(titleMatch[1].trim());
    }

    if (!title) {
      const tail = html.slice(blockEndIndex, blockEndIndex + 600);
      const siblingMatch =
        tail.match(/^\s*<a[^>]*class="[^"]*album__main_title[^"]*"[^>]*>\s*([^<]+?)\s*<\/a>/i) ||
        tail.match(/^\s*<(?:span|div|p)[^>]*class="[^"]*(?:album__main_title|album__title|title)[^"]*"[^>]*>\s*([^<]+?)\s*<\/(?:span|div|p)>/i) ||
        tail.match(/class="[^"]*album__main_title[^"]*"[^>]*>\s*([^<]+?)\s*</i);
      if (siblingMatch) title = cleanTitleText(siblingMatch[1]);
    }

    if (!title) {
      const altMatch = inner.match(/<img[^>]*\salt="([^"]+)"/i);
      if (altMatch && altMatch[1].trim() && !/^image$|^img$|^photo$/i.test(altMatch[1].trim())) {
        title = cleanTitleText(altMatch[1]);
      }
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

async function fetchCatalogPageHtml(pageUrl: string, apiKey: string): Promise<string | null> {
  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: pageUrl,
      formats: ["html"],
      onlyMainContent: false,
      maxAge: 10 * 60 * 1000,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error(`Firecrawl ${pageUrl} ${res.status}: ${txt.slice(0, 200)}`);
    return null;
  }

  const json = (await res.json()) as { data?: { html?: string } };
  return json.data?.html ?? null;
}

async function scrapeOne(catalog: (typeof CATALOGS)[number]): Promise<Product[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY not configured");

  const base = catalog.url.replace(/\/$/, "");
  const seenAlbumUrls = new Set<string>();
  const allAlbums: { title: string; url: string; image: string }[] = [];

  const pageUrl = (page: number) => (page === 1 ? base : `${base}/?tab=gallery&page=${page}`);

  let nextPage = 1;
  let firstPageFailed = false;

  while (nextPage <= MAX_PAGES_SAFETY) {
    const batchPages = Array.from(
      { length: Math.min(PAGE_BATCH_SIZE, MAX_PAGES_SAFETY - nextPage + 1) },
      (_, i) => nextPage + i,
    );

    const batchResults = await Promise.all(
      batchPages.map(async (page) => ({
        page,
        html: await fetchCatalogPageHtml(pageUrl(page), apiKey),
      })),
    );

    if (batchResults[0]?.page === 1 && !batchResults[0].html) {
      firstPageFailed = true;
      break;
    }

    let newCountInBatch = 0;
    let hitEmptyPage = false;

    for (const { page, html } of batchResults) {
      if (!html) {
        console.error(`${catalog.name}: fallo en página ${page}, ignorando esa página`);
        continue;
      }

      const albums = parseAlbums(html, base);
      let newInPage = 0;
      for (const a of albums) {
        const key = a.url.split("?")[0];
        if (seenAlbumUrls.has(key)) continue;
        seenAlbumUrls.add(key);
        allAlbums.push(a);
        newInPage++;
      }
      newCountInBatch += newInPage;
      if (newInPage === 0) hitEmptyPage = true;
    }

    nextPage += batchPages.length;

    if (newCountInBatch === 0) break;
    if (hitEmptyPage && allAlbums.length > 0) break;
    if (allAlbums.length >= MAX_PRODUCTS_PER_CATALOG) break;
  }

  if (firstPageFailed) {
    throw new Error(`No se pudo obtener la página 1 de ${catalog.name}`);
  }

  return allAlbums
    .filter((a) => !isNonProductAlbum(a.title))
    .slice(0, MAX_PRODUCTS_PER_CATALOG)
    .map((a, i) => ({
      id: `${catalog.id}-${i}-${a.url.slice(-20)}`,
      title: a.title,
      url: a.url,
      image: a.image,
      catalog: catalog.id,
      catalogName: catalog.name,
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

// ─── Caché KV — patrón correcto para TanStack Start + Cloudflare Vite ────────
//
// NUNCA usar globalThis.YUPOO_KV ni import { env } from "cloudflare:workers".
// El único patrón que funciona con @cloudflare/vite-plugin es acceder al
// binding vía request.context.cloudflare.env.YUPOO_KV.

const CACHE_KEY = "yupoo-products-v5";
const CACHE_TTL_MS = 60 * 60 * 1000;       // 1 hora — fresco, no revalidar
const CACHE_STALE_MS = 6 * 60 * 60 * 1000; // 6 horas — stale pero aún servible

// Tipos mínimos para compilar fuera del runtime de Cloudflare
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

type ProductCache = { products: Product[]; errors: string[]; fetchedAt: string };

// ─── Acceso al env de Cloudflare via request.context ─────────────────────────
function getCloudflareEnv(request: Request): {
  kv: KVNamespace | null;
  ctx: ExecutionContext | null;
} {
  try {
    const cf = (
      request as unknown as {
        context?: {
          cloudflare?: {
            env?: { YUPOO_KV?: KVNamespace };
            ctx?: ExecutionContext;
          };
        };
      }
    ).context?.cloudflare;

    return {
      kv: cf?.env?.YUPOO_KV ?? null,
      ctx: cf?.ctx ?? null,
    };
  } catch {
    return { kv: null, ctx: null };
  }
}

async function getFromKV(kv: KVNamespace): Promise<{ data: ProductCache; stale: boolean } | null> {
  try {
    const raw = await kv.get(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as ProductCache;
    const age = Date.now() - new Date(data.fetchedAt).getTime();
    if (age > CACHE_STALE_MS) return null; // demasiado viejo, ignorar
    return { data, stale: age > CACHE_TTL_MS };
  } catch {
    return null;
  }
}

async function saveToKV(kv: KVNamespace, data: ProductCache): Promise<void> {
  try {
    await kv.put(CACHE_KEY, JSON.stringify(data), { expirationTtl: 7200 });
  } catch (e) {
    console.error("KV write error:", e);
  }
}

async function runScraping(): Promise<ProductCache> {
  console.log("Scraping Firecrawl (todas las páginas por catálogo)...");
  const results = await Promise.allSettled(CATALOGS.map((c) => scrapeOne(c)));
  const products: Product[] = [];
  const errors: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      products.push(...r.value);
      console.log(`${CATALOGS[i].name}: ${r.value.length} álbumes válidos`);
    } else {
      errors.push(`${CATALOGS[i].name}: ${String(r.reason)}`);
    }
  });
  const deduped = dedupeProducts(products);
  const grouped = groupVariants(deduped);
  return { products: grouped, errors, fetchedAt: new Date().toISOString() };
}

export const fetchAllProducts = createServerFn({ method: "GET" }).handler(
  async ({ request }): Promise<ProductCache> => {
    // ── Acceso correcto al KV binding ──────────────────────────────────────
    const { kv, ctx } = getCloudflareEnv(request);

    if (kv) {
      const cached = await getFromKV(kv);

      if (cached && !cached.stale) {
        // FRESH (< 1h): respuesta instantánea
        console.log("KV cache hit (fresh), fetchedAt:", cached.data.fetchedAt);
        return cached.data;
      }

      if (cached && cached.stale) {
        // STALE (1-6h): devolver datos viejos YA y revalidar en background
        // El usuario no espera nada — ve los productos al instante.
        console.log("KV stale — sirviendo datos viejos, revalidando en background...");
        const revalidate = runScraping().then((fresh) => saveToKV(kv, fresh)).catch(console.error);
        if (ctx) {
          ctx.waitUntil(revalidate); // Cloudflare espera a que termine antes de cerrar el Worker
        }
        return cached.data;
      }

      // MISS (primera carga o KV purgado): scraping bloqueante, solo ocurre una vez cada 6h
      console.log("KV miss — scraping inicial...");
      const fresh = await runScraping();
      await saveToKV(kv, fresh);
      return fresh;
    }

    // Sin KV (dev local sin wrangler): scraping directo
    console.log("Sin KV binding (dev local) — scraping directo...");
    return runScraping();
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

// ─── Búsqueda tolerante (exportada para uso en el cliente via search.ts) ──────
export function productMatchesQuery(
  product: Pick<Product, "title" | "catalogName" | "category"> & {
    variants?: { title: string }[];
  },
  query: string
): boolean {
  const q = query.trim();
  if (!q) return true;

  const haystacks = [
    product.title,
    product.catalogName,
    product.category,
    ...(product.variants?.map((v) => v.title) ?? []),
  ];

  const normalize = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const qLower = normalize(q);
  if (haystacks.some((h) => normalize(h).includes(qLower))) return true;

  const words = qLower.split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;

  return words.every((word) => haystacks.some((h) => matchesKeywordTolerant(normalize(h), word)));
}
