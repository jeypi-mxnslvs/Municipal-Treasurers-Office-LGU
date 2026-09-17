# LGU Treasury Connect

## Hardening Master Plan

You are hardening the current application:
**LGU Treasury Connect — Real Property Tax Delinquency Verification & Statement System**

This is a controlled hardening exercise.

## Critical scope rule

The current product is NOT a payment or collection system.

Do NOT reintroduce or implement:

* payment processing
* official receipts
* AF-51
* tellering
* payment gateways
* bank reconciliation
* collection accounting
* offline payment outbox
* payment synchronization
* payment voiding

The supplied forensic audit was produced against an older/full treasury implementation. Use it as forensic evidence and identify which findings still apply to the current system. Do not blindly implement legacy payment recommendations.

The current authoritative scope is:

1. Dashboard
2. Property Masterlist
3. Delinquency
4. Property/Taxpayer Verification
5. Import Center
6. Reports / Statement
7. Audit / Import History
8. Minimal approved Settings

Core objective:

Assessor CSV → validate → stage → review → commit → property master → delinquency determination → verification → trustworthy statement → audit/provenance.

---

# PHASE 0 — BASELINE AND SCOPE

Do not modify code initially.

Produce:

1. Current architecture map
2. Current frontend map
3. Current application-service map
4. Current repository map
5. Current Supabase schema map
6. Current RLS/grants map
7. Current authentication flow
8. Current authorization flow
9. Current import pipeline
10. Current delinquency engine
11. Current assessment-period implementation
12. Current audit implementation
13. Current statement-generation path

Classify every finding from the supplied forensic audit as:

* APPLIES
* DOES NOT APPLY
* ALREADY FIXED
* NEEDS VERIFICATION
* OPEN BUSINESS DECISION

Do not change behavior merely to satisfy the old audit.

Stop and report before proceeding.

---

# PHASE 1 — AUTHENTICATION AND AUTHORIZATION

Audit the current authentication system.

Determine:

* Who authenticates the user?
* Who issues the credential?
* Who verifies it?
* Where is it stored?
* Can the browser modify it?
* How is the role determined?
* How is the role enforced server-side?
* Can direct API calls bypass UI authorization?

Remove any browser-generated trust mechanism.

Do not trust:

currentUser.role
localStorage role
client-generated tokens
hidden buttons
React-only authorization

Target:

User
→ trusted authentication
→ authenticated identity
→ server/database authorization
→ application operation

Password requirements:

* No plaintext password storage
* No plaintext password comparison
* No password included in database records
* Password hashes must never be returned to the client

Roles must be explicitly approved and consistent across:

* database
* authentication
* claims/profile
* UI
* authorization
* tests

Every mutation must be rejected server-side when the user lacks permission.

Required tests:

* anonymous access denied
* forged role denied
* expired session denied
* unauthorized mutation denied
* password hash never exposed
* protected data unavailable to unauthenticated users

Stop and report.

---

# PHASE 2 — DATABASE / RLS / API SECURITY

Audit every exposed table, view, function and RPC.

For each object document:

* anon SELECT
* authenticated SELECT
* INSERT
* UPDATE
* DELETE
* function EXECUTE
* role restrictions
* RLS policy
* business authorization

Do not assume RLS alone is sufficient.

Verify both grants and policies.

Remove anonymous access to protected treasury data.

Restrict function execution to authorized identities.

Write database tests proving both allowed and denied operations.

Test:

* anonymous SELECT
* anonymous INSERT
* anonymous UPDATE
* anonymous DELETE
* unauthorized authenticated access
* authorized access
* unauthorized mutation
* privileged function execution

No direct client path may bypass authorization.

Stop and report.

---

# PHASE 3 — VALIDATION AND DATA INTEGRITY

Audit every user-editable field.

Required categories:

* TD number
* PIN
* barangay code
* taxpayer name
* address
* property classification
* lot area
* market value
* assessed value
* tax year
* assessment period
* discount
* delinquency status
* completion status
* import metadata

Every field must have:

1. UI validation
2. application/business validation
3. authoritative server/database validation where appropriate

Do not rely on parseFloat() for authoritative numeric validation.

Reject malformed values such as:

100000abc

Do not silently coerce invalid input.

Test:

