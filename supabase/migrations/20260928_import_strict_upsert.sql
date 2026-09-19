-- Strict import validation. Forward migration only.

CREATE OR REPLACE FUNCTION public.batch_upsert_properties(p_properties JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_td TEXT;
  v_inserted INT := 0;
  v_updated INT := 0;
  v_class TEXT;
BEGIN
  IF p_properties IS NULL OR jsonb_typeof(p_properties) <> 'array' OR jsonb_array_length(p_properties) = 0 THEN
    RAISE EXCEPTION 'Import batch must contain at least one row';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_properties) LOOP
    v_td := upper(trim(v_item->>'td_number'));
    v_class := trim(COALESCE(v_item->>'property_class', ''));
    IF v_td IS NULL OR v_td = '' OR NULLIF(trim(v_item->>'owner_name'), '') IS NULL
       OR NULLIF(trim(v_item->>'address'), '') IS NULL OR NULLIF(trim(v_item->>'barangay'), '') IS NULL
       OR NULLIF(v_class, '') IS NULL OR (v_item->>'last_paid_year') IS NULL THEN
      RAISE EXCEPTION 'TD % has missing required import fields', COALESCE(v_td, '<unknown>');
    END IF;
    IF v_class NOT IN ('Residential', 'Dwell House', 'Machinery', 'Agricultural', 'Industrial') THEN
      RAISE EXCEPTION 'TD % has invalid property class: %', v_td, v_class;
    END IF;
    IF (v_item->>'assessed_value') IS NULL OR (v_item->>'assessed_value')::NUMERIC < 0
       OR (v_item->>'market_value') IS NULL OR (v_item->>'market_value')::NUMERIC < 0
       OR (v_item->>'lot_area_sqm') IS NULL OR (v_item->>'lot_area_sqm')::NUMERIC < 0 THEN
      RAISE EXCEPTION 'TD % has missing or invalid valuation fields', v_td;
    END IF;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_properties) LOOP
    v_td := upper(trim(v_item->>'td_number'));
    UPDATE public.properties SET
      previous_td_number = v_item->>'previous_td_number', pin = COALESCE(v_item->>'pin', pin),
      owner_name = v_item->>'owner_name', address = v_item->>'address', barangay = v_item->>'barangay',
      property_class = v_item->>'property_class', lot_area_sqm = (v_item->>'lot_area_sqm')::NUMERIC,
      market_value = (v_item->>'market_value')::NUMERIC, assessed_value = (v_item->>'assessed_value')::NUMERIC,
      last_paid_year = (v_item->>'last_paid_year')::INT,
      delinquency_start_year = NULLIF(v_item->>'delinquency_start_year', '')::INT,
      parcel_origin_year = NULLIF(v_item->>'parcel_origin_year', '')::INT,
      historical_assessed_values = COALESCE(v_item->'historical_assessed_values', historical_assessed_values),
      is_shell_record = COALESCE((v_item->>'is_shell_record')::BOOLEAN, is_shell_record),
      encoder_label = COALESCE(v_item->>'encoder_label', encoder_label), entry_type = COALESCE(v_item->>'entry_type', entry_type),
      updated_at = timezone('utc', now())
    WHERE upper(td_number) = v_td;
    IF FOUND THEN
      v_updated := v_updated + 1;
    ELSE
      INSERT INTO public.properties (
        td_number, previous_td_number, pin, owner_name, address, barangay, property_class,
        lot_area_sqm, market_value, assessed_value, last_paid_year, last_paid_quarter,
        delinquency_start_year, parcel_origin_year, historical_assessed_values, is_shell_record, encoder_label, entry_type, updated_at
      ) VALUES (
        v_td, COALESCE(v_item->>'previous_td_number', ''), COALESCE(v_item->>'pin', ''), v_item->>'owner_name', v_item->>'address',
        v_item->>'barangay', v_item->>'property_class', (v_item->>'lot_area_sqm')::NUMERIC, (v_item->>'market_value')::NUMERIC,
        (v_item->>'assessed_value')::NUMERIC, (v_item->>'last_paid_year')::INT, COALESCE((v_item->>'last_paid_quarter')::INT, 4),
        NULLIF(v_item->>'delinquency_start_year', '')::INT, NULLIF(v_item->>'parcel_origin_year', '')::INT,
        COALESCE(v_item->'historical_assessed_values', '{}'::JSONB), COALESCE((v_item->>'is_shell_record')::BOOLEAN, false),
        v_item->>'encoder_label', COALESCE(v_item->>'entry_type', 'CSV_IMPORT'), timezone('utc', now())
      );
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('inserted', v_inserted, 'updated', v_updated);
END;
$$;

GRANT EXECUTE ON FUNCTION public.batch_upsert_properties(JSONB)
  TO anon, authenticated, service_role, postgres;
