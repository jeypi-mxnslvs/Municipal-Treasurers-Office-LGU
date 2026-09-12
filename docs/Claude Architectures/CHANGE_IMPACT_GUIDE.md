# CHANGE IMPACT GUIDE & MASTER CHANGE-REVIEW PROMPT

> For evaluating any proposed feature or architectural change against the LGU Treasury Connect codebase.

---

## Part 1 — Change Impact Map

### Component: `App.tsx` (Root State Orchestrator)

```
If App.tsx changes:
    ↓
Potentially affected:
    - ALL 11 active UI components (they receive props from App.tsx)
    - View switching logic (dashboard vs posting)
    - Authentication gating
    - Data loading orchestration
    - Background sync polling
    - Modal open/close state

Database migration required: NO (App.tsx is pure frontend state)
API compatibility risk: MEDIUM (if function signatures calling api.ts change)
Frontend impact: HIGH
Security impact: LOW (auth is already broken)
Testing required: Full manual smoke test of all views and modals
```

### Component: `types.ts` (TypeScript Contracts)

```
If types.ts changes:
    ↓
Potentially affected:
    - App.tsx (imports Property, User, TaxYearRecord, OfficialReceipt, DashboardStatsData, TaxSummary)
    - services/api.ts (imports ALL interfaces for type mapping)
    - utils/taxLogic.ts (imports Property, TaxYearRecord, CalculationResult)
    - components/DashboardTable.tsx (imports Property, User)
    - components/DashboardStats.tsx (imports DashboardStatsData)
    - components/LoginPage.tsx (imports User)
    - components/BulkImportModal.tsx (imports Property, User)
    - components/Header.tsx (imports User)
    - components/AuditLogModal.tsx (imports RptarAuditLog)
    - components/OfficialReceiptModal.tsx (imports OfficialReceipt)

Database migration required: YES (if interface reflects schema change)
API compatibility risk: HIGH (api.ts mapping must stay in sync)
Frontend impact: HIGH
Security impact: LOW
Testing required: `npx tsc --noEmit` + `npm run build` + manual verification
```

### Component: `services/api.ts` (API Client)

```
If api.ts changes:
    ↓
Potentially affected:
    - App.tsx (calls 10+ api methods: getProperties, getDashboardStats, postPayment, etc.)
    - components/LoginPage.tsx (calls api.login, api.lookupUser)
    - components/UserManagementModal.tsx (calls api.getUsers, api.registerUser, etc.)
    - components/BulkImportModal.tsx (calls api.bulkImportProperties)

Database migration required: DEPENDS (if Supabase query patterns change)
API compatibility risk: HIGH (method signatures are consumed throughout)
Frontend impact: HIGH
Security impact: HIGH (auth logic lives in login() method)
Testing required: Full data flow verification
```

### Component: `utils/taxLogic.ts` (Tax Engine)

```
If taxLogic.ts changes:
    ↓
Potentially affected:
    - services/api.ts (calls calculateTaxLiability in getPropertyAssessment)
    - components/DashboardTable.tsx (imports and calls calculateTaxLiability for debt display)
    - components/DelinquencyTable.tsx (renders TaxYearRecord[] produced by this function)
    - components/OfficialReceiptModal.tsx (displays receipt from payment based on these calcs)

Database migration required: NO (pure function, no DB access)
API compatibility risk: HIGH (if CalculationResult shape changes)
Frontend impact: MEDIUM
Security impact: LOW
Business risk: CRITICAL (incorrect tax amounts on government receipts)
Testing required: Manual verification of tax amounts for edge cases
```

### Component: `constants.ts` (Rates & Constants)

