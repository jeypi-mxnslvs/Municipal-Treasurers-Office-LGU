# AI Workflow Rules — LGU Treasury Connect

## Approach

Development follows a strict, spec-driven engineering workflow governed by the **Canonical Hierarchy of Truth**:
1. [`docs/SSOT.md`](../docs/SSOT.md) *(Highest Authority)*: Governs all database schemas, statutory formulas, verification rules, and role permissions.
2. [`docs/MUNICIPAL_SYSTEM_IMPLEMENTATION_PLAN.md`](../docs/MUNICIPAL_SYSTEM_IMPLEMENTATION_PLAN.md): Defines phased delivery plans, gates, and acceptance criteria.
3. `context/` & `.agents/rules/`: Operational standards and task change budgets.
4. Active Source Code: The working tree. When code diverges from the SSOT, the SSOT governs.

## Strict Git Governance (Local-Only Directive)

- **NEVER PUSH TO REMOTE**: AI agents **MUST NEVER** run `git push` or push commits to `origin/main` or any remote branch under any circumstances.
- All code modifications, tests, and refactors must remain strictly in the local working tree.
- When instructed to pull remote updates, run `git pull origin main` safely.
- Pushing to remote repositories is exclusively reserved for the human owner.

## Scoping Rules

- Work on one component or feature slice at a time.
- Enforce the **Stop-and-Wait Protocol**: After modifying or creating any single component or modal, STOP immediately, present a concise summary, and wait for human review.
- Batching multiple component refactors across a single turn without explicit instruction is strictly forbidden.
- Declare and respect the declared **Change Budget** (maximum files allowed to change).

## When to Split Work

Split an implementation step if it combines:
- Database schema changes and frontend UI changes in the same step.
- Mathematical calculation changes and presentation components.
- Multiple unrelated domain modals.

If a change cannot be verified end-to-end within 5 minutes, the scope is too broad — split it.

## Handling Missing Requirements

- Do not invent product behavior or financial rules not defined in [`docs/SSOT.md`](../docs/SSOT.md).
- If a statutory requirement is ambiguous, consult RA 7160 Title II or request clarification in [`context/progress-tracker.md`](progress-tracker.md).
- Never introduce random numbers (`Math.random()`) for financial identifiers or verification references.

## Protected Files

Do not modify the following without explicit human instruction:
- `utils/taxLogic.ts`: Pure RA 7160 calculation formulas (must pass all unit tests).
- `components/ui/*`: Pre-built headless primitives.

## Keeping Docs in Sync

Update the relevant documentation whenever:
- Schema or repository interfaces change (`docs/SSOT.md`).
- An implementation phase or milestone is reached (`docs/MUNICIPAL_SYSTEM_IMPLEMENTATION_PLAN.md`, `context/progress-tracker.md`).
- A user workflow or layout pattern changes (`context/ui-context.md`).

## Definition of Done & 4 Statutory Verification Gates

Before presenting any task completion to the human lead, execute and confirm all 4 verification gates:

```bash
# 1. Type Verification (0 errors required)
npx tsc --noEmit

# 2. Linting (0 errors, 0 warnings required)
npm run lint

# 3. Unit Tests (All RA 7160 tax formulas must pass 100%)
npm run test:unit

# 4. Production Build Verification (Clean compilation required)
npm run build
```

## No Self-Certification Rule
Agents **MUST NOT** declare their own work:
- `APPROVED`
- `GO`
- `SECURITY-SAFE`
- `PRODUCTION-READY`

Final sign-off belongs exclusively to the human reviewer and municipal lead.
