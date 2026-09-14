# Architecture Context — LGU Treasury Connect

## Stack

| Layer | Technology | Role |
|---|---|---|
| **Framework** | React 18 + TypeScript (`strict: true`) + Vite | High-performance frontend SPA with strict type safety |
| **Styling** | Tailwind CSS v3 (local PostCSS) + CSS Variables | Zero external CDNs; Santa Rosa emerald and slate design system |
| **UI Primitives** | shadcn/ui headless accessible components | Standardized accessible primitives (`components/ui/`) |
| **Data Layer** | `ITreasuryRepository` driver abstraction | Decouples UI from storage engines (Supabase Cloud vs. On-Premise) |
| **Database** | PostgreSQL / Supabase PostgREST | Relational schemas, RPCs, views, and row-level security |
| **Testing** | Vitest (`taxLogic.test.ts`, `crypto.test.ts`) | Unit testing pure mathematical formulas and security helpers |
| **Icons & Charts**| Lucide React & Recharts | Modern SVG stroke icons and executive revenue visualizations |

## System Boundaries

- `features/` — Domain-sliced modules:
  - `auth/`: Login, User Management, Password Confirmation modals.
  - `dashboard/`: KPI summary cards and revenue charts.
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
- **`delinquency_year_completions` Table**: Granular offline tax year settlement tracking (TD number, tax year, completed by, station ID, reference, remarks, created at).
- **`rptar_audit_logs` Table**: Field-level audit trail for every valuation adjustment, tax override, or completion reversal.
- **`payment_postings` Table**: Historical snapshot of official receipts (AF-51) with applied tax breakdowns.
- **`users` Table**: Municipal personnel accounts, roles (`Admin`, `Assessor`, `Cashier`, `Viewer`), password hashes, and assigned station IDs.
- **`schedule_of_market_values` Table**: Barangay base rates and assessment levels.
- **`municipal_tax_settings` Table**: Configurable prompt/advance discount rates and effective tax years.
- **`localStorage` (Client-Side)**: Ephemeral working state persistence across browser reloads (`lgu_current_view`, `lgu_active_property`, `lgu_search_term`, `lgu_selected_barangay`, `lgu_selected_status`, `lgu_current_page`, `lgu_active_modal`).

## Auth and Access Model

- **Authentication**: Credentials authenticated against hashed passwords in `users`. Verified JWT sessions stored in client storage.
- **Inactivity Protection**: 15-minute idle workstation timeout with auto-logout.
- **Role-Based Access Control (RBAC)**:
  - `Admin`: Full system access, user administration, property deletion, bulk import.
  - `Assessor`: Property creation, assessment adjustments, audit log inspection.
  - `Cashier`: Assessment calculation, delinquency clearance, Statement of Account issuance.
  - `Viewer`: Read-only access to dashboard and property masterlist.
- **Dual Custody / Re-authentication**: Destructive actions (deleting parcels, reversing settled years) require supervisory password confirmation.

## Invariants (NEVER BREAK)

1. **Exact Statutory Tax Rate**: Base rate is exactly `2.00%` (`0.02`) of Assessed Value (`1.00%` Basic + `1.00%` SEF).
2. **Statutory Penalty Surcharge**: Exactly `2.00%` per month of delay, strictly capped at `36 months` (`72%` maximum statutory cap under RA 7160 Sec. 255).
3. **Arrears-First Sequential Settlement**: Taxpayers cannot settle current-year dues while prior-year delinquent liabilities exist. Dues must be settled chronologically starting from oldest unpaid year.
4. **Zero Deletion Invariant**: Financial records, payment postings, and delinquency milestones are never deleted. Reversals log immutable audit reasons.
5. **Shell Record Prohibition**: Properties with `is_shell_record = true` cannot have dues cleared or receipts issued until certified by the Municipal Assessor.
6. **No Random Numbers**: Official receipt numbers or tracking references must never use `Math.random()`.
