-- Add missing fields to equipment table
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS discount_rate NUMERIC(5,4) DEFAULT 1.0000;

-- Add project_name to customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS project_name TEXT;

-- Add tax_rate and profit_amount to quotations
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) DEFAULT 13.00;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS profit_amount NUMERIC(12,2) DEFAULT 0;

-- Drop the redundant devices table
DROP TABLE IF EXISTS devices;

-- Add index on equipment model for search
CREATE INDEX IF NOT EXISTS idx_equipment_model ON equipment(model);
CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment(category);
