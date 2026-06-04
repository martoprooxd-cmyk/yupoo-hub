import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, ArrowUpRight, Heart, Moon, Sun, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fetchAllProducts, type Product } from "@/lib/yupoo.functions";
import { proxyImageUrl } from "@/lib/image-proxy";
import { ProductModal } from "@/components/ProductModal";
import heroImg from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VAULT — Yupoo Catalog Hub | Sneakers, Streetwear & Jerseys" },
      { name: "description", content: "Catálogo unificado de Yupoo. Zapatillas, ropa, camisetas de fútbol, ropa de invierno y accesorios. Productos auto-cargados." },
    ],
  }),
  component: Index,
});

type Category = "all" | "zapatillas" | "ropa" | "futbol" | "invierno" | "accesorios";

const CATEGORIES: { id: Exclude<Category, "all">; label: string; short: string }[] = [
  { id: "zapatillas", label: "Zapatillas", short: "Zapatillas" },
  { id: "ropa", label: "Ropa", short: "Ropa" },
  { id: "futbol", label: "Camisetas Fútbol", short: "Fútbol" },
  { id: "invierno", label: "Ropa de Invierno", short: "Invierno" },
  { id: "accesorios", label: "Accesorios", short: "Accesorios" },
];

const CATALOGS = [
  { id: "pandashoesx", name: "Panda Shoes", url: "https://pandashoesx.x.yupoo.com/", category: "Zapatillas" },
  { id: "panshirt", name: "Pan Shirt", url: "https://panshirt.x.yupoo.com/", category: "Fútbol" },
  { id: "pandaclothes", name: "Panda Clothes", url: "https://pandaclothes.x.yupoo.com/", category: "Ropa" },
  { id: "wu769809876", name: "WU Collection", url: "https://wu769809876.x.yupoo.com/categories", category: "Ropa Premium" },
  { id: "maoyi998", name: "998 Maoyi", url: "http://998maoyi.x.yupoo.com/categories", category: "Accesorios" },
  { id: "winterclothes", name: "Winter Clothes", url: "https://winterclothes.x.yupoo.com/categories", category: "Invierno" },
];

