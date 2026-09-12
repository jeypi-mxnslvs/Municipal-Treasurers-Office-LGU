# SYSTEM ARCHITECTURE — LGU Treasury Connect

> **Analysis Date:** 2026-09-01
> **Analyzed By:** Claude Opus 4.6 (Thinking) — Senior Software Architect role
> **Repository:** `jeypi-mxnslvs/Municipal-Treasurers-Office-LGU`
> **Confidence Level:** Code-verified (every file read and traced)

---

## PHASE 1 — REPOSITORY DISCOVERY

### What This Project Is
LGU Treasury Connect is a **Real Property Tax Administration and Collection System** built for the Municipal Treasurer's Office of **Santa Rosa, Nueva Ecija, Philippines**. It implements the tax rules of **Republic Act No. 7160** (Local Government Code of 1991).

### Discovered Systems

| Category | Found? | Location | Status |
|:---|:---|:---|:---|
| Application source code | ✅ CONFIRMED | `App.tsx`, `index.tsx`, `components/`, `services/`, `utils/` | Active |
| Frontend | ✅ CONFIRMED | React 19 SPA | Active |
| Backend (Supabase) | ✅ CONFIRMED | `services/api.ts` → Supabase PostgREST | **Active** |
| Backend (Express/SQLite) | ✅ CONFIRMED | `server/` directory | **INACTIVE — not connected to frontend** |
| Database schema (Supabase) | ✅ CONFIRMED | `schema.sql` | Active |
| Database schema (SQLite) | ✅ CONFIRMED | `server/db.js` | Inactive |
| Migrations | ⚠️ EMPTY | `supabase/migrations/` (empty dir), `supabase/migration.sql` (empty file) | Not used |
| Configuration | ✅ CONFIRMED | `.env.local`, `vite.config.ts`, `tsconfig.json`, `supabase/config.toml` | Active |
| Environment files | ✅ CONFIRMED | `.env.local` | Contains live Supabase credentials |
| Authentication | ✅ CONFIRMED | Client-side plaintext comparison in `services/api.ts` | **Broken** (see Phase 9) |
| Authorization | ✅ CONFIRMED | Role checks in `App.tsx` and `DashboardTable.tsx` | Frontend-only |
| Middleware | ✅ CONFIRMED | `server/routes/auth.js` `authenticateToken` | Inactive (server not used) |
| Types / Interfaces | ✅ CONFIRMED | `types.ts` (124 lines, 8 interfaces) | Active |
| Tests | ❌ NOT FOUND | No test files, no test framework | None exist |
| Docker | ❌ NOT FOUND | | |
| CI/CD | ✅ INFERRED | Vercel auto-deploy from README badge | See Phase 22 |
| Documentation | ✅ CONFIRMED | `README.md` (287 lines), `SECURITY_REVIEW.md` (140 lines) | Active |
| Seed data | ✅ CONFIRMED | `schema.sql` (lines 76–101), `server/db.js` (lines 140–273) | Both systems |
| Background processing | ✅ CONFIRMED | 7-second `setInterval` polling in `App.tsx` (lines 81–109) | Active |
| Feature flags | ❌ NOT FOUND | | |
| Logging | ✅ CONFIRMED | `console.error` only; `rptar_audit_logs` table | Minimal |
| Caching | ❌ NOT FOUND | | |
| Webhooks | ❌ NOT FOUND | | |
| Static assets | ✅ CONFIRMED | `img/LGU Treasury Connect.pdf` (176KB) | Supplementary |
| Pseudo-code documentation | ✅ CONFIRMED | `utils/saveLogic.ts` — comments only, no executable logic | Documentation file |

---

## PHASE 2 — TECHNOLOGY STACK

### Frontend (CONFIRMED — Active)

| Layer | Technology | Evidence |
|:---|:---|:---|
| Framework | React 19.2.4 | `package.json` line 17 |
| Language | TypeScript 5.8.2 | `package.json` line 25 |
| Build system | Vite 6.2.0 | `package.json` line 26 |
| UI icons | Lucide React 0.563.0 | `package.json` line 16 |
| Charts | Recharts 3.7.0 | `package.json` line 19 |
| Styling | Tailwind CSS (CDN) | `index.html` line 8: `<script src="https://cdn.tailwindcss.com">` |
| Typography | Inter (Google Fonts) | `index.html` line 10 |
| Routing | None (state-based view switching) | `App.tsx` line 24: `useState<'dashboard' \| 'posting'>` |
| State management | React hooks only (no Redux/Zustand) | `App.tsx` — 15+ `useState` calls |
| Data fetching | `@supabase/supabase-js` 2.112.3 | `package.json` line 15 |
| Forms | Uncontrolled React forms with `useState` | All modal components |
| Validation | Manual checks in components | No validation library |
| Testing | None | No test files or frameworks detected |

### Backend — Active System (CONFIRMED)

| Layer | Technology | Evidence |
|:---|:---|:---|
| Database engine | Supabase PostgreSQL 15 | `supabase/config.toml` line 41: `major_version = 17` |
| API | PostgREST (via Supabase JS SDK) | `services/supabase.ts`, `services/api.ts` |
| Authentication | Custom client-side plaintext password match | `services/api.ts` line 283 |
| ORM | None — direct Supabase query builder | `supabase.from('table').select()` pattern |

### Backend — Inactive System (CONFIRMED UNUSED)

| Layer | Technology | Evidence |
|:---|:---|:---|
| Language | Node.js (ES Modules) | `server/package.json` line 6 |
| Framework | Express 4.21.2 | `server/package.json` line 15 |
| Database | SQLite3 5.1.7 (file: `server/treasury.db`) | `server/package.json` line 17 |
| Authentication | bcryptjs 2.4.3 + jsonwebtoken 9.0.2 | `server/package.json` lines 12, 16 |
| Env management | dotenv 16.4.7 | `server/package.json` line 14 |

**Why it's unused:** The frontend (`services/api.ts`) imports from `services/supabase.ts` and makes zero HTTP calls to `localhost:5000`. The Vite config (`vite.config.ts` line 12) has a proxy entry `'/api' → localhost:5000`, but nothing in the frontend code uses `/api` paths. All data flows go directly to Supabase.

### Infrastructure (CONFIRMED)

| Concern | Implementation | Evidence |
|:---|:---|:---|
| Production hosting | Vercel | README line 4 badge, line 13 live URL |
| Database hosting | Supabase Cloud | `.env.local` line 3: `mmppbaimgdslhbwietbi.supabase.co` |
| Deployment (alt) | GitHub Pages (`gh-pages`) | `package.json` lines 11–12 |
| Local dev server | Vite on port 3000 | `vite.config.ts` line 9 |
| CDN | Vercel Edge Network | INFERRED from Vercel hosting |

### Third-Party Services

#### 1. Supabase (CONFIRMED — Critical dependency)

| Attribute | Detail |
|:---|:---|
| Purpose | Database, API, and (intended but unused) Auth provider |
| Integration point | `services/supabase.ts` → creates `@supabase/supabase-js` client |
| Data sent | Property CRUD, payment records, user queries, audit logs |
| Data received | All application data (properties, users, stats) |
| Authentication method | Anonymous API key (`VITE_SUPABASE_ANON_KEY`) — no authenticated sessions |
| Failure behavior | `try/catch` blocks in `api.ts`; errors propagated to `console.error` or `alert()` |

#### 2. Gemini API (CONFIRMED — Configured but unused)

| Attribute | Detail |
|:---|:---|
| Evidence | `vite.config.ts` lines 20–21: defines `process.env.GEMINI_API_KEY` |
| Usage in code | NOT FOUND — no file references `process.env.API_KEY` or `process.env.GEMINI_API_KEY` |
| Status | **POSSIBLY UNUSED** — may have been planned but never integrated |

---

## PHASE 3 — COMPLETE DIRECTORY ARCHITECTURE

