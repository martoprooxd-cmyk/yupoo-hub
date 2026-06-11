import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  ExternalLink,
  Loader2,
  ImageOff,
  ShoppingBag,
  CheckCircle2,
  MapPin,
  Heart,
  Share2,
  Check,
  Send,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchAlbumImages, type Product, type ProductVariant } from "@/lib/yupoo.functions";
import { proxyImageUrl } from "@/lib/image-proxy";

const PAYPAL_CLIENT_ID = "TU_PAYPAL_CLIENT_ID_AQUI";

const PRICE_CURRENT = 22;
const PRICE_RETRO = 25;

type ShippingAddress = {
  nombre: string;
  direccion: string;
  ciudad: string;
  codigoPostal: string;
  pais: string;
};

type CheckoutStep = "idle" | "form" | "paypal" | "success";

declare global {
  interface Window {
    paypal?: {
      Buttons: (config: object) => {
        render: (container: HTMLElement) => Promise<void>;
        close: () => void;
        isEligible: () => boolean;
      };
    };
  }
}

function isFootball(product: Product): boolean {
  const h = `${product.title} ${product.catalogName} ${product.category}`.toLowerCase();
  return (
    h.includes("futbol") ||
    h.includes("fútbol") ||
    h.includes("football") ||
    h.includes("soccer") ||
    h.includes("jersey") ||
    h.includes("camiseta") ||
    (h.includes("panshirt") || h.includes("pan shirt")) ||
    (!h.includes("nba") && !h.includes("basket") && product.category === "futbol")
  );
}

function isRetro(product: Product): boolean {
  const h = `${product.title} ${product.catalogName}`.toLowerCase();
  return (
    h.includes("retro") ||
    h.includes("clásic") ||
    h.includes("clasic") ||
    h.includes("vintage") ||
    h.includes("classic")
  );
}

function getPrice(product: Product): number {
  return isRetro(product) ? PRICE_RETRO : PRICE_CURRENT;
}

// Extrae un "label de color" del título de una variante respecto al base
// Ejemplo: "Nike Dunk Low Black White" vs base "Nike Dunk Low" → "Black White"
function variantLabel(baseTitle: string, variantTitle: string): string {
  const base = new Set(
    baseTitle
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter(Boolean)
  );

  const unique = variantTitle
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(" ")
    .filter((w) => w.length > 1 && !base.has(w));

  return unique.length > 0
    ? unique.slice(0, 3).join(" ")
    : variantTitle.slice(0, 24);
}

const ADULT_SIZES = ["S", "M", "L", "XL", "XXL"];
const KID_SIZES = ["XS", "S", "M"];

function ShippingForm({
  address,
  onChange,
  onContinue,
  canContinue = true,
}: {
  address: ShippingAddress;
  onChange: (a: ShippingAddress) => void;
  onContinue: () => void;
  canContinue?: boolean;
}) {
  const isValid =
    canContinue &&
    address.nombre.trim() &&
    address.direccion.trim() &&
    address.ciudad.trim() &&
    address.codigoPostal.trim() &&
    address.pais.trim();

  const field = (
    key: keyof ShippingAddress,
    label: string,
    placeholder: string,
    half = false
  ) => (
    <div className={half ? "flex-1" : "w-full"}>
      <Label
        htmlFor={key}
        className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted-foreground"
      >
        {label}
      </Label>
      <Input
        id={key}
        value={address[key]}
        placeholder={placeholder}
        onChange={(e) => onChange({ ...address, [key]: e.target.value })}
        className="border-border bg-background text-sm"
      />
    </div>
  );

  return (
    <div className="space-y-3">
      {field("nombre", "Nombre completo", "Juan García")}
      {field("direccion", "Dirección", "Calle Mayor 12, 3º B")}
      <div className="flex gap-3">
        {field("ciudad", "Ciudad", "Barcelona", true)}
        {field("codigoPostal", "Código postal", "08001", true)}
      </div>
      {field("pais", "País", "España")}
      <Button
        onClick={onContinue}
        disabled={!isValid}
        className="mt-1 w-full bg-primary text-primary-foreground hover:bg-primary/90"
      >
        Continuar al pago
      </Button>
    </div>
  );
}

