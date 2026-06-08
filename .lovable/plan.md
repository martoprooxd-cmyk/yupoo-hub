## Plan

### 1. Capturar muchos más productos por catálogo

Hoy `scrapeOne` solo pide la home (`pandashoesx.x.yupoo.com`) y corta a 80 álbumes. Yupoo pagina los álbumes en URLs tipo `?tab=gallery&page=N`, así que solo vemos los primeros.

Cambios en `src/lib/yupoo.functions.ts`:
- En `scrapeOne`, hacer scrape en paralelo de varias páginas por catálogo: `?tab=gallery&page=1..N`.
- N configurable por catálogo (por defecto 4 páginas). Si una página devuelve 0 álbumes nuevos, se corta.
- Deduplicar por URL de álbum entre páginas (ya lo hace `parseAlbums` por página, hay que extender a nivel de catálogo).
- Subir el `slice(0, 80)` a `slice(0, 400)` por catálogo.
- Mantener `Promise.allSettled` para que un fallo de una página no rompa el catálogo.

### 2. Mejorar la detección de zapatillas en catálogos de ropa

El regex actual falla con títulos en chino, abreviaturas y modelos que no incluían keyword. Cambios:

- Ampliar `SNEAKER_KEYWORDS` con: `nike`, `adidas`, `puma`, `reebok`, `under\s?armour`, `ua`, `balenciaga\s?(track|triple|speed)`, `triple\s?s`, `speed\s?trainer`, `track`, `runner`, `mule`, `slide`, `slipper`, `boot`, `boots`, `bota`, `botas`, `clog`, `ozweego`, `prada\s?(americas|cloudbust|monolith)`, `mary\s?jane`, `loafer`, `mocasin`, `cleats`, `botin`, `botines`, `tn`, `vapormax`, `pegasus`, `react`, `cortez`, `blazer`, `terrex`.
- Detectar también por marca + número (`nike 95`, `adidas 350`).
- Aplicar la reclasificación también a `pandashoesx` (por si hay ropa allí) → no, queda como zapatillas. Aplicar también la regla **inversa**: en `pandashoesx`, si el título dice claramente `hoodie/tshirt/jersey/pants/short/jacket`, cambiar a `ropa`.
- Añadir una lista de **keywords de ROPA** para que ganen sobre sneaker en caso de empate (`hoodie, sudadera, tshirt, t-shirt, camiseta (no de fútbol), polo, jersey, sweater, sweatshirt, pants, pantalon, jeans, denim, shorts, bermuda, falda, vestido, dress, skirt, abrigo, coat`). Si una clothing-keyword aparece y NO hay marca-modelo de sneaker fuerte (jordan, dunk, yeezy, samba, etc.), se queda en `ropa`.

### 3. Caché

- Subir `CACHE_KEY` a `yupoo-products-v4` para invalidar el caché viejo.

### 4. Verificación

- ↻ en el header.
- La pestaña **Zapatillas** debería crecer notablemente.
- La pestaña **Fútbol** ya no aparece vacía y tiene más álbumes.
- Ropa pierde sneakers obvias.

## Archivos afectados

- `src/lib/yupoo.functions.ts` — paginación, regex ampliado, bump caché.

UI, favoritos, paleta, modal, image proxy: no se tocan.