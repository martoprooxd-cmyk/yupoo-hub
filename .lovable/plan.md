# Plan

## Diagnóstico (dos bugs confirmados)

### Bug 1 — Las imágenes no cargan: el proxy está protegido por auth

`/api/image` en el preview devuelve **302 → auth-bridge** (Lovable bloquea todas las rutas que no estén bajo `/api/public/*` en los sitios desplegados). Por eso ninguna `<img>` se ve: el navegador sigue el redirect a una página HTML de login en vez de recibir bytes de imagen.

### Bug 2 — Sólo aparece 1 producto por catálogo

`parseAlbums` no consigue extraer el título real de los álbumes y todos terminan como `"Álbum"`. Luego `dedupeProducts` hace:

```ts
const titleKey = `${p.catalog}::${normalizeTitleKey(p.title)}`;
if (titleKey.length > 10 && seenTitle.has(titleKey)) continue;
```

`"panshirt::album"` mide >10 chars → el segundo producto en adelante se descarta. Resultado: 1 por catálogo (justo lo que muestra la network response actual: 4 productos).

Además los `href` capturados llevan `&amp;` sin decodificar, lo que ensucia las URLs guardadas.

## Cambios

1. **Mover el proxy** de `src/routes/api/image.ts` → `src/routes/api/public/image.ts`. La ruta pública (`/api/public/image`) no pasa por el auth-bridge del preview/publicado. Actualizar `src/lib/image-proxy.ts` para apuntar a `/api/public/image`.

2. **Arreglar `parseAlbums`** en `src/lib/yupoo.functions.ts`:
   - Decodificar entidades HTML (`&amp;`, `&#x2F;`…) en `href` e `image`.
   - Buscar el título también en `album__main_title` y en `title="…"` aunque venga dentro de un `<h3>`/`<span>` interno antes de caer en `"Álbum"`.

3. **Arreglar `dedupeProducts`**:
   - No deduplicar por título cuando el título es genérico (`"album"`, vacío, solo dígitos, < ~3 palabras significativas).
   - Mantener la dedupe estricta por `urlKey` (siempre) y por `imgKey` (siempre).
   - Así dejan de colapsarse 80 álbumes con título por defecto en uno solo.

4. **Verificar** con `curl` que `/api/public/image?url=…` devuelve `200 image/jpeg` y revisar en el preview que vuelven a aparecer todos los productos del catálogo y todas las miniaturas del modal.

## Lo que NO cambia

- Lógica de reservas / precios 22€-25€.
- Carrusel, pre-carga de miniaturas, sincronización del thumbnail activo.
- Parser de imágenes del álbum (`parseAlbumImages`) ni `normalizeImageKey`.
- Filtros, búsqueda, favoritos, instalación de `@paypal/react-paypal-js`.
