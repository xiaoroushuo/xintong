-- Equipment: anon full access (app handles permission logic)
CREATE POLICY "anon_select_equipment" ON equipment FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_equipment" ON equipment FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_equipment" ON equipment FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_equipment" ON equipment FOR DELETE TO anon USING (true);

-- Customers: anon full access
CREATE POLICY "anon_select_customers" ON customers FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_customers" ON customers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_customers" ON customers FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_customers" ON customers FOR DELETE TO anon USING (true);

-- Quotations: anon full access
CREATE POLICY "anon_select_quotations" ON quotations FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_quotations" ON quotations FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_quotations" ON quotations FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_quotations" ON quotations FOR DELETE TO anon USING (true);

-- Quotation items: anon full access
CREATE POLICY "anon_select_quotation_items" ON quotation_items FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_quotation_items" ON quotation_items FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_quotation_items" ON quotation_items FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_quotation_items" ON quotation_items FOR DELETE TO anon USING (true);

-- Price upload logs: anon full access
CREATE POLICY "anon_select_upload_logs" ON price_upload_logs FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_upload_logs" ON price_upload_logs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_upload_logs" ON price_upload_logs FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_upload_logs" ON price_upload_logs FOR DELETE TO anon USING (true);
