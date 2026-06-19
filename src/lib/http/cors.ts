import type { Context } from "hono";
import { cors } from "hono/cors";

const GITHUB_PAGES = /^https:\/\/[\w.-]+\.github\.io$/;
const LOCAL_DEV = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (GITHUB_PAGES.test(origin) || LOCAL_DEV.test(origin)) return true;
  if (origin.endsWith(".workers.dev")) return true;
  return false;
}

export function resolveCorsOrigin(origin: string | undefined): string {
  if (!origin) return "*";
  if (isAllowedOrigin(origin)) return origin;
  return "*";
}

export function corsHeaders(origin: string | undefined): Record<string, string> {
  const o = resolveCorsOrigin(origin);
  return {
    "Access-Control-Allow-Origin": o,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-Requested-With, X-App-Id, X-View-As-User",
    "Access-Control-Expose-Headers": "Retry-After, X-Gateway-Service, X-Gateway-Latency-Ms",
    "Access-Control-Max-Age": "86400",
    ...(o !== "*" ? { Vary: "Origin" } : {}),
  };
}

export function handlePreflight(c: Context): Response | null {
  if (c.req.method !== "OPTIONS") return null;
  return new Response(null, { status: 204, headers: corsHeaders(c.req.header("Origin")) });
}

export function jeffCorsMiddleware() {
  return cors({
    origin: (origin) => resolveCorsOrigin(origin),
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allowHeaders: ["Content-Type", "Authorization", "Accept", "X-Requested-With", "X-App-Id", "X-View-As-User"],
    exposeHeaders: ["Retry-After", "X-Gateway-Service", "X-Gateway-Latency-Ms"],
    maxAge: 86400,
  });
}

export function withCors(res: Response, origin: string | undefined): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders(origin))) {
    headers.set(k, v);
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
