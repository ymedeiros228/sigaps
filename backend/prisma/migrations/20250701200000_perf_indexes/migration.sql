CREATE INDEX IF NOT EXISTS "ubs_municipality_id_idx" ON "ubs"("municipality_id");
CREATE INDEX IF NOT EXISTS "neighborhoods_municipality_id_idx" ON "neighborhoods"("municipality_id");
CREATE INDEX IF NOT EXISTS "microareas_municipality_id_idx" ON "microareas"("municipality_id");
CREATE INDEX IF NOT EXISTS "acs_municipality_id_idx" ON "acs"("municipality_id");
CREATE INDEX IF NOT EXISTS "users_municipality_id_idx" ON "users"("municipality_id");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "streets_municipality_osm_idx" ON "streets"("municipality_id") WHERE "osm_id" IS NOT NULL;
