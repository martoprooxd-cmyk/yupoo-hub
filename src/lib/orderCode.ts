/**
 * Genera un código de pedido único y fácil de transcribir a mano (para que el cliente
 * lo copie en el DM de Instagram junto a la foto del producto).
 *
 * Formato: VAULT-XXXX-XXXX donde X son caracteres alfanuméricos en mayúscula,
 * excluyendo caracteres ambiguos (0/O, 1/I/L) para evitar errores al copiarlo.
 *
 * Incluye un dígito de control (checksum) al final derivado del resto del código,
 * así puedes verificar a simple vista (o con verifyOrderCode) que el comprador no
 * escribió mal el código al pasarlo por Instagram.
 */

const SAFE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sin 0,O,1,I,L

function randomSegment(length: number): string {
  let out = "";
  // crypto.getRandomValues está disponible tanto en navegador como en Cloudflare Workers
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    out += SAFE_CHARS[bytes[i] % SAFE_CHARS.length];
  }
  return out;
}

function checksumChar(input: string): string {
  let sum = 0;
  for (let i = 0; i < input.length; i++) {
    sum += input.charCodeAt(i) * (i + 1);
  }
  return SAFE_CHARS[sum % SAFE_CHARS.length];
}

// Snapshot ligero de una línea de pedido para guardarla en el historial: solo
// lo necesario para que el usuario reconozca qué pidió, sin duplicar el tipo
// completo de CartItem aquí (evita acoplar orderCode.ts al carrito).
export type OrderProofLine = {
  title: string;
  size: string;
  variantTitle?: string;
  quantity: number;
  price: number;
};

export type OrderProof = {
  code: string; // p.ej. "VAULT-7K9P-XR2C"
  createdAt: string; // ISO timestamp
  totalItems: number;
  totalPrice: number;
  lines: OrderProofLine[];
};

export function generateOrderCode(): string {
  const seg1 = randomSegment(4);
  const seg2 = randomSegment(3);
  const body = seg1 + seg2;
  const check = checksumChar(body);
  return `VAULT-${seg1}-${seg2}${check}`;
}

/** Verifica que un código tenga el formato y checksum correctos (por si lo quieres validar en un panel admin) */
export function verifyOrderCode(code: string): boolean {
  const match = code.trim().toUpperCase().match(/^VAULT-([A-Z0-9]{4})-([A-Z0-9]{3})([A-Z0-9])$/);
  if (!match) return false;
  const [, seg1, seg2, check] = match;
  const body = seg1 + seg2;
  return checksumChar(body) === check;
}

export function createOrderProof(lines: OrderProofLine[]): OrderProof {
  const totalItems = lines.reduce((sum, l) => sum + l.quantity, 0);
  const totalPrice = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
  return {
    code: generateOrderCode(),
    createdAt: new Date().toISOString(),
    totalItems,
    totalPrice,
    lines,
  };
}
