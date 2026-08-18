-- REVISED SYSTEM ARCHITECT SCHEMA v2.6

-- 1. USERS
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('Cashier', 'Officer', 'Admin')),
    station_id VARCHAR(20)
);

-- 2. PROPERTIES (RPTAR)
CREATE TABLE properties (
    id SERIAL PRIMARY KEY,
    current_td VARCHAR(50) UNIQUE NOT NULL,
    previous_td VARCHAR(50),
    owner_name VARCHAR(150) NOT NULL,
    address TEXT,
    assessed_value DECIMAL(15, 2) NOT NULL DEFAULT 0,
    last_paid_year INT NOT NULL DEFAULT 2025,
    property_class VARCHAR(50) DEFAULT 'Residential',
    is_shell_record BOOLEAN DEFAULT FALSE, -- Flag for CSV/Imported shell records
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. PAYMENT POSTINGS
CREATE TABLE payment_postings (
    id SERIAL PRIMARY KEY,
    property_id INT REFERENCES properties(id),
    receipt_no VARCHAR(100) UNIQUE,
    payment_year INT NOT NULL,
    basic_tax DECIMAL(15, 2),
    penalty_amt DECIMAL(15, 2),
    total_paid DECIMAL(15, 2),
    posted_by INT REFERENCES users(id),
    posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. VIEW: DYNAMIC DELINQUENCY STATUS
CREATE OR REPLACE VIEW dashboard_view AS
SELECT 
    p.id,
    p.current_td,
    p.previous_td,
    p.owner_name,
    p.assessed_value,
    p.is_shell_record,
    -- Simple check for Cleared vs Delinquent
    CASE 
        WHEN p.last_paid_year >= 2026 THEN 'CLEARED'
        ELSE 'DELINQUENT'
    END as status,
    -- Calculation Logic Loop (Abstracted for Dashboard performance)
    (SELECT COALESCE(SUM(p.assessed_value * 0.02 * (1 + (LEAST(36, (2026-y)*12) * 0.02))), 0)
     FROM generate_series(p.last_paid_year + 1, 2026) y) as total_debt
FROM properties p;
