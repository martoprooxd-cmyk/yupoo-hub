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
import { fetchAlbumImages, type Product } from "@/lib/yupoo.functions";
import { proxyImageUrl } from "@/lib/image-proxy";

// PayPal config
// Cambia esto por tu Client ID real de PayPal (sandbox o live)
// Panel PayPal → Apps & Credentials → Tu app → Client ID
const PAYPAL_CLIENT_ID = "TU_PAYPAL_CLIENT_ID_AQUI";

const PRICE_CURRENT = 22; // € temporada actual
const PRICE_RETRO = 25;   // € retro / clásica

// Tipos

type ShippingAddress = {
  nombre: string;
  direccion: string;
  ciudad: string;
  codigoPostal: string;
  pais: string;
};

type CheckoutStep = "idle" | "form" | "paypal" | "success";

// Declaración global para el SDK de PayPal (cargado por script)
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

// Helpers

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
    // Excluir explícitamente NBA / baloncesto
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

const ADULT_SIZES = ["S", "M", "L", "XL", "XXL"];
const KID_SIZES = ["XS", "S", "M"];

//  Sub-componente: formulario de dirección

function ShippingForm({
  address,
  onChange,
  onContinue,
}: {
  address: ShippingAddress;
  onChange: (a: ShippingAddress) => void;
  onContinue: () => void;
}) {
  const isValid =
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

// Sub-componente: paso PayPal (sin npm, usa SDK por script)

function PayPalStep({
  product,
  address,
  onSuccess,
  onBack,
}: {
  product: Product;
  address: ShippingAddress;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const price = getPrice(product);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<ReturnType<NonNullable<Window["paypal"]>["Buttons"]> | null>(null);
  const [sdkError, setSdkError] = useState(false);

  const renderButtons = useCallback(() => {
    if (!containerRef.current || !window.paypal) return;

    // Limpiar botones anteriores
    containerRef.current.innerHTML = "";

    try {
      const buttons = window.paypal.Buttons({
        style: { layout: "vertical", color: "gold", shape: "rect", label: "pay" },
        createOrder: (_data: unknown, actions: {
          order: { create: (o: object) => Promise<string> };
        }) =>
          actions.order.create({
            intent: "CAPTURE",
            purchase_units: [
              {
                description: product.title,
                amount: {
                  currency_code: "EUR",
                  value: price.toFixed(2),
                },
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
        onApprove: async (_data: unknown, actions: {
          order?: { capture: () => Promise<unknown> };
        }) => {
          await actions.order?.capture();
          onSuccess();
        },
        onError: () => setSdkError(true),
      });

      if (buttons.isEligible()) {
        buttonsRef.current = buttons;
        buttons.render(containerRef.current);
      } else {
        setSdkError(true);
      }
    } catch {
      setSdkError(true);
    }
  }, [product, address, price, onSuccess]);

  useEffect(() => {
    // Si el SDK ya está cargado, renderizar directamente
    if (window.paypal) {
      renderButtons();
    } else {
      // Cargar el SDK de PayPal por script (sin npm)
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
      // Limpiar botones al desmontar
      try { buttonsRef.current?.close(); } catch { /* ignore */ }
      buttonsRef.current = null;
    };
  }, [renderButtons]);

  return (
    <div className="space-y-4">
      {/* Resumen del pedido */}
      <div className="rounded-md border border-border bg-background/60 p-3 text-sm">
        <p className="font-semibold">{product.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {isRetro(product) ? "Retro" : "Temporada actual"} · {price} €
        </p>
        <div className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
          <span>
            {address.nombre} · {address.direccion}, {address.codigoPostal}{" "}
            {address.ciudad}, {address.pais}
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

// Componente principal

type Props = {
  product: Product | null;
  onClose: () => void;
  isFav: boolean;
  onToggleFav: (id: string) => void;
};

export function ProductModal({ product, onClose, isFav, onToggleFav }: Props) {
  const fetchImages = useServerFn(fetchAlbumImages);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  // Estado del checkout
  const [step, setStep] = useState<CheckoutStep>("idle");
  const [address, setAddress] = useState<ShippingAddress>({
    nombre: "",
    direccion: "",
    ciudad: "",
    codigoPostal: "",
    pais: "España",
  });

  // Resetear al cambiar de producto o cerrar
  useEffect(() => {
    setStep("idle");
    setAddress({ nombre: "", direccion: "", ciudad: "", codigoPostal: "", pais: "España" });
    setCurrent(0);
  }, [product?.url]);

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

  // Precargar imágenes del álbum en cuanto llegan
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

  // Sincronizar miniatura activa con el carrusel
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

  // Auto-scroll de la tira de miniaturas
  const thumbsRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const strip = thumbsRef.current;
    if (!strip) return;
    const active = strip.querySelector<HTMLButtonElement>(
      `button[data-thumb-idx="${current}"]`
    );
    active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [current]);

  const scrollTo = useCallback((idx: number) => api?.scrollTo(idx), [api]);

  const canReserve = product ? isFootball(product) : false;
  const price = product ? getPrice(product) : 0;

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl border-border bg-card p-0">
        {product && (
          <>
            {/*  Carrusel  */}
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
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.opacity = "0.2";
                            }}
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

              {/* Botón favorito sobre el carrusel */}
              <button
                onClick={() => onToggleFav(product.id)}
                aria-label={isFav ? "Quitar de favoritos" : "Añadir a favoritos"}
                className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-background/80 shadow backdrop-blur transition hover:bg-background"
              >
                <Heart
                  className={`h-4 w-4 transition ${
                    isFav ? "fill-primary text-primary" : "text-foreground"
                  }`}
                />
              </button>
            </div>

            {/* ── Miniaturas ── */}
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
              ) : data && (!data.images || data.images.length === 0) ? (
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <ImageOff className="h-3 w-3" />
                  Sin imágenes detectadas
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

            {/* ── Info + checkout ── */}
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
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                    >
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

              {/* Sección de reserva (solo fútbol) */}
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
                      <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                        <MapPin className="h-4 w-4 text-primary" />
                        Dirección de envío
                      </p>
                      <ShippingForm
                        address={address}
                        onChange={setAddress}
                        onContinue={() => setStep("paypal")}
                      />
                    </>
                  )}

                  {step === "paypal" && (
                    <PayPalStep
                      product={product}
                      address={address}
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
