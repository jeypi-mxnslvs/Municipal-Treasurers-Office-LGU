# AI PROJECT CONTEXT

## Project Purpose
LGU Treasury Connect is a web-based administration dashboard for municipal treasury operations. It handles real property tax (RPTAR) masterlists, tax assessment (including delinquency calculations based on the "Arrears First" rule), payment posting (AF-51 receipts), and high-level dashboard statistics.

## Architecture & Stack
* **Architecture:** Thick-client Single Page Application (SPA) communicating directly with a Backend-as-a-Service (BaaS).
* **Frontend:** React 19, TypeScript, Vite, Tailwind CSS (via CDN), Recharts, Lucide React.
* **Backend:** Supabase (PostgreSQL + PostgREST).
* **Dead Code Alert:** The repository contains a `server/` directory containing a Node.js/Express and SQLite implementation. **This is currently unused.** The active application logic relies entirely on the React frontend and Supabase.

## Major Modules
1. **App State Orchestrator:** `App.tsx` (handles all state, routing, and data fetching orchestration).
2. **Tax Engine:** `utils/taxLogic.ts` (computes tax due, penalties, and arrears).
3. **API Client:** `services/api.ts` (abstracts Supabase calls).
4. **UI Components:** Found in `/components` (Modals, Tables, Forms).

## Database
* **Engine:** Supabase PostgreSQL (`schema.sql`).
* **Tables:** `users`, `properties` (masterlist), `schedule_of_market_values`, `payment_postings` (receipts), `rptar_audit_logs`.
* **Important Business Rule:** Records marked as `is_shell_record` are properties that exist in the system but aren't fully assessed or actionable yet.

## APIs
* The frontend uses the `@supabase/supabase-js` SDK to communicate directly with PostgREST. There is no intermediate custom API server for the frontend.

## Authentication & Authorization (CRITICAL SECURITY RISKS)
* **Auth Flow:** Custom client-side authentication. The frontend fetches the user row from Supabase and compares the plaintext password in the browser (`services/api.ts`).
* **Token:** Sets a non-cryptographic token (`supabase-token-{id}`) in `localStorage`.
* **Authorization:** Supabase Row Level Security (RLS) is **explicitly disabled**. The anonymous API key (`VITE_SUPABASE_ANON_KEY`) grants full Read/Write/Delete privileges across all tables.

## Data Flows
* **Read:** `App.tsx` fetches data on load or via a live-sync interval (every 7 seconds) using `services/api.ts`, which calls Supabase.
* **Write:** Actions in modals (e.g., Save Property, Post Payment) trigger methods in `api.ts`, pushing data to Supabase and immediately writing to `rptar_audit_logs`.

## Important Business Rules
* **Arrears First:** Tax calculation evaluates all missed years from `last_paid_year + 1` to the current year.
* **Client-Side Aggregation:** Dashboard statistics (total debt, cleared counts, collection efficiency) are calculated in the browser by fetching the entire `properties` table.

## Infrastructure & Deployment
* **Build:** Vite (`npm run build`).
* **Deployment:** Hosted statically on GitHub Pages (`gh-pages`). Database hosted on Supabase Cloud.

## Technical Debt & Known Risks
* **Dead Server Code:** The `server/` directory is misleading and abandoned.
* **Security:** Complete lack of real authentication, RLS, or password hashing.
* **Performance:** Client-side aggregation of the entire database for dashboard stats will not scale.
* **Hardcoded Values:** Audit logs frequently hardcode assessor names (e.g., "Juan Reyes") instead of using the authenticated session.

## Change-Impact Rules
* **State Changes:** Because `App.tsx` holds monolithic state, modifying data models requires careful tracing through `App.tsx` props down to components.
* **Business Logic:** Changes to tax calculation must happen in `utils/taxLogic.ts`.
* **Database Schema:** Modifying the schema requires updating Supabase directly and adjusting TypeScript interfaces in `types.ts` and mapping in `services/api.ts`.
