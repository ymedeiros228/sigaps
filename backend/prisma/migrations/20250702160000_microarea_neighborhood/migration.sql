-- Vínculo de microárea com bairro (centralizador territorial no mapa)
-- IDs no SIGAPS são TEXT (uuid string), não o tipo nativo UUID do Postgres.
ALTER TABLE "microareas" DROP COLUMN IF EXISTS "neighborhood_id";
ALTER TABLE "microareas" ADD COLUMN IF NOT EXISTS "neighborhood_id" TEXT;

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
