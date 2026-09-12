-- =========================================================
-- MUNICIPAL TREASURER'S OFFICE (LGU TREASURY CONNECT)
-- SUPABASE POSTGRESQL DATABASE SCHEMA
-- =========================================================

-- Enable Cryptographic Extension for Bcrypt Password Hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. USERS TABLE (3 Unified Roles: Admin, Assessor, Viewer)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
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

-- 6. SECURITY AUDIT LOGS (Immutable Authentication & Security Events)
CREATE TABLE IF NOT EXISTS security_audit_logs (
    id SERIAL PRIMARY KEY,
    event_type TEXT NOT NULL, -- 'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'USER_CREATED', 'ROLE_CHANGED', 'PASSWORD_RESET', 'USER_DELETED', 'ACCESS_DENIED'
    username TEXT NOT NULL,
    user_id INT,
    station_id TEXT,
    ip_address TEXT,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- =========================================================
-- TRIGGERS & PROCEDURAL AUTOMATION
-- =========================================================

-- Trigger for Automatic Bcrypt Hashing on Insert or Password Update
CREATE OR REPLACE FUNCTION trg_hash_user_password()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.password_hash IS NOT NULL AND NEW.password_hash NOT LIKE '$2%' THEN
        NEW.password_hash := crypt(NEW.password_hash, gen_salt('bf', 10));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_hash_password ON users;
CREATE TRIGGER trg_users_hash_password
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION trg_hash_user_password();

-- =========================================================
-- STORED PROCEDURES & RPCs
-- =========================================================

-- Authenticate user securely using Bcrypt crypt() comparison with audit logging
CREATE OR REPLACE FUNCTION authenticate_user(
    p_username TEXT,
    p_password TEXT,
    p_station_id TEXT DEFAULT 'Workstation'
)
RETURNS TABLE (
    id INT,
    username TEXT,
    full_name TEXT,
    role TEXT,
    station_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user users%ROWTYPE;
BEGIN
    SELECT * INTO v_user
    FROM users
    WHERE lower(users.username) = lower(trim(p_username));

    IF v_user.id IS NOT NULL AND v_user.password_hash = crypt(p_password, v_user.password_hash) THEN
        -- Audit successful authentication
        INSERT INTO security_audit_logs (event_type, username, user_id, station_id, details)
        VALUES ('LOGIN_SUCCESS', v_user.username, v_user.id, COALESCE(p_station_id, v_user.station_id), 'Successful authentication');

        RETURN QUERY
        SELECT v_user.id, v_user.username, v_user.full_name, v_user.role, v_user.station_id;
    ELSE
        -- Audit failed authentication attempt
        INSERT INTO security_audit_logs (event_type, username, user_id, station_id, details)
        VALUES ('LOGIN_FAILURE', lower(trim(p_username)), v_user.id, p_station_id, 'Failed authentication: invalid credentials');
    END IF;
END;
$$;

-- =========================================================
-- SEED DATA
-- =========================================================

-- Seed Default Staff Accounts (Bcrypt hashed default 'admin123')
INSERT INTO users (username, password_hash, full_name, role, station_id)
VALUES 
    ('juan.assessor', crypt('admin123', gen_salt('bf', 10)), 'Juan Reyes', 'Assessor', 'Assessor-Desk-02'),
    ('admin', crypt('admin123', gen_salt('bf', 10)), 'System Administrator', 'Admin', 'Main-HQ'),
    ('mayor.office', crypt('admin123', gen_salt('bf', 10)), 'Hon. Mayor Office', 'Viewer', 'Executive-Desk')
ON CONFLICT (username) DO UPDATE
SET password_hash = EXCLUDED.password_hash;

-- Seed Santa Rosa Schedule of Market Values
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
-- PERMISSIONS & ROW LEVEL SECURITY (RLS)
-- =========================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, postgres;

-- Revoke direct permissions on sensitive tables from anon
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- Grant standard permissions to authenticated, service_role, and postgres
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated, service_role, postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION authenticate_user(TEXT, TEXT, TEXT) TO anon, authenticated, service_role, postgres;

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_of_market_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rptar_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Restrictive policies
CREATE POLICY "Allow authenticated read users" ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow public select properties" ON public.properties FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow authenticated modify properties" ON public.properties FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow public select sfmv" ON public.schedule_of_market_values FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow authenticated all sfmv" ON public.schedule_of_market_values FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow public select payments" ON public.payment_postings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow authenticated all payments" ON public.payment_postings FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated all audit_logs" ON public.rptar_audit_logs FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow anon and auth insert security logs" ON public.security_audit_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated read security logs" ON public.security_audit_logs FOR SELECT TO authenticated USING (true);

NOTIFY pgrst, 'reload schema';
