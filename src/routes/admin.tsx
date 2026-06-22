import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, LogIn, RefreshCw, Package, CheckCircle2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getAllOrders, updateOrderStatus } from "@/lib/orders.functions";
import type { StoredOrder } from "@/lib/orders.functions";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-ES", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

const STATUS_CONFIG: Record<StoredOrder["status"], {
  label: string;
  icon: React.ReactNode;
  next: StoredOrder["status"] | null;
  nextLabel: string | null;
  className: string;
}> = {
  pending:  {
    label: "Pendiente",
    icon: <Package className="h-3 w-3" />,
    next: "verified",
    nextLabel: "Marcar confirmado",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-600",
  },
  verified: {
    label: "Confirmado",
    icon: <CheckCircle2 className="h-3 w-3" />,
    next: "shipped",
    nextLabel: "Marcar enviado",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
  },
  shipped: {
    label: "Enviado",
    icon: <Truck className="h-3 w-3" />,
    next: null,
    nextLabel: null,
    className: "border-blue-500/40 bg-blue-500/10 text-blue-600",
  },
};

function OrderRow({
  order,
  password,
  onStatusChange,
}: {
  order: StoredOrder;
  password: string;
  onStatusChange: (code: string, status: StoredOrder["status"]) => void;
}) {
  const updateStatus = useServerFn(updateOrderStatus);
  const [updating, setUpdating] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const config = STATUS_CONFIG[order.status];

  const handleAdvance = async () => {
    if (!config.next) return;
    setUpdating(true);
    try {
      await updateStatus({ data: { password, code: order.code, status: config.next } });
      onStatusChange(order.code, config.next);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al actualizar estado");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-3 pr-4">
        <p className="font-mono text-xs font-bold text-primary">{order.code}</p>
        <p className="text-[11px] text-muted-foreground">{formatDate(order.createdAt)}</p>
      </td>
      <td className="py-3 pr-4">
        <p className="text-sm font-semibold">{order.address.nombre}</p>
        <p className="text-[11px] text-muted-foreground">{order.contact}</p>
        <p className="text-[11px] text-muted-foreground">
          {order.address.direccion}, {order.address.codigoPostal} {order.address.ciudad}
        </p>
      </td>
      <td className="py-3 pr-4">
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="text-left text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          {order.totalItems} {order.totalItems === 1 ? "producto" : "productos"} · {order.totalPrice.toFixed(0)} €
          {expanded ? " ▲" : " ▼"}
        </button>
        {expanded && (
          <ul className="mt-1 space-y-0.5">
            {order.lines.map((line, i) => (
              <li key={i} className="text-[11px] text-muted-foreground">
                {line.title} · T.{line.size} ×{line.quantity}
              </li>
            ))}
          </ul>
        )}
      </td>
      <td className="py-3 pr-4">
        <Badge variant="outline" className={`flex w-fit items-center gap-1 text-[10px] ${config.className}`}>
          {config.icon}
          {config.label}
        </Badge>
      </td>
      <td className="py-3">
        {config.next && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleAdvance}
            disabled={updating}
            className="text-xs"
          >
            {updating ? <Loader2 className="h-3 w-3 animate-spin" /> : config.nextLabel}
          </Button>
        )}
      </td>
    </tr>
  );
}

function AdminPage() {
  const fetchOrders = useServerFn(getAllOrders);
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<StoredOrder[]>([]);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchOrders({ data: { password } });
      setOrders(result.orders);
      setLoggedIn(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al conectar");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const result = await fetchOrders({ data: { password } });
      setOrders(result.orders);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al refrescar");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (code: string, status: StoredOrder["status"]) => {
    setOrders(prev => prev.map(o => o.code === code ? { ...o, status } : o));
  };

  const counts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (!loggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl">
          <h1 className="mb-6 text-xl font-black tracking-tight">Panel VAULT</h1>
          <div className="space-y-3">
            <div>
              <Label htmlFor="admin-pass" className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Contraseña
              </Label>
              <Input
                id="admin-pass"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="••••••••"
                className="border-border bg-background"
              />
            </div>
            {error && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">{error}</p>
            )}
            <Button onClick={handleLogin} disabled={!password || loading} className="w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
              Entrar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Panel VAULT</h1>
            <p className="text-sm text-muted-foreground">{orders.length} pedidos totales</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              {(["pending", "verified", "shipped"] as const).map(s => (
                <Badge key={s} variant="outline" className={`text-xs ${STATUS_CONFIG[s].className}`}>
                  {STATUS_CONFIG[s].label}: {counts[s] ?? 0}
                </Badge>
              ))}
            </div>
            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">{error}</p>
        )}

        {orders.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground">
            <Package className="mx-auto mb-3 h-10 w-10 opacity-30" />
            <p>Aún no hay pedidos</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="py-3 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Código</th>
                  <th className="py-3 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Comprador</th>
                  <th className="py-3 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pedido</th>
                  <th className="py-3 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Estado</th>
                  <th className="py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border px-4">
                {orders.map(order => (
                  <OrderRow
                    key={order.code}
                    order={order}
                    password={password}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
