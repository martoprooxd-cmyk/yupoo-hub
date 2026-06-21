import { useState } from "react";
import { ClipboardList, X, Copy, Check, Instagram, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrderHistory } from "@/lib/OrderHistoryContext";
import type { OrderProof } from "@/lib/orderCode";

const INSTAGRAM_HANDLE = "tu_proveedor_de_confi";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function OrderRow({ order, onRemove }: { order: OrderProof; onRemove: () => void }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(order.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  const dmText = encodeURIComponent(
    `Hola! Mi pedido es ${order.code} (adjunto foto del producto y captura del pago)`
  );

  return (
    <li className="rounded-md border border-border bg-background/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-sm font-bold tracking-wide text-primary">{order.code}</p>
          <p className="text-[11px] text-muted-foreground">{formatDate(order.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">{order.totalPrice.toFixed(0)} €</span>
          <button
            onClick={onRemove}
            aria-label="Eliminar del historial"
            className="text-muted-foreground transition hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-2 text-left text-[11px] text-muted-foreground underline-offset-2 hover:underline"
      >
        {order.totalItems} {order.totalItems === 1 ? "producto" : "productos"}{" "}
        {expanded ? "▲ ocultar" : "▼ ver detalle"}
      </button>

      {expanded && (
        <ul className="mt-2 space-y-1.5 border-t border-border pt-2">
          {order.lines.map((line, i) => (
            <li key={i} className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate">{line.title}</span>
              <div className="flex shrink-0 items-center gap-1.5">
                <Badge variant="outline" className="border-border text-[9px] text-muted-foreground">
                  T.{line.size}
                </Badge>
                <span className="text-muted-foreground">×{line.quantity}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs"
          onClick={copyCode}
        >
          {copied ? <Check className="mr-1.5 h-3 w-3 text-emerald-500" /> : <Copy className="mr-1.5 h-3 w-3" />}
          {copied ? "Copiado" : "Copiar código"}
        </Button>
        <Button asChild variant="outline" size="sm" className="flex-1 text-xs">
          <a
            href={`https://ig.me/m/${INSTAGRAM_HANDLE}?text=${dmText}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Instagram className="mr-1.5 h-3 w-3" />
            Reenviar
          </a>
        </Button>
      </div>
    </li>
  );
}

export function OrderHistoryDrawer() {
  const [open, setOpen] = useState(false);
  const { orders, removeOrder, clearHistory } = useOrderHistory();

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen(true)}
        aria-label="Historial de pedidos"
      >
        <ClipboardList className="h-4 w-4" />
        {orders.length > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
            {orders.length}
          </span>
        )}
      </Button>

      {open && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <button
            aria-label="Cerrar historial"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />
          <div className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h2 className="text-lg font-black tracking-tight">
                Mis pedidos{orders.length > 0 ? ` (${orders.length})` : ""}
              </h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="grid h-8 w-8 place-items-center rounded-full transition hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {orders.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                  <ClipboardList className="h-10 w-10 opacity-30" />
                  <p className="text-sm">Aún no tienes pedidos</p>
                  <p className="max-w-[200px] text-xs">
                    Cuando completes un pago, tu código de pedido aparecerá aquí
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {orders.map((order) => (
                    <OrderRow key={order.code} order={order} onRemove={() => removeOrder(order.code)} />
                  ))}
                </ul>
              )}
            </div>

            {orders.length > 0 && (
              <div className="border-t border-border p-4">
                <button
                  onClick={clearHistory}
                  className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  Borrar historial
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
