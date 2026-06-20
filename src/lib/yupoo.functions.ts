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

// ─── Paginación por catálogo ──────────────────────────────────────────────────
//
// Yupoo pagina los álbumes con ?tab=gallery&page=N. No conocemos de antemano
// cuántas páginas tiene un catálogo, así que pedimos "todas las que tenga",
// pero en LOTES en paralelo (en vez de una por una) para que la latencia de
// red no se acumule de forma secuencial. PAGE_BATCH_SIZE páginas se piden a
// la vez con Promise.all; si el lote entero no aporta álbumes nuevos, paramos.
// MAX_PAGES_SAFETY es un techo de seguridad para que un catálogo con un bug
// no nos deje pidiendo páginas para siempre.
const PAGE_BATCH_SIZE = 4;
const MAX_PAGES_SAFETY = 20;
const MAX_PRODUCTS_PER_CATALOG = 600;

// ─── Matching de keywords con límites de palabra ──────────────────────────────
//
// Usar `.includes()` para keywords cortas es frágil: "hat" matchea dentro de
// "whatsapp", "link" dentro de "blinker", "top" dentro de "laptop", "ua"
// dentro de "agua", etc. Para evitarlo, exigimos que la keyword aparezca
// como palabra (o secuencia de palabras) completa, delimitada por algo que
// no sea una letra/dígito a cada lado. Para keywords multi-palabra ("air max")
// los espacios internos ya actúan como separador, así que solo hace falta
// proteger los extremos.
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

// ─── Keywords para detección de categoría por título ─────────────────────────
//
// "shirt" es deliberadamente ambiguo (aparece en fútbol Y como parte de
// t-shirt/polo shirt/dress shirt), así que NO va en la lista de fútbol;
// en su lugar lo tratamos como señal débil en hasFootballShirt() más abajo,
// que solo cuenta si además hay contexto futbolero (equipo, liga, temporada...).

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

// Marcas/modelos de zapatilla "fuertes": si aparecen, ganan sobre cualquier
// keyword de ropa aunque el título también mencione hoodie/tshirt/etc.
const STRONG_SNEAKER_MARKERS = [
  "jordan", "dunk", "yeezy", "samba", "aj1", "aj4", "aj11", "air max",
  "air force", "vapormax", "pegasus", "cortez", "blazer", "ultraboost", "nmd",
];

// Keywords de ROPA que, en ausencia de un marcador fuerte de sneaker, deben
// ganar la clasificación (para que un "Nike Tech Hoodie" no acabe en zapatillas
// solo por mencionar "nike").
const CLOTHING_OVERRIDE_KEYWORDS = [
  "hoodie", "sudadera", "tshirt", "t-shirt", "polo", "sweater", "sweatshirt",
  "pants", "pantalon", "jeans", "denim", "shorts", "bermuda", "falda",
  "vestido", "dress", "skirt", "abrigo", "coat",
];

// Señales de que un "shirt" suelto sí es una camiseta de fútbol y no un polo,
// dress shirt, etc. Si el título contiene "shirt" Y alguna de estas señales,
// se clasifica como fútbol; si no, "shirt" no cuenta para nada.
const FOOTBALL_CONTEXT_MARKERS = [
  "home", "away", "third", "kit", "fc", "cf", "real madrid", "barcelona",
  "psg", "manchester", "liverpool", "chelsea", "arsenal", "juventus",
  "bayern", "milan", "national team", "seleccion", "world cup", "champions",
  "premier", "laliga", "bundesliga", "calcio", "ligue 1", "serie a",
];

function hasFootballShirt(lower: string): boolean {
  if (!matchesKeyword(lower, "shirt")) return false;
  return matchesAnyKeyword(lower, FOOTBALL_CONTEXT_MARKERS);
}

function detectCategory(title: string, defaultCategory: Category): Category {
  const lower = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  let detected: Category | null = null;

  if (hasFootballShirt(lower)) {
    detected = "futbol";
  } else {
    for (const { category, keywords } of CATEGORY_KEYWORDS) {
      if (matchesAnyKeyword(lower, keywords)) {
        detected = category;
        break;
      }
    }
  }

  if (detected === "zapatillas") {
    const hasStrongSneaker = matchesAnyKeyword(lower, STRONG_SNEAKER_MARKERS);
    const hasClothingOverride = matchesAnyKeyword(lower, CLOTHING_OVERRIDE_KEYWORDS);
    if (hasClothingOverride && !hasStrongSneaker) {
      return "ropa";
    }
  }

  // Caso especial: en pandashoesx (catálogo "default = zapatillas") si el
  // título es claramente ropa y no hay marcador fuerte de sneaker, reclasificar.
  if (
    !detected &&
    defaultCategory === "zapatillas" &&
    matchesAnyKeyword(lower, CLOTHING_OVERRIDE_KEYWORDS) &&
    !matchesAnyKeyword(lower, STRONG_SNEAKER_MARKERS)
  ) {
    return "ropa";
  }

  return detected ?? defaultCategory;
}

// ─── Filtro de álbumes que NO son productos ───────────────────────────────────
//
// En catálogos reales aparecen álbumes que no son productos: "contáctanos",
// "normas de la tienda", "link a otro catálogo", códigos QR, anuncios, etc.
// Los detectamos por palabras clave típicas de ese tipo de contenido (en
// varios idiomas, ya que muchos vendedores son chinos) y los descartamos.

