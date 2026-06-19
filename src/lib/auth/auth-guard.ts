import type { MiddlewareHandler } from "hono";

export type AuthGuardEnv = {
  LAB_JWT_SECRET: string;
  SYSTEM_LOGIN_URL?: string;
  SYSTEM_LOGIN_SVC?: Fetcher;
};

function systemLoginBase(env: AuthGuardEnv): string {
  let base = (env.SYSTEM_LOGIN_URL || "https://system-login.jeffaporta.workers.dev").replace(/\/$/, "");
  if (base.endsWith("/api")) base = base.slice(0, -4);
  return base;
}

async function fetchSystemLogin(env: AuthGuardEnv, apiPath: string, init: RequestInit): Promise<Response> {
  const path = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  const outbound = new Request(`${systemLoginBase(env)}${path}`, init);
  const binding = env.SYSTEM_LOGIN_SVC;
  if (binding) {
    const bound = await binding.fetch(outbound);
    if (bound.ok) return bound;
    if (bound.status !== 404 && bound.status !== 502 && bound.status !== 503) return bound;
  }
  return fetch(outbound);
}

const SKIP_PREFIXES = ["/api/auth/", "/api/doc", "/api/ui"];

function normalizePath(path: string): string {
  const p = path.trim();
  if (!p) return "/";
  const withSlash = p.startsWith("/") ? p : `/${p}`;
  return withSlash.endsWith("/") && withSlash.length > 1 ? withSlash.slice(0, -1) : withSlash;
}

function shouldSkip(path: string): boolean {
  return SKIP_PREFIXES.some((p) => path === p || path.startsWith(p));
}

function isTreeMsgsPath(path: string): boolean {
  return path === "/api/tree-msgs" || path.startsWith("/api/tree-msgs/");
}

export function bearerToken(header?: string): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

export async function requireAuth(
  env: AuthGuardEnv,
  header?: string,
): Promise<{ username: string } | Response> {
  const token = bearerToken(header);
  if (!token) {
    return Response.json({ ok: false, error: "Authorization Bearer requerido" }, { status: 401 });
  }
  try {
    const { jwtVerify } = await import("jose");
    const { payload } = await jwtVerify(token, new TextEncoder().encode(env.LAB_JWT_SECRET), {
      algorithms: ["HS256"],
    });
    const username = String(payload.sub || payload.username || "");
    if (!username) throw new Error("JWT sin subject");
    return { username };
  } catch {
    return Response.json({ ok: false, error: "Token inválido o expirado" }, { status: 401 });
  }
}

export async function verifyAccess(
  env: AuthGuardEnv,
  header: string | undefined,
  method: string,
  apiPath: string,
  appId?: string | null,
  viewAsUser?: string | null,
): Promise<{ username: string; allowed: boolean } | Response> {
  const m = method.toUpperCase();
  const path = normalizePath(apiPath);

  if (shouldSkip(path)) {
    return { username: "", allowed: true };
  }

  if (!isTreeMsgsPath(path)) {
    return { username: "", allowed: true };
  }

  const auth = await requireAuth(env, header);
  if (auth instanceof Response) return auth;

  try {
    const res = await fetchSystemLogin(env, "/api/auth/verify-access", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(header ? { Authorization: header } : {}),
        ...(appId?.trim() ? { "X-App-Id": appId.trim() } : {}),
        ...(viewAsUser?.trim() ? { "X-View-As-User": viewAsUser.trim() } : {}),
      },
      body: JSON.stringify({
        method: m,
        path,
        ...(appId?.trim() ? { app: appId.trim() } : {}),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      allowed?: boolean;
      username?: string;
      error?: string;
    };
    if (!res.ok || !data.ok) {
      return Response.json(
        { ok: false, error: data.error || "Verificación de permisos fallida", method: m, path },
        { status: res.status >= 400 ? res.status : 403 },
      );
    }
    if (!data.allowed) {
      return Response.json(
        { ok: false, error: "Sin permiso para este endpoint", method: m, path, username: data.username || auth.username },
        { status: 403 },
      );
    }
    return { username: data.username || auth.username, allowed: true };
  } catch {
    return Response.json({ ok: false, error: "Servicio de auth no disponible" }, { status: 503 });
  }
}

export function apiAuthGuard<E extends AuthGuardEnv>(): MiddlewareHandler<{ Bindings: E; Variables: { authUser?: string } }> {
  return async (c, next) => {
    const path = normalizePath(new URL(c.req.url).pathname);
    if (shouldSkip(path) || !isTreeMsgsPath(path)) return next();

    const result = await verifyAccess(
      c.env,
      c.req.header("authorization"),
      c.req.method,
      path,
      c.req.header("X-App-Id") ?? c.req.query("app"),
      c.req.header("X-View-As-User"),
    );
    if (result instanceof Response) return result;
    c.set("authUser", result.username);
    return next();
  };
}
