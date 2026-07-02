ALTER TABLE "ubs" ADD COLUMN IF NOT EXISTS "cnes_code" VARCHAR(7);

CREATE UNIQUE INDEX IF NOT EXISTS "ubs_cnes_code_municipality_id_key"
  ON "ubs" ("cnes_code", "municipality_id")
  WHERE "cnes_code" IS NOT NULL;
