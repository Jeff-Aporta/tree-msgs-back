import { S, sql } from "../../db.js";
import type { Env, MessageJlog, TreeMessageDto } from "../../types.js";
import { comparePaths, isValidTreePath, nextChildPath, parentPath } from "../tree/path.js";

type Row = Record<string, unknown>;

function mapRow(r: Row): TreeMessageDto {
  const jlog = (typeof r.JLOG === "object" && r.JLOG !== null ? r.JLOG : {}) as MessageJlog;
  return {
    appId: String(r.APP_ID),
    contextKey: String(r.CONTEXT_KEY),
    treePath: String(r.TREE_PATH),
    body: r.BODY != null ? String(r.BODY) : "",
    jlog,
    active: Boolean(r.ACTIVE),
    archived: Boolean(r.ARCHIVED),
    createdAt: r.CREATED_AT,
    updatedAt: r.UPDATED_AT,
  };
}

function normalizeApp(appId: string): string {
  return String(appId || "").trim().toLowerCase();
}

function normalizeContext(contextKey: string): string {
  return String(contextKey || "").trim();
}

export async function listMessages(
  env: Env,
  appId: string,
  contextKey: string,
  opts: { includeInactive?: boolean } = {},
): Promise<TreeMessageDto[]> {
  const db = sql(env);
  const app = normalizeApp(appId);
  const ctx = normalizeContext(contextKey);
  const rows = opts.includeInactive
    ? await db`
        SELECT * FROM ${S}."MESSAGE"
        WHERE "APP_ID" = ${app} AND "CONTEXT_KEY" = ${ctx}
        ORDER BY "TREE_PATH"
      `
    : await db`
        SELECT * FROM ${S}."MESSAGE"
        WHERE "APP_ID" = ${app} AND "CONTEXT_KEY" = ${ctx} AND "ACTIVE" = TRUE
        ORDER BY "TREE_PATH"
      `;
  return (rows as Row[]).map(mapRow).sort((a, b) => comparePaths(a.treePath, b.treePath));
}

export async function getMessage(
  env: Env,
  appId: string,
  contextKey: string,
  treePath: string,
): Promise<TreeMessageDto | null> {
  if (!isValidTreePath(treePath)) return null;
  const db = sql(env);
  const rows = await db`
    SELECT * FROM ${S}."MESSAGE"
    WHERE "APP_ID" = ${normalizeApp(appId)}
      AND "CONTEXT_KEY" = ${normalizeContext(contextKey)}
      AND "TREE_PATH" = ${treePath}
    LIMIT 1
  `;
  const r = (rows as Row[])[0];
  return r ? mapRow(r) : null;
}

export async function createMessage(
  env: Env,
  opts: {
    appId: string;
    contextKey: string;
    parentPath?: string | null;
    treePath?: string | null;
    body: string;
    jlog?: MessageJlog;
    author: string;
  },
): Promise<TreeMessageDto> {
  const app = normalizeApp(opts.appId);
  const ctx = normalizeContext(opts.contextKey);
  const existing = await listMessages(env, app, ctx, { includeInactive: true });
  const paths = existing.map((m) => m.treePath);

  let treePath = opts.treePath?.trim() || "";
  const parent = opts.parentPath?.trim() || null;
  if (parent && !isValidTreePath(parent)) throw new Error("parentPath inválido");
  if (treePath && !isValidTreePath(treePath)) throw new Error("treePath inválido");
  if (!treePath) treePath = nextChildPath(parent, paths);
  if (paths.includes(treePath)) throw new Error("treePath ya existe");

  const parentOfNew = parentPath(treePath);
  if (parent && parentOfNew !== parent) throw new Error("treePath no coincide con parentPath");
  if (parent && !paths.includes(parent)) throw new Error("parentPath no existe");

  const jlog: MessageJlog = {
    ...(opts.jlog || {}),
    author: opts.author,
    kind: opts.jlog?.kind || (parent ? "reply" : "message"),
    replyToPath: opts.jlog?.replyToPath ?? parent ?? null,
    quotePath: opts.jlog?.quotePath ?? null,
  };

  const db = sql(env);
  await db`
    INSERT INTO ${S}."MESSAGE" (
      "APP_ID", "CONTEXT_KEY", "TREE_PATH", "BODY", "JLOG", "ACTIVE", "ARCHIVED"
    ) VALUES (
      ${app}, ${ctx}, ${treePath}, ${opts.body ?? ""}, ${JSON.stringify(jlog)}::jsonb, TRUE, FALSE
    )
  `;
  const created = await getMessage(env, app, ctx, treePath);
  if (!created) throw new Error("No se pudo crear el mensaje");
  return created;
}

export async function updateMessage(
  env: Env,
  appId: string,
  contextKey: string,
  treePath: string,
  patch: { body?: string; jlog?: MessageJlog; active?: boolean; archived?: boolean },
  editor: string,
): Promise<TreeMessageDto | null> {
  const current = await getMessage(env, appId, contextKey, treePath);
  if (!current) return null;

  const body = patch.body !== undefined ? patch.body : current.body;
  const jlog: MessageJlog = {
    ...current.jlog,
    ...(patch.jlog || {}),
    author: current.jlog.author || editor,
    editedAt: new Date().toISOString(),
    editedBy: editor,
  };
  const active = patch.active !== undefined ? patch.active : current.active;
  const archived = patch.archived !== undefined ? patch.archived : current.archived;

  const db = sql(env);
  await db`
    UPDATE ${S}."MESSAGE"
    SET "BODY" = ${body},
        "JLOG" = ${JSON.stringify(jlog)}::jsonb,
        "ACTIVE" = ${active},
        "ARCHIVED" = ${archived},
        "UPDATED_AT" = now()
    WHERE "APP_ID" = ${normalizeApp(appId)}
      AND "CONTEXT_KEY" = ${normalizeContext(contextKey)}
      AND "TREE_PATH" = ${treePath}
  `;
  return getMessage(env, appId, contextKey, treePath);
}

export async function softDeleteMessage(
  env: Env,
  appId: string,
  contextKey: string,
  treePath: string,
  editor: string,
): Promise<TreeMessageDto | null> {
  return updateMessage(env, appId, contextKey, treePath, { active: false }, editor);
}
