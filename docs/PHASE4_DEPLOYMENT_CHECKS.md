# Phase 4 deployment convergence checks

> Run from repository root. These checks are static safeguards; deployment operators must also run the Supabase commands against the approved target.

```bash
set -eu
! grep -nE 'schema\.sql|treasury_admin|password:[^$]|5432:5432|3000:3000' docker-compose.yml

grep -q 'PGRST_DB_ANON_ROLE: \${PGRST_DB_ANON_ROLE:-anon}' docker-compose.yml || grep -q 'PGRST_DB_ANON_ROLE: anon' docker-compose.yml
grep -q 'condition: service_healthy' docker-compose.yml
grep -q 'healthcheck:' docker-compose.yml
grep -q 'supabase db push --include-all' scripts/apply-migrations.sh
```

Migration verification:

```bash
npx supabase migration list
npx supabase db push --include-all --dry-run
```

Never run `npx supabase db reset` against remote municipal data. For a disposable local database, reset must be followed by a query proving all canonical tables and Phase 3 RPCs exist.
