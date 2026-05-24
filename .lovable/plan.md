## Cambios

### 1. `src/routes/__root.tsx` — título y descripción
- `title`, `og:title`, `twitter:title`: `"VAULT — Yupoo Catalog Hub"`
- `description`, `og:description`, `twitter:description`: `"Catálogo unificado de Yupoo. Zapatillas, ropa, camisetas de fútbol, ropa de invierno y accesorios."`

### 2. `src/routes/index.tsx` — eliminar sección Password
- Borrar la constante `PASSWORD`.
- Borrar la función `copyPass`.
- Borrar el enlace `<a href="#password">Password</a>` del nav.
- Borrar la `<section id="password">` completa.
- Quitar imports ya no usados: `Copy`, `Check` de `lucide-react`.

### 3. `src/routes/index.tsx` — footer
- Eliminar el `<p>` con `"Powered by Firecrawl"` (incluye el spinner `Loader2`).
- Quitar import `Loader2` si queda sin uso.

### 4. Ocultar badge "Edit with Lovable"
- Llamar a `publish_settings--set_badge_visibility` con `hide_badge: true`. Requiere plan Pro; si falla, avisar al usuario.

### 5. Botón flotante de Instagram
- En `src/routes/index.tsx`, añadir un `<a>` fijo (`fixed bottom-6 right-6 z-50`), redondo, con borde primario y glow del tema, enlazando a `https://www.instagram.com/tu_proveedor_de_confi` con `target="_blank" rel="noopener noreferrer"`.
- `lucide-react` no exporta icono Instagram → usar SVG inline (logo oficial simplificado) con `aria-label="Instagram"`.

## Notas técnicas
- Los favoritos ya existían y se mantienen intactos.
- No se tocan rutas, loaders ni server functions.