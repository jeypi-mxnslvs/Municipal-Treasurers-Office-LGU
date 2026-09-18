# Implementation Plan

## Product Name

**Real Property Tax Delinquency Verification & Statement System**

Municipality of Santa Rosa, Nueva Ecija.

## Product Boundary

### In scope

- Admin and Assessor authentication
- Assessor data import
- Durable import review
- Property masterlist
- Current and historical assessment records
- Historical valuation provenance
- Delinquency calculation
- Delinquency-period verification
- External settlement evidence reference, if municipal policy permits
- Statement of Account generation
- Notice of Delinquency generation
- Masterlist CSV import/export
- SOA CSV export
- Audit and provenance
- Conditional tax-clearance eligibility

### Out of scope

- Payment posting
- Cash/check/online tender
- AF-51 receipts
- Booklet custody
- Receipt voiding
- Cashier workflow
- Offline tellering
- Banking/e-wallet integration
- Accounting reconciliation
- BLGF collection reporting
- POS hardware
- MCP/AI automation

### Conditional

- Tax Clearance Certificate
- XLSX export
- On-premise backend
- External Assessor API

Add only after business policy or pilot evidence requires them.

## Stage 0: Scope Lock

### Objective

Create one authoritative product definition before code removal.

### Decisions required

1. Is system inquiry-only, or may it record external settlement evidence?
2. Who may verify assessment data?
3. Who may verify historical values?
4. Who may record external settlement evidence?
5. Who may reverse verification?
6. Who may issue a tax-clearance certificate?
7. Is Notice of Delinquency an official municipal output?
8. Is `lastPaidYear` trusted source data or verified treasury evidence?
9. Is Supabase actual production database?
10. Is `LocalHttpRepository` an actual near-term requirement?

### Required output

Approved policy table:

| Decision | Required result |
|---|---|
| Assessment approval | Named role |
| Historical AV verification | Named role |
| Delinquency verification | Named role |
| External settlement evidence | Allowed or prohibited |
| Verification reversal | Admin/supervisor rule |
| Clearance certificate | Allowed, prohibited, or conditional |
| Official notice | Approved output or deferred |
| Production datastore | One selected source |
| Authentication path | One selected path |

### Exit criteria

- Product scope approved.
- Payment terminology removed from product specification.
- No unresolved role or authority conflict.
- No coding starts before these decisions.

## Stage 1: Establish Domain Vocabulary

### Objective

Separate assessment, delinquency, verification, settlement evidence, and certificate eligibility.

### Replace ambiguous terms

| Current term | Replace with |
|---|---|
| `delinquency_year_completions` | `delinquency_period_verifications` |
| `completed` | Explicit verification status |
| `cleared` | `verified` or `externally settled` |
| `mark as settled` | `verify selected periods` |
| `last paid year` | `reported last paid year`, unless independently verified |
| `payment reference` | `source reference` or `external settlement reference` |
| `tax clearance` | `clearance eligibility`, until approved |

### Canonical period status

```text
UNVERIFIED
VERIFIED_OUTSTANDING
VERIFIED_SETTLED_EXTERNALLY
DISPUTED
NOT_APPLICABLE
SUPERSEDED
```

Rules:

- `UNVERIFIED`: insufficient source evidence.
- `VERIFIED_OUTSTANDING`: liability determined; no settlement evidence recorded.
- `VERIFIED_SETTLED_EXTERNALLY`: settlement evidence exists outside system.
- `DISPUTED`: conflicting source or human review required.
- `NOT_APPLICABLE`: no liability for period.
- `SUPERSEDED`: replaced by later authorized decision.

### Exit criteria

- Types, UI labels, documentation, and tests use same vocabulary.
- No current workflow calls verification a payment.
- No status implies payment unless external evidence exists.

## Stage 2: Role and Access Simplification

### Objective

Retain only roles needed by narrowed product.

### Admin

- Manage users and stations.
- Configure municipal tax settings.
- Approve or reverse sensitive verification decisions.
- View audit logs.
- Manage system configuration.
- Approve clearance issuance, if clearance remains in scope.
- Manage import authorization policy.

### Assessor

- View property records.
- Import assessment data.
- Review import differences.
- Create/update assessment records.
- Transcribe historical AV.
- Verify assessment provenance.
- Generate SOA and notices.
- Record verification decisions allowed by policy.

### Default restrictions

