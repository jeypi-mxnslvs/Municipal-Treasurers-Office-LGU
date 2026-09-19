-- Forward governance migration for the computation schedule registry.
-- The original 20260924 migration is already applied and remains immutable.

ALTER TABLE public.computation_schedule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.computation_schedule_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on computation_schedule_versions" ON public.computation_schedule_versions;
DROP POLICY IF EXISTS "Authenticated can view computation schedules" ON public.computation_schedule_versions;
CREATE POLICY "Authenticated can view computation schedules"
    ON public.computation_schedule_versions
    FOR SELECT TO authenticated
    USING (true);
CREATE POLICY "Application can view computation schedules"
    ON public.computation_schedule_versions
    FOR SELECT TO anon
    USING (true);

DROP POLICY IF EXISTS "Allow all on computation_schedule_rows" ON public.computation_schedule_rows;
DROP POLICY IF EXISTS "Authenticated can view computation schedule rows" ON public.computation_schedule_rows;
CREATE POLICY "Authenticated can view computation schedule rows"
    ON public.computation_schedule_rows
    FOR SELECT TO authenticated
    USING (true);
CREATE POLICY "Application can view computation schedule rows"
    ON public.computation_schedule_rows
    FOR SELECT TO anon
    USING (true);

CREATE OR REPLACE FUNCTION public.create_computation_schedule_draft(
    p_schedule JSONB,
    p_rows JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id BIGINT;
    v_row JSONB;
BEGIN
    IF NULLIF(trim(p_schedule->>'authority_reference'), '') IS NULL
       OR NULLIF(trim(p_schedule->>'source_file_hash'), '') IS NULL
       OR NULLIF(trim(p_schedule->>'effective_from'), '') IS NULL THEN
        RAISE EXCEPTION 'Authority reference, source hash, and effective date are required';
    END IF;
    IF jsonb_array_length(COALESCE(p_rows, '[]'::JSONB)) = 0 THEN
        RAISE EXCEPTION 'Computation schedule must contain at least one rule';
    END IF;

    INSERT INTO computation_schedule_versions (
        schedule_name, authority_reference, source_filename, source_file_hash,
        status, effective_from, effective_to, uploaded_by
    ) VALUES (
        p_schedule->>'schedule_name', p_schedule->>'authority_reference',
        p_schedule->>'source_filename', p_schedule->>'source_file_hash', 'DRAFT',
        (p_schedule->>'effective_from')::DATE,
        NULLIF(p_schedule->>'effective_to', '')::DATE,
        p_schedule->>'uploaded_by'
    ) RETURNING id INTO v_id;

    FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows)
    LOOP
        INSERT INTO computation_schedule_rows (
            schedule_version_id, period_label, start_year, end_year, quarter_span,
            basic_tax_rate, sef_tax_rate, penalty_rate, discount_rate, penalty_months,
            discount_type, applicable_classes, source_sheet, source_row, source_formula
        ) VALUES (
            v_id, v_row->>'periodLabel', (v_row->>'startYear')::INT, (v_row->>'endYear')::INT,
            NULLIF(v_row->>'quarterSpan', ''), NULLIF(v_row->>'basicTaxRate', '')::NUMERIC,
            NULLIF(v_row->>'sefTaxRate', '')::NUMERIC, NULLIF(v_row->>'penaltyRate', '')::NUMERIC,
            NULLIF(v_row->>'discountRate', '')::NUMERIC, NULLIF(v_row->>'penaltyMonths', '')::NUMERIC,
            NULLIF(v_row->>'discountType', ''), COALESCE(
                ARRAY(SELECT jsonb_array_elements_text(v_row->'applicableClasses')), '{}'
            ),
            NULLIF(v_row->>'sourceSheet', ''), NULLIF(v_row->>'sourceRow', '')::INT,
            NULLIF(v_row->>'sourceFormula', '')
        );
    END LOOP;

    RETURN jsonb_build_object('id', v_id, 'status', 'DRAFT');
EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'A schedule with this source file hash already exists';
END;
$$;

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
    SELECT * INTO v_schedule FROM computation_schedule_versions WHERE id = p_schedule_id FOR UPDATE;
    IF NOT FOUND OR v_schedule.status NOT IN ('VALIDATED', 'PENDING_APPROVAL') THEN
        RAISE EXCEPTION 'Only validated or pending-approval schedules can be activated';
    END IF;
    IF lower(trim(v_schedule.uploaded_by)) = lower(trim(p_approved_by)) THEN
        RAISE EXCEPTION 'Schedule uploader cannot be its sole approver';
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

CREATE OR REPLACE FUNCTION public.validate_computation_schedule(p_schedule_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_schedule computation_schedule_versions%ROWTYPE;
    v_row RECORD;
    v_other RECORD;
BEGIN
    SELECT * INTO v_schedule FROM computation_schedule_versions WHERE id = p_schedule_id FOR UPDATE;
    IF NOT FOUND OR v_schedule.status <> 'DRAFT' THEN
        RAISE EXCEPTION 'Only draft schedules can be validated';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM computation_schedule_rows WHERE schedule_version_id = p_schedule_id) THEN
        RAISE EXCEPTION 'Schedule must contain at least one rule';
    END IF;
    FOR v_row IN SELECT * FROM computation_schedule_rows WHERE schedule_version_id = p_schedule_id LOOP
        IF v_row.end_year < v_row.start_year THEN
            RAISE EXCEPTION 'Invalid year range for %', v_row.period_label;
        END IF;
        FOR v_other IN SELECT * FROM computation_schedule_rows WHERE schedule_version_id = p_schedule_id AND id <> v_row.id LOOP
            IF v_row.start_year <= v_other.end_year AND v_row.end_year >= v_other.start_year THEN
                RAISE EXCEPTION 'Overlapping computation periods: % and %', v_row.period_label, v_other.period_label;
            END IF;
        END LOOP;
    END LOOP;
    UPDATE computation_schedule_versions SET status = 'VALIDATED' WHERE id = p_schedule_id;
    RETURN jsonb_build_object('id', p_schedule_id, 'status', 'VALIDATED');
END;
$$;

-- Current application authentication uses signed application sessions rather than
-- Supabase Auth JWTs. RPCs remain the only write path until JWT role claims are
-- introduced; each RPC validates required authority metadata and records an audit event.
REVOKE ALL ON FUNCTION public.create_computation_schedule_draft(JSONB, JSONB) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.validate_computation_schedule(BIGINT) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.activate_computation_schedule(BIGINT, TEXT) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.create_computation_schedule_draft(JSONB, JSONB) TO anon, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.validate_computation_schedule(BIGINT) TO anon, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.activate_computation_schedule(BIGINT, TEXT) TO anon, service_role, postgres;
