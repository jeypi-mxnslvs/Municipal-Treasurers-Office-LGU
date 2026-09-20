-- Phase 3 forward migration: atomic verification, reversal, valuation audit, append-only logs.

DO $dedupe$
BEGIN
  IF EXISTS (SELECT 1 FROM public.delinquency_period_verifications WHERE status <> 'SUPERSEDED' GROUP BY property_id, period_key HAVING COUNT(*) > 1) THEN
    UPDATE public.delinquency_period_verifications SET status = 'SUPERSEDED', reversal_reason = 'Phase 3 duplicate active-period containment'
    WHERE id IN (SELECT id FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY property_id, period_key ORDER BY created_at DESC, id DESC) n FROM public.delinquency_period_verifications WHERE status <> 'SUPERSEDED') r WHERE n > 1);
  END IF;
END;
$dedupe$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_verification_period ON public.delinquency_period_verifications (property_id, period_key) WHERE status <> 'SUPERSEDED';

CREATE OR REPLACE FUNCTION public.phase3_protect_audit_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'Audit logs are append-only'; END;
$$;
DROP TRIGGER IF EXISTS phase3_audit_log_immutable ON public.rptar_audit_logs;
CREATE TRIGGER phase3_audit_log_immutable BEFORE UPDATE OR DELETE ON public.rptar_audit_logs FOR EACH ROW EXECUTE FUNCTION public.phase3_protect_audit_log();
REVOKE UPDATE, DELETE ON public.rptar_audit_logs FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.verify_delinquency_period(
  p_property_id INT, p_td_number TEXT, p_period_key TEXT, p_tax_year INT, p_period_label TEXT,
  p_status TEXT, p_verification_type TEXT, p_source_reference TEXT DEFAULT NULL,
  p_remarks TEXT DEFAULT NULL, p_station_id TEXT DEFAULT 'Verification-Desk', p_evidence_type TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_property public.properties%ROWTYPE; v_id BIGINT; v_actor TEXT := auth.uid()::text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_assessor_or_admin() THEN RAISE EXCEPTION 'Assessor or Admin session required'; END IF;
  SELECT * INTO v_property FROM public.properties WHERE id = p_property_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Property % not found', p_property_id; END IF;
  IF NULLIF(BTRIM(p_td_number), '') IS DISTINCT FROM NULLIF(BTRIM(v_property.td_number), '') THEN RAISE EXCEPTION 'TD number does not match authoritative property record'; END IF;
  IF v_property.is_shell_record OR NULLIF(BTRIM(COALESCE(v_property.pin, '')), '') IS NULL OR COALESCE(v_property.assessed_value, 0) <= 0 THEN RAISE EXCEPTION 'Shell records cannot be verified'; END IF;
  IF p_status NOT IN ('VERIFIED_SETTLED_EXTERNALLY','VERIFIED_OUTSTANDING','DISPUTED','NOT_APPLICABLE') THEN RAISE EXCEPTION 'Unsupported verification status: %', p_status; END IF;
  IF p_status = 'VERIFIED_SETTLED_EXTERNALLY' AND NULLIF(BTRIM(p_source_reference), '') IS NULL THEN RAISE EXCEPTION 'External settlement requires sourceReference'; END IF;
  IF p_evidence_type IS NOT NULL AND p_evidence_type NOT IN ('OFFICIAL_RECEIPT','ASSESSMENT_ROLL_AUDIT','COURT_ORDER_AMNESTY','PRIOR_REGISTRY_FOLIO') THEN RAISE EXCEPTION 'Unsupported evidence type: %', p_evidence_type; END IF;
  PERFORM 1 FROM public.delinquency_period_verifications WHERE property_id = p_property_id AND status <> 'SUPERSEDED' ORDER BY tax_year, period_key FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.delinquency_period_verifications WHERE property_id = p_property_id AND period_key = p_period_key AND status <> 'SUPERSEDED') THEN RAISE EXCEPTION 'Period already has an active verification: %', p_period_key; END IF;
  IF EXISTS (SELECT 1 FROM public.delinquency_period_verifications WHERE property_id = p_property_id AND status IN ('VERIFIED_OUTSTANDING','DISPUTED') AND (tax_year, period_key) < (p_tax_year, p_period_key)) THEN RAISE EXCEPTION 'Arrears-first verification required before period %', p_period_key; END IF;
  INSERT INTO public.delinquency_period_verifications (property_id,td_number_snapshot,period_key,tax_year,period_label,status,verification_type,source_reference,remarks,verified_by,verified_by_name,verified_at,station_id,evidence_type)
  VALUES (p_property_id,v_property.td_number,BTRIM(p_period_key),p_tax_year,BTRIM(p_period_label),p_status,p_verification_type,NULLIF(BTRIM(p_source_reference),''),NULLIF(BTRIM(p_remarks),''),v_actor,v_actor,timezone('utc',now()),COALESCE(NULLIF(BTRIM(p_station_id),''),'Verification-Desk'),NULLIF(BTRIM(p_evidence_type),'')) RETURNING id INTO v_id;
  INSERT INTO public.rptar_audit_logs (property_id,td_number,tax_year,action_type,assessor_name,station_id,details) VALUES (p_property_id,v_property.td_number,p_tax_year,'VERIFICATION_'||p_status,v_actor,COALESCE(NULLIF(BTRIM(p_station_id),''),'Verification-Desk'),format('Verified period %s as %s [Ref: %s]',p_period_label,p_status,COALESCE(p_source_reference,'N/A')));
  RETURN jsonb_build_object('id',v_id,'propertyId',p_property_id,'tdNumberSnapshot',v_property.td_number,'periodKey',p_period_key,'taxYear',p_tax_year,'periodLabel',p_period_label,'status',p_status,'verificationType',p_verification_type,'sourceReference',NULLIF(BTRIM(p_source_reference),''),'remarks',NULLIF(BTRIM(p_remarks),''),'verifiedBy',v_actor,'stationId',p_station_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.revert_delinquency_verification(p_verification_id BIGINT,p_reason TEXT,p_station_id TEXT DEFAULT 'Verification-Desk')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_original public.delinquency_period_verifications%ROWTYPE; v_new_id BIGINT; v_actor TEXT := auth.uid()::text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN RAISE EXCEPTION 'Admin session required'; END IF;
  IF NULLIF(BTRIM(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Reversal reason is required'; END IF;
  SELECT * INTO v_original FROM public.delinquency_period_verifications WHERE id=p_verification_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Verification % not found',p_verification_id; END IF;
  IF v_original.status='SUPERSEDED' THEN RAISE EXCEPTION 'Verification already superseded'; END IF;
  UPDATE public.delinquency_period_verifications SET status='SUPERSEDED',reversal_reason=BTRIM(p_reason),remarks=format('Superseded by %s: %s',v_actor,BTRIM(p_reason)) WHERE id=p_verification_id;
  INSERT INTO public.delinquency_period_verifications (property_id,td_number_snapshot,period_key,tax_year,period_label,status,verification_type,source_reference,remarks,verified_by,verified_by_name,verified_at,station_id,supersedes_id,evidence_type)
  VALUES (v_original.property_id,v_original.td_number_snapshot,v_original.period_key,v_original.tax_year,v_original.period_label,'SUPERSEDED',v_original.verification_type,v_original.source_reference,BTRIM(p_reason),v_actor,v_actor,timezone('utc',now()),COALESCE(NULLIF(BTRIM(p_station_id),''),'Verification-Desk'),v_original.id,v_original.evidence_type) RETURNING id INTO v_new_id;
  INSERT INTO public.rptar_audit_logs (property_id,td_number,tax_year,action_type,assessor_name,station_id,details) VALUES (v_original.property_id,v_original.td_number_snapshot,v_original.tax_year,'VERIFICATION_REVERSED',v_actor,COALESCE(NULLIF(BTRIM(p_station_id),''),'Verification-Desk'),format('Superseded verification %s: %s',v_original.id,BTRIM(p_reason)));
  RETURN jsonb_build_object('originalId',v_original.id,'supersedingId',v_new_id,'status','SUPERSEDED');
END;
$$;

CREATE OR REPLACE FUNCTION public.transcribe_historical_assessed_value(p_property_id INT,p_period_label TEXT,p_value NUMERIC,p_rptar_page_reference TEXT DEFAULT NULL,p_reason TEXT DEFAULT NULL)
RETURNS public.properties LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_property public.properties%ROWTYPE; v_values JSONB; v_actor TEXT := auth.uid()::text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_assessor_or_admin() THEN RAISE EXCEPTION 'Assessor or Admin session required'; END IF;
  IF NULLIF(BTRIM(p_period_label),'') IS NULL OR p_value IS NULL OR p_value < 0 THEN RAISE EXCEPTION 'Historical assessed value and period are required'; END IF;
  SELECT * INTO v_property FROM public.properties WHERE id=p_property_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Property % not found',p_property_id; END IF;
  v_values := COALESCE(v_property.historical_assessed_values,'{}'::jsonb) || jsonb_build_object(BTRIM(p_period_label),jsonb_build_object('value',p_value,'transcribedBy',v_actor,'transcribedAt',timezone('utc',now()),'rptarPageReference',NULLIF(BTRIM(p_rptar_page_reference),'')));
  UPDATE public.properties SET historical_assessed_values=v_values,updated_at=timezone('utc',now()) WHERE id=p_property_id RETURNING * INTO v_property;
  INSERT INTO public.rptar_audit_logs (property_id,td_number,action_type,assessor_name,station_id,details,field_changed,new_value,reason) VALUES (p_property_id,v_property.td_number,'VALUATION_REVISED',v_actor,'Assessor-Desk',format('Transcribed historical AV for %s',BTRIM(p_period_label)),'historical_assessed_values.'||BTRIM(p_period_label),p_value,COALESCE(NULLIF(BTRIM(p_reason),''),'Physical RPTAR Ledger Transcription'));
  RETURN v_property;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_delinquency_period(INT,TEXT,TEXT,INT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_delinquency_period(INT,TEXT,TEXT,INT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.revert_delinquency_verification(BIGINT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revert_delinquency_verification(BIGINT,TEXT,TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.transcribe_historical_assessed_value(INT,TEXT,NUMERIC,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transcribe_historical_assessed_value(INT,TEXT,NUMERIC,TEXT,TEXT) TO authenticated;
