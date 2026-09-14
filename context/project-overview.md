# Project Overview — LGU Treasury Connect (Santa Rosa RPTAS)

## Overview

LGU Treasury Connect is a mission-critical Real Property Tax Administration System (RPTAS) engineered specifically for the Municipal Treasurer's Office of Santa Rosa, Nueva Ecija. It administers official property assessment rolls across Santa Rosa's 33 barangays, calculates statutory tax liabilities, delinquency surcharges, and prompt discounts under **Republic Act No. 7160 (Local Government Code of 1991)**, tracks counter settlements under strict Commission on Audit (COA) circulars, and provides real-time executive revenue dashboards for municipal leadership.

## Goals

1. **Zero Financial Corruption**: Enforce mathematically exact, deterministic tax calculation with zero random numbers and 100% unit-test protection.
2. **Statutory RA 7160 Compliance**: Enforce exact 2.00% base rates (1% Basic + 1% SEF), 2.00%/month penalty capped strictly at 36 months (72%), and statutory prompt discounts.
3. **Sequential "Arrears-First" Settlement**: Ensure taxpayers settle chronological delinquent prior years before clearing current-year liabilities.
4. **Resilient Teller Workflow**: Maintain seamless browser work-state persistence across page reloads and network reconnects.
5. **Auditable Accountability**: Maintain permanent field-level revision trails in `rptar_audit_logs` with mandatory supervisory justifications.

## Core User Flow

1. **Authentication**: Teller or Revenue Staff signs in with assigned municipal workstation credentials and station ID.
2. **Masterlist Inquiry**: Staff views the RPTAR property masterlist, filtered by barangay, status, or searched by TD Number, PIN, or Owner Name.
3. **Assessment Calculation**: Staff opens the Statement of Account (SOA) for a property. The system calculates statutory dues and arrears.
4. **Scope Selection**: Staff selects unpaid tax years under the chronological "Arrears-First" selection rule.
5. **Settlement Tracking / Assessor Override**:
   - Staff records counter dues clearance, which updates `completedYears`, advances `last_paid_year`, and records the completion.
   - Authorized assessors may apply statutory adjustments with mandatory audit justification.
6. **Audit & Reporting**: The system immutably logs all actions to `rptar_audit_logs` and provides instant printable Statements of Account.

## Features

### Real Property Assessment Masterlist (RPTAR)
- Masterlist covering all 33 canonical barangays of Santa Rosa, Nueva Ecija.
- Search by Tax Declaration (TD) Number, Property Identification Number (PIN), or Owner Name.
- Live pagination, status filters (Cleared, Partial, Delinquent), and quick reset.
- Assessment creation and editing modal for verified parcel properties.
- Bulk CSV Masterlist Importer with smart TD-level upsert and historical protection.

### Statutory RA 7160 Tax Engine
- Pure computation engine implementing RA 7160 Title II rules.
- 1.00% Basic Tax (General Fund) + 1.00% Special Education Fund (Local School Board).
- 2.00% per month penalty capped at 36 months (72% maximum surcharge).
- 20% advance discount (Jan 1 – Mar 31) and 10% prompt discount (Apr 1 – Dec 31) for current year; 0% for prior delinquent years.
- 100% test coverage passing all statutory assertions.

### Sequential Statement of Account & Clearance Tracking
- Visual Arrears-First selection model preventing skips of prior delinquent obligations.
- Quick scope selector buttons (Pay Oldest Year, Pay Prior Arrears, Pay All Dues).
- Granular operational status tracking (`OUTSTANDING` vs. `COMPLETED`).
- Authorized supervisory reversal and reopening protocol.

### Security, Audit & Administration
- Role-Based Access Control (Admin, Assessor, Cashier, Viewer).
- User and Workstation Management modal.
- Field-level audit trail (`rptar_audit_logs`) tracking original vs. modified values.
- Inactivity auto-lock and destructive action password re-authentication.

## Scope

### In Scope
- Property assessment roll management across Santa Rosa's 33 barangays.
- Statutory RA 7160 tax calculation engine with discounts and penalties.
- Counter clearance and settlement status tracking (`delinquency_year_completions`).
- Assessor valuation overrides with mandatory supervisory justification.
- Masterlist bulk CSV import and export.
- Browser reload work-state persistence (`localStorage`).

### Out of Scope
- Online credit card payment gateways, Stripe, PayPal, or e-wallets.
- Physical cash drawer or POS peripheral hardware drivers.
- Automated bank clearing or inter-bank wire reconciliation.
- Automated deletion of financial or delinquency records (Zero Deletion Rule).

## Success Criteria

1. **Deterministic Calculations**: All assessment outputs match RA 7160 statutory formulas without discrepancies.
2. **Zero Breaking Regressions**: 100% unit tests passing (`npm run test:unit`) for tax logic and security helpers.
3. **Zero Lint & Type Errors**: `npx tsc --noEmit` and `npm run lint` produce 0 errors and 0 warnings.
4. **Reliable Work-State Persistence**: Staff can refresh any screen, inquiry, or modal without losing work or context.
5. **Clean Production Compilation**: Production build (`npm run build`) builds cleanly with zero errors.
