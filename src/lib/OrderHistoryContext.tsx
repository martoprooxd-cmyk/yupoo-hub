import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { OrderProof } from "@/lib/orderCode";

const ORDER_HISTORY_STORAGE_KEY = "vault-order-history";
const MAX_HISTORY_ENTRIES = 50; // evita que localStorage crezca sin límite con uso prolongado

type OrderHistoryContextValue = {
  orders: OrderProof[];
  addOrder: (proof: OrderProof) => void;
  removeOrder: (code: string) => void;
  clearHistory: () => void;
};

const OrderHistoryContext = createContext<OrderHistoryContextValue | null>(null);

function loadHistoryFromStorage(): OrderProof[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ORDER_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filtrar entradas corruptas/incompletas en vez de dejar que rompan el render
    return parsed.filter(
      (o): o is OrderProof =>
        o &&
        typeof o === "object" &&
        typeof o.code === "string" &&
        typeof o.createdAt === "string" &&
        typeof o.totalItems === "number" &&
        typeof o.totalPrice === "number" &&
        Array.isArray(o.lines)
    );
  } catch {
    return [];
  }
}

export function OrderHistoryProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<OrderProof[]>(() => loadHistoryFromStorage());

  useEffect(() => {
    try {
      window.localStorage.setItem(ORDER_HISTORY_STORAGE_KEY, JSON.stringify(orders));
    } catch {
      // localStorage lleno o no disponible: el historial sigue funcionando en memoria
    }
  }, [orders]);

  const addOrder = (proof: OrderProof) => {
    setOrders((prev) => {
      // Por si acaso ya existiera el mismo código (no debería, pero evita duplicados)
      const withoutDupe = prev.filter((o) => o.code !== proof.code);
      // Más reciente primero, recortado al máximo de entradas
      return [proof, ...withoutDupe].slice(0, MAX_HISTORY_ENTRIES);
    });
  };

  const removeOrder = (code: string) => {
    setOrders((prev) => prev.filter((o) => o.code !== code));
  };

  const clearHistory = () => setOrders([]);

  const value: OrderHistoryContextValue = { orders, addOrder, removeOrder, clearHistory };

  return <OrderHistoryContext.Provider value={value}>{children}</OrderHistoryContext.Provider>;
}

export function useOrderHistory(): OrderHistoryContextValue {
  const ctx = useContext(OrderHistoryContext);
  if (!ctx) {
    throw new Error("useOrderHistory debe usarse dentro de un <OrderHistoryProvider>");
  }
  return ctx;
}
