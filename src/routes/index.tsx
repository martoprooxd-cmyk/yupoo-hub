import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Search, ExternalLink, Heart, Moon, Sun, RefreshCw, Layers, ArrowUpDown, Sparkles, Share2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchAllProducts, CATALOGS, type Product } from "@/lib/yupoo.functions";
import { productMatchesQuery } from "@/lib/search";
import { proxyImageUrl } from "@/lib/image-proxy";
import { ProductModal } from "@/components/ProductModal";
import { CartProvider } from "@/lib/CartContext";
import { CartDrawer } from "@/components/CartDrawer";
import { OrderHistoryProvider } from "@/lib/OrderHistoryContext";
import { OrderHistoryDrawer } from "@/components/OrderHistoryDrawer";
import { useInView } from "@/hooks/use-in-view";
import heroImg from "@/assets/hero.jpg";
import sneakersImg from "@/assets/cat-sneakers.jpg";
import clothesImg from "@/assets/cat-clothes.jpg";
import footballImg from "@/assets/cat-football.jpg";
import winterImg from "@/assets/cat-winter.jpg";
import accessoriesImg from "@/assets/cat-accessories.jpg";

const OG_IMAGE_URL = `https://yupoo-hub.lovable.app${heroImg}`;
const PAGE_SIZE = 48;
const RECENTLY_VIEWED_KEY = "vault-recent";
const LAST_SEEN_IDS_KEY = "vault-last-seen-ids";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VAULT — Yupoo Catalog Hub | Sneakers, Streetwear & Jerseys" },
      {
        name: "description",
        content:
          "Catálogo unificado de Yupoo. Zapatillas, ropa, camisetas de fútbol, ropa de invierno y accesorios. Productos auto-cargados.",
      },
      { property: "og:image", content: OG_IMAGE_URL },
      { name: "twitter:image", content: OG_IMAGE_URL },
    ],
  }),
  component: Index,
});

type Category = "all" | "zapatillas" | "ropa" | "futbol" | "invierno" | "accesorios";
type SortMode = "default" | "newest" | "alphabetical" | "catalog";

const CATEGORIES: { id: Exclude<Category, "all">; label: string; image: string }[] = [
  { id: "zapatillas", label: "Zapatillas", image: sneakersImg },
  { id: "ropa", label: "Ropa", image: clothesImg },
  { id: "futbol", label: "Camisetas Fútbol", image: footballImg },
  { id: "invierno", label: "Ropa de Invierno", image: winterImg },
  { id: "accesorios", label: "Accesorios", image: accessoriesImg },
];

const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: "default", label: "Relevancia" },
  { id: "newest", label: "Más nuevo" },
  { id: "alphabetical", label: "Alfabético (A-Z)" },
  { id: "catalog", label: "Por catálogo" },
];

// Type guard en vez de "as SortMode": el parser acorn de TanStack Router
// rompe con casts TS dentro de archivos de rutas.
function isSortMode(value: string): value is SortMode {
  return SORT_OPTIONS.some((opt) => opt.id === value);
}

// ─── Tarjeta de producto con animación de entrada + badge Nuevo ──────────────

