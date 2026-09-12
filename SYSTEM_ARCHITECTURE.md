# SYSTEM ARCHITECTURE — LGU Treasury Connect

## PHASE 1 — REPOSITORY DISCOVERY
The repository `lgu-treasury-connect` contains a web-based administration dashboard for municipal treasury operations. It consists of a React (Vite) frontend and a Supabase backend integration, alongside an older/unused Express.js + SQLite backend server.

The main systems include:
* Application Source Code (React Frontend in `/components`, `/services`, `App.tsx`)
* Active Backend (Supabase, schema definitions in `schema.sql`)
* Inactive/Deprecated Backend (Node.js/Express server in `/server`)
* Utilities (Tax calculations in `utils/taxLogic.ts`)

## PHASE 2 — TECHNOLOGY STACK
### Frontend
* **Framework:** React 19 (via Vite)
* **Language:** TypeScript
* **UI Library:** Lucide React (icons), Recharts (charting)
* **Styling:** Tailwind CSS (loaded via CDN in `index.html`)
* **State Management:** React hooks (`useState`, `useEffect`) and prop-drilling. No global state manager (e.g., Redux) is used.
* **Data Fetching:** `@supabase/supabase-js`
* **Routing:** Custom state-based routing (`view` state in `App.tsx` handling 'dashboard' vs 'posting')

### Backend (Active System)
* **Engine:** Supabase (PostgreSQL + PostgREST)
* **Authentication:** Custom plaintext comparison via frontend against Supabase `users` table. (Major security issue, see SECURITY_REVIEW.md).
* **Database:** PostgreSQL

### Backend (Inactive System - `server/` directory)
* **Language:** Node.js
* **Framework:** Express.js
* **Database:** SQLite3 (`treasury.db`)
* **Authentication:** JWT + bcrypt

### Infrastructure
* **Build System:** Vite
* **Deployment (Frontend):** GitHub Pages (`gh-pages`) configured in `package.json` deploy script.

### Third-party services
* **Supabase:** Used as the primary datastore and API layer. The frontend communicates with it directly using `VITE_SUPABASE_ANON_KEY`.

---

## PHASE 3 — COMPLETE DIRECTORY ARCHITECTURE

```text
lgu-treasury-connect/
├── components/           # React UI components (Modals, Tables, Cards, Dashboard widgets)
├── server/               # INACTIVE: Express REST API and SQLite database
│   ├── routes/           # INACTIVE: Express route handlers (auth, admin, properties)
│   ├── db.js             # INACTIVE: SQLite database initialization and wrappers
│   ├── index.js          # INACTIVE: Express entry point
│   ├── taxEngine.js      # INACTIVE: Server-side tax logic
│   └── treasury.db       # INACTIVE: SQLite database file
├── services/             # API services
│   ├── api.ts            # Frontend API client communicating directly with Supabase
│   └── supabase.ts       # Supabase client initialization
├── supabase/             # Supabase configuration and migrations
│   ├── config.toml       # Supabase local config
│   └── migration.sql     # Supabase SQL migration script
├── utils/                # Shared utilities
│   └── taxLogic.ts       # Frontend tax liability calculation logic
├── App.tsx               # Main application component and state router
├── index.html            # HTML entry point (includes Tailwind CDN)
├── package.json          # Node dependencies and scripts
├── schema.sql            # PostgreSQL schema definition for Supabase
├── SECURITY_REVIEW.md    # Pre-existing security architecture review
└── vite.config.ts        # Vite build configuration
```

---

## PHASE 4 — HIGH-LEVEL SYSTEM ARCHITECTURE
The actual working architectural pattern is **Client-Server (Serverless/BaaS)** utilizing a thick-client architecture where the frontend handles business logic (like tax calculations in `utils/taxLogic.ts`) and communicates directly with the database via PostgREST.

