-- =========================================================
-- MUNICIPAL TREASURER'S OFFICE (LGU TREASURY CONNECT)
-- SUPABASE POSTGRESQL DATABASE SCHEMA
-- =========================================================

-- 1. USERS TABLE (3 Unified Roles: Admin, Assessor, Viewer)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL DEFAULT 'admin123',
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Admin', 'Assessor', 'Viewer')),
    station_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. SFMV TABLE (Schedule of Market Values)
CREATE TABLE IF NOT EXISTS schedule_of_market_values (
    id SERIAL PRIMARY KEY,
    barangay TEXT NOT NULL,
    property_class TEXT NOT NULL,
    base_rate_sqm NUMERIC NOT NULL,
    assessment_level NUMERIC NOT NULL DEFAULT 0.20,
    UNIQUE(barangay, property_class)
);

-- 3. PROPERTIES TABLE (RPTAR Masterlist)
CREATE TABLE IF NOT EXISTS properties (
    id SERIAL PRIMARY KEY,
    td_number TEXT UNIQUE NOT NULL,
    previous_td_number TEXT,
    pin TEXT,
    owner_name TEXT NOT NULL,
    address TEXT NOT NULL,
    barangay TEXT NOT NULL,
    property_class TEXT NOT NULL DEFAULT 'Residential',
    lot_area_sqm NUMERIC DEFAULT 100,
    market_value NUMERIC NOT NULL DEFAULT 0,
    assessed_value NUMERIC NOT NULL DEFAULT 0,
    last_paid_year INT NOT NULL DEFAULT 2025,
    is_shell_record BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. PAYMENT POSTINGS (AF-51 Receipts)
CREATE TABLE IF NOT EXISTS payment_postings (
    id SERIAL PRIMARY KEY,
    receipt_no TEXT UNIQUE NOT NULL,
    property_id INT REFERENCES properties(id) ON DELETE CASCADE,
    paid_records JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_paid NUMERIC NOT NULL,
    tender_type TEXT NOT NULL DEFAULT 'CASH',
    tender_reference TEXT,
    posted_by TEXT NOT NULL,
    posted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. RPTAR AUDIT LOGS (Attribution & Traceability)
CREATE TABLE IF NOT EXISTS rptar_audit_logs (
    id SERIAL PRIMARY KEY,
    property_id INT,
    td_number TEXT,
    action_type TEXT NOT NULL,
    assessor_name TEXT NOT NULL,
    station_id TEXT,
    details TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- =========================================================
-- SEED DATA
-- =========================================================

-- Seed Default Staff Accounts
INSERT INTO users (username, password, full_name, role, station_id)
VALUES 
    ('juan.assessor', 'admin123', 'Juan Reyes', 'Assessor', 'Assessor-Desk-02'),
    ('admin', 'admin123', 'System Administrator', 'Admin', 'Main-HQ'),
    ('mayor.office', 'admin123', 'Hon. Mayor Office', 'Viewer', 'Executive-Desk')
ON CONFLICT (username) DO NOTHING;

-- Seed Default Schedule of Market Values
INSERT INTO schedule_of_market_values (barangay, property_class, base_rate_sqm, assessment_level)
VALUES
    ('Poblacion', 'Residential', 2500, 0.20),
    ('Poblacion', 'Commercial', 6000, 0.50),
    ('San Jose', 'Residential', 1800, 0.20),
    ('San Jose', 'Commercial', 4500, 0.50),
    ('Acacia', 'Residential', 2000, 0.20),
    ('Industrial Zone', 'Industrial', 3500, 0.50)
ON CONFLICT DO NOTHING;

-- Seed Initial Properties
INSERT INTO properties (td_number, previous_td_number, owner_name, address, barangay, assessed_value, last_paid_year, property_class, is_shell_record)
VALUES
    ('TD-99-001-2234', 'TD-92-001-1100', 'Juan Dela Cruz', 'Lot 4 Blk 5, Acacia St.', 'Acacia', 500000, 2023, 'Residential', false),
    ('TD-99-002-5567', 'TD-85-004-9922', 'Clara Batumbakal', 'KM 5 National Highway', 'San Jose', 1200000, 2025, 'Commercial', false),
    ('TD-CSV-888', '', 'Prospective Taxpayer Inc.', 'Block 2, Industrial Zone', 'Industrial Zone', 0, 2020, 'Industrial', true),
    ('TD-99-004-9901', 'TD-91-001-0001', 'Ricardo Dalisay', 'Poblacion Proper', 'Poblacion', 350000, 2024, 'Residential', false)
ON CONFLICT DO NOTHING;

-- =========================================================
-- PERMISSIONS (Supabase Public Access)
-- =========================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role, postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role, postgres;

ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_of_market_values DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_postings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rptar_audit_logs DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