- No user reverses own verification.
- No Assessor changes audit history.
- No role changes without Admin.
- No property deletion where historical evidence exists.
- No verification write succeeds without audit write.
- No user may bypass unresolved historical periods.

### Legacy accounts

Do not delete historical users referenced by audit records.

```text
Cashier  -> DISABLED
Viewer   -> DISABLED
Admin    -> ACTIVE
Assessor -> ACTIVE
```

Preserve old user IDs and audit references.

### Exit criteria

- Only Admin and Assessor can authenticate.
- Disabled legacy accounts cannot log in.
- Audit records retain historical actor identity.
- Role permissions pass positive and negative tests.

## Stage 3: Remove Active Collection Surface

### Objective

Remove collection behavior from application without destroying historical records.

### Remove from active product

- AF-51 booklet manager
- Official Receipt modal
- Payment posting actions
- Receipt numbering
- Tender type selection
- Receipt voiding
- Offline payment queue
- Offline booklet allocation
- Cashier navigation
- Collection dashboard actions
- Collection-specific repository methods
- BLGF Form 3 navigation and generation

### Preserve as legacy data

Do not delete existing:

- `payment_postings`
- `accountable_forms`
- receipt references
- historical payment audit records

Treatment:

```text
Existing collection data: read-only legacy evidence
New collection writes: prohibited
Collection UI: removed
Collection tables: retained or archived
```

### Files to remove after reference scan

- `features/collections/BookletManagerModal.tsx`
- `features/collections/OfficialReceiptModal.tsx`
- `features/collections/index.ts`
- `services/offline/OfflineTreasuryRepository.ts`
- `services/offline/OfflineStorage.ts`
- `services/offline/OfflineSyncService.ts`
- Offline tellering tests
- Active payment methods from repository interface

Do not delete `transactionAtomicity.test.ts` until all historical payment behavior is intentionally excluded from application reads. Move it to a legacy test directory if historical receipts remain readable.

### Exit criteria

- No active UI can create payment or receipt records.
- No application path generates receipt numbers.
- No active path modifies `payment_postings`.
- Existing historical payment data remains preserved.
- Build and typecheck show no orphan imports.

## Stage 4: Durable Import Review

### Objective

Make Assessor data reviewable and reproducible before masterlist promotion.

### Import lifecycle

```text
RECEIVED
VALIDATING
UNDER_REVIEW
APPROVED
PARTIALLY_APPROVED
REJECTED
PROMOTED
FAILED
```

### Import batch data

Store:

- Batch ID
- Original filename
- File checksum
- Source office/operator
- Received timestamp
- Barangay scope
- Total rows
- Valid rows
- Invalid rows
- Conflict rows
- Approved rows
- Rejected rows
- Promotion timestamp
- Promoted by
- Batch status

### Import row data

Store:

- Batch ID
- Source row number
- Raw row snapshot
- Normalized values
- Existing property ID
- Proposed action
- Validation state
- Diff payload
- Reviewer decision
- Reviewer
- Decision timestamp
- Rejection reason
- Promotion result

### Rules

- Invalid rows cannot promote.
- Conflicting rows require explicit decision.
- Duplicate rows require deterministic resolution.
- Re-import of identical source produces no false update.
- Import cannot change verification history silently.
- Import cannot overwrite reported settlement history without explicit decision.
- Promotion writes audit event or rolls back.

### Exit criteria

- Closing/reopening browser does not lose review.
- Every row has final disposition.
- Approved batch promotion is reproducible.
- Source file can be identified later.
- Failed audit persistence blocks promotion.

## Stage 5: Assessment and Historical Domain Model

### Objective

Make historical assessment data first-class and provenance-complete.

### Target entities

#### Property identity

- Property ID
- TD number
- Previous TD relationships
- PIN
- Owner/address history
- Barangay
- Parcel origin
- Identity status

#### Assessment period

- Property ID
- Period key
- Start year
- End year
- Period label
- Market value
- Assessed value
- Assessment level
- Source type
- Source batch
- RPTAR reference
- Verification status
- Created by
- Verified by
- Superseded record

#### Source evidence

- Source file/batch
- Physical ledger reference
- Document description
- Source date
- Entered by
- Verified by
- Reason for correction

### Rules

- Historical AV is never silently overwritten.
- Correction creates a new version or superseding event.
- Missing AV remains `UNVERIFIED`.
- Positive AV without source provenance cannot become verified.
- Current property AV cannot silently stand in for historical AV when period-specific evidence is required.

