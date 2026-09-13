-- =========================================================
-- MUNICIPAL TREASURER'S OFFICE (LGU TREASURY CONNECT)
-- PHASE 2: FINANCIAL TRANSACTION ATOMICITY & COA COMPLIANCE
-- Run this script in the Supabase Dashboard SQL Editor
-- =========================================================

-- 1. Create Accountable Form 51 Booklet Register Table
CREATE TABLE IF NOT EXISTS public.accountable_forms (
    id SERIAL PRIMARY KEY,
    booklet_id TEXT UNIQUE NOT NULL,
    form_type TEXT NOT NULL DEFAULT 'AF-51',
    series_start INT NOT NULL,
    series_end INT NOT NULL,
    current_serial INT NOT NULL,
    assigned_to_user_id INT REFERENCES public.users(id) ON DELETE SET NULL,
    assigned_to_username TEXT,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'EXHAUSTED', 'REVOKED')) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 2. Enhance Payment Postings Table for COA Compliance & Voiding
ALTER TABLE public.payment_postings 
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('ISSUED', 'VOIDED')),
    ADD COLUMN IF NOT EXISTS void_reason TEXT,
    ADD COLUMN IF NOT EXISTS voided_by TEXT,
    ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS previous_last_paid_year INT,
    ADD COLUMN IF NOT EXISTS booklet_id TEXT REFERENCES public.accountable_forms(booklet_id);

-- 3. Seed Default AF-51 Booklets (50 Receipts per standard LGU stub)
INSERT INTO public.accountable_forms (booklet_id, form_type, series_start, series_end, current_serial, assigned_to_username, status)
VALUES 
    ('AF51-BK-2026-001', 'AF-51', 4500001, 4500050, 4500001, 'juan.assessor', 'ACTIVE'),
    ('AF51-BK-2026-002', 'AF-51', 4500051, 4500100, 4500051, 'admin', 'ACTIVE')
ON CONFLICT (booklet_id) DO NOTHING;

-- 4. Atomic Payment Processing Stored Procedure
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
        -- Fallback to any active booklet
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

-- 5. Official Receipt Void / Cancellation Stored Procedure (COA Protocol)
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

-- 6. Enable Row Level Security & Permissions
ALTER TABLE public.accountable_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select accountable_forms" 
    ON public.accountable_forms FOR SELECT 
    TO anon, authenticated USING (true);

CREATE POLICY "Allow authenticated modify accountable_forms" 
    ON public.accountable_forms FOR ALL 
    TO authenticated USING (true);

-- Grant RPC execution
GRANT EXECUTE ON FUNCTION process_rpt_payment(INT, JSONB, NUMERIC, TEXT, TEXT, TEXT, TEXT, INT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION void_official_receipt(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- Reload Schema Cache
NOTIFY pgrst, 'reload schema';
