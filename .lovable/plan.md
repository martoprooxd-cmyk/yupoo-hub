## Objetivo

Limpiar el scraping y endurecer el proxy de imágenes contra fallos. Todo se hace en server, sin tocar la UI ni invalidar los favoritos del usuario.

## 1. Filtrado de productos (`src/lib/yupoo.functions.ts`)

### a) Reclasificar zapatillas dentro de catálogos de ropa
`pandaclothes` y `wu769809876` mezclan sneakers con ropa. Tras parsear, si el título contiene palabras-clave de sneaker, se reasigna `category: "zapatillas"`.

Keywords: `jordan, dunk, sb, air max, air force, af1, yeezy, new balance, nb \d, asics, samba, gazelle, campus, ultra ?boost, nmd, foamposite, kobe, lebron, kd, curry, vans, converse, puma suede, mizuno, salomon, travis`.

### b) Fútbol: solo 4 grandes ligas + PSG + selecciones del Mundial
Para el catálogo `panshirt`, un álbum se conserva **solo** si su título matchea uno de estos grupos. El resto se descarta.

- **Premier**: arsenal, chelsea, liverpool, man utd / manchester united, man city / manchester city, tottenham / spurs, newcastle, west ham, aston villa, brighton, crystal palace, everton, fulham, wolves, brentford, leeds, leicester, nottingham, bournemouth, sheffield, burnley, luton
- **La Liga**: real madrid, barcelona / barca, atletico, atleti, sevilla, valencia, villarreal, betis, athletic (club / bilbao), real sociedad, getafe, osasuna, celta, espanyol, mallorca, girona, rayo, cadiz, granada, las palmas, alaves, almeria
- **Serie A**: juventus / juve, ac milan, milan, inter, napoli, roma, lazio, fiorentina, atalanta, torino, bologna, udinese, sassuolo, genoa, hellas verona, lecce, monza, salernitana, cagliari, empoli, frosinone
- **Bundesliga**: bayern, dortmund / bvb, leipzig, leverkusen, frankfurt, wolfsburg, gladbach, hoffenheim, stuttgart, freiburg, bremen, augsburg, mainz, koln, union berlin, bochum, heidenheim, darmstadt
- **PSG**: psg, paris saint, paris sg
- **Mundial / selecciones**: mundial, world cup, copa del mundo, qatar 2022, 2026, argentina, brasil/brazil, francia/france, españa/spain, alemania/germany, portugal, inglaterra/england, italia/italy, mexico, japan/japon, korea/corea, croatia/croacia, uruguay, colombia, ecuador, peru, chile, paraguay, usa, canada, marruecos/morocco, senegal, ghana, camerun, nigeria, australia, dinamarca, suiza, belgica, holanda, polonia, serbia, gales, ucrania

Las selecciones del Mundial siguen apareciendo en la pestaña **Fútbol** (no se crea categoría nueva).

### c) Excluir chaquetas de fútbol
Aplicado **solo al catálogo `panshirt`** (aclaración: te referías a chaquetas de fútbol, no a las del catálogo Winter). Descarta títulos que contengan: `jacket, chaqueta, abrigo, anorak, windbreaker, cortavientos, bomber, varsity, training jacket, anthem jacket, all weather`.

Winter Clothes y el resto siguen intactos.

### d) Descartar álbumes con ≤1 foto (todos los catálogos)
En `parseAlbums`, leer el contador de fotos de la tarjeta Yupoo (regex sobre el bloque del álbum buscando el span/icon con el número). Si `photoCount <= 1` se descarta. Si el contador no se detecta, **se conserva** (fallback seguro para no vaciar la web).

### e) Invalidar caché KV
Cambiar `CACHE_KEY` de `"yupoo-products-v1"` → `"yupoo-products-v2"` para que el nuevo filtrado se aplique en la próxima petición.

## 2. Arreglar 500 en `/api/public/image` (`src/routes/api/public/image.ts`)

El 500 que ves al pedir `…/panshirt/6199f4bcdc/small.jpg` viene de que cuando Yupoo devuelve 404/timeout o `fetch` lanza una excepción, h3 la convierte en HTTPError 500 sin loguear. Cambios:

- Envolver el `fetch` upstream en `try/catch` y devolver `502` controlado en lugar de dejar propagar.
- Añadir `AbortSignal.timeout(8000)` para que un Yupoo lento no cuelgue el worker.
- En errores controlados, devolver una respuesta `204 No Content` con `Cache-Control: no-store` para que el `<img>` simplemente quede vacío (la UI ya tiene `onError` que baja la opacidad) en vez de romper la página.
- Loguear el error real con `console.error` para que aparezca en los server-function-logs.

## Archivos afectados

- `src/lib/yupoo.functions.ts` — filtros + bump de caché.
- `src/routes/api/public/image.ts` — manejo de errores y timeout.

UI, favoritos, tipografía, paleta, `ProductModal.tsx`, `wrangler.jsonc`, `vite.config.ts` y versiones de paquetes no se tocan.

## Verificación

1. Pulsar ↻ en el header para forzar re-scrape (la nueva clave KV ya invalida la caché vieja).
2. Pestaña **Zapatillas** crece con sneakers que estaban en Ropa.
3. Pestaña **Fútbol** solo muestra equipos de las 4 grandes + PSG + selecciones; sin chaquetas/anorak/bomber.
4. Desaparecen tarjetas que mostraban "1 foto".
5. Las imágenes rotas de Yupoo ya no provocan pantalla en blanco — solo quedan placeholders semi-transparentes.
