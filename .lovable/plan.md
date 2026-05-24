## Cambios

### 1. Añadir `square` al filtro de nombres genéricos de tamaño

En `src/lib/yupoo.functions.ts`, línea 219, dentro de `parseAlbumImages`, añadir `square` al regex existente:

```diff
- if (/\/(thumb|tiny|small|medium|big|large|origin|full|hd|raw)\.(jpe?g|png|webp|gif)$/i.test(src)) continue;
+ if (/\/(thumb|tiny|small|medium|big|large|origin|full|hd|raw|square)\.(jpe?g|png|webp|gif)$/i.test(src)) continue;
```

Esto descarta también variantes como `/square.jpg` que Yupoo usa como nombre de archivo de tamaño genérico.

### 2. Cambiar estilos de las tarjetas de producto

En `src/routes/index.tsx`, dentro de la grid de productos (líneas ~273 y ~279):

```diff
- <div className="relative aspect-[3/4] overflow-hidden bg-muted">
+ <div className="relative aspect-[3/4] overflow-hidden bg-card">
```

```diff
- className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
+ className="h-full w-full object-contain transition duration-700 group-hover:scale-105"
```

Esto hace que las imágenes se muestren completas (sin recorte) sobre un fondo consistente con la tarjeta.

## Verificación
- Build pasa sin errores TS.
- Preview visual: imágenes completas sin recorte, fondo `bg-card` en contenedor.