-- Hardening migration: native Supabase Auth boundary and role-based RLS.
-- Payment/collection behavior intentionally unchanged; access only is restricted.

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users
  WHERE lower(username) = lower(COALESCE(auth.jwt() ->> 'email', ''))
     OR (lower(COALESCE(auth.jwt() ->> 'email', '')) = 'admin@example.com' AND lower(username) = 'admin')
  LIMIT 1
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
DO $$
BEGIN
  IF to_regprocedure('public.process_rpt_payment(integer,jsonb,numeric,text,text,text,text,integer)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.process_rpt_payment(INT, JSONB, NUMERIC, TEXT, TEXT, TEXT, TEXT, INT) FROM anon;
  END IF;
  IF to_regprocedure('public.void_official_receipt(text,text,text,text)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.void_official_receipt(TEXT, TEXT, TEXT, TEXT) FROM anon;
  END IF;
  IF to_regprocedure('public.batch_upsert_properties(jsonb)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.batch_upsert_properties(JSONB) FROM anon;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;

DROP POLICY IF EXISTS "Allow public select properties" ON public.properties;
DROP POLICY IF EXISTS "Allow authenticated modify properties" ON public.properties;
DROP POLICY IF EXISTS "Allow public select sfmv" ON public.schedule_of_market_values;
DROP POLICY IF EXISTS "Allow authenticated all sfmv" ON public.schedule_of_market_values;
DROP POLICY IF EXISTS "Allow public select accountable_forms" ON public.accountable_forms;
DROP POLICY IF EXISTS "Allow authenticated all accountable_forms" ON public.accountable_forms;
DROP POLICY IF EXISTS "Allow public select payments" ON public.payment_postings;
DROP POLICY IF EXISTS "Allow authenticated all payments" ON public.payment_postings;
DROP POLICY IF EXISTS "Allow authenticated all audit_logs" ON public.rptar_audit_logs;
DROP POLICY IF EXISTS "Allow anon and auth insert security logs" ON public.security_audit_logs;
DROP POLICY IF EXISTS "Allow authenticated read security logs" ON public.security_audit_logs;
DROP POLICY IF EXISTS "Allow all on municipal_tax_settings" ON public.municipal_tax_settings;
DROP POLICY IF EXISTS "Allow all on csv_import_batches" ON public.csv_import_batches;
DROP POLICY IF EXISTS "Allow authenticated read users" ON public.users;

CREATE POLICY "Authenticated users read properties"
  ON public.properties FOR SELECT TO authenticated USING (true);
CREATE POLICY "Assessors manage properties"
  ON public.properties FOR INSERT TO authenticated
  WITH CHECK (public.current_app_role() IN ('Admin', 'Assessor'));
CREATE POLICY "Assessors update properties"
  ON public.properties FOR UPDATE TO authenticated
  USING (public.current_app_role() IN ('Admin', 'Assessor'))
  WITH CHECK (public.current_app_role() IN ('Admin', 'Assessor'));
CREATE POLICY "Admins delete properties"
  ON public.properties FOR DELETE TO authenticated
  USING (public.current_app_role() = 'Admin');

CREATE POLICY "Authenticated users read sfmv"
  ON public.schedule_of_market_values FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage sfmv"
  ON public.schedule_of_market_values FOR ALL TO authenticated
  USING (public.current_app_role() = 'Admin')
  WITH CHECK (public.current_app_role() = 'Admin');

CREATE POLICY "Users read own profile"
  ON public.users FOR SELECT TO authenticated
  USING (lower(username) = lower(COALESCE(auth.jwt() ->> 'email', '')) OR public.current_app_role() = 'Admin');
CREATE POLICY "Admins manage users"
  ON public.users FOR ALL TO authenticated
  USING (public.current_app_role() = 'Admin')
  WITH CHECK (public.current_app_role() = 'Admin');

CREATE POLICY "Admins manage accountable forms"
  ON public.accountable_forms FOR ALL TO authenticated
  USING (public.current_app_role() = 'Admin')
  WITH CHECK (public.current_app_role() = 'Admin');
CREATE POLICY "Authorized users read accountable forms"
  ON public.accountable_forms FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authorized users read payments"
  ON public.payment_postings FOR SELECT TO authenticated USING (true);
CREATE POLICY "No direct payment mutations"
  ON public.payment_postings FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Assessors and admins read RPTAR audit"
  ON public.rptar_audit_logs FOR SELECT TO authenticated
  USING (public.current_app_role() IN ('Admin', 'Assessor'));
CREATE POLICY "Authenticated append RPTAR audit"
  ON public.rptar_audit_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admins read security audit"
  ON public.security_audit_logs FOR SELECT TO authenticated
  USING (public.current_app_role() = 'Admin');
CREATE POLICY "Authenticated append security audit"
  ON public.security_audit_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated read tax settings"
  ON public.municipal_tax_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage tax settings"
  ON public.municipal_tax_settings FOR ALL TO authenticated
  USING (public.current_app_role() = 'Admin')
  WITH CHECK (public.current_app_role() = 'Admin');

CREATE POLICY "Authorized users read import batches"
  ON public.csv_import_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Assessors and admins manage import batches"
  ON public.csv_import_batches FOR INSERT TO authenticated
  WITH CHECK (public.current_app_role() IN ('Admin', 'Assessor'));

REVOKE UPDATE, DELETE ON public.rptar_audit_logs FROM authenticated;
REVOKE UPDATE, DELETE ON public.security_audit_logs FROM authenticated;
DO $$
BEGIN
  IF to_regprocedure('public.authenticate_user(text,text,text)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.authenticate_user(TEXT, TEXT, TEXT) FROM anon, authenticated;
  END IF;
  IF to_regprocedure('public.process_rpt_payment(integer,jsonb,numeric,text,text,text,text,integer)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.process_rpt_payment(INT, JSONB, NUMERIC, TEXT, TEXT, TEXT, TEXT, INT) TO authenticated;
  END IF;
  IF to_regprocedure('public.void_official_receipt(text,text,text,text)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.void_official_receipt(TEXT, TEXT, TEXT, TEXT) TO authenticated;
  END IF;
  IF to_regprocedure('public.batch_upsert_properties(jsonb)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.batch_upsert_properties(JSONB) TO authenticated;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
