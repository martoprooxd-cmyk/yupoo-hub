import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  ExternalLink,
  Loader2,
  ImageOff,
  ShoppingCart,
  Check as CheckIcon,
  CheckCircle2,
  Heart,
  Share2,
  Check,
  Layers,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchAlbumImages, type Product, type ProductVariant } from "@/lib/yupoo.functions";
import { proxyImageUrl } from "@/lib/image-proxy";
import { useCart } from "@/lib/CartContext";
import {
  isFootball,
  isRetro,
  getPrice,
  variantLabel,
  PRICE_RETRO,
  PRICE_CURRENT,
  ADULT_SIZES,
  KID_SIZES,
} from "@/lib/pricing";

// ─── Selector de variantes de color ──────────────────────────────────────────

function VariantSelector({
  product,
  onSelectVariant,
}: {
  product: Product;
  onSelectVariant: (v: ProductVariant | null) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null); // null = base

  if (!product.variants || product.variants.length === 0) return null;

  const allVariants: Array<{ id: string | null; title: string; image: string; url: string }> = [
    { id: null, title: product.title, image: product.image, url: product.url },
    ...product.variants.map((v) => ({ id: v.id, title: v.title, image: v.image, url: v.url })),
  ];

  const handleSelect = (v: (typeof allVariants)[number]) => {
    const newId = v.id;
    setSelected(newId);
    onSelectVariant(newId === null ? null : (product.variants!.find((pv) => pv.id === newId) ?? null));
  };

  return (
    <div className="mt-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <Layers className="h-3.5 w-3.5 text-primary" />
        {product.variants.length + 1} colores disponibles
      </p>
      <div className="flex flex-wrap gap-2">
        {allVariants.map((v) => {
          const isActive = selected === v.id;
          const label = v.id === null
            ? variantLabel("", product.title)
            : variantLabel(product.title, v.title);
          return (
            <button
              key={v.id ?? "base"}
              type="button"
              onClick={() => handleSelect(v)}
              title={v.title}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition ${
                isActive
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card hover:border-primary/50 text-foreground"
              }`}
            >
              <img
                src={proxyImageUrl(v.image)}
                alt={label}
                referrerPolicy="no-referrer"
                className="h-6 w-6 rounded-sm object-cover"
              />
              <span className="max-w-[80px] truncate capitalize">{label || "base"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

type Props = {
  product: Product | null;
  onClose: () => void;
  isFav: boolean;
  onToggleFav: (id: string) => void;
};

export function ProductModal({ product: baseProp, onClose, isFav, onToggleFav }: Props) {
  const fetchImages = useServerFn(fetchAlbumImages);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const { addItem, isInCart } = useCart();

  // El producto activo puede ser el base o una variante seleccionada
  const [activeVariant, setActiveVariant] = useState<ProductVariant | null>(null);
  const product = activeVariant
    ? { ...baseProp!, ...activeVariant, variants: baseProp?.variants }
    : baseProp;

  const [sizeMode, setSizeMode] = useState<"adulto" | "nino">("adulto");
  const [size, setSize] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    setCurrent(0);
    setSize("");
    setSizeMode("adulto");
    setCopied(false);
    setJustAdded(false);
    setActiveVariant(null);
  }, [baseProp?.url]);

  const shareProduct = useCallback(async () => {
    if (!product) return;
    try {
      await navigator.clipboard.writeText(product.url);
      setCopied(true);
      toast.success("Enlace copiado al portapapeles");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  }, [product]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["album-images", product?.url],
    queryFn: () => fetchImages({ data: { url: product!.url } }),
    enabled: !!product,
    staleTime: 60 * 60 * 1000,
  });

  const images =
    data?.images && data.images.length > 0 ? data.images : product ? [product.image] : [];

  useEffect(() => {
    if (!data?.images?.length) return;
    const preloaders = data.images.map((src) => {
      const img = new Image();
      img.referrerPolicy = "no-referrer";
      img.src = src;
      return img;
    });
    return () => preloaders.forEach((img) => { img.src = ""; });
  }, [data?.images]);

  useEffect(() => {
    if (!api) return;
    const sync = () => setCurrent(api.selectedScrollSnap());
    sync();
    api.on("select", sync);
    api.on("reInit", sync);
    api.on("scroll", sync);
    return () => {
      api.off("select", sync);
      api.off("reInit", sync);
      api.off("scroll", sync);
    };
  }, [api]);

  const thumbsRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const strip = thumbsRef.current;
    if (!strip) return;
    const active = strip.querySelector<HTMLButtonElement>(`button[data-thumb-idx="${current}"]`);
    active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [current]);

  const scrollTo = useCallback((idx: number) => api?.scrollTo(idx), [api]);

  const canReserve = product ? isFootball(product) : false;
  const price = product ? getPrice(product) : 0;
  const alreadyInCart = product ? isInCart(product.id, activeVariant?.title, size) : false;

  const handleAddToCart = () => {
    if (!product || !size) return;
    addItem(product, activeVariant ?? undefined, size, price);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1800);
  };

  return (
    <Dialog open={!!baseProp} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl border-border bg-card p-0 overflow-y-auto max-h-[90dvh]">
        {product && (
          <>
            {/* Carrusel */}
            <div className="relative bg-background">
              {isLoading ? (
                <div className="flex aspect-square items-center justify-center sm:aspect-[4/3]">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : error ? (
                <div className="flex aspect-square flex-col items-center justify-center gap-2 text-muted-foreground sm:aspect-[4/3]">
                  <ImageOff className="h-8 w-8" />
                  <p className="text-xs">No se pudieron cargar las imágenes</p>
                  <img
                    src={proxyImageUrl(product.image)}
                    alt={product.title}
                    referrerPolicy="no-referrer"
                    className="mt-2 max-h-64 rounded-sm"
                  />
                </div>
              ) : (
                <Carousel className="w-full" setApi={setApi}>
                  <CarouselContent>
                    {images.map((src, i) => (
                      <CarouselItem key={src + i}>
                        <div className="flex aspect-square items-center justify-center bg-background sm:aspect-[4/3]">
                          <img
                            src={proxyImageUrl(src)}
                            alt={`${product.title} ${i + 1}`}
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            className="max-h-full max-w-full object-contain"
                            onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.2"; }}
                          />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {images.length > 1 && (
                    <>
                      <CarouselPrevious className="left-3" />
                      <CarouselNext className="right-3" />
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-sm bg-background/80 px-2 py-1 font-mono text-[10px] uppercase tracking-wider backdrop-blur">
                        {current + 1} / {images.length}
                      </div>
                    </>
                  )}
                </Carousel>
              )}

              <div className="absolute right-3 top-3 z-10 flex gap-2">
                <button
                  onClick={shareProduct}
                  aria-label="Compartir producto"
                  className="grid h-9 w-9 place-items-center rounded-full bg-background/80 shadow backdrop-blur transition hover:bg-background"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Share2 className="h-4 w-4 text-foreground" />}
                </button>
                <button
                  onClick={() => onToggleFav(baseProp!.id)}
                  aria-label={isFav ? "Quitar de favoritos" : "Añadir a favoritos"}
                  className="grid h-9 w-9 place-items-center rounded-full bg-background/80 shadow backdrop-blur transition hover:bg-background"
                >
                  <Heart className={`h-4 w-4 transition ${isFav ? "fill-primary text-primary" : "text-foreground"}`} />
                </button>
              </div>
            </div>

            {/* Miniaturas */}
            <div
              ref={thumbsRef}
              className="flex min-h-[72px] items-center gap-2 overflow-x-auto border-b border-border bg-card/40 px-6 py-3 scrollbar-thin scroll-smooth"
            >
              {isLoading ? (
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin text-primary" />
                  Cargando miniaturas…
                </div>
              ) : error ? (
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-destructive">
                  <ImageOff className="h-3 w-3" />
                  Error al cargar el álbum
                </div>
              ) : images.length > 1 ? (
                images.map((src, i) => (
                  <button
                    key={src + i}
                    type="button"
                    data-thumb-idx={i}
                    onClick={() => scrollTo(i)}
                    className={`shrink-0 overflow-hidden rounded-sm border transition ${
                      i === current
                        ? "border-primary ring-1 ring-primary"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <img
                      src={proxyImageUrl(src)}
                      alt={`Miniatura ${i + 1}`}
                      referrerPolicy="no-referrer"
                      className="h-12 w-12 object-cover sm:h-14 sm:w-14"
                      loading="eager"
                      decoding="async"
                    />
                  </button>
                ))
              ) : null}
            </div>

            {/* Info + añadir al carrito */}
            <div className="border-t border-border p-6">
              <DialogHeader className="text-left">
                <div className="mb-2 flex flex-wrap items-center gap-2">
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
                <DialogTitle className="text-xl font-black tracking-tight sm:text-2xl">
                  {product.title}
                </DialogTitle>
                <DialogDescription className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  Álbum original de Yupoo
                </DialogDescription>
              </DialogHeader>

              {/* ── Selector de variantes de color ── */}
              {baseProp && (
                <VariantSelector
                  product={baseProp}
                  onSelectVariant={(v) => {
                    setActiveVariant(v);
                    setCurrent(0);
                  }}
                />
              )}

              {/* Selección de talla + añadir al carrito */}
              {canReserve && (
                <div className="mt-5 rounded-lg border border-border bg-background/60 p-4">
                  <p className="mb-2 text-xs text-muted-foreground">
                    Consultas previas:{" "}
                    <a
                      href="https://instagram.com/tu_proveedor_de_confi"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline hover:text-primary/80"
                    >
                      @tu_proveedor_de_confi
                    </a>
                  </p>

                  <p className="mb-2 text-sm font-semibold">Talla</p>
                  <div className="mb-3 flex gap-2">
                    {(["adulto", "nino"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => { setSizeMode(m); setSize(""); }}
                        className={`flex-1 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-widest transition ${
                          sizeMode === m
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {m === "adulto" ? "Adulto" : "Niño"}
                      </button>
                    ))}
                  </div>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {(sizeMode === "adulto" ? ADULT_SIZES : KID_SIZES).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSize(s)}
                        className={`min-w-[44px] rounded-md border px-3 py-2 text-sm font-bold transition ${
                          size === s
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-foreground hover:border-primary/50"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  <Button
                    onClick={handleAddToCart}
                    disabled={!size}
                    size="lg"
                    className={`w-full ${
                      justAdded
                        ? "bg-emerald-600 text-white hover:bg-emerald-600"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }`}
                  >
                    {justAdded ? (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Añadido al carrito
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        Añadir al carrito · {price} €
                      </>
                    )}
                  </Button>

                  {!size && (
                    <p className="mt-2 text-center text-[11px] text-muted-foreground">
                      Selecciona una talla para añadir al carrito
                    </p>
                  )}
                  {alreadyInCart && size && !justAdded && (
                    <p className="mt-2 flex items-center justify-center gap-1 text-center text-[11px] text-emerald-600">
                      <CheckIcon className="h-3 w-3" />
                      Ya tienes esta talla en el carrito
                    </p>
                  )}
                </div>
              )}

              <Button
                asChild
                size="lg"
                variant="outline"
                className={`w-full ${canReserve ? "mt-3" : "mt-5"}`}
              >
                <a href={product.url} target="_blank" rel="noopener noreferrer">
                  Abrir álbum original
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