```
If constants.ts changes:
    ↓
Potentially affected:
    - utils/taxLogic.ts (imports CURRENT_YEAR, BASE_TAX_RATE, PENALTY_RATE_PER_MONTH, MAX_PENALTY_MONTHS)
    - components/DashboardTable.tsx (imports BARANGAYS)
    - components/BulkImportModal.tsx (imports BARANGAYS, PROPERTY_CLASSES)
    - components/RptarModal.tsx (likely imports BARANGAYS, PROPERTY_CLASSES)

Database migration required: NO
API compatibility risk: LOW
Frontend impact: MEDIUM (tax calculations change, dropdown options change)
Security impact: LOW
Business risk: HIGH (if tax rates modified without legal basis)
Testing required: Verify tax calculations produce correct amounts
```

### Component: Supabase Schema (`schema.sql`)

```
If schema changes:
    ↓
Potentially affected:
    - services/api.ts (ALL 16 methods reference column names directly)
    - types.ts (interfaces must mirror schema)
    - Supabase Cloud database (must apply migration)
    - Any running frontend instances (will break on column renames)

Database migration required: YES
API compatibility risk: HIGH (column rename = silent breakage)
Frontend impact: HIGH
Security impact: VARIES (depends on change)
Testing required: Full application smoke test after migration
```

### Component: Authentication Flow

```
If authentication is fixed/changed:
    ↓
Potentially affected:
    - services/api.ts (login method, all Supabase calls need auth token)
    - services/supabase.ts (may need to use authenticated sessions)
    - App.tsx (token management, session restoration)
    - components/LoginPage.tsx (login flow)
    - schema.sql (RLS policies needed, users table password migration)

Database migration required: YES (enable RLS, create policies, hash passwords)
API compatibility risk: HIGH (all 16 api methods affected)
Frontend impact: HIGH (every Supabase call must pass auth)
Security impact: HIGH (this IS the security fix)
Breaking change: YES — all existing sessions invalidated
Testing required: Complete regression test of every feature
```

---

## Part 2 — Future Feature Analysis Framework

When evaluating any proposed new feature, analyze these dimensions systematically:

### Architecture
- Which existing modules (App.tsx, api.ts, taxLogic.ts, components) are affected?
- Should a new module/component be created, or can the feature fit in existing files?
- Does the feature violate the current architecture (e.g., adding server-side logic when everything is client-side)?
- Does it introduce coupling between components that are currently independent?

### Data
- Does the Supabase database need new tables or columns?
- If yes: exact SQL migration statement, new TypeScript interface, updated api.ts mapping
- New relationships or foreign keys?
- Indexes needed for new query patterns?
- Does existing data need backfilling?

### API
- New methods needed in `services/api.ts`?
- Modified method signatures (breaking change for callers)?
- New Supabase table queries?
- Validation logic needed?

### Frontend
- New React component needed?
- New state variables in `App.tsx`?
- New modal? New view in the view switcher?
- New props to pass through the component tree?
- Form handling needed?

