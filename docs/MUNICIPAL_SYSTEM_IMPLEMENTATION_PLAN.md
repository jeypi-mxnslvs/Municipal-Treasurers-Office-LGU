# Municipal Treasury System Implementation Plan

> **Agent prompt:** Execute this plan phase by phase. Do not skip gates, widen scope, rewrite applied migrations, or claim production readiness. Read `AGENTS.md`, `docs/SSOT.md`, `docs/IMPLEMENTATION_PLAN_VERIFICATION_STATEMENT_SYSTEM.md`, and this file before changing code.

## Mission

Stabilize and complete the Santa Rosa Real Property Tax Delinquency Verification & Statement System. Deliver a narrowly scoped, auditable, secure, scalable system for property assessment, historical valuation provenance, delinquency calculation, sequential verification, external settlement evidence, Statement of Account generation, Notice of Delinquency generation, and conditional clearance eligibility.

This is not a cashiering system.

## Current Baseline

- Stack: React, TypeScript, Vite, Supabase/PostgreSQL, Vitest, Tailwind.
- Canonical schema history: `supabase/migrations/*.sql`.
- Production datastore authority: Supabase Cloud. `LocalHttpRepository` is development/test-only and is not an equal production authority.
- Production authentication authority: Supabase Auth. Browser password comparison, seeded fallback credentials, and client-generated authorization tokens are prohibited.
- Main application entry: `App.tsx`.
- Repository boundary: `services/ITreasuryRepository.ts`.
- Supabase driver: `services/SupabaseRepository.ts`.
- Local driver: `services/LocalHttpRepository.ts`.
- Tax engine: `utils/taxLogic.ts`.
- Existing baseline checks: `npx tsc --noEmit`, `npm run lint`, `npm run test:unit`, `npm run build`.
- Current baseline tests pass, but passing tests do not establish security or production readiness.

## Target Product Boundary

### In scope

- Admin and Assessor authentication.
- Controlled System Maintenance authority only for disposable test-data maintenance in non-production environments, if retained after security review.
- Property masterlist.
- Current and historical assessment records.
- Historical assessed-value transcription and provenance.
- Durable import review and promotion.
- Statutory delinquency calculation.
- Arrears-first delinquency-period verification.
- External settlement evidence references without system cash collection.
- Statement of Account generation and CSV export.
- RA 7160 Section 254 Notice of Delinquency generation and CSV export.
- Conditional tax-clearance eligibility decision.
- Append-only audit and security provenance.
- Supabase Cloud deployment as the selected production authority; local/on-premise adapters may remain for development and controlled testing only.

### Out of scope

- Payment posting.
- Cash, check, online tender, or e-wallet collection.
- AF-51 receipt issuance.
- Receipt numbering, booklet custody, or receipt voiding.
- Cashier navigation.
- Offline tellering or payment queues.
- Banking integration.
- Accounting reconciliation.
- BLGF collection reporting.
- POS hardware.
- AI/MCP automation.

Legacy payment records may remain in the database as read-only historical evidence only if municipal policy requires them. They are not system receipts or collection authority and must not be writable through the active application.

## Non-Negotiable Rules

1. Never edit, delete, rename, reorder, or rewrite an applied migration. Repair deployed schema only with a forward migration.
2. Never run `npx supabase db reset` against remote municipal data.
3. Never trust a caller-supplied role, user name, approval identity, or station as authorization.
4. Never expose password hashes or plaintext passwords to the browser.
5. Never use client-generated or forgeable tokens as the authority for database access.
6. Never swallow audit-write failures after a successful domain mutation.
7. Never permit verification or clearance for shell records.
8. Never permit current-period verification while required prior periods remain unresolved.
9. Never delete production property, verification, audit, or historical evidence records.
10. Never use `Math.random()` for financial identifiers or audit identifiers.
11. Keep statutory constants and approved municipal schedules covered by tests.
12. Stop after each phase and request human approval before starting the next phase.

## Change-Budget Protocol

Each phase has a maximum intended change budget. Before editing, list exact files and classify changes:

- Schema/migration: yes or no.
- API/repository contract: yes or no.
- UI: yes or no.
- Business logic: yes or no.
- Maximum files changed.

If a phase exceeds its budget, stop and request approval. Do not hide scope expansion inside cleanup.

## Standard Phase Verification

Run from repository root unless a phase says otherwise:

```bash
npx tsc --noEmit
npm run lint
npm run test:unit
npm run build
```

For migration phases, also run:

```bash
npx supabase migration list
npx supabase db push --include-all --dry-run
```

If Supabase CLI or linked-project access is unavailable, report that fact. Do not fabricate migration results.

## Phase 0: Governance, Scope, and Architecture Lock

**Goal:** Establish one authoritative product definition before security or feature work.

