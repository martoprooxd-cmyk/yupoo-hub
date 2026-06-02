/// <reference types="@cloudflare/workers-types" />

interface CloudflareBindings {
  YUPOO_KV: KVNamespace;
  FIRECRAWL_API_KEY: string;
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      FIRECRAWL_API_KEY?: string;
    }
  }
}

declare const YUPOO_KV: KVNamespace | undefined;

export {};