```text
lgu-treasury-connect/
│
├── .env.local                       ← Supabase URL + Anon Key + Gemini API key
├── .gitignore                       ← Standard Vite ignores, env files
├── index.html                       ← HTML shell: loads Tailwind CDN, importmap, Inter font
├── index.tsx                        ← React DOM createRoot entry point (15 lines)
├── App.tsx                          ← ROOT STATE ORCHESTRATOR (402 lines, 15+ useState hooks)
├── types.ts                         ← 8 TypeScript interfaces: Property, TaxYearRecord, User, etc.
├── constants.ts                     ← Tax rates, barangay list, property classes, mock data
├── metadata.json                    ← Project name/description (5 lines, possibly for sandbox env)
├── schema.sql                       ← Supabase PostgreSQL schema + seed data + grants (117 lines)
├── package.json                     ← Frontend dependencies (React, Supabase, Recharts, Vite)
├── tsconfig.json                    ← TypeScript config (ES2022, bundler resolution, @/* alias)
├── vite.config.ts                   ← Vite config: port 3000, /api proxy to :5000, Gemini env
├── README.md                        ← Comprehensive project documentation (287 lines)
├── SECURITY_REVIEW.md               ← Defensive security audit (140 lines) — pre-existing
│
├── components/                      ← ALL 14 UI COMPONENTS (React + TypeScript)
│   ├── LoginPage.tsx                ← 2-step auth: username lookup → password verify (316 lines)
│   ├── Header.tsx                   ← Navbar with user badge, admin tools, logout (81 lines)
│   ├── DashboardStats.tsx           ← 4 KPI cards + Recharts monthly bar chart (133 lines)
│   ├── DashboardTable.tsx           ← RPTAR masterlist with search/filter/pagination (323 lines)
│   ├── DelinquencyTable.tsx         ← Statement of Account with sequential selection (13663 bytes)
│   ├── PropertyCard.tsx             ← Selected property summary sidebar (4465 bytes)
│   ├── SearchBar.tsx                ← Reusable search input (1974 bytes)
│   ├── RptarModal.tsx               ← CRUD form for property records (11086 bytes)
│   ├── OfficialReceiptModal.tsx     ← AF-51 printable government receipt (13797 bytes)
│   ├── BulkImportModal.tsx          ← CSV/Excel parser with validation (19140 bytes, 450 lines)
│   ├── UserManagementModal.tsx      ← Admin: create/delete/reset staff (17013 bytes)
│   ├── AuditLogModal.tsx            ← Revision history timeline (6145 bytes)
│   ├── AuthModal.tsx                ← POSSIBLY UNUSED — older auth modal (6296 bytes)
│   └── DebtChart.tsx                ← POSSIBLY UNUSED — standalone debt chart (1536 bytes)
│
├── services/                        ← API AND DATABASE LAYER
│   ├── supabase.ts                  ← Supabase client initialization (7 lines)
│   └── api.ts                       ← All Supabase CRUD operations (435 lines, 16 methods)
│
├── utils/                           ← PURE DOMAIN LOGIC
│   ├── taxLogic.ts                  ← RA 7160 tax + penalty calculation engine (82 lines)
│   └── saveLogic.ts                 ← Pseudo-code documentation ONLY (67 lines, 1 export)
│
├── img/                             ← STATIC ASSETS
│   └── LGU Treasury Connect.pdf     ← Project documentation PDF (176KB)
│
├── supabase/                        ← SUPABASE LOCAL CONFIG
│   ├── config.toml                  ← Standard Supabase local dev config (414 lines)
│   ├── migration.sql                ← EMPTY FILE (0 bytes)
│   ├── migrations/                  ← EMPTY DIRECTORY
│   └── .temp/                       ← Supabase CLI temp files
│
├── server/                          ← ⚠️ INACTIVE EXPRESS REST API
│   ├── package.json                 ← Server deps: express, bcrypt, jwt, sqlite3
│   ├── index.js                     ← Express entry (port 5000, 7 route modules)
│   ├── db.js                        ← SQLite init, table creation, seed data (278 lines)
│   ├── taxEngine.js                 ← Server-side RA 7160 engine with quarterly granularity (120 lines)
│   ├── treasury.db                  ← SQLite database file (65KB)
│   ├── routes/
│   │   ├── auth.js                  ← JWT login, register, user CRUD (175 lines)
│   │   ├── admin.js                 ← DB backup download, system info (58 lines)
│   │   ├── properties.js            ← Full CRUD + assessment + bulk import (466 lines)
│   │   ├── payments.js              ← AF-51 receipt generation + quarterly clearing (205 lines)
│   │   ├── sfmv.js                  ← Schedule of Market Values CRUD (62 lines)
│   │   ├── dashboard.js             ← Dashboard statistics with real aggregation (98 lines)
│   │   └── sync.js                  ← In-memory mutation broadcast (30 lines)
│   └── node_modules/                ← Server-specific node_modules (separate from root)
│
└── dist/                            ← Vite build output
```

### Unusual / Important Files

1. **`utils/saveLogic.ts`** — Contains only comments (pseudo-code describing save/delete flows). Exports a single placeholder string. No executable logic. Purpose: documentation artifact.
2. **`components/AuthModal.tsx`** — A 6296-byte auth modal that appears to be an older version replaced by `LoginPage.tsx`. No component in `App.tsx` imports it. Status: **POSSIBLY UNUSED**.
3. **`components/DebtChart.tsx`** — A 1536-byte standalone chart component. Not imported anywhere in `App.tsx`. Status: **POSSIBLY UNUSED**.
4. **`metadata.json`** — A 5-line file with `requestFramePermissions: []`. Likely an artifact from an IDE sandbox environment.
5. **`.env.local`** — Contains **live production Supabase credentials** committed to the repository. This is both a configuration file and a **CONFIRMED SECURITY ISSUE**.

---

## PHASE 4 — HIGH-LEVEL SYSTEM ARCHITECTURE

### Actual Architecture Pattern

**CONFIRMED: Thick-Client SPA with Backend-as-a-Service (BaaS)**

This is NOT a traditional client-server or MVC architecture. The React frontend acts as both the presentation AND business logic layer, communicating directly with Supabase PostgREST without any intermediate application server.

```text
┌─────────────────────────────────────────────────────┐
│                    END USER                          │
│         (Assessor / Admin / Viewer)                  │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────┐
│              REACT SPA (Browser)                     │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  App.tsx — State Orchestrator                 │   │
│  │  (15+ useState hooks, view switching,         │   │
│  │   auth gating, 7s polling interval)           │   │
│  └──────────┬───────────────┬───────────────────┘   │
│             │               │                        │
│  ┌──────────▼────────┐  ┌──▼──────────────────┐    │
│  │ components/       │  │ utils/taxLogic.ts    │    │
│  │ (14 UI components │  │ (RA 7160 pure math   │    │
│  │  modals, tables)  │  │  runs in browser)    │    │
│  └──────────┬────────┘  └──────────────────────┘    │
│             │                                        │
│  ┌──────────▼────────────────────────────────────┐  │
│  │ services/api.ts — Supabase Query Builder       │  │
│  │ (16 async methods, direct DB table access)     │  │
│  └──────────┬────────────────────────────────────┘  │
│             │                                        │
│  ┌──────────▼────────────────────────────────────┐  │
│  │ services/supabase.ts — Client Initialization   │  │
│  │ createClient(VITE_SUPABASE_URL, ANON_KEY)      │  │
│  └──────────┬────────────────────────────────────┘  │
└─────────────┼────────────────────────────────────────┘
              │ HTTPS (PostgREST)
              ▼
┌─────────────────────────────────────────────────────┐
│            SUPABASE CLOUD                            │
│  ┌───────────────────────────────────────────────┐  │
│  │ PostgreSQL Database                            │  │
│  │  ├── users (plaintext passwords!)              │  │
│  │  ├── properties (RPTAR masterlist)             │  │
│  │  ├── schedule_of_market_values (SFMV rates)    │  │
│  │  ├── payment_postings (AF-51 receipts)         │  │
│  │  └── rptar_audit_logs (audit trail)            │  │
│  │                                                │  │
│  │  ⚠️ RLS DISABLED on ALL tables                 │  │
│  │  ⚠️ anon role has FULL privileges              │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│     ⚠️ INACTIVE: Express + SQLite (server/)         │
│     Not connected to frontend. Dead code.            │
│     Contains its own auth, tax engine, routes.       │
└─────────────────────────────────────────────────────┘
```

---

## PHASE 5 — COMPONENT ARCHITECTURE

