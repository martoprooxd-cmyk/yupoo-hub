## Objetivo

Rediseño visual al máximo manteniendo TODA la funcionalidad. Sin cambiar versiones de paquetes existentes. Aplico la dirección **Neo-industrial** elegida con la paleta **Midnight Indigo** + tipografía **Space Grotesk / DM Sans**.

## Cambios

### 1. `src/styles.css` — Tokens y fuentes
- Añadir imports de `@fontsource/space-grotesk` y `@fontsource/dm-sans` (ya instalados, sin tocar versiones existentes).
- Reemplazar paleta verde por **Midnight Indigo**:
  - `--background: oklch(0.10 0.04 280)` (≈ #0a0a1a)
  - `--card: oklch(0.18 0.07 275)` (≈ #141432)
  - `--secondary/muted/accent: oklch(0.22 0.09 275)` (≈ #1e1e5a)
  - `--primary: oklch(0.58 0.24 275)` (≈ #4f46e5 indigo)
  - `--ring`, `--sidebar-*`, chart-1 alineados al índigo
  - `--glow: 0 0 40px oklch(0.58 0.24 275 / 0.45)`
- Registrar `--font-sans: "DM Sans"...` y `--font-display: "Space Grotesk"...` en `@theme inline` (genera `font-sans` y `font-display`).
- Aplicar `font-family: var(--font-sans)` en body.
- Mantener `.light` recalibrado a indigo (primary indigo en lugar de verde).

### 2. `src/routes/index.tsx` — UI Neo-industrial
Sin tocar lógica (queries, favoritos, filtros, modal, refresh, tema). Sólo presentación:
- Headings con `font-display` (Space Grotesk) `italic` + tracking apretado.
- Section markers `01 /` `02 /` con **borde izquierdo índigo** `border-l-2 border-primary pl-6`.
- Filtros como **pills `rounded-full`** con scroll horizontal y separador vertical antes de Favoritos (favoritos en acento rosa/destructive ligero).
- Sticky de filtros bajo el header (`top-[64px] backdrop-blur`).
- Tarjetas de catálogo con CTA circular grande (flecha rotada -45°, fondo índigo al hover).
- FAB Instagram con gradiente real (`from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]`) en lugar de borde índigo.
- Skeletons en `aspect-[3/4]` con `skeleton-shimmer` (ya existe).
- Glow índigo bajo el hero (radial blur).

### 3. Funcionalidad — sin cambios
- Mantengo `fetchAllProducts`, server fn, queries, localStorage favs, toggle tema, modal, proxy de imágenes, FAB Instagram URL.
- No toco categorías, catálogos, ni IDs.
- No actualizo versiones existentes en `package.json`.

## Lo que NO toco
- `package.json` versiones existentes (sólo deps nuevas ya añadidas: `@fontsource/space-grotesk`, `@fontsource/dm-sans`).
- `vite.config.ts`, `wrangler.jsonc`, server functions, routing.
- `ProductModal.tsx`.
