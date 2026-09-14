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

-- 4. ACCOUNTABLE FORMS (AF-51 Sequential Booklet Register)
CREATE TABLE IF NOT EXISTS accountable_forms (
    id SERIAL PRIMARY KEY,
    booklet_id TEXT UNIQUE NOT NULL,
    form_type TEXT NOT NULL DEFAULT 'AF-51',
    series_start INT NOT NULL,
    series_end INT NOT NULL,
    current_serial INT NOT NULL,
    assigned_to_user_id INT REFERENCES users(id) ON DELETE SET NULL,
    assigned_to_username TEXT,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'EXHAUSTED', 'REVOKED')) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. PAYMENT POSTINGS (AF-51 Official Receipts)
CREATE TABLE IF NOT EXISTS payment_postings (
    id SERIAL PRIMARY KEY,
    receipt_no TEXT UNIQUE NOT NULL,
    property_id INT REFERENCES properties(id) ON DELETE CASCADE,
    paid_records JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_paid NUMERIC NOT NULL,
    tender_type TEXT NOT NULL DEFAULT 'CASH',
    tender_reference TEXT,
    status TEXT NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('ISSUED', 'VOIDED')),
    void_reason TEXT,
    voided_by TEXT,
    voided_at TIMESTAMP WITH TIME ZONE,
    previous_last_paid_year INT,
    booklet_id TEXT REFERENCES accountable_forms(booklet_id),
    posted_by TEXT NOT NULL,
    posted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
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

-- Atomic Payment Processing Stored Procedure
CREATE OR REPLACE FUNCTION process_rpt_payment(
    p_property_id INT,
    p_paid_records JSONB,
    p_total_paid NUMERIC,
    p_tender_type TEXT,
    p_tender_reference TEXT,
    p_posted_by TEXT,
    p_station_id TEXT DEFAULT 'Main-HQ',
    p_user_id INT DEFAULT NULL
)
RETURNS payment_postings
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_property properties%ROWTYPE;
    v_booklet accountable_forms%ROWTYPE;
    v_receipt_no TEXT;
    v_payment payment_postings%ROWTYPE;
    v_highest_year INT;
    v_item JSONB;
BEGIN
    -- 1. Lock and fetch property
    SELECT * INTO v_property
    FROM properties
    WHERE id = p_property_id
    FOR UPDATE;

    IF v_property.id IS NULL THEN
        RAISE EXCEPTION 'Property ID % not found', p_property_id;
    END IF;

    IF v_property.is_shell_record THEN
        RAISE EXCEPTION 'Cannot post payment on unverified shell record %', v_property.td_number;
    END IF;

    -- 2. Lock and fetch active booklet assigned to user
    SELECT * INTO v_booklet
    FROM accountable_forms
    WHERE status = 'ACTIVE'
      AND (
          (p_user_id IS NOT NULL AND assigned_to_user_id = p_user_id)
          OR lower(assigned_to_username) = lower(p_posted_by)
          OR assigned_to_username IS NULL
      )
    ORDER BY id ASC
    LIMIT 1
    FOR UPDATE;

    IF v_booklet.id IS NULL THEN
        SELECT * INTO v_booklet
        FROM accountable_forms
        WHERE status = 'ACTIVE'
        ORDER BY id ASC
        LIMIT 1
        FOR UPDATE;
    END IF;

    IF v_booklet.id IS NULL THEN
        RAISE EXCEPTION 'No active Accountable Form 51 booklet available. Please assign a booklet in Treasury Administration.';
    END IF;

    -- 3. Compute sequential OR number
    v_receipt_no := 'AF51-' || LPAD(v_booklet.current_serial::TEXT, 7, '0');

    -- Advance booklet serial or mark exhausted
    IF v_booklet.current_serial >= v_booklet.series_end THEN
        UPDATE accountable_forms
        SET current_serial = v_booklet.series_end,
            status = 'EXHAUSTED'
        WHERE id = v_booklet.id;
    ELSE
        UPDATE accountable_forms
        SET current_serial = v_booklet.current_serial + 1
        WHERE id = v_booklet.id;
    END IF;

    -- 4. Calculate new highest last_paid_year from paid_records
    v_highest_year := v_property.last_paid_year;
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_paid_records)
    LOOP
        IF (v_item->>'year')::INT > v_highest_year THEN
            v_highest_year := (v_item->>'year')::INT;
        END IF;
    END LOOP;

    -- 5. Advance property last_paid_year
    UPDATE properties
    SET last_paid_year = v_highest_year,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_property.id;

    -- 6. Insert atomic payment posting
    INSERT INTO payment_postings (
        receipt_no,
        property_id,
        paid_records,
        total_paid,
        tender_type,
        tender_reference,
        status,
        posted_by,
        posted_at,
        previous_last_paid_year,
        booklet_id
    )
    VALUES (
        v_receipt_no,
        v_property.id,
        p_paid_records,
        p_total_paid,
        COALESCE(p_tender_type, 'CASH'),
        p_tender_reference,
        'ISSUED',
        p_posted_by,
        timezone('utc'::text, now()),
        v_property.last_paid_year,
        v_booklet.booklet_id
    )
    RETURNING * INTO v_payment;

    -- 7. Insert immutable audit log
    INSERT INTO rptar_audit_logs (
        property_id,
        td_number,
        action_type,
        assessor_name,
        station_id,
        details
    )
    VALUES (
        v_property.id,
        v_property.td_number,
        'DUES_CLEARED',
        p_posted_by,
        p_station_id,
        'Issued Official Receipt ' || v_receipt_no || ' for ₱' || TO_CHAR(p_total_paid, 'FM999,999,990.00') || ' (Advanced last paid year from ' || v_property.last_paid_year || ' to ' || v_highest_year || ')'
    );

    RETURN v_payment;