```text
User
 │
 ▼
React Frontend (App.tsx)
 │
 ├── Business Logic (utils/taxLogic.ts)
 ├── Local State Management
 └── API Service (services/api.ts)
        │
        ▼ (via Supabase JS / REST API)
Supabase (PostgreSQL)
```
*Note: The `server/` directory implements a traditional monolithic MVC backend but is completely disconnected from the active frontend.*

---

## PHASE 5 — COMPONENT ARCHITECTURE
* **App (Core):** `App.tsx`. Manages global state (current user, properties, stats), orchestration, and view switching.
* **Dashboard (UI):** `DashboardStats.tsx`, `DashboardTable.tsx`, `DelinquencyTable.tsx`. Responsible for displaying lists of properties and high-level municipal statistics.
* **Modals (UI/Forms):** `RptarModal.tsx`, `OfficialReceiptModal.tsx`, `AuthModal.tsx`, `BulkImportModal.tsx`, `UserManagementModal.tsx`, `AuditLogModal.tsx`. Handles CRUD forms and specialized interactions.
* **Tax Engine (Domain):** `utils/taxLogic.ts`. Calculates base tax, penalties, and months delayed based on the "Arrears First" rule.
* **API Client (Integration):** `services/api.ts`. Provides a unified interface for the React app to interact with Supabase tables.

---

## PHASE 6 — DATA ARCHITECTURE
Data flows primarily from the Supabase database to the React state.

```text
Supabase Database (PostgreSQL)
  ↓ (JSON via PostgREST)
API Client (services/api.ts)
  ↓
React State (App.tsx)
  ↓ (Props)
Components (Tables, Charts)
```
* **Tax Calculation Flow:** Property data fetched -> passed to `calculateTaxLiability` -> results rendered in `DelinquencyTable.tsx` / `OfficialReceiptModal.tsx`.
* **Payment Flow:** User selects records to pay -> Submits -> `postPayment` in `api.ts` inserts to `payment_postings`, updates `last_paid_year` in `properties`, inserts to `rptar_audit_logs`.

---

## PHASE 7 — DATABASE ARCHITECTURE
Database: **Supabase PostgreSQL** (`schema.sql`)

**Tables:**
1. `users`: Stores staff and admin credentials. (id, username, password, full_name, role, station_id). *Note: passwords stored in plaintext.*
2. `schedule_of_market_values`: Base rates for property classes by barangay.
3. `properties`: RPTAR Masterlist. Includes `td_number`, `pin`, `owner_name`, `assessed_value`, `last_paid_year`.
4. `payment_postings`: AF-51 Receipts. Tracks total paid, tender type, and JSON array of paid records.
5. `rptar_audit_logs`: Traceability for mutations (updates, deletions, payments).

**Relationships:**
* `payment_postings.property_id` -> `properties.id` (ON DELETE CASCADE)
* `rptar_audit_logs` relates loosely to `properties` via `property_id` and `td_number`.

---

## PHASE 8 — API ARCHITECTURE
The application uses the **Supabase PostgREST API** exclusively in the frontend. `services/api.ts` abstracts this.

Key interactions:
* `getProperties`: Queries `properties` table.
* `saveProperty`: Inserts/Updates `properties` and appends to `rptar_audit_logs`.
* `postPayment`: Inserts to `payment_postings`, updates `properties`, appends to `rptar_audit_logs`.
* `getDashboardStats`: Aggregates data from `properties` in memory (fetches all properties to calculate stats client-side).
* `login`: Queries `users` by username and performs plaintext password match.

*(The `server/routes/*` Express APIs are RESTful but UNUSED.)*

---

## PHASE 9 — AUTHENTICATION & AUTHORIZATION
**Implementation:** Flawed Custom Client-Side Auth over Supabase.
* The user enters credentials in `AuthModal.tsx`.
* `api.ts` queries the Supabase `users` table.
* **Security Flaw:** Password validation is done via `if (user.password !== password)` in the browser.
* **Token:** Sets a fake token (`supabase-token-{id}`) in `localStorage`.
* **Authorization:** Supabase RLS is explicitly disabled (`DISABLE ROW LEVEL SECURITY` in `schema.sql`). All users (including anonymous users with the API key) have full read/write access to all tables.