**Budget:** Documentation only; maximum 9 files. No production schema, API, UI, or business-logic change.

**Tasks:**

1. Reconcile `docs/SSOT.md`, `AGENTS.md`, `README.md`, `context/*`, and architecture notes against this plan; missing legacy plan filenames are not recreated as duplicate authorities.
2. Mark legacy collection records as read-only historical evidence. They are not system receipts or collection authority.
3. Confirmed Supabase Cloud as production datastore. The local driver remains a tested development/secondary adapter and is not an equal production authority.
4. Confirmed Supabase Auth as production authentication authority. Custom browser password verification is not production authentication.
5. Confirmed approved roles: `Admin`, `Assessor`; `SystemMaintenance` is non-production/service-only for disposable test-data maintenance and never ordinary treasury operations.
6. Document who may approve assessments, historical AV, delinquency verification, external settlement evidence, reversals, clearance eligibility, imports, and maintenance purge.

**Acceptance criteria:**

- Every authoritative document states the same product boundary.
- No authoritative document describes active cashiering.
- One production datastore and authentication path are selected.
- Role authority and reversal rules are explicit.
- No code changes begin until this phase receives human approval.

**Gate:** Human approves written decisions before Phase 1.

## Phase 1: Security Containment and Authentication Hardening

**Goal:** Ensure identity, session, and database authorization are server-authoritative.

**Budget:** Maximum 18 files. Schema/migration: yes. API/repository: yes. UI: only auth UI. Business logic: no.

**Primary files:**

- `services/supabase.ts`
- `services/SupabaseRepository.ts`
- `services/LocalHttpRepository.ts`
- `services/api.ts`
- `services/authService.ts`
- `features/auth/LoginPage.tsx`
- `lib/crypto.ts`
- New forward security migrations under `supabase/migrations/`
- Security integration tests

**Tasks:**

1. Remove browser fallback credentials and hardcoded production passwords from `LoginPage.tsx`, `SupabaseRepository.ts`, `.env`, and shipped UI paths.
2. Use the selected authentication authority for login and password verification.
3. Do not return password hashes, plaintext passwords, or arbitrary role fields to the browser.
4. Replace the browser-generated HMAC token with a server-issued, signed, expiring session. Prefer secure `HttpOnly`, `Secure`, `SameSite` cookies for a local API. If Supabase Auth is selected, use its session mechanism.
5. Derive authenticated user identity and role from server/session claims. Ignore caller-provided authorization fields.
6. Enable RLS on every production table containing protected municipal data.
7. Revoke unsafe anonymous table and routine privileges. Grant only the minimum required public authentication function, if applicable.
8. Replace `USING (true)` and `WITH CHECK (true)` policies with role-aware policies.
9. Protect maintenance, archival, schedule activation, import, verification, reversal, user-management, and audit operations by trusted role claims.
10. Add login rate limiting, failed-login audit events, inactivity timeout, and re-authentication for destructive actions.
11. Rotate any exposed Supabase keys, test passwords, database credentials, and seeded credentials outside source control.

**Required tests:**

- Missing credentials return `401` or equivalent failure.
- Invalid credentials do not create a session.
- Expired sessions fail.
- Assessor cannot administer users, activate schedules, reverse another user’s verification, or purge data.
- Admin cannot impersonate an arbitrary caller identity by changing request fields.
- Unauthenticated direct data access is denied.
- `SystemMaintenance` cannot access treasury workflows.
- Login failures are rate-limited and audited.

**Acceptance criteria:**

- No active path compares passwords in browser code.
- No active path accepts caller-supplied role as authorization.
- No unsafe anonymous write/delete access remains.
- Security tests pass against a local/staging database.

**Gate:** Security review and human approval before Phase 2.

## Phase 2: Domain and Scope Convergence

**Goal:** Remove contradictory collection behavior from the active product.

**Budget:** Maximum 20 files. Schema/migration: only forward containment migration if required. API/repository: yes. UI: yes. Business logic: yes for terminology only.

**Tasks:**

1. Remove active payment mutation methods from `ITreasuryRepository` and all adapters.
2. Remove active reads of `payment_postings` and `delinquency_year_completions`, unless Phase 0 explicitly approved historical read-only evidence. If retained, isolate them behind a clearly named legacy-evidence method.
3. Remove or quarantine `OfficialReceipt`, tender, receipt, cashier, and collection types from active code.
4. Remove collection KPIs such as `totalCollected`, `todayCollected`, and `collectionEfficiency` from active dashboard behavior unless a separate approved reporting scope exists.
5. Replace ambiguous terms:
   - `completed` -> explicit verification status.
   - `cleared` -> verified or externally settled, unless referring to eligibility only.
   - `payment reference` -> source reference or external settlement reference.
   - `last paid year` -> reported baseline unless independently verified.