END;
$$;

-- Official Receipt Void / Cancellation Stored Procedure (COA Protocol)
CREATE OR REPLACE FUNCTION void_official_receipt(
    p_receipt_no TEXT,
    p_reason TEXT,
    p_authorized_by TEXT,
    p_station_id TEXT DEFAULT 'Main-HQ'
)
RETURNS payment_postings
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_payment payment_postings%ROWTYPE;
    v_property properties%ROWTYPE;
BEGIN
    -- 1. Lock and fetch payment posting
    SELECT * INTO v_payment
    FROM payment_postings
    WHERE receipt_no = p_receipt_no
    FOR UPDATE;

    IF v_payment.id IS NULL THEN
        RAISE EXCEPTION 'Receipt % not found', p_receipt_no;
    END IF;

    IF v_payment.status = 'VOIDED' THEN
        RAISE EXCEPTION 'Receipt % is already voided', p_receipt_no;
    END IF;

    IF p_reason IS NULL OR trim(p_reason) = '' THEN
        RAISE EXCEPTION 'A valid cancellation reason is required to void an Official Receipt under COA rules';
    END IF;

    -- 2. Lock associated property
    SELECT * INTO v_property
    FROM properties
    WHERE id = v_payment.property_id
    FOR UPDATE;

    -- 3. Roll back property last_paid_year to pre-payment state
    IF v_property.id IS NOT NULL AND v_payment.previous_last_paid_year IS NOT NULL THEN
        UPDATE properties
        SET last_paid_year = v_payment.previous_last_paid_year,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_property.id;
    END IF;

    -- 4. Mark receipt as VOIDED (Never delete, COA compliance)
    UPDATE payment_postings
    SET status = 'VOIDED',
        void_reason = p_reason,
        voided_by = p_authorized_by,
        voided_at = timezone('utc'::text, now())
    WHERE id = v_payment.id
    RETURNING * INTO v_payment;

    -- 5. Create supervisory void audit log
    INSERT INTO rptar_audit_logs (
        property_id,
        td_number,
        action_type,
        assessor_name,
        station_id,
        details
    )
    VALUES (
        v_payment.property_id,
        COALESCE(v_property.td_number, 'UNKNOWN'),
        'UPDATED',
        p_authorized_by,
        p_station_id,
        'COA VOID: Official Receipt ' || p_receipt_no || ' VOIDED by ' || p_authorized_by || '. Reason: ' || p_reason || '. Reverted last paid year to ' || COALESCE(v_payment.previous_last_paid_year::TEXT, 'original')
    );

    RETURN v_payment;
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
    ('viewer@example.com', crypt('admin123', gen_salt('bf', 10)), 'Treasury Viewer', 'Viewer', 'Viewer-Desk'),
    -- Legacy Aliases & Compatibility
    ('admin', crypt('admin123', gen_salt('bf', 10)), 'System Administrator', 'Admin', 'Main-HQ'),
    ('juan.assessor', crypt('admin123', gen_salt('bf', 10)), 'Juan Reyes', 'Assessor', 'Assessor-Desk-02'),
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

-- Seed Default AF-51 Booklets (50 Receipts per standard LGU stub)
INSERT INTO accountable_forms (booklet_id, form_type, series_start, series_end, current_serial, assigned_to_username, status)
VALUES 
    ('AF51-BK-2026-001', 'AF-51', 4500001, 4500050, 4500001, 'assessor@example.com', 'ACTIVE'),
    ('AF51-BK-2026-002', 'AF-51', 4500051, 4500100, 4500051, 'admin@example.com', 'ACTIVE')
ON CONFLICT (booklet_id) DO NOTHING;

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
GRANT EXECUTE ON FUNCTION process_rpt_payment(INT, JSONB, NUMERIC, TEXT, TEXT, TEXT, TEXT, INT) TO anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION void_official_receipt(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role, postgres;

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_of_market_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accountable_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rptar_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Restrictive policies
CREATE POLICY "Allow authenticated read users" ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow public select properties" ON public.properties FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow authenticated modify properties" ON public.properties FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow public select sfmv" ON public.schedule_of_market_values FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow authenticated all sfmv" ON public.schedule_of_market_values FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow public select accountable_forms" ON public.accountable_forms FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow authenticated all accountable_forms" ON public.accountable_forms FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow public select payments" ON public.payment_postings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow authenticated all payments" ON public.payment_postings FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated all audit_logs" ON public.rptar_audit_logs FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow anon and auth insert security logs" ON public.security_audit_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated read security logs" ON public.security_audit_logs FOR SELECT TO authenticated USING (true);

NOTIFY pgrst, 'reload schema';
