# Progress Tracker — LGU Treasury Connect

Update this file after every meaningful implementation change.

## Current Phase

- **Phase 0 (Baseline Finalization on `main`)**: Clean and verified baseline established.
- **Repository Health**: 0 type errors, 0 lint warnings, 28/28 unit tests passing, production build passing.

## Current Goal

- Align repository documentation and developer context with the canonical **Six-File Context Methodology**.
- Maintain strict local git hygiene (local-only directive; zero remote pushes).

## Completed

- **Phase 0 Baseline**:
  - Refactored `DelinquencyTable.tsx` and `LoginPage.tsx` to shadcn/ui primitives.
  - Implemented updated login page with official Santa Rosa Municipal Seal showcase, emerald colorway, demo personnel quick-select, and show/hide password toggle.
  - Implemented `ITreasuryRepository` driver pattern isolating Supabase PostgREST into `SupabaseRepository.ts`.
  - Created PBKDF2 cryptographic token validation and inactivity session management in `lib/crypto.ts`.
  - Added full test coverage for tax calculations (`utils/taxLogic.test.ts`), transaction atomicity (`utils/transactionAtomicity.test.ts`), and crypto helpers (`lib/crypto.test.ts`).
  - Implemented reload work-state persistence (`localStorage`) restoring active views, active property inquiries, table filters, search terms, and open modals.
  - Established canonical Single Source of Truth ([`docs/SSOT.md`](file:///home/jeipyyy/Documents/Projects/Municipal-Treasurers-Office-LGU/docs/SSOT.md)) and Roadmaps ([`docs/ROADMAP_AND_PHASES.md`](file:///home/jeipyyy/Documents/Projects/Municipal-Treasurers-Office-LGU/docs/ROADMAP_AND_PHASES.md)).
  - Generated the 6 canonical context files and entry point in `context/` and `CLAUDE.md`.

## In Progress

- Reviewing context files with human lead before proceeding to Phase 1.

## Next Up

- **Phase 1 (`feature/security-and-auth`)**:
  - Replace plaintext passwords with Bcrypt hashing.
  - Implement real JWT sessions with Supabase Auth.
  - Enforce PostgreSQL Row-Level Security (RLS) on all tables.
- **Phase 2 (`feature/transaction-atomicity-coa`)**:
  - Atomic PostgreSQL RPC `process_rpt_payment`.
  - Sequential Accountable Form 51 (AF-51) physical booklet register.
  - Dual-custody supervisory receipt voiding workflow.

## Open Questions

1. **Assessor CSV Import Permission**: Does the Municipal Assessor have authorization to perform bulk property CSV imports directly, or is this restricted strictly to the Treasury Admin? (Noted as a pending policy question in `docs/SSOT.md §5.1`).
2. **Offline Field Tellering**: Will tax caravans require full offline IndexedDB caching and batch sync prior to provincial rollout? (Scheduled for Phase 5).

## Architecture Decisions

- **ITreasuryRepository Contract**: Decoupled UI components from raw database clients via a clean 29-operation domain interface, allowing zero-downtime swapping between Supabase Cloud and On-Premise local PostgreSQL servers.
- **Local-Only Git Policy**: AI agents operate under a strict prohibition against executing `git push`, ensuring all code changes remain local until vetted by the human owner.
- **Operational Boundary**: System acts as an assessment verification and status tracking platform rather than an online payment gateway, preserving COA financial audit integrity.

## Session Notes

- Active git branch: `main` (clean working tree).
- Dev server running on `http://localhost:3000`.
- Previous local modifications preserved on local branch `backup-local-state`.