---

## PHASE 10 — BUSINESS LOGIC
* **Tax Assessment (`utils/taxLogic.ts`)**: Implements "Arrears First". Calculates tax due from `last_paid_year + 1` to `CURRENT_YEAR`.
* **Penalty Calculation**: Based on `BASE_TAX_RATE` (0.01 or similar) and `PENALTY_RATE_PER_MONTH`. Max penalty is capped by `MAX_PENALTY_MONTHS`.
* **Clearance**: Paying a tax year advances the property's `last_paid_year`.

---

## PHASE 11 — FRONTEND ARCHITECTURE
* **Entry Point:** `index.html` -> `index.tsx` -> `App.tsx`.
* **State Management:** `App.tsx` holds the monolithic state (`currentUser`, `properties`, `stats`, `selectedProperty`, `taxRecords`).
* **UI Structure:** Single Page Application (SPA). `view` state toggles between the Dashboard (overview) and Posting (assessment/payment view).

---

## PHASE 12 — BACKEND ARCHITECTURE
Active Backend is purely Supabase (BaaS). The business logic is pushed to the frontend, and the database acts merely as a JSON document store with some relational constraints.

---

## PHASE 13 — EXTERNAL INTEGRATIONS
* **Supabase:** Used for database and API. (No other external services like Stripe or Mailgun are present).

---

## PHASE 14 — BACKGROUND PROCESSING
* **Live Sync Polling:** `App.tsx` uses a `setInterval` (every 7s) to poll `api.getSyncStatus()` which fetches the latest `rptar_audit_logs` record to detect changes by other assessors.

---

## PHASE 15 — STATE MANAGEMENT
* **Frontend:** React `useState`. State is lost on refresh except for the `lgu_user` object in `localStorage`.
* **Database:** Supabase acts as the persistent state.

---

## PHASE 16 — ERROR HANDLING
* Standard `try/catch` blocks in `services/api.ts` throwing errors upwards to the UI.
* Simple `alert()` or `console.error` in the frontend (`App.tsx`).

---

## PHASE 17 — OBSERVABILITY
* **Audit Logs:** Application maintains its own audit trail in the `rptar_audit_logs` table for property updates, deletions, and payments.

---

## PHASE 18 — SECURITY ANALYSIS
**CONFIRMED ISSUES:**
* **CRITICAL:** RLS is disabled in Supabase. The anonymous API key gives full Read/Write/Delete access to the database.
* **CRITICAL:** Plaintext passwords are stored in the database and validated on the client side.
* **CRITICAL:** Fake frontend tokens (`supabase-token-{id}`).
* **HIGH:** Hardcoded audit attribution in multiple places (e.g., `assessor_name: 'Juan Reyes'`).

*(See `SECURITY_REVIEW.md` for a comprehensive breakdown).*

---

## PHASE 19 — PERFORMANCE ARCHITECTURE
* **POTENTIAL BOTTLENECK:** `getDashboardStats()` in `api.ts` fetches the *entire* `properties` table to calculate aggregates (counts, delinquency sums) in memory on the client side. This will not scale as the property database grows.

---

## PHASE 20 — TEST ARCHITECTURE
* **UNKNOWN / NOT FOUND:** No unit tests, integration tests, or testing frameworks (Jest, Vitest) are present in the repository.

---

## PHASE 21 — CONFIGURATION
* **Environment Variables:**
  * `VITE_SUPABASE_URL` — Supabase project URL
  * `VITE_SUPABASE_ANON_KEY` — Supabase public anonymous key

---

