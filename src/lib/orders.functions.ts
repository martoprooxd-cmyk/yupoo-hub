import { createServerFn } from "@tanstack/react-start";
import type { OrderProofLine } from "@/lib/orderCode";

// El binding D1 se importa desde "cloudflare:workers", NO desde process.env.
// Es un binding por-request, así que se accede dentro de cada handler, nunca
// a nivel de módulo (si se intenta fuera del contexto de una request falla).
// Requiere en wrangler.jsonc:
//   "d1_databases": [{ "binding": "DB", "database_name": "...", "database_id": "..." }]
async function getDb() {
  const { env } = await import("cloudflare:workers");
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("D1 binding 'DB' no configurado. Revisa wrangler.jsonc.");
  return db;
}

// Tipos mínimos de D1 (Cloudflare los provee globalmente en producción, pero
// los declaramos aquí para que el proyecto compile también fuera de un
// entorno con @cloudflare/workers-types instalado).
interface D1Database {
  prepare(query: string): D1PreparedStatement;
}
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<unknown>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  first<T = unknown>(): Promise<T | null>;
}

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
  status: "pending" | "verified" | "shipped";
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
  status: "pending" | "verified" | "shipped";
};

function rowToOrder(row: OrderRow): StoredOrder {
  let lines: OrderProofLine[] = [];
  try {
    const parsed = JSON.parse(row.lines_json);
    if (Array.isArray(parsed)) lines = parsed;
  } catch {
    // Si el JSON está corrupto, devolvemos el pedido igualmente con líneas
    // vacías en vez de romper toda la lista por un único registro malo.
    lines = [];
  }
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

// Normaliza el contacto (email o teléfono) para que mayúsculas/espacios no
// generen "personas" distintas en la búsqueda: "Juan@Mail.com" === "juan@mail.com".
function normalizeContact(contact: string): string {
  return contact.trim().toLowerCase().replace(/\s+/g, "");
}

// ─── Crear pedido (llamado al completar el pago en CheckoutFlow) ─────────────

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
    if (!input?.code || !/^VAULT-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(input.code)) {
      throw new Error("Código de pedido inválido");
    }
    if (!input.contact || !input.contact.trim()) {
      throw new Error("Contacto requerido");
    }
    if (!input.address?.nombre || !input.address?.direccion || !input.address?.ciudad) {
      throw new Error("Dirección incompleta");
    }
    if (!Array.isArray(input.lines) || input.lines.length === 0) {
      throw new Error("El pedido no tiene líneas");
    }
    return input;
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const db = await getDb();
    await db
      .prepare(
        `INSERT INTO orders
         (code, created_at, contact_normalized, contact_display, nombre, direccion, ciudad, codigo_postal, pais, total_items, total_price, lines_json, status)
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

// ─── Buscar pedidos del comprador por contacto (recuperar historial en otro dispositivo) ───

export const getOrdersByContact = createServerFn({ method: "POST" })
  .inputValidator((input: { contact: string }) => {
    if (!input?.contact || !input.contact.trim()) throw new Error("Contacto requerido");
    return input;
  })
  .handler(async ({ data }): Promise<{ orders: StoredOrder[] }> => {
    const db = await getDb();
    const { results } = await db
      .prepare(`SELECT * FROM orders WHERE contact_normalized = ? ORDER BY created_at DESC`)
      .bind(normalizeContact(data.contact))
      .all<OrderRow>();
    return { orders: results.map(rowToOrder) };
  });

// ─── Panel admin: listar TODOS los pedidos (requiere contraseña) ─────────────

export const getAllOrders = createServerFn({ method: "POST" })
  .inputValidator((input: { password: string }) => {
    if (!input?.password) throw new Error("Contraseña requerida");
    return input;
  })
  .handler(async ({ data }): Promise<{ orders: StoredOrder[] }> => {
    const { env } = await import("cloudflare:workers");
    const expected = (env as unknown as { ADMIN_PASSWORD?: string }).ADMIN_PASSWORD;
    if (!expected) throw new Error("ADMIN_PASSWORD no configurado en el servidor");
    if (data.password !== expected) throw new Error("Contraseña incorrecta");

    const db = await getDb();
    const { results } = await db
      .prepare(`SELECT * FROM orders ORDER BY created_at DESC LIMIT 500`)
      .all<OrderRow>();
    return { orders: results.map(rowToOrder) };
  });

// ─── Panel admin: actualizar estado de un pedido (pending -> verified -> shipped) ───

export const updateOrderStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { password: string; code: string; status: StoredOrder["status"] }) => {
    if (!input?.password) throw new Error("Contraseña requerida");
    if (!input?.code) throw new Error("Código requerido");
    if (!["pending", "verified", "shipped"].includes(input.status)) {
      throw new Error("Estado inválido");
    }
    return input;
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { env } = await import("cloudflare:workers");
    const expected = (env as unknown as { ADMIN_PASSWORD?: string }).ADMIN_PASSWORD;
    if (!expected) throw new Error("ADMIN_PASSWORD no configurado en el servidor");
    if (data.password !== expected) throw new Error("Contraseña incorrecta");

    const db = await getDb();
    await db.prepare(`UPDATE orders SET status = ? WHERE code = ?`).bind(data.status, data.code).run();
    return { ok: true };
  });
