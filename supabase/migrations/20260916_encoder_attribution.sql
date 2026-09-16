-- =========================================================
-- MUNICIPAL TREASURER'S OFFICE (LGU TREASURY CONNECT)
-- MIGRATION: ASSESSOR PROVENANCE ATTRIBUTION & MANUAL ENCODING PRIORITY
-- =========================================================

-- 1. Add provenance attribution and entry type columns to properties table
ALTER TABLE public.properties
    ADD COLUMN IF NOT EXISTS encoder_label TEXT,
    ADD COLUMN IF NOT EXISTS entry_type TEXT DEFAULT 'CSV_IMPORT';

-- 2. Create index on entry_type for instant #1 priority sorting
CREATE INDEX IF NOT EXISTS idx_properties_entry_type ON public.properties(entry_type);

-- 3. Relax legacy NOT NULL constraint on users.password if column exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'password'
    ) THEN
        ALTER TABLE public.users ALTER COLUMN password DROP NOT NULL;
    END IF;
END $$;

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