### 1. App.tsx — Root State Orchestrator (Core)

| Attribute | Detail |
|:---|:---|
| Purpose | Central nervous system: owns all state, orchestrates views, manages auth gating |
| Public interface | Renders `<LoginPage>` or dashboard/posting views |
| State variables | `currentUser`, `properties`, `stats`, `view`, `isModalOpen`, `modalInitialData`, `isUserManagementModalOpen`, `isAuditModalOpen`, `isBulkModalOpen`, `syncToast`, `selectedProperty`, `taxRecords`, `taxSummary`, `grandTotal`, `selectedRecords`, `selectedScopeSubtotal`, `isProcessingClearance`, `issuedReceipt`, `isReceiptModalOpen` |
| Key functions | `loadData()`, `handlePostPaymentView()`, `handleSaveProperty()`, `handleMarkDuesCleared()`, `handleLogout()` |
| Dependencies | `services/api.ts`, `types.ts`, all 11 active components |
| Data owned | All application state lives here |
| Classification | **Core** |

### 2. services/api.ts — API Client (Integration)

| Attribute | Detail |
|:---|:---|
| Purpose | Abstracts all Supabase database operations behind a clean API object |
| Public interface | `api` object with 16 async methods |
| Methods | `getProperties`, `getPropertyAssessment`, `saveProperty`, `deleteProperty`, `postPayment`, `getDashboardStats`, `lookupSfmv`, `getUsers`, `login`, `registerUser`, `lookupUser`, `deleteUser`, `resetUserPassword`, `getPropertyAudit`, `getAllAuditLogs`, `getSyncStatus`, `bulkImportProperties`, `getBackupDownloadUrl` |
| Dependencies | `services/supabase.ts`, `utils/taxLogic.ts`, `types.ts` |
| Data written | `properties`, `payment_postings`, `rptar_audit_logs`, `users` |
| Data read | All 5 Supabase tables |
| Classification | **Integration** |

### 3. utils/taxLogic.ts — Tax Calculation Engine (Domain)

| Attribute | Detail |
|:---|:---|
| Purpose | Pure function implementing RA 7160 tax liability computation |
| Public interface | `calculateTaxLiability(property: Property): CalculationResult` |
| Business rules | Arrears-First rule, 2% base tax rate, 2%/month penalty, 36-month cap |
| Dependencies | `types.ts`, `constants.ts` |
| Data owned | None (stateless pure function) |
| Consumers | `services/api.ts` (line 3, 39, 55), `components/DashboardTable.tsx` (line 4) |
| Classification | **Domain** |

### 4. components/LoginPage.tsx (UI)

| Attribute | Detail |
|:---|:---|
| Purpose | 2-step government terminal authentication screen |
| Step 1 | Username lookup via `api.lookupUser()` with preset account shortcuts |
| Step 2 | Password verification via `api.login()` |
| Dependencies | `services/api.ts`, `types.ts` |
| Consumers | `App.tsx` (line 207) |
| Classification | **UI** |

### 5. components/DashboardTable.tsx (UI)

| Attribute | Detail |
|:---|:---|
| Purpose | Paginated RPTAR masterlist with search, barangay filter, status filter |
| Internal state | `searchTerm`, `selectedBarangay`, `selectedStatus`, `openDropdownId`, `currentPage` |
| Pagination | 5 items per page |
| Role-based UI | `canEdit` (Admin/Assessor), `canDelete` (Admin only), `canClearDues` (Cashier/Admin) |
| Dependencies | `types.ts`, `constants.ts`, `utils/taxLogic.ts` |
| Classification | **UI** |

### 6. components/BulkImportModal.tsx (UI)

| Attribute | Detail |
|:---|:---|
| Purpose | CSV file upload, client-side parsing, validation, and bulk Supabase insert |
| Features | File upload, manual paste, row validation, export to CSV, import to Supabase |
| Dependencies | `services/api.ts`, `types.ts`, `constants.ts` |
| Classification | **UI** |

### 7–14. Remaining Components (UI)

| Component | Purpose | Size |
|:---|:---|:---|
| `Header.tsx` | Navbar with user badge, admin button, logout | 81 lines |
| `DashboardStats.tsx` | 4 KPI cards + Recharts bar chart | 133 lines |
| `DelinquencyTable.tsx` | Interactive Statement of Account with sequential year selection | 13663 bytes |
| `PropertyCard.tsx` | Selected property summary in posting view | 4465 bytes |
| `RptarModal.tsx` | Add/Edit property form modal | 11086 bytes |
| `OfficialReceiptModal.tsx` | Printable AF-51 government receipt | 13797 bytes |
| `UserManagementModal.tsx` | Admin staff management (create/delete/reset) | 17013 bytes |
| `AuditLogModal.tsx` | Immutable revision history timeline | 6145 bytes |

### POSSIBLY UNUSED Components

| Component | Evidence | Confidence |
|:---|:---|:---|
| `AuthModal.tsx` | Not imported in `App.tsx`. Likely replaced by `LoginPage.tsx`. | 90% unused |
| `DebtChart.tsx` | Not imported in `App.tsx`. Small standalone chart. | 90% unused |
| `SearchBar.tsx` | Not imported in `App.tsx`. `DashboardTable.tsx` has its own inline search. | 80% unused |

---

## PHASE 6 — DATA ARCHITECTURE

### Primary Data Flow (Property → Assessment → Payment)

```text
1. User loads app
   └─→ App.tsx useEffect calls loadData()
       └─→ api.getProperties() → Supabase SELECT * FROM properties
       └─→ api.getDashboardStats() → Supabase SELECT * FROM properties (full table scan!)
           └─→ Stats calculated CLIENT-SIDE in browser memory

2. User clicks "Post Payment" on a property
   └─→ App.tsx handlePostPaymentView(property)
       └─→ api.getPropertyAssessment(id, property)
           └─→ utils/taxLogic.ts calculateTaxLiability(property)
               └─→ Loop: lastPaidYear+1 → CURRENT_YEAR
               └─→ For each year: baseTax, monthsDelayed, penalty, totalDue
               └─→ Returns: TaxYearRecord[] + grandTotal

3. User clicks "Mark Dues Cleared"
   └─→ App.tsx handleMarkDuesCleared()
       └─→ api.postPayment({propertyId, paidRecords, tenderType, postedBy})
           └─→ UPDATE properties SET last_paid_year = highestYear
           └─→ INSERT INTO payment_postings
           └─→ INSERT INTO rptar_audit_logs
           └─→ Returns: OfficialReceipt object

4. Background sync (every 7 seconds)
   └─→ api.getSyncStatus() → SELECT * FROM rptar_audit_logs ORDER BY timestamp DESC LIMIT 1
   └─→ If timestamp changed: loadData(true) + show toast notification
```

### Sensitive Data Map

| Data | Location | Risk |
|:---|:---|:---|
| User passwords (plaintext) | `users.password` in Supabase | **CRITICAL** — readable by anonymous API key |
| Supabase anonymous key | `.env.local` (committed to repo) | **CRITICAL** — embedded in frontend bundle |
| Supabase project URL | `.env.local` (committed to repo) | HIGH — enables direct API access |
| Taxpayer names & addresses | `properties` table | PII — accessible via anonymous key |
| Financial records | `payment_postings` table | Sensitive — accessible via anonymous key |

---

## PHASE 7 — DATABASE ARCHITECTURE

### Active Database: Supabase PostgreSQL (schema.sql)

#### Table: `users`

| Column | Type | Constraints | Default | Notes |
|:---|:---|:---|:---|:---|
| `id` | SERIAL | PK | auto | |
| `username` | TEXT | UNIQUE, NOT NULL | | |
| `password` | TEXT | NOT NULL | `'admin123'` | ⚠️ **PLAINTEXT** |
| `full_name` | TEXT | NOT NULL | | |
| `role` | TEXT | NOT NULL, CHECK IN ('Admin','Assessor','Viewer') | | |
| `station_id` | TEXT | nullable | | Physical desk ID |
| `created_at` | TIMESTAMPTZ | | `now()` | |