function PayPalStep({
  product,
  address,
  size,
  onSuccess,
  onBack,
}: {
  product: Product;
  address: ShippingAddress;
  size: string;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const price = getPrice(product);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<ReturnType<NonNullable<Window["paypal"]>["Buttons"]> | null>(null);
  const [sdkError, setSdkError] = useState(false);

  if (PAYPAL_CLIENT_ID === "TU_PAYPAL_CLIENT_ID_AQUI") {
    return (
      <div className="space-y-4">
        <p className="rounded-md border border-border bg-muted/30 p-3 text-center text-xs text-muted-foreground">
          PayPal no está configurado en este entorno.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          ← Volver
        </button>
      </div>
    );
  }

  const renderButtons = () => {
    if (!containerRef.current || !window.paypal) return;
    containerRef.current.innerHTML = "";
    try {
      const buttons = window.paypal.Buttons({
        style: { layout: "vertical", color: "gold", shape: "rect", label: "pay" },
        createOrder: (_data: unknown, actions: { order: { create: (o: object) => Promise<string> } }) =>
          actions.order.create({
            intent: "CAPTURE",
            purchase_units: [
              {
                description: `${product.title} — Talla ${size}`,
                amount: {
                  currency_code: "EUR",
                  value: price.toFixed(2),
                  breakdown: {
                    item_total: { currency_code: "EUR", value: price.toFixed(2) },
                  },
                },
                items: [
                  {
                    name: product.title.slice(0, 120),
                    description: `Talla ${size}`,
                    quantity: "1",
                    unit_amount: { currency_code: "EUR", value: price.toFixed(2) },
                  },
                ],
                shipping: {
                  name: { full_name: address.nombre },
                  address: {
                    address_line_1: address.direccion,
                    admin_area_2: address.ciudad,
                    postal_code: address.codigoPostal,
                    country_code: "ES",
                  },
                },
              },
            ],
          }),
        onApprove: async (_data: unknown, actions: { order?: { capture: () => Promise<unknown> } }) => {
          await actions.order?.capture();
          onSuccess();
        },
        onError: () => setSdkError(true),
      });

      if (buttons.isEligible()) {
        buttonsRef.current = buttons;
        buttons.render(containerRef.current!);
      } else {
        setSdkError(true);
      }
    } catch {
      setSdkError(true);
    }
  };

  useEffect(() => {
    if (window.paypal) {
      renderButtons();
    } else {
      const existing = document.getElementById("paypal-sdk-script");
      if (existing) {
        existing.addEventListener("load", renderButtons);
      } else {
        const script = document.createElement("script");
        script.id = "paypal-sdk-script";
        script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&currency=EUR`;
        script.async = true;
        script.onload = renderButtons;
        script.onerror = () => setSdkError(true);
        document.body.appendChild(script);
      }
    }
    return () => {
      try { buttonsRef.current?.close(); } catch { /* ignore */ }
      buttonsRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-background/60 p-3 text-sm">
        <p className="font-semibold">{product.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {isRetro(product) ? "Retro" : "Temporada actual"} · Talla {size} · {price} €
        </p>
        <div className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
          <span>
            {address.nombre} · {address.direccion}, {address.codigoPostal} {address.ciudad}, {address.pais}
          </span>
        </div>
      </div>

      {sdkError ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-center text-xs text-destructive">
          Error al cargar PayPal. Comprueba tu conexión e inténtalo de nuevo.
        </p>
      ) : (
        <div ref={containerRef} className="min-h-[50px]">
          <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Cargando PayPal…
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onBack}
        className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
      >
        ← Cambiar dirección de envío
      </button>
    </div>
  );
}

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

  const handleSelect = (v: typeof allVariants[number]) => {
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

  // El producto activo puede ser el base o una variante seleccionada
  const [activeVariant, setActiveVariant] = useState<ProductVariant | null>(null);
  const product = activeVariant
    ? { ...baseProp!, ...activeVariant, variants: baseProp?.variants }
    : baseProp;

  const [step, setStep] = useState<CheckoutStep>("idle");
  const [address, setAddress] = useState<ShippingAddress>({
    nombre: "", direccion: "", ciudad: "", codigoPostal: "", pais: "España",
  });
  const [sizeMode, setSizeMode] = useState<"adulto" | "nino">("adulto");
  const [size, setSize] = useState<string>("");
  const [contact, setContact] = useState<string>("");
  const [contactSent, setContactSent] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setStep("idle");
    setAddress({ nombre: "", direccion: "", ciudad: "", codigoPostal: "", pais: "España" });
    setCurrent(0);
    setSize("");
    setSizeMode("adulto");
    setContact("");
    setContactSent(false);
    setCopied(false);
    setActiveVariant(null);
  }, [baseProp?.url]);

  const shareProduct = useCallback(async () => {
    if (!product) return;
    try {
      await navigator.clipboard.writeText(`¡Mira esto! ${product.url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  }, [product]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["album-images", product?.url],
    queryFn: () => fetchImages({ data: { url: product!.url } }),
    enabled: !!product,
    staleTime: 60 * 60 * 1000,
  });

  const images =
    data?.images && data.images.length > 0
      ? data.images
      : product
        ? [product.image]
        : [];

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

  return (
    <Dialog open={!!baseProp} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl border-border bg-card p-0">
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
                  {copied
                    ? <Check className="h-4 w-4 text-emerald-500" />
                    : <Share2 className="h-4 w-4 text-foreground" />}
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

            {/* Info + checkout */}
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

              {/* Sección de reserva */}
              {canReserve && (
                <div className="mt-5 rounded-lg border border-border bg-background/60 p-4">
                  {step === "idle" && (
                    <>
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
                      <Button
                        onClick={() => setStep("form")}
                        size="lg"
                        className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        <ShoppingBag className="mr-2 h-4 w-4" />
                        Reservar por {price} €
                      </Button>
                    </>
                  )}

                  {step === "form" && (
                    <>
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

                      <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                        <MapPin className="h-4 w-4 text-primary" />
                        Dirección de envío
                      </p>
                      <ShippingForm
                        address={address}
                        onChange={setAddress}
                        canContinue={!!size}
                        onContinue={() => setStep("paypal")}
                      />
                      {!size && (
                        <p className="mt-2 text-center text-[11px] text-muted-foreground">
                          Selecciona una talla para continuar
                        </p>
                      )}
                    </>
                  )}

                  {step === "paypal" && (
                    <PayPalStep
                      product={product}
                      address={address}
                      size={size}
                      onSuccess={() => setStep("success")}
                      onBack={() => setStep("form")}
                    />
                  )}

                  {step === "success" && (
                    <div className="flex flex-col items-center gap-3 py-4 text-center">
                      <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                      <p className="text-lg font-bold">¡Reserva completada!</p>
                      <p className="text-sm text-muted-foreground">
                        Te contactaremos para confirmar el envío a{" "}
                        <span className="font-medium text-foreground">{address.ciudad}</span>.
                      </p>

                      {contactSent ? (
                        <p className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600">
                          ¡Gracias! Te escribiremos pronto a <span className="font-semibold">{contact}</span>.
                        </p>
                      ) : (
                        <div className="mt-2 w-full max-w-sm space-y-2 text-left">
                          <Label htmlFor="contact" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            WhatsApp o email para confirmación
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              id="contact"
                              value={contact}
                              onChange={(e) => setContact(e.target.value)}
                              placeholder="+34 600 000 000 o tu@email.com"
                              className="border-border bg-background text-sm"
                            />
                            <Button
                              type="button"
                              disabled={!contact.trim()}
                              onClick={() => {
                                console.log("[Reserva] confirmación contacto:", {
                                  product: product.title,
                                  size,
                                  address,
                                  contact,
                                });
                                setContactSent(true);
                              }}
                              className="bg-primary text-primary-foreground hover:bg-primary/90"
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
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
