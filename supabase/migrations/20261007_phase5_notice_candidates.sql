-- Bounded chronological batch-notice candidate lookup; no existing migration is rewritten.
CREATE INDEX IF NOT EXISTS idx_properties_notice_candidates
  ON public.properties (id)
  WHERE disposition = 'ACTIVE' AND is_shell_record = false
    AND pin IS NOT NULL AND pin <> '' AND assessed_value > 0;
