#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be supplied through environment or secret file}"

if [[ $# -gt 1 || ( $# -eq 1 && "$1" != '--dry-run' ) ]]; then
  echo 'Usage: apply-migrations.sh [--dry-run]' >&2
  exit 1
fi

if [[ "${DATABASE_URL}" != postgres://* && "${DATABASE_URL}" != postgresql://* ]]; then
  echo 'DATABASE_URL must be a PostgreSQL connection URL' >&2
  exit 1
fi

# Never fall back to the repository's linked Supabase project.
exec npx supabase db push --db-url "$DATABASE_URL" --include-all "$@"
