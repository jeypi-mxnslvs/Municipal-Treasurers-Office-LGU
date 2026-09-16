-- =========================================================
-- MIGRATION: 20260916_historical_gap_preservation.sql
-- Santa Rosa LGU Treasury Connect — Historical Gap Preservation
-- =========================================================

-- 1. Add historical gap and origin tracking columns to properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS delinquency_start_year INT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS parcel_origin_year INT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS historical_assessed_values JSONB DEFAULT '{}'::jsonb;

-- 2. Update batch_upsert_properties to support historical gap preservation
CREATE OR REPLACE FUNCTION batch_upsert_properties(
    p_properties JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item JSONB;
    v_inserted INT := 0;
    v_updated INT := 0;
    v_td TEXT;
    v_exists BOOLEAN;
BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_properties)
    LOOP
        v_td := trim(v_item->>'td_number');
        IF v_td IS NOT NULL AND v_td != '' THEN
            SELECT EXISTS(SELECT 1 FROM properties WHERE td_number = v_td) INTO v_exists;
            
            IF v_exists THEN
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
                    parcel_origin_year = COALESCE((v_item->>'parcel_origin_year')::INT, parcel_origin_year),
                    historical_assessed_values = COALESCE((v_item->'historical_assessed_values'), historical_assessed_values),
                    is_shell_record = COALESCE((v_item->>'is_shell_record')::BOOLEAN, is_shell_record),
                    updated_at = timezone('utc'::text, now())
                    -- Financial history protection: last_paid_year, last_paid_quarter & delinquency_start_year are NEVER altered on update
                WHERE td_number = v_td;
                v_updated := v_updated + 1;
            ELSE
                INSERT INTO properties (
                    td_number, previous_td_number, pin, owner_name, address, barangay, property_class,
                    lot_area_sqm, market_value, assessed_value, last_paid_year, last_paid_quarter,
                    delinquency_start_year, parcel_origin_year, historical_assessed_values,
                    is_shell_record, updated_at
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
                    COALESCE(v_item->'historical_assessed_values', '{}'::jsonb),
                    COALESCE((v_item->>'is_shell_record')::BOOLEAN, false),
                    timezone('utc'::text, now())
                );
                v_inserted := v_inserted + 1;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('inserted', v_inserted, 'updated', v_updated);
END;
$$;
