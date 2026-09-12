# Defensive Security Architecture Review
## LGU Treasury Connect — Authentication Implementation

**Date:** 2026-08-31  
**Scope:** Defensive security architecture review of authentication and authorization flows. Read-only code and configuration analysis. No active or destructive testing performed.

---

### Architecture

The application currently contains two divergent, parallel backend/data architectures with conflicting authentication implementations:

```
[ Frontend Client (React / Vite) ]
   │
   ├── Path A (Active in Client): Direct Supabase (PostgREST) Integration
   │     ├─ Auth UI: components/AuthModal.tsx (presets & hardcoded defaults)
   │     ├─ Client Service: services/api.ts (custom client-side password verification)
   │     └─ Database: Supabase PostgreSQL (schema.sql - RLS explicitly disabled)
   │
   └── Path B (Secondary / Unconnected): Express REST API Server
         ├─ Server: server/index.js & server/routes/auth.js
         ├─ Mechanism: bcrypt + jsonwebtoken (JWT)
         └─ Database: Local SQLite database (server/treasury.db)
```

1. **Active Frontend Flow (Supabase)**:
   - The user enters credentials or selects demo presets in `components/AuthModal.tsx`.
   - `services/api.ts` queries the Supabase `users` table directly using the public anonymous API key (`VITE_SUPABASE_ANON_KEY`).
   - The client fetches the user record including the `password` column and performs a plaintext comparison in the browser.
   - On match, it returns an unsanctioned token string (`supabase-token-${user.id}`) that is saved in browser `localStorage`.
   - All subsequent data mutations (`properties`, `payment_postings`, `rptar_audit_logs`) interact directly with Supabase tables without session validation or Row-Level Security (RLS).

2. **Standalone REST API Flow (Node.js/Express)**:
   - An Express backend exists under `server/` with bcrypt-based password hashing and JWT issuance (`/api/auth/login`).
   - The frontend currently does not route traffic through this Express service.
   - Several Express routes lack authentication guards, and the JWT middleware contains a bypass fallback.

---

### Trust Boundaries

| Boundary | Interacting Entities | Mechanism & Flow | Security Posture & Enforcement |
| :--- | :--- | :--- | :--- |
| **Client ↔ Supabase Cloud API** | React SPA ↔ Supabase PostgREST | HTTP via `VITE_SUPABASE_ANON_KEY` | ❌ **Broken / Absent**: RLS disabled on all tables. Anon key possesses full read/write/delete privileges across all schema tables. |
| **Client ↔ Browser Storage** | React App ↔ `localStorage` | Token stored as `lgu_token` | ⚠️ **Weak**: Tokens stored in `localStorage` are accessible to scripts (XSS scope). The stored value is an arbitrary string rather than a validated cryptographic session token. |
| **Client / API Caller ↔ Express Server** | Web Client / External Caller ↔ Express Endpoints | HTTP requests to `http://localhost:5000/api/*` | ❌ **Bypassed / Flawed**: Middleware assigns a default mock user (`juan.assessor`) if no token header is provided instead of returning HTTP 401. |
| **Express Server ↔ SQLite Database** | Express Route Handlers ↔ `treasury.db` | Local parameterized queries (`db.js`) | ✅ **Adequate**: Parameterized SQL queries mitigate standard SQL injection risks on this layer. |

---

### Findings

