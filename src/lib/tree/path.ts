/** Índice jerárquico por puntos (estilo IPlan: 1, 1.2, 2.1.3). */

export const PATH_RE = /^[1-9]\d*(?:\.[1-9]\d*)*$/;

export function isValidTreePath(path: string): boolean {
  return PATH_RE.test(String(path || "").trim());
}

export function pathDepth(path: string): number {
  return path.split(".").length;
}

export function parentPath(path: string): string | null {
  const i = path.lastIndexOf(".");
  return i === -1 ? null : path.slice(0, i);
}

export function comparePaths(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

export function sortPaths(paths: string[]): string[] {
  return [...paths].sort(comparePaths);
}

export function nextChildPath(parent: string | null | undefined, siblings: string[]): string {
  if (!parent) {
    const roots = siblings
      .filter((p) => !p.includes("."))
      .map((p) => Number(p));
    return String(roots.length ? Math.max(...roots) + 1 : 1);
  }
  const prefix = `${parent}.`;
  const children = siblings
    .filter((p) => p.startsWith(prefix))
    .map((p) => p.slice(prefix.length))
    .filter((rest) => !rest.includes("."))
    .map((rest) => Number(rest));
  return `${parent}.${children.length ? Math.max(...children) + 1 : 1}`;
}

export function pathOrderSql(alias: string): string {
  return Array.from({ length: 8 }, (_, i) =>
    `COALESCE(TRY_CAST(split_part(${alias}."TREE_PATH", '.', ${i + 1}) AS INT), -1)`,
  ).join(", ");
}
