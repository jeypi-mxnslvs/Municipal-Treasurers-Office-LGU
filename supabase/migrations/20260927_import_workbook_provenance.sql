-- Workbook import provenance. Forward migration only.

ALTER TABLE public.csv_import_batches
  ADD COLUMN IF NOT EXISTS source_format TEXT NOT NULL DEFAULT 'CSV',
  ADD COLUMN IF NOT EXISTS source_sheets JSONB NOT NULL DEFAULT '[]'::JSONB;

ALTER TABLE public.csv_import_batches
  DROP CONSTRAINT IF EXISTS csv_import_batches_source_format_check;

ALTER TABLE public.csv_import_batches
  ADD CONSTRAINT csv_import_batches_source_format_check
  CHECK (source_format IN ('CSV', 'XLS', 'XLSX'));

ALTER TABLE public.csv_import_row_outcomes
  ADD COLUMN IF NOT EXISTS source_sheet TEXT,
  ADD COLUMN IF NOT EXISTS source_sheet_index INT,
  ADD COLUMN IF NOT EXISTS source_cell TEXT,
  ADD COLUMN IF NOT EXISTS validation_code TEXT;

NOTIFY pgrst, 'reload schema';
