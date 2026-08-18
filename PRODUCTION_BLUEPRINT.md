# LGU Treasury Connect — System Architecture & Developer Blueprint

> **Design Note:** Built for the **Municipality of Santa Rosa, Province of Nueva Ecija**. Features **33 Local Barangays** (with *Rizal (Poblacion)* as #1), **5 Property Classifications** in alphabetical order within the RPT encoding modal (**Agricultural**, **Dwell House**, **Industrial**, **Machinery**, **Residential**), **Bulk CSV/Excel Masterlist Import & Export**, **Active Directory-Style Logon**, **Sequential Arrears-First Dues Clearance**, **RPTAR Audit Trail**, and an **Excel-Style Printable Clearance Slip**.

---

## 1. System Architecture Overview

```
+-------------------------------------------------------------------------------+
|               ACTIVE DIRECTORY-STYLE SIGN-IN GATE (Clean White Page)         |
|   • Step 1: Staff Username Entry → Domain / Station Badge Detection           |
|   • Step 2: Password Authentication (bcrypt + JWT)                            |
+-------------------------------------------------------------------------------+
                                       │
                                       ▼ Role-Based Routing
+-------------------------------------------------------------------------------+
|                       DASHBOARDS BY USER ROLE (RBAC)                          |
|                                                                               |
|  [ Assessor Dashboard ]  • Santa Rosa RPTAR Masterlist (33 Barangays)         |
|                          • RPT Encoding Modal: 5 Classifications (A-Z)        |
|                          • Bulk CSV/Excel Importer & Exporter (.xlsx / .csv)  |
|                          • Sequential Dues Clearance (1 Qtr / 1 Year / All)   |
|                          • Excel-Style Printable Clearance Slip (AF-51 Grid)  |
|                                                                               |
|  [ Admin Dashboard ]     • Full Masterlist CRUD • Staff Directory Management  |
|                          • [ 💾 Database Backup Dump ] [ Bulk Data Migration ]|
|                          • Complete System-Wide Audit Log Inspector           |
|                                                                               |
|  [ Viewer Dashboard ]    • Read-Only Revenue Analytics & Property Search      |
+-------------------------------------------------------------------------------+
                                       │  REST API Calls
                                       ▼
+-------------------------------------------------------------------------------+
|                           BACKEND (Node.js + Express)                         |
|   • /api/auth       (Login, Register, Delete User, Reset Password)            |
|   • /api/admin      (Database Backup Export / SQLite Dump Stream)             |
|   • /api/properties (Paginated Masterlist, Search, CRUD, Bulk CSV/Excel)     |
|   • /api/audit      (RPTAR Revision History & Dues Clearance Audit Logs)      |
|   • /api/clearance  (Sequential Quarter Clearance & Auto-Audit Logging)       |
|   • /api/sync       (SSE Stream / Polling Trigger for Multi-Assessor Updates) |
|   • /api/dashboard  (KPI Statistics & Revenue Trends)                         |
+-------------------------------------------------------------------------------+
                                       │  SQL Queries
                                       ▼
+-------------------------------------------------------------------------------+
|                               DATABASE (SQLite)                               |
|   • users (id, username, password, full_name, role, station_id)               |
|   • properties (td_number, pin, owner_name, address, barangay, property_class)|
|   • quarterly_payment_status (tax_year, quarter, status, cleared_by, cleared_at)|
|   • rptar_audit_logs (property_id, action, assessor_name, station_id, details)|
+-------------------------------------------------------------------------------+
```

---

## 2. Core Master Data: Santa Rosa, Nueva Ecija

### A. The 33 Barangays of Santa Rosa, Nueva Ecija (Ordered)
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

### B. RPT Encoding Modal: Property Classifications (Alphabetical Order)
Inside the **"Encode New Real Property (RPTAR)"** and **"Update Property Record"** modal, the Assessor selects from the following 5 classifications:

1. **`Agricultural`** *(Farmlands, Rice Fields, Plantations, Orchards)*
2. **`Dwell House`** *(Single-Family Homes, Residential Buildings & Structures)*
3. **`Industrial`** *(Warehouses, Manufacturing Plants, Processing Mills)*
4. **`Machinery`** *(Heavy Equipment, Agricultural & Industrial Machineries)*
5. **`Residential`** *(Residential Land Lots, Subdivisions)*

---

### C. RPT Encoding & Appraisal Workflow
When creating/encoding an RPT record:
1. **Tax Declaration (TD) No.** & **Cadastral PIN**
2. **Declared Property Owner** & **Street Address**
3. **Barangay Dropdown**: 33 Santa Rosa barangays (*Rizal (Poblacion)* at top)
4. **Classification Dropdown**: 5 alphabetical classes (*Agricultural*, *Dwell House*, *Industrial*, *Machinery*, *Residential*)
5. **Lot Area (sq.m)**
6. **Direct Valuation Inputs**: Direct Market Value and Assessed Value
7. **Last Paid Year**: Sets historical baseline year
8. **Automatic Audit Trail & Live Broadcast**: Logs author name & station ID to `rptar_audit_logs` and syncs across all counter screens.

---

### D. Bulk CSV / Excel Masterlist Import & Export Engine
- Validates rows against the **33 Santa Rosa Barangays** and **5 Classifications**.
- Automatically synthesizes 24 quarterly records (`2021 Q1` to `2026 Q4`) per imported property based on `Last_Paid_Year`.
