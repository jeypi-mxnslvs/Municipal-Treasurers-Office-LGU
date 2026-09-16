-- =========================================================
-- MUNICIPAL TREASURER'S OFFICE (LGU TREASURY CONNECT)
-- PHASE 1: SECURITY & AUTHENTICATION MIGRATION
-- Run this script in the Supabase Dashboard SQL Editor
-- =========================================================

-- 1. Enable Cryptographic Extension for Salted Bcrypt
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Add password_hash column if it doesn't exist and backfill
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'password_hash'
    ) THEN
        ALTER TABLE public.users ADD COLUMN password_hash TEXT;
        
        -- Migrate any existing plaintext passwords to Bcrypt hashes
        UPDATE public.users 
        SET password_hash = crypt(COALESCE(password, 'admin123'), gen_salt('bf', 10))
        WHERE password_hash IS NULL;
        
        ALTER TABLE public.users ALTER COLUMN password_hash SET NOT NULL;
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'password'
        ) THEN
            ALTER TABLE public.users ALTER COLUMN password DROP NOT NULL;
        END IF;
    END IF;
END $$;

-- 3. Immutable Security Audit Log Table
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
    id SERIAL PRIMARY KEY,
    event_type TEXT NOT NULL, -- 'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'USER_CREATED', 'ROLE_CHANGED', 'PASSWORD_RESET', 'USER_DELETED', 'ACCESS_DENIED'
    username TEXT NOT NULL,
    user_id INT,
    station_id TEXT,
    ip_address TEXT,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 4. Trigger for Automatic Bcrypt Hashing on Insert or Password Update
CREATE OR REPLACE FUNCTION trg_hash_user_password()
RETURNS TRIGGER AS $$
BEGIN
    -- Hash new password_hash if not already a valid Bcrypt hash
    IF NEW.password_hash IS NOT NULL AND NEW.password_hash NOT LIKE '$2%' THEN
        NEW.password_hash := crypt(NEW.password_hash, gen_salt('bf', 10));
    END IF;

    -- If legacy password column exists, hash it and clear plaintext
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'password'
    ) THEN
        IF NEW.password IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.password IS DISTINCT FROM OLD.password) THEN
            NEW.password_hash := crypt(NEW.password, gen_salt('bf', 10));
            IF (SELECT is_nullable FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password') = 'YES' THEN
                NEW.password := NULL;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_hash_password ON public.users;
CREATE TRIGGER trg_users_hash_password
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION trg_hash_user_password();

-- 5. Create Authenticate User Stored Procedure with Security Audit Logging
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

    IF v_user.id IS NOT NULL AND (
        (v_user.password_hash IS NOT NULL AND v_user.password_hash = crypt(p_password, v_user.password_hash))
        OR
        (v_user.password IS NOT NULL AND v_user.password = p_password)
    ) THEN
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

-- 6. Enable Row-Level Security & Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_of_market_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rptar_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Security audit logs policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'security_audit_logs' AND policyname = 'Allow anon and auth insert security logs'
    ) THEN
        CREATE POLICY "Allow anon and auth insert security logs" 
            ON public.security_audit_logs FOR INSERT 
            TO anon, authenticated WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'security_audit_logs' AND policyname = 'Allow authenticated read security logs'
    ) THEN
        CREATE POLICY "Allow authenticated read security logs" 
            ON public.security_audit_logs FOR SELECT 
            TO authenticated USING (true);
    END IF;
END $$;

-- Grant execution to anon and authenticated roles
GRANT EXECUTE ON FUNCTION authenticate_user(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- Reload Schema Cache
NOTIFY pgrst, 'reload schema';