function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function Index() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<Category>("all");
  const [dark, setDark] = useState(true);
  const [favs, setFavs] = useState<string[]>([]);
  const [showFavs, setShowFavs] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);

  const fetchProducts = useServerFn(fetchAllProducts);
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["yupoo-products"],
    queryFn: () => fetchProducts(),
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
  });

  useEffect(() => {
    const saved = localStorage.getItem("vault-favs");
    if (saved) setFavs(JSON.parse(saved));
    const theme = localStorage.getItem("vault-theme");
    if (theme === "light") {
      setDark(false);
      document.documentElement.classList.add("light");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("vault-favs", JSON.stringify(favs));
  }, [favs]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("light", !next);
    localStorage.setItem("vault-theme", next ? "dark" : "light");
  };

  const toggleFav = (id: string) =>
    setFavs((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["yupoo-products"] });
  };

  const products: Product[] = data?.products ?? [];

  const filtered = useMemo(() => {
    const words = normalizeSearch(query).split(" ").filter(Boolean);
    return products.filter((p) => {
      if (showFavs && !favs.includes(p.id)) return false;
      if (cat !== "all" && p.category !== cat) return false;
      if (!words.length) return true;
      const searchable = normalizeSearch(p.title + " " + p.catalogName + " " + p.category);
      return words.every((word: string) => searchable.includes(word));
    });
  }, [products, query, cat, favs, showFavs]);

  const countByCat = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((p) => {
      map[p.category] = (map[p.category] || 0) + 1;
    });
    return map;
  }, [products]);

  const filterPillBase =
    "whitespace-nowrap rounded-full px-5 py-2 text-[11px] font-bold uppercase tracking-tight transition-all border";
  const filterPillIdle =
    "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground";
  const filterPillActive =
    "bg-primary text-primary-foreground border-primary";

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div
              className="grid h-8 w-8 place-items-center rounded-md bg-primary"
              style={{ boxShadow: "var(--glow)" }}
            >
              <div className="h-3.5 w-3.5 rounded-sm border-2 border-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold italic tracking-tighter">
              VAULT
            </span>
          </div>
          <nav className="hidden items-center gap-6 text-[11px] font-bold uppercase tracking-widest text-muted-foreground md:flex">
            <a href="#productos" className="transition hover:text-primary">Productos</a>
            <a href="#catalogos" className="transition hover:text-primary">Catálogos</a>
          </nav>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={refresh} disabled={isFetching} aria-label="Refrescar">
              <RefreshCw className={"h-4 w-4 " + (isFetching ? "animate-spin" : "")} />
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Cambiar tema">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <img
          src={heroImg}
          alt=""
          width={1920}
          height={800}
          className="absolute inset-0 h-full w-full object-cover opacity-10 grayscale"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/60 to-background" />
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-[60%] w-[120%] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(circle, oklch(0.58 0.24 275 / 0.25) 0%, transparent 65%)" }}
        />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
          <span className="inline-block rounded border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-primary">
            {isLoading ? "Cargando sistema…" : `${products.length} productos · 6 catálogos · live`}
          </span>
          <h1 className="font-display mt-6 max-w-4xl text-5xl font-bold italic leading-[0.9] tracking-tighter sm:text-7xl lg:text-8xl">
            <span className="block">EL VAULT DE LOS</span>
            <span
              className="block text-primary"
              style={{ textShadow: "0 0 30px oklch(0.58 0.24 275 / 0.5)" }}
            >
              MEJORES YUPOOS
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            Productos auto-cargados de 6 catálogos Yupoo. Búscalos, fíltralos, guarda favoritos y abre el álbum original con un clic.
          </p>
          <div className="relative mt-10 max-w-xl group">
            <div className="absolute -inset-2 rounded-2xl bg-primary/10 opacity-0 blur-xl transition-opacity group-focus-within:opacity-100" />
            <div className="relative flex items-center rounded-xl border border-border bg-card/70 px-4 backdrop-blur transition-colors focus-within:border-primary/60">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar producto, marca, catálogo…"
                className="h-14 border-0 bg-transparent text-base shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Sticky filter pills */}
      <div className="sticky top-[65px] z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => { setCat("all"); setShowFavs(false); }}
              className={filterPillBase + " " + (cat === "all" && !showFavs ? filterPillActive : filterPillIdle)}
            >
              Todo {products.length > 0 && <span className="ml-1 opacity-70">{products.length}</span>}
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => { setCat(c.id); setShowFavs(false); }}
                className={filterPillBase + " " + (cat === c.id && !showFavs ? filterPillActive : filterPillIdle)}
              >
                {c.label} {countByCat[c.id] > 0 && <span className="ml-1 opacity-70">{countByCat[c.id]}</span>}
              </button>
            ))}
            <div className="mx-1 h-6 w-px shrink-0 bg-border" />
            <button
              onClick={() => setShowFavs((v) => !v)}
              className={
                filterPillBase +
                " flex items-center gap-1.5 " +
                (showFavs
                  ? "bg-destructive/20 text-destructive border-destructive/40"
                  : "bg-card text-destructive border-destructive/20 hover:bg-destructive/10")
              }
            >
              <Heart className={"h-3 w-3 " + (showFavs ? "fill-current" : "")} />
              Favoritos {favs.length > 0 && <span className="opacity-80">{favs.length}</span>}
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl space-y-24 px-4 py-16 sm:px-6">
        {/* Products section */}
        <section id="productos" className="space-y-8">
          <div className="flex items-end justify-between gap-4 border-l-2 border-primary pl-5 sm:pl-6">
            <div className="space-y-1">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-primary">
                01 / Productos
              </p>
              <h2 className="font-display text-3xl font-bold italic tracking-tighter sm:text-4xl">
                {isLoading
                  ? "Cargando…"
                  : `${filtered.length} ${filtered.length === 1 ? "resultado" : "resultados"}`}
              </h2>
            </div>
            {data?.fetchedAt && (
              <p className="hidden font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:block">
                Actualizado {new Date(data.fetchedAt).toLocaleTimeString()}
              </p>
            )}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="skeleton-shimmer aspect-[3/4] rounded-xl border border-border"
                />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-8 text-center">
              <p className="font-bold text-destructive">Error al cargar productos</p>
              <p className="mt-2 text-sm text-muted-foreground">{String(error)}</p>
              <Button onClick={refresh} className="mt-4">Reintentar</Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-16 text-center text-muted-foreground">
              {showFavs ? "Aún no tienes favoritos." : "No hay resultados para tu búsqueda."}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {filtered.map((p) => (
                <article
                  key={p.id}
                  className="group relative overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-[0_10px_40px_-15px_oklch(0.58_0.24_275/0.5)]"
                >
                  <button
                    type="button"
                    onClick={() => setSelected(p)}
                    className="block w-full text-left"
                  >
                    <div className="relative aspect-[3/4] overflow-hidden bg-muted">
                      <img
                        src={proxyImageUrl(p.image)}
                        alt={p.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                        onError={(e) => { e.currentTarget.style.opacity = "0.2"; }}
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/70 to-transparent p-3 pt-10">
                        <p className="line-clamp-2 text-xs font-bold leading-tight">{p.title}</p>
                        <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                          {p.catalogName}
                        </p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => toggleFav(p.id)}
                    aria-label="Favorito"
                    className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full border border-border bg-background/70 backdrop-blur transition hover:border-primary hover:bg-background"
                  >
                    <Heart
                      className={
                        "h-3.5 w-3.5 transition " +
                        (favs.includes(p.id) ? "fill-primary text-primary" : "text-foreground")
                      }
                    />
                  </button>
                  <div className="absolute left-2 top-2">
                    <span className="rounded bg-background/80 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest backdrop-blur">
                      {CATEGORIES.find((x) => x.id === p.category)?.short ?? p.category}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}

          {data?.errors && data.errors.length > 0 && (
            <details className="rounded-xl border border-border bg-card/50 p-4 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-mono uppercase tracking-widest">
                {data.errors.length} catálogo(s) con error
              </summary>
              <ul className="mt-3 space-y-1">
                {data.errors.map((e: string, i: number) => (
                  <li key={i} className="font-mono">{e}</li>
                ))}
              </ul>
            </details>
          )}
        </section>

        {/* Catalogs section */}
        <section id="catalogos" className="space-y-8">
          <div className="flex items-end justify-between border-l-2 border-primary pl-5 sm:pl-6">
            <div className="space-y-1">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-primary">
                02 / Catálogos originales
              </p>
              <h2 className="font-display text-3xl font-bold italic tracking-tighter sm:text-4xl">
                Abrir Yupoo directamente
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {CATALOGS.map((c) => (
              <a
                key={c.id}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-4 rounded-2xl border border-border bg-card/60 p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-card"
              >
                <div className="min-w-0">
                  <h3 className="font-display truncate text-xl font-bold tracking-tight">{c.name}</h3>
                  <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {c.category}
                  </p>
                </div>
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-secondary text-foreground transition-all duration-300 group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-110">
                  <ArrowUpRight className="h-5 w-5" />
                </div>
              </a>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 py-10 text-center sm:px-6">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
            © {new Date().getFullYear()} VAULT — Yupoo Catalog Hub
          </p>
        </div>
      </footer>

      {/* Instagram FAB */}
      <a
        href="https://www.instagram.com/tu_proveedor_de_confi"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Instagram"
        className="fixed bottom-6 right-6 z-50 grid h-14 w-14 place-items-center rounded-2xl text-white shadow-[0_10px_30px_rgba(238,42,123,0.4)] transition-transform hover:scale-110 active:scale-95"
        style={{ background: "linear-gradient(135deg, #f9ce34 0%, #ee2a7b 50%, #6228d7 100%)" }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 drop-shadow">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
      </a>

      <ProductModal
        product={selected}
        onClose={() => setSelected(null)}
        isFav={selected ? favs.includes(selected.id) : false}
        onToggleFav={toggleFav}
      />
    </div>
  );
}
