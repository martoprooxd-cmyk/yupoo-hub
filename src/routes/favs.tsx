import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Heart, Share2, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchAllProducts, type Product } from "@/lib/yupoo.functions";
import { proxyImageUrl } from "@/lib/image-proxy";
import { ProductModal } from "@/components/ProductModal";
import { CartProvider } from "@/lib/CartContext";
import { OrderHistoryProvider } from "@/lib/OrderHistoryContext";

type FavsSearch = { ids: string };

export const Route = createFileRoute("/favs")({
  validateSearch: (search: Record<string, unknown>): FavsSearch => ({
    ids: typeof search.ids === "string" ? search.ids : "",
  }),
  head: () => ({
    meta: [
      { title: "Lista de favoritos — VAULT" },
      {
        name: "description",
        content: "Una selección de productos compartida desde VAULT — Yupoo Catalog Hub.",
      },
    ],
  }),
  component: FavsPage,
});

function FavsPage() {
  return (
    <CartProvider>
      <OrderHistoryProvider>
        <FavsContent />
      </OrderHistoryProvider>
    </CartProvider>
  );
}

function FavsContent() {
  const { ids } = Route.useSearch();
  const [selected, setSelected] = useState<Product | null>(null);
  const [copied, setCopied] = useState(false);
  const fetchProducts = useServerFn(fetchAllProducts);

  const { data, isLoading } = useQuery({
    queryKey: ["yupoo-products"],
    queryFn: () => fetchProducts(),
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
  });

  const idList = useMemo(() => ids.split(",").map((s) => s.trim()).filter(Boolean), [ids]);

  const matched = useMemo(() => {
    const products = data?.products ?? [];
    const idSet = new Set(idList);
    return products.filter((p) => idSet.has(p.id));
  }, [data?.products, idList]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Enlace de la lista copiado");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 text-sm font-bold">
            <ArrowLeft className="h-4 w-4" />
            VAULT
          </Link>
          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold transition hover:border-primary"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Share2 className="h-3.5 w-3.5" />}
            {copied ? "Copiado" : "Compartir lista"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="mb-8 flex items-center gap-2">
          <Heart className="h-6 w-6 fill-primary text-primary" />
          <h1 className="text-3xl font-black tracking-tight">
            Lista compartida{" "}
            <span className="text-muted-foreground">
              ({idList.length} {idList.length === 1 ? "producto" : "productos"})
            </span>
          </h1>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: Math.min(idList.length || 4, 8) }).map((_, i) => (
              <div key={i} className="skeleton-shimmer aspect-[3/4] rounded-sm border border-border" />
            ))}
          </div>
        ) : idList.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center text-muted-foreground">
            <Heart className="h-10 w-10 opacity-30" />
            <p>No hay productos en esta lista.</p>
            <Link to="/" className="text-sm text-primary underline-offset-2 hover:underline">
              Volver a VAULT
            </Link>
          </div>
        ) : matched.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center text-muted-foreground">
            <Heart className="h-10 w-10 opacity-30" />
            <p>Estos productos ya no están disponibles en el catálogo.</p>
            <Link to="/" className="text-sm text-primary underline-offset-2 hover:underline">
              Ir a VAULT
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {matched.map((p) => (
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
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Abrir álbum original"
                  className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-background/80 backdrop-blur transition hover:bg-background"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-foreground" />
                </a>
              </article>
            ))}
          </div>
        )}
      </main>

      <ProductModal
        product={selected}
        onClose={() => setSelected(null)}
        isFav={false}
        onToggleFav={() => {}}
      />
    </div>
  );
}
