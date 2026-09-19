-- System Maintenance test-masterlist purge with explicit batch allowlist.

ALTER TABLE public.csv_import_batches
  ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_csv_import_batches_test_data
  ON public.csv_import_batches(is_test_data);

CREATE OR REPLACE FUNCTION public.classify_test_import_batches(
  p_batch_ids BIGINT[], p_reason TEXT, p_authorized_by TEXT, p_authorized_role TEXT, p_approval_reference TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INT;
BEGIN
  IF p_authorized_role <> 'SystemMaintenance' THEN RAISE EXCEPTION 'Only System Maintenance may classify test data'; END IF;
  IF p_batch_ids IS NULL OR cardinality(p_batch_ids) = 0 OR NULLIF(trim(p_reason), '') IS NULL OR NULLIF(trim(p_approval_reference), '') IS NULL THEN
    RAISE EXCEPTION 'Batch selection, reason, and Treasurer approval reference are required';
  END IF;
  UPDATE csv_import_batches SET is_test_data = TRUE WHERE id = ANY(p_batch_ids) AND is_test_data = FALSE;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> cardinality(p_batch_ids) THEN RAISE EXCEPTION 'One or more selected batches are missing or already classified'; END IF;
  INSERT INTO security_audit_logs (event_type, username, station_id, details)
  VALUES ('SYSTEM_MAINTENANCE_CLASSIFY_TEST', trim(p_authorized_by), 'SystemMaintenance', format('Classified batches=%s as test data. Approval=%s Reason=%s', array_to_string(p_batch_ids, ','), trim(p_approval_reference), trim(p_reason)));
  RETURN jsonb_build_object('batchIds', p_batch_ids, 'classifiedCount', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.classify_test_import_batches(BIGINT[], TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role, postgres;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('Admin', 'Assessor', 'SystemMaintenance'));

INSERT INTO public.users (username, password_hash, full_name, role, station_id)
VALUES ('maintenance@example.com', extensions.crypt('maintenance123', extensions.gen_salt('bf', 10)), 'IT / System Maintenance', 'SystemMaintenance', 'MIS-Desk')
ON CONFLICT (username) DO NOTHING;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS import_batch_id BIGINT REFERENCES public.csv_import_batches(id);

CREATE INDEX IF NOT EXISTS idx_properties_import_batch_id
  ON public.properties(import_batch_id);

CREATE OR REPLACE FUNCTION public.purge_sample_masterlist(
  p_batch_ids BIGINT[], p_confirmation TEXT, p_reason TEXT,
  p_authorized_by TEXT, p_authorized_role TEXT, p_approval_reference TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_batch_count INT; v_deleted_properties INT; v_deleted_verifications INT; v_deleted_outcomes INT;
BEGIN
  IF p_confirmation <> 'CONFIRM-PURGE-MASTERLIST' THEN RAISE EXCEPTION 'Exact purge confirmation phrase is required'; END IF;
  IF p_authorized_role <> 'SystemMaintenance' THEN RAISE EXCEPTION 'Only System Maintenance may purge test data'; END IF;
  IF p_batch_ids IS NULL OR cardinality(p_batch_ids) = 0 THEN RAISE EXCEPTION 'At least one import batch is required'; END IF;
  IF NULLIF(trim(p_reason), '') IS NULL OR NULLIF(trim(p_authorized_by), '') IS NULL OR NULLIF(trim(p_approval_reference), '') IS NULL THEN
    RAISE EXCEPTION 'Purge reason, operator, and Treasurer approval reference are required';
  END IF;
  SELECT count(*) INTO v_batch_count FROM csv_import_batches WHERE id = ANY(p_batch_ids) AND is_test_data = TRUE;
  IF v_batch_count <> cardinality(p_batch_ids) THEN RAISE EXCEPTION 'Purge scope contains missing or non-test import batches'; END IF;

  DELETE FROM delinquency_period_verifications v USING properties p
    WHERE v.property_id = p.id AND (p.import_batch_id = ANY(p_batch_ids) OR EXISTS (
      SELECT 1 FROM csv_import_row_outcomes o WHERE o.batch_id = ANY(p_batch_ids) AND o.td_number = p.td_number
    ));
  GET DIAGNOSTICS v_deleted_verifications = ROW_COUNT;
  DELETE FROM csv_import_row_outcomes WHERE batch_id = ANY(p_batch_ids);
  GET DIAGNOSTICS v_deleted_outcomes = ROW_COUNT;
  DELETE FROM properties p WHERE p.import_batch_id = ANY(p_batch_ids) OR EXISTS (
    SELECT 1 FROM csv_import_row_outcomes o WHERE o.batch_id = ANY(p_batch_ids) AND o.td_number = p.td_number
  );
  GET DIAGNOSTICS v_deleted_properties = ROW_COUNT;
  UPDATE csv_import_batches SET status = 'REJECTED', completed_at = timezone('utc', now()) WHERE id = ANY(p_batch_ids);

  INSERT INTO security_audit_logs (event_type, username, station_id, details)
  VALUES ('SYSTEM_MAINTENANCE_PURGE', trim(p_authorized_by), 'SystemMaintenance',
    format('Purged test masterlist. Batches=%s Properties=%s Verifications=%s RowOutcomes=%s Approval=%s Reason=%s',
      array_to_string(p_batch_ids, ','), v_deleted_properties, v_deleted_verifications, v_deleted_outcomes,
      trim(p_approval_reference), trim(p_reason)));
  RETURN jsonb_build_object('batchIds', p_batch_ids, 'propertyCount', v_deleted_properties,
    'verificationCount', v_deleted_verifications, 'rowOutcomeCount', v_deleted_outcomes,
    'protectedTables', jsonb_build_array('users', 'schedule_of_market_values', 'computation_schedule_versions', 'security_audit_logs', 'rptar_audit_logs'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_sample_masterlist(BIGINT[], TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role, postgres;
NOTIFY pgrst, 'reload schema';
