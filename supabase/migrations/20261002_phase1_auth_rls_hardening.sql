-- Phase 1 forward migration: Supabase Auth, trusted claims, and least-privilege RLS.
-- Never edit previously applied migrations.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON FUNCTION public.authenticate_user(text, text, text) FROM anon, authenticated;
DROP FUNCTION IF EXISTS public.authenticate_user(text, text, text);

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> 'role', '');
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT public.current_app_role() = 'Admin';
$$;

CREATE OR REPLACE FUNCTION public.is_assessor_or_admin()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT public.current_app_role() IN ('Admin', 'Assessor');
$$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_of_market_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rptar_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous read access" ON public.users;
DROP POLICY IF EXISTS "Allow anon and auth insert security logs" ON public.security_audit_logs;
DROP POLICY IF EXISTS "Allow authenticated read security logs" ON public.security_audit_logs;
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.properties;
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.schedule_of_market_values;
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.rptar_audit_logs;

CREATE POLICY phase1_users_select ON public.users FOR SELECT TO authenticated
  USING (public.is_admin() OR id::text = auth.uid()::text);
CREATE POLICY phase1_users_admin_write ON public.users FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY phase1_properties_access ON public.properties FOR SELECT TO authenticated
  USING (public.is_assessor_or_admin());
CREATE POLICY phase1_properties_insert ON public.properties FOR INSERT TO authenticated
  WITH CHECK (public.is_assessor_or_admin());
CREATE POLICY phase1_properties_update ON public.properties FOR UPDATE TO authenticated
  USING (public.is_assessor_or_admin()) WITH CHECK (public.is_assessor_or_admin());
CREATE POLICY phase1_sfmv_access ON public.schedule_of_market_values FOR SELECT TO authenticated
  USING (public.is_assessor_or_admin());
CREATE POLICY phase1_sfmv_admin_write ON public.schedule_of_market_values FOR INSERT, UPDATE, DELETE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY phase1_audit_select ON public.rptar_audit_logs FOR SELECT TO authenticated
  USING (public.is_assessor_or_admin());
CREATE POLICY phase1_audit_no_delete ON public.rptar_audit_logs FOR DELETE TO authenticated
  USING (false);
CREATE POLICY phase1_security_audit_select ON public.security_audit_logs FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY phase1_security_audit_no_delete ON public.security_audit_logs FOR DELETE TO authenticated
  USING (false);

REVOKE INSERT, UPDATE, DELETE ON public.rptar_audit_logs FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.security_audit_logs FROM authenticated;
GRANT SELECT ON public.users, public.properties, public.schedule_of_market_values, public.rptar_audit_logs TO authenticated;
GRANT SELECT ON public.security_audit_logs TO authenticated;

NOTIFY pgrst, 'reload schema';
