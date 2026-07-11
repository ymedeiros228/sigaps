-- Observações independentes por lado da via (zona urbana)
ALTER TABLE "streets"
ADD COLUMN "left_side_notes" TEXT,
ADD COLUMN "right_side_notes" TEXT;
