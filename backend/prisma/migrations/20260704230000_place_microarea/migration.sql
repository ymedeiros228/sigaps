-- Vincular povoados/localidades a microáreas (pintura de pontos sem rua)
ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "microarea_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'places_microarea_id_fkey'
  ) THEN
    ALTER TABLE "places"
      ADD CONSTRAINT "places_microarea_id_fkey"
      FOREIGN KEY ("microarea_id") REFERENCES "microareas"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "places_microarea_id_idx" ON "places"("microarea_id");
