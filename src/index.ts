import { Hono } from "hono";
import { swaggerUI } from "@hono/swagger-ui";
import type { Env } from "./types.js";
import { corsHeaders, handlePreflight, jeffCorsMiddleware } from "./lib/http/cors.js";
import {
  deleteTreeMessage,
  getTreeMessage,
  listTreeMessages,
  patchTreeMessage,
  postTreeMessage,
} from "./routes/messages.js";
import { mountAuthProxy } from "./lib/auth/auth-proxy.js";
import { apiAuthGuard } from "./lib/auth/auth-guard.js";

const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "tree-msgs API",
    version: "1.0.0",
    description: "Mensajes jerárquicos por app + contexto + índice (BD_TREE_MSGS). Soft delete vía ACTIVE=false.",
  },
  servers: [{ url: "https://tree-msgs.jeffaporta.workers.dev", description: "Producción" }],
};

const app = new Hono<{ Bindings: Env }>();
const api = new Hono<{ Bindings: Env; Variables: { authUser?: string } }>();

app.use("*", async (c, next) => {
  const preflight = handlePreflight(c);
  if (preflight) return preflight;
  await next();
});

app.use("*", jeffCorsMiddleware());

app.onError((err, c) => {
  const message = err instanceof Error ? err.message : String(err);
  return c.json({ ok: false, error: message }, 500, corsHeaders(c.req.header("Origin")));
});

app.notFound((c) =>
  c.json({ ok: false, error: "Not found" }, 404, corsHeaders(c.req.header("Origin"))),
);

app.get("/", (c) => c.json({
  ok: true,
  service: "tree-msgs",
  database: "Neon BD_TREE_MSGS",
  apiPrefix: "/api",
  keys: ["app", "context", "treePath (índice por puntos)"],
  docs: { openapi: "/api/doc", swagger: "/api/ui" },
}));

api.use("*", apiAuthGuard());

api.get("/tree-msgs", listTreeMessages);
api.get("/tree-msgs/:path", getTreeMessage);
api.post("/tree-msgs", postTreeMessage);
api.patch("/tree-msgs/:path", patchTreeMessage);
api.delete("/tree-msgs/:path", deleteTreeMessage);

api.get("/doc", (c) => c.json(openApiSpec));
api.get("/ui", swaggerUI({ url: "doc" }));

mountAuthProxy(api);
app.route("/api", api);

export default app;
