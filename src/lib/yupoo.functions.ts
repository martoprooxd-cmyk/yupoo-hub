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

function parseAlbums(html: string, base: string): { title: string; url: string; image: string }[] {
  const items: { title: string; url: string; image: string }[] = [];
  const seen = new Set<string>();

  // Match each album block: <a ... class="album__main" href="..." title="..."> ... <img data-src|src="...">
  const blockRegex =
    /<a\b[^>]*class="[^"]*\balbum__main\b[^"]*"[^>]*href="([^"]+)"[^>]*?(?:title="([^"]*)")?[^>]*>([\s\S]*?)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = blockRegex.exec(html)) !== null) {
    const href = m[1];
    let title = (m[2] || "").trim();
    const inner = m[3];

    const imgMatch =
      inner.match(/data-src="([^"]+)"/i) ||
      inner.match(/data-original="([^"]+)"/i) ||
      inner.match(/<img[^>]*\ssrc="([^"]+)"/i);
    if (!imgMatch) continue;

    let image = imgMatch[1].trim();
    if (image.startsWith("//")) image = "https:" + image;
    if (image.startsWith("/")) image = base + image;

    if (!title) {
      const titleMatch = inner.match(/album__main_title[^>]*>([^<]+)</i);
      if (titleMatch) title = titleMatch[1].trim();
    }
    if (!title) title = "Álbum";

    const url = href.startsWith("http") ? href : base + href;
    if (seen.has(url)) continue;
    seen.add(url);

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

  return albums.slice(0, 60).map((a, i) => ({
    id: `${catalog.id}-${i}-${a.url.slice(-20)}`,
    title: a.title,
    url: a.url,
    image: a.image,
    catalog: catalog.id,
    catalogName: catalog.name,
    category: catalog.category,
  }));
}

export const fetchAllProducts = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ products: Product[]; errors: string[]; fetchedAt: string }> => {
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

    return {
      products,
      errors,
      fetchedAt: new Date().toISOString(),
    };
  },
);

function parseAlbumImages(html: string): string[] {
  const urls = new Set<string>();

  // Yupoo album pages use <img data-origin-src|data-src|src="..."> inside .showalbum__children or .image__img
  const imgRegex = /<img\b[^>]*\b(?:data-origin-src|data-src|data-original|src)="([^"]+)"[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRegex.exec(html)) !== null) {
    let src = m[1].trim();
    if (!src) continue;
    if (src.startsWith("//")) src = "https:" + src;
    // Filter out icons, avatars, logos
    if (!/photo\.yupoo\.com|yupoo-img|ph\.yupoo\.com/i.test(src)) continue;
    if (/avatar|logo|icon|qrcode/i.test(src)) continue;
    // Prefer large versions: replace _thumb or _small with _medium where possible
    src = src.replace(/_(?:thumb|small)\.(jpe?g|png|webp)/i, "_medium.$1");
    urls.add(src);
  }

  return Array.from(urls);
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
        url: data.url,
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
    const images = parseAlbumImages(html).slice(0, 30);
    return { images };
  });
