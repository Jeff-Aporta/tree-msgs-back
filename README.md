# tree-msgs API

Worker de mensajes jerárquicos (Cloudflare + Neon `BD_TREE_MSGS`).

## Claves compuestas

| Campo | Ejemplo | Descripción |
|-------|---------|-------------|
| `app` | `isa-patyia` | App del ecosistema |
| `context` | `scrum-task:{uuid}` | Ámbito del hilo |
| `treePath` | `1`, `1.2`, `2.1.1` | Índice anidado por puntos |

## API

Prefijo `/api` (vía orquestador: `/api/tree-msgs`).

- `GET /tree-msgs?app=&context=` — listar (`ACTIVE=true`)
- `GET /tree-msgs/{path}?app=&context=` — detalle
- `POST /tree-msgs?app=` — crear
- `PATCH /tree-msgs/{path}?app=&context=` — editar
- `DELETE /tree-msgs/{path}?app=&context=` — soft delete

## Local

```bash
npm install
# TREE_MSGS_DATABASE_URL o NEON_DATABASE_URL
npm run db:apply
npm run dev   # :8789
```

## Deploy

Push a `main` → GitHub Actions (`deploy.yml`) → `https://tree-msgs.jeffaporta.workers.dev`

Secretos del repo: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `LAB_JWT_SECRET`, `TREE_MSGS_DATABASE_URL` (o `NEON_DATABASE_URL`).