function ProductCard({
  p,
  index,
  isFav,
  isNew,
  onOpen,
  onToggleFav,
}: {
  p: Product;
  index: number;
  isFav: boolean;
  isNew: boolean;
  onOpen: (p: Product) => void;
  onToggleFav: (id: string) => void;
}) {
  const { ref, inView } = useInView<HTMLElement>();

  return (
    <article
      ref={ref}
      className={`group relative overflow-hidden rounded-sm border border-border bg-card transition-all duration-500 hover:border-primary ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
      style={{ transitionDelay: `${(index % 4) * 60}ms` }}
    >
      <button
        type="button"
        onClick={() => onOpen(p)}
        className="block w-full text-left"
      >
        <div className="relative aspect-[3/4] overflow-hidden bg-muted">
          <img
            src={proxyImageUrl(p.image)}
            alt={p.title}
            loading={index < 8 ? "eager" : "lazy"}
            // @ts-expect-error fetchpriority is valid HTML but not yet in React types
            fetchpriority={index < 4 ? "high" : "auto"}
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

      {/* Favorito */}
      <button
        onClick={() => onToggleFav(p.id)}
        aria-label="Favorito"
        className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-background/80 backdrop-blur transition hover:bg-background"
      >
        <Heart
          className={`h-3.5 w-3.5 ${
            isFav ? "fill-primary text-primary" : "text-foreground"
          }`}
        />
      </button>

      {/* Categoría + variantes + nuevo */}
      <div className="absolute left-2 top-2 flex flex-col gap-1">
        {isNew && (
          <span className="flex items-center gap-0.5 rounded-sm bg-emerald-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur">
            <Sparkles className="h-2.5 w-2.5" />
            Nuevo
          </span>
        )}
        <span className="rounded-sm bg-background/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider backdrop-blur">
          {CATEGORIES.find((x) => x.id === p.category)?.label.split(" ")[0]}
        </span>
        {p.variants && p.variants.length > 0 && (
          <span className="flex items-center gap-0.5 rounded-sm bg-primary/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground backdrop-blur">
            <Layers className="h-2.5 w-2.5" />
            {p.variants.length + 1} col.
          </span>
        )}
      </div>
    </article>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

function Index() {
  return (
    <CartProvider>
      <OrderHistoryProvider>
        <IndexContent />
      </OrderHistoryProvider>
    </CartProvider>
  );
}

function IndexContent() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<Category>("all");
  const [catalogFilter, setCatalogFilter] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [dark, setDark] = useState(true);
  const [favs, setFavs] = useState<string[]>([]);
  const [showFavs, setShowFavs] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [page, setPage] = useState(1);
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const [lastSeenIds, setLastSeenIds] = useState<Set<string> | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const fetchProducts = useServerFn(fetchAllProducts);
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["yupoo-products"],
    queryFn: () => fetchProducts(),
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
  });

  // ── Persistencia ────────────────────────────────────────────────────────────
  useEffect(() => {
    const savedFavs = localStorage.getItem("vault-favs");
    if (savedFavs) setFavs(JSON.parse(savedFavs));

    const savedRecent = localStorage.getItem(RECENTLY_VIEWED_KEY);
    if (savedRecent) setRecentlyViewed(JSON.parse(savedRecent));

    const savedLastSeen = localStorage.getItem(LAST_SEEN_IDS_KEY);
    if (savedLastSeen) {
      try {
        setLastSeenIds(new Set(JSON.parse(savedLastSeen)));
      } catch {
        setLastSeenIds(new Set());
      }
    } else {
      setLastSeenIds(new Set());
    }

    const theme = localStorage.getItem("vault-theme");
    if (theme === "light") {
      setDark(false);
      document.documentElement.classList.add("light");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("vault-favs", JSON.stringify(favs));
  }, [favs]);

  useEffect(() => {
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(recentlyViewed));
  }, [recentlyViewed]);

  // Tras cargar productos, actualizar el set de "ya vistos" para la próxima
  // visita (con un pequeño delay para no penalizar el badge "Nuevo" de esta sesión)
  useEffect(() => {
    if (!data?.products?.length) return;
    const timer = setTimeout(() => {
      const ids = data.products.map((p) => p.id);
      localStorage.setItem(LAST_SEEN_IDS_KEY, JSON.stringify(ids));
    }, 5000);
    return () => clearTimeout(timer);
  }, [data?.products]);

  // ── Reset página al cambiar filtros ─────────────────────────────────────────
  useEffect(() => {
    setPage(1);
  }, [query, cat, showFavs, catalogFilter, sortMode]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape" && !selected && query) {
        setQuery("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected, query]);

  // ── Handlers ────────────────────────────────────────────────────────────────
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

  const shareFavorites = async () => {
    if (favs.length === 0) return;
    const url = `${window.location.origin}/favs?ids=${favs.join(",")}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace de tu lista de favoritos copiado");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  };

  const openProduct = useCallback((p: Product) => {
    setSelected(p);
    setRecentlyViewed((prev) => {
      const without = prev.filter((x) => x.id !== p.id);
      return [p, ...without].slice(0, 8);
    });
  }, []);

  // ── Filtrado, orden y paginación ────────────────────────────────────────────
  const products = data?.products ?? [];

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (showFavs && !favs.includes(p.id)) return false;
      if (cat !== "all" && p.category !== cat) return false;
      if (catalogFilter && p.catalog !== catalogFilter) return false;
      return productMatchesQuery(p, query);
    });
  }, [products, query, cat, catalogFilter, favs, showFavs]);

  const sorted = useMemo(() => {
    if (sortMode === "default") return filtered;
    const copy = [...filtered];
    if (sortMode === "alphabetical") {
      copy.sort((a, b) => a.title.localeCompare(b.title, "es"));
    } else if (sortMode === "catalog") {
      copy.sort((a, b) => a.catalogName.localeCompare(b.catalogName, "es"));
    } else if (sortMode === "newest") {
      // "Nuevo" primero (no visto en el scrape anterior), resto mantiene orden original
      if (lastSeenIds) {
        copy.sort((a, b) => {
          const aNew = !lastSeenIds.has(a.id) ? 1 : 0;
          const bNew = !lastSeenIds.has(b.id) ? 1 : 0;
          return bNew - aNew;
        });
      }
    }
    return copy;
  }, [filtered, sortMode, lastSeenIds]);

  const paginated = useMemo(() => sorted.slice(0, page * PAGE_SIZE), [sorted, page]);

  const countByCat = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((p) => (map[p.category] = (map[p.category] || 0) + 1));
    return map;
  }, [products]);

  const countByCatalog = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((p) => (map[p.catalog] = (map[p.catalog] || 0) + 1));
    return map;
  }, [products]);

  const totalModels = products.length;
  const totalVariants = products.reduce((acc, p) => acc + (p.variants?.length ?? 0), 0);

  const hasActiveFilters = query || cat !== "all" || showFavs || catalogFilter;

  const isProductNew = useCallback(
    (id: string) => (lastSeenIds ? !lastSeenIds.has(id) : false),
    [lastSeenIds],
  );

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
            <a href="#productos" className="text-muted-foreground transition hover:text-foreground">
              Productos
            </a>
            <a href="#catalogos" className="text-muted-foreground transition hover:text-foreground">
              Catálogos
            </a>
          </nav>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={refresh}
              disabled={isFetching}
              aria-label="Refrescar"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Cambiar tema">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <CartDrawer />
            <OrderHistoryDrawer />
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
            ●{" "}
            {isLoading
              ? "Cargando…"
              : totalVariants > 0
                ? `${totalModels} modelos · ${totalModels + totalVariants} colores · 6 catálogos`
                : `${totalModels} productos · 6 catálogos`}
          </Badge>
          <h1 className="max-w-4xl text-5xl font-black leading-[0.95] tracking-tighter sm:text-7xl lg:text-8xl">
            EL VAULT DE LOS
            <br />
            <span className="text-primary" style={{ textShadow: "var(--glow)" }}>
              MEJORES YUPOOS
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            Productos auto-cargados de 6 catálogos Yupoo. Búscalos, fíltralos, guarda favoritos y
            abre el álbum original con un clic.
          </p>

          <div className="mt-10 max-w-xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar producto, marca… (⌘K)"
                className="h-14 border-border bg-card/80 pl-12 text-base backdrop-blur focus-visible:ring-primary"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Categories + catalog filter + sort */}
      <section className="border-b border-border bg-card/30">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { setCat("all"); setShowFavs(false); }}
              className={`rounded-sm border px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
                cat === "all" && !showFavs
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              Todo{" "}
              {products.length > 0 && (
                <span className="ml-1 opacity-60">{products.length}</span>
              )}
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
                {c.label}{" "}
                {countByCat[c.id] > 0 && (
                  <span className="ml-1 opacity-60">{countByCat[c.id]}</span>
                )}
              </button>
            ))}
            <button
              onClick={() => setShowFavs((v) => !v)}
              className={`flex items-center gap-1.5 rounded-sm border px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
                showFavs
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <Heart className={`h-3.5 w-3.5 ${showFavs ? "fill-current" : ""}`} />
              Favoritos{" "}
              {favs.length > 0 && <span className="opacity-70">{favs.length}</span>}
            </button>

            {showFavs && favs.length > 0 && (
              <button
                onClick={shareFavorites}
                className="flex items-center gap-1.5 rounded-sm border border-border bg-card px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground transition hover:border-primary hover:text-foreground"
              >
                <Share2 className="h-3.5 w-3.5" />
                Compartir lista
              </button>
            )}

            {/* Selector de orden */}
            <div className="ml-auto flex items-center gap-2">
              <Select
                value={sortMode}
                onValueChange={(v) => {
                  if (isSortMode(v)) setSortMode(v);
                }}
              >
                <SelectTrigger className="h-9 w-[160px] border-border bg-card text-xs font-bold uppercase tracking-wider">
                  <ArrowUpDown className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Filtro por catálogo específico */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Catálogo:
            </span>
            <button
              onClick={() => setCatalogFilter(null)}
              className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
                !catalogFilter
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              Todos
            </button>
            {CATALOGS.map((c) => (
              <button
                key={c.id}
                onClick={() => setCatalogFilter(catalogFilter === c.id ? null : c.id)}
                className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
                  catalogFilter === c.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                {c.name}{" "}
                {countByCatalog[c.id] > 0 && (
                  <span className="opacity-60">{countByCatalog[c.id]}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Vistos recientemente */}
      {recentlyViewed.length > 0 && !hasActiveFilters && !isLoading && (
        <section className="border-b border-border bg-card/20">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
            <p className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Vistos recientemente
            </p>
            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
              {recentlyViewed.map((p) => (
                <button
                  key={p.id}
                  onClick={() => openProduct(p)}
                  className="shrink-0 w-24 rounded-sm border border-border overflow-hidden hover:border-primary transition"
                >
                  <img
                    src={proxyImageUrl(p.image)}
                    alt={p.title}
                    referrerPolicy="no-referrer"
                    className="aspect-square w-full object-contain bg-muted"
                  />
                  <p className="p-1.5 text-[10px] leading-tight line-clamp-2 text-left">{p.title}</p>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Products grid */}
      <section id="productos" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-primary">
              01 / Productos
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              {isLoading
                ? "Cargando…"
                : `${sorted.length} ${sorted.length === 1 ? "modelo" : "modelos"}`}
            </h2>
          </div>
          {data?.fetchedAt && (
            <p className="hidden font-mono text-xs uppercase tracking-widest text-muted-foreground sm:block">
              Actualizado: {new Date(data.fetchedAt).toLocaleTimeString()}
            </p>
          )}
        </div>

        {isLoading ? (
          <div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="skeleton-shimmer aspect-[3/4] rounded-sm border border-border"
                />
              ))}
            </div>
            <p className="mt-6 text-center text-xs text-muted-foreground animate-pulse">
              Cargando catálogos de Yupoo por primera vez… puede tardar hasta 1 minuto
            </p>
          </div>
        ) : error ? (
          <div className="rounded-sm border border-destructive/40 bg-destructive/10 p-8 text-center">
            <p className="font-bold text-destructive">Error al cargar productos</p>
            <p className="mt-2 text-sm text-muted-foreground">{String(error)}</p>
            <Button onClick={refresh} className="mt-4">
              Reintentar
            </Button>
          </div>
        ) : sorted.length === 0 ? (
          /* ── Empty state mejorado ── */
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <div className="text-5xl">🔍</div>
            <p className="text-lg font-bold">
              {showFavs ? "Aún no tienes favoritos" : `Sin resultados para "${query}"`}
            </p>
            <p className="text-sm text-muted-foreground max-w-xs">
              {showFavs
                ? "Guarda productos con el corazón para verlos aquí"
                : "Prueba con términos más simples o elimina algún filtro"}
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {query && (
                <Button variant="outline" size="sm" onClick={() => setQuery("")}>
                  Limpiar búsqueda
                </Button>
              )}
              {cat !== "all" && (
                <Button variant="outline" size="sm" onClick={() => setCat("all")}>
                  Ver en todas las categorías
                </Button>
              )}
              {catalogFilter && (
                <Button variant="outline" size="sm" onClick={() => setCatalogFilter(null)}>
                  Quitar filtro de catálogo
                </Button>
              )}
              {showFavs && (
                <Button variant="outline" size="sm" onClick={() => setShowFavs(false)}>
                  Ver todos los productos
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {paginated.map((p, i) => (
                <ProductCard
                  key={p.id}
                  p={p}
                  index={i}
                  isFav={favs.includes(p.id)}
                  isNew={isProductNew(p.id)}
                  onOpen={openProduct}
                  onToggleFav={toggleFav}
                />
              ))}
            </div>

            {/* Cargar más */}
            {paginated.length < sorted.length && (
              <div className="mt-10 flex flex-col items-center gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setPage((p) => p + 1)}
                  className="border-border px-10"
                >
                  Cargar más{" "}
                  <span className="ml-1.5 opacity-60">
                    ({sorted.length - paginated.length} restantes)
                  </span>
                </Button>
                <p className="text-xs text-muted-foreground">
                  Mostrando {paginated.length} de {sorted.length}
                </p>
              </div>
            )}
          </>
        )}

        {data?.errors && data.errors.length > 0 && (
          <details className="mt-8 rounded-sm border border-border bg-card/40 p-4 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-mono uppercase tracking-widest">
              {data.errors.length} catálogo(s) con error
            </summary>
            <ul className="mt-3 space-y-1">
              {data.errors.map((e, i) => (
                <li key={i} className="font-mono">
                  {e}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* Catalogs */}
      <section id="catalogos" className="border-t border-border bg-card/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <p className="text-xs font-mono uppercase tracking-widest text-primary">
            02 / Catálogos originales
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            Abrir Yupoo directamente
          </h2>
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
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {c.defaultCategory}
                  </p>
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
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6"
        >
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
