## Plan

### 1. Fix build — `onError` en `src/routes/index.tsx`
El cast `as HTMLImageElement` dentro del handler de `onError` rompe el build estricto. Lo reemplazo por la firma tipada que TanStack/React acepta:

```tsx
onError={(e) => {
  const img = e.currentTarget;
  if (!img.dataset.fallback) {
    img.dataset.fallback = "1";
    img.src = "/placeholder.svg";
  }
}}
```

Sin casts, usando `e.currentTarget` (ya tipado como `HTMLImageElement`).

### 2. Activar caché KV — `wrangler.jsonc`
Añadir el binding con tu ID `e990d807bd2d4911aba9cd9d6e0cba8e`:

```jsonc
{
  "name": "yupoo-hub",
  "compatibility_date": "2025-09-24",
  "compatibility_flags": ["nodejs_compat"],
  "main": "src/server.ts",
  "kv_namespaces": [
    { "binding": "YUPOO_KV", "id": "e990d807bd2d4911aba9cd9d6e0cba8e" }
  ]
}
```

El código en `yupoo.functions.ts` ya lee `globalThis.YUPOO_KV` — empezará a cachear automáticamente tras el deploy. Pasamos de 5–10 s a ~200 ms en visitas cacheadas.

> Nota: en preview de Lovable el binding puede no estar disponible; el caché funcionará en producción tras publicar. Ya hay fallback (`if (!kv) return null`) que hace scraping si no existe.

### 3. Performance — eager en primeras 8 imágenes
Ya está implementado en `src/routes/index.tsx` (`loading={i < 8 ? "eager" : "lazy"}` + `fetchPriority`). Verifico que sigue presente; si la versión actual del archivo lo perdió, lo restablezco.

### 4. SEO — `og:image` absoluta en `/`
Ya hay `head()` en `src/routes/index.tsx` con `og:image` apuntando a `hero.jpg`. Verifico que:
- La URL sea **absoluta** (`https://yupoo-hub.lovable.app/...`), no relativa — WhatsApp/IG requieren absoluta.
- El `__root.tsx` no defina `og:image` (sería duplicado, las metas ganan por leaf pero no queremos confusión).

Si la imagen importada vía Vite genera ruta con hash, uso una imagen estática en `public/og-image.jpg` y la referencio como `https://yupoo-hub.lovable.app/og-image.jpg` para estabilidad.

### 5. PayPal — sin Client ID real
Como aún no tienes Client ID:
- Dejo el placeholder pero añado un **aviso visible** en el botón de pago en lugar del botón roto: "PayPal no configurado — contacta para reservar".
- Si `PAYPAL_CLIENT_ID === "TU_PAYPAL_CLIENT_ID_AQUI"`, no se carga el script de PayPal y se muestra el mensaje. Cuando lo tengas, basta con sustituir la constante.

### 6. GitHub — conectar repo
No puedo hacerlo desde aquí. Después de aplicar el plan, te paso las instrucciones:

**Desktop**: botón **+** en el chat (abajo izquierda) → **GitHub** → **Connect project** → autoriza la app y crea el repo.
**Mobile**: botón **+** abajo izquierda (modo Chat) → **GitHub**.

Una vez conectado, todos los cambios se sincronizan automáticamente en ambas direcciones.

## Archivos tocados

- `src/routes/index.tsx` — fix `onError` tipado; verificar eager/lazy y og:image absoluta.
- `src/routes/__root.tsx` — confirmar que no tiene `og:image` duplicado.
- `src/components/ProductModal.tsx` — guard para PayPal sin Client ID.
- `wrangler.jsonc` — añadir binding KV con tu ID.
- `public/og-image.jpg` — copia estática del hero si hace falta para SEO estable.

## Lo que NO hago en este turno
- Mejoras ya implementadas en turnos previos (selector de talla, shimmer, share, contacto post-pago) — verifico que siguen y no las reescribo.
- Setup de PayPal real (esperando tu Client ID).
- Push a GitHub (lo haces tú con el botón).
