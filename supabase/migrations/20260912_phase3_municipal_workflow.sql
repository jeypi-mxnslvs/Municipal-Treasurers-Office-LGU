-- =========================================================
-- MUNICIPAL TREASURER'S OFFICE (LGU TREASURY CONNECT)
-- PHASE 3: MUNICIPAL TAX POLICY, FIELD-LEVEL AUDIT & IMPORT BATCHES
-- =========================================================

-- 1. Municipal Tax Policy Settings Table (Configurable Discount Schedule)
CREATE TABLE IF NOT EXISTS public.municipal_tax_settings (
    id SERIAL PRIMARY KEY,
    early_payment_discount_rate NUMERIC NOT NULL DEFAULT 0.20,
    early_payment_start_month INT NOT NULL DEFAULT 1,
    early_payment_end_month INT NOT NULL DEFAULT 3,
    regular_prompt_discount_rate NUMERIC NOT NULL DEFAULT 0.10,
    delinquent_discount_rate NUMERIC NOT NULL DEFAULT 0.00,
    effective_year INT NOT NULL DEFAULT 2026,
    updated_by TEXT DEFAULT 'admin',
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Seed Default Santa Rosa Municipal Tax Policy (Jan-Mar 20%, Apr-Dec 10%, Delinquent 0%)
INSERT INTO public.municipal_tax_settings (
    early_payment_discount_rate,
    early_payment_start_month,
    early_payment_end_month,
    regular_prompt_discount_rate,
    delinquent_discount_rate,
    effective_year,
    updated_by
)
SELECT 0.20, 1, 3, 0.10, 0.00, 2026, 'System Administrator'
WHERE NOT EXISTS (SELECT 1 FROM public.municipal_tax_settings);

-- 2. Enhance Payment Postings Table for Complete Snapshot Preservation
ALTER TABLE public.payment_postings
    ADD COLUMN IF NOT EXISTS discount_rate NUMERIC DEFAULT 0.00;

-- 3. Enhance RPTAR Audit Logs for Field-Level Manual Overrides
ALTER TABLE public.rptar_audit_logs
    ADD COLUMN IF NOT EXISTS tax_year INT,
    ADD COLUMN IF NOT EXISTS field_changed TEXT,
    ADD COLUMN IF NOT EXISTS original_value NUMERIC,
    ADD COLUMN IF NOT EXISTS new_value NUMERIC,
    ADD COLUMN IF NOT EXISTS difference NUMERIC,
    ADD COLUMN IF NOT EXISTS reason TEXT,
    ADD COLUMN IF NOT EXISTS user_id INT,
    ADD COLUMN IF NOT EXISTS user_role TEXT;

-- 4. CSV Import Batches Table for Assessor Staging & Ingestion Tracking
CREATE TABLE IF NOT EXISTS public.csv_import_batches (
    id SERIAL PRIMARY KEY,
    batch_name TEXT NOT NULL,
    barangay TEXT NOT NULL,
    filename TEXT NOT NULL,
    total_rows INT NOT NULL DEFAULT 0,
    inserted_rows INT NOT NULL DEFAULT 0,
    updated_rows INT NOT NULL DEFAULT 0,
    unchanged_rows INT NOT NULL DEFAULT 0,
    imported_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 5. Row-Level Security Policies for Phase 3 Tables
ALTER TABLE public.municipal_tax_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csv_import_batches ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'municipal_tax_settings' AND policyname = 'Allow all on municipal_tax_settings'
    ) THEN
        CREATE POLICY "Allow all on municipal_tax_settings" ON public.municipal_tax_settings
            FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'csv_import_batches' AND policyname = 'Allow all on csv_import_batches'
    ) THEN
        CREATE POLICY "Allow all on csv_import_batches" ON public.csv_import_batches
            FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 6. Reload PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';
