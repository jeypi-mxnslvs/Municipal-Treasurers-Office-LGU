-- Compatibility bridge for clean installs of the historical migration chain.
-- Existing projects already have this legacy table; do not modify their data.
-- The application does not post payments or issue receipts.
CREATE TABLE IF NOT EXISTS public.payment_postings (
  id SERIAL PRIMARY KEY,
  receipt_no TEXT UNIQUE NOT NULL,
  property_id INT REFERENCES public.properties(id) ON DELETE RESTRICT,
  paid_records JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_paid NUMERIC NOT NULL DEFAULT 0,
  tender_type TEXT,
  tender_reference TEXT,
  posted_by TEXT,
  posted_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.payment_postings ENABLE ROW LEVEL SECURITY;
