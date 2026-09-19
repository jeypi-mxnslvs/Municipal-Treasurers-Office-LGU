-- Import traceability and reconciliation metadata.
-- Forward migration only; preserve existing migration history.

ALTER TABLE public.csv_import_batches
  ADD COLUMN IF NOT EXISTS file_hash TEXT,
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS station_id TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'COMMITTED',
  ADD COLUMN IF NOT EXISTS rejected_rows INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_csv_import_batches_file_hash
  ON public.csv_import_batches(file_hash)
  WHERE file_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_csv_import_batches_created_at
  ON public.csv_import_batches(created_at DESC);

ALTER TABLE public.csv_import_batches
  DROP CONSTRAINT IF EXISTS csv_import_batches_status_check;

ALTER TABLE public.csv_import_batches
  ADD CONSTRAINT csv_import_batches_status_check
  CHECK (status IN (
    'RECEIVED',
    'VALIDATED',
    'READY_TO_COMMIT',
    'COMMITTED',
    'COMMITTED_WITH_ERRORS',
    'REJECTED',
    'RECONCILIATION_FAILED',
    'DUPLICATE_FILE'
  ));

CREATE TABLE IF NOT EXISTS public.csv_import_row_outcomes (
  id BIGSERIAL PRIMARY KEY,
  batch_id BIGINT NOT NULL REFERENCES public.csv_import_batches(id) ON DELETE CASCADE,
  source_line INT,
  td_number TEXT,
  outcome TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT csv_import_row_outcomes_outcome_check CHECK (outcome IN (
    'INSERTED',
    'UPDATED',
    'UNCHANGED',
    'REJECTED',
    'DUPLICATE_IN_FILE',
    'CONFLICTING_RECORD',
    'FAILED'
  ))
);

CREATE INDEX IF NOT EXISTS idx_csv_import_row_outcomes_batch_id
  ON public.csv_import_row_outcomes(batch_id);

ALTER TABLE public.csv_import_row_outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on csv_import_row_outcomes" ON public.csv_import_row_outcomes;
CREATE POLICY "Allow all on csv_import_row_outcomes"
  ON public.csv_import_row_outcomes
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