| Severity | Finding | Evidence | Impact | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| 🔴 **Critical** | **Disabled Row-Level Security (RLS) & Broad Privileges for Anonymous Role** | `schema.sql` (lines 106–114):<br>`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon...`<br>`ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;` | Anyone possessing the public anonymous key (`VITE_SUPABASE_ANON_KEY` in `.env.local` / frontend bundle) can directly query, modify, or delete any record in `users`, `properties`, `payment_postings`, and `rptar_audit_logs`. | Enable RLS on all Supabase tables (`ENABLE ROW LEVEL SECURITY`). Revoke write/delete grants from `anon`. Define restrictive policies based on authenticated user IDs and roles. |
| 🔴 **Critical** | **Plaintext Passwords Stored in Database & Verified Client-Side** | `schema.sql` (line 10):<br>`password TEXT NOT NULL DEFAULT 'admin123'`<br>`services/api.ts` (line 283):<br>`if (!user \|\| user.password !== password)` | Plaintext credentials for staff and administrators are exposed over network responses. Credential comparison occurs on the untrusted client side. | Transition password authentication exclusively to server-side or Supabase Auth (`supabase.auth.signInWithPassword`), utilizing secure hashing (e.g., Argon2id or bcrypt with work factor ≥ 12). |
| 🔴 **Critical** | **Express Authentication Middleware Assigns Default Identity on Missing Token** | `server/routes/auth.js` (lines 14–17):<br>`if (!token) { req.user = { id: 2, username: 'juan.assessor', role: 'Assessor' }; return next(); }` | Unauthenticated requests sent to protected Express endpoints automatically inherit `Assessor` privileges rather than being rejected with HTTP 401. | Reject requests without valid tokens immediately: `return res.status(401).json({ error: 'Unauthorized: Missing token' });`. |
| 🔴 **Critical** | **Unauthenticated Database Backup & System Diagnostics Exfiltration** | `server/routes/admin.js` (lines 12–29):<br>`router.get('/backup', ...)` serves `treasury.db` with no middleware or role check. | Any unauthenticated network client reaching port 5000 can download the entire SQLite database containing user hashes, tax records, and audit data. | Attach strict authentication and role-checking middleware (`requireRole('Admin')`) to all admin routes. |
| 🟠 **High** | **Unauthenticated User Management & Password Reset Endpoints** | `server/routes/auth.js` (lines 82–167):<br>`/register`, `/users/:id/password`, and `/users/:id` (DELETE) lack authentication middleware. | Any client can register arbitrary administrative accounts, overwrite user passwords, or delete staff records without authentication. | Require authenticated `Admin` role checks on all administrative CRUD routes and user provisioning endpoints. |
| 🟠 **High** | **Forged / Non-Cryptographic Client Session Tokens** | `services/api.ts` (line 288):<br>`token: 'supabase-token-' + user.id` | The frontend session token is a predictable static string without signature, issuer verification, or expiration timestamp. | Implement standard signed JWTs or managed session cookies issued by a trusted authentication server. |
| 🟠 **High** | **Static Fallback JWT Secret** | `server/routes/auth.js` (line 7):<br>`const JWT_SECRET = process.env.JWT_SECRET \|\| 'lgu-treasury-secret-key-2026'` | If the environment variable is omitted in deployment, JWT signatures can be forged offline by anyone using the hardcoded default secret. | Require `JWT_SECRET` to be defined on server startup; fail closed if absent (`if (!process.env.JWT_SECRET) throw new Error(...)`). |
| 🟡 **Medium** | **Hardcoded Audit Attribution** | `services/api.ts` (lines 100–101, 127–128, 172–173):<br>`assessor_name: 'Juan Reyes'`, `station_id: 'Assessor-Desk-02'` | Audit records in `rptar_audit_logs` record static identities rather than the actual authenticated operator, breaking non-repudiation and accountability. | Bind audit log entries to the cryptographically verified session context (`req.user.name` / `auth.uid()`). |
| 🟡 **Medium** | **Overly Permissive Cross-Origin Resource Sharing (CORS)** | `server/index.js` (line 19):<br>`app.use(cors())` | Wildcard CORS enables arbitrary websites in user browsers to initiate cross-origin requests against the local or hosted API. | Restrict CORS to explicit allowed origins and trusted domains (e.g., `origin: ['https://treasury.lgu.gov.ph']`). |
| 🟢 **Low** | **Sensitive Error Message Propagation** | `server/routes/auth.js` (line 77) & `services/api.ts` (line 280):<br>`res.status(500).json({ error: err.message })` | Internal database and runtime error messages are returned directly to client callers, facilitating system fingerprinting. | Return sanitized user-facing messages (e.g., "Internal server error") and log detailed exceptions to an internal monitoring stream. |
| 🟢 **Low** | **Default Test Passwords Displayed in UI** | `components/AuthModal.tsx` (lines 20–21, 127):<br>`setPassword('admin123')`, `"Default test password is: admin123"` | Development placeholders and credentials shipped into production interfaces increase susceptibility to unauthorized access. | Remove UI hints, disable one-click demo presets in non-development environments, and enforce initial password changes. |

---

### Missing Controls

1. **Centralized Identity & Access Management (IAM)**: Lack of a single authoritative identity store; Supabase database and SQLite user stores are desynchronized.
2. **Access Control Enforcement (RLS / ABAC)**: Absence of database-level row and column security policies.
3. **Brute-Force & Rate-Limiting Defenses**: Neither endpoint has request throttling or account lockouts to impede credential stuffing.
4. **Multi-Factor Authentication (MFA)**: High-privilege municipal finance operations (treasury/cashiering) lack secondary authentication controls.
5. **Secure Session Token Handling**: Missing `HttpOnly`, `SameSite=Strict`, and `Secure` cookie attributes for session storage.
6. **Integrity Protection on Audit Logs**: Audit logs can be updated or deleted due to missing `INSERT`-only database constraints.
7. **Transport Security Verification**: *Insufficient evidence* to confirm TLS enforcement or HTTPS redirect headers at the reverse proxy layer.

---

### Migration Plan

