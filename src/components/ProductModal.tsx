import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useCallback } from "react";
import { ExternalLink, Loader2, ImageOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fetchAlbumImages, type Product } from "@/lib/yupoo.functions";

type Props = {
  product: Product | null;
  onClose: () => void;
};

export function ProductModal({ product, onClose }: Props) {
  const fetchImages = useServerFn(fetchAlbumImages);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  const { data, isLoading, error } = useQuery({
    queryKey: ["album-images", product?.url],
    queryFn: () => fetchImages({ data: { url: product!.url } }),
    enabled: !!product,
    staleTime: 60 * 60 * 1000,
  });

  useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    api.on("select", onSelect);
    return () => { api.off("select", onSelect); };
  }, [api]);

  const images =
    data?.images && data.images.length > 0
      ? data.images
      : product
        ? [product.image]
        : [];

  const scrollTo = useCallback(
    (idx: number) => api?.scrollTo(idx),
    [api]
  );

  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl border-border bg-card p-0">
        {product && (
          <>
            <div className="relative bg-background">
              {isLoading ? (
                <div className="flex aspect-square items-center justify-center sm:aspect-[4/3]">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : error ? (
                <div className="flex aspect-square flex-col items-center justify-center gap-2 text-muted-foreground sm:aspect-[4/3]">
                  <ImageOff className="h-8 w-8" />
                  <p className="text-xs">No se pudieron cargar las imágenes</p>
                  <img
                    src={product.image}
                    alt={product.title}
                    referrerPolicy="no-referrer"
                    className="mt-2 max-h-64 rounded-sm"
                  />
                </div>
              ) : (
                <Carousel className="w-full" setApi={setApi}>
                  <CarouselContent>
                    {images.map((src, i) => (
                      <CarouselItem key={src + i}>
                        <div className="flex aspect-square items-center justify-center bg-background sm:aspect-[4/3]">
                          <img
                            src={src}
                            alt={`${product.title} ${i + 1}`}
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            className="max-h-full max-w-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.opacity = "0.2";
                            }}
                          />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {images.length > 1 && (
                    <>
                      <CarouselPrevious className="left-3" />
                      <CarouselNext className="right-3" />
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-sm bg-background/80 px-2 py-1 font-mono text-[10px] uppercase tracking-wider backdrop-blur">
                        {current + 1} / {images.length}
                      </div>
                    </>
                  )}
                </Carousel>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto border-b border-border bg-card/40 px-6 py-3 scrollbar-thin">
                {images.map((src, i) => (
                  <button
                    key={src + i}
                    type="button"
                    onClick={() => scrollTo(i)}
                    className={`shrink-0 overflow-hidden rounded-sm border transition ${
                      i === current
                        ? "border-primary ring-1 ring-primary"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <img
                      src={src}
                      alt={`Miniatura ${i + 1}`}
                      referrerPolicy="no-referrer"
                      className="h-12 w-12 object-cover sm:h-14 sm:w-14"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}

            <div className="border-t border-border p-6">
              <DialogHeader className="text-left">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/20">
                    {product.catalogName}
                  </Badge>
                  <Badge variant="outline" className="border-border text-muted-foreground">
                    {product.category}
                  </Badge>
                </div>
                <DialogTitle className="text-xl font-black tracking-tight sm:text-2xl">
                  {product.title}
                </DialogTitle>
                <DialogDescription className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  Álbum original de Yupoo
                </DialogDescription>
              </DialogHeader>

              <Button
                asChild
                size="lg"
                className="mt-5 w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <a href={product.url} target="_blank" rel="noopener noreferrer">
                  Abrir álbum original
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
