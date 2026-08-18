# LGU Treasury Connect — Step-by-Step Implementation Guide

A practical, step-by-step development roadmap for **LGU Treasury Connect (Municipality of Santa Rosa, Nueva Ecija)**.

---

## 🗺️ High-Level Milestones

```mermaid
flowchart LR
    M1[Step 1: Santa Rosa DB & 33 Barangays] --> M2[Step 2: RA 7160 Tax Engine API]
    M2 --> M3[Step 3: AD-Style Sign-In & Auth]
    M3 --> M4[Step 4: RPT Encoding Modal & Classifications]
    M4 --> M5[Step 5: Sequential Clearance & Dues Audit]
    M5 --> M6[Step 6: Bulk CSV/Excel Importer & Exporter]
```

---

## 🛠️ Step 1: Santa Rosa Database & Master Data Setup
- SQLite database (`treasury.db`) configured with:
  - **33 Official Barangays** (*Rizal (Poblacion)* as #1, followed by 32 alphabetical barangays).
  - **5 Property Classifications** in alphabetical order:
    1. `Agricultural`
    2. `Dwell House`
    3. `Industrial`
    4. `Machinery`
    5. `Residential`
  - Tables: `users`, `properties`, `quarterly_payment_status`, `rptar_audit_logs`.

---

## 🧮 Step 2: RA 7160 Tax Engine API
- Computes quarterly base taxes, 2%/month penalties (max 72%), and prompt discounts under RA 7160.

---

## 🔐 Step 3: Active Directory-Style Sign-In & Auth
- 2-Step logon flow: Username identification displaying verified staff name and station badge, followed by password authentication.

---

## 📝 Step 4: RPT Creation & Property Encoding Modal (`RptarModal.tsx`)

### Tasks:
1. **Dropdown Selectors**:
   - **Barangay Select**: Displays Santa Rosa's 33 barangays with `Rizal (Poblacion)` listed first.
   - **Classification Select**: Displays the 5 statutory property types in alphabetical order (`Agricultural`, `Dwell House`, `Industrial`, `Machinery`, `Residential`).
2. **Direct Valuation Inputs**:
   - Market Value and Assessed Value input fields.
3. **Audit Trail Logging**:
   - Automatically stamps the creating/editing Assessor's name and station ID.

---

## 🧾 Step 5: Sequential Clearance & Dues Audit Logging
- Sequential clearance selector (**`[ Pay Next 1 Quarter ]`**, **`[ Pay 1 Full Year ]`**, **`[ Pay All Dues ]`**).
- Automatic audit logging for every dues clearance transaction in `rptar_audit_logs`.
- Excel/Spreadsheet-Style Printable Clearance Slip with 1px solid cell gridlines and double-underlines.

---

## 📥 Step 6: Bulk CSV / Excel Masterlist Importer & Exporter
- Batch import for `.csv` and `.xlsx` files with duplicate TD validation.
- Auto-synthesis of 24 quarterly records (`2021 Q1` to `2026 Q4`) per imported property.
- Export masterlist to `.xlsx` for COA audit compliance.
