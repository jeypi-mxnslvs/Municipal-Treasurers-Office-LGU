# Phase 4 deployment verification

The selected production path is Supabase Cloud plus a static web host. The former bare PostgreSQL/PostgREST Compose stack was removed because it lacked Supabase Auth and used a database superuser for API access.

## Local checks

```bash
set -eu
! grep -nE 'schema\.sql|postgres:|postgrest|5432:5432|3000:3000' docker-compose.yml
grep -q -- '--db-url "$DATABASE_URL"' scripts/apply-migrations.sh
grep -q '127.0.0.1' docker-compose.yml
docker compose config
npx tsc --noEmit
npm run lint
npm run test:unit
npm run build
```

Run a clean local Supabase startup from a disposable workdir containing only `supabase/`. It must apply every migration from `20260911` through `20261005`, including the additive `20260911000000` compatibility migration. Run a data backup and restore drill in that disposable stack, then stop it.

## Linked project checks

Before any push, run `npx supabase migration list`, then `npx supabase db push --include-all --dry-run`. Review any pending migration with the database owner. `scripts/apply-migrations.sh` requires an explicit `DATABASE_URL` and allows only an optional `--dry-run` argument. Never run `supabase db reset --linked` against municipal data.

Record the linked backup policy, off-host export, restore drill, TLS ingress, and operator/database-owner approval before considering the Phase 4 gate closed.

## Verification record

- The original clean local Supabase startup failed at `20260912`: `public.payment_postings` did not exist. With `20260911000000` added, all 23 migrations through `20261005` applied in a disposable local stack.
- A disposable property backup had SHA-256 `1a3281b046cb727a3f9874ee5139d1bf35d84a139db831c9d904bfea9941bd71`. After a local-only reset, restoring it recovered five property rows, including the test fixture. This proves a data restore into a clean migration-built database; it is not a municipal backup drill.
- The `anon` database role was denied a direct property read in that restored local database.
- The linked Supabase REST API denied an anonymous property request with HTTP 401 (`42501`).
- The migration script's local dry run reported up to date and a command-capture test confirmed it passes `--db-url "$DATABASE_URL"`; it rejects `--linked` as an argument.
- The web-only Compose service started without database secrets, served HTTP 200 on loopback, and reached `healthy` after the SELinux bind labels and IPv4 health probe were corrected.
- In a clean Phase 4 checkout with these deployment edits, `npx tsc --noEmit`, lint, 166 unit tests, and build passed. The current `phase-5-scalability` worktree has separate uncommitted pagination edits that fail two type checks and two unit tests.
- The linked-project dry run listed only `20260911000000` as pending. After the project lead authorized the push, that migration applied successfully. A fresh migration list matched local and remote history, and a second dry run reported `upToDate: true` with no pending migrations.
- A read-only linked-project query confirmed `payment_postings` already exists with zero rows, so the compatibility migration's `CREATE TABLE IF NOT EXISTS` would not create a second table there.
