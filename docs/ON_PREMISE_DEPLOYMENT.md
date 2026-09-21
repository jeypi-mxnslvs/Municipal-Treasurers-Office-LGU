# Deployment Guide — Supabase Cloud and Municipal Web Host

Supabase Cloud is the selected database and authentication authority. The Compose file serves only the built web application. It does not provide a local database, PostgREST, or Supabase Auth. A full on-premise Supabase deployment needs a separate design and approval; a bare PostgreSQL/PostgREST pair cannot run this application's Auth-dependent migration chain.

## Prepare and migrate

1. Copy `.env.deploy.example` to an access-restricted location outside the repository. Set `DATABASE_URL` to the approved Supabase PostgreSQL connection URL with URL-encoded credentials. Set the public `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the same project. Do not put a database URL or service key in any `VITE_*` variable.
2. Confirm the target project and its latest backup with the deployment operator and database owner. Review `npx supabase migration list` against that project. Never run `supabase db reset --linked` on municipal data.
3. Build and preview migrations before applying them:

   ```bash
   set -a
   . /secure/path/lgu-treasury.env
   set +a
   npm ci
   npm run build
   ./scripts/apply-migrations.sh --dry-run
   ./scripts/apply-migrations.sh
   ```

   The script passes `DATABASE_URL` explicitly to `supabase db push --db-url`; it cannot silently select the repository's linked project. The `20260911000000` compatibility migration creates a legacy evidence table only when absent. Applied migration files are immutable; repair failures with a reviewed forward migration.

## Serve the web application

```bash
docker compose --env-file /secure/path/lgu-treasury.env config
docker compose --env-file /secure/path/lgu-treasury.env up -d
docker compose --env-file /secure/path/lgu-treasury.env ps
curl -fsS http://127.0.0.1:8080/ >/dev/null
```

The web port binds to loopback by default. Terminate HTTPS at the municipal reverse proxy and restrict its ingress to approved workstations. An isolated-LAN HTTP exception requires written approval and firewall controls before changing `WEB_BIND_ADDRESS`. The browser calls Supabase over HTTPS; no database or PostgREST port is published by Compose.
The Nginx image is pinned by digest; update that digest through a reviewed image upgrade.

## Backups, restore drill, and rollback

The database owner must record the project's available backup retention and recovery point in Supabase Database → Backups. Retain an encrypted logical export off-host according to the municipal retention schedule. Supabase documents both managed backups and CLI logical exports at <https://supabase.com/docs/guides/platform/backups>.

At least monthly, restore a recent backup to a separate disposable Supabase project or local stack, verify migration history, table counts, a sample property, and an Auth/RLS denial, then record the date, backup identifier, checksum, and operator. Never restore a drill into the linked municipal project.

For a failed web release, redeploy the prior approved web build. For a database failure, preserve logs and the current backup, restore the approved recovery point into a separate target, validate it, and switch application configuration only after the database owner authorizes the cutover. Do not reverse an applied SQL migration or reset the linked project.

## Release rollback procedure

1. Record the incident time, release tag, deployed asset hashes, operator, and observed failure. Stop further deployments while triage is active.
2. If only the static web release failed, redeploy the immediately preceding human-approved image or build and verify login, a bounded property search, and a read-only statement preview.
3. If a migration or data-integrity failure is suspected, stop application writes at the approved ingress, preserve database and platform logs, and notify the database owner. Do not edit financial rows manually, reverse an applied migration, or reset the linked project.
4. Restore the approved recovery point to a separate target. Verify migration history, table counts, a sampled parcel and audit chain, and an unauthorized-access denial before requesting cutover approval.
5. The database owner authorizes any connection cutover. Record the recovery point, validation evidence, decision, and follow-up owner in the incident record.

## Support procedure

- Staff report issues to the designated municipal support contact with the time, workstation, signed-in role, TD number when applicable, action attempted, and a screenshot that excludes credentials and unrelated taxpayer data.
- Support records severity, owner, affected release tag, and whether assessment, verification, audit, authentication, availability, or confidentiality is involved. Never request passwords, session tokens, database URLs, or service-role keys.
- Reproduce with sanitized data when possible. Production access remains read-only unless a separately authorized operational procedure requires a change.
- Financial corrections use the system's authorized superseding workflow and audit justification; support personnel must not patch database rows directly.
- Close a ticket only after the reporter verifies the outcome and the evidence is retained under the municipal records policy.

## Incident response procedure

1. **Classify:** Treat suspected credential disclosure, authorization bypass, audit loss, incorrect statutory calculation, or financial-record corruption as a critical incident; broad outage or blocked verification is high; bounded degradation is medium; cosmetic defects are low.
2. **Contain:** Disable the affected account or ingress path, pause imports and verification writes when integrity is uncertain, and preserve the current database and application state. Do not destroy evidence.
3. **Notify:** Contact the technical lead, security reviewer, Municipal Treasurer, Municipal Assessor, and database owner according to the municipal escalation roster. Only the authorized municipal spokesperson communicates taxpayer-impact statements.
4. **Investigate:** Preserve timestamps, release tag, audit rows, Supabase logs, reverse-proxy logs, affected TD numbers, and checksums. Export the minimum personal data needed and store it only in the approved incident location.
5. **Recover:** Use a reviewed forward fix or the rollback procedure above. Reconcile affected assessments and verification records against the append-only audit history and physical source records before resuming writes.
6. **Review:** Record root cause, scope, decisions, recovery evidence, statutory or privacy notifications, and preventive actions. Human technical, security, financial, and operational reviewers decide when normal service may resume.
