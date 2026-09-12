# ARCHITECTURE DIAGRAMS — LGU Treasury Connect

> Generated from code-level analysis, 2026-09-01

---

## 1. Overall System Architecture

```mermaid
graph TD
    User["👤 End User<br/>(Assessor / Admin / Viewer)"]
    
    subgraph Browser ["Browser (React SPA)"]
        App["App.tsx<br/>State Orchestrator<br/>15+ useState hooks"]
        Components["14 UI Components<br/>(Modals, Tables, Cards)"]
        TaxEngine["utils/taxLogic.ts<br/>RA 7160 Tax Engine<br/>(Pure function, runs client-side)"]
        ApiClient["services/api.ts<br/>16 Supabase methods"]
        SupaClient["services/supabase.ts<br/>createClient(url, anonKey)"]
    end
    
    subgraph SupabaseCloud ["Supabase Cloud (mmppbaimgdslhbwietbi)"]
        PostgREST["PostgREST API"]
        Postgres["PostgreSQL 15<br/>5 tables<br/>⚠️ RLS DISABLED"]
    end
    
    subgraph DeadCode ["⚠️ INACTIVE — Not Connected"]
        Express["Express 4.21.2<br/>Port 5000<br/>7 route modules"]
        SQLite["SQLite3<br/>treasury.db<br/>6 tables"]
    end
    
    User --> App
    App --> Components
    App --> TaxEngine
    Components --> ApiClient
    App --> ApiClient
    ApiClient --> SupaClient
    SupaClient -->|"HTTPS + Anonymous Key"| PostgREST
    PostgREST --> Postgres
    
    Express -.->|"Disconnected"| SQLite

    style DeadCode fill:#fff3cd,stroke:#ffc107,stroke-width:2px,stroke-dasharray:5
    style Postgres fill:#fee2e2,stroke:#ef4444,stroke-width:2px
```

---

## 2. Frontend Component Tree

```mermaid
graph TD
    Index["index.tsx<br/>ReactDOM.createRoot"]
    App["App.tsx<br/>(God Object)"]
    
    subgraph AuthGate ["Authentication Gate"]
        LoginPage["LoginPage.tsx<br/>2-step login + presets"]
    end
    
    subgraph DashView ["view === 'dashboard'"]
        Stats["DashboardStats.tsx<br/>4 KPI cards + Recharts chart"]
        Table["DashboardTable.tsx<br/>Paginated masterlist<br/>Search + Filter + RBAC"]
    end
    
    subgraph PostView ["view === 'posting'"]
        PropCard["PropertyCard.tsx<br/>Property summary"]
        DelinqTable["DelinquencyTable.tsx<br/>Statement of Account<br/>Sequential selection"]
    end
    
    subgraph Modals ["Overlay Modals"]
        RptarMod["RptarModal.tsx<br/>Add/Edit property"]
        ReceiptMod["OfficialReceiptModal.tsx<br/>AF-51 receipt"]
        UserMgmt["UserManagementModal.tsx<br/>Admin staff CRUD"]
        AuditMod["AuditLogModal.tsx<br/>Revision timeline"]
        BulkMod["BulkImportModal.tsx<br/>CSV parser + importer"]
    end
    
    Header["Header.tsx<br/>Navbar + User badge + Logout"]
    
    Index --> App
    App -->|"!currentUser"| LoginPage
    App -->|"currentUser"| Header
    App -->|"view=dashboard"| Stats
    App -->|"view=dashboard"| Table
    App -->|"view=posting"| PropCard
    App -->|"view=posting"| DelinqTable
    App --> RptarMod
    App --> ReceiptMod
    App --> UserMgmt
    App --> AuditMod
    App --> BulkMod

    style App fill:#dbeafe,stroke:#2563eb,stroke-width:3px
    style LoginPage fill:#fef3c7,stroke:#f59e0b,stroke-width:2px
```

---

## 3. Database Entity Relationships (Supabase PostgreSQL)

