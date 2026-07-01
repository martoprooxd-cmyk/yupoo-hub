import { useState } from "react";
import { createPortal } from "react-dom";
import { ShoppingCart, X, Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/lib/CartContext";
import { proxyImageUrl } from "@/lib/image-proxy";
import { CheckoutFlow } from "@/components/CheckoutFlow";

export function CartDrawer() {
  const [open, setOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const { items, totalItems, totalPrice, removeItem, updateQuantity, clearCart } = useCart();

  const close = () => {
    setOpen(false);
    setCheckingOut(false);
  };

  return (
    <>
      {/* Botón del header */}
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen(true)}
        aria-label="Carrito"
      >
        <ShoppingCart className="h-4 w-4" />
        {totalItems > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
            {totalItems}
          </span>
        )}
      </Button>

      {/* Overlay + panel — createPortal a document.body: el header usa
          backdrop-blur, que en varios navegadores crea un "containing block"
          para elementos fixed, anclando el drawer al header en vez de al
          viewport completo. El portal evita ese problema. */}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex justify-end">
            <button
              aria-label="Cerrar carrito"
              onClick={close}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <div className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-xl">
              <div className="flex items-center justify-between border-b border-border p-4">
                <h2 className="text-lg font-black tracking-tight">
                  {checkingOut ? "Finalizar pedido" : `Carrito${totalItems > 0 ? ` (${totalItems})` : ""}`}
                </h2>
                <button
                  onClick={close}
                  aria-label="Cerrar"
                  className="grid h-8 w-8 place-items-center rounded-full transition hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

            {checkingOut ? (
              <CheckoutFlow onClose={close} onBack={() => setCheckingOut(false)} />
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-4">
                  {items.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                      <ShoppingCart className="h-10 w-10 opacity-30" />
                      <p className="text-sm">Tu carrito está vacío</p>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {items.map((item) => (
                        <li
                          key={item.lineId}
                          className="flex gap-3 rounded-md border border-border bg-background/60 p-3"
                        >
                          <img
                            src={proxyImageUrl(item.image)}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            className="h-16 w-16 shrink-0 rounded-sm object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-sm font-bold leading-tight">{item.title}</p>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              <Badge variant="outline" className="border-border text-xs text-muted-foreground">
                                Talla {item.size}
                              </Badge>
                              {item.variantTitle && (
                                <Badge variant="outline" className="border-border text-xs text-muted-foreground">
                                  {item.variantTitle.slice(0, 20)}
                                </Badge>
                              )}
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => updateQuantity(item.lineId, item.quantity - 1)}
                                  aria-label="Reducir cantidad"
                                  className="grid h-6 w-6 place-items-center rounded border border-border transition hover:border-primary"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
                                <button
                                  onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
                                  aria-label="Aumentar cantidad"
                                  className="grid h-6 w-6 place-items-center rounded border border-border transition hover:border-primary"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                              <span className="text-sm font-bold">{(item.price * item.quantity).toFixed(0)} €</span>
                            </div>
                          </div>
                          <button
                            onClick={() => removeItem(item.lineId)}
                            aria-label="Quitar del carrito"
                            className="self-start text-muted-foreground transition hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {items.length > 0 && (
                  <div className="border-t border-border p-4">
                    <div className="mb-3 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total</span>
                      <span className="text-xl font-black">{totalPrice.toFixed(0)} €</span>
                    </div>
                    <Button
                      size="lg"
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => setCheckingOut(true)}
                    >
                      Continuar al pago
                    </Button>
                    <button
                      onClick={clearCart}
                      className="mt-2 w-full text-center text-sm text-muted-foreground underline-offset-2 hover:underline"
                    >
                      Vaciar carrito
                    </button>
                  </div>
                )}
              </>
            )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