### Migration approach

1. Preserve existing JSONB values.
2. Extract valid entries into assessment-period records.
3. Mark source as legacy migration.
4. Retain original JSONB during transition.
5. Compare calculation outputs before and after migration.
6. Remove JSONB dependency only after equivalence validation.

### Exit criteria

- Every payable historical period has source provenance.
- Missing historical periods remain explicit.
- Same property can contain multiple periods without key collision.
- Assessment corrections preserve prior versions.

## Stage 6: Delinquency Verification Model

### Objective

Track verification decisions without representing them as system-recorded payment.

### Recommended table

```sql
CREATE TABLE delinquency_period_verifications (
    id BIGSERIAL PRIMARY KEY,
    property_id BIGINT NOT NULL REFERENCES properties(id),
    td_number_snapshot TEXT NOT NULL,
    period_key TEXT NOT NULL,
    tax_year INT NOT NULL,
    period_label TEXT NOT NULL,
    status TEXT NOT NULL CHECK (
        status IN (
            'UNVERIFIED',
            'VERIFIED_OUTSTANDING',
            'VERIFIED_SETTLED_EXTERNALLY',
            'DISPUTED',
            'NOT_APPLICABLE',
            'SUPERSEDED'
        )
    ),
    verification_type TEXT NOT NULL CHECK (
        verification_type IN (
            'ASSESSMENT',
            'HISTORICAL_VALUATION',
            'DELINQUENCY',
            'EXTERNAL_SETTLEMENT_EVIDENCE'
        )
    ),
    source_reference TEXT,
    remarks TEXT,
    verified_by BIGINT NOT NULL REFERENCES users(id),
    verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    station_id TEXT,
    supersedes_id BIGINT REFERENCES delinquency_period_verifications(id),
    reversal_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Use `period_key`, not only `tax_year`.

Examples:

```text
1973-79
1994-2005
2026-1-2Q
2026-3-4Q
2027
```

### Verification actions

#### Verify outstanding

Requires:

- Valid property identity
- Valid assessment source
- Deterministic calculation
- No unresolved blocking conflict

#### Record external settlement evidence

Requires:

- External reference
- Evidence description
- Authorized operator
- Explicit status `VERIFIED_SETTLED_EXTERNALLY`

Does not create:

- Payment posting
- Receipt number
- Tender record
- AF-51 record

#### Reverse verification

Requires:

- Admin authorization
- Reason
- New immutable reversal event
- No deletion of original decision

### Exit criteria

- Verification action creates durable record.
- Audit failure aborts action.
- Arrears-first ordering is enforced.
- Unverified history cannot be verified accidentally.
- Reversal preserves original history.
- No payment row is created.

## Stage 7: Delinquency Engine Alignment

### Objective

Preserve correct tax math while making data authority explicit.

### Keep

- Historical bracket logic.
- 1% Basic + 1% SEF.
- Penalty schedule.
- Missing valuation behavior.
- Arrears-first sequence.
- Current-year quarter handling.
- Manual override calculations.

### Change

Calculation input must distinguish:

```text
reportedLastPaidPeriod
verifiedPeriodStatuses
assessmentPeriods
historicalUnverifiedPeriods
```

Do not infer “paid” solely from `lastPaidYear`.

### Calculation output

Each record should expose:

```text
periodKey
status
verificationStatus
assessmentSource
isPayable
isStatementReady
isClearanceEligible
```

Rules:

- `UNVERIFIED` period: no definitive amount.
- `DISPUTED` period: no definitive statement total unless clearly marked.
- `VERIFIED_OUTSTANDING`: amount may appear in SOA.
- `VERIFIED_SETTLED_EXTERNALLY`: amount may appear as historical settled evidence.
- Missing historical AV never displays as zero liability.
- Zero grand total does not automatically mean clearance eligible.

### Exit criteria

- Existing statutory tests remain passing.
- New tests cover status interactions.
- Same inputs produce deterministic output.
- Unverified data cannot become payable through default fallback.

## Stage 8: Statement of Account

### Objective

Produce reproducible, evidence-aware statements.

### SOA contents

#### Header

- Municipality
- TD number
- PIN
- Owner
- Location
- Property class
- Generation date
- Generated by
- Statement reference

#### Period rows

- Period key
- Period label
- Assessment value
- Basic tax
- SEF tax
- Base tax
- Months delayed
- Penalty rate
- Penalty amount
- Discount rate
- Discount amount
- Net due
- Verification status
- Source reference
- Exception note

#### Totals

Use:

```text
Verified outstanding total
Externally settled evidence total
Unverified periods
Disputed periods
Statement total
```

Do not combine unknown/unverified values into zero.

### Reproducibility

An official SOA must record:

- Calculation date
- Tax settings version
- Assessment input version
- Verification decision IDs
- Statement generator version
- Operator
- Source batch references

If SOA is only informal inquiry output, a live view may suffice. If used as an official municipal output, persist a statement snapshot.

### Export

Keep CSV. Include verification and provenance columns.

Defer XLSX unless staff explicitly requires workbook format.

### Exit criteria

- Printed and exported SOA match.
- Re-running the same snapshot produces the same totals.
- Unverified periods are visibly excluded or marked.
- No payment or receipt fields appear.
- Treasurer can explain every total from source data.

## Stage 9: Notice of Delinquency

### Objective

Retain statutory delinquency notice without collection subsystem.

### Keep

- RA 7160 Sec. 254 structure.
- Historical bracket presentation.
- Itemized Basic and SEF totals.
- Print layout.
- CSV export, if operationally used.

### Remove or revise

- OR number field.
- Latest official receipt dependency.
- Payment-specific assumptions.
- Any amount derived from unverified valuation without warning.

Replace payment references with:

```text
Last reported settlement reference, if available
```

or remove them entirely.

### Required policy

Define treatment of:

- Unverified historical periods
- Disputed property identity
- Missing assessed value
- External settlement evidence
- Partial statement totals

### Exit criteria

- Treasurer accepts wording.
- Signatory is confirmed.
- Notice never presents unresolved periods as verified amounts.
- Output does not depend on AF-51/payment subsystem.

## Stage 10: Tax Clearance Decision

### Do not implement certificate first

First decide whether system may issue a certificate.

### Clearance eligibility model

Eligibility requires:

```text
property identity verified
current assessment verified
required historical periods resolved
no unverified blocking period
no disputed period
all outstanding liabilities resolved
external settlement evidence recorded where applicable
authorized officer approval
calculation date captured
```

### If payment remains outside system

The certificate may only state one of:

```text
No computed outstanding liability based on verified records
```

or:

```text
External settlement evidence reviewed and recorded
```

Do not state “taxes paid” unless municipal authority accepts the external evidence model.

### Recommended implementation

Phase 1:

- Add `clearanceEligibility` calculation.
- Show reasons for ineligibility.
- Do not issue certificate.

Phase 2, only after policy approval:

- Persist certificate snapshot.
- Assign certificate number from approved administrative series.
- Record purpose.
- Record certifying officer.
- Record evidence decision IDs.
- Prohibit silent regeneration changes.
- Support revocation/supersession, never deletion.

Do not hardcode an officer name in code. Store configured signatory with name, title, effective date, authorization status, and approving Admin.

## Stage 11: Audit and Provenance

### Objective

Make every authoritative change provable.

### Audit requirements

Audit:

- Login success/failure
- Import receipt
- Row validation result
- Row approval/rejection
- Property promotion
- Assessment correction
- Historical AV transcription
- Delinquency verification
- External settlement evidence
- Verification reversal
- Statement generation
- Notice generation
- Clearance eligibility decision
- User/role changes
- Tax policy changes

### Rules

- Audit insert failure blocks source mutation.
- Audit logs cannot update or delete through application role.
- Actor comes from verified session, never hardcoded.
- Station ID comes from trusted session context.
- Every correction references prior record.
- Export events record operator and source version.

### Exit criteria

- Database policies enforce append-only audit.
- Static attribution is removed.
- Negative tests prove unauthorized update/delete fails.
- Audit history survives record correction.

## Stage 12: Architecture Simplification

### Keep

- React + TypeScript.
- Pure tax engine.
- Repository boundary.
- Supabase, if confirmed as production datastore.
- Local CSV processing where durable review is not required.

### Refactor

- Repository methods to current scope.
- Auth path to one implementation.
- RLS policies.
- Verification authority.
- Assessment-period persistence.
- Statement snapshot behavior.
- Audit error handling.

### Defer

- LocalHttpRepository production backend.
- On-prem deployment.
- Supabase Realtime.
- Offline storage.
- TanStack Query migration unless measured performance requires it.
- XLSX.
- External Assessor API.

### Remove

- MCP.
- Collection architecture from active product.
- Payment fallbacks.
- Cashier/Viewer active role logic.
- BLGF Form 3 collection report.
- Dashboard collection KPIs not needed for inquiry.

## Stage 13: Test Plan

### Domain tests

- Period-key uniqueness.
- Historical bracket mapping.
- Missing valuation.
- Property identity conflicts.
- Verification state transitions.
- Reversal creates superseding event.
- No self-reversal.
- External settlement evidence does not create payment.
- Arrears-first verification.
- Unverified gap blocks clearance.
- Disputed period blocks clearance.

### Import tests

- Duplicate TD.
- Same-file reimport.
- Changed AV.
- Changed owner.
- Invalid barangay.
- Invalid property class.
- Conflicting year fields.
- Batch approval.
- Partial approval.
- Promotion rollback.

### Statement tests

- Exact totals.
- Basic/SEF balance.
- Pending period display.
- Provenance columns.
- CSV escaping.
- Reproducible snapshot.
- No receipt/payment fields.

### Security tests

- Admin-only user management.
- Assessor-permitted assessment operations.
- Disabled Cashier/Viewer rejection.
- Unauthorized RLS mutations rejected.
- Audit update/delete rejected.
- Audit failure blocks mutation.

### Required verification commands

```bash
npx tsc --noEmit
npm run lint
npm run test:unit
npm run build
```

### Manual acceptance scenarios

1. Import clean Assessor file.
2. Review and approve new property.
3. Re-import unchanged file.
4. Re-import changed AV.
5. Resolve conflicting TD.
6. Transcribe historical AV with physical RPTAR reference.
7. Verify outstanding periods.
8. Record external settlement evidence, if policy permits.
9. Reverse one verification as Admin.
10. Generate SOA with unresolved historical period.
11. Generate SOA after resolution.
12. Generate Notice of Delinquency.
13. Attempt clearance with unresolved period.
14. Attempt clearance with disputed period.
15. Attempt unauthorized role action.
16. Confirm no payment or receipt record is created.

## Stage 14: Real-World Pilot

### Objective

Prove Treasurer/Assessor workflow, not merely software behavior.

### Sample

Use 20–50 real or masked properties:

- Clean modern property
- New import
- Existing update
- Historical gap
- Shell record
- Missing PIN
- Previous TD
- Changed owner/address
- Partial current-year status
- Verified outstanding period
- External settlement evidence
- Disputed record

### Evidence

Collect:

- Source files and checksums
- Import batch outcomes
- Physical RPTAR references
- Before/after property records
- Verification decisions
- SOA exports
- Printed statements
- Notice samples
- Operator feedback
- Manual workarounds
- Defect classifications
- Treasurer acceptance decision

### Pilot exit

- No manual spreadsheet reconstruction for accepted cases.
- Every amount is traceable.
- Every unresolved item is visible.
- Operators agree terminology is correct.
- Operators agree who may perform each action.
- Statement output is accepted for intended use.
- Defects are classified before implementation.

## Change Budget

### Stages 0–2

- Maximum: 10 files
- Type/domain/auth/schema changes: Yes
- UI changes: Limited
- Payment data deletion: No
- New product features: No

### Stage 3

- Maximum: 12 files plus one migration
- Collection UI deletion: Yes
- Historical table deletion: No
- Repository contract changes: Yes

### Stages 4–7

- Maximum: 8 files plus one migration per stage
- Domain/schema changes: Yes
- UI changes only support approved workflow
- No unrelated architecture refactor

### Stages 8–10

- Maximum: 6 files per stage
- Statement/reporting changes: Yes
- Certificate issuance: blocked pending policy approval

### Stages 11–14

- No feature expansion
- Verification and pilot only

## Definition of Done

> System is finished when authorized Admin or Assessor can receive an agreed Assessor extract, review and promote source data, trace assessment history, determine verified delinquency, preserve unresolved exceptions, generate a reproducible Statement of Account, and produce an accepted Notice of Delinquency without manual account reconstruction or payment-system dependency.

Stop adding features when:

- Pilot acceptance passes.
- Municipal authority approves vocabulary and roles.
- All authoritative records have provenance.
- Unresolved periods are explicit.
- Statement totals are reproducible.
- No real workflow failure remains.

**First implementation action:** approve Stage 0 policy decisions. Do not start deletion or certificate work before verification vocabulary and authority model are approved.
