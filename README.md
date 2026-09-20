# Municipal Treasurer's Office — Real Property Tax Delinquency Verification & Statement System

## LGU Treasury Connect

LGU Treasury Connect supports Municipal Treasurer's Office assessment and delinquency-verification work for Santa Rosa, Nueva Ecija. It manages property records, calculates liabilities under Republic Act No. 7160, records external settlement evidence, and generates auditable statements and notices.

This is not a cashiering system. It does not post payments, accept tenders, issue AF-51 receipts, manage receipt booklets, or operate payment queues.

## Governance

Authority order:

1. [`docs/SSOT.md`](docs/SSOT.md)
2. [`docs/MUNICIPAL_SYSTEM_IMPLEMENTATION_PLAN.md`](docs/MUNICIPAL_SYSTEM_IMPLEMENTATION_PLAN.md)
3. Current architecture and threat-model references
4. Active source code

Current implementation remains a candidate until every phase gate receives human review. Passing automated checks does not establish security or operational readiness.

## Approved Architecture

- **Frontend:** React 18, TypeScript strict mode, Vite
- **UI:** Tailwind CSS v3, local PostCSS, shadcn/ui primitives
- **Production datastore:** Supabase Cloud/PostgreSQL
- **Production authentication:** Supabase Auth
- **Authorization:** Trusted session claims plus PostgreSQL Row-Level Security
- **Canonical schema history:** `supabase/migrations/*.sql`
- **Development/test adapter:** `LocalHttpRepository`; not an equal production authority
- **Testing:** Vitest

Browser password comparison, seeded fallback credentials, and client-generated authorization tokens are prohibited production authentication paths.

## Product Scope

### In scope

- Admin and Assessor authentication
- Property masterlist and current/historical assessments
- Historical assessed-value transcription with provenance
- Durable import review and promotion
- Statutory delinquency calculation
- Arrears-first delinquency-period verification
- External settlement evidence references
- Statement of Account and CSV export
- RA 7160 Section 254 Notice of Delinquency and CSV export
- Conditional tax-clearance eligibility
- Append-only audit and security provenance

### Out of scope

- Payment posting
- Cash, check, online tender, or e-wallet collection
- AF-51 issuance
- Receipt numbering, booklet custody, or voiding
- Cashier navigation
- Offline tellering or payment queues
- Banking integration
- Accounting reconciliation
- BLGF collection reporting
- POS hardware

Legacy payment records may remain only as read-only historical evidence when municipal policy requires retention. They are not active collection authority.

## Roles

| Role | Authority |
|---|---|
| `Admin` | User management, policy configuration, authorized reversals, audit oversight, and approved assessment operations |
| `Assessor` | Assessment, historical AV provenance, import review, delinquency verification, external evidence, statements, and notices |

`SystemMaintenance`, if retained, is non-production/service-only authority for disposable test-data maintenance. `Cashier` and `Viewer` are not active roles.

## Core Rules

- Base tax: exactly 2% of assessed value: 1% Basic plus 1% SEF.
- Delinquency surcharge: exactly 2% monthly, capped at 36 months or 72%.
- Discounts apply only to current/advance obligations, never delinquent prior years.
- Verification follows oldest-unresolved-period-first ordering.
- Shell records cannot be verified or qualify for clearance.
- External settlement needs a source reference and creates no system receipt.
- Reversal requires Admin authority, mandatory reason, retained original record, and superseding event.
- Sensitive mutations must be atomic with audit writes.
- Applied migrations are immutable; deployed defects require forward migrations.

## Main Structure

```text
components/          UI components and accessible primitives
features/            Domain feature modules
services/            Repository contract and Supabase/local adapters
utils/               Statutory calculation and validation logic
docs/                SSOT, implementation plan, and operational references
supabase/migrations/ Canonical ordered schema history
server/               Inactive legacy Express/SQLite code; do not use
```

## Local Development

Requirements: Node.js 18 or newer and npm.

For deployment, use only ordered files under `supabase/migrations/`; `schema.sql` and `supabase/migration.sql` are retired. Supply an explicit Supabase Cloud database URL to `scripts/apply-migrations.sh --dry-run` and then `scripts/apply-migrations.sh`. Docker Compose serves the web build only; see [`docs/ON_PREMISE_DEPLOYMENT.md`](docs/ON_PREMISE_DEPLOYMENT.md) for target checks, HTTPS, backups, restore, and rollback.

```bash
npm install
npm run dev
```

Configure local environment values outside source control:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Never commit passwords, service-role keys, database credentials, or production secrets.

## Verification

Run before each phase gate:

```bash
npx tsc --noEmit
npm run lint
npm run test:unit
npm run build
```

Migration phases also require:

```bash
npx supabase migration list
npx supabase db push --include-all --dry-run
```

Never run `npx supabase db reset` against remote municipal data.

## Implementation Progress

See [`context/progress-tracker.md`](context/progress-tracker.md). Work proceeds phase by phase and stops for human approval at every gate.
