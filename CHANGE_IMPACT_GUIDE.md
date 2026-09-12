# CHANGE IMPACT & FUTURE FEATURE GUIDE

This guide establishes the framework for evaluating and implementing future changes to the LGU Treasury Connect application. It identifies the ripple effects of modifications across the monolithic state and database.

---

## 1. CHANGE IMPACT ANALYSIS

### If `App.tsx` (Global State) Changes
* **Affected Components:** Almost all UI components (`DashboardStats`, `DashboardTable`, Modals) rely on props passed down from `App.tsx`.
* **Frontend Impact:** **HIGH**. Modifying the state structure (e.g., changing how `properties` or `currentUser` is stored) requires updating every component that consumes it.
* **Risk:** Re-renders. Since state is monolithic, updates to a single property trigger a re-render of the entire dashboard.

### If `utils/taxLogic.ts` (Tax Engine) Changes
* **Affected Components:** `DelinquencyTable.tsx`, `OfficialReceiptModal.tsx`, `services/api.ts`.
* **Testing Required:** **CRITICAL**. Because this handles financial calculations (Arrears First logic, penalty capping), changes here directly impact the numbers on Official Receipts. Manual testing against edge cases (e.g., leap years, 10+ years delinquent) is required since no automated tests exist.

### If Database Schema (`schema.sql` / Supabase) Changes
* **Affected Components:** `types.ts`, `services/api.ts`, and any UI component consuming the modified fields.
* **Database Migration Required:** **YES**. You must execute SQL on Supabase and update local types to match.
* **API Compatibility Risk:** **HIGH**. The frontend directly maps Supabase JSON responses to TypeScript interfaces. Renaming a column will break the app silently or cause runtime errors.

### If Authentication Flow Changes
* **Security Impact:** **HIGH**. Fixing the current client-side auth flaw (as detailed in `SECURITY_REVIEW.md`) requires enabling RLS in Supabase.
* **Frontend Impact:** **HIGH**. Enabling RLS will immediately break the app for any user utilizing the `VITE_SUPABASE_ANON_KEY` without a proper signed JWT. You must refactor `api.ts` to pass a real session token.

---

## 2. FUTURE FEATURE ANALYSIS FRAMEWORK (MASTER PROMPT)

Whenever I propose a new feature, you **MUST** follow this exact procedure before writing any code.

### Instructions for AI Assistants:
1. **Understand the Architecture:** Read `AI_PROJECT_CONTEXT.md`. Note that the `server/` directory is dead code; the app is a React SPA calling Supabase directly.
2. **Identify Affected Components:** Determine which React components, modals, or state in `App.tsx` need modification.
3. **Check Database Implications:**
   - Does this require a new Supabase table or column?
   - If yes, provide the exact SQL migration required.
4. **Check API Implications:**
   - Which functions in `services/api.ts` need updating?
   - Do the TypeScript interfaces in `types.ts` need to change?
5. **Check Performance Implications:**
   - Does this feature involve fetching the entire properties list? (Avoid this if possible, as `getDashboardStats` already creates a bottleneck).
6. **Check Security Implications:**
   - Does this expose sensitive data? 
   - Note: The current system has RLS disabled. Be aware that any new table is publicly readable/writable until the security architecture is fixed.
7. **Propose the Smallest Implementable Change:** 
   - Avoid creating new complex state managers (like Redux) unless absolutely necessary. Fit within the current `App.tsx` prop-drilling paradigm.
8. **Explicitly State What Should NOT Be Changed:**
   - Do not modify the `server/` directory.

### Output Format for Feature Evaluation:
When evaluating a proposed feature, output the following structured response:

```markdown
### Feature Evaluation: [Feature Name]

**1. Architecture & Dependency Impact:**
- Modifies: `[List of files]`
- State Changes: `[How App.tsx state changes]`

**2. Database & Data Model:**
- Migration Required: `[Yes/No]`
- `[SQL snippet if applicable]`

**3. Potential Risks:**
- `[Security/Performance/Logic risks]`

**4. Implementation Plan:**
- Step 1: ...
- Step 2: ...

**5. Out of Scope / Do Not Touch:**
- `[List areas to avoid]`
```

*Ask for clarification only if the feature relies on backend infrastructure that contradicts the established Serverless architecture, or if business logic edge-cases are unspecified.*