### Security
- Does the feature expose new data through the anonymous Supabase key?
- Does it require authentication (which currently doesn't exist)?
- Does it handle sensitive data (PII, financial)?
- Does it need new authorization checks (frontend role guards)?

### Performance
- Does it add new Supabase queries (increase polling/load)?
- Does it require fetching large datasets to the browser?
- Can it be computed client-side or does it need server-side aggregation?
- Does it affect the 7-second sync polling?

### Infrastructure
- New environment variable needed?
- New external service integration?
- Does it require a real backend server (breaking the BaaS pattern)?
- Deployment changes?

### Testing
- What manual tests are needed to verify?
- What edge cases should be checked?
- Does it affect tax calculations (verify amounts)?

### Compatibility
- Does it break existing functionality?
- Does it change TypeScript interfaces?
- Does it change Supabase schema?
- Backwards compatible with currently running instances?

### Risk Assessment
- **LOW:** Internal UI change, no data/API impact
- **MEDIUM:** New data flow, new API method, new component
- **HIGH:** Schema change, auth change, tax logic change
- **CRITICAL:** Breaking change to authentication, tax calculations, or payment processing

---

## Part 3 — Master Change-Review Prompt

Copy and provide this prompt to any AI when proposing a new feature:

---

```
You are reviewing a proposed feature for LGU Treasury Connect, a Real Property Tax
Administration System for a Philippine municipal government.

BEFORE implementing anything, you MUST:

1. READ the project context in "Claude Architectures/AI_PROJECT_CONTEXT.md" to understand
   the architecture, stack, constraints, and risks.

2. IDENTIFY which files need modification. The key files are:
   - App.tsx (state orchestrator — changes here cascade everywhere)
   - types.ts (TypeScript contracts — changes break all consumers)
   - services/api.ts (Supabase data layer — 16 methods)
   - utils/taxLogic.ts (RA 7160 tax engine — legally sensitive)
   - constants.ts (tax rates, barangay list)
   - schema.sql (Supabase PostgreSQL schema)
   - components/ (14 UI components)

3. CHECK database implications:
   - Does this need a new Supabase table or column?
   - Provide exact SQL migration if yes.
   - Update types.ts interface to match.
   - Update api.ts column mapping.

4. CHECK API implications:
   - New or modified methods in services/api.ts?
   - Breaking changes to method signatures?

5. CHECK frontend implications:
   - New state in App.tsx? New props? New component?
   - Does this fit in the current view system (dashboard / posting)?

6. CHECK security implications:
   - Remember: RLS is DISABLED. The anonymous key has full DB access.
   - All authorization is frontend-only JavaScript.
   - Does this feature require real auth (which doesn't exist)?

7. CHECK business rule compliance:
   - Tax rates (2% base, 2%/mo penalty, 36-month cap) are statutory law.
   - Arrears-First rule must be preserved.
   - Every property mutation must log to rptar_audit_logs.

8. DO NOT modify the server/ directory unless explicitly asked (it's dead code).

9. DO NOT change tax calculation constants without explicit legal basis.

10. VERIFY after implementation:
    - npx tsc --noEmit (zero TypeScript errors)
    - npm run build (successful Vite production build)

OUTPUT FORMAT for your analysis:

### Feature: [Name]

**Files Modified:**
- [list with reasons]

**Files Created:**
- [list with reasons]

**Database Migration:**
- [SQL if needed, or "None"]

**Risk Level:** LOW / MEDIUM / HIGH / CRITICAL
**Risk Justification:** [explain]

**Do NOT Touch:**
- [list areas to avoid]

**Implementation Steps:**
1. ...
2. ...

**Manual Verification:**
- [what to check after implementation]
```

---

## Part 4 — Quick Reference: File Modification Cheatsheet

| If you need to... | Modify these files | Watch out for |
|:---|:---|:---|
| Add a new property field | `schema.sql`, `types.ts`, `api.ts` (mapping), `RptarModal.tsx` (form), `DashboardTable.tsx` (display) | Column name mapping in api.ts |
| Add a new Supabase table | `schema.sql`, `types.ts` (new interface), `api.ts` (new methods) | RLS is disabled — new table is publicly accessible |
| Add a new UI component | `components/NewComponent.tsx`, `App.tsx` (import + render + state) | App.tsx is a god object — add state carefully |
| Change tax calculation | `utils/taxLogic.ts`, `constants.ts` | LEGALLY SENSITIVE — verify RA 7160 compliance |
| Fix authentication | `services/api.ts`, `services/supabase.ts`, `schema.sql` (enable RLS), `App.tsx`, `LoginPage.tsx` | BREAKING CHANGE — all existing sessions die |
| Add a new user role | `schema.sql` (UPDATE CHECK constraint), `types.ts` (User interface), `App.tsx` + components (role guards) | Current schema CHECK only allows Admin/Assessor/Viewer |
| Change dashboard stats | `api.ts getDashboardStats()` | Currently fetches ALL properties into browser memory |
| Add a new modal | `components/NewModal.tsx`, `App.tsx` (new state + render) | Follow existing pattern of boolean `isXxxModalOpen` state |
