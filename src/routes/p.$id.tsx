import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Loader2, ImageOff, Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchAllProducts, fetchAlbumImages, type Product } from "@/lib/yupoo.functions";
import { proxyImageUrl } from "@/lib/image-proxy";
import { isFootball, isRetro, getPrice, PRICE_RETRO, PRICE_CURRENT } from "@/lib/pricing";

type ResolvedProduct = Product & { variantOf?: string };

function findProductById(products: Product[], id: string): ResolvedProduct | null {
  for (const p of products) {
    if (p.id === id) return p;
    const variant = p.variants?.find((v) => v.id === id);
    if (variant) {
      return {
        ...p,
        ...variant,
        variants: p.variants,
        variantOf: p.title,
      };
    }
  }
  return null;
}

export const Route = createFileRoute("/p/$id")({
  loader: async ({ params }) => {
    const result = await fetchAllProducts();
    const product = findProductById(result.products, params.id);
    return { product };
  },
  head: ({ loaderData }) => {
    const product = loaderData?.product;
    if (!product) {
      return {
        meta: [{ title: "Producto no encontrado — VAULT" }],
      };
    }
    const description = `${product.title} disponible en ${product.catalogName}. Cómpralo en VAULT — Yupoo Catalog Hub.`;
    return {
      meta: [
        { title: `${product.title} — VAULT` },
        { name: "description", content: description },
        { property: "og:title", content: product.title },
        { property: "og:description", content: description },
        { property: "og:image", content: product.image },
        { property: "og:type", content: "product" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: product.title },
        { name: "twitter:image", content: product.image },
      ],
    };
  },
  component: ProductPage,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-black tracking-tight">Producto no encontrado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Puede que el catálogo se haya actualizado. Vuelve a la tienda para buscarlo de nuevo.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Ir a VAULT
        </Link>
      </div>
    </div>
  ),
});

function ProductPage() {
  const { product } = Route.useLoaderData();
  const fetchImages = useServerFn(fetchAlbumImages);
  const [copied, setCopied] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["album-images", product?.url],
    queryFn: () => fetchImages({ data: { url: product!.url } }),
    enabled: !!product,
    staleTime: 60 * 60 * 1000,
  });

  if (!product) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-black tracking-tight">Producto no encontrado</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Puede que el catálogo se haya actualizado. Vuelve a la tienda para buscarlo de nuevo.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ir a VAULT
          </Link>
        </div>
      </div>
    );
  }

  const images = data?.images && data.images.length > 0 ? data.images : [product.image];
  const canReserve = isFootball(product);
  const price = getPrice(product);

  const shareProduct = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Enlace copiado al portapapeles");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 text-sm font-bold">
            <ArrowLeft className="h-4 w-4" />
            VAULT
          </Link>
          <button
            onClick={shareProduct}
            aria-label="Compartir producto"
            className="grid h-9 w-9 place-items-center rounded-full border border-border transition hover:border-primary"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Share2 className="h-4 w-4" />}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="grid gap-8 md:grid-cols-2">
          {/* Imágenes */}
          <div className="overflow-hidden rounded-sm border border-border bg-card">
            {isLoading ? (
              <div className="flex aspect-square items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="flex aspect-square flex-col items-center justify-center gap-2 text-muted-foreground">
                <ImageOff className="h-8 w-8" />
                <p className="text-xs">No se pudieron cargar las imágenes</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1 p-1">
                {images.slice(0, 6).map((src, i) => (
                  <img
                    key={src + i}
                    src={proxyImageUrl(src)}
                    alt={`${product.title} ${i + 1}`}
                    referrerPolicy="no-referrer"
                    loading={i < 2 ? "eager" : "lazy"}
                    className={`w-full rounded-sm object-cover ${
                      i === 0 ? "col-span-2 aspect-[4/3]" : "aspect-square"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/20">
                {product.catalogName}
              </Badge>
              <Badge variant="outline" className="border-border text-muted-foreground">
                {product.category}
              </Badge>
              {canReserve && (
                <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600">
                  {isRetro(product) ? `Retro · ${PRICE_RETRO} €` : `Temporada actual · ${PRICE_CURRENT} €`}
                </Badge>
              )}
            </div>

            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{product.title}</h1>
            {product.variantOf && (
              <p className="mt-1 text-xs text-muted-foreground">Variante de: {product.variantOf}</p>
            )}
            <p className="mt-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Álbum original de Yupoo
            </p>

            {canReserve && (
              <p className="mt-6 text-2xl font-black text-primary">{price} €</p>
            )}

            <div className="mt-6 flex flex-col gap-2">
              {canReserve && (
                <Button asChild size="lg" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  <Link to="/">Ir a VAULT para reservar</Link>
                </Button>
              )}
              <Button asChild size="lg" variant="outline" className="w-full">
                <a href={product.url} target="_blank" rel="noopener noreferrer">
                  Abrir álbum original
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