6. Keep external AF-51 numbers only as external evidence references, never as system receipts.
7. Update fixtures, tests, README, context files, and UI copy to match the narrowed scope.
8. Preserve historical database records without exposing write paths.

**Required tests:**

- Active repository has no payment mutation method.
- No UI action creates payment or receipt records.
- External settlement requires a source reference.
- Status labels never imply system collection.
- Historical legacy evidence is read-only if retained.

**Acceptance criteria:**

- Product behavior matches Phase 0 scope.
- No active cashiering route remains.
- No active application path generates receipts or posts payments.
- Terminology is consistent across types, UI, tests, and documentation.

**Gate:** Human scope review before Phase 3.

## Phase 3: Transactional Data Integrity and Audit Immutability

**Goal:** Make every sensitive mutation atomic, attributable, reversible by superseding event, and retention-safe.

**Budget:** Maximum 16 files. Schema/migration: yes. API/repository: yes. UI: only error handling. Business logic: yes for transaction rules.

**Tasks:**

1. Create forward migrations for append-only audit controls.
2. Ensure verification insert/reversal and its audit event occur in one database transaction.
3. Ensure property mutation and audit event occur in one transaction.
4. Change audit failure behavior from warning/non-blocking to transaction failure.
5. Derive audit actor, role, and station from trusted session context.
6. Enforce mandatory reversal reason and create `SUPERSEDED` records rather than deleting prior verification decisions.
7. Block ordinary property deletion where evidence exists. Use archival with mandatory reason and authorized Admin identity.
8. Restrict hard deletion to explicitly classified disposable test data, with separate maintenance authority and approval reference.
9. Remove compatibility fallbacks that silently write obsolete tables or ignore missing columns.
10. Add concurrency locks or unique constraints for duplicate active verification decisions.

**Required tests:**

- Domain mutation rolls back if audit insertion fails.
- Duplicate concurrent verification cannot create two active decisions.
- Reversal preserves original record and creates a superseding event.
- Assessor cannot reverse own or any verification when policy disallows it.
- Archived records cannot enter tax computation.
- Unclassified production records cannot be purged.
- Audit rows cannot be updated or deleted through application roles.

**Acceptance criteria:**

- No successful sensitive mutation exists without its audit event.
- Historical evidence remains retained.
- Audit identity is not hardcoded.
- Test-data purge cannot target ordinary production records.

**Gate:** Data-integrity review and human approval before Phase 4.

## Phase 4: Migration and Deployment Convergence

**Goal:** Make cloud or on-premise deployment reproducible and secure.

**Budget:** Maximum 15 files. Schema/migration: yes. API/repository: yes. UI: no unless configuration requires it.

**Tasks:**

1. Treat `supabase/migrations/*.sql` as the only schema source of truth.
2. Remove deployment dependence on missing or retired `schema.sql`.
3. Update Docker initialization to apply ordered migrations or a generated release schema built from the canonical migration chain.
4. Remove hardcoded PostgreSQL, PostgREST, and seeded user credentials from Compose files.
5. Use environment or secret-file injection for deployment secrets.
6. Do not expose PostgreSQL directly to the municipal LAN unless explicitly required and firewall-restricted.
7. Do not configure PostgREST with a superuser or unrestricted database role as anonymous role.
8. Configure health checks for database, API, and web services.
9. Add HTTPS/TLS or document the approved isolated-LAN exception and controls.
10. Add backup retention, off-host backup, restore drill, and rollback instructions.
11. Verify the selected production driver against a clean database created only from migrations.

**Required tests/checks:**

- Clean database initializes from canonical migrations.
- `npx supabase migration list` is understood and reconciled.
- `npx supabase db push --include-all --dry-run` succeeds or is reported blocked by environment.
- Docker deployment starts without source-controlled secrets.
- API rejects unauthenticated and unauthorized requests.
- Backup can be restored into a clean database.
- Rollback procedure is documented and tested in staging.

**Acceptance criteria:**

- Deployment documentation matches actual files.
- No missing `schema.sql` dependency remains.
- No hardcoded production secret remains.
- Backup and restore evidence exists.

**Gate:** Deployment operator and database owner approve before Phase 5.

## Phase 5: Scalability and Frontend Stability

**Goal:** Support at least 25,000 parcels and concurrent assessor work without full-table client loads.

**Budget:** Maximum 20 files. Schema/migration: yes for indexes/views. API/repository: yes. UI: yes. Business logic: no.

**Tasks:**