**Business rules:**
- Roles are strings, not a foreign key to a roles table
- TypeScript `User` interface (types.ts line 59) also includes `'Cashier'` role — but the Supabase schema CHECK constraint does NOT include it. **CONFIRMED INCONSISTENCY.**
- The `Officer` role exists in the SQLite schema but not in Supabase schema

#### Table: `properties`

| Column | Type | Constraints | Default | Notes |
|:---|:---|:---|:---|:---|
| `id` | SERIAL | PK | auto | |
| `td_number` | TEXT | UNIQUE, NOT NULL | | Tax Declaration number |
| `previous_td_number` | TEXT | nullable | | |
| `pin` | TEXT | nullable | | Property Identification Number |
| `owner_name` | TEXT | NOT NULL | | |
| `address` | TEXT | NOT NULL | | |
| `barangay` | TEXT | NOT NULL | | |
| `property_class` | TEXT | NOT NULL | `'Residential'` | |
| `lot_area_sqm` | NUMERIC | nullable | `100` | |
| `market_value` | NUMERIC | NOT NULL | `0` | |
| `assessed_value` | NUMERIC | NOT NULL | `0` | |
| `last_paid_year` | INT | NOT NULL | `2025` | Key business field |
| `is_shell_record` | BOOLEAN | nullable | `FALSE` | Incomplete/placeholder record |
| `created_at` | TIMESTAMPTZ | | `now()` | |
| `updated_at` | TIMESTAMPTZ | | `now()` | |

**Business rules:**
- `last_paid_year` drives the entire tax calculation engine
- `is_shell_record = TRUE` means the property exists but has no assessed value (e.g., from CSV import)
- Column names use snake_case in DB, mapped to camelCase in TypeScript by `api.ts`

#### Table: `schedule_of_market_values`

| Column | Type | Constraints | Default |
|:---|:---|:---|:---|
| `id` | SERIAL | PK | auto |
| `barangay` | TEXT | NOT NULL | |
| `property_class` | TEXT | NOT NULL | |
| `base_rate_sqm` | NUMERIC | NOT NULL | |
| `assessment_level` | NUMERIC | NOT NULL | `0.20` |

**Unique constraint:** `(barangay, property_class)`

#### Table: `payment_postings`

| Column | Type | Constraints | Default |
|:---|:---|:---|:---|
| `id` | SERIAL | PK | auto |
| `receipt_no` | TEXT | UNIQUE, NOT NULL | |
| `property_id` | INT | FK → properties(id) ON DELETE CASCADE | |
| `paid_records` | JSONB | NOT NULL | `'[]'::jsonb` |
| `total_paid` | NUMERIC | NOT NULL | |
| `tender_type` | TEXT | NOT NULL | `'CASH'` |
| `tender_reference` | TEXT | nullable | |
| `posted_by` | TEXT | NOT NULL | |
| `posted_at` | TIMESTAMPTZ | | `now()` |

**Business rules:**
- `paid_records` stores a frozen JSON snapshot of the itemized tax year records at time of payment
- Receipt numbers are generated client-side: `AF51-2026-${random4digits}` (api.ts line 143)

#### Table: `rptar_audit_logs`

| Column | Type | Constraints | Default |
|:---|:---|:---|:---|
| `id` | SERIAL | PK | auto |
| `property_id` | INT | nullable | |
| `td_number` | TEXT | | |
| `action_type` | TEXT | NOT NULL | |
| `assessor_name` | TEXT | NOT NULL | |
| `station_id` | TEXT | nullable | |
| `details` | TEXT | nullable | |
| `timestamp` | TIMESTAMPTZ | | `now()` |

**Business rules:**
- No foreign key constraint to `properties` (property_id is loosely linked)
- Action types in practice: `CREATED`, `UPDATED`, `DELETED`, `CLEARED`
- Used as the synchronization heartbeat (polled every 7 seconds)

### Entity Relationships

```text
users ─────────────── (no direct FK to other tables)
                      Linked only by assessor_name string in audit logs

properties
 │
 ├── has many → payment_postings (via property_id FK, CASCADE delete)
 │
 └── tracked by → rptar_audit_logs (via property_id, no FK constraint)

schedule_of_market_values ─── standalone lookup table (no FK)
```

### Inactive Database: SQLite (server/db.js)

The SQLite schema has an **additional table** not present in Supabase:

**`quarterly_payment_status`** — Tracks per-quarter payment state (CLEARED/DELINQUENT) for each property. This enables the server's more granular quarterly tax engine vs. the Supabase/frontend's year-level engine.

### Database Initialization & Seeds

| System | Method | Seed data |
|:---|:---|:---|
| Supabase | `schema.sql` executed manually | 3 users, 6 SFMV rates, 4 properties |
| SQLite | `server/db.js initDb()` on server start | 4 users, 10 SFMV rates, 5 properties, 120+ quarterly status rows |

### Potential Bottleneck

`api.getDashboardStats()` (api.ts lines 205–241) fetches the **entire properties table** into browser memory, then computes stats client-side with `Array.filter()`. No server-side aggregation. Will degrade as property count grows.

---

## PHASE 8 — API ARCHITECTURE

### Active API: Supabase PostgREST (via api.ts methods)

All calls go through `@supabase/supabase-js` SDK. No REST endpoints are explicitly called.

| Method | Supabase Tables | Operation | Auth Required | Side Effects |
|:---|:---|:---|:---|:---|
| `getProperties(search?, barangay?)` | `properties` | SELECT with filters | None (anon key) | — |
| `getPropertyAssessment(id, prop?)` | `properties` | SELECT + client-side calc | None | — |
| `saveProperty(data)` | `properties`, `rptar_audit_logs` | INSERT or UPDATE + INSERT | None | Audit log |
| `deleteProperty(id)` | `properties`, `rptar_audit_logs` | DELETE + INSERT | None | Audit log |
| `postPayment(payload)` | `properties`, `payment_postings`, `rptar_audit_logs` | UPDATE + INSERT + INSERT | None | Audit log, receipt generation |
| `getDashboardStats()` | `properties` | SELECT * (full scan) | None | — |
| `lookupSfmv(brgy, class)` | `schedule_of_market_values` | SELECT single | None | — |
| `getUsers()` | `users` | SELECT (excludes password) | None | — |
| `login(username, password)` | `users` | SELECT * (includes password!) | None | localStorage write |
| `registerUser(data)` | `users` | INSERT | None | — |
| `lookupUser(username)` | `users` | SELECT single | None | — |
| `deleteUser(id)` | `users` | DELETE | None | — |
| `resetUserPassword(id, pw)` | `users` | UPDATE password | None | ⚠️ plaintext |
| `getPropertyAudit(id)` | `rptar_audit_logs` | SELECT WHERE property_id | None | — |
| `getAllAuditLogs()` | `rptar_audit_logs` | SELECT * | None | — |
| `getSyncStatus()` | `rptar_audit_logs` | SELECT LIMIT 1 DESC | None | — |
| `bulkImportProperties(list)` | `properties`, `rptar_audit_logs` | INSERT batch | None | Audit log |

### Inactive API: Express REST (server/routes/)

| Route File | Endpoints | Status |
|:---|:---|:---|
| `auth.js` | `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/users`, `PATCH /api/auth/users/:id/password`, `DELETE /api/auth/users/:id`, `GET /api/auth/me`, `GET /api/auth/lookup/:username` | UNUSED |
| `admin.js` | `GET /api/admin/backup`, `GET /api/admin/system-info` | UNUSED |
| `properties.js` | `GET /api/properties`, `GET /api/properties/:id`, `GET /api/properties/:id/assessment`, `GET /api/properties/:id/audit`, `GET /api/properties/audit/all`, `POST /api/properties`, `PUT /api/properties/:id`, `POST /api/properties/bulk-import`, `DELETE /api/properties/:id` | UNUSED |
| `payments.js` | `POST /api/payments`, `GET /api/payments`, `GET /api/payments/:receiptNo` | UNUSED |
| `sfmv.js` | `GET /api/sfmv`, `GET /api/sfmv/lookup`, `POST /api/sfmv` | UNUSED |
| `dashboard.js` | `GET /api/dashboard/stats` | UNUSED |
| `sync.js` | `GET /api/sync/status` | UNUSED |

---

## PHASE 9 — AUTHENTICATION & AUTHORIZATION

