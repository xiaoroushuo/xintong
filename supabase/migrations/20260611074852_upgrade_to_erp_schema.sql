-- Add brand column to equipment
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS brand TEXT DEFAULT '华为';

-- Add company column to customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS company TEXT;

-- Create price_upload_logs table
CREATE TABLE IF NOT EXISTS price_upload_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  uploaded_by TEXT NOT NULL DEFAULT 'admin',
  file_name TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  updated_rows INTEGER NOT NULL DEFAULT 0,
  inserted_rows INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  snapshot JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE price_upload_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_upload_logs" ON price_upload_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_upload_logs" ON price_upload_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_upload_logs" ON price_upload_logs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_upload_logs" ON price_upload_logs FOR DELETE TO authenticated USING (true);

-- Unique constraint on model for upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_equipment_model_unique ON equipment(model);