```
Phase 1: Emergency Database Containment (Days 1–2)
Phase 2: Authentication Engine Unification (Days 3–5)
Phase 3: Route Authorization & Middleware Hardening (Days 6–8)
Phase 4: Session & Operational Security Hardening (Days 9–12)
```

#### Phase 1: Emergency Database Containment
- **Action 1.1**: Enable Row-Level Security across all Supabase tables (`users`, `properties`, `payment_postings`, `rptar_audit_logs`, `schedule_of_market_values`).
- **Action 1.2**: Revoke all public write/delete permissions granted to `anon` in PostgreSQL schema.
- **Action 1.3**: Rotate the Supabase API keys via the Supabase Management Console to invalidate exposed instances.

#### Phase 2: Authentication Engine Unification
- **Decision Point**: Select either **Supabase Auth (Native GoTrue)** or the **Dedicated Node.js Express REST API** as the single source of truth.
- **Action 2.1**:
  - *If Supabase Native*: Replace client custom queries in `api.ts` with `supabase.auth.signInWithPassword()`. Migrate stored user passwords to Supabase Auth managed tables (`auth.users`).
  - *If Express REST API*: Route all frontend data requests through the Express backend rather than having the browser communicate directly with Supabase.
- **Action 2.2**: Remove all plaintext password columns and references from the public `users` table.

#### Phase 3: Route Authorization & Middleware Hardening
- **Action 3.1**: Refactor `authenticateToken` in `server/routes/auth.js` to reject requests lacking valid JWT tokens (`HTTP 401`).
- **Action 3.2**: Implement role-based access control middleware (`requireRole(['Admin'])`) on `/api/admin/*`, `/api/auth/register`, and password reset endpoints.
- **Action 3.3**: Ensure `JWT_SECRET` is strictly loaded from protected environment configurations with no fallback strings.

#### Phase 4: Session & Operational Security Hardening
- **Action 4.1**: Transition token storage from browser `localStorage` to `HttpOnly`, `Secure`, `SameSite=Strict` cookies.
- **Action 4.2**: Implement rate-limiting middleware (e.g., `express-rate-limit`) on login and password reset routes.
- **Action 4.3**: Dynamically bind audit log attributes (`assessor_name`, `station_id`) to verified user session context.

#### Compatibility & Availability Risks
- **Frontend Breaking Change**: Enabling RLS immediately without updating client credentials will block frontend operations until client queries use authenticated sessions.
- **Data Migration**: Existing user accounts in `schema.sql` and `treasury.db` will require password resets or migration scripts to generate proper cryptographic hashes.

---

### Validation Plan

All verification tests are designed to be executed safely in a local or staging environment without destructive payloads:

| Verification Target | Test Procedure | Expected Safe Result |
| :--- | :--- | :--- |
| **Supabase RLS Policy** | Execute unauthenticated `GET /rest/v1/users` via curl using the anonymous API key. | Server returns `HTTP 401 / 403` or an empty array `[]`; no user table data or passwords returned. |
| **Express Middleware Fallback Fix** | Send a `GET /api/auth/me` or `GET /api/admin/backup` request without an `Authorization` header. | Server returns `HTTP 401 Unauthorized` (does not return default `juan.assessor` profile or file). |
| **Admin Route Protection** | Send `POST /api/auth/register` and `GET /api/admin/backup` with a non-admin valid JWT. | Server returns `HTTP 403 Forbidden`. |
| **JWT Secret Enforcement** | Start the Express server with `JWT_SECRET` unset in the environment. | Server process fails to start and logs a clear initialization error. |
| **Audit Log Integrity** | Perform a record update via an authenticated user session (`maria.cashier`) and inspect `rptar_audit_logs`. | Audit record reflects `maria.cashier` and her corresponding station ID rather than static defaults. |
| **Rate Limiting** | Send 10 consecutive failed login requests from a single IP address within 1 minute. | Server returns `HTTP 429 Too Many Requests` starting after threshold (e.g., 5 attempts). |

---

### Open Questions

1. **Target Architecture Selection**: Is the application intended to be a **Serverless Supabase-first SPA** or a **Three-Tier Architecture (React → Express REST API → SQLite/Postgres)**? Both currently exist concurrently.
2. **Environment & Deployment Model**: Will the Node.js Express server be placed behind a reverse proxy (e.g., NGINX/Caddy) terminating TLS, or will Supabase handle all production traffic?
3. **Database of Record**: Which database is currently considered the production datastore (`Supabase PostgreSQL` or `server/treasury.db`)?
4. **Station / Terminal Binding**: Are workstation IDs (`station_id` like `Window-04`) intended to be cryptographically validated (e.g., client certificates / network subnet restrictions), or are they informational metadata for audit logging?
