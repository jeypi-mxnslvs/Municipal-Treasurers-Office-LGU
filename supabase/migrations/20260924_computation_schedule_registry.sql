-- Versioned computation schedule registry.
-- Stores approved policy inputs separately from RPTAR property imports.
-- Do not import spreadsheet formulas as executable logic.

CREATE TABLE IF NOT EXISTS public.computation_schedule_versions (
    id BIGSERIAL PRIMARY KEY,
    schedule_name TEXT NOT NULL,
    authority_reference TEXT NOT NULL,
    source_filename TEXT NOT NULL,
    source_file_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    effective_from DATE NOT NULL,
    effective_to DATE,
    uploaded_by TEXT NOT NULL,
    approved_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    activated_at TIMESTAMPTZ,
    CONSTRAINT computation_schedule_versions_status_check CHECK (status IN (
        'DRAFT', 'VALIDATED', 'PENDING_APPROVAL', 'ACTIVE', 'EXPIRED', 'SUPERSEDED'
    )),
    CONSTRAINT computation_schedule_versions_date_check CHECK (
        effective_to IS NULL OR effective_to >= effective_from
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_computation_schedule_source_hash
    ON public.computation_schedule_versions(source_file_hash);

CREATE INDEX IF NOT EXISTS idx_computation_schedule_effective_dates
    ON public.computation_schedule_versions(effective_from, effective_to);

CREATE TABLE IF NOT EXISTS public.computation_schedule_rows (
    id BIGSERIAL PRIMARY KEY,
    schedule_version_id BIGINT NOT NULL REFERENCES public.computation_schedule_versions(id) ON DELETE CASCADE,
    period_label TEXT NOT NULL,
    start_year INT NOT NULL,
    end_year INT NOT NULL,
    quarter_span TEXT,
    basic_tax_rate NUMERIC(12,8),
    sef_tax_rate NUMERIC(12,8),
    penalty_rate NUMERIC(12,8),
    discount_rate NUMERIC(12,8),
    penalty_months NUMERIC(12,4),
    discount_type TEXT,
    applicable_classes TEXT[] NOT NULL DEFAULT '{}',
    source_sheet TEXT,
    source_row INT,
    source_formula TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT computation_schedule_rows_year_check CHECK (end_year >= start_year),
    CONSTRAINT computation_schedule_rows_rate_check CHECK (
        (basic_tax_rate IS NULL OR basic_tax_rate >= 0) AND
        (sef_tax_rate IS NULL OR sef_tax_rate >= 0) AND
        (penalty_rate IS NULL OR penalty_rate >= 0) AND
        (discount_rate IS NULL OR discount_rate >= 0) AND
        (penalty_months IS NULL OR penalty_months >= 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_computation_schedule_rows_version
    ON public.computation_schedule_rows(schedule_version_id, start_year, end_year);

ALTER TABLE public.computation_schedule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.computation_schedule_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on computation_schedule_versions" ON public.computation_schedule_versions;
DROP POLICY IF EXISTS "Authenticated can view computation schedules" ON public.computation_schedule_versions;
CREATE POLICY "Authenticated can view computation schedules"
    ON public.computation_schedule_versions
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Allow all on computation_schedule_rows" ON public.computation_schedule_rows;
DROP POLICY IF EXISTS "Authenticated can view computation schedule rows" ON public.computation_schedule_rows;
CREATE POLICY "Authenticated can view computation schedule rows"
    ON public.computation_schedule_rows
    FOR SELECT TO authenticated
    USING (true);

NOTIFY pgrst, 'reload schema';

CREATE OR REPLACE FUNCTION public.activate_computation_schedule(
    p_schedule_id BIGINT,
    p_approved_by TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_schedule computation_schedule_versions%ROWTYPE;
BEGIN
    IF NULLIF(trim(p_approved_by), '') IS NULL THEN
        RAISE EXCEPTION 'Approver identity is required';
    END IF;
    SELECT * INTO v_schedule
    FROM computation_schedule_versions
    WHERE id = p_schedule_id
    FOR UPDATE;
    IF NOT FOUND OR v_schedule.status NOT IN ('DRAFT', 'VALIDATED', 'PENDING_APPROVAL') THEN
        RAISE EXCEPTION 'Only draft or validated schedules can be activated';
    END IF;
    UPDATE computation_schedule_versions
    SET status = 'SUPERSEDED'
    WHERE status = 'ACTIVE'
      AND effective_from <= COALESCE(v_schedule.effective_to, '9999-12-31'::DATE)
      AND COALESCE(effective_to, '9999-12-31'::DATE) >= v_schedule.effective_from;
    UPDATE computation_schedule_versions
    SET status = 'ACTIVE', approved_by = p_approved_by, activated_at = timezone('utc', now())
    WHERE id = p_schedule_id;
    INSERT INTO rptar_audit_logs (action_type, assessor_name, details)
    VALUES ('COMPUTATION_SCHEDULE_ACTIVATED', p_approved_by,
            format('Activated computation schedule %s (%s)', v_schedule.id, v_schedule.authority_reference));
    RETURN jsonb_build_object('id', p_schedule_id, 'status', 'ACTIVE', 'approvedBy', p_approved_by);
END;
$$;

REVOKE ALL ON FUNCTION public.activate_computation_schedule(BIGINT, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_computation_schedule(BIGINT, TEXT)
    TO service_role, postgres;