```mermaid
erDiagram
    users {
        SERIAL id PK
        TEXT username UK "NOT NULL"
        TEXT password "NOT NULL, DEFAULT 'admin123' ⚠️ PLAINTEXT"
        TEXT full_name "NOT NULL"
        TEXT role "CHECK IN ('Admin','Assessor','Viewer')"
        TEXT station_id "nullable"
        TIMESTAMPTZ created_at "DEFAULT now()"
    }
    
    schedule_of_market_values {
        SERIAL id PK
        TEXT barangay "NOT NULL"
        TEXT property_class "NOT NULL"
        NUMERIC base_rate_sqm "NOT NULL"
        NUMERIC assessment_level "DEFAULT 0.20"
    }
    
    properties {
        SERIAL id PK
        TEXT td_number "UK, NOT NULL"
        TEXT previous_td_number "nullable"
        TEXT pin "nullable"
        TEXT owner_name "NOT NULL"
        TEXT address "NOT NULL"
        TEXT barangay "NOT NULL"
        TEXT property_class "DEFAULT 'Residential'"
        NUMERIC lot_area_sqm "DEFAULT 100"
        NUMERIC market_value "DEFAULT 0"
        NUMERIC assessed_value "DEFAULT 0"
        INT last_paid_year "DEFAULT 2025"
        BOOLEAN is_shell_record "DEFAULT FALSE"
        TIMESTAMPTZ created_at "DEFAULT now()"
        TIMESTAMPTZ updated_at "DEFAULT now()"
    }
    
    payment_postings {
        SERIAL id PK
        TEXT receipt_no "UK, NOT NULL"
        INT property_id "FK"
        JSONB paid_records "DEFAULT '[]'"
        NUMERIC total_paid "NOT NULL"
        TEXT tender_type "DEFAULT 'CASH'"
        TEXT tender_reference "nullable"
        TEXT posted_by "NOT NULL"
        TIMESTAMPTZ posted_at "DEFAULT now()"
    }
    
    rptar_audit_logs {
        SERIAL id PK
        INT property_id "nullable, no FK"
        TEXT td_number "nullable"
        TEXT action_type "NOT NULL"
        TEXT assessor_name "NOT NULL"
        TEXT station_id "nullable"
        TEXT details "nullable"
        TIMESTAMPTZ timestamp "DEFAULT now()"
    }

    properties ||--o{ payment_postings : "has receipts"
    properties ||--o{ rptar_audit_logs : "tracked by"
    schedule_of_market_values }|--|| properties : "rates lookup"
```

---

## 4. Authentication Flow (Current — INSECURE)

```mermaid
sequenceDiagram
    participant U as User
    participant LP as LoginPage.tsx
    participant API as services/api.ts
    participant SB as Supabase (No RLS)
    participant LS as localStorage
    
    Note over U,SB: STEP 1 — Staff Identification
    U->>LP: Enter username (or click preset)
    LP->>API: api.lookupUser(username)
    API->>SB: SELECT id, full_name, username, role, station_id<br/>FROM users WHERE username = ?
    SB-->>API: User profile (no password)
    API-->>LP: User object
    LP->>LP: Display detected staff badge
    
    Note over U,SB: STEP 2 — Password Verification (CLIENT-SIDE!)
    U->>LP: Enter password
    LP->>API: api.login(username, password)
    API->>SB: SELECT * FROM users WHERE username = ?
    SB-->>API: ⚠️ Full row INCLUDING plaintext password
    
    alt Password matches (client-side comparison)
        API->>API: Generate fake token: "supabase-token-" + user.id
        API-->>LP: {token, user}
        LP->>LS: Store lgu_token + lgu_user
        LP-->>U: Show Dashboard
    else Password mismatch
        API-->>LP: throw Error("Invalid credentials")
        LP-->>U: Show error banner
    end
    
    Note over U,SB: ALL SUBSEQUENT REQUESTS
    U->>API: Any data operation
    API->>SB: Direct PostgREST call with Anonymous Key<br/>⚠️ No token sent, no session validation
    SB-->>API: Data returned (no auth check)
```

---

## 5. Tax Assessment & Payment Flow

```mermaid
sequenceDiagram
    participant U as User (Assessor)
    participant App as App.tsx
    participant Tax as taxLogic.ts
    participant API as api.ts
    participant DB as Supabase DB
    
    Note over U,DB: ASSESSMENT PHASE
    U->>App: Click "Post Payment" on property row
    App->>API: getPropertyAssessment(id, property)
    API->>Tax: calculateTaxLiability(property)
    
    Note right of Tax: Loop: lastPaidYear+1 → 2026<br/>baseTax = assessedValue × 0.02<br/>penalty = baseTax × min(months, 36) × 0.02<br/>totalDue = baseTax + penalty
    
    Tax-->>API: {records: TaxYearRecord[], grandTotal}
    API-->>App: CalculationResult
    App-->>U: Display DelinquencyTable + PropertyCard
    
    Note over U,DB: CLEARANCE PHASE
    U->>App: Select years → Click "Mark Dues Cleared"
    App->>API: postPayment({propertyId, paidRecords, ...})
    
    API->>DB: UPDATE properties SET last_paid_year = maxYear
    API->>DB: INSERT INTO payment_postings (receipt_no, ...)
    API->>DB: INSERT INTO rptar_audit_logs (CLEARED, ...)
    
    DB-->>API: Success
    API-->>App: OfficialReceipt object
    App-->>U: Display OfficialReceiptModal (printable AF-51)
    
    Note over U,DB: BACKGROUND SYNC (every 7s)
    loop Every 7 seconds
        App->>API: getSyncStatus()
        API->>DB: SELECT * FROM rptar_audit_logs<br/>ORDER BY timestamp DESC LIMIT 1
        DB-->>API: Latest mutation record
        
        alt Timestamp changed
            API-->>App: New mutation detected
            App->>App: loadData(silent=true)
            App-->>U: Show toast notification
        end
    end
```

---

## 6. Data Flow Architecture

