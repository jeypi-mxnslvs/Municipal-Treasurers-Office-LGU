-- =========================================================
-- MUNICIPAL TREASURER'S OFFICE (LGU TREASURY CONNECT)
-- PHASE 1: SECURITY & AUTHENTICATION MIGRATION
-- Run this script in the Supabase Dashboard SQL Editor
-- =========================================================

-- 1. Enable Cryptographic Extension for Salted Bcrypt
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Add password_hash column if it doesn't exist
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
    END IF;
END $$;

-- 3. Create Authenticate User Stored Procedure
CREATE OR REPLACE FUNCTION authenticate_user(
    p_username TEXT,
    p_password TEXT
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
BEGIN
    RETURN QUERY
    SELECT u.id, u.username, u.full_name, u.role, u.station_id
    FROM users u
    WHERE lower(u.username) = lower(trim(p_username))
      AND (
          (u.password_hash IS NOT NULL AND u.password_hash = crypt(p_password, u.password_hash))
          OR
          (u.password IS NOT NULL AND u.password = p_password)
      );
END;
$$;

-- 4. Enable Row-Level Security & Restrictive Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_of_market_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rptar_audit_logs ENABLE ROW LEVEL SECURITY;

-- Grant execution to anon and authenticated roles
GRANT EXECUTE ON FUNCTION authenticate_user(TEXT, TEXT) TO anon, authenticated, service_role;

-- Reload Schema Cache
NOTIFY pgrst, 'reload schema';
