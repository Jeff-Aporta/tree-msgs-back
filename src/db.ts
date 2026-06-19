import { neon } from "@neondatabase/serverless";
import type { Env } from "./types.js";

export function sql(env: Env) {
  return neon(env.TREE_MSGS_DATABASE_URL);
}

export const S = '"BD_TREE_MSGS"';
