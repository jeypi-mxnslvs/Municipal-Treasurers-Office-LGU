-- Controlled property retirement. Records remain retained for audit and history.

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS disposition TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS disposition_reason TEXT,
  ADD COLUMN IF NOT EXISTS disposition_authorized_by TEXT,
  ADD COLUMN IF NOT EXISTS disposition_at TIMESTAMPTZ;

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_disposition_check;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_disposition_check
  CHECK (disposition IN ('ACTIVE', 'SAMPLE_RECORD', 'VOIDED', 'CANCELLED', 'SUPERSEDED', 'ARCHIVED'));

CREATE INDEX IF NOT EXISTS idx_properties_disposition
  ON public.properties(disposition);

CREATE OR REPLACE FUNCTION public.archive_property(
  p_property_id BIGINT,
  p_reason TEXT,
  p_authorized_by TEXT,
  p_authorized_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_property properties%ROWTYPE;
BEGIN
  IF p_authorized_role <> 'Admin' THEN
    RAISE EXCEPTION 'Only System Admin may archive property records';
  END IF;
  IF NULLIF(trim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Archive reason is required';
  END IF;

  SELECT * INTO v_property FROM properties WHERE id = p_property_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Property record % not found', p_property_id;
  END IF;
  IF v_property.disposition <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Property record % is already non-active', v_property.td_number;
  END IF;

  UPDATE properties
  SET disposition = 'ARCHIVED',
      disposition_reason = trim(p_reason),
      disposition_authorized_by = trim(p_authorized_by),
      disposition_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  WHERE id = p_property_id;

  INSERT INTO rptar_audit_logs (
    property_id, td_number, action_type, assessor_name, details, timestamp
  ) VALUES (
    v_property.id, v_property.td_number, 'ARCHIVED', trim(p_authorized_by),
    format('Archived property record %s. Reason: %s', v_property.td_number, trim(p_reason)), timezone('utc', now())
  );

  RETURN jsonb_build_object('id', v_property.id, 'td_number', v_property.td_number, 'disposition', 'ARCHIVED');
END;
$$;

GRANT EXECUTE ON FUNCTION public.archive_property(BIGINT, TEXT, TEXT, TEXT)
  TO anon, authenticated, service_role, postgres;

NOTIFY pgrst, 'reload schema';
