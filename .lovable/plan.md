## Problema

El deploy falla y el bundler avisa:

```
Ignoring this import because "src/lib/error-capture.ts" was marked as having no side effects
  src/server.ts:1: import "./lib/error-capture";
"sideEffects" is false in the enclosing "package.json"
```

`package.json` tiene `"sideEffects": false`, así que esbuild elimina el import bare de `error-capture.ts`. Ese módulo registra listeners globales (`error`, `unhandledrejection`) en su top-level — al ser eliminado, el server pierde la captura de errores que `server.ts` necesita, y el bundle del Worker termina rompiendo el deploy.

## Fix

Cambiar `package.json`:

```jsonc
"sideEffects": ["src/lib/error-capture.ts", "**/*.css"]
```

Así Vite/esbuild siguen tree-shakeando el resto del código, pero conservan los efectos secundarios de:
- `error-capture.ts` (los listeners globales que `server.ts` necesita)
- los `.css` (Tailwind, `styles.css`)

## Archivos tocados

- `package.json` — cambiar `sideEffects: false` por el array de arriba.

## Lo que NO hago

- Tocar `src/server.ts` ni `error-capture.ts` — la lógica es correcta, sólo necesitan no ser eliminados por tree-shaking.
- Tocar `wrangler.jsonc` ni el resto de la app.
