-- Phase 1 forward migration: bind archival authority to Supabase Auth claims.

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
  v_property public.properties%ROWTYPE;
  v_actor_name TEXT;
BEGIN
  IF auth.uid() IS NULL OR public.current_app_role() <> 'Admin' THEN
    RAISE EXCEPTION 'Only an authenticated Admin may archive property records';
  END IF;

  v_actor_name := auth.uid()::text;

  IF NULLIF(trim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Archive reason is required';
  END IF;

  SELECT * INTO v_property
    FROM public.properties
   WHERE id = p_property_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Property record % not found', p_property_id;
  END IF;
  IF v_property.disposition <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Property record % is already non-active', v_property.td_number;
  END IF;

  UPDATE public.properties
     SET disposition = 'ARCHIVED',
         disposition_reason = trim(p_reason),
         disposition_authorized_by = v_actor_name,
         disposition_at = timezone('utc', now()),
         updated_at = timezone('utc', now())
   WHERE id = p_property_id;

  INSERT INTO public.rptar_audit_logs (
    property_id, td_number, action_type, assessor_name, details, timestamp
  ) VALUES (
    v_property.id, v_property.td_number, 'ARCHIVED', v_actor_name,
    format('Archived property record %s. Reason: %s', v_property.td_number, trim(p_reason)), timezone('utc', now())
  );

  RETURN jsonb_build_object('id', v_property.id, 'td_number', v_property.td_number, 'disposition', 'ARCHIVED');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.archive_property(BIGINT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_property(BIGINT, TEXT, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
