import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Product, ProductVariant } from "@/lib/yupoo.functions";

const CART_STORAGE_KEY = "vault-cart";

export type CartItem = {
  // id único de línea de carrito: producto + variante + talla, para que un mismo
  // modelo con colores o tallas distintos viva en líneas separadas del carrito
  lineId: string;
  productId: string;
  title: string;
  image: string;
  url: string;
  catalogName: string;
  category: Product["category"];
  variantTitle?: string; // si el usuario eligió una variante (color/versión) distinta a la principal
  size: string; // talla elegida para esta línea (obligatoria: el flujo de fútbol siempre requiere talla)
  price: number;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  addItem: (product: Product, variant: ProductVariant | undefined, size: string, price: number, quantity?: number) => void;
  removeItem: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  isInCart: (productId: string, variantTitle: string | undefined, size: string) => boolean;
};

const CartContext = createContext<CartContextValue | null>(null);

function buildLineId(productId: string, variantTitle: string | undefined, size: string): string {
  return `${productId}__${variantTitle ?? "default"}__${size}`;
}

function loadCartFromStorage(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Migración suave: carritos guardados antes de añadir 'size' no tienen ese
    // campo. Los descartamos en vez de dejar líneas inválidas sin talla, ya
    // que el checkout exige talla por línea.
    return parsed.filter(
      (item): item is CartItem =>
        item && typeof item === "object" && typeof item.size === "string" && item.size.length > 0
    );
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

  const addItem: CartContextValue["addItem"] = (product, variant, size, price, quantity = 1) => {
    const variantTitle = variant?.title;
    const lineId = buildLineId(product.id, variantTitle, size);

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
        size,
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

  const isInCart = (productId: string, variantTitle: string | undefined, size: string) => {
    const lineId = buildLineId(productId, variantTitle, size);
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
