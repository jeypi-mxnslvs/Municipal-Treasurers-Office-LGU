-- Phase 1 forward-only containment of legacy public policies and routines.
-- Supabase Auth app_metadata.role is the sole browser role authority.

-- Old grants from the initial schema survive policy changes unless explicitly revoked.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- A signed JWT is necessary but insufficient once its Auth session is
-- revoked or reaches the eight-hour municipal limit.
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM auth.sessions s
    WHERE s.id = NULLIF(auth.jwt() ->> 'session_id', '')::uuid
      AND s.user_id = auth.uid()
      AND s.created_at > now() - interval '8 hours'
  ) THEN NULLIF(auth.jwt() -> 'app_metadata' ->> 'role', '') END;
$$;

-- Remove every old permissive policy, including policies added after 20261002.
DO $phase1$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.oid::regclass AS relation, p.polname
    FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('DROP POLICY %I ON %s', r.polname, r.relation);
  END LOOP;
  FOR r IN
    SELECT c.oid::regclass AS relation
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', r.relation);
  END LOOP;
END;
$phase1$;

-- The legacy users table contains password hashes. No browser may select it.
-- Staff identity and role come from Supabase Auth, not this legacy table.
GRANT SELECT ON public.properties, public.schedule_of_market_values,
  public.delinquency_period_verifications, public.delinquency_year_completions,
  public.rptar_audit_logs, public.municipal_tax_settings,
  public.csv_import_batches, public.csv_import_row_outcomes,
  public.computation_schedule_versions, public.computation_schedule_rows
  TO authenticated;
GRANT SELECT ON public.security_audit_logs TO authenticated;
GRANT INSERT, UPDATE ON public.properties, public.csv_import_batches,
  public.csv_import_row_outcomes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.schedule_of_market_values,
  public.municipal_tax_settings TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

DO $phase1$
DECLARE r record;
BEGIN
  FOR r IN SELECT unnest(ARRAY[
    'properties', 'schedule_of_market_values', 'delinquency_period_verifications',
    'delinquency_year_completions', 'rptar_audit_logs', 'municipal_tax_settings',
    'csv_import_batches', 'csv_import_row_outcomes',
    'computation_schedule_versions', 'computation_schedule_rows'
  ]) AS name LOOP
    EXECUTE format('CREATE POLICY phase1_read ON public.%I FOR SELECT TO authenticated USING (public.is_assessor_or_admin())', r.name);
  END LOOP;
  FOR r IN SELECT unnest(ARRAY['payment_postings', 'accountable_forms']) AS name LOOP
    IF to_regclass(format('public.%I', r.name)) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT ON public.%I TO authenticated', r.name);
      EXECUTE format('CREATE POLICY phase1_read ON public.%I FOR SELECT TO authenticated USING (public.is_assessor_or_admin())', r.name);
    END IF;
  END LOOP;
END;
$phase1$;

CREATE POLICY phase1_security_read ON public.security_audit_logs
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY phase1_property_insert ON public.properties
  FOR INSERT TO authenticated WITH CHECK (public.is_assessor_or_admin());
CREATE POLICY phase1_property_update ON public.properties
  FOR UPDATE TO authenticated USING (public.is_assessor_or_admin())
  WITH CHECK (public.is_assessor_or_admin());
CREATE POLICY phase1_import_batch_insert ON public.csv_import_batches
  FOR INSERT TO authenticated WITH CHECK (public.is_assessor_or_admin());
CREATE POLICY phase1_import_batch_update ON public.csv_import_batches
  FOR UPDATE TO authenticated USING (public.is_assessor_or_admin())
  WITH CHECK (public.is_assessor_or_admin());
CREATE POLICY phase1_import_outcome_insert ON public.csv_import_row_outcomes
  FOR INSERT TO authenticated WITH CHECK (public.is_assessor_or_admin());
CREATE POLICY phase1_import_outcome_update ON public.csv_import_row_outcomes
  FOR UPDATE TO authenticated USING (public.is_assessor_or_admin())
  WITH CHECK (public.is_assessor_or_admin());
CREATE POLICY phase1_sfmv_insert ON public.schedule_of_market_values
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY phase1_sfmv_update ON public.schedule_of_market_values
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY phase1_sfmv_delete ON public.schedule_of_market_values
  FOR DELETE TO authenticated USING (public.is_admin());
CREATE POLICY phase1_settings_insert ON public.municipal_tax_settings
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY phase1_settings_update ON public.municipal_tax_settings
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY phase1_settings_delete ON public.municipal_tax_settings
  FOR DELETE TO authenticated USING (public.is_admin());

-- Keep historical integer attribution but allow new Supabase Auth UUIDs.
ALTER TABLE public.delinquency_period_verifications
  DROP CONSTRAINT IF EXISTS delinquency_period_verifications_verified_by_fkey;
ALTER TABLE public.delinquency_period_verifications
  ALTER COLUMN verified_by TYPE text USING verified_by::text;

