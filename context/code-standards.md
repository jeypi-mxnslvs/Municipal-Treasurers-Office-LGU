# Code Standards — LGU Treasury Connect

## General Principles

- **Single-Purpose Feature Slices**: Keep modules small, focused, and organized by domain in `features/`.
- **Root-Cause Resolutions**: Address the underlying database schema or contract mismatch; never layer speculative client-side workarounds.
- **Pure Mathematical Core**: Tax calculation functions must remain pure, deterministic, and free of UI side-effects.
- **Zero Dead Code**: Unused components, dead servers, and orphan test files must be deleted or strictly excluded from imports.

## TypeScript Standards

- **Strict Mode**: `strict: true` enforced via `tsconfig.json`.
- **No Loose `any`**: Explicit interfaces defined in `types.ts` for all domain entities, calculation results, and payloads.
- **Runtime Defensiveness**: Safely handle API responses and local storage JSON parsing with try/catch and fallback defaults.
- **Verification Gate**: All PRs and edits must pass `npx tsc --noEmit` with exactly 0 type errors.

## React & Framework Conventions

- **React 18**: Functional components with TypeScript typing (`React.FC<Props>`).
- **Hooks & Stability**: Memoize callbacks passed to deep children with `useCallback` to prevent unnecessary re-renders.
- **Work-State Persistence**: Automatically synchronize active filters, pagination, and inquiries with `localStorage` so browser reloads do not break staff context.
- **Clean Cleanup**: Ensure timeouts, intervals, and toast notifications clean up their subscriptions in `useEffect` return handlers.

## Styling Standards

- **Zero External CDNs**: Zero remote CSS/fonts loaded at runtime. All styles compiled locally via PostCSS and Tailwind CSS v3.
- **Consistent Tokens**: Rely strictly on Santa Rosa Treasury tokens (`emerald-*`, `slate-*`).
- **Semantic Classes**: Follow shadcn/ui conventions with Radix primitives.

## API & Repository Layer (`ITreasuryRepository`)

- **Domain Decoupling**: UI components must never make direct raw PostgREST queries or instantiate ad-hoc Supabase clients.
- **Driver Abstraction**: All database calls route through `api.ts` which delegates to `ITreasuryRepository` (`SupabaseRepository`).
- **Partial Updates**: When updating entities via `saveProperty`, only pass explicitly defined fields to prevent `NOT NULL` constraint violations on unchanged columns.
- **Audit Logging**: Every mutation affecting property valuation or settlement milestones must generate a corresponding record in `rptar_audit_logs`.

## Data & Storage Conventions

- **Naming Alignment**:
  - PostgreSQL Database: `snake_case` (e.g. `td_number`, `last_paid_year`, `market_value`).
  - TypeScript Models: `camelCase` (e.g. `tdNumber`, `lastPaidYear`, `marketValue`).
  - Repository drivers handle explicit two-way mapping between schemas.
- **Zero Deletion Policy**: Delinquency records and property master assessments are never deleted; status reversals must preserve historical rows.

## File Organization

```
Municipal-Treasurers-Office-LGU/
├── components/          # Shared layout and shadcn/ui headless primitives
│   └── ui/              # Button, Table, Badge, Input, Dialog, DropdownMenu
├── features/            # Feature-sliced domain modules
│   ├── auth/            # LoginPage, UserManagementModal, PasswordConfirmationModal
│   ├── dashboard/       # DashboardStats (KPI summary cards)
│   ├── properties/      # DashboardTable, PropertyCard, RptarModal, BulkImportModal
│   ├── assessment/      # DelinquencyTable (Statement of Account)
│   └── audit/           # AuditLogModal (Revision trail)
├── services/            # Repository pattern abstraction
│   ├── ITreasuryRepository.ts # Domain repository contract
│   ├── SupabaseRepository.ts  # Supabase PostgREST implementation driver
│   ├── supabase.ts      # Low-level Supabase client
│   └── api.ts           # Unified API export
├── utils/               # Pure calculation logic and unit tests
│   ├── taxLogic.ts      # RA 7160 tax calculation engine
│   └── taxLogic.test.ts # Vitest unit test suite
├── docs/                # Canonical documentation
│   ├── SSOT.md          # Canonical Single Source of Truth
│   └── ROADMAP_AND_PHASES.md # Phased delivery plan
└── context/             # Six-File Context Methodology directory
```
