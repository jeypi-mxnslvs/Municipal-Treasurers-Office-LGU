# AI PROJECT CONTEXT — LGU Treasury Connect

> **Use this document to onboard another AI or developer without scanning the codebase.**
> Last updated: 2026-09-01 from exhaustive code analysis.

---

## Project Purpose

LGU Treasury Connect is a **Real Property Tax Administration and Collection System** for the Municipal Treasurer's Office of **Santa Rosa, Nueva Ecija, Philippines**. It implements tax rules from **Republic Act No. 7160** (Local Government Code of 1991). It manages property tax declarations (RPTAR), computes delinquency with penalties, processes payment clearances, issues AF-51 official receipts, and provides executive KPI dashboards.

## Architecture

**Thick-Client SPA with Backend-as-a-Service (BaaS).** The React frontend handles ALL business logic (tax calculation, stats aggregation, receipt generation) and communicates directly with Supabase PostgreSQL via PostgREST. There is no intermediate application server.

**Dead code warning:** The repository contains a `server/` directory with a complete Express.js + SQLite REST API (auth, CRUD, payments, dashboard). **This is 100% inactive** — the React frontend makes zero calls to it. Ignore it unless specifically asked.

## Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS (CDN), Recharts, Lucide React
- **Backend:** Supabase Cloud (PostgreSQL + PostgREST)
- **Hosting:** Vercel (primary), GitHub Pages (alternative)
- **Testing:** None (no test framework or test files exist)

## Major Modules

| Module | File(s) | Role |
|:---|:---|:---|
| State Orchestrator | `App.tsx` (402 lines) | God object: owns all state, auth gating, view switching, data fetching, polling |
| API Client | `services/api.ts` (435 lines) | 16 async methods abstracting all Supabase table operations |
| Supabase Init | `services/supabase.ts` (7 lines) | `createClient(url, anonKey)` |
| Tax Engine | `utils/taxLogic.ts` (82 lines) | Pure function: RA 7160 tax + penalty calculation |
| Type Contracts | `types.ts` (124 lines) | 8 TypeScript interfaces |
| Constants | `constants.ts` (108 lines) | Tax rates, barangay list, property classes, mock data |
| UI Components | `components/` (14 files) | Login, Dashboard, Tables, Modals, Cards |

## Database (Supabase PostgreSQL)

5 tables, all with **RLS DISABLED** and **anon role has full CRUD privileges**:

1. **`users`** — Staff accounts with plaintext passwords, roles (Admin/Assessor/Viewer), station IDs
2. **`properties`** — RPTAR masterlist: TD number, owner, barangay, assessed value, `last_paid_year` (drives tax calc)
3. **`schedule_of_market_values`** — Per-barangay per-class tax base rates and assessment levels
4. **`payment_postings`** — AF-51 receipts with JSONB snapshot of paid tax year records
5. **`rptar_audit_logs`** — Immutable audit trail of all property mutations (also used as sync heartbeat)

Key relationship: `payment_postings.property_id` → `properties.id` (FK, CASCADE delete)

## APIs

No REST/GraphQL endpoints. The frontend calls Supabase directly via `@supabase/supabase-js` SDK:
- `supabase.from('table').select().eq().order()` patterns
- All 16 methods in `services/api.ts` map DB snake_case to TypeScript camelCase

## Authentication (CRITICALLY BROKEN)

1. Frontend queries `users` table using anonymous Supabase key
2. Password comparison happens **in the browser**: `if (user.password !== password)`
3. Token is a fake string: `"supabase-token-" + user.id`
4. Token is stored in `localStorage` but **never validated** on subsequent requests
5. All authorization (role checks for edit/delete/clearance) is **frontend-only JavaScript**
6. Anyone with the Supabase anonymous key can directly CRUD all tables via PostgREST

## Data Flows

