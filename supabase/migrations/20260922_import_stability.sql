-- Import stability: canonical property classes and atomic batch validation.
-- Forward migration only; do not edit previously applied migrations.

UPDATE schedule_of_market_values
SET property_class = 'Dwell House'
WHERE property_class = 'Commercial';

UPDATE properties
SET property_class = 'Dwell House'
WHERE property_class = 'Commercial';

ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_property_class_check;

ALTER TABLE properties
  ADD CONSTRAINT properties_property_class_check
  CHECK (property_class IN ('Residential', 'Dwell House', 'Machinery', 'Agricultural', 'Industrial'));

CREATE OR REPLACE FUNCTION batch_upsert_properties(p_properties JSONB)
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

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_properties)
  LOOP
    v_td := upper(trim(v_item->>'td_number'));
    v_class := trim(COALESCE(v_item->>'property_class', 'Residential'));

    IF v_td IS NULL OR v_td = '' THEN
      RAISE EXCEPTION 'Import row is missing TD number';
    END IF;
    IF v_class NOT IN ('Residential', 'Dwell House', 'Machinery', 'Agricultural', 'Industrial') THEN
      RAISE EXCEPTION 'TD % has invalid property class: %', v_td, v_class;
    END IF;
    IF (v_item->>'assessed_value') IS NULL OR (v_item->>'assessed_value')::NUMERIC < 0 THEN
      RAISE EXCEPTION 'TD % has invalid assessed value', v_td;
    END IF;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_properties)
  LOOP
    v_td := upper(trim(v_item->>'td_number'));
    UPDATE properties SET
      previous_td_number = COALESCE(v_item->>'previous_td_number', previous_td_number),
      pin = COALESCE(v_item->>'pin', pin),
      owner_name = COALESCE(v_item->>'owner_name', owner_name),
      address = COALESCE(v_item->>'address', address),
      barangay = COALESCE(v_item->>'barangay', barangay),
      property_class = COALESCE(v_item->>'property_class', property_class),
      lot_area_sqm = COALESCE((v_item->>'lot_area_sqm')::NUMERIC, lot_area_sqm),
      market_value = COALESCE((v_item->>'market_value')::NUMERIC, market_value),
      assessed_value = COALESCE((v_item->>'assessed_value')::NUMERIC, assessed_value),
      is_shell_record = COALESCE((v_item->>'is_shell_record')::BOOLEAN, is_shell_record),
      encoder_label = COALESCE(v_item->>'encoder_label', encoder_label),
      entry_type = COALESCE(v_item->>'entry_type', entry_type),
      updated_at = timezone('utc', now())
    WHERE upper(td_number) = v_td;

    IF FOUND THEN
      v_updated := v_updated + 1;
    ELSE
      INSERT INTO properties (
        td_number, previous_td_number, pin, owner_name, address, barangay, property_class,
        lot_area_sqm, market_value, assessed_value, last_paid_year, last_paid_quarter,
        delinquency_start_year, parcel_origin_year, historical_assessed_values,
        is_shell_record, encoder_label, entry_type, updated_at
      ) VALUES (
        v_td,
        COALESCE(v_item->>'previous_td_number', ''),
        COALESCE(v_item->>'pin', ''),
        COALESCE(v_item->>'owner_name', 'Unnamed Taxpayer'),
        COALESCE(v_item->>'address', 'Santa Rosa, Nueva Ecija'),
        COALESCE(v_item->>'barangay', 'Poblacion'),
        COALESCE(v_item->>'property_class', 'Residential'),
        COALESCE((v_item->>'lot_area_sqm')::NUMERIC, 100),
        COALESCE((v_item->>'market_value')::NUMERIC, 0),
        COALESCE((v_item->>'assessed_value')::NUMERIC, 0),
        COALESCE((v_item->>'last_paid_year')::INT, 1973),
        COALESCE((v_item->>'last_paid_quarter')::INT, 4),
        (v_item->>'delinquency_start_year')::INT,
        (v_item->>'parcel_origin_year')::INT,
        COALESCE(v_item->'historical_assessed_values', '{}'::JSONB),
        COALESCE((v_item->>'is_shell_record')::BOOLEAN, false),
        v_item->>'encoder_label',
        COALESCE(v_item->>'entry_type', 'CSV_IMPORT'),
        timezone('utc', now())
      );
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('inserted', v_inserted, 'updated', v_updated);
END;
$$;

GRANT EXECUTE ON FUNCTION batch_upsert_properties(JSONB)
  TO anon, authenticated, service_role, postgres;
