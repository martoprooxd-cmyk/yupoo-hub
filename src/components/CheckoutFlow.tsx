import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, CheckCircle2, Copy, Check, Instagram, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCart, type CartItem } from "@/lib/CartContext";
import { createOrderProof, type OrderProof, type OrderProofLine } from "@/lib/orderCode";
import { useOrderHistory } from "@/lib/OrderHistoryContext";
import { createOrderRecord } from "@/lib/orders.functions";

const PAYPAL_CLIENT_ID = "TU_PAYPAL_CLIENT_ID_AQUI";
const INSTAGRAM_HANDLE = "tu_proveedor_de_confi";

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

type ShippingAddress = {
  nombre: string;
  contact: string; // email o teléfono: permite recuperar el historial de pedidos desde otro dispositivo
  direccion: string;
  ciudad: string;
  codigoPostal: string;
  pais: string;
};

const EMPTY_ADDRESS: ShippingAddress = {
  nombre: "",
  contact: "",
  direccion: "",
  ciudad: "",
  codigoPostal: "",
  pais: "España",
};

type Step = "address" | "paypal" | "done";

// ─── Formulario de dirección (una sola vez para todo el pedido) ──────────────

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
    address.contact.trim().length >= 6 && // al menos algo parecido a un email/teléfono real
    address.direccion.trim() &&
    address.ciudad.trim() &&
    address.codigoPostal.trim() &&
    address.pais.trim();

  const field = (key: keyof ShippingAddress, label: string, placeholder: string, half = false) => (
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
      {field("contact", "Email o teléfono", "tu@email.com o +34 600 000 000")}
      <p className="-mt-2 text-[11px] text-muted-foreground">
        Lo usamos para que puedas recuperar tus pedidos desde cualquier dispositivo
      </p>
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

// ─── PayPal: cobra el TOTAL del carrito, con un item por línea ───────────────

function PayPalCartStep({
  items,
  totalPrice,
  address,
  onSuccess,
  onBack,
}: {
  items: CartItem[];
  totalPrice: number;
  address: ShippingAddress;
  onSuccess: () => void;
  onBack: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<ReturnType<NonNullable<Window["paypal"]>["Buttons"]> | null>(null);
  const [sdkError, setSdkError] = useState(false);

  if (PAYPAL_CLIENT_ID === "TU_PAYPAL_CLIENT_ID_AQUI") {
    return (
      <div className="space-y-4 p-4">
        <p className="rounded-md border border-border bg-muted/30 p-3 text-center text-xs text-muted-foreground">
          PayPal no está configurado en este entorno. Sustituye PAYPAL_CLIENT_ID en CheckoutFlow.tsx por tu Client ID real.
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
                description: `Pedido VAULT — ${items.length} ${items.length === 1 ? "producto" : "productos"}`,
                amount: {
                  currency_code: "EUR",
                  value: totalPrice.toFixed(2),
                  breakdown: {
                    item_total: { currency_code: "EUR", value: totalPrice.toFixed(2) },
                  },
                },
                items: items.map((item) => ({
                  name: item.title.slice(0, 120),
                  description: `Talla ${item.size}${item.variantTitle ? ` · ${item.variantTitle}` : ""}`,
                  quantity: String(item.quantity),
                  unit_amount: { currency_code: "EUR", value: item.price.toFixed(2) },
                })),
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
      try {
        buttonsRef.current?.close();
      } catch {
        /* ignore */
      }
      buttonsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4 p-4">
      <div className="rounded-md border border-border bg-background/60 p-3 text-sm">
        <p className="font-semibold">
          {items.length} {items.length === 1 ? "producto" : "productos"} · {totalPrice.toFixed(0)} €
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

// ─── Pantalla final: código de pedido + instrucciones de Instagram ───────────

function OrderProofScreen({ proof, saveFailed }: { proof: OrderProof; saveFailed?: boolean }) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(proof.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const dmText = encodeURIComponent(
    `Hola! Quiero confirmar mi pedido ${proof.code} (adjunto foto del producto y captura del pago)`
  );

  return (
    <div className="flex flex-col items-center gap-4 p-6 text-center">
      <CheckCircle2 className="h-12 w-12 text-emerald-500" />
      <div>
        <p className="text-lg font-bold">¡Pago recibido!</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Para confirmar tu reserva, envía este código por Instagram junto con dos imágenes.
        </p>
      </div>

      {saveFailed && (
        <p className="w-full rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-600">
          ⚠️ Guarda este código aparte: no pudimos sincronizarlo con el servidor, así que no podrás
          recuperarlo automáticamente más tarde.
        </p>
      )}

      <div className="w-full rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 p-4">
        <p className="font-mono text-2xl font-black tracking-wider text-primary">{proof.code}</p>
        <button
          type="button"
          onClick={copyCode}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copiado" : "Copiar código"}
        </button>
      </div>

      <ol className="w-full max-w-sm space-y-2 rounded-md border border-border bg-background/60 p-4 text-left text-xs text-muted-foreground">
        <li>1. Copia el código de arriba</li>
        <li>
          2. Haz una <span className="font-semibold text-foreground">foto del producto</span> que has reservado
        </li>
        <li>
          3. Haz una <span className="font-semibold text-foreground">captura de pantalla del pago</span> (el
          email de confirmación de PayPal o el cargo en tu cuenta)
        </li>
        <li>
          4. Envía el código + las 2 imágenes por DM a{" "}
          <span className="font-semibold text-foreground">@{INSTAGRAM_HANDLE}</span>
        </li>
      </ol>

      <p className="text-[11px] text-muted-foreground">
        Sin la foto del producto y la prueba de pago no podemos confirmar tu reserva.
      </p>

      <Button asChild size="lg" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        <a
          href={`https://ig.me/m/${INSTAGRAM_HANDLE}?text=${dmText}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Instagram className="mr-2 h-4 w-4" />
          Abrir DM de Instagram
        </a>
      </Button>

      <p className="text-[11px] text-muted-foreground">
        Pedido: {proof.totalItems} {proof.totalItems === 1 ? "producto" : "productos"} · {proof.totalPrice.toFixed(0)} €
      </p>
    </div>
  );
}

// ─── Componente principal del flujo ───────────────────────────────────────────

export function CheckoutFlow({ onClose, onBack }: { onClose: () => void; onBack: () => void }) {
  const { items, totalPrice, totalItems, clearCart } = useCart();
  const { addOrder } = useOrderHistory();
  const saveOrderRecord = useServerFn(createOrderRecord);
  const [step, setStep] = useState<Step>("address");
  const [address, setAddress] = useState<ShippingAddress>(EMPTY_ADDRESS);
  const [proof, setProof] = useState<OrderProof | null>(null);
  const [serverSaveFailed, setServerSaveFailed] = useState(false);

  const handlePaymentSuccess = async () => {
    // Construir el snapshot de líneas ANTES de vaciar el carrito, ya que
    // clearCart() borra 'items' y necesitamos guardar el detalle en el historial.
    const lines: OrderProofLine[] = items.map((item) => ({
      title: item.title,
      size: item.size,
      variantTitle: item.variantTitle,
      quantity: item.quantity,
      price: item.price,
    }));
    const newProof = createOrderProof(lines);
    setProof(newProof);
    addOrder(newProof); // historial local (localStorage), siempre funciona, no depende de red
    clearCart();
    setStep("done");

    // Guardado en el servidor (D1): permite que TÚ veas todos los pedidos en el
    // panel admin y que el comprador los recupere desde otro dispositivo. Es
    // "best effort": el comprador ya pagó y ya tiene su código en pantalla, así
    // que un fallo de red aquí no debe bloquear ni romper la confirmación.
    try {
      await saveOrderRecord({
        data: {
          code: newProof.code,
          contact: address.contact,
          address: {
            nombre: address.nombre,
            direccion: address.direccion,
            ciudad: address.ciudad,
            codigoPostal: address.codigoPostal,
            pais: address.pais,
          },
          totalItems: newProof.totalItems,
          totalPrice: newProof.totalPrice,
          lines,
        },
      });
    } catch (err) {
      console.error("[VAULT] No se pudo guardar el pedido en el servidor:", err);
      setServerSaveFailed(true);
    }
  };

  // Si el carrito se vacía externamente (p.ej. el usuario borra todo) antes
  // de completar el pago, no tiene sentido seguir en el flujo de checkout.
  if (items.length === 0 && step !== "done") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
        <p className="text-sm">Tu carrito está vacío.</p>
        <button onClick={onBack} className="text-xs text-primary underline-offset-2 hover:underline">
          ← Volver al carrito
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {step === "address" && (
        <div className="p-4">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <MapPin className="h-4 w-4 text-primary" />
            Dirección de envío
          </p>
          <ShippingForm address={address} onChange={setAddress} onContinue={() => setStep("paypal")} />
          <button
            onClick={onBack}
            className="mt-3 w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            ← Volver al carrito
          </button>
        </div>
      )}

      {step === "paypal" && (
        <PayPalCartStep
          items={items}
          totalPrice={totalPrice}
          address={address}
          onSuccess={handlePaymentSuccess}
          onBack={() => setStep("address")}
        />
      )}

      {step === "done" && proof && (
        <>
          <OrderProofScreen proof={proof} saveFailed={serverSaveFailed} />
          <div className="border-t border-border p-4">
            <Button variant="outline" className="w-full" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
