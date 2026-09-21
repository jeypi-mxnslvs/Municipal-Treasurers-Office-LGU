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

### Operational Deployment Policies

1. **Linked Backup & Off-Host Retention Policy**
   - **Platform Backups**: Supabase Cloud managed daily backups with point-in-time recovery (PITR) enabled.
   - **Off-Host Logical Export**: Periodic logical schema and data exports via `pg_dump` or `supabase db dump` (encrypted with AES-256/GPG) stored in an off-host municipal disaster recovery storage location (air-gapped or dedicated secure municipal storage).
   - **Retention Schedule**: Minimum 30 days retention for operational snapshots; permanent retention for audited annual closing archives per LGU accounting and COA standards.

2. **Restore Drill Protocol**
   - **Local Schema/Fixture Restore Drill (Completed)**: Verified recovery of clean migration-built schema with test data and verified RLS enforcement.
   - **Municipal Dataset Restore Drill (Phase 6 Gate)**: Must be executed prior to production launch (Phase 6, Task 14) against a separate, disposable staging instance. Restoration drills are strictly prohibited against the linked active municipal production database.

3. **TLS Ingress & Transport Encryption**
   - **Database & API Transport**: All browser-to-Supabase PostgREST and Auth API traffic is strictly encrypted in transit using TLS 1.3 over HTTPS (`https://<project-ref>.supabase.co`).
   - **Web Ingress**: The Docker Compose service binds exclusively to loopback (`127.0.0.1:8080`). Ingress is routed through a reverse proxy (e.g., Nginx/Caddy) configured with valid municipal TLS certificates, modern cipher suites, and HSTS. Direct plaintext HTTP binding across the municipal LAN requires written security exception approval.

4. **Operator & Database-Owner Sign-Off Registry**
   - **Technical Lead Sign-Off**: Recorded for migration synchronization, reproducible Compose deployment, and container health probe convergence.
   - **Database Owner / Municipal Operator Sign-Off**: Formal human review confirming live backup schedule, TLS reverse-proxy termination, and environment variable protection prior to live production cutover.

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
- Linked backup policy, off-host logical export guidelines, restore drill requirements, and TLS ingress specifications are formally defined; full-scale municipal restore drill is linked to Phase 6 pilot verification, and operator sign-off is established as a gating prerequisite before Phase 7 release.

