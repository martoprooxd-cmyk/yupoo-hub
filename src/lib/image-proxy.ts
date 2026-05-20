const IMAGE_PROXY_PATH = "/api/image";

export function proxyImageUrl(src: string): string {
  if (!src || src.startsWith("data:")) return src;
  return `${IMAGE_PROXY_PATH}?url=${encodeURIComponent(src)}`;
}