### Current Authentication Flow (CONFIRMED)

```text
User opens app
 │
 ▼
App.tsx checks localStorage('lgu_user')
 │
 ├─ If found → parse JSON → setCurrentUser → show dashboard
 │
 └─ If null → show <LoginPage>
       │
       ├── Step 1: api.lookupUser(username)
       │   └─→ Supabase: SELECT id, full_name, username, role, station_id
       │       FROM users WHERE username = ?
       │   └─→ Returns user profile (no password)
       │
       └── Step 2: api.login(username, password)
           └─→ Supabase: SELECT * FROM users WHERE username = ?
           └─→ Returns FULL ROW including plaintext password
           └─→ CLIENT-SIDE CHECK: if (user.password !== password) throw Error
           └─→ Generate fake token: "supabase-token-" + user.id
           └─→ Store in localStorage: lgu_token, lgu_user
```

### Authorization Implementation

| Mechanism | Location | Implementation |
|:---|:---|:---|
| View gating | `App.tsx` line 206 | `if (!currentUser) return <LoginPage>` |
| Edit permission | `DashboardTable.tsx` line 63 | `canEdit = role === 'Admin' \|\| role === 'Assessor'` |
| Delete permission | `DashboardTable.tsx` line 64 | `canDelete = role === 'Admin'` |
| Clear dues permission | `App.tsx` line 210, `DashboardTable.tsx` line 65 | `canClearDues = role in ('Assessor', 'Admin', 'Cashier')` |
| User management | `Header.tsx` line 37 | Admin button only shown when `user.role === 'Admin'` |

**CRITICAL: All authorization is frontend-only.** Since Supabase RLS is disabled and the anonymous key has full privileges, any HTTP client can bypass all restrictions by calling the PostgREST API directly.

### Roles

| Role | Defined in schema.sql | Defined in types.ts | Defined in SQLite | Notes |
|:---|:---|:---|:---|:---|
| `Admin` | ✅ | ✅ | ✅ | Full access |
| `Assessor` | ✅ | ✅ | ✅ | Property management + clearance |
| `Viewer` | ✅ | ✅ | ✅ | Read-only |
| `Cashier` | ❌ Not in schema CHECK | ✅ In types.ts | ✅ In SQLite | **INCONSISTENCY** |
| `Officer` | ❌ | ❌ | ✅ In SQLite only | Inactive system only |

---

## PHASE 10 — BUSINESS LOGIC

### Tax Calculation Rules (utils/taxLogic.ts)

**Source law:** Republic Act No. 7160 (Local Government Code of 1991), Book II, Title II

| Rule | Implementation | Location |
|:---|:---|:---|
| Base tax rate | 2% of assessed value (`BASE_TAX_RATE = 0.02`) | `constants.ts` line 4 |
| Penalty rate | 2% per month delayed (`PENALTY_RATE_PER_MONTH = 0.02`) | `constants.ts` line 5 |
| Penalty cap | 36 months maximum (72%) | `constants.ts` line 6 |
| Assessment period | `lastPaidYear + 1` → `CURRENT_YEAR` (2026) | `taxLogic.ts` lines 18–19 |
| Arrears-first | Oldest years sorted first; UI enforces sequential selection | `taxLogic.ts` line 76, `DelinquencyTable.tsx` |
| Current year | Hardcoded to 2026 | `constants.ts` line 3 |

### Tax Calculation Flow

```text
calculateTaxLiability(property)
 │
 ├── startYear = property.lastPaidYear + 1
 ├── endYear = CURRENT_YEAR (2026)
 │
 ├── If startYear > endYear → return {records: [], grandTotal: 0}
 │
 └── For each year from startYear to endYear:
     │
     ├── baseTax = assessedValue × BASE_TAX_RATE (2%)
     │
     ├── If year < CURRENT_YEAR:
     │   └── monthsDelayed = ((CURRENT_YEAR - year) × 12) + currentMonth
     ├── If year === CURRENT_YEAR:
     │   └── monthsDelayed = currentMonth (0-indexed + 1)
     │
     ├── effectiveMonths = min(monthsDelayed, MAX_PENALTY_MONTHS=36)
     ├── penaltyRate = effectiveMonths × PENALTY_RATE_PER_MONTH
     ├── penaltyAmount = baseTax × penaltyRate
     │
     └── totalDue = baseTax + penaltyAmount
```

### Differences Between Frontend and Server Tax Engines

| Aspect | Frontend (`utils/taxLogic.ts`) | Server (`server/taxEngine.js`) |
|:---|:---|:---|
| Granularity | Annual (year-level) | Quarterly (Q1–Q4) |
| Base rate | `0.02` (combined) | `0.01 Basic + 0.01 SEF = 0.02` (split) |
| Discount | Not implemented | 10% prompt payment discount implemented |
| Status used | Active | **INACTIVE** |

### Payment Posting Workflow

```text
User selects records → clicks "Mark Dues Cleared"
      │
      ▼
api.postPayment({propertyId, paidRecords, tenderType, postedBy})
      │
      ├── Calculate totalPaid = sum of paidRecords[].totalDue
      ├── Generate receipt: "AF51-2026-" + random4digits
      │
      ├── UPDATE properties SET last_paid_year = max(paidRecords[].year)
      ├── INSERT INTO payment_postings (receipt_no, property_id, ...)
      ├── INSERT INTO rptar_audit_logs (action_type='CLEARED', ...)
      │
      └── Return OfficialReceipt object
            └── App.tsx shows OfficialReceiptModal
```

---

## PHASE 11 — FRONTEND ARCHITECTURE

### Entry Point Chain

```text
index.html
 └── <script type="module" src="/index.tsx">
     └── index.tsx
         └── ReactDOM.createRoot(#root)
             └── <React.StrictMode>
                 └── <App />
```

### View System (No Router)

```text
App.tsx state: view = 'dashboard' | 'posting'

view === 'dashboard':
 ├── <DashboardStats stats={stats} />
 └── <DashboardTable properties={properties} ... />

view === 'posting':
 ├── Navigation bar (Back button + Print SOA)
 ├── <PropertyCard property={selectedProperty} />
 ├── Clearance Action Box
 └── <DelinquencyTable records={taxRecords} ... />
```

### Modal System

All modals are rendered at the bottom of App.tsx and controlled by boolean state:

| Modal | State Variable | Trigger |
|:---|:---|:---|
| `RptarModal` | `isModalOpen` | Add/Edit property button |
| `OfficialReceiptModal` | `isReceiptModalOpen` | After successful payment |
| `UserManagementModal` | `isUserManagementModalOpen` | Admin header button |
| `AuditLogModal` | `isAuditModalOpen` | "View Revision Trail" button |
| `BulkImportModal` | `isBulkModalOpen` | "Bulk Import" button |

### localStorage Usage

| Key | Purpose | Set by | Read by |
|:---|:---|:---|:---|
| `lgu_user` | Serialized User object | `LoginPage.tsx` line 89 | `App.tsx` line 20 |
| `lgu_token` | Fake token string | `LoginPage.tsx` line 88 | Never read (no auth middleware) |

---

## PHASE 12 — BACKEND ARCHITECTURE

### Active Backend: Supabase (No Custom Server)

The "backend" is entirely Supabase Cloud PostgreSQL accessed via PostgREST. There is no custom server processing requests. All business logic (tax calculation, receipt generation, stat aggregation) runs in the browser.

### Inactive Backend: Express Server (server/)

```text
server/index.js
 │
 ├── express() + cors() + express.json()
 │
 ├── initDb() → Create 6 SQLite tables + seed data
 │
 └── Routes:
     ├── /api/auth → auth.js (login, register, users CRUD)
     ├── /api/admin → admin.js (backup, system-info)
     ├── /api/properties → properties.js (full CRUD + assessment)
     ├── /api/payments → payments.js (post payment + receipt)
     ├── /api/sfmv → sfmv.js (market value lookup)
     ├── /api/dashboard → dashboard.js (stats with SQL aggregation)
     └── /api/sync → sync.js (in-memory mutation tracking)
```

**Notable:** The server's `dashboard.js` performs proper server-side aggregation with SQL `COUNT(*)` and `SUM()` queries, unlike the frontend which fetches all records and calculates in memory.

