import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, ExternalLink, Heart, Moon, Sun, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchAllProducts, type Product } from "@/lib/yupoo.functions";
import { proxyImageUrl } from "@/lib/image-proxy";
import { ProductModal } from "@/components/ProductModal";
import heroImg from "@/assets/hero.jpg";
import sneakersImg from "@/assets/cat-sneakers.jpg";
import clothesImg from "@/assets/cat-clothes.jpg";
import footballImg from "@/assets/cat-football.jpg";
import winterImg from "@/assets/cat-winter.jpg";
import accessoriesImg from "@/assets/cat-accessories.jpg";

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

const CATEGORIES: { id: Exclude<Category, "all">; label: string; image: string }[] = [
  { id: "zapatillas", label: "Zapatillas", image: sneakersImg },
  { id: "ropa", label: "Ropa", image: clothesImg },
  { id: "futbol", label: "Camisetas Fútbol", image: footballImg },
  { id: "invierno", label: "Ropa de Invierno", image: winterImg },
  { id: "accesorios", label: "Accesorios", image: accessoriesImg },
];

const CATALOGS = [
  { id: "pandashoesx", name: "Panda Shoes", url: "https://pandashoesx.x.yupoo.com/", category: "zapatillas" as const },
  { id: "panshirt", name: "Pan Shirt", url: "https://panshirt.x.yupoo.com/", category: "futbol" as const },
  { id: "pandaclothes", name: "Panda Clothes", url: "https://pandaclothes.x.yupoo.com/", category: "ropa" as const },
  { id: "wu769809876", name: "WU Collection", url: "https://wu769809876.x.yupoo.com/categories", category: "ropa" as const },
  { id: "maoyi998", name: "998 Maoyi", url: "http://998maoyi.x.yupoo.com/categories", category: "accesorios" as const },
  { id: "winterclothes", name: "Winter Clothes", url: "https://winterclothes.x.yupoo.com/categories", category: "invierno" as const },
];



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
    staleTime: 60 * 60 * 1000, // 1 hora
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

  const products = data?.products ?? [];

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (showFavs && !favs.includes(p.id)) return false;
      if (cat !== "all" && p.category !== cat) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.catalogName.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [products, query, cat, favs, showFavs]);

  const countByCat = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((p) => (map[p.category] = (map[p.category] || 0) + 1));
    return map;
  }, [products]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-sm bg-primary" style={{ boxShadow: "var(--glow)" }} />
            <span className="text-xl font-black tracking-tighter">VAULT</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            <a href="#productos" className="text-muted-foreground transition hover:text-foreground">Productos</a>
            <a href="#catalogos" className="text-muted-foreground transition hover:text-foreground">Catálogos</a>
            
          </nav>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={refresh} disabled={isFetching} aria-label="Refrescar">
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
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
          className="absolute inset-0 h-full w-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
          <Badge className="mb-6 border-primary/30 bg-primary/10 text-primary hover:bg-primary/20">
            ● {isLoading ? "Cargando…" : `${products.length} productos · 6 catálogos`}
          </Badge>
          <h1 className="max-w-4xl text-5xl font-black leading-[0.95] tracking-tighter sm:text-7xl lg:text-8xl">
            EL VAULT DE LOS<br />
            <span className="text-primary" style={{ textShadow: "var(--glow)" }}>MEJORES YUPOOS</span>
          </h1>
          <p className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            Productos auto-cargados de 6 catálogos Yupoo. Búscalos, fíltralos, guarda favoritos y abre el álbum original con un clic.
          </p>

          {/* Search */}
          <div className="mt-10 max-w-xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar producto, marca, catálogo…"
                className="h-14 border-border bg-card/80 pl-12 text-base backdrop-blur focus-visible:ring-primary"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Categories filter */}
      <section className="border-b border-border bg-card/30">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setCat("all"); setShowFavs(false); }}
              className={`rounded-sm border px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
                cat === "all" && !showFavs
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              Todo {products.length > 0 && <span className="ml-1 opacity-60">{products.length}</span>}
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => { setCat(c.id); setShowFavs(false); }}
                className={`rounded-sm border px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
                  cat === c.id && !showFavs
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                {c.label} {countByCat[c.id] > 0 && <span className="ml-1 opacity-60">{countByCat[c.id]}</span>}
              </button>
            ))}
            <button
              onClick={() => setShowFavs((v) => !v)}
              className={`ml-auto flex items-center gap-1.5 rounded-sm border px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
                showFavs
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <Heart className={`h-3.5 w-3.5 ${showFavs ? "fill-current" : ""}`} />
              Favoritos {favs.length > 0 && <span className="opacity-70">{favs.length}</span>}
            </button>
          </div>
        </div>
      </section>

      {/* Products grid */}
      <section id="productos" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-primary">01 / Productos</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              {isLoading ? "Cargando…" : `${filtered.length} ${filtered.length === 1 ? "resultado" : "resultados"}`}
            </h2>
          </div>
          {data?.fetchedAt && (
            <p className="hidden font-mono text-xs uppercase tracking-widest text-muted-foreground sm:block">
              Actualizado: {new Date(data.fetchedAt).toLocaleTimeString()}
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-sm border border-border bg-card" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-sm border border-destructive/40 bg-destructive/10 p-8 text-center">
            <p className="font-bold text-destructive">Error al cargar productos</p>
            <p className="mt-2 text-sm text-muted-foreground">{String(error)}</p>
            <Button onClick={refresh} className="mt-4">Reintentar</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-sm border border-dashed border-border p-16 text-center text-muted-foreground">
            {showFavs ? "Aún no tienes favoritos." : "No hay resultados para tu búsqueda."}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {filtered.map((p) => (
              <article
                key={p.id}
                className="group relative overflow-hidden rounded-sm border border-border bg-card transition hover:border-primary"
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
                      className="h-full w-full object-contain transition duration-700 group-hover:scale-105"
                      onError={(e) => {
                        e.currentTarget.style.opacity = "0.2";
                      }}
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/60 to-transparent p-3">
                      <p className="line-clamp-2 text-xs font-bold leading-tight">{p.title}</p>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {p.catalogName}
                      </p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => toggleFav(p.id)}
                  aria-label="Favorito"
                  className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-background/80 backdrop-blur transition hover:bg-background"
                >
                  <Heart
                    className={`h-3.5 w-3.5 ${favs.includes(p.id) ? "fill-primary text-primary" : "text-foreground"}`}
                  />
                </button>
                <div className="absolute left-2 top-2">
                  <span className="rounded-sm bg-background/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider backdrop-blur">
                    {CATEGORIES.find((x) => x.id === p.category)?.label.split(" ")[0]}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}

        {data?.errors && data.errors.length > 0 && (
          <details className="mt-8 rounded-sm border border-border bg-card/40 p-4 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-mono uppercase tracking-widest">
              {data.errors.length} catálogo(s) con error
            </summary>
            <ul className="mt-3 space-y-1">
              {data.errors.map((e, i) => (
                <li key={i} className="font-mono">{e}</li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* Catalogs */}
      <section id="catalogos" className="border-t border-border bg-card/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <p className="text-xs font-mono uppercase tracking-widest text-primary">02 / Catálogos originales</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Abrir Yupoo directamente</h2>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {CATALOGS.map((c) => (
              <a
                key={c.id}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-2 rounded-sm border border-border bg-background p-4 transition hover:border-primary"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{c.name}</p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{c.category}</p>
                </div>
                <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
              </a>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-8 text-sm text-muted-foreground sm:px-6">
          <p>© {new Date().getFullYear()} VAULT — Yupoo Catalog Hub</p>
        </div>
      </footer>

      {/* Floating Instagram button */}
      <a
        href="https://www.instagram.com/tu_proveedor_de_confi"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Instagram"
        className="fixed bottom-6 right-6 z-50 grid h-14 w-14 place-items-center rounded-full border border-primary bg-background text-primary transition hover:bg-primary hover:text-primary-foreground"
        style={{ boxShadow: "var(--glow)" }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
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
