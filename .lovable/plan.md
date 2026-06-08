## Plan

1. **Corregir la lectura de títulos de Yupoo**
   - Mejorar `parseAlbums` para sacar el título aunque Yupoo lo ponga en `title`, `alt`, `data-title`, texto visible o en atributos antes/después del `href`.
   - Esto es clave porque ahora muchos álbumes pueden estar entrando como `Álbum`, y entonces el filtro de fútbol no encuentra palabras como `Barcelona`, `PSG`, `Argentina`, etc.

2. **Hacer el filtro de fútbol más seguro**
   - Mantener la regla: Pan Shirt solo debe mostrar 4 grandes ligas + PSG + selecciones/Mundial.
   - Pero evitar que el filtro borre toda la categoría si el scraper no logra leer títulos útiles.
   - Las chaquetas de fútbol se seguirán excluyendo en `panshirt` con palabras como `jacket`, `chaqueta`, `training`, `anthem`, `windbreaker`, etc.

3. **Separar mejor zapatillas mezcladas en Ropa**
   - Reforzar la detección en `pandaclothes` y `wu769809876` usando título normalizado y URL del álbum.
   - Añadir más señales de zapatillas/modelos si hace falta: `air force`, `force`, `runner`, `trainer`, `sneaker`, `shoe`, `shoes`, `adidas`, `nike`, `campus`, `spezial`, `forum`, `2002r`, `1906r`, `9060`, etc.
   - Si coincide, cambiar `category` a `zapatillas` antes de llegar a la UI.

4. **Mantener el filtro de álbumes con 1 foto sin vaciar catálogos**
   - Seguir descartando `photoCount <= 1` cuando el contador se detecta claramente.
   - Si el contador no es fiable o no aparece, conservar el álbum.

5. **Invalidar caché otra vez**
   - Subir la clave de caché a `yupoo-products-v3` para que no se sigan viendo resultados anteriores.

6. **Verificación**
   - Comprobar que la pestaña **Fútbol** vuelve a tener camisetas.
   - Comprobar que **Ropa** pierde las sneakers detectadas y **Zapatillas** las gana.
   - Confirmar que no se toca UI, favoritos, diseño ni modal.