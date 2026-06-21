import type { Context } from "hono";
import type { Env } from "../types.js";
import { parseListFilterFromHono } from "@jeff-aporta/apiservers/http/hono-list-filter";
import { issListPageMeta, pickEqFilter, resolveIssListLimit, resolveIssListOffset, IssListFilterError } from "@jeff-aporta/apiservers/filter/iss-list-filter-core";
import {
  createMessage,
  getMessage,
  listMessages,
  softDeleteMessage,
  updateMessage,
} from "../lib/repo/messages.js";
import { isValidTreePath } from "../lib/tree/path.js";

type Ctx = Context<{ Bindings: Env; Variables: { authUser?: string } }>;

function author(c: Ctx): string {
  return String(c.get("authUser") || "").trim().toUpperCase();
}

function requireApp(c: Ctx): string | Response {
  const app = String(c.req.query("app") || c.req.header("X-App-Id") || "").trim();
  if (!app) return c.json({ ok: false, error: "Query app o header X-App-Id requerido" }, 400);
  return app;
}

function requireContext(c: Ctx): string | Response {
  const ctx = String(c.req.query("context") || "").trim();
  if (!ctx) return c.json({ ok: false, error: "Query context requerido" }, 400);
  return ctx;
}

export async function listTreeMessages(c: Ctx) {
  const app = requireApp(c);
  if (app instanceof Response) return app;
  const context = requireContext(c);
  if (context instanceof Response) return context;
  const listFilter = parseListFilterFromHono(c, { defaultLimit: 500, maxLimit: 2000 });
  if (listFilter instanceof Response) return listFilter;
  try {
    const eq = pickEqFilter(listFilter.eq, new Set(["includeInactive"]));
    const includeInactive = eq.includeInactive === true || eq.includeInactive === "true" || eq.includeInactive === 1 || c.req.query("includeInactive") === "1";
    let messages = await listMessages(c.env, app, context, { includeInactive });
    if (listFilter.search?.trim()) {
      const q = listFilter.search.trim().toLowerCase();
      messages = messages.filter((m) => m.body.toLowerCase().includes(q) || m.treePath.toLowerCase().includes(q));
    }
    const limit = resolveIssListLimit(listFilter, { defaultLimit: 500, maxLimit: 2000 });
    const offset = resolveIssListOffset(listFilter);
    const slice = messages.slice(offset, offset + limit);
    return c.json({ ok: true, messages: slice, ...issListPageMeta(messages.length, limit, offset) });
  } catch (e) {
    const msg = e instanceof IssListFilterError ? e.message : "f inválido";
    return c.json({ ok: false, error: msg }, 400);
  }
}

export async function getTreeMessage(c: Ctx) {
  const app = requireApp(c);
  if (app instanceof Response) return app;
  const context = requireContext(c);
  if (context instanceof Response) return context;
  const treePath = decodeURIComponent(c.req.param("path") || "");
  if (!isValidTreePath(treePath)) return c.json({ ok: false, error: "path inválido" }, 400);
  const message = await getMessage(c.env, app, context, treePath);
  if (!message) return c.json({ ok: false, error: "Mensaje no encontrado" }, 404);
  return c.json({ ok: true, message });
}

export async function postTreeMessage(c: Ctx) {
  const app = requireApp(c);
  if (app instanceof Response) return app;
  const body = await c.req.json<{
    context?: string;
    parentPath?: string | null;
    treePath?: string | null;
    body?: string;
    jlog?: Record<string, unknown>;
    replyToPath?: string | null;
    quotePath?: string | null;
  }>().catch(() => ({}));

  const context = String(body.context || c.req.query("context") || "").trim();
  if (!context) return c.json({ ok: false, error: "context requerido" }, 400);

  const user = author(c);
  if (!user) return c.json({ ok: false, error: "Usuario no autenticado" }, 401);

  try {
    const message = await createMessage(c.env, {
      appId: app,
      contextKey: context,
      parentPath: body.parentPath ?? null,
      treePath: body.treePath ?? null,
      body: String(body.body ?? ""),
      author: user,
      jlog: {
        ...(body.jlog || {}),
        kind: body.quotePath ? "quote" : (body.parentPath || body.replyToPath ? "reply" : "message"),
        replyToPath: body.replyToPath ?? body.parentPath ?? null,
        quotePath: body.quotePath ?? null,
      },
    });
    return c.json({ ok: true, message }, 201);
  } catch (e) {
    return c.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 400);
  }
}

export async function patchTreeMessage(c: Ctx) {
  const app = requireApp(c);
  if (app instanceof Response) return app;
  const context = requireContext(c);
  if (context instanceof Response) return context;
  const treePath = decodeURIComponent(c.req.param("path") || "");
  if (!isValidTreePath(treePath)) return c.json({ ok: false, error: "path inválido" }, 400);

  const body = await c.req.json<{ body?: string; jlog?: Record<string, unknown>; active?: boolean; archived?: boolean }>().catch(() => ({}));
  const user = author(c);
  if (!user) return c.json({ ok: false, error: "Usuario no autenticado" }, 401);

  const message = await updateMessage(c.env, app, context, treePath, body, user);
  if (!message) return c.json({ ok: false, error: "Mensaje no encontrado" }, 404);
  return c.json({ ok: true, message });
}

export async function deleteTreeMessage(c: Ctx) {
  const app = requireApp(c);
  if (app instanceof Response) return app;
  const context = requireContext(c);
  if (context instanceof Response) return context;
  const treePath = decodeURIComponent(c.req.param("path") || "");
  if (!isValidTreePath(treePath)) return c.json({ ok: false, error: "path inválido" }, 400);

  const user = author(c);
  if (!user) return c.json({ ok: false, error: "Usuario no autenticado" }, 401);

  const message = await softDeleteMessage(c.env, app, context, treePath, user);
  if (!message) return c.json({ ok: false, error: "Mensaje no encontrado" }, 404);
  return c.json({ ok: true, message });
}