## PHASE 22 — DEPLOYMENT ARCHITECTURE
* **Frontend Build:** `vite build`
* **Deployment:** `gh-pages` (GitHub Pages) serving static files from the `dist` folder.
* **Database:** Supabase Cloud.

---

## PHASE 23 — DEPENDENCY MAP
```text
App.tsx
 ├── UI Components (Dashboard, Modals, Tables)
 ├── services/api.ts
 │    └── services/supabase.ts -> @supabase/supabase-js
 └── utils/taxLogic.ts
```

---

## PHASE 24 — FEATURE MAP
* **Feature:** Property Masterlist (CRUD)
* **Feature:** Tax Assessment & Delinquency Calculation
* **Feature:** Payment Posting (AF-51)
* **Feature:** Dashboard Analytics & Collection Tracking
* **Feature:** Bulk Import (CSV)
* **Feature:** User Management (Admin only)
* **Feature:** Multi-Assessor Live Polling

---

## PHASE 25 — ARCHITECTURAL CONSTRAINTS
* **Frontend-Heavy Logic:** The system is designed with business logic in the client. Migrating tax calculation to the backend would require significant refactoring.

---

## PHASE 26 — TECHNICAL DEBT
* **Duplicate Architectures:** The `server/` folder is massive technical debt that creates confusion and splits maintenance focus.
* **Security Debt:** Client-side authentication and lack of RLS.
* **Client-Side Aggregation:** Dashboard stats calculate in the browser rather than using SQL aggregation queries.

---

## PHASE 27 — UNUSED / DEAD SYSTEMS
* **CONFIRMED UNUSED:** The entire `server/` directory (Express API, `db.js`, `taxEngine.js`, `treasury.db`) is completely decoupled from the React frontend. The frontend uses `services/api.ts` directly communicating with Supabase.

---

## PHASE 28 — CHANGE IMPACT ANALYSIS
(Documented separately in `CHANGE_IMPACT_GUIDE.md`)

---

## PHASE 29 — FUTURE FEATURE ANALYSIS FRAMEWORK
(Documented separately in `CHANGE_IMPACT_GUIDE.md`)

---

## PHASE 30 — ARCHITECTURAL DECISION RECORD
* **DECISION:** Use Supabase instead of Express/SQLite.
* **WHY:** Unknown, likely for rapid prototyping or to enable GitHub Pages static hosting.
* **TRADEOFFS:** Eliminated the need for a Node server host, but introduced massive security vulnerabilities due to client-side auth implementations.

---

## PHASE 31 — SYSTEM DIAGRAMS
(Documented separately in `ARCHITECTURE_DIAGRAMS.md`)

---

## PHASE 32 — CRITICAL KNOWLEDGE
### WHAT AN AI MUST KNOW BEFORE MODIFYING THIS PROJECT
1. **IGNORE THE `server/` DIRECTORY:** It is dead code. All active API interaction happens in `services/api.ts` directly to Supabase.
2. **SECURITY FLAW:** Authentication is performed client-side by comparing plaintext passwords. Do not rely on current auth mechanisms for real security.
3. **TAX LOGIC LIVES IN FRONTEND:** `utils/taxLogic.ts` is where the assessment math happens.
4. **NO GLOBAL STATE:** `App.tsx` holds the monolithic state. Modifying state flow requires prop-drilling or lifting state.

---

## PHASE 33 — UNKNOWN INFORMATION
## UNKNOWN / NEEDS VERIFICATION
* The exact status of the `server/` directory. It is completely unused by the client, but it's unclear if the project owners intend to migrate *back* to it or if it is purely an abandoned prototype.
* Deployment environments for Supabase (is there a staging vs production?).

---

## PHASE 34 — FINAL AI CONTEXT
(Documented separately in `AI_PROJECT_CONTEXT.md`)

---

## PHASE 35 — MASTER CHANGE-REVIEW PROMPT
(Documented separately in `CHANGE_IMPACT_GUIDE.md`)
