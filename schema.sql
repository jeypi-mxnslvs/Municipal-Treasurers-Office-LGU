-- =========================================================
-- MUNICIPAL TREASURER'S OFFICE (LGU TREASURY CONNECT)
-- SUPABASE POSTGRESQL DATABASE SCHEMA
-- =========================================================

-- Enable Cryptographic Extension for Bcrypt Password Hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. USERS TABLE (2 Roles: Admin, Assessor)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Admin', 'Assessor')),
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
    last_paid_quarter INT NOT NULL DEFAULT 4,
    delinquency_start_year INT,
    parcel_origin_year INT,
    historical_assessed_values JSONB DEFAULT '{}'::jsonb,
    is_shell_record BOOLEAN DEFAULT FALSE,
    encoder_label TEXT,
    entry_type TEXT DEFAULT 'CSV_IMPORT',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. DELINQUENCY PERIOD VERIFICATIONS (Assessment & Settlement Provenance)
CREATE TABLE IF NOT EXISTS delinquency_period_verifications (
    id SERIAL PRIMARY KEY,
    property_id INT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    td_number_snapshot VARCHAR(64) NOT NULL,
    period_key VARCHAR(32) NOT NULL,
    tax_year INT NOT NULL,
    period_label VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    verification_type VARCHAR(32) NOT NULL DEFAULT 'OFFICIAL_RECEIPT',
    source_reference VARCHAR(128),
    remarks TEXT,
    verified_by VARCHAR(128) NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    station_id VARCHAR(64) NOT NULL DEFAULT 'Assessor-Desk',
    supersedes_id INT REFERENCES delinquency_period_verifications(id) ON DELETE SET NULL,
    reversal_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. DELINQUENCY YEAR COMPLETIONS (Year-Level Verification Status)
CREATE TABLE IF NOT EXISTS delinquency_year_completions (
    id SERIAL PRIMARY KEY,
    property_id INT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    tax_year INT NOT NULL,
    is_fully_settled BOOLEAN NOT NULL DEFAULT FALSE,
    completion_source VARCHAR(64) NOT NULL,
    verified_by VARCHAR(128) NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_property_tax_year UNIQUE (property_id, tax_year)
);

-- 6. RPTAR AUDIT LOGS (Attribution & Traceability)
CREATE TABLE IF NOT EXISTS rptar_audit_logs (
    id SERIAL PRIMARY KEY,
    property_id INT,
    td_number TEXT,
    action_type TEXT NOT NULL,
    assessor_name TEXT NOT NULL,
    station_id TEXT,
    details TEXT,
    tax_year INT,
    field_changed TEXT,
    original_value NUMERIC,
    new_value NUMERIC,
    difference NUMERIC,
    reason TEXT,
    user_id INT,
    user_role TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 7. SECURITY AUDIT LOGS (Immutable Authentication & Security Events)
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

-- 8. MUNICIPAL TAX POLICY SETTINGS TABLE (Configurable Discount Schedule)
CREATE TABLE IF NOT EXISTS municipal_tax_settings (
    id SERIAL PRIMARY KEY,
    early_payment_discount_rate NUMERIC NOT NULL DEFAULT 0.20,
    early_payment_start_month INT NOT NULL DEFAULT 1,
    early_payment_end_month INT NOT NULL DEFAULT 3,
    regular_prompt_discount_rate NUMERIC NOT NULL DEFAULT 0.10,
    delinquent_discount_rate NUMERIC NOT NULL DEFAULT 0.00,
    effective_year INT NOT NULL DEFAULT 2026,
    updated_by TEXT DEFAULT 'admin',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 9. CSV IMPORT BATCHES TABLE (Assessor Staging & Ingestion Tracking)
CREATE TABLE IF NOT EXISTS csv_import_batches (
    id SERIAL PRIMARY KEY,
    batch_name TEXT NOT NULL,
    barangay TEXT NOT NULL,
    filename TEXT NOT NULL,
    total_rows INT NOT NULL DEFAULT 0,
    inserted_rows INT NOT NULL DEFAULT 0,
    updated_rows INT NOT NULL DEFAULT 0,
    unchanged_rows INT NOT NULL DEFAULT 0,
    imported_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 10. DELINQUENCY PERIOD VERIFICATIONS TABLE (Settlement Evidence & Decision Registry)
CREATE TABLE IF NOT EXISTS delinquency_period_verifications (
    id SERIAL PRIMARY KEY,
    property_id INT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    td_number_snapshot TEXT NOT NULL,
    period_key TEXT NOT NULL,
    tax_year INT NOT NULL,
    period_label TEXT NOT NULL,
    status TEXT NOT NULL CHECK (
        status IN (
            'UNVERIFIED',
            'VERIFIED_OUTSTANDING',
            'VERIFIED_SETTLED_EXTERNALLY',
            'DISPUTED',
            'NOT_APPLICABLE',
            'SUPERSEDED'
        )
    ),
    verification_type TEXT NOT NULL CHECK (
        verification_type IN (
            'ASSESSMENT',
            'HISTORICAL_VALUATION',
            'DELINQUENCY',
            'EXTERNAL_SETTLEMENT_EVIDENCE'
        )
    ),
    source_reference TEXT,
    remarks TEXT,
    verified_by INT REFERENCES users(id) ON DELETE SET NULL,
    verified_by_name TEXT,
    verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    station_id TEXT,
    supersedes_id INT REFERENCES delinquency_period_verifications(id),
    reversal_reason TEXT,
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

-- 7. ATOMIC BATCH UPSERT PROPERTIES (Assessor Import Center)
CREATE OR REPLACE FUNCTION batch_upsert_properties(
    p_properties JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item JSONB;
    v_inserted INT := 0;
    v_updated INT := 0;
    v_td TEXT;
    v_exists BOOLEAN;
BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_properties)
    LOOP
        v_td := trim(v_item->>'td_number');
        IF v_td IS NOT NULL AND v_td != '' THEN
            SELECT EXISTS(SELECT 1 FROM properties WHERE td_number = v_td) INTO v_exists;
            
            IF v_exists THEN
                UPDATE properties SET
                    previous_td_number = COALESCE(v_item->>'previous_td_number', previous_td_number),
                    pin = COALESCE(v_item->>'pin', pin),
                    owner_name = COALESCE(v_item->>'owner_name', owner_name),
                    address = COALESCE(v_item->>'address', address),
                    barangay = COALESCE(v_item->>'barangay', barangay),
                    property_class = COALESCE(v_item->>'property_class', property_class),
                    lot_area_sqm = COALESCE((v_item->>'lot_area_sqm')::NUMERIC, lot_area_sqm),
                    market_value = COALESCE((v_item->>'market_value')::NUMERIC, market_value),
                    assessed_value = COALESCE((v_item->>'assessed_value')::NUMERIC, assessed_value),
                    parcel_origin_year = COALESCE((v_item->>'parcel_origin_year')::INT, parcel_origin_year),
                    historical_assessed_values = COALESCE((v_item->'historical_assessed_values'), historical_assessed_values),
                    is_shell_record = COALESCE((v_item->>'is_shell_record')::BOOLEAN, is_shell_record),
                    updated_at = timezone('utc'::text, now())
                    -- Financial history protection: last_paid_year, last_paid_quarter & delinquency_start_year are NEVER altered on update
                WHERE td_number = v_td;
                v_updated := v_updated + 1;
            ELSE
                INSERT INTO properties (
                    td_number, previous_td_number, pin, owner_name, address, barangay, property_class,
                    lot_area_sqm, market_value, assessed_value, last_paid_year, last_paid_quarter,
                    delinquency_start_year, parcel_origin_year, historical_assessed_values,
                    is_shell_record, updated_at
                ) VALUES (
                    v_td,
                    COALESCE(v_item->>'previous_td_number', ''),
                    COALESCE(v_item->>'pin', ''),
                    COALESCE(v_item->>'owner_name', 'Unnamed Taxpayer'),
                    COALESCE(v_item->>'address', 'Santa Rosa, Nueva Ecija'),
                    COALESCE(v_item->>'barangay', 'Poblacion'),
                    COALESCE(v_item->>'property_class', 'Residential'),
                    COALESCE((v_item->>'lot_area_sqm')::NUMERIC, 100),
                    COALESCE((v_item->>'market_value')::NUMERIC, 0),
                    COALESCE((v_item->>'assessed_value')::NUMERIC, 0),
                    COALESCE((v_item->>'last_paid_year')::INT, 1973),
                    COALESCE((v_item->>'last_paid_quarter')::INT, 4),
                    (v_item->>'delinquency_start_year')::INT,
                    (v_item->>'parcel_origin_year')::INT,
                    COALESCE(v_item->'historical_assessed_values', '{}'::jsonb),
                    COALESCE((v_item->>'is_shell_record')::BOOLEAN, false),
                    timezone('utc'::text, now())
                );
                v_inserted := v_inserted + 1;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('inserted', v_inserted, 'updated', v_updated);
END;
$$;

-- =========================================================
-- SEED DATA
-- =========================================================

-- Seed Default Staff Accounts (Bcrypt hashed default 'admin123')
INSERT INTO users (username, password_hash, full_name, role, station_id)
VALUES 
    ('admin@example.com', crypt('admin123', gen_salt('bf', 10)), 'System Administrator', 'Admin', 'Main-HQ'),
    ('assessor@example.com', crypt('admin123', gen_salt('bf', 10)), 'Municipal Assessor', 'Assessor', 'Assessor-Desk'),
    -- Legacy Aliases & Compatibility
    ('admin', crypt('admin123', gen_salt('bf', 10)), 'System Administrator', 'Admin', 'Main-HQ'),
    ('juan.assessor', crypt('admin123', gen_salt('bf', 10)), 'Juan Reyes', 'Assessor', 'Assessor-Desk-02')
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
INSERT INTO properties (td_number, previous_td_number, owner_name, address, barangay, assessed_value, last_paid_year, last_paid_quarter, property_class, is_shell_record)
VALUES
    ('TD-99-001-2234', 'TD-92-001-1100', 'Juan Dela Cruz', 'Lot 4 Blk 5, Acacia St.', 'Acacia', 500000, 2023, 4, 'Residential', false),
    ('TD-99-002-5567', 'TD-85-004-9922', 'Clara Batumbakal', 'KM 5 National Highway', 'San Jose', 1200000, 2025, 4, 'Commercial', false),
    ('TD-CSV-888', '', 'Prospective Taxpayer Inc.', 'Block 2, Industrial Zone', 'Industrial Zone', 0, 2020, 4, 'Industrial', true),
    ('TD-99-004-9901', 'TD-91-001-0001', 'Ricardo Dalisay', 'Poblacion Proper', 'Poblacion', 350000, 2024, 4, 'Residential', false)
ON CONFLICT DO NOTHING;

-- Seed Default Santa Rosa Municipal Tax Policy (Jan-Mar 20%, Apr-Dec 10%, Delinquent 0%)
INSERT INTO municipal_tax_settings (
    early_payment_discount_rate,
    early_payment_start_month,
    early_payment_end_month,
    regular_prompt_discount_rate,
    delinquent_discount_rate,
    effective_year,
    updated_by
)
SELECT 0.20, 1, 3, 0.10, 0.00, 2026, 'System Administrator'
WHERE NOT EXISTS (SELECT 1 FROM municipal_tax_settings);

-- =========================================================
-- PERMISSIONS & ROW LEVEL SECURITY (RLS)
-- =========================================================

-- Grant schema usage and table privileges (access governed by RLS policies below)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role, postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role, postgres;
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION authenticate_user(TEXT, TEXT, TEXT) TO anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION batch_upsert_properties(JSONB) TO anon, authenticated, service_role, postgres;

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_of_market_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delinquency_period_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delinquency_year_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rptar_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipal_tax_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csv_import_batches ENABLE ROW LEVEL SECURITY;

-- Restrictive policies
CREATE POLICY "Allow authenticated read users" ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow public select properties" ON public.properties FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow authenticated modify properties" ON public.properties FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow public select sfmv" ON public.schedule_of_market_values FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow authenticated all sfmv" ON public.schedule_of_market_values FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow public select delinquency_verifications" ON public.delinquency_period_verifications FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow authenticated all delinquency_verifications" ON public.delinquency_period_verifications FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow public select delinquency_completions" ON public.delinquency_year_completions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow authenticated all delinquency_completions" ON public.delinquency_year_completions FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated all audit_logs" ON public.rptar_audit_logs FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow anon and auth insert security logs" ON public.security_audit_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated read security logs" ON public.security_audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow all on municipal_tax_settings" ON public.municipal_tax_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on csv_import_batches" ON public.csv_import_batches FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