-- A direct table update cannot forge an archival or verification baseline.
-- Trusted RPCs run as their owner and remain responsible for these changes.
CREATE FUNCTION public.phase1_protect_property_state()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user = 'authenticated' AND (
    NEW.last_paid_year IS DISTINCT FROM OLD.last_paid_year OR
    NEW.last_paid_quarter IS DISTINCT FROM OLD.last_paid_quarter OR
    NEW.disposition IS DISTINCT FROM OLD.disposition OR
    NEW.disposition_reason IS DISTINCT FROM OLD.disposition_reason OR
    NEW.disposition_authorized_by IS DISTINCT FROM OLD.disposition_authorized_by OR
    NEW.disposition_at IS DISTINCT FROM OLD.disposition_at OR
    NEW.test_data_classified IS DISTINCT FROM OLD.test_data_classified
  ) THEN
    RAISE EXCEPTION 'Verification, archival and maintenance state requires an authorized RPC';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER phase1_protect_property_state
  BEFORE UPDATE ON public.properties FOR EACH ROW
  EXECUTE FUNCTION public.phase1_protect_property_state();

-- Record direct masterlist edits with a claim-derived actor, even though the
-- browser has no INSERT privilege on the audit table.
CREATE FUNCTION public.phase1_audit_property_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.rptar_audit_logs
    (property_id, td_number, action_type, assessor_name, details)
  VALUES
    (NEW.id, NEW.td_number, CASE WHEN TG_OP = 'INSERT' THEN 'CREATED' ELSE 'UPDATED' END,
     COALESCE(auth.uid()::text, current_user),
     format('Property %s %s', NEW.td_number, lower(TG_OP)));
  RETURN NEW;
END;
$$;
CREATE TRIGGER phase1_audit_property_mutation
  AFTER INSERT OR UPDATE ON public.properties FOR EACH ROW
  EXECUTE FUNCTION public.phase1_audit_property_mutation();

-- Legacy cash-collection, password, and maintenance RPCs remain unavailable
-- to browser roles. Only the following controlled workflows are exposed.
ALTER FUNCTION public.batch_upsert_properties(jsonb) RENAME TO batch_upsert_properties_legacy;
CREATE FUNCTION public.batch_upsert_properties(p_properties jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_assessor_or_admin() THEN
    RAISE EXCEPTION 'Assessor or Admin session required';
  END IF;
  RETURN public.batch_upsert_properties_legacy(p_properties);
END;
$$;

ALTER FUNCTION public.verify_delinquency_period_batch(int, text, jsonb, text, text, bigint, text, text)
  RENAME TO verify_delinquency_period_batch_legacy;
CREATE FUNCTION public.verify_delinquency_period_batch(
  p_property_id int, p_td_number text, p_periods jsonb,
  p_verified_by text, p_station_id text DEFAULT 'Verification-Desk',
  p_schedule_version_id bigint DEFAULT NULL, p_schedule_reference text DEFAULT NULL,
  p_schedule_source_hash text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_td_number text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_assessor_or_admin() THEN
    RAISE EXCEPTION 'Assessor or Admin session required';
  END IF;
  SELECT td_number INTO v_td_number FROM public.properties WHERE id = p_property_id;
  IF v_td_number IS NULL THEN RAISE EXCEPTION 'Property not found'; END IF;
  RETURN public.verify_delinquency_period_batch_legacy(
    p_property_id, v_td_number, p_periods, auth.uid()::text, p_station_id,
    p_schedule_version_id, p_schedule_reference, p_schedule_source_hash
  );
END;
$$;

ALTER FUNCTION public.create_computation_schedule_draft(jsonb, jsonb)
  RENAME TO create_computation_schedule_draft_legacy;
CREATE FUNCTION public.create_computation_schedule_draft(p_schedule jsonb, p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin session required';
  END IF;
  RETURN public.create_computation_schedule_draft_legacy(
    jsonb_set(p_schedule, '{uploaded_by}', to_jsonb(auth.uid()::text), true), p_rows
  );
END;
$$;

ALTER FUNCTION public.validate_computation_schedule(bigint)
  RENAME TO validate_computation_schedule_legacy;
CREATE FUNCTION public.validate_computation_schedule(p_schedule_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin session required';
  END IF;
  RETURN public.validate_computation_schedule_legacy(p_schedule_id);
END;
$$;

ALTER FUNCTION public.activate_computation_schedule(bigint, text)
  RENAME TO activate_computation_schedule_legacy;
CREATE FUNCTION public.activate_computation_schedule(p_schedule_id bigint, p_approved_by text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin session required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users
                 WHERE id = auth.uid() AND last_sign_in_at > now() - interval '5 minutes') THEN
    RAISE EXCEPTION 'Recent administrator password confirmation required';
  END IF;
  RETURN public.activate_computation_schedule_legacy(p_schedule_id, auth.uid()::text);
END;
$$;

ALTER FUNCTION public.archive_property(bigint, text, text, text)
  RENAME TO archive_property_legacy;
CREATE FUNCTION public.archive_property(
  p_property_id bigint, p_reason text, p_authorized_by text, p_authorized_role text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin session required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users
                 WHERE id = auth.uid() AND last_sign_in_at > now() - interval '5 minutes') THEN
    RAISE EXCEPTION 'Recent administrator password confirmation required';
  END IF;
  RETURN public.archive_property_legacy(p_property_id, p_reason, p_authorized_by, p_authorized_role);
END;
$$;

-- PostgreSQL grants EXECUTE to PUBLIC on new functions by default.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_app_role(), public.is_admin(),
  public.is_assessor_or_admin(), public.batch_upsert_properties(jsonb),
  public.verify_delinquency_period_batch(int, text, jsonb, text, text, bigint, text, text),
  public.create_computation_schedule_draft(jsonb, jsonb),
  public.validate_computation_schedule(bigint),
  public.activate_computation_schedule(bigint, text),
  public.archive_property(bigint, text, text, text)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
