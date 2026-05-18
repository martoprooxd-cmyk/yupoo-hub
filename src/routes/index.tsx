import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Search, ExternalLink, Heart, Moon, Sun, Copy, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
      { name: "description", content: "Explora los mejores catálogos de Yupoo en un solo lugar. Zapatillas, ropa, camisetas de fútbol, ropa de invierno y accesorios. Estilo StockX." },
    ],
  }),
  component: Index,
});

type Category = "all" | "zapatillas" | "ropa" | "futbol" | "invierno" | "accesorios";

const CATEGORIES: { id: Category; label: string; image: string }[] = [
  { id: "zapatillas", label: "Zapatillas", image: sneakersImg },
  { id: "ropa", label: "Ropa", image: clothesImg },
  { id: "futbol", label: "Camisetas Fútbol", image: footballImg },
  { id: "invierno", label: "Ropa de Invierno", image: winterImg },
  { id: "accesorios", label: "Accesorios", image: accessoriesImg },
];

type Catalog = {
  id: string;
  name: string;
  url: string;
  category: Category;
  image: string;
  tags: string[];
  items: string;
};

const CATALOGS: Catalog[] = [
  {
    id: "pandashoesx",
    name: "Panda Shoes",
    url: "https://pandashoesx.x.yupoo.com/",
    category: "zapatillas",
    image: sneakersImg,
    tags: ["Nike", "Jordan", "Adidas", "Yeezy"],
    items: "1000+ modelos",
  },
  {
    id: "panshirt",
    name: "Pan Shirt",
    url: "https://panshirt.x.yupoo.com/",
    category: "futbol",
    image: footballImg,
    tags: ["Clubes", "Selecciones", "Retro"],
    items: "Camisetas oficiales",
  },
  {
    id: "pandaclothes",
    name: "Panda Clothes",
    url: "https://pandaclothes.x.yupoo.com/",
    category: "ropa",
    image: clothesImg,
    tags: ["Hoodies", "Tees", "Cargo"],
    items: "Streetwear premium",
  },
  {
    id: "wu769809876",
    name: "WU Collection",
    url: "https://wu769809876.x.yupoo.com/categories",
    category: "ropa",
    image: clothesImg,
    tags: ["Designer", "Tracksuits", "Denim"],
    items: "Marca diversa",
  },
  {
    id: "maoyi998",
    name: "998 Maoyi",
    url: "http://998maoyi.x.yupoo.com/categories",
    category: "accesorios",
    image: accessoriesImg,
    tags: ["Bolsos", "Caps", "Cinturones"],
    items: "Accesorios premium",
  },
  {
    id: "winterclothes",
    name: "Winter Clothes",
    url: "https://winterclothes.x.yupoo.com/categories",
    category: "invierno",
    image: winterImg,
    tags: ["Puffers", "Down", "North Face"],
    items: "Colección invierno",
  },
];

const PASSWORD = "112233445566";

