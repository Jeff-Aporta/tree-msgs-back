import type { Context, Env, Hono } from "hono";
import { withCors } from "../http/cors.js";

export type AuthProxyEnv = { SYSTEM_LOGIN_URL?: string };

const SYSTEM_LOGIN_URL_PROD = "https://system-login.jeffaporta.workers.dev";
const SYSTEM_LOGIN_URL_LOCAL = "http://localhost:8781";

export function resolveSystemLoginBase(env: AuthProxyEnv | undefined, requestUrl: string): string {
  const fromEnv = env?.SYSTEM_LOGIN_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  try {
    const host = new URL(requestUrl).hostname;
    if (host === "localhost" || host === "127.0.0.1") return SYSTEM_LOGIN_URL_LOCAL;
  } catch {
    /* ignore */
  }
  return SYSTEM_LOGIN_URL_PROD;
}

async function forwardAuthPost(c: Context, path: string): Promise<Response> {
  const env = c.env as AuthProxyEnv | undefined;
  const base = resolveSystemLoginBase(env, c.req.url);
  const body = await c.req.text();
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": c.req.header("Content-Type") || "application/json",
      Accept: "application/json",
    },
    body,
  });
  const text = await res.text();
  const headers = new Headers();
  const ct = res.headers.get("Content-Type");
  if (ct) headers.set("Content-Type", ct);
  return withCors(new Response(text, { status: res.status, headers }), c.req.header("Origin"));
}

export function mountAuthProxy<E extends Env = Env>(app: Hono<E>): void {
  app.post("/auth/token", (c) => forwardAuthPost(c, "/api/auth/token"));
  app.post("/auth/test-token", (c) => forwardAuthPost(c, "/api/auth/test-token"));
}
