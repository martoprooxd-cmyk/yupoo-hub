/**
 * Búsqueda tolerante a censura, acentos y separadores.
 * Ejemplos que funcionan:
 *   "N*KE" → nike
 *   "A.D.I.D.A.S" → adidas
 *   "N-I-K-E" → nike
 *   "camiséta" → camiseta
 */

export function normalizeQuery(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar tildes/acentos
    .replace(/[*.\-_|]/g, " ")       // separadores → espacio
    .replace(/\s+/g, " ")
    .trim();
}

export function productMatchesQuery(
  p: { title: string; catalogName: string; category: string },
  query: string,
): boolean {
  if (!query.trim()) return true;
  const words = normalizeQuery(query).split(" ").filter(Boolean);
  const haystack = normalizeQuery(`${p.title} ${p.catalogName} ${p.category}`);
  // Todas las palabras del query deben aparecer en el haystack
  return words.every((word) => haystack.includes(word));
}