* empty values
* malformed numbers
* negative values
* excessive values
* invalid years
* invalid barangay codes
* invalid TD numbers
* malformed PINs
* invalid assessment periods
* overlapping periods
* duplicate TD numbers

Stop and report.

---

# PHASE 4 — IMPORT AND HISTORICAL ASSESSMENT

Treat CSV import as an authoritative data-ingestion boundary.

Pipeline:

CSV
→ schema validation
→ required fields
→ type validation
→ normalization
→ TD validation
→ PIN validation
→ barangay validation
→ duplicate detection
→ conflict detection
→ assessment-period validation
→ provenance
→ staging
→ human review
→ commit

Never silently turn red validation failures into authoritative records.

Historical assessment periods must be period-specific.

Explicitly test:

1971–1980 → ₱1,234
1981–2008 → MISSING
2009–2017 → ₱100,000
2018–2026 → supplied value

The system must NOT carry an assessed value backward or forward into a missing period.

Test:

* valid periods
* adjacent periods
* overlapping periods
* invalid ranges
* missing periods
* multiple historical periods
* long historical coverage
* imported value provenance
* manual correction provenance

Do not invent a rule that automatically recalculates liability when assessed value is corrected. If the current system/business specification does not define that behavior, report it as an OPEN BUSINESS QUESTION.

Verify the 33 Santa Rosa barangay codes:

23001–23033

Verify TD/barangay consistency.

Stop and report.

---

# PHASE 5 — AUDITABILITY AND STATEMENT INTEGRITY

Audit all material mutations.

Every material change should be attributable to:

* user
* role
* timestamp
* record
* previous value
* new value
* action
* reason/remarks where required
* source/import batch where applicable

For delinquency year completion, record:

* TD/property
* tax year
* previous status
* new status
* user
* timestamp
* remarks/reference

Do not delete delinquency history merely because a year is marked complete.

Assessment corrections must preserve provenance.

Statements must be reproducible and contain:

* taxpayer
* property
* TD number
* barangay
* tax years
* itemized amounts
* total
* data cutoff
* source/import batch reference
* generated date
* generated by
* municipality-approved wording/disclaimer

Use:

"Based on records available to the Municipal Treasurer's Office as of [date]"

unless an authorized municipal wording supersedes it.

Test that two generations against identical source data produce equivalent authoritative statement data.

Stop and report.

---

# PHASE 6 — PRODUCTION / ON-PREMISE READINESS

Prepare the system for eventual municipal on-premise deployment.

Target:

Browser
→ Application server/API
→ PostgreSQL

Do not allow browser clients to connect directly to PostgreSQL.

Document:

* server requirements
* network topology
* TLS
* firewall rules
* secrets
* database credentials
* backups
* restore procedure
* migration procedure
* rollback procedure
* log retention
* monitoring
* account lifecycle
* workstation requirements
* disaster recovery
* maintenance procedure

The application must remain repository-independent.

Current:

Application
→ ITreasuryRepository
→ SupabaseRepository

Future:

Application
→ ITreasuryRepository
→ OnPremPostgresRepository

Do not couple business logic to Supabase-specific behavior.

Test migration/driver contracts before declaring on-prem readiness.

---

# QUALITY GATE

After every phase run:

npx tsc --noEmit
npm run lint
npm run test:unit
npm run build

Also run database integration/security tests where available.

Measure coverage rather than merely stating that tests pass.

Required evidence must distinguish:

VERIFIED
FIXED
NOT VERIFIED
OPEN BUSINESS QUESTION
SECURITY LIMITATION

Never claim production readiness solely because TypeScript, lint, unit tests and build pass.

---

# FINAL SECURITY POSITION

The system is ready for production consideration only when:

1. Authentication is server-verifiable.
2. Authorization is enforced outside the UI.
3. RLS/grants have been tested.
4. Anonymous protected-data access fails.
5. Invalid input cannot become authoritative data.
6. CSV import cannot silently corrupt records.
7. Historical assessment periods are isolated.
8. Audit attribution is trustworthy.
9. Statements are reproducible and traceable.
10. Backup and restoration have been demonstrated.
11. On-prem deployment architecture has been tested.
12. Human Treasurer/Assessor/Administrator/privacy/security review is complete.

Do not describe the system as COA-certified, legally compliant, or production-approved unless the authorized municipal reviewers have formally approved those claims.
