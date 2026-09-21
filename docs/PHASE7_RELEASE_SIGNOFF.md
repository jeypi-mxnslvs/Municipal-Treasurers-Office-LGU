# Phase 7 Release and Operational Sign-Off

Date: 2026-09-21

Release-candidate branch: `phase-7-release-operational-signoff`

Release-candidate tag: `phase7-rc-20260921`

Pre-Phase-7 baseline: `e2eb484` (`phase-6-pilot-verification`)

## Task decision and change budget

| Field | Decision |
|---|---|
| Task ID | PHASE-7-RELEASE-20260921 |
| Task class / risk | Standard documentation and release review / medium |
| Production impact | None; no deployment or production write performed |
| Database / auth / financial-data change | No / no / no |
| Rollback required | No product rollback; documentation can be reverted with Git |
| Live access | Read-only linked migration inspection only |
| Execution status | Engineering execution complete; project-lead acceptance recorded; specialist release decisions pending |

Change budget: maximum two documentation files. Schema, API, UI, and business-logic changes are forbidden. Permitted files are this record and `docs/ON_PREMISE_DEPLOYMENT.md`; all other files are forbidden to change.

## Scope and release inventory

Phase 7 freezes a release candidate, verifies the repository and linked migration state, publishes operational procedures, records residual risks, and provides the human sign-off record. It does not deploy, push migrations, modify municipal data, resolve prior-phase findings, or grant final production authorization.

The human lead stated in the initiating session that Phase 6 is complete and authorized Phase 7. The named signature fields in `PHASE6_PILOT_EVIDENCE.md` remain blank in the repository; this record does not invent reviewer names or signatures.

Release comparison against `main` at the pre-Phase-7 baseline:

- 60 changed files, 2,443 insertions, and 2,225 deletions.
- No `package.json` or `package-lock.json` difference.
- No tracked build output; `dist/`, `node_modules/`, `.env`, and `supabase/.temp/` remain ignored.
- Runtime frontend variables found: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_BACKEND_DRIVER`, and `VITE_API_BASE_URL`. Deployment-only variables are `DATABASE_URL`, `WEB_BIND_ADDRESS`, and `WEB_PORT`.
- Production selects the Supabase backend regardless of `VITE_BACKEND_DRIVER`; `VITE_API_BASE_URL` is a development-only local-driver value.

## Verification evidence

Commands were executed from a clean `phase-7-release-operational-signoff` worktree before the documentation-only release record was added.

| Check | Exact result |
|---|---|
| `npx tsc --noEmit` | Exit 0; no diagnostics |
| `npm run lint` | Exit 0; 0 errors and 0 warnings |
| `npm run test:unit` | Exit 0; 21 files passed, 178 tests passed |
| `npm run build` | Exit 0; 1,867 modules transformed; largest application chunk 475.27 kB (147.13 kB gzip), XLSX 332.97 kB (114.68 kB gzip), Supabase 220.34 kB (58.07 kB gzip); no Vite chunk warning |
| `npx supabase migration list` | Exit 0; all 25 local versions from `20260911` through `20261007` match remote |
| `npx supabase db push --include-all --dry-run` | Exit 0; `upToDate: true`, no migrations, seeds, or roles pending; nothing pushed |
| `npm audit --omit=dev --audit-level=critical` | Exit 1 because `xlsx` has two high-severity advisories; no critical advisory reported and npm provides no fix |

## Release review

- The tracked environment examples contain placeholders only. The local `.env` is ignored and its contents were not printed or committed.
- Active source contains no `postPayment`, `voidReceipt`, `OfficialReceiptModal`, `/api/payments`, debugger statement, or authentication-bypass marker. Legacy collection tables and routines remain only in immutable migration history and are unavailable as active browser mutation paths after the forward containment migrations.
- `20261002` drops the legacy browser authentication function. `20261004` revokes public, anonymous, and authenticated execution broadly, then grants only the controlled authenticated workflows.
- The immutable `20260911` initial migration still contains bcrypt-hashed demonstration account seeds derived from the public string `admin123`. Later authorization migrations deny browser access to the legacy `users` table and authentication routine. A future, separately approved forward migration should delete or quarantine unused legacy identities after the database owner inventories live dependencies.
- Historical architecture documents describe the pre-containment system and include obsolete insecure examples. They are reference material, not active implementation guidance; SSOT and current source remain authoritative.
- Deployment, backup, restore, rollback, support, and incident procedures are published in `ON_PREMISE_DEPLOYMENT.md`. Phase 6 contains the reproducible synthetic restore evidence.

## Known residual risks and release conditions

1. `xlsx@0.18.5` has published prototype-pollution and ReDoS advisories with no npm-registry fix. Imports must remain limited to trusted municipal workbooks and existing size/type validation until the security reviewer accepts the exposure or a separately tested replacement is approved.
2. The initial migration retains demonstration identity seeds and legacy collection objects for reproducibility. Current forward migrations contain browser privileges, but the database owner must confirm the live legacy rows and service-role exposure before production cutover.
3. Phase 5 recorded deep-page sort spill and lacks an agreed browser-memory/HTTP-latency threshold on representative municipal infrastructure. The technical and operational reviewers must accept or remediate this before release.
4. Phase 6 used synthetic data. Its repository sign-off table is blank even though the initiating human lead declared the phase complete; the responsible municipal reviewers must attach or enter their traceable approval evidence.
5. Live backup retention, the current recovery point, TLS termination, environment-file permissions, and the municipal escalation roster require operator verification at deployment time.

No unresolved critical npm advisory was reported. This is not a declaration that the release is secure or fit for production; the residual risks above require human review.

## Human sign-off record

The release remains on hold until all required reviewers record an explicit decision and any rejection condition is resolved. Signatures may be physical or a link/hash to an approved municipal electronic record.

| Review | Reviewer / evidence | Date | Decision and remarks |
|---|---|---|---|
| Project lead — Phase 7 evidence and handoff | Interactive project session (`It's approve`; confirmed with `proceed`) | 2026-09-21 | Accepted for handoff; does not substitute for the four specialist decisions below |
| Technical — build, migrations, deployment and rollback | Project/technical lead — named reviewer evidence pending |  | Pending individual decision |
| Security — authorization, secrets, dependency risk and incident plan | Designated security or IT reviewer — named reviewer evidence pending |  | Pending individual decision |
| Financial — statutory calculations, schedules, statements and audit evidence | Municipal Treasurer — named reviewer evidence pending |  | Pending individual decision |
| Operational — backup/restore, support, training and cutover readiness | Database owner or municipal system operator — named reviewer evidence pending |  | Pending individual decision |

Only the named human reviewers may authorize production release. The agent does not provide that authorization.
