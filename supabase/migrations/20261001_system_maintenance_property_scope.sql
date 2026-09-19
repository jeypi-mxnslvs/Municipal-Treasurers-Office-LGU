-- Extend maintenance purge to explicitly selected property IDs, including legacy/unlinked rows.

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS test_data_classified BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.classify_test_properties(
  p_property_ids BIGINT[], p_reason TEXT, p_authorized_by TEXT,
  p_authorized_role TEXT, p_approval_reference TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INT;
BEGIN
  IF p_authorized_role <> 'SystemMaintenance' THEN RAISE EXCEPTION 'Only System Maintenance may classify test data'; END IF;
  IF p_property_ids IS NULL OR cardinality(p_property_ids) = 0
     OR NULLIF(trim(p_reason), '') IS NULL OR NULLIF(trim(p_approval_reference), '') IS NULL THEN
    RAISE EXCEPTION 'Property selection, reason, and Treasurer approval reference are required';
  END IF;
  UPDATE properties
  SET test_data_classified = TRUE
  WHERE id = ANY(p_property_ids) AND disposition = 'ACTIVE' AND test_data_classified = FALSE;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> cardinality(p_property_ids) THEN
    RAISE EXCEPTION 'One or more selected records are missing, inactive, or already classified';
  END IF;
  INSERT INTO security_audit_logs (event_type, username, station_id, details)
  VALUES ('SYSTEM_MAINTENANCE_CLASSIFY_TEST', trim(p_authorized_by), 'SystemMaintenance',
    format('Classified property IDs=%s as test data. Approval=%s Reason=%s',
      array_to_string(p_property_ids, ','), trim(p_approval_reference), trim(p_reason)));
  RETURN jsonb_build_object('propertyIds', p_property_ids, 'classifiedCount', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.classify_test_properties(BIGINT[], TEXT, TEXT, TEXT, TEXT)
  TO anon, authenticated, service_role, postgres;

DROP FUNCTION IF EXISTS public.purge_sample_masterlist(BIGINT[], TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.purge_sample_masterlist(
  p_property_ids BIGINT[], p_confirmation TEXT, p_reason TEXT,
  p_authorized_by TEXT, p_authorized_role TEXT, p_approval_reference TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_property_count INT;
  v_deleted_properties INT;
  v_deleted_verifications INT;
  v_deleted_outcomes INT;
  v_batch_ids BIGINT[];
  v_td_numbers TEXT[];
BEGIN
  IF p_confirmation <> 'CONFIRM-PURGE-MASTERLIST' THEN RAISE EXCEPTION 'Exact purge confirmation phrase is required'; END IF;
  IF p_authorized_role <> 'SystemMaintenance' THEN RAISE EXCEPTION 'Only System Maintenance may purge test data'; END IF;
  IF p_property_ids IS NULL OR cardinality(p_property_ids) = 0 THEN RAISE EXCEPTION 'At least one classified property is required'; END IF;
  IF NULLIF(trim(p_reason), '') IS NULL OR NULLIF(trim(p_authorized_by), '') IS NULL
     OR NULLIF(trim(p_approval_reference), '') IS NULL THEN
    RAISE EXCEPTION 'Purge reason, operator, and Treasurer approval reference are required';
  END IF;

  SELECT count(*) INTO v_property_count
  FROM properties
  WHERE id = ANY(p_property_ids) AND disposition = 'ACTIVE' AND test_data_classified = TRUE;
  IF v_property_count <> cardinality(p_property_ids) THEN
    RAISE EXCEPTION 'Purge scope contains missing, inactive, or unclassified properties';
  END IF;

  SELECT coalesce(array_agg(import_batch_id) FILTER (WHERE import_batch_id IS NOT NULL), '{}'::BIGINT[]),
         coalesce(array_agg(td_number), '{}'::TEXT[])
    INTO v_batch_ids, v_td_numbers
  FROM properties WHERE id = ANY(p_property_ids);

  DELETE FROM delinquency_period_verifications v USING properties p
    WHERE v.property_id = p.id AND p.id = ANY(p_property_ids);
  GET DIAGNOSTICS v_deleted_verifications = ROW_COUNT;

  DELETE FROM csv_import_row_outcomes
    WHERE td_number = ANY(v_td_numbers) OR batch_id = ANY(v_batch_ids);
  GET DIAGNOSTICS v_deleted_outcomes = ROW_COUNT;

  UPDATE csv_import_batches
  SET status = 'REJECTED', completed_at = timezone('utc', now())
  WHERE id = ANY(v_batch_ids);

  DELETE FROM properties WHERE id = ANY(p_property_ids);
  GET DIAGNOSTICS v_deleted_properties = ROW_COUNT;

  INSERT INTO security_audit_logs (event_type, username, station_id, details)
  VALUES ('SYSTEM_MAINTENANCE_PURGE', trim(p_authorized_by), 'SystemMaintenance',
    format('Purged property IDs=%s Properties=%s Verifications=%s RowOutcomes=%s Approval=%s Reason=%s',
      array_to_string(p_property_ids, ','), v_deleted_properties, v_deleted_verifications,
      v_deleted_outcomes, trim(p_approval_reference), trim(p_reason)));

  RETURN jsonb_build_object(
    'propertyIds', p_property_ids,
    'propertyCount', v_deleted_properties,
    'verificationCount', v_deleted_verifications,
    'rowOutcomeCount', v_deleted_outcomes,
    'protectedTables', jsonb_build_array('users', 'schedule_of_market_values',
      'computation_schedule_versions', 'security_audit_logs', 'rptar_audit_logs')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_sample_masterlist(BIGINT[], TEXT, TEXT, TEXT, TEXT, TEXT)
  TO anon, authenticated, service_role, postgres;

NOTIFY pgrst, 'reload schema';
