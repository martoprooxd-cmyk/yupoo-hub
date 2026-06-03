## Objetivo

Permitirte desplegar la app a **tu propia cuenta de Cloudflare** con `wrangler deploy`, sin romper el deploy actual de Lovable.

## Situación actual

- `wrangler.jsonc` ya apunta a `src/server.ts` y declara el binding KV `YUPOO_KV` (id `e990d807bd2d4911aba9cd9d6e0cba8e`).
- `@cloudflare/vite-plugin` está instalado y genera el bundle del Worker dentro de `dist/` al hacer `vite build`.
- Falta: scripts npm para build + deploy con wrangler, declarar `wrangler` como devDependency, y registrar el secret `FIRECRAWL_API_KEY` en Cloudflare (no se sube en el bundle).

## Cambios

### 1. `package.json` — añadir scripts y dependencia

```jsonc
"scripts": {
  "dev": "vite dev",
  "build": "vite build",
  "build:dev": "vite build --mode development",
  "preview": "vite preview",
  "lint": "eslint .",
  "format": "prettier --write .",
  "cf:deploy": "vite build && wrangler deploy",
  "cf:dev": "vite build && wrangler dev",
  "cf:tail": "wrangler tail"
},
"devDependencies": {
  ...
  "wrangler": "^3.90.0"
}
```

### 2. `wrangler.jsonc` — apuntar al bundle generado

`@cloudflare/vite-plugin` emite el Worker en `dist/_worker.js/index.js` con sus assets estáticos en `dist/client`. Ajustar:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "yupoo-hub",
  "compatibility_date": "2025-09-24",
  "compatibility_flags": ["nodejs_compat"],
  "main": "./dist/_worker.js/index.js",
  "assets": { "directory": "./dist/client", "binding": "ASSETS" },
  "kv_namespaces": [
    { "binding": "YUPOO_KV", "id": "e990d807bd2d4911aba9cd9d6e0cba8e" }
  ],
  "observability": { "enabled": true }
}
```

(Si tras el primer `vite build` la ruta real del Worker es otra, te la ajusto — lo verifico mirando `dist/` antes de cerrar.)

### 3. Documentar el flujo (README breve o instrucciones en chat)

Pasos que tú tienes que ejecutar una vez en tu máquina:

```bash
bun install
bunx wrangler login                                  # abre el navegador
bunx wrangler secret put FIRECRAWL_API_KEY           # te pide la clave
bun run cf:deploy
```

A partir de ahí, cada `bun run cf:deploy` republica a `https://yupoo-hub.<tu-subdominio>.workers.dev`.

## Lo que NO toco

- `src/server.ts`, `src/lib/yupoo.functions.ts`, `vite.config.ts` — ya son compatibles con Workers.
- El deploy de Lovable sigue funcionando igual; este flujo es paralelo.
- El binding KV ya está bien — el mismo id se usa en ambos deploys.

## Riesgos

- Si tu cuenta de Cloudflare no es la dueña del KV `e990d807bd2d4911aba9cd9d6e0cba8e`, `wrangler deploy` fallará y tendrás que crear un KV nuevo (`wrangler kv namespace create YUPOO_KV`) y pegar el id devuelto en `wrangler.jsonc`.
