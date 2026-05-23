## Cambio

En `src/lib/yupoo.functions.ts`, dentro de `parseAlbumImages`, añadir un filtro justo después de la línea 218 (la que descarta `im_photo_album|avatar|...`).

```ts
if (/\/(thumb|tiny|small|medium|big|large|origin|full|hd|raw)\.(jpe?g|png|webp|gif)$/i.test(src)) continue;
```

Esto descarta variantes cuyo nombre de archivo es un tamaño genérico (`/small.jpg`, `/medium.jpg`, etc.) y conserva solo las URLs con hash único.

## Verificación
- Build pasa sin errores TS.