# LGU Treasury Connect — Single Source of Truth (SSOT)
**System Specification & Canonical Architecture Document**  
**Municipality of Santa Rosa, Nueva Ecija — Real Property Tax Administration System (RPTAS)**

---

## 1. Document Control & System Identity

| Property | Canonical Specification |
|---|---|
| **System Name** | LGU Treasury Connect (Santa Rosa RPTAS) |
| **Document Purpose** | Single Source of Truth (SSOT) governing all data models, statutory tax logic, security policies, accountable forms controls, and feature branch implementations. |
| **Jurisdiction** | Municipality of Santa Rosa, Province of Nueva Ecija, Region III, Philippines |
| **Statutory Framework** | Republic Act No. 7160 (Local Government Code of 1991, Title II), Provincial Tax Ordinance of Nueva Ecija, Municipal Revenue Code of Santa Rosa, Commission on Audit (COA) Circulars 2002-003 & 2012-001 |
| **Current Baseline** | v1.0.0 (Vite + React 18 + TypeScript + Local Tailwind CSS + shadcn/ui + Vitest) |
| **Roadmap Companion** | [`ROADMAP_AND_PHASES.md`](file:///home/jeipyyy/Documents/Projects/LGU-Treasury-Connect/lgu-treasury-connect/docs/ROADMAP_AND_PHASES.md) |

---

## 2. Statutory Business & Tax Calculation Rules

All tax calculations in the system must strictly adhere to RA 7160 Title II. These rules are verified by unit tests in [`utils/taxLogic.test.ts`](file:///home/jeipyyy/Documents/Projects/LGU-Treasury-Connect/lgu-treasury-connect/utils/taxLogic.test.ts).

### 2.1 Tax Rates & Allocation
- **Current Operational Year**: `2026` (`CURRENT_YEAR = 2026`).
- **Base Real Property Tax (RPT) Rate**: `2.00%` (`0.02`) of Assessed Value:
  - **Basic Tax**: `1.00%` (`0.01`) allocated to the General Fund of the Municipality and Barangays (RA 7160 Sec. 233).
  - **Special Education Fund (SEF)**: `1.00%` (`0.01`) allocated exclusively to the Local School Board (RA 7160 Sec. 235).

$$\text{Base Tax} = \text{Assessed Value} \times 0.02 = \text{Basic Tax (1\%)} + \text{SEF Tax (1\%) }$$

### 2.2 Property Valuation Formulas
- **Market Value (MV)**: Determined from the Schedule of Market Values (SFMV) based on lot area, classification, and barangay base rates.
  $$\text{Market Value} = \text{Lot Area (sqm)} \times \text{Base Rate per sqm}$$
- **Assessed Value (AV)**: Taxable base derived by applying statutory Assessment Levels (AL):
  $$\text{Assessed Value} = \text{Market Value} \times \text{Assessment Level}$$
- **Canonical Property Classes & Statutory Assessment Levels**:
  - `Residential`: `20%` (0.20)
  - `Agricultural`: `40%` (0.40)
  - `Industrial`: `50%` (0.50)
  - `Machinery`: `80%` (0.80)
  - `Dwell House`: Scaled based on value tiers (default `20%`)

### 2.3 Delinquency Penalties (Surcharges)
- **Accrual Rate**: `2%` per month of delay (`PENALTY_RATE_PER_MONTH = 0.02`) (RA 7160 Sec. 255).
- **Statutory Penalty Cap**: Maximum of `36 months` (`MAX_PENALTY_MONTHS = 36`), capping modern annual surcharges at **`72%`** (`0.72`) of the delinquent base tax.
- **Municipal Assessment Era Penalty Schedule (Santa Rosa Treasury)**: Under Santa Rosa Treasury's canonical spreadsheet engine:
  - **Pre-1994 Historical Eras (`1973-79` through `1992-1993`)**: Fixed municipal legacy rate of **`24%`** (`0.24`).
  - **1994 Revision Era through Modern Rolls (`1994-2005`, `2006-11`, and `2012` to `2023`)**: Statutory maximum cap of **`72%`** (`0.72` / 36 months).
  - **Recent Delinquent Rolls**:
    - `2024`: **`66%`** (`0.66` / 33 months)
    - `2025`: **`42%`** (`0.42` / 21 months)
    - `2026 1-2Q`: **`18%`** (`0.18` / 9 months)
  - **Prompt & Advance Windows**:
    - `2026 3-4 Q`: **`0%`** penalty (eligible for 10% prompt discount in Q3/Q4)
    - `2027`: **`-20%`** advance prompt discount
- **Accrual Start**: Past delinquent years accrue from January 1 of that tax year. Current year liabilities accrue penalty quarterly or after statutory deadlines.

$$\text{Effective Delay Months} = \min(\text{Months Delayed}, 36)$$
$$\text{Penalty Rate} = \text{Effective Delay Months} \times 0.02 \quad (\text{or } 0.24 \text{ for years } \le 1993)$$
$$\text{Penalty Amount} = \text{Base Tax} \times \text{Penalty Rate}$$
$$\text{Total Year Liability} = \text{Base Tax} + \text{Penalty Amount} - \text{Discounts}$$

### 2.4 Payment-Date-Based Discounts (Municipal Tax Policy)
Discounts apply strictly based on the **payment date** for the current tax year (and advance payments).
> [!IMPORTANT]
> **Payment-Date-Based Policy**: The 10% rate is a **payment-date-based discount policy** (April 1 to December 31), NOT a quarterly discount, unless the system is formally expanded to true quarter-level accounting.
- **Default Rates & Windows**:
  - **January 1 – March 31**: Default discount is **`20%`** (`early_payment_discount_rate = 0.20`).
  - **April 1 – December 31**: Default discount is **`10%`** (`regular_prompt_discount_rate = 0.10`).
  - **Delinquent Prior-Year Obligations**: Default discount is strictly **`0%`** (`delinquent_discount_rate = 0.00`). Under RA 7160, discounts apply **only** to the current or advance year, never to delinquent prior-year liabilities.
- **Configurable Tax Policy**:
  - These percentages must NOT be permanently hardcoded. They are stored in `municipal_tax_settings` and auto-populate based on payment date and delinquency status.

### 2.5 Authorized Assessor Manual Overrides & Real-Time Recalculation
Authorized Assessors have statutory discretion to manually adjust populated tax fields:
- **Editable Fields**:
  1. `Basic Tax` (PHP)
  2. `SEF Tax` (PHP)
  3. `Discount Rate` (%)
- **System Default Display**: The UI must display the system-calculated default value alongside the editable input so that discrepancies remain clear.
- **Immediate Recalculation**:
  - Changing Basic Tax, SEF Tax, or Discount Rate immediately recalculates:
    $$\text{Eligible Tax Base} = \text{Basic Tax} + \text{SEF Tax}$$
    $$\text{Discount Amount} = \text{Eligible Tax Base} \times \text{Discount Rate}$$
    $$\text{Net Amount Due} = \text{Eligible Tax Base} + \text{Penalty Amount} - \text{Discount Amount}$$
  - **Non-Free Entry for Discount Amount**: `Discount Amount` is always mathematically derived from the applied discount rate and eligible tax base; it cannot be an independent free-text entry.
  - **Preservation of System Defaults**: Manual edits must NOT silently overwrite original calculated values or alter the underlying statutory rate configuration.

### 2.6 Field-Level Audit Trail (`rptar_audit_logs`)
Every manual modification to `Basic Tax`, `SEF Tax`, or `Discount Rate` creates an individual field-level audit record. Generic "assessment modified" entries are strictly prohibited.
- **Preserved Audit Fields**:
  - `property_id` & `td_number`
  - `tax_year`
  - `field_changed` (`BASIC_TAX`, `SEF_TAX`, `DISCOUNT_RATE`)
  - `original_value` (system-calculated default)
  - `new_value` (assessor-applied value)
  - `difference` (`new_value - original_value`)
  - `user_id` / `user_name` & `user_role`
  - `station_id` (workstation identifier)
  - `reason` (mandatory assessor justification)
  - `created_at` (audit timestamp)

### 2.7 "Arrears First" Sequential Settlement Rule
- Taxpayers **cannot** pay current year (2026) dues while delinquent prior-year liabilities remain unsettled.
- Payment scopes must be applied strictly in chronological order starting from the earliest unpaid year ($\text{lastPaidYear} + 1$).
- Tellers may select 1 Quarter, 1 Year, or Full Payoff, but selection must anchor on the oldest unpaid record.

### 2.8 Shell Records Rule
- Properties flagged as `is_shell_record = true` represent historical, unverified, or fragmented legacy parcels lacking a verified Tax Declaration (TD) Number or Property Identification Number (PIN).
- **Payment Prohibition**: Shell records **cannot** have payments posted until formally verified, updated with SFMV rates, and certified by the Municipal Assessor.

### 2.9 Statutory Notice of Delinquency (RA 7160 Sec. 254 Specification)
Under **Section 254 of Republic Act No. 7160 (Local Government Code of 1991)**, when real property tax becomes delinquent, the local treasurer must issue a formal Notice of Delinquency. The canonical Santa Rosa Notice of Delinquency document structure, period aggregation brackets, and signatory specifications are codified below:

#### 2.9.1 Header & Legal Mandate
- **Jurisdiction**: 
  ```text
  REPUBLIC OF THE PHILIPPINES
  PROVINCE OF NUEVA ECIJA
  Office of the Treasurer
  Municipality of Santa Rosa
  ```
- **Document Title**: `NOTICE OF DELINQUENCY IN THE PAYMENT OF REAL PROPERTY TAX`
- **Statutory Notice Text**:
  > *"Notice is hereby served pursuant to the provision of Section 254, Republic Act No. 7160 (Local Government Code of 1991) the Real Property Tax for Calendar year 2025 and the previous years, has been delinquent with the respect to the figures."*
- **Audit References**:
  - `OR#`: Number of latest issued Official Receipt (Accountable Form 51)
  - `LAST PAYMENT:`: Date and details of last recorded settlement
  - `Notice Serving Period`: Current tax operations window (e.g. `SEPTEMBER 01-31, 2026`)

#### 2.9.2 Property & Valuation Headers
1. `Tax Declaration No.` (Current and previous TD reference)
2. `Area` (Land area in square meters / hectares)
3. `Assessed Value` (Taxable base in PHP)
4. `Location` (Barangay and street location)
5. `Kind of Property` (Classification: Residential, Agricultural, Commercial, Industrial, Machinery)

#### 2.9.3 Historical Delinquency Period Groupings (Canonical Roll Brackets)
To administer multi-decade delinquent arrears without document truncation, Santa Rosa Treasury codifies historical assessment eras into standard municipal aggregation brackets:

| Period / Year Range | Bracket Type | Statutory / Historical Assessment Context |
|---|---|---|
| `1973-79` | Multi-Year Aggregate | Presidential Decree No. 464 (Real Property Tax Code of 1974) Enactment Era |
| `1980-85` | Multi-Year Aggregate | Early 1980s General Assessment Revision Roll |
| `1986` | Single Year | 1986 Constitutional Transition Period |
| `1987-1991` | Multi-Year Aggregate | Late Pre-Local Government Code Roll |
| `1992-1993` | Multi-Year Aggregate | RA 7160 Initial Enactment Period |
| `1994-2005` | Multi-Year Aggregate | 1994 General Revision Era (12-year valuation block) |
| `2006-11` | Multi-Year Aggregate | 2006 General Revision Era (6-year valuation block) |
| `2012` to `2025` | Annual Itemized | Individual modern calendar assessment rolls |
| `2026 1-2Q` | Semi-Annual Quarter Split | Overdue / Delinquent quarters of the operational year (Q1 & Q2) |
| `2026 3-4 Q` | Semi-Annual Quarter Split | Current / Prompt payment quarters of the operational year (Q3 & Q4) |
| `2027` | Annual Advance | Advance assessment year (eligible for advance prompt discount) |

#### 2.9.4 Period Columnar Computation Rules & Municipal Penalty Schedule
For each period or aggregated bracket above, calculations are governed by the official Santa Rosa Municipal Treasurer Notice of Delinquency schedule (matching workbook tab `SEP`):

| Period / Roll Bracket | Multiplier / Span | Unpaid Taxes Formula (Per Fund) | Municipal Penalty / Discount Rate | Net Total Delinquency (Per Fund) |
|---|---|---|---|---|
| `1973-79` | 7 Years | `(Assessed Value * 0.01) * 7` | `+24%` (`0.24`) | `Unpaid Taxes + (Unpaid Taxes * 0.24)` |
| `1980-85` | 6 Years | `(Assessed Value * 0.01) * 6` | `+24%` (`0.24`) | `Unpaid Taxes + (Unpaid Taxes * 0.24)` |
| `1986` | 1 Year | `(Assessed Value * 0.01) * 1` | `+24%` (`0.24`) | `Unpaid Taxes + (Unpaid Taxes * 0.24)` |
| `1987-1991` | 5 Years | `(Assessed Value * 0.01) * 5` | `+24%` (`0.24`) | `Unpaid Taxes + (Unpaid Taxes * 0.24)` |
| `1992-1993` | 2 Years | `(Assessed Value * 0.01) * 2` | `+24%` (`0.24`) | `Unpaid Taxes + (Unpaid Taxes * 0.24)` |
| `1994-2005` | 12 Years | `(Assessed Value * 0.01) * 12` | `+72%` (`0.72` max statutory) | `Unpaid Taxes + (Unpaid Taxes * 0.72)` |
| `2006-11` | 6 Years | `(Assessed Value * 0.01) * 6` | `+72%` (`0.72` max statutory) | `Unpaid Taxes + (Unpaid Taxes * 0.72)` |
| `2012` to `2023` | 1 Year each | `(Assessed Value * 0.01) * 1` | `+72%` (`0.72` max per year) | `Unpaid Taxes + (Unpaid Taxes * 0.72)` |
| `2024` | 1 Year | `(Assessed Value * 0.01) * 1` | `+66%` (`0.66` / 33 months) | `Unpaid Taxes + (Unpaid Taxes * 0.66)` |
| `2025` | 1 Year | `(Assessed Value * 0.01) * 1` | `+42%` (`0.42` / 21 months) | `Unpaid Taxes + (Unpaid Taxes * 0.42)` |
| `2026 1-2Q` | Half Year (0.5) | `(Assessed Value * 0.01) * 0.5` | `+18%` (`0.18` / 9 months) | `Unpaid Taxes + (Unpaid Taxes * 0.18)` |
| `2026 3-4 Q` | Half Year (0.5) | `(Assessed Value * 0.01) * 0.5` | `None` (`0%` / prompt window) | `Unpaid Taxes - Prompt Discount` |
| `2027` | 1 Year | `(Assessed Value * 0.01) * 1` | `-20%` (`0.20` advance discount) | `Unpaid Taxes - (Unpaid Taxes * 0.20)` |

> [!IMPORTANT]
> **Santa Rosa Municipal Delinquency Protocol & Fund Balancing**:
> 1. **Table Rows (Single Fund Base)**: Each row in the Notice of Delinquency itemizes the 1% tax base ($\text{Assessed Value} \times 0.01 \times \text{Multiplier}$) and its statutory surcharge or prompt discount.
> 2. **Accountable Totals (Rows 40–42)**:
>    - `BASIC`: The sum of the itemized table column (`Total Tax Delinquency`), allocated to the General Fund.
>    - `SEF`: An equal, identical amount allocated to the Special Education Fund (Local School Board).
>    - `TOTAL`: The grand total payable by the taxpayer ($\text{BASIC} + \text{SEF} = 2 \times \text{Table Column Sum}$).

#### 2.9.5 Mandatory Accountable Totals & Signatories
- **Summary Totals**:
  - `BASIC`: Total Basic Tax (1% General Fund)
  - `SEF`: Total Special Education Fund (1% Local School Board)
  - `TOTAL`: Grand Total Tax Delinquency
- **Canonical Signatories**:
  - **Prepared by**: `Revenue Collection Clerk`
  - **Received by**: `Signature over printed name & Date` (Taxpayer / Owner acknowledgment)
  - **Approved by / Municipal Treasurer**: `Myra V. Cunanan, Municipal Treasurer`

---

## 3. Canonical Data Architecture & Schemas

The database schema must adhere to this unified specification across Supabase Cloud and On-Premise PostgreSQL.

```mermaid
erDiagram
    users ||--o{ payment_postings : "posts"
    users ||--o{ rptar_audit_logs : "records"
    users ||--o{ accountable_forms : "assigned_to"
    properties ||--o{ payment_postings : "receives"
    properties ||--o{ rptar_audit_logs : "audits"
    schedule_of_market_values ||--o{ properties : "values"

    users {
        int id PK
        text username UK
        text password_hash
        text full_name
        text role
        text station_id
        timestamptz created_at
    }

    properties {
        int id PK
        text td_number UK
        text previous_td_number
        text pin
        text owner_name
        text address
        text barangay
        text property_class
        numeric lot_area_sqm
        numeric market_value
        numeric assessed_value
        int last_paid_year
        boolean is_shell_record
        timestamptz created_at
        timestamptz updated_at
    }

    schedule_of_market_values {
        int id PK
        text barangay
        text property_class
        numeric base_rate_sqm
        numeric assessment_level
    }

    payment_postings {
        int id PK
        text receipt_no UK
        int property_id FK
        jsonb paid_records
        numeric total_paid
        numeric basic_tax
        numeric sef_tax
        numeric penalty_amount
        numeric discount_amount
        numeric discount_rate
        text tender_type
        text tender_reference
        text status
        text posted_by
        timestamptz posted_at
    }

    accountable_forms {
        int id PK
        text form_type
        text booklet_no
        int series_start
        int series_end
        int current_serial
        int assigned_to_user_id FK
        text status
        timestamptz assigned_at
    }

    rptar_audit_logs {
        int id PK
        int property_id FK
        text td_number
        int tax_year
        text action_type
        text field_changed
        numeric original_value
        numeric new_value
        numeric difference
        text reason
        text assessor_name
        text station_id
        text details
        timestamptz created_at
    }

    municipal_tax_settings {
        int id PK
        numeric early_payment_discount_rate
        int early_payment_start_month
        int early_payment_end_month
        numeric regular_prompt_discount_rate
        numeric delinquent_discount_rate
        int effective_year
        text updated_by
        timestamptz updated_at
    }

    csv_import_batches {
        int id PK
        text batch_name
        text barangay
        text filename
        int total_rows
        int inserted_rows
        int updated_rows
        int unchanged_rows
        text imported_by
        timestamptz created_at
    }
```

### 3.1 Strict Field Mapping & Conventions

| Entity | PostgreSQL Column (`snake_case`) | TypeScript Property (`camelCase`) | Type | Nullable | Notes |
|---|---|---|---|---|---|
| **Property** | `id` | `id` | `string` / `number` | No | Primary Key |
| | `td_number` | `tdNumber` | `string` | No | Unique Tax Declaration No. |
| | `previous_td_number` | `previousTdNumber` | `string` | Yes | Prior cancelled TD |
| | `pin` | `pin` | `string` | Yes | Property Identification No. |
| | `owner_name` | `ownerName` | `string` | No | Declared Owner |
| | `address` | `address` | `string` | No | Property location |
| | `barangay` | `barangay` | `string` | No | One of 33 Santa Rosa barangays |
| | `property_class` | `propertyClass` | `string` | No | Residential, Agricultural, etc. |
| | `lot_area_sqm` | `lotAreaSqm` | `number` | Yes | Area in square meters |
| | `market_value` | `marketValue` | `number` | No | Total Market Value (PHP) |
| | `assessed_value` | `assessedValue` | `number` | No | Total Taxable Assessed Value |
| | `last_paid_year` | `lastPaidYear` | `number` | No | Default `2025` |
| | `is_shell_record` | `isShellRecord` | `boolean` | No | Default `false` |
| **Receipt Snapshot** | `receipt_no` | `receiptNo` | `string` | No | AF-51 Sequential No. |
| | `property_id` | `propertyId` | `number` | No | Foreign Key $\rightarrow$ `properties.id` |
| | `paid_records` | `itemizedRecords` | `TaxYearRecord[]` | No | JSONB snapshot of settled dues |
| | `basic_tax` | `basicTax` | `number` | No | Applied Basic Tax snapshot |
| | `sef_tax` | `sefTax` | `number` | No | Applied SEF Tax snapshot |
| | `discount_rate` | `discountRate` | `number` | No | Applied Discount % snapshot |
| | `discount_amount` | `discountAmount` | `number` | No | Applied Discount PHP snapshot |
| | `penalty_amount` | `penaltyAmount` | `number` | No | Applied Penalty PHP snapshot |
| | `total_paid` | `totalPaid` | `number` | No | Net Amount Due snapshot |
| | `tender_type` | `tenderType` | `'CASH' \| 'CHECK' \| 'ONLINE'` | No | Tender classification |
| | `tender_reference`| `tenderReference` | `string` | Yes | Check No. / Transaction ID |
| | `status` | `status` | `'ISSUED' \| 'VOIDED'` | No | Default `'ISSUED'` |
| | `posted_by` | `postedBy` | `string` | No | Teller name / username |
| | `posted_at` | `date` | `string` (ISO 8601) | No | Timestamp of issuance |

### 3.2 Assessor Import Center & Smart Barangay Upsert Specification
The system supports continuous ingestion of property rolls categorized across Santa Rosa's 33 barangays:
1. **Unique Identification**: `td_number` is the definitive master key.
2. **Smart Upsert (Last-Write-Wins per TD)**:
   - If incoming row matches an existing `td_number` in the database, update property details (owner, address, classification, valuations) with newer data.
   - If incoming row does not exist, insert it as a new property.
   - Preserves unmentioned properties in that barangay.
3. **Financial History Protection (INVARIANT)**:
   - Bulk CSV imports must **never** overwrite or reset financial transaction records or payment milestones (`last_paid_year`, `payment_postings`). Tax liability and settlement status remain strictly under treasury cashier jurisdiction.
4. **Staging Workflow**:
   $$\text{Upload} \longrightarrow \text{Validate} \longrightarrow \text{Stage} \longrightarrow \text{Review/Diff} \longrightarrow \text{Authorize} \longrightarrow \text{Atomic Upsert} \longrightarrow \text{Audit Log} \longrightarrow \text{Batch History}$$
5. **Row Validation States**:
   - `VALID_NEW`: Completely new parcel ready for insertion.
   - `VALID_UPDATE`: Existing parcel with modified data ready for update.
   - `UNCHANGED`: Identical record; skipped to ensure idempotency.
   - `DUPLICATE_IN_FILE`: Repeated TD within the same CSV upload.
   - `INVALID_TD`: Missing or malformed Tax Declaration Number.
   - `INVALID_BARANGAY`: Barangay not in canonical list of 33 Santa Rosa barangays.
   - `INVALID_PROPERTY_CLASS`: Class not in canonical SFMV classes.
   - `INVALID_NUMERIC_VALUE`: Negative, NaN, or corrupted market/assessed value.
   - `CONFLICTING_RECORD`: Parcel exhibits conflicting ownership or boundary constraints.
6. **Idempotency**: Re-uploading an identical CSV produces zero spurious updates or duplicate audit noise.
| | `previous_td_number` | `previousTdNumber` | `string` | Yes | Prior cancelled TD |
| | `pin` | `pin` | `string` | Yes | Property Identification No. |
| | `owner_name` | `ownerName` | `string` | No | Declared Owner |
| | `address` | `address` | `string` | No | Property location |
| | `barangay` | `barangay` | `string` | No | One of 33 Santa Rosa barangays |
| | `property_class` | `propertyClass` | `string` | No | Residential, Agricultural, etc. |
| | `lot_area_sqm` | `lotAreaSqm` | `number` | Yes | Area in square meters |
| | `market_value` | `marketValue` | `number` | No | Total Market Value (PHP) |
| | `assessed_value` | `assessedValue` | `number` | No | Total Taxable Assessed Value |
| | `last_paid_year` | `lastPaidYear` | `number` | No | Default `2025` |
| | `is_shell_record` | `isShellRecord` | `boolean` | No | Default `false` |
| **Receipt** | `receipt_no` | `receiptNo` | `string` | No | AF-51 Sequential No. |
| | `property_id` | `propertyId` | `number` | No | Foreign Key $\rightarrow$ `properties.id` |
| | `paid_records` | `itemizedRecords` | `TaxYearRecord[]` | No | JSONB array of settled years |
| | `total_paid` | `totalPaid` | `number` | No | Grand total in PHP |
| | `tender_type` | `tenderType` | `'CASH' \| 'CHECK' \| 'ONLINE'` | No | Tender classification |
| | `tender_reference`| `tenderReference` | `string` | Yes | Check No. / Transaction ID |
| | `status` | `status` | `'ISSUED' \| 'VOIDED'` | No | Default `'ISSUED'` |
| | `posted_by` | `postedBy` | `string` | No | Teller name / username |
| | `posted_at` | `date` | `string` (ISO 8601) | No | Timestamp of issuance |

---

## 4. Financial Controls & Accountable Forms (AF-51)

Philippine Local Government Code and Commission on Audit (COA) Circulars mandate strict inventory controls over accountable forms.

### 4.1 Accountable Form 51 (AF-51) Official Receipt Rules
1. **Serial Continuity**: Receipt numbers **must** follow an unbroken sequential series. Random number generation (`Math.random()`) is strictly prohibited in production.
2. **Booklet Stub Custody**:
   - Each physical booklet contains 50 triplicate receipts (Original: Taxpayer, Duplicate: Accounting, Triplicate: Treasury stub).
   - Booklets are assigned to bonded tellers by Booklet Number and Serial Range (e.g. `Series: 4500001 - 4500050`).
3. **Atomic Serial Increment**:
   - The system locks the current booklet record (`SELECT ... FOR UPDATE`) to increment the serial counter during payment generation, preventing race conditions across parallel counters.

### 4.2 Official Receipt Cancellation & Voiding Protocol
1. **Zero Deletion Rule**: Issued receipts are **never** deleted from the database.
2. **Supervisory Dual-Custody**:
   - A teller cannot void their own receipt unilaterally. Voiding requires an `Admin` or `Treasury Supervisor` counter-authorization.
3. **Ledger Rollback**:
   - Voiding an OR resets the associated property's `last_paid_year` to its pre-payment state.
   - The receipt record status changes to `'VOIDED'` with timestamp, cancellation reason code, and authorizing officer username.

### 4.3 Payment Snapshot & Financial Immutability
When an Official Receipt (AF-51) is posted:
1. **Permanent Snapshot**: The transaction locks in the final applied `basic_tax`, `sef_tax`, `discount_rate`, `discount_amount`, `penalty_amount`, and `total_paid` (`netAmountDue`).
2. **Strict Immutability**: Later modifications to municipal tax settings, Schedule of Market Values, or individual property assessments must **never** retroactively recalculate or modify already-posted payment records. Historical receipts reflect the exact statutory and authorized financial values at the moment of issuance.

---

## 5. Security Architecture & Role-Based Access Control (RBAC)

### 5.1 Role Hierarchy & Permissions Matrix

> [!WARNING]
> **RBAC Conflict Notice Requiring Municipal Confirmation**:
> The matrix below designates **Bulk Import Assessment Data (CSV)** as strictly `Admin` only. However, existing operational documentation (e.g. `README.md`) permits `Assessor` desks to ingest barangay rolls. 
> **Action Required**: This conflict must be formally resolved and confirmed with the Municipal Treasurer / Assessor before production locking.

| Capability / Resource | Admin | Assessor | Cashier (Teller) | Viewer (Mayor / Exec) |
|---|:---:|:---:|:---:|:---:|
| **View Dashboard & Collection KPIs** | ✅ | ✅ | ✅ | ✅ (Read-Only) |
| **Search & View Property Records** | ✅ | ✅ | ✅ | ✅ |
| **Calculate Dues & Tax Assessment** | ✅ | ✅ | ✅ | ✅ |
| **Create / Update Property Masterlist** | ✅ | ✅ | ❌ | ❌ |
| **Verify / Promote Shell Records** | ✅ | ✅ | ❌ | ❌ |
| **Bulk Import Assessment Data (CSV)** | ✅ | ⚠️ *Conflict* | ❌ | ❌ |
| **Issue AF-51 Official Receipts** | ✅ | ✅ | ✅ | ❌ |
| **Void / Cancel Official Receipts** | ✅ (Authorized) | ❌ | ❌ | ❌ |
| **Manage Users & Stations** | ✅ | ❌ | ❌ | ❌ |
| **Assign Accountable Form Booklets** | ✅ | ❌ | ❌ | ❌ |
| **Configure Municipal Tax Settings** | ✅ | ❌ | ❌ | ❌ |
| **View Audit Logs** | ✅ | ✅ (Read) | ❌ | ❌ |

### 5.2 Password & Authentication Policy
- **Storage**: Passwords must be hashed using `Bcrypt` (minimum work factor 12) or `Argon2id`. No plaintext passwords may exist in database columns or REST payloads.
- **Sessions**: JWT tokens with 8-hour maximum lifetime; automatic UI inactivity lock after 15 minutes of idle time.
- **Database Enforcement**: Row-Level Security (RLS) enabled on all PostgreSQL tables using verified JWT claims (`auth.uid()` and `auth.jwt() ->> 'role'`).

---

## 6. Architecture & Technology Stack Baseline

### 6.1 Frontend Stack
- **Framework**: React 18 with TypeScript (`strict: true`).
- **Build Tool**: Vite (`vite.config.ts`).
- **Styling**: Tailwind CSS v3 compiled locally via PostCSS (`postcss.config.js`, `tailwind.config.js`). Zero external CDN dependencies.
- **UI Primitives**: Accessible headless primitives (`components/ui/`) styled to Santa Rosa Treasury design tokens:
  - Deep Emerald Green (`#059669` / `#065f46`) reflecting agricultural prosperity and public service trust.
  - Slate gray neutrals (`#0f172a` to `#f8fafc`) for crisp, high-contrast data presentation.
- **Data Visualization**: Recharts (`ResponsiveContainer`, `BarChart`, `AreaChart`).
- **Testing**: Vitest (`taxLogic.test.ts` for RA 7160 statutory verification).
- **Linting**: ESLint v9 Flat Config (`eslint.config.js`).

### 6.2 Data Layer & Repository Contract (`ITreasuryRepository`)
All UI components interact exclusively with the repository contract, decoupling the interface from storage drivers:

```typescript
export interface ITreasuryRepository {
  // Properties & Assessment
  getProperties(params: { search?: string; barangay?: string; page?: number; limit?: number }): Promise<Property[]>;
  getPropertyAssessment(propertyId: string | number): Promise<CalculationResult>;
  saveProperty(data: Partial<Property>): Promise<Property>;
  
  // Collections & Receipts
  processPayment(payload: ProcessPaymentPayload): Promise<OfficialReceipt>;
  voidReceipt(receiptNo: string, reason: string, authorizedBy: string): Promise<void>;
  
  // Accountable Forms
  getActiveBooklet(userId: string | number): Promise<AccountableFormBooklet | null>;
  
  // Reporting & Audit
  getDashboardStats(): Promise<DashboardStatsData>;
  getAuditLogs(filters?: AuditLogFilters): Promise<RptarAuditLog[]>;
  
  // Auth
  login(credentials: LoginCredentials): Promise<AuthSession>;
  lookupUser(username: string): Promise<User | null>;
}
```

### 6.3 Tax Assessment UI & Authorized Override Layout Specification
The Tax Assessment modal and teller interface must distinctly display system-calculated defaults alongside authorized editable inputs:

```text
+--------------------------------------------------------------+
| Tax Assessment & Settlement (Tax Year: 2026)                 |
+--------------------------------------------------------------+
| Basic Tax (1%)                                               |
| [ ₱1,000.00                                            ✎ ]  |
| System calculated: ₱1,000.00                                  |
|                                                              |
| Special Education Fund (SEF 1%)                              |
| [ ₱1,000.00                                            ✎ ]  |
| System calculated: ₱1,000.00                                  |
|                                                              |
| Discount Rate                                                |
| [ 20.00 %                                              ✎ ]  |
| System default: 20.00% (Jan 1 - Mar 31 Early Payment Policy) |
|                                                              |
| ------------------------------------------------------------ |
| Discount Amount (Calculated):                      ₱400.00   |
| Delinquency Penalty:                                 ₱0.00   |
| ------------------------------------------------------------ |
| NET AMOUNT DUE:                                  ₱1,600.00   |
+--------------------------------------------------------------+
```
- Visual indicators (e.g. amber tag or icon) appear whenever a field differs from its system default.
- Any manual override requires an accompanying reason before payment posting or clearance slip generation.

---

## 7. Santa Rosa Geographical & Administrative Constants

### 7.1 Santa Rosa Barangays (33 Canonical Barangays)
The 33 official barangays of Santa Rosa, Nueva Ecija defined in [`constants.ts`](file:///home/jeipyyy/Documents/Projects/LGU-Treasury-Connect/lgu-treasury-connect/constants.ts):
1. `Aguinaldo`
2. `Berang`
3. `Burgos`
4. `Cojuangco (Poblacion)`
5. `Del Pilar`
6. `Gomez`
7. `Inspector`
8. `Isla`
9. `La Fuente`
10. `Liwayway`
11. `Lourdes`
12. `Luna`
13. `Mabini`
14. `Malacañang`
15. `Maliolio`
16. `Mapalad`
17. `Rajal Centro`
18. `Rajal Norte`
19. `Rajal Sur`
20. `Rizal (Poblacion)`
21. `San Gregorio`
22. `San Isidro`
23. `San Joseph`
24. `San Mariano`
25. `San Pedro`
26. `Santa Teresita`
27. `Santo Rosario`
28. `Sapsap`
29. `Soledad`
30. `Tagpos`
31. `Tramo`
32. `Valenzuela (Poblacion)`
33. `Zamora (Poblacion)`

### 7.2 Municipal Treasury Administration & Canonical Signatories
The canonical administrative officers and signatories for the Municipality of Santa Rosa, Nueva Ecija Treasury:
- **Municipal Treasurer**: `Myra V. Cunanan`
- **Collecting Officers**: `Revenue Collection Clerk` (authorized tellers and collection officers)
- **Official Designation**: `Office of the Treasurer, Municipality of Santa Rosa, Province of Nueva Ecija`

---

## 8. Alignment with Roadmap Phases

Every feature branch defined in [`ROADMAP_AND_PHASES.md`](file:///home/jeipyyy/Documents/Projects/LGU-Treasury-Connect/lgu-treasury-connect/docs/ROADMAP_AND_PHASES.md) implements a specific section of this SSOT:

| Roadmap Phase | SSOT Governing Section |
|---|---|
| **Phase 0: Baseline Finalization** | Section 6 (UI Primitives, Standards, Zero Debt) |
| **Phase 1: Security & Auth Hardening** | Section 5 (RBAC Matrix, Password Hashing, RLS Policies) |
| **Phase 2: Transaction Atomicity & COA** | Section 4 (Atomic RPC, AF-51 Booklet Register, Void Protocol) |
| **Phase 3: Data Layer Optimization** | Section 6.2 (TanStack Query, Realtime WebSockets) |
| **Phase 4: Deployment Abstraction** | Section 6.2 (`ITreasuryRepository`, Cloud vs On-Premise) |
| **Phase 5: Offline Tellering** | Section 4.1 & 6.2 (Offline booklet allocation, Dexie queue) |
| **Phase 6: Statutory Reporting** | Section 2 & 4 (BLGF Form 3, Delinquency Notices, RPTAR Ledgers) |

---

## 9. Governance & Non-Regression Policy
1. **Rule of Immutability**: No tax calculation formula in `utils/taxLogic.ts` may be modified without updating statutory tests in `utils/taxLogic.test.ts` and documenting legal justification under RA 7160.
2. **Schema Migration Pre-requisite**: All schema modifications require versioned SQL migration scripts in `supabase/migrations/` and explicit change budgets per `.agents/rules/task_standards.md`.
3. **No Self-Certification**: Final architectural and security approvals belong strictly to the human reviewer and municipal lead.