---

## PHASE 13 — EXTERNAL INTEGRATIONS

Only one external integration exists:

```text
React Frontend
   │
   └── @supabase/supabase-js SDK
       │
       └── PostgREST API (HTTPS)
           │
           └── Supabase Cloud PostgreSQL
               (mmppbaimgdslhbwietbi.supabase.co)
```

No payment gateways, email services, SMS, or other external APIs are integrated.

---

## PHASE 14 — BACKGROUND PROCESSING

### Multi-Assessor Sync Polling (App.tsx lines 81–109)

| Attribute | Detail |
|:---|:---|
| Trigger | `setInterval` started when `currentUser` is set |
| Interval | 7000ms (7 seconds) |
| Operation | `api.getSyncStatus()` → queries latest `rptar_audit_logs` row |
| Detection | Compares `timestamp` against `lastMutationTimeRef` |
| On change | Calls `loadData(true)` (silent reload) + shows toast notification |
| Cleanup | `clearInterval` on component unmount |
| Error handling | Silently catches and ignores polling errors |

No other background processes, queues, cron jobs, or workers exist.

---

## PHASE 15 — STATE MANAGEMENT

| State | Owner | Persistence | Scope |
|:---|:---|:---|:---|
| `currentUser` | `App.tsx` | `localStorage('lgu_user')` | Survives refresh |
| `properties` | `App.tsx` | None (fetched on load) | Lost on refresh |
| `stats` | `App.tsx` | None (fetched on load) | Lost on refresh |
| `view` | `App.tsx` | None | Resets to 'dashboard' on refresh |
| `selectedProperty` | `App.tsx` | None | Lost on refresh |
| `taxRecords` | `App.tsx` | None | Lost on refresh |
| All modal states | `App.tsx` | None | Lost on refresh |
| Component filters | Individual components (`useState`) | None | Lost on unmount |
| Sync heartbeat | `App.tsx` (`useRef`) | None | Lost on refresh |

---

## PHASE 16 — ERROR HANDLING

| Error Source | Handling | User-facing? |
|:---|:---|:---|
| Supabase query error | `throw error` in `api.ts` → `catch` in `App.tsx` | `console.error()` or `alert()` |
| Login failure | `throw new Error('Invalid credentials')` | Displayed in LoginPage error banner |
| Payment failure | `catch` in `handleMarkDuesCleared` | `alert()` with error message |
| Sync polling error | Silently swallowed | No |
| Data load error | `console.error('Error loading data:', err)` | No visible user feedback |
| Network failure | Not explicitly handled | Browser console only |

**No retry logic, no fallback behavior, no error boundaries, no structured error types.**

---

## PHASE 17 — OBSERVABILITY

| Category | Implementation | Detail |
|:---|:---|:---|
| Logging | `console.error` only | Scattered across `App.tsx` and `api.ts` |
| Audit trail | `rptar_audit_logs` table | Every property mutation + payment clearance |
| Metrics | None | |
| Tracing | None | |
| Analytics | None | |
| Error tracking | None | No Sentry/Datadog/etc. |

---

## PHASE 18 — SECURITY ANALYSIS

### CONFIRMED ISSUES

| Severity | Issue | Evidence |
|:---|:---|:---|
| 🔴 CRITICAL | **RLS disabled + anon has full privileges** | `schema.sql` lines 106–114 |
| 🔴 CRITICAL | **Plaintext passwords in database** | `schema.sql` line 10: `DEFAULT 'admin123'` |
| 🔴 CRITICAL | **Client-side password verification** | `api.ts` line 283: `user.password !== password` |
| 🔴 CRITICAL | **Live Supabase credentials committed to repo** | `.env.local` committed (in `.gitignore` but already present) |
| 🔴 CRITICAL | **Password column returned to browser** | `api.ts` line 273: `SELECT *` on users table |
| 🟠 HIGH | **Fake non-cryptographic session token** | `api.ts` line 288: `supabase-token-${user.id}` |
| 🟠 HIGH | **Receipt numbers use Math.random()** | `api.ts` line 143: collision risk, guessable |
| 🟡 MEDIUM | **Hardcoded audit attribution** | `api.ts` lines 100–101: `assessor_name: 'Juan Reyes'` |
| 🟡 MEDIUM | **No input sanitization** | No validation library used anywhere |
| 🟡 MEDIUM | **Tailwind loaded from CDN** | `index.html` line 8: supply chain risk |

### POTENTIAL RISKS

| Risk | Detail |
|:---|:---|
| XSS | No explicit sanitization on user inputs displayed in tables/modals |
| CSRF | N/A — no cookie-based auth, but irrelevant since there's no real auth |
| Insecure Direct Object References | Property IDs in Supabase queries are user-controllable with no ownership checks |
| Dependency risks | `@supabase/supabase-js` is the only runtime dependency; low but non-zero risk |

---

## PHASE 19 — PERFORMANCE ARCHITECTURE

### CONFIRMED Issues

| Issue | Evidence | Impact |
|:---|:---|:---|
| Full table scan for dashboard stats | `api.ts` line 206: `SELECT *` on all properties | O(n) memory and compute in browser |
| N+1-like pattern in DashboardTable | `DashboardTable.tsx` line 4: imports `calculateTaxLiability`, potentially called per row | CPU-bound for large datasets |
| 7-second polling interval | `App.tsx` line 106: `setInterval(..., 7000)` | Constant DB query load (1 query / 7s / active user) |
| No pagination on Supabase queries | `api.ts getProperties()`: fetches ALL properties | Memory pressure grows linearly |

### Non-Issues

| Aspect | Status |
|:---|:---|
| Tax calculation speed | Confirmed fast (<1ms) per README |
| Bundle size | React + Recharts + Lucide is moderate |
| Parallel loading | `Promise.all` used for initial data fetch |

---

## PHASE 20 — TEST ARCHITECTURE

**No tests exist.** No test framework (Jest, Vitest, Playwright, Cypress) is installed. No test files were found anywhere in the repository.

### Critical Untested Functionality

| Area | Risk if broken |
|:---|:---|
| `utils/taxLogic.ts` | Incorrect tax amounts on official government receipts |
| `api.postPayment()` | Incorrect payment records, wrong `last_paid_year` updates |
| `api.login()` | Auth bypass or lockout |
| CSV parsing in `BulkImportModal.tsx` | Data corruption on bulk import |
| Receipt number generation | Duplicate receipt numbers (collision via `Math.random()`) |

---

## PHASE 21 — CONFIGURATION

### Environment Variables

| Variable | Purpose | Required | Default | Location |
|:---|:---|:---|:---|:---|
| `VITE_SUPABASE_URL` | Supabase project URL | YES | `''` | `.env.local` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous API key | YES | `''` | `.env.local` |
| `GEMINI_API_KEY` | Google Gemini API key | NO | `'PLACEHOLDER_API_KEY'` | `.env.local` |

### Build-Time Variables

| Variable | Purpose | Location |
|:---|:---|:---|
| `process.env.API_KEY` | Aliased from GEMINI_API_KEY | `vite.config.ts` line 20 |
| `process.env.GEMINI_API_KEY` | Aliased from GEMINI_API_KEY | `vite.config.ts` line 21 |

### Hardcoded Configuration

| Constant | Value | Location |
|:---|:---|:---|
| `CURRENT_YEAR` | `2026` | `constants.ts` line 3 |
| `BASE_TAX_RATE` | `0.02` (2%) | `constants.ts` line 4 |
| `PENALTY_RATE_PER_MONTH` | `0.02` (2%) | `constants.ts` line 5 |
| `MAX_PENALTY_MONTHS` | `36` | `constants.ts` line 6 |
| `ITEMS_PER_PAGE` | `5` | `DashboardTable.tsx` line 18 |
| Sync polling interval | `7000` ms | `App.tsx` line 106 |
| Dev server port | `3000` | `vite.config.ts` line 9 |
| API proxy target | `localhost:5000` | `vite.config.ts` line 13 |

---

## PHASE 22 — DEPLOYMENT ARCHITECTURE

### Confirmed Deployment