1. Add paginated property queries with explicit page size, cursor or offset, total count, stable sort, search, and barangay filters.
2. Add database indexes for TD number, owner search strategy, barangay, disposition, active verification lookup, import hash, and batch relationships.
3. Replace client-side dashboard aggregation with SQL views or aggregate RPCs.
4. Avoid refreshing the full masterlist after unrelated mutations.
5. Add cache invalidation or query caching for properties, assessments, schedules, and dashboard data.
6. Debounce search and cancel stale requests.
7. Keep realtime events focused on invalidation keys rather than unconditional full reloads.
8. Split `App.tsx` only where a clear feature boundary reduces state coupling.
9. Code-split heavy XLSX, reports, charts, and maintenance modules.
10. Add bounded loading, retry, error, empty, and stale-data states.

**Required tests/checks:**

- Querying properties never loads the full table by default.
- Pagination returns stable non-overlapping pages.
- Search works with quotes, wildcard characters, Unicode names, and empty input.
- Dashboard totals match SQL aggregates.
- Realtime bursts do not trigger unbounded reloads.
- 25,000-property fixture remains within agreed response and memory limits.
- Production bundle is measured after code splitting.

**Acceptance criteria:**

- No active full-table property fetch for the dashboard/masterlist.
- Server-side pagination and filtering are active.
- Volume test results are recorded.
- Bundle warning is resolved or consciously accepted with measured evidence.

**Gate:** Performance review before Phase 6.

## Phase 6: Real-World Pilot and Functional Verification

**Goal:** Validate the complete narrowed product with representative municipal data and policy review.

**Budget:** Maximum 12 files for test tooling/docs; no speculative product features.

**Pilot checklist:**

1. Import a sanitized representative masterlist covering all 33 barangays.
2. Verify duplicate TD, conflicting record, invalid numeric value, invalid property class, missing AV, shell record, and idempotent re-import behavior.
3. Validate historical AV transcription with physical RPTAR volume/folio references.
4. Validate current and historical penalty schedules against approved municipal policy.
5. Test arrears-first verification across multi-year and quarter-split records.
6. Test external settlement evidence with official external reference.
7. Test disputed and superseded verification paths.
8. Test shell-record prohibition from verification and clearance eligibility.
9. Generate SOA and CSV export; compare totals and Basic/SEF allocation.
10. Generate Section 254 Notice and CSV export; obtain official format approval.
11. Test conditional clearance eligibility for outstanding, unverified, disputed, historical-gap, archived, and fully resolved cases.
12. Test Admin, Assessor, and maintenance negative permissions.
13. Perform concurrent assessor verification and import tests.
14. Execute backup and restore drill using pilot data.

**Required evidence:**

- Pilot dataset hash and source record.
- Import batch results.
- Calculation comparison workbook or signed review record.
- Authorization test results.
- SOA and Notice review samples.
- Backup restore log.
- Defect register with owner and disposition.

**Acceptance criteria:**

- No unresolved P0/P1 security or data-integrity defect.
- Treasurer/Assessor validates statutory schedule and report format.
- Pilot workflows pass with representative data.
- Restore drill succeeds.

**Gate:** Human pilot approval before Phase 7.

## Phase 7: Release and Operational Sign-Off

**Goal:** Release only after evidence-based review.

**Budget:** Documentation and release configuration only.

**Tasks:**

1. Freeze release candidate branch/tag.
2. Run all standard verification commands.
3. Run migration dry-run and inspect migration list.
4. Review `git diff`, changed-file list, dependency changes, environment variables, and generated artifacts.
5. Confirm no secrets, demo credentials, obsolete collection routes, or debug bypasses are shipped.
6. Publish deployment, backup, restore, rollback, support, and incident procedures.
7. Record known residual risks.
8. Obtain explicit human sign-off from technical, security, financial, and operational reviewers.

**Release criteria:**

- All previous phase gates approved.
- All required tests pass.
- No unresolved critical security issue.
- No unresolved financial data-integrity issue.
- Deployment and restore procedures have evidence.
- Human reviewers, not the agent, provide final production approval.

## Required Agent Report After Every Phase

Return:

1. Phase completed.
2. Files created, modified, or deleted.
3. Change-budget result.
4. Schema/API/UI/business-logic changes.
5. Tests and exact results.
6. Migration verification result.
7. Known residual risks.
8. Explicit stop and request for human approval before next phase.

Do not use these claims: `APPROVED`, `GO`, `SECURITY-SAFE`, or `PRODUCTION-READY`.

## Final Definition of Done

The system is complete only when:

- Product boundary is narrow, documented, and consistent.
- Authentication and authorization are server/database enforced.
- Sensitive writes are atomic with audit writes.
- Audit and verification history are append-only and retention-safe.
- Canonical migrations reproduce the deployment.
- Cloud/on-premise behavior matches the selected architecture.
- Property search and dashboard operations scale to the agreed parcel volume.
- Statutory calculation and municipal schedule tests pass.
- Pilot evidence covers all required workflows.
- Backup restore succeeds.
- Human reviewers provide final sign-off.

Until all conditions are met, describe the system as an implementation candidate or pilot candidate, never as production-ready.
