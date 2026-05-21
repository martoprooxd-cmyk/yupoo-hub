# Plan

## Objetivo

Instalar `@paypal/react-paypal-js` y limpiar el catálogo para que no aparezcan productos/imágenes repetidas o fragmentadas como si fueran productos distintos.

## Cambios propuestos

1. Instalar el paquete npm `@paypal/react-paypal-js`.
2. Mejorar el parser de Yupoo para normalizar URLs e imágenes antes de guardarlas.
3. Deduplicar productos por álbum real, imagen principal normalizada y título normalizado.
4. Deduplicar imágenes dentro del modal/carrusel para que una misma foto no salga varias veces con variantes `_thumb`, `_small`, `_medium` u otros parámetros.
5. Mantener el comportamiento actual de búsqueda, filtros, favoritos, proxy de imágenes y modal.

## Detalles técnicos

- La deduplicación se hará en `src/lib/yupoo.functions.ts`, antes de devolver productos e imágenes al frontend.
- Se conservará una única tarjeta por álbum/producto cuando Yupoo devuelva duplicados.
- En el modal se mantendrá el orden original de las fotos, pero eliminando repetidas normalizadas.
- No se añadirá todavía checkout ni botones de PayPal; solo se instalará el paquete y se corregirá el catálogo duplicado.

## Verificación

- Revisar que el paquete quede en `package.json`.
- Comprobar que la cuadrícula muestra menos duplicados.
- Comprobar que el carrusel no repite miniaturas/fotos del mismo álbum.