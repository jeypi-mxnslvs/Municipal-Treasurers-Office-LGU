# Progress Tracker — LGU Treasury Connect

Update this file after every meaningful implementation change.

## Current Phase

- **Phases 0–6 Complete**: Master baseline tagged `v2.0.0` on `main`.
- **Active Branch**: `feature/historical-assessed-values` — Historical era valuations, assessor attribution provenance, 1st-place manual appraisal table sort, and database migration synchronization.
- **Repository Health**: 0 type errors, 0 lint warnings, 78/78 unit tests passing across 8 test suites, production build passing, remote database migrations fully applied.

## Current Goal

- Finalize end-to-end integration across core workflows (User Management/Auth, Property Appraisal, CSV Import Attribution, and AF-51 Tellering).
- Keep canonical context files (`context/`, `CLAUDE.md`) in sync with ground truth.
- Maintain zero financial data corruption and statutory RA 7160 compliance.

## Completed

- **Phase 0 Baseline (`main`)**:
  - Refactored `DelinquencyTable.tsx` and `LoginPage.tsx` to shadcn/ui primitives.
  - Implemented updated login page with official Santa Rosa Municipal Seal showcase, emerald colorway, demo personnel quick-select, and show/hide password toggle.
  - Implemented `ITreasuryRepository` driver pattern isolating Supabase PostgREST into `SupabaseRepository.ts`.
  - Created PBKDF2 cryptographic token validation and inactivity session management in `lib/crypto.ts`.
  - Added full test coverage for tax calculations (`utils/taxLogic.test.ts`), transaction atomicity (`utils/transactionAtomicity.test.ts`), and crypto helpers (`lib/crypto.test.ts`).
  - Implemented reload work-state persistence (`localStorage`) restoring active views, active property inquiries, table filters, search terms, and open modals.
  - Established canonical Single Source of Truth ([`docs/SSOT.md`](file:///home/jeipyyy/Documents/Projects/Municipal-Treasurers-Office-Delinquency-System/Municipal-Treasurers-Office-Delinquency-System/docs/SSOT.md)) and Roadmaps ([`docs/ROADMAP_AND_PHASES.md`](file:///home/jeipyyy/Documents/Projects/Municipal-Treasurers-Office-Delinquency-System/Municipal-Treasurers-Office-Delinquency-System/docs/ROADMAP_AND_PHASES.md)).
  - Generated the 6 canonical context files and entry point in `context/` and `CLAUDE.md`.

- **Phase 1 (`feature/security-and-auth`)**:
  - User password hashing via `pgcrypto` / PBKDF2 with schema-resilient column support.
  - PostgreSQL Row-Level Security (RLS) policies on core tables.
  - Inactivity timeout and session token management.

- **Phase 2 (`feature/transaction-atomicity-coa`)**:
  - Atomic PostgreSQL RPC `process_rpt_payment` for zero-gap payment posting.
  - Sequential Accountable Form 51 (AF-51) physical booklet register tracking.
  - Dual-custody supervisory receipt voiding workflow and audit log reversal.

- **Phase 3 (`feature/data-layer-tanstack`)**:
  - TanStack Query integration patterns for async server state management.
  - Debounced search, optimistic mutations, and realtime notification channels.

- **Phase 4 (`feature/deployment-abstraction`)**:
  - `ITreasuryRepository` interface contract decoupling UI from database drivers.
  - Supabase PostgREST driver (`SupabaseRepository.ts`) with schema-safe fallback.

- **Phase 5 (`feature/offline-tellering`)**:
  - IndexedDB offline transaction queue and local masterlist cache.
  - Automatic background sync engine with conflict resolution (`services/offline/`).

- **Phase 6 (`feature/statutory-reporting`)**:
  - BLGF Form 3 quarterly report generator.
  - RA 7160 Sec. 254 Notice of Delinquency batch printing engine.
  - RPTAR ledger audit exports (`features/reports/`).

- **Feature Branch (`feature/historical-assessed-values`)**:
  - Multi-era historical assessed values calculation & assessment breakdown (1974–1979, 1980–1984, etc.) per RA 7160 schedules.
  - Assessor attribution provenance chaining (`mergeEncoderLabel()`, `getPrimaryEncoder()`, 15 unit tests in `utils/encoderAttribution.test.ts`).
  - Automatic 1st-place priority sort for manually appraised properties in `DashboardTable.tsx` (`sortPropertiesWithManualFirst()`).
  - Manual #1 badge, provenance subtitle (`By: ...`), and search by assessor name in `DashboardTable.tsx`.
  - CSV staging table with attribution chaining in `BulkImportModal.tsx`.
  - Manual appraisal form wiring with `currentUser` in `RptarModal.tsx` and `App.tsx`.
  - Fixed user registration bug (`services/SupabaseRepository.ts`) by passing both `password` and `password_hash`.
  - Resolved root-cause database trigger conflict: updated `trg_users_hash_password` and dropped `NOT NULL` constraint on `users.password`.
  - Normalized migration timestamps (`20260912`, `20260913`, `20260914`, `20260916`) to satisfy Supabase CLI versioning.
  - Executed remote database sync (`npx supabase db push`) to live Supabase project `mmppbaimgdslhbwietbi`.

## In Progress

- End-to-end integration and workflow verification across User Management, Property Appraisal, CSV Import Attribution, and Tellering.

## Next Up

- Human lead review and acceptance of the attribution chaining, 1st-place manual sort, and user creation workflow.
- Prepare pull request / merge from `feature/historical-assessed-values` to `main`.

## Architecture Decisions

- **Attribution Chaining**: Provenance is stored as comma-delimited strings (`Assessor 1, Assessor 2`) in `properties.encoder_label`, preserving the historical sequence of annotators.
- **Manual 1st-Place Sort**: Manual properties (`entry_type === 'MANUAL'`) are sorted ahead of batch CSV imports, ordered by `updated_at DESC`.
- **Database Trigger Resilience**: The `trg_users_hash_password` PostgreSQL trigger conditionally hashes passwords into `password_hash` and retains compatibility with clients writing to either `password` or `password_hash`.

## Session Notes

- Active git branch: `feature/historical-assessed-values`.
- Dev server runs on `http://localhost:3000`.
- All 4 remote database migrations applied and verified.
