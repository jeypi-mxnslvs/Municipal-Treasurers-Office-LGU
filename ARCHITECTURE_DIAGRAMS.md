# ARCHITECTURE DIAGRAMS

## 1. Overall System Architecture
This diagram outlines the real, active architecture of the application (Client-Server with BaaS). It explicitly shows the inactive Express server to avoid confusion.

```mermaid
graph TD
    User([End User / Assessor]) --> ReactApp[React SPA Frontend]
    
    subgraph Frontend [LGU Treasury Connect - Frontend]
        ReactApp --> State[App.tsx State Manager]
        State --> UI[Components / Modals]
        UI --> BusinessLogic[Tax Engine: utils/taxLogic.ts]
        BusinessLogic --> APIClient[API Layer: services/api.ts]
    end

    APIClient -- HTTP / REST --> Supabase[Supabase Cloud]

    subgraph Backend [Backend-as-a-Service]
        Supabase --> Postgres[(PostgreSQL Database)]
    end
    
    subgraph Inactive [Dead / Unused System]
        Express[Express REST API] -.-x SQLite[(treasury.db)]
    end
    
    classDef dead fill:#f9f,stroke:#333,stroke-width:2px,stroke-dasharray: 5 5;
    class Express,SQLite Inactive dead;
```

## 2. Database Relationships
This entity-relationship diagram maps the Supabase PostgreSQL schema.

```mermaid
erDiagram
    users {
        int id PK
        string username
        string password
        string full_name
        string role
        string station_id
    }
    
    schedule_of_market_values {
        int id PK
        string barangay
        string property_class
        numeric base_rate_sqm
        numeric assessment_level
    }
    
    properties {
        int id PK
        string td_number
        string previous_td_number
        string pin
        string owner_name
        string address
        string barangay
        numeric assessed_value
        int last_paid_year
        boolean is_shell_record
    }
    
    payment_postings {
        int id PK
        string receipt_no
        int property_id FK
        jsonb paid_records
        numeric total_paid
        string tender_type
        string posted_by
    }
    
    rptar_audit_logs {
        int id PK
        int property_id
        string td_number
        string action_type
        string assessor_name
        string details
    }

    properties ||--o{ payment_postings : "has"
    properties ||--o{ rptar_audit_logs : "tracked by"
```

## 3. Flawed Authentication Flow
This diagram illustrates the current, insecure authentication implementation.

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant APIClient as services/api.ts
    participant Supabase as Supabase (No RLS)

    User->>Browser: Enters Username & Password
    Browser->>APIClient: login(username, password)
    APIClient->>Supabase: SELECT * FROM users WHERE username = '...'
    Supabase-->>APIClient: Returns user row (including plaintext password!)
    APIClient->>APIClient: Check if (user.password !== password)
    
    alt Passwords Match
        APIClient-->>Browser: Return pseudo-token "supabase-token-{id}"
        Browser->>Browser: Store token in localStorage
        Browser-->>User: Grant Access
    else Passwords Do Not Match
        APIClient-->>Browser: Throw Error
        Browser-->>User: Show "Invalid credentials"
    end
```

## 4. Main Request Lifecycle & Tax Workflow
This outlines what happens when a user views a property and makes a payment.

```mermaid
sequenceDiagram
    participant User
    participant App as App.tsx
    participant TaxEngine as utils/taxLogic.ts
    participant API as services/api.ts
    participant Supabase
    
    User->>App: Click "Post Payment" on a Property
    App->>API: getPropertyAssessment(id)
    API->>Supabase: SELECT * FROM properties WHERE id = ...
    Supabase-->>API: Property Record
    API->>TaxEngine: calculateTaxLiability(property)
    TaxEngine-->>API: Returns Arrears, Current Due, Penalties
    API-->>App: CalculationResult
    App-->>User: Display Payment Scope (DelinquencyTable)
    
    User->>App: Clicks "Mark Dues Cleared"
    App->>API: postPayment(payload)
    API->>Supabase: UPDATE properties SET last_paid_year = ...
    API->>Supabase: INSERT INTO payment_postings
    API->>Supabase: INSERT INTO rptar_audit_logs
    Supabase-->>API: Success
    API-->>App: Official Receipt Data
    App-->>User: Display Official Receipt Modal
```

## 5. Deployment Architecture
This details how the frontend is built and served.

```mermaid
graph LR
    Developer -->|Git Push| GitHub[GitHub Repository]
    
    subgraph CI/CD [GitHub Pages Workflow]
        GitHub -->|npm run build| Build[Vite Build (dist/)]
        Build --> Deploy[gh-pages branch]
    end
    
    Deploy -->|Static Hosting| Browser[User's Browser]
    Browser -->|API Requests| SupabaseCloud[(Supabase Cloud)]
```
