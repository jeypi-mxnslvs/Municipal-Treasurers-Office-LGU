-- Phase 5: bounded, stable reads. SECURITY INVOKER preserves property RLS.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_properties_active_owner_id ON public.properties (disposition, owner_name, id);
CREATE INDEX IF NOT EXISTS idx_properties_active_td_id ON public.properties (disposition, td_number, id);
CREATE INDEX IF NOT EXISTS idx_properties_active_barangay_id ON public.properties (disposition, barangay, id);
CREATE INDEX IF NOT EXISTS idx_properties_owner_trgm ON public.properties USING gin (owner_name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_properties_td_trgm ON public.properties USING gin (td_number extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_properties_previous_td_trgm ON public.properties USING gin (previous_td_number extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_properties_td_upper ON public.properties (upper(td_number));
CREATE INDEX IF NOT EXISTS idx_verifications_active_property ON public.delinquency_period_verifications (property_id, tax_year, period_key) WHERE status <> 'SUPERSEDED';
-- Existing unique TD, import-file hash, property import-batch, and row-outcome batch indexes are reused.

CREATE OR REPLACE FUNCTION public.list_properties_page(
  p_page integer DEFAULT 1, p_page_size integer DEFAULT 25,
  p_search text DEFAULT '', p_barangay text DEFAULT NULL,
  p_disposition text DEFAULT 'ACTIVE', p_sort text DEFAULT 'ownerName', p_direction text DEFAULT 'asc'
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_page integer := greatest(1, least(coalesce(p_page, 1), 100000));
  v_size integer := greatest(1, least(coalesce(p_page_size, 25), 100));
  v_pattern text := '%' || replace(replace(replace(btrim(coalesce(p_search, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  v_total bigint;
  v_items jsonb;
BEGIN
  IF p_sort NOT IN ('ownerName', 'tdNumber', 'barangay') OR p_direction NOT IN ('asc', 'desc')
     OR p_disposition NOT IN ('ACTIVE', 'ARCHIVED', 'VOIDED', 'CANCELLED', 'SUPERSEDED', 'SAMPLE_RECORD') THEN
    RAISE EXCEPTION 'Invalid property filter or sort';
  END IF;
  SELECT count(*) INTO v_total FROM public.properties p
  WHERE (p.disposition = p_disposition OR (p_disposition = 'ARCHIVED' AND p.disposition <> 'ACTIVE'))
    AND (p_barangay IS NULL OR p.barangay = p_barangay)
    AND (btrim(coalesce(p_search, '')) = '' OR p.owner_name ILIKE v_pattern ESCAPE '\'
      OR p.td_number ILIKE v_pattern ESCAPE '\' OR p.previous_td_number ILIKE v_pattern ESCAPE '\');
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.ordinal), '[]'::jsonb) INTO v_items FROM (
    SELECT p.*, row_number() OVER (ORDER BY
      CASE WHEN p_sort = 'ownerName' AND p_direction = 'asc' THEN p.owner_name END ASC,
      CASE WHEN p_sort = 'ownerName' AND p_direction = 'desc' THEN p.owner_name END DESC,
      CASE WHEN p_sort = 'tdNumber' AND p_direction = 'asc' THEN p.td_number END ASC,
      CASE WHEN p_sort = 'tdNumber' AND p_direction = 'desc' THEN p.td_number END DESC,
      CASE WHEN p_sort = 'barangay' AND p_direction = 'asc' THEN p.barangay END ASC,
      CASE WHEN p_sort = 'barangay' AND p_direction = 'desc' THEN p.barangay END DESC,
      p.id ASC) AS ordinal
    FROM public.properties p
    WHERE (p.disposition = p_disposition OR (p_disposition = 'ARCHIVED' AND p.disposition <> 'ACTIVE'))
      AND (p_barangay IS NULL OR p.barangay = p_barangay)
      AND (btrim(coalesce(p_search, '')) = '' OR p.owner_name ILIKE v_pattern ESCAPE '\'
        OR p.td_number ILIKE v_pattern ESCAPE '\' OR p.previous_td_number ILIKE v_pattern ESCAPE '\')
    ORDER BY ordinal LIMIT v_size OFFSET (v_page - 1) * v_size
  ) q;
  RETURN jsonb_build_object('items', v_items, 'total', v_total, 'page', v_page,
    'pageSize', v_size, 'hasNextPage', v_page * v_size < v_total);
END;
$$;

-- Count-only aggregates: monetary liability and clearance eligibility require the
-- statutory projection engine and must not be estimated from last_paid_year.
CREATE OR REPLACE FUNCTION public.dashboard_property_counts()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'totalProperties', count(*),
    'shellRecordsCount', count(*) FILTER (WHERE is_shell_record OR nullif(btrim(pin), '') IS NULL OR assessed_value <= 0),
    'barangayBreakdown', coalesce((SELECT jsonb_agg(jsonb_build_object('barangay', b.barangay, 'properties', b.cnt, 'outstandingDebt', NULL) ORDER BY b.barangay)
      FROM (SELECT coalesce(barangay, 'Unassigned') AS barangay, count(*) AS cnt
            FROM public.properties WHERE disposition = 'ACTIVE' GROUP BY 1) b), '[]'::jsonb))
  FROM public.properties WHERE disposition = 'ACTIVE';
$$;

-- Import review requires exact TD matches; a page of the masterlist is not an import index.
CREATE OR REPLACE FUNCTION public.lookup_properties_by_td(p_td_numbers text[])
RETURNS SETOF public.properties LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT p.* FROM public.properties p
  WHERE cardinality(p_td_numbers) <= 500 AND upper(p.td_number) = ANY(p_td_numbers);
$$;

REVOKE ALL ON FUNCTION public.list_properties_page(integer,integer,text,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dashboard_property_counts() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lookup_properties_by_td(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_properties_page(integer,integer,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_property_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_properties_by_td(text[]) TO authenticated;
NOTIFY pgrst, 'reload schema';
