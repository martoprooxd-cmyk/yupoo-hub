import { useEffect, useRef, useState } from "react";

/**
 * Hook que devuelve si un elemento ha entrado en el viewport.
 * Una vez visible, no vuelve a ocultarse (disconnect automático).
 * Útil para animaciones de entrada en el grid de productos.
 *
 * Genérico en el tipo de elemento para poder usarse directamente como
 * ref={ref} en cualquier elemento (article, div, etc.) sin necesitar
 * castear el tipo con "as", ya que TanStack Router parsea los archivos
 * de rutas con acorn y ese tipo de cast rompe el build.
 */
export function useInView<T extends HTMLElement = HTMLElement>(threshold = 0.1) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect(); // solo disparar una vez
        }
      },
      { threshold },
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, inView };
}
