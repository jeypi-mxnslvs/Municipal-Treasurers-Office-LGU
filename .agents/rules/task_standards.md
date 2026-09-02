# Antigravity Task Specification Standard

---

## TASK DECISION HEADER

```text
TASK ID: 
TASK CLASS: [STANDARD FEATURE | SECURITY / DATABASE CHANGE | EMERGENCY / HIGH-RISK DATABASE CONTAINMENT]
RISK: [LOW | MEDIUM | HIGH | CRITICAL]
PRODUCTION IMPACT: [NONE | MINOR | SIGNIFICANT | COMPLETE PLANNED OUTAGE]
DATABASE CHANGE: YES/NO
AUTH CHANGE: YES/NO
FINANCIAL DATA IMPACT: YES/NO
ROLLBACK REQUIRED: YES/NO
LIVE ACCESS REQUIRED: YES/NO

CURRENT STATUS:
[PLANNING | READY FOR REVIEW | APPROVED FOR EXECUTION | EXECUTED | VERIFICATION FAILED | CLOSED]
```

---

## NO SELF-CERTIFICATION

Antigravity may prepare implementation artifacts and evidence.

Antigravity **MUST NOT** declare its own work:
- `GO`
- `APPROVED`
- `SECURITY-SAFE`
- `PRODUCTION-READY`

unless explicitly instructed to provide a preliminary assessment.

Final architectural/security approval belongs strictly to the independent reviewer and human owner.

---

## CHANGE BUDGET

Every task artifact must explicitly state its change budget:

- **Maximum files expected to change:** [Number]
- **Maximum database objects expected to change:** [Number]
- **Schema changes allowed:** YES / NO
- **API changes allowed:** YES / NO
- **UI changes allowed:** YES / NO
- **Business-logic changes allowed:** YES / NO

Any proposed or actual change outside the declared budget requires **IMMEDIATE STOP + RE-APPROVAL**.

---

## TASK CLASSIFICATION

Before producing the task artifact, classify the task into one of three tiers and apply requirements proportionally:

### A. STANDARD FEATURE
- **Mandatory Sections:** 1–5, 7, 10–13, 15.
- **Conditional Sections:** 6, 8, 9, 14 (only when technically relevant to database/backend dependencies).

### B. SECURITY / DATABASE CHANGE
- **Mandatory Sections:** All sections (1–15) are mandatory.
- Live inventory, privilege analysis, versioned migration, deterministic rollback, and security verification are mandatory where applicable.

### C. EMERGENCY / HIGH-RISK DATABASE CONTAINMENT
- **Mandatory Sections:** All sections (1–15) are mandatory.
- Quiescence controls, cold backup/restore validation, deterministic rollback, financial reconciliation, and live privilege verification are mandatory.
- **Strict Rule:** Zero production execution without explicit human approval.

---

## STANDARDIZED ARTIFACT STRUCTURE

For every task, Antigravity MUST produce an artifact containing the following sections according to its classification:

1. **TASK**: Precise task title, tracking identifier, and assigned roles.
2. **OBJECTIVE**: High-level goal, threat/business context, and target outcome.
3. **SCOPE**: Explicit in-scope deliverables and system components.
4. **OUT OF SCOPE**: Explicit boundaries, non-goals, and deferred items.
5. **CURRENT STATE & BLAST RADIUS / DATA-FLOW MAPPING**:
   - Evidence-backed architectural baseline with strict evidence labels (`[VERIFIED FROM REPOSITORY]`, `[VERIFIED BY STATIC SQL REVIEW]`, `[REQUIRES LIVE EXECUTION]`, `[UNKNOWN]`).
   - Granular trace of all affected API functions, UI callers, state variables, and multi-step database mutations.
   - Comprehensive blast radius analysis detailing complete failure modes and user-facing impact.
6. **LIVE OBJECT / ROLE INVENTORY & PRIVILEGE MATRIX**:
   - *If live catalog access exists:* Produce the live inventory results.
   - *If live catalog access does not exist:* Produce the exact discovery inventory SQL and mark results `[REQUIRES LIVE EXECUTION]`. Do not infer production privileges from repository `schema.sql`.
   - Comparative privilege matrix mapping `anon`, `authenticated`, `PUBLIC`, `service_role`, and `postgres` permissions before and after changes.
7. **REQUIRED CHANGES & DEPENDENCY ORDERING**:
   - Concrete, step-by-step implementation tasks organized in strict dependency order (dependencies, schema, API, UI).
8. **EXACT MIGRATION & GENERATED ROLLBACK ARTIFACTS**:
   - Standalone, copy-paste executable SQL migration (`.sql`) free of Markdown corruption or unverified placeholders.
   - Deterministic rollback script generated directly from the live pre-change catalog baseline.
9. **TRANSACTION & QUIESCENCE CONTROLS**:
   - Multi-stage traffic cutover, operational acknowledgements, and session termination protocols.
   - Continuous 5-minute quiet window monitoring for non-idle database backends in `pg_stat_activity`.
   - Defensive transaction controls (`lock_timeout`, `statement_timeout`) to guarantee atomic rollback on lock contention.
10. **ACCEPTANCE TESTS & NON-DESTRUCTIVE VERIFICATION**:
    - Automated catalog assertions, safe read-only probes, and rollback-only transaction tests with zero production data mutations.
    - PostgREST HTTP verification distinguishing 401/403 access denial from empty result sets.
11. **SECURITY REQUIREMENTS**:
    - Security invariants, least-privilege enforcement, RLS default-deny rules, and credential confinement (zero service-role key in frontend).
12. **FILES EXPECTED TO CHANGE**: Explicit list of files permitted to be modified or created.
13. **FILES FORBIDDEN TO CHANGE**: Explicit list of protected files (e.g. `utils/taxLogic.ts`, `server/`, unrelated components).
14. **EVIDENCE REQUIRED & EVIDENCE SIGN-OFF**:
    - Concrete proof requirements (checksummed cold backup, isolated restore validation, reconciliation logs, quiet window logs, verification results).
    - Formal multi-stakeholder sign-off checklist.
15. **ABORT CONDITIONS**:
    - Strict, unambiguous abort gates under which execution must immediately STOP and roll back.
