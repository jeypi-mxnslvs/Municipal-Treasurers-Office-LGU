# On-Premise Deployment Guide — Air-Gapped Municipal Hall Setup
**LGU Treasury Connect — Real Property Tax Delinquency Verification & Statement System**
**Municipality of Santa Rosa, Province of Nueva Ecija, Philippines**

## 1. Deployment boundary

Supabase Cloud is the production authority unless the deployment operator and database owner approve the controlled on-premise target. On-premise Compose is a development or isolated-LAN deployment only. PostgreSQL and PostgREST are internal container services; Nginx is the only published service.

Never use retired `schema.sql` or `supabase/migration.sql`. Canonical schema history is the ordered `supabase/migrations/*.sql` chain.

## 2. Prerequisites

- Ubuntu Server 22.04/24.04, Docker Engine 24+, Docker Compose v2.20+.
- Internal LAN firewall permits only TCP 80 or approved HTTPS port to Nginx.
- PostgreSQL major version matches the approved Supabase target. Current local Supabase config uses PostgreSQL 17.
- Deployment secrets are supplied through an external environment file, Docker secret, or secret manager. Do not commit them.

## 3. Deploy

```bash
npm ci
npm run build
cp .env.deploy.example /secure/path/lgu-treasury.env
# Edit secure file: set POSTGRES_PASSWORD and PGRST_DB_URI without committing it.
set -a
. /secure/path/lgu-treasury.env
set +a

./scripts/apply-migrations.sh --dry-run
./scripts/apply-migrations.sh

docker compose --env-file /secure/path/lgu-treasury.env up -d

docker compose ps
curl -fsS http://127.0.0.1/ >/dev/null
```

Migration failures stop deployment. Do not manually patch the database. Create a forward migration, review it, and rerun the dry-run.

## 4. TLS and network controls

For isolated-LAN HTTP, document the approved exception with the municipal IT/security owner and restrict ingress to the municipal VLAN. For any non-isolated network, terminate HTTPS at an approved reverse proxy, use HSTS, and publish no PostgreSQL or PostgREST port. Compose exposes PostgreSQL/PostgREST only to the internal Docker network.

## 5. Backup, restore, rollback

Use an external secret file and an off-host backup destination. Example scheduled dump:

```bash
0 17 * * 1-5 set -a; . /secure/path/lgu-treasury.env; set +a; \
  mkdir -p /opt/backups && \
  docker compose --env-file /secure/path/lgu-treasury.env exec -T postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > \
  /opt/backups/rptas_$(date +\%Y\%m\%d_\%H\%M).sql.gz
```

Retain encrypted daily backups according to the municipal retention schedule and copy them off-host. Monthly, restore the newest backup into a disposable PostgreSQL instance, run the migration/test checks, and record the result. Rollback means stop the application, preserve the failed deployment logs and backup, restore the approved backup into a clean target, then redeploy the previously approved image and migration state.

## 6. Verification

```bash
npx supabase migration list
npx supabase db push --include-all --dry-run
npm run test:unit
npx tsc --noEmit
npm run lint
npm run build
docker compose ps
```

Never run `npx supabase db reset` against remote municipal data.
