## Cambios

### 1. Grid de productos — `loading` eager/lazy (`src/routes/index.tsx`)
- En el `.map((p) => ...)` (línea ~258), recibir también el índice: `filtered.map((p, i) => ...)`.
- En el `<img>` (línea 272) cambiar `loading="lazy"` por `loading={i < 8 ? "eager" : "lazy"}` y añadir `fetchPriority={i < 4 ? "high" : "auto"}`.

### 2. Selector de talla en `ProductModal.tsx`
- Añadir estado `const [size, setSize] = useState<string>("")` y `const [sizeMode, setSizeMode] = useState<"adulto" | "nino">("adulto")` dentro del componente principal.
- Tallas: `ADULT = ["S","M","L","XL","XXL"]`, `KID = ["XS","S","M"]`.
- En el paso `step === "form"`, antes del `ShippingForm`, añadir un bloque con:
  - Toggle "Adulto / Niño" (dos botones tipo pill).
  - Grid de chips de tallas según `sizeMode`; el seleccionado se resalta con `border-primary bg-primary/10`.
- `ShippingForm` recibe nuevo prop `disabled` para que el botón "Continuar al pago" se deshabilite si no hay `size`. Alternativa más limpia: añadir comprobación `!size` en la condición de validez del propio padre y pasar `canContinue` al `ShippingForm`.
- En `PayPalStep`, recibir `size` como prop y añadirlo a:
  - `purchase_units[0].description` → `${product.title} — Talla ${size}`.
  - `purchase_units[0].items` con `name`, `quantity: "1"`, `unit_amount` y `description: "Talla ${size}"` (PayPal muestra items en el resumen).

### 3. Confirmación de pedido en pantalla `success`
- En el bloque `step === "success"` (línea ~579), añadir:
  - Input controlado `contact` (estado nuevo en el padre o local) con `placeholder="WhatsApp o email"`.
  - Botón "Enviar" que: valida no vacío, hace `console.log` con `{ product, size, address, contact }` y muestra un mensaje "¡Gracias! Te escribiremos pronto." (sólo UI, sin backend — no es lo que pide el usuario añadir).
- Mantener el texto existente sobre la ciudad arriba del input.

### 4. SEO og:image (`src/routes/index.tsx`)
- La ruta `/` actualmente no define `head()` propio. Añadirlo:
  ```ts
  import heroImg from "@/assets/hero.jpg"; // ya importado
  export const Route = createFileRoute("/")({
    component: Home,
    head: () => ({
      meta: [
        { property: "og:image", content: heroImg },
        { name: "twitter:image", content: heroImg },
      ],
    }),
  });
  ```
- Importante: ahora mismo `__root.tsx` ya define un `og:image` global (URL de R2). Hay que eliminar `og:image` y `twitter:image` de `__root.tsx` para que el leaf gane, ya que el root concatena en todas las rutas. (Regla TanStack: og:image sólo en leaf).
- `heroImg` resolverá a una URL relativa generada por Vite (`/assets/hero-xxxx.jpg`). Para que WhatsApp/IG lo lean necesitan URL absoluta. Solución pragmática sin server fn: prefijo con `https://yupoo-hub.lovable.app` en el `content`.

### 5. Skeleton shimmer (`src/routes/index.tsx` + `src/styles.css`)
- En `src/styles.css` añadir keyframes y utility:
  ```css
  @keyframes shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
  .skeleton-shimmer {
    background: linear-gradient(90deg,
      color-mix(in oklab, var(--card) 100%, transparent) 0%,
      color-mix(in oklab, var(--muted) 80%, transparent) 50%,
      color-mix(in oklab, var(--card) 100%, transparent) 100%);
    background-size: 200% 100%;
    animation: shimmer 1.6s ease-in-out infinite;
  }
  ```
- Sustituir `animate-pulse ... bg-card` por `skeleton-shimmer` en la línea 243.

### 6. Botón "Compartir" en `ProductModal.tsx`
- Importar `Share2` de `lucide-react`.
- En el header del modal (al lado del botón de favorito, ~línea 445) añadir un botón redondo que:
  - Llama a `navigator.clipboard.writeText(\`¡Mira esta camiseta! ${product.url}\`)`.
  - Cambia icono a `Check` durante 1.5s y muestra `toast` (`useToast` ya disponible vía `@/hooks/use-toast`) con "Enlace copiado".
- Si el producto no es camiseta, usar texto genérico "¡Mira este producto!"; opcional: usar `product.category` para personalizar ("camiseta", "zapatillas", etc.). Por simplicidad: `¡Mira esto! ${product.url}`.

## Resumen archivos tocados
- `src/routes/index.tsx` — loading eager/lazy, head() con og:image, skeleton shimmer class.
- `src/routes/__root.tsx` — eliminar og:image y twitter:image globales.
- `src/components/ProductModal.tsx` — talla, confirmación de contacto, botón compartir, pasar size a PayPal.
- `src/styles.css` — keyframes shimmer + clase utility.