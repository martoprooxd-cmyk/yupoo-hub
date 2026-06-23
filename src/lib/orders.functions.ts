import { createServerFn } from "@tanstack/react-start";
import type { OrderProofLine } from "@/lib/orderCode";

// Accedemos a D1 vía request.context.cloudflare.env, que es el patrón
// correcto para TanStack Start + Cloudflare Workers. NO usar
// import { env } from "cloudflare:workers" — ese import solo existe en
// runtime y rompe el build de Vite/Rollup.
function getDb(request: Request) {
  const ctx = (request as unknown as { context?: { cloudflare?: { env?: { DB?: D1Database; ADMIN_PASSWORD?: string } } } }).context;
  const env = ctx?.cloudflare?.env;
  if (!env?.DB) throw new Error("D1 binding 'DB' no configurado. Revisa wrangler.jsonc.");
  return { db: env.DB, adminPassword: env.ADMIN_PASSWORD ?? "" };
}

// Tipos mínimos de D1 para compilación fuera del runtime de Cloudflare.
interface D1Database {
  prepare(query: string): D1PreparedStatement;
}
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<unknown>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  first<T = unknown>(): Promise<T | null>;
}

type OrderStatus = "pending" | "verified" | "shipped";

type OrderRow = {
  code: string;
  created_at: string;
  contact_normalized: string;
  contact_display: string;
  nombre: string;
  direccion: string;
  ciudad: string;
  codigo_postal: string;
  pais: string;
  total_items: number;
  total_price: number;
  lines_json: string;
  status: OrderStatus;
};

export type StoredOrder = {
  code: string;
  createdAt: string;
  contact: string;
  address: {
    nombre: string;
    direccion: string;
    ciudad: string;
    codigoPostal: string;
    pais: string;
  };
  totalItems: number;
  totalPrice: number;
  lines: OrderProofLine[];
  status: OrderStatus;
};

function rowToOrder(row: OrderRow): StoredOrder {
  let lines: OrderProofLine[] = [];
  try {
    const parsed = JSON.parse(row.lines_json);
    if (Array.isArray(parsed)) lines = parsed;
  } catch { lines = []; }
  return {
    code: row.code,
    createdAt: row.created_at,
    contact: row.contact_display,
    address: {
      nombre: row.nombre,
      direccion: row.direccion,
      ciudad: row.ciudad,
      codigoPostal: row.codigo_postal,
      pais: row.pais,
    },
    totalItems: row.total_items,
    totalPrice: row.total_price,
    lines,
    status: row.status,
  };
}

function normalizeContact(contact: string): string {
  return contact.trim().toLowerCase().replace(/\s+/g, "");
}

// ─── Crear pedido ────────────────────────────────────────────────────────────

type CreateOrderInput = {
  code: string;
  contact: string;
  address: {
    nombre: string;
    direccion: string;
    ciudad: string;
    codigoPostal: string;
    pais: string;
  };
  totalItems: number;
  totalPrice: number;
  lines: OrderProofLine[];
};

export const createOrderRecord = createServerFn({ method: "POST" })
  .inputValidator((input: CreateOrderInput) => {
    if (!input?.code || !/^VAULT-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(input.code))
      throw new Error("Código de pedido inválido");
    if (!input.contact?.trim()) throw new Error("Contacto requerido");
    if (!input.address?.nombre || !input.address?.direccion || !input.address?.ciudad)
      throw new Error("Dirección incompleta");
    if (!Array.isArray(input.lines) || input.lines.length === 0)
      throw new Error("El pedido no tiene líneas");
    return input;
  })
  .handler(async ({ data, request }): Promise<{ ok: true }> => {
    const { db } = getDb(request);
    await db
      .prepare(
        `INSERT INTO orders
         (code, created_at, contact_normalized, contact_display, nombre, direccion,
          ciudad, codigo_postal, pais, total_items, total_price, lines_json, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
      )
      .bind(
        data.code,
        new Date().toISOString(),
        normalizeContact(data.contact),
        data.contact.trim(),
        data.address.nombre,
        data.address.direccion,
        data.address.ciudad,
        data.address.codigoPostal,
        data.address.pais,
        data.totalItems,
        data.totalPrice,
        JSON.stringify(data.lines)
      )
      .run();
    return { ok: true };
  });

// ─── Buscar pedidos por contacto (comprador) ─────────────────────────────────

export const getOrdersByContact = createServerFn({ method: "POST" })
  .inputValidator((input: { contact: string }) => {
    if (!input?.contact?.trim()) throw new Error("Contacto requerido");
    return input;
  })
  .handler(async ({ data, request }): Promise<{ orders: StoredOrder[] }> => {
    const { db } = getDb(request);
    const { results } = await db
      .prepare(`SELECT * FROM orders WHERE contact_normalized = ? ORDER BY created_at DESC`)
      .bind(normalizeContact(data.contact))
      .all<OrderRow>();
    return { orders: results.map(rowToOrder) };
  });

// ─── Listar todos (admin) ────────────────────────────────────────────────────

export const getAllOrders = createServerFn({ method: "POST" })
  .inputValidator((input: { password: string }) => {
    if (!input?.password) throw new Error("Contraseña requerida");
    return input;
  })
  .handler(async ({ data, request }): Promise<{ orders: StoredOrder[] }> => {
    const { db, adminPassword } = getDb(request);
    if (!adminPassword) throw new Error("ADMIN_PASSWORD no configurado");
    if (data.password !== adminPassword) throw new Error("Contraseña incorrecta");
    const { results } = await db
      .prepare(`SELECT * FROM orders ORDER BY created_at DESC LIMIT 500`)
      .all<OrderRow>();
    return { orders: results.map(rowToOrder) };
  });

// ─── Actualizar estado (admin) ───────────────────────────────────────────────

export const updateOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { password: string; code: string; status: OrderStatus }) => {
    if (!input?.password) throw new Error("Contraseña requerida");
    if (!input?.code) throw new Error("Código requerido");
    if (!["pending", "verified", "shipped"].includes(input.status))
      throw new Error("Estado inválido");
    return input;
  })
  .handler(async ({ data, request }): Promise<{ ok: true }> => {
    const { db, adminPassword } = getDb(request);
    if (!adminPassword) throw new Error("ADMIN_PASSWORD no configurado");
    if (data.password !== adminPassword) throw new Error("Contraseña incorrecta");
    await db
      .prepare(`UPDATE orders SET status = ? WHERE code = ?`)
      .bind(data.status, data.code)
      .run();
    return { ok: true };
  });
