import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Product, ProductVariant } from "@/lib/yupoo.functions";

const CART_STORAGE_KEY = "vault-cart";

export type CartItem = {
  // id único de línea de carrito: producto + variante (si la hay) para no mezclar colores/tallas distintos
  lineId: string;
  productId: string;
  title: string;
  image: string;
  url: string;
  catalogName: string;
  category: Product["category"];
  variantTitle?: string; // si el usuario eligió una variante (color/versión) distinta a la principal
  price: number;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  addItem: (product: Product, variant: ProductVariant | undefined, price: number, quantity?: number) => void;
  removeItem: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  isInCart: (productId: string, variantTitle?: string) => boolean;
};

const CartContext = createContext<CartContextValue | null>(null);

function loadCartFromStorage(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    // localStorage corrupto o JSON inválido: no romper la app, empezar con carrito vacío
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => loadCartFromStorage());

  useEffect(() => {
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Si localStorage falla (modo privado, cuota llena, etc.) simplemente no persistimos;
      // el carrito sigue funcionando en memoria durante la sesión.
    }
  }, [items]);

  const addItem: CartContextValue["addItem"] = (product, variant, price, quantity = 1) => {
    const variantTitle = variant?.title;
    const lineId = `${product.id}__${variantTitle ?? "default"}`;

    setItems((prev) => {
      const existing = prev.find((i) => i.lineId === lineId);
      if (existing) {
        return prev.map((i) =>
          i.lineId === lineId ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      const newItem: CartItem = {
        lineId,
        productId: product.id,
        title: product.title,
        image: variant?.image ?? product.image,
        url: variant?.url ?? product.url,
        catalogName: product.catalogName,
        category: product.category,
        variantTitle,
        price,
        quantity,
      };
      return [...prev, newItem];
    });
  };

  const removeItem = (lineId: string) => {
    setItems((prev) => prev.filter((i) => i.lineId !== lineId));
  };

  const updateQuantity = (lineId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(lineId);
      return;
    }
    setItems((prev) => prev.map((i) => (i.lineId === lineId ? { ...i, quantity } : i)));
  };

  const clearCart = () => setItems([]);

  const isInCart = (productId: string, variantTitle?: string) => {
    const lineId = `${productId}__${variantTitle ?? "default"}`;
    return items.some((i) => i.lineId === lineId);
  };

  const totalItems = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);
  const totalPrice = useMemo(() => items.reduce((sum, i) => sum + i.price * i.quantity, 0), [items]);

  const value: CartContextValue = {
    items,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    totalItems,
    totalPrice,
    isInCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart debe usarse dentro de un <CartProvider>");
  }
  return ctx;
}
