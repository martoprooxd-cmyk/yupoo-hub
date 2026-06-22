import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Search, Loader2, Copy, Check, Instagram, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getOrdersByContact } from "@/lib/orders.functions";
import { useOrderHistory } from "@/lib/OrderHistoryContext";
import type { StoredOrder } from "@/lib/orders.functions";

const INSTAGRAM_HANDLE = "tu_proveedor_de_confi";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-ES", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

const STATUS_LABELS: Record<StoredOrder["status"], { label: string; className: string }> = {
  pending:  { label: "Pendiente", className: "border-amber-500/40 bg-amber-500/10 text-amber-600" },
  verified: { label: "Confirmado", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600" },
  shipped:  { label: "Enviado",    className: "border-blue-500/40 bg-blue-500/10 text-blue-600" },
};

function OrderCard({ order }: { order: StoredOrder }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const status = STATUS_LABELS[order.status];
  const dmText = encodeURIComponent(
    `Hola! Mi pedido es ${order.code} (adjunto foto del producto y captura del pago)`
  );

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(order.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* ignore */ }
  };

  return (
    <li className="rounded-md border border-border bg-background/60 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-sm font-bold tracking-wide text-primary">{order.code}</p>
          <p className="text-[11px] text-muted-foreground">{formatDate(order.createdAt)}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-sm font-bold">{order.totalPrice.toFixed(0)} €</span>
          <Badge variant="outline" className={`text-[10px] ${status.className}`}>{status.label}</Badge>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="mt-2 text-left text-[11px] text-muted-foreground underline-offset-2 hover:underline"
      >
        {order.totalItems} {order.totalItems === 1 ? "producto" : "productos"} {expanded ? "▲ ocultar" : "▼ ver"}
      </button>

      {expanded && (
        <ul className="mt-2 space-y-1 border-t border-border pt-2">
          {order.lines.map((line, i) => (
            <li key={i} className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate">{line.title}</span>
              <div className="flex shrink-0 items-center gap-1.5">
                <Badge variant="outline" className="border-border text-[9px] text-muted-foreground">T.{line.size}</Badge>
                <span className="text-muted-foreground">×{line.quantity}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={copyCode}>
          {copied ? <Check className="mr-1.5 h-3 w-3 text-emerald-500" /> : <Copy className="mr-1.5 h-3 w-3" />}
          {copied ? "Copiado" : "Copiar código"}
        </Button>
        <Button asChild variant="outline" size="sm" className="flex-1 text-xs">
          <a href={`https://ig.me/m/${INSTAGRAM_HANDLE}?text=${dmText}`} target="_blank" rel="noopener noreferrer">
            <Instagram className="mr-1.5 h-3 w-3" />
            Reenviar
          </a>
        </Button>
      </div>
    </li>
  );
}

export function RecoverOrdersPanel() {
  const fetchOrders = useServerFn(getOrdersByContact);
  const { addOrder } = useOrderHistory();
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<StoredOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!contact.trim()) return;
    setLoading(true);
    setError(null);
    setOrders(null);
    try {
      const result = await fetchOrders({ data: { contact } });
      setOrders(result.orders);
      // Sincronizar con localStorage para que queden en el panel de historial local
      result.orders.forEach(order => {
        addOrder({
          code: order.code,
          createdAt: order.createdAt,
          totalItems: order.totalItems,
          totalPrice: order.totalPrice,
          lines: order.lines,
        });
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al buscar pedidos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="recover-contact" className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Tu email o teléfono
        </Label>
        <div className="flex gap-2">
          <Input
            id="recover-contact"
            value={contact}
            placeholder="tu@email.com o +34 600 000 000"
            onChange={e => setContact(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            className="border-border bg-background text-sm"
          />
          <Button onClick={handleSearch} disabled={!contact.trim() || loading} className="shrink-0">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Usa el mismo dato que introdujiste al pagar
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">{error}</p>
      )}

      {orders !== null && (
        orders.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
            <ClipboardList className="h-8 w-8 opacity-30" />
            <p className="text-sm">No encontramos pedidos con ese contacto</p>
            <p className="text-xs">Comprueba que sea exactamente el mismo dato que usaste al pagar</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map(order => <OrderCard key={order.code} order={order} />)}
          </ul>
        )
      )}
    </div>
  );
}