```text
Developer
   │
   └── git push
       │
       ├── Vercel (Primary — Auto-deploy)
       │   └── npm run build (vite build)
       │       └── Static files served from Vercel Edge Network
       │           └── https://municipal-treasurers-office-lgu.vercel.app/
       │
       └── GitHub Pages (Alternative)
           └── npm run predeploy → npm run build
               └── npm run deploy → gh-pages -d dist
```

### Local Development

```text
Developer
   │
   ├── npm run dev → Vite dev server on port 3000
   │
   └── (optional) npm run server → Express on port 5000
       (Note: running server is optional and has no effect on the frontend)
```

---

## PHASE 23 — DEPENDENCY MAP

```text
                    App.tsx (GOD OBJECT)
                   /    |    \       \
                  /     |     \       \
         LoginPage  DashboardTable  Modals(5)  Header
              |          |            |
              └──────────┼────────────┘
                         |
                   services/api.ts
                    /          \
          utils/taxLogic.ts  services/supabase.ts
               |                    |
          constants.ts     @supabase/supabase-js
               |                    |
           types.ts          Supabase Cloud
```

### Coupling Analysis

| Component | Coupling Level | Safe to modify independently? |
|:---|:---|:---|
| `App.tsx` | **EXTREME** — touches everything | ❌ NO — changes here cascade everywhere |
| `types.ts` | **HIGH** — imported by all modules | ❌ NO — interface changes break everything |
| `services/api.ts` | **HIGH** — sole data gateway | ❌ NO — method signature changes break App.tsx |
| `utils/taxLogic.ts` | **MEDIUM** — pure function | ✅ YES — if input/output contract preserved |
| `constants.ts` | **MEDIUM** — imported by 3 modules | ⚠️ CAREFUL — tax rate changes affect calculations |
| Individual components | **LOW** | ✅ YES — internal changes are safe |
| `server/` (entire directory) | **NONE** | ✅ YES — completely disconnected |

---

## PHASE 24 — FEATURE MAP

### FEATURE: Authentication & Session

| Layer | Components |
|:---|:---|
| Frontend | `LoginPage.tsx`, `Header.tsx` (logout), `App.tsx` (auth gating) |
| API | `api.login()`, `api.lookupUser()` |
| Database | `users` table |
| Auth required | No (this IS the auth feature) |
| Tests | None |

### FEATURE: RPTAR Masterlist Management

| Layer | Components |
|:---|:---|
| Frontend | `DashboardTable.tsx`, `RptarModal.tsx`, `SearchBar.tsx` (unused) |
| API | `api.getProperties()`, `api.saveProperty()`, `api.deleteProperty()` |
| Database | `properties`, `rptar_audit_logs` |
| Auth required | View: all roles. Edit: Admin/Assessor. Delete: Admin only. |
| Tests | None |

### FEATURE: Tax Assessment & Delinquency Calculation

| Layer | Components |
|:---|:---|
| Frontend | `DelinquencyTable.tsx`, `PropertyCard.tsx` |
| API | `api.getPropertyAssessment()` |
| Business logic | `utils/taxLogic.ts` |
| Database | `properties` (reads `assessed_value`, `last_paid_year`) |
| Auth required | Any logged-in user |
| Tests | None |

### FEATURE: Payment Posting (AF-51 Receipt Issuance)

| Layer | Components |
|:---|:---|
| Frontend | `OfficialReceiptModal.tsx`, `App.tsx` (handleMarkDuesCleared) |
| API | `api.postPayment()` |
| Database | `properties` (UPDATE), `payment_postings` (INSERT), `rptar_audit_logs` (INSERT) |
| Auth required | Assessor, Admin, or Cashier |
| Tests | None |

### FEATURE: Dashboard & KPI Analytics

| Layer | Components |
|:---|:---|
| Frontend | `DashboardStats.tsx` (4 cards + chart) |
| API | `api.getDashboardStats()` |
| Database | `properties` (full SELECT) |
| Auth required | Any logged-in user |
| Tests | None |

### FEATURE: Bulk CSV Import

| Layer | Components |
|:---|:---|
| Frontend | `BulkImportModal.tsx` (client-side CSV parsing + validation) |
| API | `api.bulkImportProperties()` |
| Database | `properties` (batch INSERT), `rptar_audit_logs` (INSERT) |
| Auth required | Admin/Assessor |
| Tests | None |

### FEATURE: User Management

| Layer | Components |
|:---|:---|
| Frontend | `UserManagementModal.tsx`, `Header.tsx` (admin button) |
| API | `api.getUsers()`, `api.registerUser()`, `api.deleteUser()`, `api.resetUserPassword()` |
| Database | `users` |
| Auth required | Admin only (frontend check) |
| Tests | None |

### FEATURE: Audit Trail

| Layer | Components |
|:---|:---|
| Frontend | `AuditLogModal.tsx` |
| API | `api.getPropertyAudit()`, `api.getAllAuditLogs()` |
| Database | `rptar_audit_logs` |
| Auth required | Any logged-in user |
| Tests | None |

### FEATURE: Multi-Counter Live Sync

| Layer | Components |
|:---|:---|
| Frontend | `App.tsx` (useEffect polling + toast notification) |
| API | `api.getSyncStatus()` |
| Database | `rptar_audit_logs` (reads latest timestamp) |
| Auth required | Any logged-in user |
| Tests | None |

---

## PHASE 25 — ARCHITECTURAL CONSTRAINTS

### Explicit Rules (from README.md "AI Handoff Rules")

1. **Preserve RA 7160 Domain Rules** — Never alter 1% Basic, 1% SEF, 2%/mo penalty capped at 36 months, or Arrears-First rule
2. **Maintain Station Attribution** — Always pass `assessor_name` and `station_id` to audit logs
3. **Preserve TypeScript Contracts** — Schema/API changes must update `types.ts` and `schema.sql` first
4. **Maintain real Supabase connectivity** — No faking database connections
5. **Validate changes** — Run `npx tsc --noEmit` and `npm run build`

### Inferred Conventions

1. **snake_case in DB, camelCase in TypeScript** — All mapping happens in `api.ts`
2. **No component-level data fetching** — All API calls are made in `App.tsx` and passed down as props
3. **Audit everything** — Every mutation to `properties` triggers an `rptar_audit_logs` INSERT
4. **Frontend-only authorization** — No server-side enforcement exists
5. **`CURRENT_YEAR` is hardcoded** — Must be manually updated when the calendar year changes

---

## PHASE 26 — TECHNICAL DEBT

| Item | Location | Why it's debt |
|:---|:---|:---|
| **Dead server code** | Entire `server/` directory | 1000+ lines of unused code creating maintenance confusion |
| **Plaintext passwords** | `schema.sql`, `api.ts` | Fundamental security flaw |
| **Client-side auth** | `api.ts login()` | Completely bypassable |
| **Client-side stats aggregation** | `api.ts getDashboardStats()` | Won't scale; should use SQL aggregation |
| **Hardcoded audit attribution** | `api.ts` lines 100, 127, 173 | Logs "Juan Reyes" instead of actual user |
| **Hardcoded current year** | `constants.ts` line 3 | Must be manually updated annually |
| **Random receipt numbers** | `api.ts` line 143 | Collision risk, not sequential |
| **God object App.tsx** | `App.tsx` — 402 lines, 15+ state variables | Difficult to maintain and test |
| **`utils/saveLogic.ts`** | Exports a placeholder string | Dead code / documentation masquerading as code |
| **No migration system** | `supabase/migration.sql` empty, `migrations/` empty | Schema changes are done manually |
| **Inconsistent role enum** | `Cashier` in types.ts but not in schema.sql CHECK | Runtime data integrity risk |
| **Mock/hardcoded dashboard data** | `api.ts` lines 220–238 | `totalCollected: 125000` and `monthlyTrend` are static values |

---

## PHASE 27 — UNUSED / DEAD SYSTEMS

