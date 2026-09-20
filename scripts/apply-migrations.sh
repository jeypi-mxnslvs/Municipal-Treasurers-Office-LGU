#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be supplied through environment or secret file}"

if [[ "${DATABASE_URL}" == *'password@'* || "${DATABASE_URL}" == *'password:'* ]]; then
  echo 'DATABASE_URL contains placeholder credentials' >&2
  exit 1
fi

npx supabase db push --include-all "$@"