```mermaid
graph LR
    subgraph Input
        CSV["CSV File Upload"]
        Form["RPTAR Form Modal"]
        Login["Login Form"]
    end
    
    subgraph Validation ["Client-Side Validation"]
        CSVParse["CSV Parser<br/>(BulkImportModal)"]
        FormValid["Manual field checks<br/>(RptarModal)"]
        AuthCheck["Plaintext password<br/>comparison"]
    end
    
    subgraph Logic ["Business Logic (Browser)"]
        TaxCalc["Tax Engine<br/>(taxLogic.ts)"]
        StatCalc["Stats Aggregation<br/>(api.ts getDashboardStats)"]
        ReceiptGen["Receipt Generator<br/>(api.ts postPayment)"]
    end
    
    subgraph Storage ["Supabase PostgreSQL"]
        Props["properties"]
        Users["users"]
        Payments["payment_postings"]
        Audit["rptar_audit_logs"]
        SFMV["schedule_of_market_values"]
    end
    
    subgraph Output
        Dashboard["Dashboard KPIs"]
        SOA["Statement of Account"]
        Receipt["AF-51 Receipt"]
        Toast["Sync Toast"]
    end
    
    CSV --> CSVParse --> Props
    Form --> FormValid --> Props
    Login --> AuthCheck --> Users
    
    Props --> TaxCalc --> SOA
    Props --> StatCalc --> Dashboard
    Props --> ReceiptGen --> Payments
    ReceiptGen --> Audit
    Audit --> Toast
    Payments --> Receipt

    style AuthCheck fill:#fee2e2,stroke:#ef4444
```

---

## 7. Deployment Architecture

```mermaid
graph TD
    Dev["Developer"]
    Git["GitHub Repository<br/>jeypi-mxnslvs/Municipal-Treasurers-Office-LGU"]
    
    subgraph Vercel ["Vercel (Primary)"]
        VBuild["npm run build<br/>(vite build)"]
        VEdge["Vercel Edge Network<br/>municipal-treasurers-office-lgu.vercel.app"]
    end
    
    subgraph GHPages ["GitHub Pages (Alternative)"]
        GHBuild["npm run predeploy<br/>(vite build)"]
        GHDeploy["gh-pages -d dist"]
    end
    
    Browser["User's Browser"]
    Supabase["Supabase Cloud<br/>(mmppbaimgdslhbwietbi.supabase.co)"]
    
    Dev -->|"git push"| Git
    Git -->|"Auto-deploy"| VBuild --> VEdge
    Git -->|"Manual: npm run deploy"| GHBuild --> GHDeploy
    
    VEdge -->|"Static HTML/JS/CSS"| Browser
    GHDeploy -->|"Static HTML/JS/CSS"| Browser
    Browser -->|"HTTPS + PostgREST"| Supabase
```

---

## 8. Dependency Graph

```mermaid
graph TD
    subgraph External ["External Dependencies"]
        React["react 19.2.4"]
        ReactDOM["react-dom 19.2.4"]
        SupabaseSDK["@supabase/supabase-js 2.112.3"]
        Recharts["recharts 3.7.0"]
        Lucide["lucide-react 0.563.0"]
        TailwindCDN["Tailwind CSS (CDN)"]
    end
    
    subgraph App ["Application Modules"]
        AppTsx["App.tsx"]
        TypesTs["types.ts"]
        ConstantsTs["constants.ts"]
        ApiTs["services/api.ts"]
        SupabaseTs["services/supabase.ts"]
        TaxLogicTs["utils/taxLogic.ts"]
    end
    
    subgraph Components ["UI Components"]
        C1["LoginPage"]
        C2["Header"]
        C3["DashboardStats"]
        C4["DashboardTable"]
        C5["DelinquencyTable"]
        C6["PropertyCard"]
        C7["RptarModal"]
        C8["OfficialReceiptModal"]
        C9["BulkImportModal"]
        C10["UserManagementModal"]
        C11["AuditLogModal"]
    end
    
    AppTsx --> TypesTs
    AppTsx --> ApiTs
    AppTsx --> C1 & C2 & C3 & C4 & C5 & C6 & C7 & C8 & C9 & C10 & C11
    
    ApiTs --> SupabaseTs
    ApiTs --> TaxLogicTs
    ApiTs --> TypesTs
    
    SupabaseTs --> SupabaseSDK
    
    TaxLogicTs --> TypesTs
    TaxLogicTs --> ConstantsTs
    
    C4 --> TaxLogicTs
    C4 --> ConstantsTs
    C9 --> ConstantsTs
    
    C1 & C2 & C3 & C4 & C5 & C6 & C7 & C8 & C10 & C11 --> TypesTs
    C1 & C9 & C10 --> ApiTs
    
    AppTsx --> React & ReactDOM
    C3 --> Recharts
    C1 & C2 & C3 & C4 & C5 & C7 & C8 & C9 & C10 & C11 --> Lucide

    style AppTsx fill:#dbeafe,stroke:#2563eb,stroke-width:3px
    style ApiTs fill:#d1fae5,stroke:#10b981,stroke-width:2px
    style TaxLogicTs fill:#fef3c7,stroke:#f59e0b,stroke-width:2px
```
