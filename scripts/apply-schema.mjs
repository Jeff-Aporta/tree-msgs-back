#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const url = process.env.TREE_MSGS_DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.SCRUM_DATABASE_URL;
if (!url) { console.error("Falta TREE_MSGS_DATABASE_URL"); process.exit(1); }

const dir = dirname(fileURLToPath(import.meta.url));
const sqlText = readFileSync(join(dir, "..", "schema", "bd_tree_msgs.sql"), "utf8");
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
try {
  await pool.query(sqlText);
  console.log("OK — BD_TREE_MSGS aplicado");
} finally {
  await pool.end();
}
