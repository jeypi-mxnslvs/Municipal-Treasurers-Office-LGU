# LGU Treasury Connect — Complete System Overview & Knowledge Base

---

## 1. Project Overview & Architecture

### What is LGU Treasury Connect?
**LGU Treasury Connect** is an enterprise Real Property Tax Administration and Revenue (**RPTAR**) application designed for the **Municipality of Santa Rosa, Province of Nueva Ecija**.

### Key Master Data & Workflows:
1. **Santa Rosa Master Data**: Pre-configured with **33 Local Barangays** and **5 Property Classifications**.
2. **RPT Creation & Encoding Modal**: Provides dropdowns for the 33 Santa Rosa barangays (starting with *Rizal (Poblacion)*) and the 5 classifications in alphabetical order (*Agricultural*, *Dwell House*, *Industrial*, *Machinery*, *Residential*).
3. **Bulk CSV / Excel Masterlist Migration**: Batch importer and exporter for legacy municipal spreadsheets with automated quarter synthesis (2021–2026).
4. **Active Directory-Style Sign-In Gate**: Clean 2-step logon interface with staff identity confirmation.
5. **Unified Assessor Role**: Merges property appraisal and compliance clearance into one role.
6. **Sequential Dues Clearance**: Clear dues sequentially (1 quarter, 1 year, or full settlement) under **RA 7160 Arrears-First rule**.
7. **Comprehensive RPTAR & Dues Clearance Audit Trail**: Unified chronological logging of both property appraisal edits and tax dues clearances.
8. **Live Multi-Assessor Dashboard Sync**: Real-time cross-counter synchronization when properties are saved or dues are cleared.
9. **Excel/Sheet-Style Printable Clearance Slip**: Official spreadsheet-grid tax clearance document formatted like municipal Excel ledgers.

---

## 2. Municipal Master Data: Santa Rosa, Nueva Ecija

### A. The 33 Official Barangays (Ordered)
1. **Rizal (Poblacion)** *(#1 Urban Core)*
2. **Aguinaldo**
3. **Berang**
4. **Burgos**
5. **Cojuangco (Poblacion)**
6. **Del Pilar**
7. **Gomez**
8. **Inspector**
9. **Isla**
10. **La Fuente**
11. **Liwayway**
12. **Lourdes**
13. **Luna**
14. **Mabini**
15. **Malacañang**
16. **Maliolio**
17. **Mapalad**
18. **Rajal Centro**
19. **Rajal Norte**
20. **Rajal Sur**
21. **San Gregorio**
22. **San Isidro**
23. **San Joseph**
24. **San Mariano**
25. **San Pedro**
26. **Santa Teresita**
27. **Santo Rosario**
28. **Sapsap**
29. **Soledad**
30. **Tagpos**
31. **Tramo**
32. **Valenzuela (Poblacion)**
33. **Zamora (Poblacion)**

---

### B. Property Classifications inside the RPT Encoding Modal (Alphabetical Order)
Inside the property creation/appraisal modal, the Assessor selects from:

1. **`Agricultural`** *(Farmlands, Rice Fields, Plantations, Orchards)*
2. **`Dwell House`** *(Single-Family Homes, Residential Buildings & Structures)*
3. **`Industrial`** *(Warehouses, Manufacturing Plants, Processing Mills)*
4. **`Machinery`** *(Heavy Equipment, Agricultural & Industrial Machineries)*
5. **`Residential`** *(Residential Land Lots, Subdivisions)*

---

## 3. Bulk CSV / Excel Masterlist Engine Specifications

### A. Standard Import Columns
- `TD_Number`, `Previous_TD`, `PIN`, `Owner_Name`, `Address`, `Barangay`, `Property_Class`, `Lot_Area_Sqm`, `Market_Value`, `Assessed_Value`, `Last_Paid_Year`

### B. Validation & Sanitation
- Checks for duplicate TD numbers.
- Matches against the 33 Santa Rosa barangays and the 5 classifications.
- Automatically flags missing valuations as `is_shell_record = 1`.

### C. Automated Relational Quarter Synthesis
- For every imported property, creates **24 quarterly records** (`2021 Q1` to `2026 Q4`):
  - Quarters $\le \text{Last\_Paid\_Year} \rightarrow \text{'CLEARED'}$
  - Quarters $> \text{Last\_Paid\_Year} \rightarrow \text{'DELINQUENT'}$

---

## 4. Sequential Dues Clearance Rules (RA 7160 Section 255)

The application implements the Philippine Local Government Code's **Arrears-First Rule**:

### How It Works:
If a property is delinquent from **2024 Q1 to 2026 Q4** (12 quarters):
- **Quarterly Sequential Order**: Must be cleared chronologically:
  1. `2024 Q1` $\rightarrow$ 2. `2024 Q2` $\rightarrow$ 3. `2024 Q3` $\rightarrow$ 4. `2024 Q4` $\rightarrow$ 5. `2025 Q1` ...
- **Allowed Payment Scopes**:
  - **Single Quarter**: Clear only `2024 Q1`. The subtotal updates to show only `2024 Q1`'s base tax and penalty.
  - **Single Year**: Clear `2024 Q1 to Q4`. The subtotal calculates the 4 quarters of 2024.
  - **Full Settlement**: Clear all 12 quarters up to `2026 Q4`.
- **Enforcement**: A taxpayer cannot clear `2025` or `2026` if `2024` remains unpaid.
