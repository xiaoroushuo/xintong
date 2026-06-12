CREATE TABLE devices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model TEXT NOT NULL,
  product_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('交换机', '防火墙', '路由器', 'AC', 'AP', '光模块', '服务器')),
  purchase_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  sale_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_rate NUMERIC(5,4) NOT NULL DEFAULT 1.0000,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_devices" ON devices FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_devices" ON devices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_devices" ON devices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_devices" ON devices FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_devices_model ON devices(model);
CREATE INDEX idx_devices_category ON devices(category);
