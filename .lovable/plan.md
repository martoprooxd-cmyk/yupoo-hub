## Diagnóstico

El build sí funciona, pero **no emite `dist/_worker.js/index.js`**. Mira las últimas líneas del log:

```
dist/client/...           (assets estáticos)
dist/server/server.js     (3.87 kB) ← este es el Worker SSR
```

El `@cloudflare/vite-plugin` no se activa en este build (el preset de Lovable lo agrupa con "nitro deploy plugin", que loguea `No Lovable context detected — skipping`). En su lugar, TanStack Start emite el server bundle en `dist/server/server.js`.

`wrangler.jsonc` apuntaba a la ruta equivocada → error `entry-point file at "dist/_worker.js/index.js" was not found`.

## Fix

Apuntar `wrangler.jsonc` al archivo real:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "yupoo-hub",
  "compatibility_date": "2025-09-24",
  "compatibility_flags": ["nodejs_compat"],
  "main": "./dist/server/server.js",
  "assets": { "directory": "./dist/client", "binding": "ASSETS" },
  "kv_namespaces": [
    { "binding": "YUPOO_KV", "id": "e990d807bd2d4911aba9cd9d6e0cba8e" }
  ],
  "observability": { "enabled": true }
}
```

Y actualizar wrangler a la v4 (el propio log lo pide):

```jsonc
// package.json
"devDependencies": {
  ...
  "wrangler": "^4.0.0"
}
```

## Archivos tocados

- `wrangler.jsonc` — cambiar `main` a `./dist/server/server.js`.
- `package.json` — subir `wrangler` a `^4.0.0`.

## Lo que NO hago

- No toco `vite.config.ts` ni intento forzar el plugin de Cloudflare — el bundle que TanStack Start ya emite (`dist/server/server.js`) es un Worker válido y monta `src/server.ts` como entry.
- No cambio `src/server.ts`.

## Riesgos

- Si tras `wrangler deploy` falla con un error sobre `nodejs_compat` o módulos no resueltos, significa que el bundle de TanStack Start necesita el plugin de Cloudflare activo. En ese caso el siguiente paso es activar el plugin manualmente en `vite.config.ts`, pero es mejor probar primero esta versión más simple.
