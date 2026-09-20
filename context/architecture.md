# Architecture Context — LGU Treasury Connect

> Current authority: Supabase Cloud for production datastore and Supabase Auth for production authentication. Local adapters support development and controlled testing only.

## Stack

| Layer | Technology | Role |
|---|---|---|
| **Framework** | React 18 + TypeScript (`strict: true`) + Vite | High-performance frontend SPA with strict type safety |
| **Styling** | Tailwind CSS v3 (local PostCSS) + CSS Variables | Zero external CDNs; Santa Rosa emerald and slate design system |
| **UI Primitives** | shadcn/ui headless accessible components | Standardized accessible primitives (`components/ui/`) |
| **Data Layer** | `ITreasuryRepository` driver abstraction | Keeps UI independent from storage while Supabase Cloud remains production authority |
| **Database** | PostgreSQL / Supabase PostgREST | Relational schemas, RPCs, views, and row-level security |
| **Testing** | Vitest (`taxLogic.test.ts`, `crypto.test.ts`) | Unit testing pure mathematical formulas and security helpers |
| **Icons & Charts**| Lucide React & Recharts | Modern SVG stroke icons and executive revenue visualizations |

## System Boundaries

- `features/` — Domain-sliced modules:
  - `auth/`: Login, User Management, Password Confirmation modals.
  - `dashboard/`: assessment and verification summary cards.
  - `properties/`: Masterlist table, RPTAR modal, Bulk CSV importer/exporter.
  - `assessment/`: Sequential Statement of Account (SOA) and Arrears-First table.
  - `audit/`: Revision trail and audit log viewer.
- `components/ui/` — Headless accessible shadcn primitives (`Button`, `Table`, `Badge`, `Input`, `Dialog`, `DropdownMenu`).
- `services/` — Storage drivers and contracts:
  - `ITreasuryRepository.ts`: The unified 29-operation domain repository interface.
  - `SupabaseRepository.ts`: Supabase PostgREST implementation with schema-safe mutations.
  - `api.ts`: Delegator providing seamless client access to the active repository driver.
- `utils/` — Pure statutory calculation engines:
  - `taxLogic.ts`: Pure RA 7160 tax calculation, discounts, and penalties.
  - `taxLogic.test.ts`: Vitest statutory assertion test suite.
- `docs/` — Canonical Single Source of Truth (`SSOT.md`), Roadmaps (`ROADMAP_AND_PHASES.md`), and Threat Models.
- `server/` — **DEAD CODE**: Inactive legacy Express/SQLite server. Do not touch or import.

## Storage Model

- **`properties` Table**: Real property masterlist holding TD number, PIN, owner, address, classification, area, market value, assessed value, last paid year, and shell record flag.
- **`delinquency_period_verifications` Table**: Arrears-first verification decisions, statuses, evidence references, and superseding links.
- **`rptar_audit_logs` Table**: Field-level audit trail for valuation adjustments, tax overrides, verification decisions, and reversals.
- **Legacy payment tables, if retained**: Read-only historical evidence only; never active collection data or writable application records.
- **`users` / Supabase Auth**: Supabase Auth identities with approved roles (`Admin`, `Assessor`) and assigned workstation context; application password hashes are prohibited.
- **`schedule_of_market_values` Table**: Barangay base rates and assessment levels.
- **`municipal_tax_settings` Table**: Configurable prompt/advance discount rates and effective tax years.
- **`localStorage` (Client-Side)**: Ephemeral working state persistence across browser reloads (`lgu_current_view`, `lgu_active_property`, `lgu_search_term`, `lgu_selected_barangay`, `lgu_selected_status`, `lgu_current_page`, `lgu_active_modal`).

## Auth and Access Model

- **Authentication**: Supabase Auth issues sessions; trusted JWT claims and database RLS enforce identity and access.
- **Inactivity Protection**: 15-minute idle workstation timeout with session lock.
- **Role-Based Access Control (RBAC)**:
  - `Admin`: User administration, policy configuration, authorized reversals, audit oversight, and approved masterlist operations.
  - `Assessor`: Property assessment, import review, historical AV provenance, delinquency verification, external evidence, and statement generation.
  - `SystemMaintenance`, if retained: non-production/service-only disposable test-data authority; no ordinary treasury workflows.
- **Dual Custody / Re-authentication**: Destructive or reversal actions require trusted Admin authorization and mandatory justification.

## Invariants (NEVER BREAK)

1. **Exact Statutory Tax Rate**: Base rate is exactly `2.00%` (`0.02`) of Assessed Value (`1.00%` Basic + `1.00%` SEF).
2. **Statutory Penalty Surcharge**: Exactly `2.00%` per month of delay, strictly capped at `36 months` (`72%` maximum statutory cap under RA 7160 Sec. 255).
3. **Arrears-First Sequential Settlement**: Taxpayers cannot settle current-year dues while prior-year delinquent liabilities exist. Dues must be settled chronologically starting from oldest unpaid year.
4. **Zero Deletion Invariant**: Financial records, payment postings, and delinquency milestones are never deleted. Reversals log immutable audit reasons.
5. **Shell Record Prohibition**: Properties with `is_shell_record = true` cannot have delinquency verified or clearance eligibility issued until certified by the Municipal Assessor.
6. **No Random Numbers**: Official receipt numbers or tracking references must never use `Math.random()`.