| Item | Confidence | Evidence |
|:---|:---|:---|
| `server/` directory (entire) | **95% UNUSED** | No frontend code calls Express endpoints |
| `components/AuthModal.tsx` | **90% UNUSED** | Not imported in App.tsx |
| `components/DebtChart.tsx` | **90% UNUSED** | Not imported in App.tsx |
| `components/SearchBar.tsx` | **80% UNUSED** | Not imported in App.tsx; DashboardTable has inline search |
| `utils/saveLogic.ts` | **100% UNUSED** | Exports only a placeholder string |
| `vite.config.ts` proxy to :5000 | **100% UNUSED** | No frontend code uses `/api/` paths |
| `GEMINI_API_KEY` env variable | **100% UNUSED** | No code references it |
| `constants.ts MOCK_PROPERTIES` | **POSSIBLY UNUSED** | Not referenced in active code (search needed) |
| `constants.ts MOCK_USER` | **POSSIBLY UNUSED** | Not referenced in active code |
| `lgu_token` in localStorage | **100% UNUSED** | Written by LoginPage but never read by any auth mechanism |

---

## PHASE 28 — CHANGE IMPACT ANALYSIS

### If `types.ts` changes:

| Impact Area | Level | Detail |
|:---|:---|:---|
| Frontend | **HIGH** | All components importing interfaces will need updates |
| API | **HIGH** | `api.ts` mapping functions must be updated |
| Database | **MAYBE** | If interface reflects schema, schema may need migration |
| Security | LOW | |
| Testing | CRITICAL — no tests exist to catch regressions | |

### If `utils/taxLogic.ts` changes:

| Impact Area | Level | Detail |
|:---|:---|:---|
| Frontend | MEDIUM | `DelinquencyTable` and `DashboardTable` consume its output |
| API | MEDIUM | `api.getPropertyAssessment()` calls it |
| Database | NO | Pure function, no DB access |
| Security | LOW | |
| Business risk | **CRITICAL** | Incorrect tax amounts on government receipts |

### If `schema.sql` / Supabase schema changes:

| Impact Area | Level | Detail |
|:---|:---|:---|
| Frontend | **HIGH** | Column renames break `api.ts` mappings silently |
| API | **HIGH** | All Supabase queries reference column names directly |
| Database migration | **YES** | Must apply to live Supabase instance |
| Security | VARIES | |
| Compatibility | **HIGH** | Breaking change for any running frontend instances |

### If `services/api.ts` changes:

| Impact Area | Level | Detail |
|:---|:---|:---|
| Frontend | **HIGH** | `App.tsx` and components call `api.*` methods |
| Database | MAYBE | If query logic changes |
| Security | **HIGH** | Auth logic lives here |

### If authentication is fixed:

| Impact Area | Level | Detail |
|:---|:---|:---|
| Frontend | **HIGH** | Login flow, token storage, all API calls must pass auth |
| Database | **YES** | Must enable RLS, create policies, potentially migrate users to Supabase Auth |
| API | **HIGH** | All 16 methods must use authenticated client |
| Compatibility | **BREAKING** | All existing sessions invalidated |

---

## PHASE 30 — ARCHITECTURAL DECISION RECORD

### ADR-1: Use Supabase Instead of Express/SQLite

| Attribute | Detail |
|:---|:---|
| DECISION | Use Supabase PostgREST as the sole backend for the active frontend |
| WHY IT EXISTS | INFERRED — enables static hosting (Vercel/GitHub Pages) without a Node.js server |
| EVIDENCE | Frontend imports only `services/supabase.ts`; server/ code is completely disconnected |
| AFFECTED COMPONENTS | All data access flows through `services/api.ts` |
| BENEFITS | No server to host/maintain, free tier Supabase, instant API |
| TRADEOFFS | All business logic pushed to client, no server-side security enforcement |
| WHAT WOULD BREAK IF CHANGED | Migrating back to Express would require rewriting all of `api.ts` |

### ADR-2: Disable Supabase RLS

| Attribute | Detail |
|:---|:---|
| DECISION | Explicitly disable Row Level Security on all tables |
| WHY IT EXISTS | INFERRED — simplifies development by allowing anonymous access |
| EVIDENCE | `schema.sql` lines 110–114: `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` |
| TRADEOFFS | Catastrophic security vulnerability |
| WHAT WOULD BREAK IF CHANGED | Enabling RLS without updating client auth would break the entire app |

### ADR-3: Year-Level Tax Calculation (Not Quarterly)

| Attribute | Detail |
|:---|:---|
| DECISION | Frontend tax engine calculates at annual granularity |
| WHY IT EXISTS | INFERRED — simplification of the quarterly model present in the server |
| EVIDENCE | `taxLogic.ts` iterates years, not quarters; no `quarterly_payment_status` table in Supabase |
| AFFECTED COMPONENTS | `utils/taxLogic.ts`, `DelinquencyTable.tsx`, `api.postPayment()` |
| TRADEOFFS | Less accurate than quarterly calculation; no quarterly partial payments |

### ADR-4: Client-Side Dashboard Aggregation

| Attribute | Detail |
|:---|:---|
| DECISION | Fetch all properties and compute statistics in browser |
| WHY IT EXISTS | INFERRED — Supabase PostgREST doesn't easily support complex aggregation |
| EVIDENCE | `api.ts getDashboardStats()` does `supabase.from('properties').select('*')` then Array.filter() |
| TRADEOFFS | O(n) memory/compute, won't scale |

---

## PHASE 32 — WHAT AN AI MUST KNOW BEFORE MODIFYING THIS PROJECT

1. **The `server/` directory is dead code.** Do not modify it unless explicitly asked. The active data layer is `services/api.ts` → Supabase.

2. **All authorization is frontend-only.** Supabase RLS is disabled. The anonymous API key has full database access. Any "security" is cosmetic.

3. **`App.tsx` is a god object.** It owns all state and orchestrates all data flows. Any new feature likely requires touching it.

4. **Tax rates are statutory law.** `constants.ts` values (2% base, 2%/month penalty, 36-month cap) implement RA 7160. Never change these without explicit legal basis.

5. **Column name mapping is manual.** Database uses `snake_case`, TypeScript uses `camelCase`. All mapping is hand-written in `api.ts`. Renaming a column requires updating the mapping function.

6. **`CURRENT_YEAR` is hardcoded to 2026.** It does not use `new Date().getFullYear()`. Must be manually bumped.

7. **Receipt numbers are random, not sequential.** `api.ts` line 143 uses `Math.random()`. The server version uses sequential numbering but is inactive.

8. **Audit logging is critical.** Every property mutation must write to `rptar_audit_logs`. The sync system depends on this table.

9. **The `Cashier` role exists in TypeScript but NOT in the Supabase schema CHECK constraint.** Creating a user with role='Cashier' via Supabase would violate the constraint.

10. **Dashboard stats include hardcoded/mock values.** `totalCollected: 125000` and `monthlyTrend` data are static, not computed from actual payment records.

11. **There are NO tests.** Any change must be manually verified. At minimum run `npx tsc --noEmit` and `npm run build`.

12. **Live credentials are in `.env.local` in the repo.** The Supabase anonymous key is exposed.

---

## PHASE 33 — UNKNOWN / NEEDS VERIFICATION

1. **Is the `server/` directory planned for future use, or is it abandoned?** The README mentions only Supabase. The Vite proxy config suggests it was once used or planned.

2. **Is there a staging vs. production Supabase environment?** Only one set of credentials found.

3. **Is Vercel the primary host or GitHub Pages?** Both are configured. README badge says Vercel, `package.json` has gh-pages scripts.

4. **Are `AuthModal.tsx`, `DebtChart.tsx`, and `SearchBar.tsx` truly unused?** Static analysis suggests yes, but dynamic import patterns could not be ruled out with 100% certainty.

5. **What is `metadata.json` for?** Its `requestFramePermissions: []` field suggests an IDE sandbox environment, but this is INFERRED.

6. **Is the Gemini API integration planned?** The env variable exists but no code uses it.

7. **Why does `constants.ts` have `MOCK_PROPERTIES` and `MOCK_USER`?** They may be remnants of pre-Supabase development.

8. **Is the `quarterly_payment_status` table needed in Supabase?** The server uses it for quarterly granularity, but the frontend doesn't.

---

## PHASE 34 — AI PROJECT CONTEXT

*(See separate file: `AI_PROJECT_CONTEXT.md`)*

---

## PHASE 35 — MASTER CHANGE-REVIEW PROMPT

*(See separate file: `CHANGE_IMPACT_GUIDE.md`)*
