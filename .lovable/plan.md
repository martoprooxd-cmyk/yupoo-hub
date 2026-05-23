# Plan: Añadir normalización de tamaño como nombre de archivo en normalizeImageKey

## Cambio

En `src/lib/yupoo.functions.ts`, dentro de la función `normalizeImageKey`, añadir una línea adicional después del `replace` existente de sufijos de tamaño.

## Detalle técnico

Línea actual (118):
```ts
path = path.replace(/_(?:thumb|small|medium|big|large|origin)\.(jpe?g|png|webp|gif)$/i, ".$1");
```

Añadir justo después:
```ts
path = path.replace(/\/(thumb|tiny|small|medium|big|large|origin|full|hd)(\.jpe?g|\.png|\.webp|\.gif)$/i, "/photo$2");
```

Esto normaliza URLs donde el nombre del archivo ES el tamaño (ej: `/small.jpg`, `/medium.jpg`) convirtiéndolos a `/photo.jpg`, evitando que se traten como imágenes distintas en la deduplicación.

## Verificación
- Build pasa sin errores de TypeScript.
