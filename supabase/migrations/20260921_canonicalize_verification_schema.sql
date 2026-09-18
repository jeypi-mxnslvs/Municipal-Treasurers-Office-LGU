-- Canonicalize legacy delinquency verification rows created by the original baseline.
-- Applied migrations remain immutable; this forward migration repairs deployed schemas.

ALTER TABLE public.delinquency_period_verifications
  ADD COLUMN IF NOT EXISTS verified_by_name TEXT,
  ADD COLUMN IF NOT EXISTS evidence_type TEXT;

UPDATE public.delinquency_period_verifications
SET status = 'UNVERIFIED'
WHERE status = 'PENDING';

UPDATE public.delinquency_period_verifications
SET verification_type = 'EXTERNAL_SETTLEMENT_EVIDENCE'
WHERE verification_type = 'OFFICIAL_RECEIPT';

ALTER TABLE public.delinquency_period_verifications
  DROP CONSTRAINT IF EXISTS delinquency_period_verifications_status_check,
  DROP CONSTRAINT IF EXISTS delinquency_period_verifications_verification_type_check;

ALTER TABLE public.delinquency_period_verifications
  ADD CONSTRAINT delinquency_period_verifications_status_check
    CHECK (status IN (
      'UNVERIFIED',
      'VERIFIED_OUTSTANDING',
      'VERIFIED_SETTLED_EXTERNALLY',
      'DISPUTED',
      'NOT_APPLICABLE',
      'SUPERSEDED'
    )),
  ADD CONSTRAINT delinquency_period_verifications_verification_type_check
    CHECK (verification_type IN (
      'ASSESSMENT',
      'HISTORICAL_VALUATION',
      'DELINQUENCY',
      'EXTERNAL_SETTLEMENT_EVIDENCE'
    ));

CREATE INDEX IF NOT EXISTS idx_delinquency_period_verifications_property_period
  ON public.delinquency_period_verifications (property_id, period_key);

NOTIFY pgrst, 'reload schema';
