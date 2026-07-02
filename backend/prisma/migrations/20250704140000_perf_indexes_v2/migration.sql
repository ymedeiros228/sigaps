CREATE INDEX IF NOT EXISTS "streets_neighborhood_id_idx" ON "streets"("neighborhood_id");
CREATE INDEX IF NOT EXISTS "streets_municipality_microarea_idx" ON "streets"("municipality_id", "microarea_id");
CREATE INDEX IF NOT EXISTS "acs_municipality_status_idx" ON "acs"("municipality_id", "status");
