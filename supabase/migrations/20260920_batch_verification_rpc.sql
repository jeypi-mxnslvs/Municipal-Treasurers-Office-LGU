-- Atomic delinquency verification batch.
-- Authentication/RLS hardening remains deferred by project decision.

ALTER TABLE public.delinquency_period_verifications
  ADD COLUMN IF NOT EXISTS evidence_type TEXT;

CREATE OR REPLACE FUNCTION public.verify_delinquency_period_batch(
  p_property_id INT,
  p_td_number TEXT,
  p_periods JSONB,
  p_verified_by TEXT,
  p_station_id TEXT DEFAULT 'Verification-Desk'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_property public.properties%ROWTYPE;
  v_item JSONB;
  v_status TEXT;
  v_source_reference TEXT;
  v_remarks TEXT;
  v_period_key TEXT;
  v_tax_year INT;
  v_period_label TEXT;
  v_verification_type TEXT;
  v_evidence_type TEXT;
  v_duplicate_key TEXT;
  v_inserted JSONB := '[]'::JSONB;
  v_last_paid_year INT;
  v_last_paid_quarter INT;
BEGIN
  IF jsonb_typeof(p_periods) <> 'array' OR jsonb_array_length(p_periods) = 0 THEN
    RAISE EXCEPTION 'Verification batch must contain at least one period';
  END IF;

  SELECT * INTO v_property
  FROM public.properties
  WHERE id = p_property_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Property % not found', p_property_id;
  END IF;

  IF v_property.is_shell_record OR NULLIF(BTRIM(COALESCE(v_property.pin, '')), '') IS NULL
     OR COALESCE(v_property.assessed_value, 0) <= 0 THEN
    RAISE EXCEPTION 'Shell records cannot be verified';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_periods)
  LOOP
    v_period_key := NULLIF(BTRIM(v_item->>'periodKey'), '');
    v_tax_year := NULLIF(v_item->>'taxYear', '')::INT;
    v_period_label := NULLIF(BTRIM(v_item->>'periodLabel'), '');
    v_status := v_item->>'status';
    v_verification_type := v_item->>'verificationType';
    v_evidence_type := NULLIF(BTRIM(v_item->>'evidenceType'), '');
    v_source_reference := NULLIF(BTRIM(v_item->>'sourceReference'), '');
    v_remarks := NULLIF(BTRIM(v_item->>'remarks'), '');

    IF v_period_key IS NULL OR v_period_label IS NULL OR v_tax_year IS NULL THEN
      RAISE EXCEPTION 'Each verification period requires periodKey, taxYear, and periodLabel';
    END IF;

    IF v_status NOT IN ('VERIFIED_SETTLED_EXTERNALLY', 'VERIFIED_OUTSTANDING', 'DISPUTED', 'NOT_APPLICABLE') THEN
      RAISE EXCEPTION 'Unsupported verification status: %', v_status;
    END IF;

    IF v_verification_type NOT IN ('ASSESSMENT', 'HISTORICAL_VALUATION', 'DELINQUENCY', 'EXTERNAL_SETTLEMENT_EVIDENCE') THEN
      RAISE EXCEPTION 'Unsupported verification type: %', v_verification_type;
    END IF;

    IF v_status = 'VERIFIED_SETTLED_EXTERNALLY' AND v_source_reference IS NULL THEN
      RAISE EXCEPTION 'External settlement requires sourceReference';
    END IF;

    IF v_status IN ('VERIFIED_OUTSTANDING', 'DISPUTED') AND v_source_reference IS NULL AND v_remarks IS NULL THEN
      RAISE EXCEPTION 'Outstanding or disputed verification requires sourceReference or remarks';
    END IF;

    IF v_item->>'verificationType' = 'EXTERNAL_SETTLEMENT_EVIDENCE' AND v_evidence_type IS NULL THEN
      RAISE EXCEPTION 'External settlement requires evidenceType';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_periods) prior
      WHERE prior <> v_item
        AND NULLIF(BTRIM(prior->>'periodKey'), '') = v_period_key
    ) THEN
      RAISE EXCEPTION 'Duplicate periodKey in verification batch: %', v_period_key;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.delinquency_period_verifications existing
      WHERE existing.property_id = p_property_id
        AND existing.period_key = v_period_key
        AND existing.status <> 'SUPERSEDED'
    ) THEN
      RAISE EXCEPTION 'Period already has an active verification: %', v_period_key;
    END IF;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_periods)
  LOOP
    INSERT INTO public.delinquency_period_verifications (
      property_id,
      td_number_snapshot,
      period_key,
      tax_year,
      period_label,
      status,
      verification_type,
      source_reference,
      remarks,
      verified_by,
      verified_at,
      station_id,
      evidence_type
    )
    VALUES (
      p_property_id,
      p_td_number,
      BTRIM(v_item->>'periodKey'),
      (v_item->>'taxYear')::INT,
      BTRIM(v_item->>'periodLabel'),
      v_item->>'status',
      v_item->>'verificationType',
      NULLIF(BTRIM(v_item->>'sourceReference'), ''),
      NULLIF(BTRIM(v_item->>'remarks'), ''),
      p_verified_by,
      timezone('utc', now()),
      COALESCE(NULLIF(BTRIM(p_station_id), ''), 'Verification-Desk'),
      NULLIF(BTRIM(v_item->>'evidenceType'), '')
    )
    RETURNING jsonb_build_object(
      'id', id,
      'propertyId', property_id,
      'tdNumberSnapshot', td_number_snapshot,
      'periodKey', period_key,
      'taxYear', tax_year,
      'periodLabel', period_label,
      'status', status,
      'verificationType', verification_type,
      'sourceReference', source_reference,
      'remarks', remarks,
      'verifiedBy', verified_by,
      'verifiedAt', verified_at,
      'stationId', station_id,
      'createdAt', created_at
    ) INTO v_item;

    v_inserted := v_inserted || jsonb_build_array(v_item);
  END LOOP;

  v_last_paid_year := v_property.last_paid_year;
  v_last_paid_quarter := v_property.last_paid_quarter;

  SELECT COALESCE(MAX(tax_year), v_last_paid_year)
  INTO v_last_paid_year
  FROM public.delinquency_period_verifications
  WHERE property_id = p_property_id
    AND status = 'VERIFIED_SETTLED_EXTERNALLY';

  UPDATE public.properties
  SET last_paid_year = GREATEST(last_paid_year, v_last_paid_year),
      updated_at = timezone('utc', now())
  WHERE id = p_property_id;

  INSERT INTO public.rptar_audit_logs (
    property_id, td_number, action_type, assessor_name, station_id, details
  ) VALUES (
    p_property_id,
    p_td_number,
    'VERIFICATION_BATCH',
    p_verified_by,
    COALESCE(NULLIF(BTRIM(p_station_id), ''), 'Verification-Desk'),
    format('Committed %s delinquency verification period(s)', jsonb_array_length(p_periods))
  );

  RETURN jsonb_build_object(
    'verifications', v_inserted,
    'propertyBaseline', jsonb_build_object(
      'lastPaidYear', v_last_paid_year,
      'lastPaidQuarter', v_last_paid_quarter
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_delinquency_period_batch(INT, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_delinquency_period_batch(INT, TEXT, JSONB, TEXT, TEXT) TO authenticated;