function Index() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<Category>("all");
  const [dark, setDark] = useState(true);
  const [favs, setFavs] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

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

  const copyPass = () => {
    navigator.clipboard.writeText(PASSWORD);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const filtered = useMemo(() => {
    return CATALOGS.filter((c) => {
      if (cat !== "all" && c.category !== cat) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)) ||
        c.category.toLowerCase().includes(q)
      );
    });
  }, [query, cat]);

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
            <a href="#catalogos" className="text-muted-foreground transition hover:text-foreground">Catálogos</a>
            <a href="#categorias" className="text-muted-foreground transition hover:text-foreground">Categorías</a>
            <a href="#password" className="text-muted-foreground transition hover:text-foreground">Password</a>
          </nav>
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Cambiar tema">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <img
          src={heroImg}
          alt="Streetwear catalog hero"
          width={1920}
          height={800}
          className="absolute inset-0 h-full w-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32">
          <Badge className="mb-6 border-primary/30 bg-primary/10 text-primary hover:bg-primary/20">
            ● 6 catálogos · 5 categorías
          </Badge>
          <h1 className="max-w-4xl text-5xl font-black leading-[0.95] tracking-tighter sm:text-7xl lg:text-8xl">
            EL VAULT DE LOS<br />
            <span className="text-primary" style={{ textShadow: "var(--glow)" }}>MEJORES YUPOOS</span>
          </h1>
          <p className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            Zapatillas, streetwear, camisetas de fútbol e invierno. Todos los catálogos curados en una sola interfaz.
          </p>

          {/* Search */}
          <div className="mt-10 max-w-xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar catálogo, marca o categoría…"
                className="h-14 border-border bg-card/80 pl-12 text-base backdrop-blur focus-visible:ring-primary"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section id="categorias" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-primary">01 / Categorías</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Explora por tipo</h2>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCat("all")}
            className={`rounded-sm border px-4 py-2 text-sm font-semibold uppercase tracking-wider transition ${
              cat === "all"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:border-primary/50"
            }`}
          >
            Todo
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`rounded-sm border px-4 py-2 text-sm font-semibold uppercase tracking-wider transition ${
                cat === c.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setCat(c.id);
                document.getElementById("catalogos")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="group relative aspect-square overflow-hidden rounded-sm border border-border bg-card transition hover:border-primary"
            >
              <img
                src={c.image}
                alt={c.label}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover opacity-60 transition group-hover:scale-110 group-hover:opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3 text-left">
                <p className="text-sm font-bold uppercase tracking-tight sm:text-base">{c.label}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Catalogs grid */}
      <section id="catalogos" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-primary">02 / Catálogos</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              {filtered.length} {filtered.length === 1 ? "catálogo" : "catálogos"}
            </h2>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-sm border border-dashed border-border p-16 text-center text-muted-foreground">
            No hay resultados para tu búsqueda.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
              <article
                key={c.id}
                className="group relative overflow-hidden rounded-sm border border-border bg-card transition hover:border-primary"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                  <img
                    src={c.image}
                    alt={c.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                  />
                  <button
                    onClick={() => toggleFav(c.id)}
                    aria-label="Favorito"
                    className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-background/80 backdrop-blur transition hover:bg-background"
                  >
                    <Heart
                      className={`h-4 w-4 ${favs.includes(c.id) ? "fill-primary text-primary" : "text-foreground"}`}
                    />
                  </button>
                  <div className="absolute left-3 top-3">
                    <Badge variant="secondary" className="border-0 bg-background/80 text-xs font-bold uppercase backdrop-blur">
                      {CATEGORIES.find((x) => x.id === c.category)?.label}
                    </Badge>
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-black tracking-tight">{c.name}</h3>
                    <span className="font-mono text-xs text-muted-foreground">{c.items}</span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>

                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 flex items-center justify-between rounded-sm border border-border bg-secondary px-4 py-3 text-sm font-bold uppercase tracking-wider transition hover:border-primary hover:bg-primary hover:text-primary-foreground"
                  >
                    Abrir álbum
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Password */}
      <section id="password" className="border-t border-border bg-card/40">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-primary">03 / Acceso</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Password para álbumes protegidos</h2>
              <p className="mt-4 text-muted-foreground">
                Algunos álbumes de Yupoo requieren contraseña. Cópiala y pégala cuando te la pidan.
              </p>
            </div>
            <button
              onClick={copyPass}
              className="group flex items-center justify-between rounded-sm border border-border bg-background p-6 transition hover:border-primary"
            >
              <div className="text-left">
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Password</p>
                <p className="mt-1 font-mono text-2xl font-bold tracking-wider">{PASSWORD}</p>
              </div>
              <div className="grid h-12 w-12 place-items-center rounded-sm border border-border bg-card transition group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
              </div>
            </button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} VAULT — Yupoo Catalog Hub</p>
          <p className="font-mono text-xs uppercase tracking-widest">Curated · Fast · Free</p>
        </div>
      </footer>
    </div>
  );
}
