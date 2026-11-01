#!/usr/bin/env bash
# Creates a new migration from schema changes without an interactive TTY (CI/agents).
# Usage: pnpm --filter @kleps/db migrate:create <name>
set -euo pipefail
name="${1:?migration name required}"
: "${SHADOW_DATABASE_URL:?SHADOW_DATABASE_URL must point to an empty scratch database}"
dir="prisma/migrations/$(date -u +%Y%m%d%H%M%S)_${name}"
sql="$(npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$SHADOW_DATABASE_URL" --script)"
if ! grep -qvE '^\s*(--.*)?$' <<<"$sql"; then echo "No schema changes."; exit 0; fi
mkdir -p "$dir" && printf '%s\n' "$sql" > "$dir/migration.sql"
echo "Created $dir/migration.sql — review it, then run: pnpm db:deploy"
