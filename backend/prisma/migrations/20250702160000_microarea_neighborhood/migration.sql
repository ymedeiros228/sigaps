-- Vínculo de microárea com bairro (centralizador territorial no mapa)
ALTER TABLE "microareas" ADD COLUMN IF NOT EXISTS "neighborhood_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'microareas_neighborhood_id_fkey'
  ) THEN
    ALTER TABLE "microareas"
      ADD CONSTRAINT "microareas_neighborhood_id_fkey"
      FOREIGN KEY ("neighborhood_id") REFERENCES "neighborhoods"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "microareas_neighborhood_id_idx" ON "microareas"("neighborhood_id");
