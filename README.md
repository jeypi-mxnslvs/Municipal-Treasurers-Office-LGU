# 🏛️ Municipal Treasurer's Office — LGU Treasury Connect

> An enterprise Real Property Tax Administration Roll (RPTAR) and revenue collection management platform designed for Philippine Local Government Units (LGUs).

[![Vercel Deployment](https://img.shields.io/badge/Deployed_on-Vercel-black?style=flat&logo=vercel)](https://vercel.com)
[![Database](https://img.shields.io/badge/Database-Supabase_PostgreSQL-3ECF8E?style=flat&logo=supabase)](https://supabase.com)
[![Framework](https://img.shields.io/badge/Framework-React_19_|_Vite-61DAFB?style=flat&logo=react)](https://react.dev)
[![Language](https://img.shields.io/badge/Language-TypeScript-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)

---

## 📌 Overview

**LGU Treasury Connect** streamlines the administration, appraisal, computation, and collection of Real Property Taxes (RPT) in compliance with the **Philippine Local Government Code (RA 7160)**. 

The system replaces manual tax ledgers with an automated, synchronized, and audit-traceable digital workflow across assessor desks and treasury counters.

---

## ✨ Key Features

### 1. 📋 RPTAR Masterlist Management
- **Centralized Ledger:** Real Property Tax Assessment Roll (RPTAR) records tracking Tax Declaration (TD) numbers, previous TD references, PINs, and property classifications.
- **Search & Barangay Filters:** Instant searching by owner name, TD number, or barangay jurisdiction.
- **Bulk CSV / Excel Import:** Fast ingestion of legacy property records with automated "shell record" detection.

### 2. 🧮 Automated Tax Calculation Engine
- **Local Government Code Compliant:** Computes Basic Real Property Tax (1%) and Special Education Fund (SEF 1%) against assessed values.
- **Penalty Compounding:** Automatic monthly delay computation (2% per month penalty capped at 36 months / 72%).
- **Sequential Dues Validation:** Enforces strict sequential clearing of delinquent years before processing advance payments.

### 3. 🧾 Official Receipt (Accountable Form No. 51 / AF-51)
- **Payment Posting:** Record cash, check, and digital tender payments with custom references.
- **AF-51 Issuance:** Generates printable, itemized Official Receipts displaying basic tax, SEF, penalty breakdowns, and authorized officer signatures.

### 4. 📊 Executive Analytics & KPI Dashboard
- **Collection Efficiency:** Real-time collection metrics against annual municipal revenue targets.
- **Delinquency Analysis:** Visual breakdown of outstanding debts categorized by barangay and property class.
- **Revenue Trends:** Monthly collection trends powered by interactive data charts.

### 5. 🛡️ Station Attribution & Audit Trail
- **Action Logging:** Immutable logs tracking every property creation, assessment adjustment, and payment clearance.
- **Station-Level Traceability:** Identifies which assessor or station processed each transaction.

---

## 👥 Role-Based Access Control (RBAC)

| Role | Default User | Station | Capabilities |
| :--- | :--- | :--- | :--- |
| 🧑‍💼 **Assessor** | `juan.assessor` | `Assessor-Desk-02` | RPTAR management, property appraisal, tax calculations, CSV import, and payment/clearance posting. |
| 🔑 **Admin** | `admin` | `Main-HQ` | Full system control, masterlist CRUD, user staff management (create/delete/reset passwords), and database backup. |
| 👁️ **Viewer** | `mayor.office` | `Executive-Desk` | Read-only executive access to municipal KPIs, delinquency statistics, and revenue analytics. |

> *Default test password for all demo accounts: `admin123`*

---

## 🛠️ Tech Stack

- **Frontend:** React 19, TypeScript, Vite
- **Styling & UI:** Tailwind CSS, Lucide React Icons
- **Data Visualization:** Recharts
- **Database & Backend:** Supabase (PostgreSQL with PostgREST)
- **Hosting & CI/CD:** Vercel (Auto-deploy on GitHub push)

---

## 🚀 Getting Started Locally

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Git](https://git-scm.com/)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/jeypi-mxnslvs/Municipal-Treasurers-Office-LGU.git
   cd Municipal-Treasurers-Office-LGU
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env.local` file in the root directory:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🗄️ Database Setup (Supabase)

To initialize the database schema in Supabase:
1. Open the **SQL Editor** in your Supabase project.
2. Run the SQL table definitions found in [`schema.sql`](./schema.sql).
3. Ensure table permissions are granted to the `anon` role.
