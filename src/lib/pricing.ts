import type { Product } from "@/lib/yupoo.functions";

export const PRICE_CURRENT = 22;
export const PRICE_RETRO = 25;

export function isFootball(product: Pick<Product, "title" | "catalogName" | "category">): boolean {
  const h = `${product.title} ${product.catalogName} ${product.category}`.toLowerCase();
  return (
    h.includes("futbol") ||
    h.includes("fútbol") ||
    h.includes("football") ||
    h.includes("soccer") ||
    h.includes("jersey") ||
    h.includes("camiseta") ||
    h.includes("panshirt") ||
    h.includes("pan shirt") ||
    (!h.includes("nba") && !h.includes("basket") && product.category === "futbol")
  );
}

export function isRetro(product: Pick<Product, "title" | "catalogName">): boolean {
  const h = `${product.title} ${product.catalogName}`.toLowerCase();
  return (
    h.includes("retro") ||
    h.includes("clásic") ||
    h.includes("clasic") ||
    h.includes("vintage") ||
    h.includes("classic")
  );
}

export function getPrice(product: Pick<Product, "title" | "catalogName">): number {
  return isRetro(product) ? PRICE_RETRO : PRICE_CURRENT;
}

// Extrae un "label de color" del título de una variante respecto al base
// Ejemplo: "Nike Dunk Low Black White" vs base "Nike Dunk Low" → "Black White"
export function variantLabel(baseTitle: string, variantTitle: string): string {
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

  return unique.length > 0 ? unique.slice(0, 3).join(" ") : variantTitle.slice(0, 24);
}

export const ADULT_SIZES = ["S", "M", "L", "XL", "XXL"];
export const KID_SIZES = ["XS", "S", "M"];
