-- Lado da via (mão dupla): esquerda, direita ou rua inteira (zona rural)
CREATE TYPE "StreetPaintSide" AS ENUM ('FULL', 'LEFT', 'RIGHT');

ALTER TABLE "street_paint_segments"
ADD COLUMN "side" "StreetPaintSide" NOT NULL DEFAULT 'FULL';

CREATE INDEX "street_paint_segments_street_id_side_start_index_idx"
ON "street_paint_segments"("street_id", "side", "start_index");
