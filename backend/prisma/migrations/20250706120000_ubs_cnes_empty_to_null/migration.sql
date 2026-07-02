-- Empty string breaks the partial unique index (treated as NOT NULL).
UPDATE "ubs" SET "cnes_code" = NULL WHERE "cnes_code" = '';