1. **Load:** `App.tsx` → `api.getProperties()` + `api.getDashboardStats()` → state → props to components
2. **Tax calc:** Property data → `taxLogic.ts calculateTaxLiability()` → `TaxYearRecord[]` → DelinquencyTable
3. **Payment:** Selected records → `api.postPayment()` → UPDATE properties + INSERT payment_postings + INSERT audit log → OfficialReceipt
4. **Sync:** 7-second `setInterval` → `api.getSyncStatus()` → check latest audit log timestamp → if changed, silent reload + toast

## External Services

Only **Supabase Cloud** (`mmppbaimgdslhbwietbi.supabase.co`). No payment gateways, email, SMS, or other APIs.

## Important Business Rules (NEVER CHANGE WITHOUT LEGAL BASIS)

- **Base tax rate:** 2% of assessed value (`constants.ts`)
- **Penalty:** 2% per month delayed, capped at 36 months (72%)
- **Arrears-First:** Older delinquent years must be cleared before current/advance years
- **`CURRENT_YEAR`:** Hardcoded to 2026 in `constants.ts` — must be manually updated annually
- **Shell records:** `is_shell_record = true` means a property exists but has zero assessed value (e.g., from CSV import)
- **Audit trail:** Every property mutation MUST write to `rptar_audit_logs` with `assessor_name` and `station_id`

## Architectural Constraints

1. No component-level data fetching — all API calls originate from `App.tsx`
2. DB column names use snake_case; TypeScript uses camelCase — hand-mapped in `api.ts`
3. `schema.sql` role CHECK allows only ('Admin', 'Assessor', 'Viewer') but `types.ts` also defines 'Cashier' — **inconsistency**
4. Dashboard stats (`getDashboardStats`) fetches entire properties table into browser memory — scalability limit
5. Receipt numbers are random (`Math.random()`), not sequential
6. Some dashboard values are hardcoded/mock: `totalCollected: 125000`, `monthlyTrend` array

## Known Risks

| Severity | Risk |
|:---|:---|
| 🔴 CRITICAL | RLS disabled — anonymous key has full DB access |
| 🔴 CRITICAL | Plaintext passwords in database, verified client-side |
| 🔴 CRITICAL | Supabase credentials committed to `.env.local` |
| 🟠 HIGH | All authorization is frontend-only JavaScript |
| 🟠 HIGH | Receipt numbers use `Math.random()` — collision risk |
| 🟡 MEDIUM | Hardcoded audit attribution (logs "Juan Reyes" instead of actual user in some paths) |
| 🟡 MEDIUM | No input validation/sanitization library |
| 🟢 LOW | No tests of any kind |

## Technical Debt

- Entire `server/` directory (1000+ lines of dead Express/SQLite code)
- `utils/saveLogic.ts` — exports only a placeholder string (pseudo-code comments)
- `AuthModal.tsx`, `DebtChart.tsx`, `SearchBar.tsx` — likely unused components
- Hardcoded `CURRENT_YEAR = 2026` instead of `new Date().getFullYear()`
- God object `App.tsx` with 15+ `useState` hooks and 402 lines
- `Cashier` role in TypeScript but not in Supabase schema CHECK constraint

## Important Conventions

- Every mutation to `properties` must INSERT into `rptar_audit_logs`
- The sync system depends on `rptar_audit_logs` being the latest-write table
- All data mapping between DB and TypeScript happens in `services/api.ts`
- Run `npx tsc --noEmit` and `npm run build` after any modification to verify

## Change-Impact Rules

- **Touching `App.tsx`:** Cascades to almost all components (it prop-drills everything)
- **Touching `types.ts`:** Breaks all modules that import interfaces
- **Touching `api.ts` method signatures:** Breaks `App.tsx` and any component calling those methods
- **Touching `taxLogic.ts` output format:** Breaks `DelinquencyTable`, `OfficialReceiptModal`, `DashboardTable`
- **Touching Supabase schema (renaming columns):** Silently breaks `api.ts` field mappings
- **Enabling RLS:** Immediately breaks the entire app (no authenticated sessions exist)