const NON_PRODUCT_KEYWORDS = [
  // contacto / vendedor
  "contact", "contacto", "contactanos", "contáctanos", "whatsapp", "wechat",
  "telegram", "kakao", "线上", "联系", "微信", "客服", "customer service",
  // normas / instrucciones
  "rule", "rules", "norma", "normas", "instruction", "instrucciones",
  "notice", "announcement", "anuncio", "aviso", "how to order", "como comprar",
  "cómo comprar", "shipping", "envio", "envío", "policy", "política",
  // navegación / enlaces a otras partes del catálogo
  "more catalog", "more catalogue", "other catalog", "otros catalogos",
  "otros catálogos", "click here", "haz clic", "link", "enlace", "更多",
  "目录", "qr code", "código qr", "codigo qr", "scan", "escanea",
  // genérico de "no es un producto real"
  "welcome", "bienvenido", "bienvenida", "vip", "guide", "guia", "guía",
  "size chart", "tabla de tallas", "measurement", "medidas",
];

function isNonProductAlbum(title: string): boolean {
  const lower = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return matchesAnyKeyword(lower, NON_PRODUCT_KEYWORDS);
}

// ─── Agrupación de variantes de color ────────────────────────────────────────
//
// Estrategia: dos productos son variantes solo si su título normalizado
// (sin colores, sin números) es IDÉNTICO Y tiene al menos 3 tokens
// con significado. Así evitamos agrupar productos distintos que solo
// comparten el nombre de la marca.

const COLOR_WORDS = new Set([
  // inglés
  "black","white","red","blue","green","yellow","orange","purple","pink",
  "grey","gray","brown","navy","cream","beige","olive","burgundy","wine",
  "khaki","tan","mint","teal","coral","maroon","silver","gold","multicolor",
  "multi","colorway","volt","infrared","bred","cement","chicago","royal",
  "shadow","court","obsidian","platinum","university","smoke","arctic",
  "thunder","concord","pine","wheat","cactus","sail","ice","crystal","vast",
  // español
  "negro","blanco","rojo","azul","verde","amarillo","naranja","morado",
  "rosa","gris","marron","crema","dorado","plateado","cafe",
  // pinyin
  "hei","bai","hong","lan","lv","huang","zi","fen","hui",
]);

// Palabras que NO son identificadores de modelo (stopwords para este contexto)
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

/**
 * Reduce un título a su "clave de modelo":
 * - minúsculas, sin tildes
 * - elimina colores conocidos y tallas explícitas/probables
 * - elimina stopwords
 * - ordena tokens alfabéticamente para que "Dunk Low Black White"
 *   y "Dunk Low White Black" produzcan la misma clave
 */
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

  // Necesitamos al menos 3 tokens significativos para considerar agrupación
  if (tokens.length < 3) return null;

  return tokens.sort().join(" ");
}

/**
 * Agrupa variantes de color dentro del mismo catálogo.
 * Solo agrupa si el modelKey es idéntico (título sin colores/números).
 * Nunca agrupa si el key tiene menos de 3 tokens (productos genéricos/cortos).
 */
function groupVariants(products: Product[]): Product[] {
  const byCatalog = new Map<string, Product[]>();
  for (const p of products) {
    const list = byCatalog.get(p.catalog) ?? [];
    list.push(p);
    byCatalog.set(p.catalog, list);
  }

  const result: Product[] = [];

  for (const [, items] of byCatalog) {
    // Agrupar por modelKey exacto. Si el título no es fiable, se deja suelto.
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
      // Las páginas de galería de Yupoo son HTML servido directo (no SPA),
      // así que no necesitan esperar a que cargue JS — quitar waitFor aquí
      // es la optimización de velocidad más grande posible.
      // maxAge permite a Firecrawl servir desde SU propia caché si scrapeó
      // esta misma URL hace poco (10 min), evitando un scrape fresco entero.
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

/**
/**
 * Scrapea TODAS las páginas de un catálogo (?tab=gallery&page=1, 2, 3...),
 * pidiéndolas en LOTES en paralelo (PAGE_BATCH_SIZE a la vez) en vez de una
 * por una, para que la latencia de red no se acumule de forma secuencial.
 * Se detiene en cuanto un lote completo no aporta ningún álbum nuevo, o al
 * llegar al techo de seguridad.
 */
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
      // Si falla la PRIMERA página, no es "fin de catálogo": es un fallo real
      // de scraping. Lanzamos para que se registre en errors[] en vez de
      // desaparecer silenciosamente con 0 productos.
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

    // Si todo el lote no aportó álbumes nuevos, ya llegamos al final del catálogo.
    if (newCountInBatch === 0) break;

    // Si alguna página del lote vino vacía, lo más probable es que el final
    // del catálogo caiga dentro de este lote: no merece la pena seguir
    // pidiendo lotes completos extra por una sola página con contenido al final.
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

// v5: paginación completa por catálogo + filtro de álbumes que no son
// productos (contacto, normas, links a otras partes del catálogo, etc.)
const CACHE_KEY = "yupoo-products-v5";
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

    console.log("Cache miss — scraping Firecrawl (todas las páginas por catálogo)...");
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
